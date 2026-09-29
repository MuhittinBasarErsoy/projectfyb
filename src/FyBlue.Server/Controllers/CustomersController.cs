using FyBlue.Contracts;
using FyBlue.Server.Data;
using FyBlue.Server.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers;

/// <summary>Müşteriler. Danışman tümünü yönetir; müşteri kullanıcısı yalnızca kendi kaydını görür.</summary>
[ApiController]
[Authorize]
[Route("api/customers")]
public sealed class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CurrentUser _me;

    public CustomersController(AppDbContext db, CurrentUser me)
    {
        _db = db;
        _me = me;
    }

    [HttpGet]
    public async Task<IReadOnlyList<CustomerListItem>> List(string? search, bool includeInactive = false, CancellationToken ct = default)
    {
        var q = _db.Customers.AsNoTracking();
        if (await _me.ScopedCustomerIdAsync(ct) is int own) q = q.Where(c => c.Id == own);
        if (!includeInactive) q = q.Where(c => c.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => c.Title.Contains(s) || c.CustomerCode.Contains(s) || (c.ShortName != null && c.ShortName.Contains(s))
                             || (c.TaxNumber != null && c.TaxNumber.Contains(s)));
        }
        return await q.OrderBy(c => c.Title)
            .Select(c => new CustomerListItem(c.Id, c.CustomerCode, c.Title, c.ShortName, c.TaxNumber, c.Phone, c.IsActive,
                c.Installations.Count(i => i.IsActive), c.OsosConnections.Count(o => o.IsActive), c.UpdatedAt))
            .ToListAsync(ct);
    }

    [HttpGet("{id:int}")]
    public async Task<CustomerDto> Get(int id, CancellationToken ct)
    {
        await _me.EnsureCanAccessCustomerAsync(id, ct);
        var c = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException();
        return c.ToDto();
    }

    [HttpGet("{id:int}/summary")]
    public async Task<CustomerSummaryDto> Summary(int id, CancellationToken ct)
    {
        var customer = await Get(id, ct);
        var inst = await _db.Installations.AsNoTracking().Where(i => i.CustomerId == id && i.IsActive)
            .Select(i => new { i.InstallationType, P = i.ManualInstalledPowerKw ?? i.SourceInstalledPowerKw, C = i.ManualContractPowerKw ?? i.SourceContractPowerKw })
            .ToListAsync(ct);
        var docs = await _db.Documents.AsNoTracking().Where(d => d.CustomerId == id && d.IsActive)
            .Select(d => d.DocumentType!.Code).ToListAsync(ct);
        var conns = await _db.OsosConnections.AsNoTracking().Where(c => c.CustomerId == id && c.IsActive)
            .Select(c => c.LastSyncAt).ToListAsync(ct);
        var subs = await _db.OsosSubscriptions.AsNoTracking()
            .Where(s => s.IsActive && s.OsosConnection!.CustomerId == id).Select(s => s.InstallationId).ToListAsync(ct);

        decimal? Sum(IEnumerable<decimal?> v) => v.Any(x => x is not null) ? v.Sum() : null;
        return new CustomerSummaryDto(customer,
            inst.Count,
            inst.Count(i => i.InstallationType != InstallationTypes.Production),
            inst.Count(i => InstallationTypes.HasProduction(i.InstallationType)),
            Sum(inst.Select(i => i.P)), Sum(inst.Select(i => i.C)),
            docs.Count, docs.Count(c => c == CustomerModuleSeeder.InvoiceDocumentType),
            conns.Count, subs.Count, subs.Count(s => s is null), conns.Max());
    }

    [HttpPost]
    public async Task<CustomerDto> Create(CustomerSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var c = new Customer();
        await ApplyAsync(c, req, ct);
        _db.Customers.Add(c);
        await _db.SaveChangesAsync(ct);
        return c.ToDto();
    }

    [HttpPut("{id:int}")]
    public async Task<CustomerDto> Update(int id, CustomerSaveRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var c = await _db.Customers.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException();
        await ApplyAsync(c, req, ct);
        await _db.SaveChangesAsync(ct);
        return c.ToDto();
    }

    private async Task ApplyAsync(Customer c, CustomerSaveRequest r, CancellationToken ct)
    {
        var code = r.CustomerCode?.Trim() ?? "";
        if (code.Length == 0) throw new ValidationException("Müşteri kodu zorunlu.");
        if (string.IsNullOrWhiteSpace(r.Title)) throw new ValidationException("Ünvan zorunlu.");
        if (await _db.Customers.AnyAsync(x => x.CustomerCode == code && x.Id != c.Id, ct))
            throw new ValidationException($"'{code}' kodlu başka bir müşteri var.");
        c.CustomerCode = code;
        c.Title = r.Title.Trim();
        c.ShortName = Clean(r.ShortName);
        c.TaxNumber = Clean(r.TaxNumber);
        c.TaxOffice = Clean(r.TaxOffice);
        c.AuthorizedPerson = Clean(r.AuthorizedPerson);
        c.Phone = Clean(r.Phone);
        c.Email = Clean(r.Email);
        c.Address = Clean(r.Address);
        c.Notes = Clean(r.Notes);
        c.IsActive = r.IsActive;
        c.UpdatedAt = DateTime.UtcNow;
    }

    internal static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // ---- Tüketim / Üretim / Endeks sekmeleri (canlı OSOS) ----

    [HttpPost("{id:int}/osos/{kind:regex(^(consumption|production|endex)$)}")]
    public async Task<CustomerOsosResult> OsosQuery(int id, string kind, CustomerOsosQuery q,
        [FromServices] CustomerOsosQueryService svc, CancellationToken ct)
    {
        await _me.EnsureCanAccessCustomerAsync(id, ct);
        if (q.EndDate < q.StartDate) throw new ValidationException("Bitiş tarihi başlangıçtan önce olamaz.");
        return await svc.RunAsync(id, kind, q, ct);
    }

    // ---- Müşteri kullanıcıları (danışman) ----

    [HttpGet("{id:int}/users")]
    public async Task<IReadOnlyList<CustomerUserDto>> Users(int id, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        return await _db.Users.AsNoTracking().Where(u => u.CustomerId == id && u.Role == AppRoles.Customer)
            .OrderBy(u => u.UserName).Select(u => new CustomerUserDto(u.Id, u.UserName!, u.Email, u.CreatedAt)).ToListAsync(ct);
    }

    [HttpPost("{id:int}/users")]
    public async Task<CustomerUserDto> CreateUser(int id, CreateCustomerUserRequest req,
        [FromServices] UserManager<AppUser> users, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        if (!await _db.Customers.AnyAsync(c => c.Id == id, ct)) throw new NotFoundException();
        var user = new AppUser { UserName = req.Username?.Trim(), Email = Clean(req.Email), Role = AppRoles.Customer, CustomerId = id };
        var result = await users.CreateAsync(user, req.Password ?? "");
        if (!result.Succeeded) throw new ValidationException(string.Join(" ", result.Errors.Select(e => e.Description)));
        return new CustomerUserDto(user.Id, user.UserName!, user.Email, user.CreatedAt);
    }

    [HttpDelete("{id:int}/users/{userId}")]
    public async Task<IActionResult> DeleteUser(int id, string userId, [FromServices] UserManager<AppUser> users, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.CustomerId == id && u.Role == AppRoles.Customer, ct)
                   ?? throw new NotFoundException();
        await users.DeleteAsync(user);
        return NoContent();
    }
}
