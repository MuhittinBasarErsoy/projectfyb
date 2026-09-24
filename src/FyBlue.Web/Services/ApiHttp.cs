using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FyBlue.Contracts;

namespace FyBlue.Web.Services;

/// <summary>
/// API hatası. <see cref="Code"/> sunucunun verdiği ayırt edici koddur
/// (<see cref="ApiErrorCodes"/>); ör. dış hesap bağlı değilse <c>osos_not_linked</c>.
/// </summary>
public sealed class ApiException(string message, HttpStatusCode? status = null, string? code = null, Exception? inner = null)
    : Exception(message, inner)
{
    public HttpStatusCode? Status { get; } = status;
    public string? Code { get; } = code;

    public bool IsNotLinked => Code is ApiErrorCodes.OsosNotLinked or ApiErrorCodes.EpiasNotLinked;
}

/// <summary>
/// Tüm API çağrılarının geçtiği tek kapı: JWT ekler, hataları <see cref="ApiException"/>'a çevirir.
/// Yalnızca 401 uygulama oturumunu kapatır; dış hesap hataları 409 olarak gelir ve oturuma dokunmaz.
/// </summary>
public sealed class ApiHttp(HttpClient http, AuthState auth)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Uri BaseAddress => http.BaseAddress!;

    public async Task<T?> GetAsync<T>(string url, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Get, url, null, ct);
        await EnsureSuccessAsync(response, ct);
        return await ReadAsync<T>(response, ct);
    }

    public async Task<TOut?> PostAsync<TOut>(string url, object? body, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, url, body, ct);
        await EnsureSuccessAsync(response, ct);
        return await ReadAsync<TOut>(response, ct);
    }

    /// <summary>422/502 gövdesinde de anlamlı sonuç dönen uçlar için (EPİAŞ senkron/formül).</summary>
    public async Task<TOut?> PostAllowingResultErrorsAsync<TOut>(string url, object? body, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, url, body, ct);
        if (response.StatusCode is HttpStatusCode.UnprocessableEntity or HttpStatusCode.BadGateway)
            return await ReadAsync<TOut>(response, ct);
        await EnsureSuccessAsync(response, ct);
        return await ReadAsync<TOut>(response, ct);
    }

    public async Task SendAsync(HttpMethod method, string url, CancellationToken ct = default)
    {
        using var response = await SendAsync(method, url, null, ct);
        await EnsureSuccessAsync(response, ct);
    }

    /// <summary>Dosya indirme (CSV). Dosya adı Content-Disposition'dan okunur.</summary>
    public async Task<(byte[] Bytes, string FileName)> DownloadAsync(string url, string fallbackName, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Get, url, null, ct);
        await EnsureSuccessAsync(response, ct);
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        var cd = response.Content.Headers.ContentDisposition;
        return (bytes, cd?.FileNameStar ?? cd?.FileName?.Trim('"') ?? fallbackName);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, url);
        if (auth.Token is { } token)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null)
            request.Content = JsonContent.Create(body, body.GetType(), options: Json);

        try
        {
            return await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new ApiException("Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.", null, null, ex);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new ApiException("İstek zaman aşımına uğradı. Tarih aralığını daraltmayı deneyin.", null, null, ex);
        }
    }

    private static async Task<T?> ReadAsync<T>(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.StatusCode == HttpStatusCode.NoContent || response.Content.Headers.ContentLength == 0)
            return default;
        return await response.Content.ReadFromJsonAsync<T>(Json, ct);
    }

    private async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;

        var (message, code) = await ReadErrorAsync(response, ct);

        // Oturum düştü → giriş ekranına dönülür (MainLayout, AuthState.Changed'i dinler).
        if (response.StatusCode == HttpStatusCode.Unauthorized && auth.IsAuthenticated)
            await auth.SignOutAsync();

        throw new ApiException(message, response.StatusCode, code);
    }

    private static async Task<(string Message, string? Code)> ReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            if (!string.IsNullOrWhiteSpace(text))
            {
                using var doc = JsonDocument.Parse(text);
                var root = doc.RootElement;
                var code = Str(root, "code");
                var message = Str(root, "message") ?? Str(root, "detail") ?? Str(root, "title");
                if (root.TryGetProperty("errors", out var errors))
                    message ??= FlattenErrors(errors);
                if (!string.IsNullOrWhiteSpace(message)) return (message, code);
            }
        }
        catch (JsonException)
        {
            // Gövde JSON değilse aşağıdaki genel mesaja düşülür.
        }

        return (response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => "Oturum süresi doldu. Lütfen yeniden giriş yapın.",
            HttpStatusCode.Forbidden => "Bu işlem için yetkiniz yok.",
            HttpStatusCode.NotFound => "Kayıt bulunamadı.",
            _ => $"İstek başarısız (HTTP {(int)response.StatusCode})."
        }, null);
    }

    private static string? Str(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static string? FlattenErrors(JsonElement errors)
    {
        var parts = new List<string>();
        if (errors.ValueKind == JsonValueKind.Array)
            parts.AddRange(errors.EnumerateArray().Select(e => e.ToString()));
        else if (errors.ValueKind == JsonValueKind.Object)
            foreach (var p in errors.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.Array)
                    parts.AddRange(p.Value.EnumerateArray().Select(e => e.ToString()));
        return parts.Count > 0 ? string.Join(" ", parts) : null;
    }
}
