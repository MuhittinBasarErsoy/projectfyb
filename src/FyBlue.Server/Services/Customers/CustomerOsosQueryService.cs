using System.Text.Json;
using System.Text.Json.Nodes;
using FyBlue.Contracts;
using FyBlue.Server.Data;
using Microsoft.EntityFrameworkCore;
using Osos.Core.Osos;

namespace FyBlue.Server.Services.Customers;

/// <summary>
/// Müşteri detayındaki Tüketim / Üretim / Endeks sekmeleri: müşterinin OSOS bağlantılarıyla canlı sorgu.
/// Her bağlantı için kendi abonelikleri Selected olarak gönderilir; sonuç satırları tek dizide birleştirilir.
/// Sonuç geçmişe yazılmaz (Sorgu sayfası kullanıcının kendi hesabıyla çalışır, bu müşteri hesabıyla).
/// </summary>
public sealed class CustomerOsosQueryService
{
    private readonly AppDbContext _db;
    private readonly OsosSessionService _osos;

    public CustomerOsosQueryService(AppDbContext db, OsosSessionService osos)
    {
        _db = db;
        _osos = osos;
    }

    /// <summary>kind: consumption | production | endex.</summary>
    public async Task<CustomerOsosResult> RunAsync(int customerId, string kind, CustomerOsosQuery q, CancellationToken ct)
    {
        var subs = _db.OsosSubscriptions.AsNoTracking()
            .Where(s => s.IsActive && s.OsosConnection!.IsActive && s.OsosConnection.CustomerId == customerId);
        if (q.InstallationId is int iid) subs = subs.Where(s => s.InstallationId == iid);
        if (kind == "production")
            subs = subs.Where(s => s.Installation != null && (s.Installation.InstallationType == InstallationTypes.Production
                                                           || s.Installation.InstallationType == InstallationTypes.ProductionConsumption));

        var byConnection = (await subs.Select(s => new { s.OsosConnectionId, s.SubscriptionSerno }).ToListAsync(ct))
            .GroupBy(x => x.OsosConnectionId, x => x.SubscriptionSerno).ToList();

        var warnings = new List<string>();
        if (byConnection.Count == 0)
        {
            warnings.Add(kind == "production"
                ? "Üretim tesisatına eşleşmiş OSOS aboneliği yok (OSOS/Entegrasyon sekmesinden eşleştirin)."
                : "Aktif OSOS aboneliği yok (OSOS/Entegrasyon sekmesinden bağlantı ekleyip senkronize edin).");
            return new CustomerOsosResult("[]", 0, 0, warnings);
        }

        string screen = kind == "endex" ? "Endex" : "Consumption";
        var rows = new JsonArray();
        int subCount = 0;
        foreach (var g in byConnection)
        {
            string key = OsosSessionService.ConnectionKey(g.Key);
            try
            {
                long customerSerno = await _osos.GetCustomerSernoAsync(key, ct);
                var sel = g.Distinct().ToArray();
                subCount += sel.Length;
                var (_, method, p) = SearchService.BuildScreenCall(screen, customerSerno, q.StartDate, q.EndDate, q.Type, sel);
                string json = await _osos.CallAsync(key, method, p, ct);
                using var doc = JsonDocument.Parse(json);
                if (OsosSubscriptions.FindFirstObjectArray(doc.RootElement) is { } arr)
                    foreach (var item in arr.EnumerateArray())
                        rows.Add(JsonNode.Parse(item.GetRawText()));
            }
            catch (Exception ex) when (ex is InvalidOperationException or HttpRequestException)
            {
                warnings.Add($"Bağlantı #{g.Key}: {ex.Message}");
            }
        }
        return new CustomerOsosResult(rows.ToJsonString(), rows.Count, subCount, warnings);
    }
}
