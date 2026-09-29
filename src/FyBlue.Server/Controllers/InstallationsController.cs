using FyBlue.Contracts;
using FyBlue.Server.Data;
using FyBlue.Server.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers;

/// <summary>Tesisatlar (+ üretim teknik bilgileri). Görüntüleme müşteri kapsamında; düzenleme danışmanda.</summary>
[ApiController]
[Authorize]
[Route("api")]
public sealed class InstallationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _me;

    public InstallationsController(AppDbContext db, CurrentUser me)
    {
        _db = db;
        _me = me;
    }

    private IQueryable<Installation> Query() => _db.Installations.AsNoTracking()
        .Include(i => i.DistributionCompany).Include(i => i.ProductionSiteInfo).Include(i => i.OsosSubscriptions.Where(s => s.IsActive));

    [HttpGet("customers/{customerId:int}/installations")]
    public async Task<IReadOnlyList<InstallationDto>> List(int customerId, bool includeInactive = false, CancellationToken ct = default)
    {
        await _me.EnsureCanAccessCustomerAsync(customerId, ct);
        var q = Query().Where(i => i.CustomerId == customerId);
        if (!includeInactive) q = q.Where(i => i.IsActive);
        return (await q.OrderBy(i => i.Name).ToListAsync(ct)).Select(i => i.ToDto()).ToList();
    }

    [HttpGet("installations/{id:int}")]
    public async Task<InstallationDto> Get(int id, CancellationToken ct)
    {
        var i = await Query().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException();
        await _me.EnsureCanAccessCustomerAsync(i.CustomerId, ct);
        return i.ToDto();
    }

    [HttpPost("customers/{customerId:int}/installations")]
    public async Task<InstallationDto> Create(int customerId, InstallationSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        if (!await _db.Customers.AnyAsync(c => c.Id == customerId, ct)) throw new NotFoundException();
        var inst = new Installation { CustomerId = customerId };
        await ApplyAsync(inst, req, ct);
        _db.Installations.Add(inst);
        await _db.SaveChangesAsync(ct);
        return await Get(inst.Id, ct);
    }

    [HttpPut("installations/{id:int}")]
    public async Task<InstallationDto> Update(int id, InstallationSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var inst = await _db.Installations.Include(i => i.ProductionSiteInfo).FirstOrDefaultAsync(i => i.Id == id, ct)
                   ?? throw new NotFoundException();
        await ApplyAsync(inst, req, ct);
        await _db.SaveChangesAsync(ct);
        return await Get(id, ct);
    }

    private async Task ApplyAsync(Installation inst, InstallationSaveRequest r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new ValidationException("Tesisat adı zorunlu.");
        if (!InstallationTypes.All.Contains(r.InstallationType)) throw new ValidationException("Geçersiz tesisat tipi.");
        bool production = InstallationTypes.HasProduction(r.InstallationType);
        if (production && !GenerationTypes.All.Contains(r.GenerationType ?? ""))
            throw new ValidationException("Üretim tesisatı için üretim tipi seçilmeli.");
        if (r.DistributionCompanyId is int dc && !await _db.ParameterValues.AnyAsync(
                v => v.Id == dc && v.ParameterGroup!.Code == ParameterGroupCodes.DistributionCompany, ct))
            throw new ValidationException("Geçersiz dağıtım şirketi.");

        var psi = r.ProductionSiteInfo;
        if (production && r.GenerationType == GenerationTypes.Solar && (psi?.TiltDeg is null || psi.AzimuthDeg is null))
            throw new ValidationException("GES için eğim ve azimut zorunlu.");
        if (psi?.TiltDeg is < 0 or > 90) throw new ValidationException("Eğim 0–90° arasında olmalı.");
        if (psi?.AzimuthDeg is < -180 or > 360) throw new ValidationException("Azimut -180–360° arasında olmalı.");
        if (psi?.PlantSubtype is { } st && !PlantSubtypes.All.Contains(st)) throw new ValidationException("Geçersiz santral alt tipi.");

        inst.Name = r.Name.Trim();
        inst.InstallationType = r.InstallationType;
        inst.GenerationType = production ? r.GenerationType : null;
        inst.DistributionCompanyId = r.DistributionCompanyId;
        inst.ManualAddress = CustomersController.Clean(r.ManualAddress);
        inst.ManualInstalledPowerKw = r.ManualInstalledPowerKw;
        inst.ManualContractPowerKw = r.ManualContractPowerKw;
        inst.VoltageLevel = CustomersController.Clean(r.VoltageLevel);
        inst.MeterType = CustomersController.Clean(r.MeterType);
        inst.Latitude = r.Latitude;
        inst.Longitude = r.Longitude;
        inst.IsActive = r.IsActive;
        inst.UpdatedAt = DateTime.UtcNow;

        // Üretim bilgisi yalnızca üretim tesisatında tutulur (0/1). Tip tüketime dönerse kayıt korunur ama gösterilmez.
        if (production && psi is not null)
        {
            inst.ProductionSiteInfo ??= new ProductionSiteInfo();
            psi.CopyTo(inst.ProductionSiteInfo);
        }
    }
}
