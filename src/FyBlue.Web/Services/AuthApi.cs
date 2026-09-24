using FyBlue.Contracts;
using Osos.Contracts;

namespace FyBlue.Web.Services;

/// <summary>Tek kayıt / tek giriş.</summary>
public sealed class AuthApi(ApiHttp api, AuthState auth)
{
    public async Task LoginAsync(string username, string password)
    {
        var res = await api.PostAsync<AuthResponse>("api/auth/login", new AppLoginRequest(username, password))
                  ?? throw new ApiException("Sunucudan boş yanıt geldi.");
        await auth.SignInAsync(res.Token, res.Username);
    }

    public async Task RegisterAsync(string username, string email, string password)
    {
        var res = await api.PostAsync<AuthResponse>("api/auth/register", new RegisterRequest(username, email, password))
                  ?? throw new ApiException("Sunucudan boş yanıt geldi.");
        await auth.SignInAsync(res.Token, res.Username);
    }

    public Task<ProfileResponse?> GetProfileAsync() => api.GetAsync<ProfileResponse>("api/auth/me");
}

public enum ExternalSystem { Osos, Epias }

/// <summary>
/// OSOS ve EPİAŞ hesap bağlantılarının durumu. Uygulama girişinden bağımsızdır:
/// her dış sistem kendi kullanıcı adı/şifresiyle ayrı ayrı bağlanır.
/// </summary>
public sealed class ConnectionsState(ApiHttp api, AuthState auth)
{
    public ExternalAccountStatus? Osos { get; private set; }
    public ExternalAccountStatus? Epias { get; private set; }
    public bool Loaded => Osos is not null && Epias is not null;

    public event Action? Changed;

    public ExternalAccountStatus? Get(ExternalSystem system) => system == ExternalSystem.Osos ? Osos : Epias;

    public async Task EnsureLoadedAsync()
    {
        if (!Loaded) await RefreshAsync();
    }

    public async Task RefreshAsync()
    {
        if (!auth.IsAuthenticated) return;
        var osos = api.GetAsync<ExternalAccountStatus>("api/osos/status");
        var epias = api.GetAsync<ExternalAccountStatus>("api/epias/status");
        Osos = await osos;
        Epias = await epias;
        Changed?.Invoke();
    }

    public async Task<LinkResponse> LinkOsosAsync(string username, string password)
    {
        var res = await LinkAsync<OsosLinkResponse>("api/osos/link", new OsosLinkRequest(username, password));
        return new LinkResponse(res.Success, res.Message);
    }

    public Task<LinkResponse> LinkEpiasAsync(string username, string password) =>
        LinkAsync<LinkResponse>("api/epias/link", new EpiasLinkRequest(username, password));

    public async Task UnlinkAsync(ExternalSystem system)
    {
        await api.SendAsync(HttpMethod.Delete, system == ExternalSystem.Osos ? "api/osos/link" : "api/epias/link");
        await RefreshAsync();
    }

    /// <summary>Oturum kapanınca önbellek temizlenir (sonraki kullanıcıya sızmasın).</summary>
    public void Reset()
    {
        Osos = null;
        Epias = null;
    }

    private async Task<T> LinkAsync<T>(string url, object body)
    {
        var res = await api.PostAsync<T>(url, body) ?? throw new ApiException("Sunucudan boş yanıt geldi.");
        await RefreshAsync();
        return res;
    }
}
