using System.Text;
using System.Text.Json;
using Microsoft.JSInterop;

namespace FyBlue.Web.Services;

/// <summary>Uygulama JWT'sini tarayıcının localStorage'ında saklar.</summary>
public sealed class TokenStore(IJSRuntime js)
{
    private const string Key = "fyblue.token";

    public async Task<string?> GetAsync()
    {
        try { return await js.InvokeAsync<string?>("localStorage.getItem", Key); }
        catch (JSException) { return null; }
    }

    public async Task SetAsync(string token)
    {
        try { await js.InvokeVoidAsync("localStorage.setItem", Key, token); }
        catch (JSException) { /* depolama kapalıysa oturum yalnızca bellekte kalır */ }
    }

    public async Task ClearAsync()
    {
        try { await js.InvokeVoidAsync("localStorage.removeItem", Key); }
        catch (JSException) { }
    }
}

/// <summary>
/// Tek uygulama oturumu. OSOS ve EPİAŞ modülleri aynı JWT'yi kullanır;
/// dış hesaplar <see cref="ConnectionsState"/> üzerinden ayrıca bağlanır.
/// </summary>
public sealed class AuthState(TokenStore store)
{
    public string? Token { get; private set; }
    public string? Username { get; private set; }
    public bool IsAuthenticated => Token is not null;

    public event Action? Changed;

    /// <summary>Açılışta saklı jetonu yükler; süresi dolmuşsa temizler.</summary>
    public async Task InitializeAsync()
    {
        var token = await store.GetAsync();
        if (string.IsNullOrWhiteSpace(token)) return;

        var payload = ReadPayload(token);
        if (payload is null || IsExpired(payload.Value))
        {
            await store.ClearAsync();
            return;
        }

        Token = token;
        Username = ReadName(payload.Value);
    }

    public async Task SignInAsync(string token, string username)
    {
        await store.SetAsync(token);
        Token = token;
        Username = username;
        Changed?.Invoke();
    }

    public async Task SignOutAsync()
    {
        if (Token is null) return;
        await store.ClearAsync();
        Token = null;
        Username = null;
        Changed?.Invoke();
    }

    private static JsonElement? ReadPayload(string jwt)
    {
        try
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2) return null;
            var p = parts[1].Replace('-', '+').Replace('_', '/');
            p = p.PadRight(p.Length + (4 - p.Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(p)));
            return doc.RootElement.Clone();
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            return null;
        }
    }

    // 60 sn pay: sınırdaki jetonla istek atıp 401 almak yerine baştan giriş istenir.
    private static bool IsExpired(JsonElement payload) =>
        payload.TryGetProperty("exp", out var exp) && exp.TryGetInt64(out var s)
        && DateTimeOffset.FromUnixTimeSeconds(s) <= DateTimeOffset.UtcNow.AddSeconds(60);

    private static string? ReadName(JsonElement payload)
    {
        foreach (var name in new[] { "unique_name", "name" })
            if (payload.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String)
                return v.GetString();
        return null;
    }
}
