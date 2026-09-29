using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace FyBlue.Server.Services.Mail;

/// <summary>SMTP ayarları (Smtp bölümü / SMTP_* ortam değişkenleri). Host boşsa mail gönderimi kapalıdır.</summary>
public sealed class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    public string From { get; set; } = "";
    public string FromName { get; set; } = "FyBlue";
    /// <summary>Auto: 465 → SSL, diğerleri → STARTTLS (sunucu destekliyorsa). None: şifresiz (ör. yerel test SMTP).</summary>
    public string Security { get; set; } = "Auto";

    public bool Enabled => !string.IsNullOrWhiteSpace(Host);
}

public sealed record MailAttachment(string FileName, byte[] Content, string ContentType);

public interface IMailSender
{
    bool Enabled { get; }
    Task SendAsync(IReadOnlyCollection<string> to, string subject, string htmlBody,
        IReadOnlyCollection<MailAttachment>? attachments, CancellationToken ct);
}

public sealed class SmtpMailSender : IMailSender
{
    private readonly SmtpOptions _opt;

    public SmtpMailSender(SmtpOptions opt) => _opt = opt;

    public bool Enabled => _opt.Enabled;

    public async Task SendAsync(IReadOnlyCollection<string> to, string subject, string htmlBody,
        IReadOnlyCollection<MailAttachment>? attachments, CancellationToken ct)
    {
        if (!Enabled) throw new InvalidOperationException("SMTP ayarlı değil (Smtp:Host boş).");
        if (to.Count == 0) return;

        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(_opt.FromName, string.IsNullOrWhiteSpace(_opt.From) ? _opt.User : _opt.From));
        foreach (var addr in to) msg.To.Add(MailboxAddress.Parse(addr));
        msg.Subject = subject;
        var body = new BodyBuilder { HtmlBody = htmlBody };
        foreach (var a in attachments ?? [])
            body.Attachments.Add(a.FileName, a.Content, ContentType.Parse(a.ContentType));
        msg.Body = body.ToMessageBody();

        var security = _opt.Security.ToLowerInvariant() switch
        {
            "none" => SecureSocketOptions.None,
            "ssl" => SecureSocketOptions.SslOnConnect,
            "starttls" => SecureSocketOptions.StartTls,
            _ => _opt.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable
        };
        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(_opt.Host, _opt.Port, security, ct);
        if (!string.IsNullOrWhiteSpace(_opt.User)) await smtp.AuthenticateAsync(_opt.User, _opt.Password, ct);
        await smtp.SendAsync(msg, ct);
        await smtp.DisconnectAsync(true, ct);
    }

    /// <summary>"a@x.com; b@y.com" → geçerli adresler. Geçersiz adres varsa hata.</summary>
    public static IReadOnlyList<string> ParseRecipients(string? list)
    {
        if (string.IsNullOrWhiteSpace(list)) return [];
        var result = new List<string>();
        foreach (var part in list.Split([',', ';', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (!MailboxAddress.TryParse(part, out var mb) || !mb.Address.Contains('@'))
                throw new FormatException($"Geçersiz e-posta adresi: {part}");
            if (!result.Contains(mb.Address, StringComparer.OrdinalIgnoreCase)) result.Add(mb.Address);
        }
        return result;
    }
}
