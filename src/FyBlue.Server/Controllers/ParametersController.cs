using FyBlue.Contracts;
using FyBlue.Server.Data;
using FyBlue.Server.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers;

/// <summary>
/// Parametre yönetimi (belge tipleri, dağıtım şirketleri, markalar). Okuma tüm kullanıcılara açık (seçim listeleri);
/// ekleme/düzenleme/pasife alma danışmanda. Sistem kayıtlarının kodu değiştirilemez ve pasife alınamaz.
/// </summary>
[ApiController]
[Authorize]
[Route("api/parameters")]
public sealed class ParametersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _me;

    public ParametersController(AppDbContext db, CurrentUser me)
    {
        _db = db;
        _me = me;
    }

    [HttpGet]
    public async Task<IReadOnlyList<ParameterGroupDto>> List(bool includeInactive = false, CancellationToken ct = default)
    {
        var groups = await _db.ParameterGroups.AsNoTracking().Where(g => includeInactive || g.IsActive).OrderBy(g => g.Name).ToListAsync(ct);
        var values = await _db.ParameterValues.AsNoTracking().Where(v => includeInactive || v.IsActive)
            .OrderBy(v => v.SortOrder).ThenBy(v => v.Name).Select(CustomerMappings.ValueDto).ToListAsync(ct);
        return groups.Select(g => new ParameterGroupDto(g.Id, g.Code, g.Name, g.IsSystem, g.IsActive,
            values.Where(v => v.ParameterGroupId == g.Id).ToList())).ToList();
    }

    [HttpPost("groups")]
    public async Task<ParameterGroupDto> CreateGroup(ParameterGroupSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var g = new ParameterGroup();
        await ApplyGroupAsync(g, req, ct);
        _db.ParameterGroups.Add(g);
        await _db.SaveChangesAsync(ct);
        return new ParameterGroupDto(g.Id, g.Code, g.Name, g.IsSystem, g.IsActive, []);
    }

    [HttpPut("groups/{id:int}")]
    public async Task<IActionResult> UpdateGroup(int id, ParameterGroupSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var g = await _db.ParameterGroups.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException();
        await ApplyGroupAsync(g, req, ct);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task ApplyGroupAsync(ParameterGroup g, ParameterGroupSaveRequest r, CancellationToken ct)
    {
        var code = NormalizeCode(r.Code);
        if (string.IsNullOrWhiteSpace(r.Name)) throw new ValidationException("Ad zorunlu.");
        if (g.IsSystem && (code != g.Code || !r.IsActive)) throw new ValidationException("Sistem grubunun kodu değiştirilemez, pasife alınamaz.");
        if (await _db.ParameterGroups.AnyAsync(x => x.Code == code && x.Id != g.Id, ct)) throw new ValidationException($"'{code}' kodlu grup var.");
        g.Code = code;
        g.Name = r.Name.Trim();
        g.IsActive = r.IsActive;
        g.UpdatedAt = DateTime.UtcNow;
    }

    [HttpPost("groups/{groupId:int}/values")]
    public async Task<ParameterValueDto> CreateValue(int groupId, ParameterValueSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        if (!await _db.ParameterGroups.AnyAsync(g => g.Id == groupId, ct)) throw new NotFoundException();
        var v = new ParameterValue { ParameterGroupId = groupId };
        await ApplyValueAsync(v, req, ct);
        _db.ParameterValues.Add(v);
        await _db.SaveChangesAsync(ct);
        return new ParameterValueDto(v.Id, v.ParameterGroupId, v.Code, v.Name, v.Description, v.SortOrder, v.IsSystem, v.IsActive);
    }

    [HttpPut("values/{id:int}")]
    public async Task<ParameterValueDto> UpdateValue(int id, ParameterValueSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var v = await _db.ParameterValues.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException();
        await ApplyValueAsync(v, req, ct);
        await _db.SaveChangesAsync(ct);
        return new ParameterValueDto(v.Id, v.ParameterGroupId, v.Code, v.Name, v.Description, v.SortOrder, v.IsSystem, v.IsActive);
    }

    private async Task ApplyValueAsync(ParameterValue v, ParameterValueSaveRequest r, CancellationToken ct)
    {
        var code = NormalizeCode(r.Code);
        if (string.IsNullOrWhiteSpace(r.Name)) throw new ValidationException("Ad zorunlu.");
        if (v.IsSystem && (code != v.Code || !r.IsActive)) throw new ValidationException("Sistem kaydının kodu değiştirilemez, pasife alınamaz.");
        if (await _db.ParameterValues.AnyAsync(x => x.ParameterGroupId == v.ParameterGroupId && x.Code == code && x.Id != v.Id, ct))
            throw new ValidationException($"Bu grupta '{code}' kodlu değer var.");
        v.Code = code;
        v.Name = r.Name.Trim();
        v.Description = CustomersController.Clean(r.Description);
        v.SortOrder = r.SortOrder;
        v.IsActive = r.IsActive;
        v.UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeCode(string? code)
    {
        var c = (code ?? "").Trim().ToUpperInvariant().Replace(' ', '_');
        if (c.Length == 0) throw new ValidationException("Kod zorunlu.");
        if (c.Length > 50) throw new ValidationException("Kod en fazla 50 karakter.");
        return c;
    }
}
