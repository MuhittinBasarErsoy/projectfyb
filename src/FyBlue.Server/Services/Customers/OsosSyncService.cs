using System.Text.Json;
using FyBlue.Contracts;
using FyBlue.Server.Data;
using Microsoft.EntityFrameworkCore;
using Osos.Core.Osos;

namespace FyBlue.Server.Services.Customers;

/// <summary>
/// Müşteri OSOS bağlantılarını test eder ve abonelikleri osos_subscriptions'a senkronize eder.
/// Bir OSOS hesabı birden çok abonelik getirebilir; abonelikler Serno ile upsert edilir,
/// OSOS'ta artık görünmeyenler pasife alınır (silinmez).
/// </summary>
public sealed class OsosSyncService
{
    private readonly AppDbContext _db;
    private readonly OsosSessionService _osos;
    private readonly ILogger<OsosSyncService> _logger;

    public OsosSyncService(AppDbContext db, OsosSessionService osos, ILogger<OsosSyncService> logger)
    {
        _db = db;
        _osos = osos;
        _logger = logger;
    }

    public async Task<(bool ok, string message)> TestAsync(int connectionId, CancellationToken ct)
    {
        var conn = await _db.OsosConnections.FirstOrDefaultAsync(c => c.Id == connectionId, ct) ?? throw new NotFoundException();
        var (ok, msg, serno) = await _osos.TryLoginAsync(conn.Username, _osos.Unprotect(conn.EncryptedPassword), false, ct);
        conn.LastConnectionTestAt = DateTime.UtcNow;
        conn.LastConnectionStatus = ok ? $"Başarılı (Serno: {serno})" : Trim(msg ?? "Giriş başarısız");
        await _db.SaveChangesAsync(ct);
        return (ok, conn.LastConnectionStatus);
    }

    public async Task<OsosSyncResult> SyncAsync(int connectionId, CancellationToken ct)
    {
        var conn = await _db.OsosConnections.Include(c => c.Subscriptions)
            .FirstOrDefaultAsync(c => c.Id == connectionId, ct) ?? throw new NotFoundException();

        string json;
        try
        {
            string key = OsosSessionService.ConnectionKey(conn.Id);
            _osos.Forget(key); // her senkronizasyonda güncel liste
            json = await _osos.GetPortalSubscriptionsJsonAsync(key, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OSOS senkronizasyonu başarısız: bağlantı #{Id}", conn.Id);
            conn.LastConnectionTestAt = DateTime.UtcNow;
            conn.LastConnectionStatus = Trim("Senkronizasyon hatası: " + ex.Message);
            await _db.SaveChangesAsync(ct);
            return new OsosSyncResult(false, conn.LastConnectionStatus, 0, 0, 0);
        }

        using var doc = JsonDocument.Parse(json);
        var items = OsosSubscriptions.FindFirstObjectArray(doc.RootElement)?.EnumerateArray()
            .Where(i => i.ValueKind == JsonValueKind.Object).ToList() ?? [];

        int added = 0, updated = 0;
        var seen = new HashSet<long>();
        foreach (var item in items)
        {
            long serno = OsosSubscriptions.ExtractSerno(item);
            if (serno <= 0 || !seen.Add(serno)) continue;
            var sub = conn.Subscriptions.FirstOrDefault(s => s.SubscriptionSerno == serno);
            if (sub is null)
            {
                sub = new OsosSubscription { SubscriptionSerno = serno };
                conn.Subscriptions.Add(sub);
                added++;
            }
            else updated++;
            OsosSubscriptionMapper.Apply(item, sub);
            sub.IsActive = true;
            sub.UpdatedAt = DateTime.UtcNow;
        }

        int deactivated = 0;
        foreach (var gone in conn.Subscriptions.Where(s => s.IsActive && s.Id != 0 && !seen.Contains(s.SubscriptionSerno)))
        {
            gone.IsActive = false;
            gone.UpdatedAt = DateTime.UtcNow;
            deactivated++;
        }

        // Eşleşmiş tesisatların kaynak alanları (manuel alanlar korunur).
        var instIds = conn.Subscriptions.Where(s => s.InstallationId is not null).Select(s => s.InstallationId!.Value).Distinct().ToList();
        if (instIds.Count > 0)
        {
            var installations = await _db.Installations.Include(i => i.OsosSubscriptions)
                .Where(i => instIds.Contains(i.Id)).ToListAsync(ct);
            foreach (var inst in installations)
            {
                OsosSubscriptionMapper.ApplySourceToInstallation(inst, inst.OsosSubscriptions);
                inst.UpdatedAt = DateTime.UtcNow;
            }
        }

        conn.LastSyncAt = DateTime.UtcNow;
        conn.LastConnectionTestAt = DateTime.UtcNow;
        conn.LastConnectionStatus = $"Senkronize edildi: {seen.Count} abonelik";
        await _db.SaveChangesAsync(ct);
        return new OsosSyncResult(true, conn.LastConnectionStatus, added, updated, deactivated);
    }

    /// <summary>Hangfire günlük işi: tüm aktif bağlantılar (biri başarısız olsa da diğerleri sürer).</summary>
    public async Task SyncAllAsync()
    {
        var ids = await _db.OsosConnections.Where(c => c.IsActive && c.Customer!.IsActive).Select(c => c.Id).ToListAsync();
        foreach (var id in ids)
        {
            var r = await SyncAsync(id, CancellationToken.None);
            _logger.LogInformation("OSOS senkronizasyonu #{Id}: {Message}", id, r.Message);
        }
    }

    private static string Trim(string s) => s.Length > 500 ? s[..500] : s;
}
