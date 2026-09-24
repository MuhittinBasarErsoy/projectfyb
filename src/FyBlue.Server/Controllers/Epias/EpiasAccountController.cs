using System.Security.Claims;
using Epias.Core.Epias;
using Epias.Core.Security;
using FyBlue.Contracts;
using FyBlue.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers.Epias;

/// <summary>
/// Uygulama kullanıcısına EPİAŞ Şeffaflık hesabını bağlar. Kimlik doğrulaması
/// EPİAŞ CAS tarafında yapılır; başarılıysa şifre DataProtection ile saklanır.
/// </summary>
[ApiController]
[Authorize]
[Route("api/epias")]
public sealed class EpiasAccountController(
    EpiasTicketService ticketService,
    ICredentialProtector protector,
    AppDbContext db,
    ILogger<EpiasAccountController> logger) : ControllerBase
{
    private string Uid => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("status")]
    public async Task<ActionResult<ExternalAccountStatus>> Status(CancellationToken ct)
    {
        var cred = await db.EpiasCredentials.AsNoTracking().FirstOrDefaultAsync(c => c.AppUserId == Uid, ct);
        return cred is null
            ? new ExternalAccountStatus(false, null, null)
            : new ExternalAccountStatus(true, cred.EpiasUsername, cred.UpdatedAt);
    }

    [HttpPost("link")]
    public async Task<ActionResult<LinkResponse>> Link(EpiasLinkRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new LinkResponse(false, "Kullanıcı adı ve şifre zorunludur."));

        if (!await db.Users.AnyAsync(u => u.Id == Uid, ct))
            return Unauthorized(new LinkResponse(false, "Oturumunuz geçersiz. Lütfen yeniden giriş yapın."));

        var username = req.Username.Trim();
        try
        {
            // Önbellekteki eski bilet yanlış şifreyi gizlemesin diye doğrudan CAS'a gidilir.
            await ticketService.AcquireAsync(username, req.Password, ct);
        }
        catch (EpiasAuthenticationException ex)
        {
            logger.LogInformation("EPİAŞ bağlama reddedildi: {User}", username);
            return BadRequest(new LinkResponse(false, ex.Message));
        }

        var cred = await db.EpiasCredentials.FirstOrDefaultAsync(c => c.AppUserId == Uid, ct);
        if (cred is null)
        {
            cred = new EpiasCredential { AppUserId = Uid };
            db.EpiasCredentials.Add(cred);
        }
        else if (cred.EpiasUsername != username)
        {
            ticketService.Invalidate(cred.EpiasUsername);
        }

        cred.EpiasUsername = username;
        cred.ProtectedPassword = protector.Protect(req.Password);
        cred.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        ticketService.Invalidate(username);

        return new LinkResponse(true, $"EPİAŞ hesabı bağlandı ({username}).");
    }

    [HttpDelete("link")]
    public async Task<IActionResult> Unlink(CancellationToken ct)
    {
        var cred = await db.EpiasCredentials.FirstOrDefaultAsync(c => c.AppUserId == Uid, ct);
        if (cred is not null)
        {
            ticketService.Invalidate(cred.EpiasUsername);
            db.EpiasCredentials.Remove(cred);
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }
}
