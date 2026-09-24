using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Epias.Core.Epias;

public class EpiasAuthenticationException(string message, Exception? inner = null)
    : Exception(message, inner);

/// <summary>
/// EPİAŞ CAS üzerinden TGT (Ticket Granting Ticket) alır ve kullanıcı başına
/// önbellekler. Her servis çağrısı bu bileti <c>TGT</c> başlığında taşır.
/// </summary>
public sealed class EpiasTicketService(
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache,
    IOptions<EpiasOptions> options,
    ILogger<EpiasTicketService> logger)
{
    public const string HttpClientName = "epias-cas";

    private readonly EpiasOptions _options = options.Value;
    private readonly SemaphoreSlim _lock = new(1, 1);

    /// <summary>Kimlik doğrular ve bileti döner. Hatalı bilgide istisna fırlatır.</summary>
    public async Task<string> AcquireAsync(string username, string password, CancellationToken ct = default)
    {
        var client = httpClientFactory.CreateClient(HttpClientName);
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["username"] = username,
            ["password"] = password
        });

        using var request = new HttpRequestMessage(HttpMethod.Post, _options.TicketUrl) { Content = content };
        request.Headers.Accept.ParseAdd("text/plain");

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new EpiasAuthenticationException("EPİAŞ kimlik sunucusuna ulaşılamadı.", ex);
        }

        using (response)
        {
            var body = (await response.Content.ReadAsStringAsync(ct)).Trim();

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("TGT alınamadı. Durum: {Status}", (int)response.StatusCode);
                throw new EpiasAuthenticationException(
                    response.StatusCode == System.Net.HttpStatusCode.Unauthorized
                        ? "Kullanıcı adı veya şifre hatalı."
                        : $"Kimlik doğrulama başarısız (HTTP {(int)response.StatusCode}).");
            }

            // CAS bileti düz metin olarak döner; bazı kurulumlarda Location başlığında gelir.
            var ticket = ExtractTicket(body)
                         ?? ExtractTicket(response.Headers.Location?.ToString() ?? "")
                         ?? throw new EpiasAuthenticationException("Sunucu geçerli bir TGT dönmedi.");

            return ticket;
        }
    }

    /// <summary>Önbellekli bilet. Süresi dolmuşsa yeniden alınır.</summary>
    public async Task<string> GetOrAcquireAsync(string username, string password, CancellationToken ct = default)
    {
        var cacheKey = "tgt::" + username;
        if (cache.TryGetValue<string>(cacheKey, out var cached) && !string.IsNullOrEmpty(cached))
            return cached;

        await _lock.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue(cacheKey, out cached) && !string.IsNullOrEmpty(cached))
                return cached;

            var ticket = await AcquireAsync(username, password, ct);
            cache.Set(cacheKey, ticket, _options.TicketLifetime);
            return ticket;
        }
        finally
        {
            _lock.Release();
        }
    }

    public void Invalidate(string username) => cache.Remove("tgt::" + username);

    private static string? ExtractTicket(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = raw.Trim();

        var idx = text.LastIndexOf("TGT-", StringComparison.Ordinal);
        if (idx >= 0) return text[idx..].Trim().Trim('"');

        // Beklenmedik ama düz bilet gövdesi de kabul edilir.
        return text.StartsWith('<') || text.Length > 512 ? null : text;
    }
}
