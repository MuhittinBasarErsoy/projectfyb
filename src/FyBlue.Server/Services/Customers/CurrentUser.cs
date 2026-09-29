using System.Security.Claims;
using FyBlue.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Services.Customers;

/// <summary>İşlem yetkisi yok → 403.</summary>
public sealed class ForbiddenException(string message = "Bu işlem için yetkiniz yok.") : Exception(message);

/// <summary>Kayıt yok (veya kullanıcının kapsamı dışında) → 404.</summary>
public sealed class NotFoundException(string message = "Kayıt bulunamadı.") : Exception(message);

/// <summary>Geçersiz istek (iş kuralı ihlali) → 400.</summary>
public sealed class ValidationException(string message) : Exception(message);

/// <summary>
/// İsteği yapan kullanıcının rolü ve müşteri kapsamı. Rol DB'den okunur (eski token'larda rol claim'i yok;
/// rol değişikliği yeniden giriş gerektirmesin). Danışman tüm müşterileri, müşteri kullanıcısı yalnızca kendisini görür.
/// </summary>
public sealed class CurrentUser
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    private (string role, int? customerId)? _loaded;

    public CurrentUser(AppDbContext db, IHttpContextAccessor http)
    {
        _db = db;
        _http = http;
    }

    public string Id => _http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? throw new ForbiddenException("Oturum geçersiz.");

    private async Task<(string role, int? customerId)> LoadAsync(CancellationToken ct)
    {
        if (_loaded is { } l) return l;
        var id = Id;
        var u = await _db.Users.AsNoTracking().Where(x => x.Id == id)
            .Select(x => new { x.Role, x.CustomerId }).FirstOrDefaultAsync(ct)
            ?? throw new ForbiddenException("Oturum geçersiz.");
        _loaded = (u.Role, u.CustomerId);
        return _loaded.Value;
    }

    public async Task<bool> IsConsultantAsync(CancellationToken ct) => (await LoadAsync(ct)).role == AppRoles.Consultant;

    /// <summary>Müşteri kullanıcısının müşteri Id'si; danışman için null.</summary>
    public async Task<int?> ScopedCustomerIdAsync(CancellationToken ct)
    {
        var (role, customerId) = await LoadAsync(ct);
        if (role == AppRoles.Consultant) return null;
        return customerId ?? throw new ForbiddenException("Kullanıcınız bir müşteriye bağlı değil.");
    }

    public async Task EnsureConsultantAsync(CancellationToken ct)
    {
        if (!await IsConsultantAsync(ct)) throw new ForbiddenException();
    }

    /// <summary>Müşteri kullanıcısı başka müşterinin verisine erişemez (varlığı da sızdırılmaz → 404).</summary>
    public async Task EnsureCanAccessCustomerAsync(int customerId, CancellationToken ct)
    {
        var scoped = await ScopedCustomerIdAsync(ct);
        if (scoped is not null && scoped != customerId) throw new NotFoundException();
    }
}
