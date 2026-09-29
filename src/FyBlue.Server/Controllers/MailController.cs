using FyBlue.Contracts;
using FyBlue.Server.Services.Customers;
using FyBlue.Server.Services.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FyBlue.Server.Controllers;

public sealed record MailTestRequest(string To);

/// <summary>SMTP durumu ve test maili (Bağlı Hesaplar sayfası).</summary>
[ApiController]
[Authorize]
[Route("api/mail")]
public sealed class MailController : ControllerBase
{
    private readonly IMailSender _mail;
    private readonly CurrentUser _me;

    public MailController(IMailSender mail, CurrentUser me)
    {
        _mail = mail;
        _me = me;
    }

    [HttpGet("status")]
    public object Status() => new { enabled = _mail.Enabled };

    [HttpPost("test")]
    public async Task<LinkResponse> Test(MailTestRequest req, CancellationToken ct)
    {
        await _me.EnsureConsultantAsync(ct);
        if (!_mail.Enabled) return new LinkResponse(false, "SMTP ayarlı değil (SMTP_HOST boş).");
        IReadOnlyList<string> to;
        try { to = SmtpMailSender.ParseRecipients(req.To); }
        catch (FormatException ex) { return new LinkResponse(false, ex.Message); }
        if (to.Count == 0) return new LinkResponse(false, "Adres girin.");
        try
        {
            await _mail.SendAsync(to, "[FyBlue] Test maili",
                "<p>FyBlue SMTP ayarları çalışıyor. Zamanlanmış iş sonuçları bu adresten gönderilecek.</p>", null, ct);
            return new LinkResponse(true, $"Test maili gönderildi: {string.Join(", ", to)}");
        }
        catch (Exception ex) { return new LinkResponse(false, $"Gönderilemedi: {ex.Message}"); }
    }
}
