using FyBlue.Contracts;
using FyBlue.Server.Data;
using FyBlue.Server.Services;
using FyBlue.Server.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers;

/// <summary>Müşterinin OSOS hesapları ve bu hesaplardan gelen abonelikler (OSOS/Entegrasyon sekmesi).</summary>
[ApiController]
[Authorize]
[Route("api")]
public sealed class OsosConnectionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _me;
    private readonly OsosSessionService _osos;

    public OsosConnectionsController(AppDbContext db, CurrentUser me, OsosSessionService osos)
    {
        _db = db;
        _me = me;
        _osos = osos;
    }

    [HttpGet("customers/{customerId:int}/osos-connections")]
    public async Task<IReadOnlyList<OsosConnectionDto>> List(int customerId, CancellationToken ct)
    {
        await _me.EnsureCanAccessCustomerAsync(customerId, ct);
        return await _db.OsosConnections.AsNoTracking().Where(c => c.CustomerId == customerId)
            .OrderByDescending(c => c.IsActive).ThenBy(c => c.ConnectionName).Select(CustomerMappings.ConnectionDto).ToListAsync(ct);
    }

    [HttpPost("customers/{customerId:int}/osos-connections")]
    public async Task<OsosConnectionDto> Create(int customerId, OsosConnectionSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        if (!await _db.Customers.AnyAsync(c => c.Id == customerId, ct)) throw new NotFoundException();
        if (string.IsNullOrWhiteSpace(req.Password)) throw new ValidationException("Şifre zorunlu.");
        var conn = new OsosConnection { CustomerId = customerId };
        await ApplyAsync(conn, req, ct);
        _db.OsosConnections.Add(conn);
        await _db.SaveChangesAsync(ct);
        return await Single(conn.Id, ct);
    }

    [HttpPut("osos-connections/{id:int}")]
    public async Task<OsosConnectionDto> Update(int id, OsosConnectionSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var conn = await _db.OsosConnections.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException();
        await ApplyAsync(conn, req, ct);
        await _db.SaveChangesAsync(ct);
        _osos.Forget(OsosSessionService.ConnectionKey(id));
        return await Single(id, ct);
    }

    private async Task ApplyAsync(OsosConnection c, OsosConnectionSaveRequest r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.Username)) throw new ValidationException("OSOS kullanıcı kodu zorunlu.");
        if (r.DistributionCompanyId is int dc && !await _db.ParameterValues.AnyAsync(
                v => v.Id == dc && v.ParameterGroup!.Code == ParameterGroupCodes.DistributionCompany, ct))
            throw new ValidationException("Geçersiz dağıtım şirketi.");
        c.DistributionCompanyId = r.DistributionCompanyId;
        c.ConnectionName = CustomersController.Clean(r.ConnectionName);
        c.Username = r.Username.Trim();
        if (!string.IsNullOrWhiteSpace(r.Password)) c.EncryptedPassword = _osos.Protect(r.Password);
        c.IsActive = r.IsActive;
        c.UpdatedAt = DateTime.UtcNow;
    }

    private Task<OsosConnectionDto> Single(int id, CancellationToken ct) =>
        _db.OsosConnections.AsNoTracking().Where(c => c.Id == id).Select(CustomerMappings.ConnectionDto).FirstAsync(ct);

    [HttpPost("osos-connections/{id:int}/test")]
    public async Task<LinkResponse> Test(int id, [FromServices] OsosSyncService sync, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var (ok, msg) = await sync.TestAsync(id, ct);
        return new LinkResponse(ok, msg);
    }

    [HttpPost("osos-connections/{id:int}/sync")]
    public async Task<OsosSyncResult> Sync(int id, [FromServices] OsosSyncService sync, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        return await sync.SyncAsync(id, ct);
    }

    // ---- Abonelikler ----

    [HttpGet("customers/{customerId:int}/osos-subscriptions")]
    public async Task<IReadOnlyList<OsosSubscriptionDto>> Subscriptions(int customerId, bool includeInactive = false, CancellationToken ct = default)
    {
        await _me.EnsureCanAccessCustomerAsync(customerId, ct);
        var q = _db.OsosSubscriptions.AsNoTracking().Where(s => s.OsosConnection!.CustomerId == customerId);
        if (!includeInactive) q = q.Where(s => s.IsActive);
        return await q.OrderBy(s => s.SourceTitle).ThenBy(s => s.SubscriptionSerno).Select(CustomerMappings.SubscriptionDto).ToListAsync(ct);
    }

    [HttpPut("osos-subscriptions/{id:int}/installation")]
    public async Task<OsosSubscriptionDto> Link(int id, LinkSubscriptionRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var sub = await _db.OsosSubscriptions.Include(s => s.OsosConnection).FirstOrDefaultAsync(s => s.Id == id, ct)
                  ?? throw new NotFoundException();
        if (req.InstallationId is int iid)
        {
            var inst = await _db.Installations.Include(i => i.OsosSubscriptions).FirstOrDefaultAsync(i => i.Id == iid, ct)
                       ?? throw new NotFoundException("Tesisat bulunamadı.");
            if (inst.CustomerId != sub.OsosConnection!.CustomerId) throw new ValidationException("Tesisat bu müşteriye ait değil.");
            sub.InstallationId = iid;
            if (!inst.OsosSubscriptions.Contains(sub)) inst.OsosSubscriptions.Add(sub);
            OsosSubscriptionMapper.ApplySourceToInstallation(inst, inst.OsosSubscriptions);
            inst.UpdatedAt = DateTime.UtcNow;
        }
        else sub.InstallationId = null;
        sub.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await _db.OsosSubscriptions.AsNoTracking().Where(s => s.Id == id).Select(CustomerMappings.SubscriptionDto).FirstAsync(ct);
    }

    /// <summary>Aboneliğin OSOS bilgileriyle yeni bir tüketim tesisatı açar ve eşleştirir.</summary>
    [HttpPost("osos-subscriptions/{id:int}/create-installation")]
    public async Task<OsosSubscriptionDto> CreateInstallation(int id, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var sub = await _db.OsosSubscriptions.Include(s => s.OsosConnection).FirstOrDefaultAsync(s => s.Id == id, ct)
                  ?? throw new NotFoundException();
        var inst = new Installation
        {
            CustomerId = sub.OsosConnection!.CustomerId,
            Name = sub.SourceTitle ?? sub.IdentifierValue ?? $"Tesisat {sub.SubscriptionSerno}",
            InstallationType = InstallationTypes.Consumption,
            DistributionCompanyId = sub.OsosConnection.DistributionCompanyId,
        };
        OsosSubscriptionMapper.ApplySourceToInstallation(inst, [sub]);
        inst.OsosSubscriptions.Add(sub);
        _db.Installations.Add(inst);
        await _db.SaveChangesAsync(ct);
        return await _db.OsosSubscriptions.AsNoTracking().Where(s => s.Id == id).Select(CustomerMappings.SubscriptionDto).FirstAsync(ct);
    }
}
