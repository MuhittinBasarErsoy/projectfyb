using FyBlue.Server.Services.Mail;
using Hangfire.Server;
using Microsoft.Extensions.Logging;
using Osos.Core.Weather;

namespace FyBlue.Server.Services;

/// <summary>
/// Hangfire iş metodları. Zamanlanmış/anlık olarak bir kullanıcı adına OSOS sorgusu çalıştırır
/// ve sonucu DB'ye (JSON snapshot + Rows_ tablosu) kaydeder. Argümanlar Hangfire için basit tiptir.
/// </summary>
public sealed class JobRunner
{
    private readonly SearchService _search;
    private readonly OsosSessionService _osos;
    private readonly OpenMeteoClient _meteo;
    private readonly JobResultMailer _mailer;
    private readonly ILogger<JobRunner> _logger;

    public JobRunner(SearchService search, OsosSessionService osos, OpenMeteoClient meteo, JobResultMailer mailer, ILogger<JobRunner> logger)
    {
        _search = search;
        _osos = osos;
        _meteo = meteo;
        _mailer = mailer;
        _logger = logger;
    }

    private static readonly Dictionary<string, string> ScreenLabels = new()
    {
        ["Consumption"] = "Tüketim", ["Endex"] = "Endeks", ["Profiles"] = "Yük profili",
        ["Subscriptions"] = "Tesisatlar", ["Dashboard"] = "Dashboard",
    };

    /// <summary>Mail alıcısı olmadan oluşturulmuş (eski) işler için — Hangfire'da kayıtlı imza korunur.</summary>
    public Task RunQueryAsync(string appUserId, string screen, long serno, int daysBack, int type)
        => RunQueryAsync(appUserId, screen, serno, daysBack, type, null, null);

    /// <summary>
    /// Sorguyu çalıştırır. serno=0 → Otomatik: müşterinin tüm tesisatları; serno>0 → yalnızca o tesisat.
    /// Sorgu sayfasıyla aynı parametre şekli: Serno = müşteri, Selected = tesisat(lar).
    /// daysBack: bitiş = şimdi, başlangıç = şimdi - daysBack gün (zamanlı işlerde kayan aralık).
    /// notifyEmails: sonuç (özet + CSV) bu adreslere mail atılır; hata maili yalnızca ilk denemede gider.
    /// context: Hangfire doldurur (çağrıda null verilir).
    /// </summary>
    public async Task RunQueryAsync(string appUserId, string screen, long serno, int daysBack, int type,
        string? notifyEmails, PerformContext? context)
    {
        var recipients = SmtpMailSender.ParseRecipients(notifyEmails);
        string label = ScreenLabels.GetValueOrDefault(screen, screen);
        var ct = CancellationToken.None;
        var end = DateTime.Now;
        var start = end.AddDays(-Math.Max(0, daysBack));
        try
        {
            long customerSerno = await _osos.GetCustomerSernoAsync(appUserId, ct);
            // Dashboard (GetOwnerConsumptions) tek bir owner Serno'su alır; Selected kullanmaz.
            long mainSerno = screen == "Dashboard" && serno > 0 ? serno : customerSerno;
            long[]? selected = serno > 0 ? [serno] : null;
            var res = await _search.RunScreenAsync(appUserId, screen, mainSerno, start, end, type, selected, ct);
            _logger.LogInformation("Job çalıştı: {Screen} user={User} serno={Serno} satır={Rows} geçmiş#{Id}",
                screen, appUserId, serno, res.RowCount, res.SearchHistoryId);
            await _mailer.SendResultAsync(appUserId, label, res.SearchHistoryId, res.RowCount, start, end, recipients, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Job hatası: {Screen} user={User}", screen, appUserId);
            try
            {
                await _search.SaveFailureAsync(appUserId, screen, new { screen, serno, daysBack, type },
                    serno > 0 ? serno : null, start, end, ex.Message, ct);
            }
            catch (Exception saveEx) { _logger.LogWarning(saveEx, "Job hatası geçmişe yazılamadı"); }
            if ((context?.GetJobParameter<int?>("RetryCount") ?? 0) == 0)
                await _mailer.SendFailureAsync(label, ex.Message, recipients, ct);
            throw; // Hangfire yeniden denesin / dashboard'da görünsün
        }
    }

    /// <summary>Hava durumu (Open-Meteo) işini çalıştırır. daysBack: kayan aralık (bitiş=bugün).</summary>
    public async Task RunWeatherAsync(string appUserId, double lat, double lon, int daysBack, string timezone, double? tilt, double? azimuth)
    {
        var ct = CancellationToken.None;
        try
        {
            var end = DateTime.Now;
            var start = end.AddDays(-Math.Max(0, daysBack));
            var res = await _meteo.FetchHourlyAsync(lat, lon,
                DateOnly.FromDateTime(start), DateOnly.FromDateTime(end),
                string.IsNullOrWhiteSpace(timezone) ? "Europe/Istanbul" : timezone, tilt, azimuth, ct);
            var saved = await _search.SaveExternalResultAsync(appUserId, "Weather", "OpenMeteoHourly",
                new { lat, lon, timezone, tilt, azimuth, daysBack }, res.RowsJson, null, start, end, ct);
            _logger.LogInformation("Weather job: user={User} lat={Lat} lon={Lon} satır={Rows} geçmiş#{Id}",
                appUserId, lat, lon, saved.RowCount, saved.SearchHistoryId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Weather job hatası: user={User}", appUserId);
            throw;
        }
    }
}
