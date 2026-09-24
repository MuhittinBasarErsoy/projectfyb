using System.Security.Claims;
using Epias.Core.Epias;
using Epias.Core.Ingestion;
using Epias.Core.Security;
using FyBlue.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Security;

/// <summary>Kullanıcı EPİAŞ hesabını henüz bağlamadı. API bunu 409 <c>epias_not_linked</c> olarak döner.</summary>
public sealed class EpiasNotLinkedException()
    : EpiasAuthenticationException("EPİAŞ hesabı bağlı değil. Bağlı Hesaplar sayfasından bağlayın.");

/// <summary>
/// İstek başına EPİAŞ biletini üretir: uygulama kullanıcısının (JWT <c>sub</c>)
/// bağladığı EPİAŞ hesabının korumalı şifresinden CAS bileti alınır/önbellekten okunur.
/// </summary>
public sealed class HttpTicketAccessor(
    IHttpContextAccessor httpContextAccessor,
    EpiasTicketService ticketService,
    ICredentialProtector protector,
    TicketContext ticketContext,
    AppDbContext db) : IEpiasTicketAccessor
{
    private string? _epiasUsername;

    /// <summary>Uygulama kullanıcı adı (koşu kayıtlarında <c>TriggeredBy</c> olarak görünür).</summary>
    public string? Username =>
        ticketContext.Username ?? httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Name);

    public async Task<string> GetTicketAsync(CancellationToken ct = default)
    {
        // Toplu senkronizasyon kapsamlarında bilet önceden çözülmüş olur.
        if (ticketContext is { HasTicket: true, Ticket: { } preResolved }) return preResolved;

        var userId = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? throw new EpiasAuthenticationException("Oturum bulunamadı.");

        var cred = await db.EpiasCredentials.AsNoTracking().FirstOrDefaultAsync(c => c.AppUserId == userId, ct)
                   ?? throw new EpiasNotLinkedException();

        var password = protector.Unprotect(cred.ProtectedPassword)
                       ?? throw new EpiasAuthenticationException(
                           "Saklanan EPİAŞ şifresi çözülemedi. Hesabı yeniden bağlayın.");

        _epiasUsername = cred.EpiasUsername;
        return await ticketService.GetOrAcquireAsync(cred.EpiasUsername, password, ct);
    }

    public void Invalidate()
    {
        if (_epiasUsername is { } u) ticketService.Invalidate(u);
    }
}
