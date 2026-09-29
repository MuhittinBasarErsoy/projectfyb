using System.Net;
using System.Text;
using System.Text.Json;
using Osos.Core.Osos;

namespace FyBlue.Server.Services.Mail;

/// <summary>Zamanlanmış iş sonucunu (özet tablo + CSV eki) veya hatasını e-postayla gönderir.</summary>
public sealed class JobResultMailer
{
    private const int PreviewRows = 20;
    private const int PreviewColumns = 8;

    private readonly IMailSender _mail;
    private readonly SearchService _search;
    private readonly ILogger<JobResultMailer> _logger;

    public JobResultMailer(IMailSender mail, SearchService search, ILogger<JobResultMailer> logger)
    {
        _mail = mail;
        _search = search;
        _logger = logger;
    }

    public async Task SendResultAsync(string appUserId, string screenLabel, long searchHistoryId, int rowCount,
        DateTime start, DateTime end, IReadOnlyList<string> to, CancellationToken ct)
    {
        if (!Ready(to)) return;
        var snapshot = await _search.GetSnapshotAsync(appUserId, searchHistoryId, ct);
        var csv = await _search.ExportCsvAsync(appUserId, searchHistoryId, ct);

        var html = new StringBuilder();
        html.Append($"<p><b>{Enc(screenLabel)}</b> sorgusu çalıştı: <b>{rowCount}</b> satır ")
            .Append($"({start:dd.MM.yyyy HH:mm} – {end:dd.MM.yyyy HH:mm}).</p>");
        if (snapshot is not null) html.Append(PreviewTable(snapshot.ResultJson, rowCount));
        html.Append("<p style=\"color:#666;font-size:12px\">Tüm sonuç ekteki CSV dosyasındadır. Geçmiş sayfasında da görüntülenebilir.</p>");

        var attachments = csv is { } c ? new[] { new MailAttachment(c.fileName, c.bytes, "text/csv") } : null;
        await SendSafeAsync(to, $"[FyBlue] {screenLabel} – {rowCount} satır", html.ToString(), attachments, ct);
    }

    public Task SendFailureAsync(string screenLabel, string error, IReadOnlyList<string> to, CancellationToken ct)
    {
        if (!Ready(to)) return Task.CompletedTask;
        var html = $"<p><b>{Enc(screenLabel)}</b> zamanlanmış işi <b style=\"color:#c00\">başarısız</b> oldu.</p>" +
                   $"<pre style=\"white-space:pre-wrap\">{Enc(error)}</pre>" +
                   "<p style=\"color:#666;font-size:12px\">İş otomatik olarak yeniden denenecek; ayrıntı için Hangfire panelini inceleyin.</p>";
        return SendSafeAsync(to, $"[FyBlue] {screenLabel} – HATA", html, null, ct);
    }

    private bool Ready(IReadOnlyList<string> to)
    {
        if (to.Count == 0) return false;
        if (_mail.Enabled) return true;
        _logger.LogWarning("İş sonucu mail adresi verilmiş ama SMTP ayarlı değil; mail gönderilmedi.");
        return false;
    }

    // Mail hatası işi başarısız saymaz (sonuç zaten Geçmiş'e kaydedildi).
    private async Task SendSafeAsync(IReadOnlyList<string> to, string subject, string html,
        IReadOnlyCollection<MailAttachment>? attachments, CancellationToken ct)
    {
        try { await _mail.SendAsync(to, subject, html, attachments, ct); }
        catch (Exception ex) { _logger.LogError(ex, "İş sonucu maili gönderilemedi: {Subject}", subject); }
    }

    private static string PreviewTable(string json, int rowCount)
    {
        using var doc = JsonDocument.Parse(json);
        if (OsosSubscriptions.FindFirstObjectArray(doc.RootElement) is not { } arr) return "";
        var rows = arr.EnumerateArray().Where(r => r.ValueKind == JsonValueKind.Object).Take(PreviewRows).ToList();
        if (rows.Count == 0) return "";
        var cols = rows.SelectMany(r => r.EnumerateObject().Select(p => p.Name)).Distinct().Take(PreviewColumns).ToList();

        const string cell = "border:1px solid #ddd;padding:4px 8px;font-size:12px";
        var sb = new StringBuilder("<table style=\"border-collapse:collapse\"><tr>");
        foreach (var c in cols) sb.Append($"<th style=\"{cell};background:#f5f5f5;text-align:left\">{Enc(c)}</th>");
        sb.Append("</tr>");
        foreach (var r in rows)
        {
            sb.Append("<tr>");
            foreach (var c in cols)
                sb.Append($"<td style=\"{cell}\">{Enc(r.TryGetProperty(c, out var v) ? SearchService.CellValue(v) : "")}</td>");
            sb.Append("</tr>");
        }
        sb.Append("</table>");
        if (rowCount > rows.Count) sb.Append($"<p style=\"font-size:12px\">İlk {rows.Count} satır gösteriliyor.</p>");
        return sb.ToString();
    }

    private static string Enc(string s) => WebUtility.HtmlEncode(s);
}
