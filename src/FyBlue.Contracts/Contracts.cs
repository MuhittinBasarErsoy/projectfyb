namespace FyBlue.Contracts;

// ---- Uygulama kimliği (tek kayıt / tek giriş) ----

public sealed record RegisterRequest(string Username, string Email, string Password);

public sealed record AppLoginRequest(string Username, string Password);

public sealed record AuthResponse(string Token, DateTime ExpiresAt, string Username);

public sealed record ProfileResponse(string Username, string? Email, DateTime CreatedAt);

// ---- Dış hesaplar (OSOS / EPİAŞ ayrı ayrı bağlanır) ----

/// <summary>Bir dış hesabın bağlantı durumu. Dış sisteme gitmeden, yalnızca DB'den okunur.</summary>
public sealed record ExternalAccountStatus(bool Linked, string? Username, DateTime? UpdatedAt);

public sealed record EpiasLinkRequest(string Username, string Password);

public sealed record LinkResponse(bool Success, string? Message);

/// <summary>
/// Hata gövdesi. <see cref="Code"/> istemcinin hatayı ayırt etmesi içindir
/// (ör. <c>osos_not_linked</c>, <c>epias_not_linked</c>, <c>epias_auth_failed</c>).
/// </summary>
public sealed record ApiProblem(string Message, string? Code = null);

public static class ApiErrorCodes
{
    public const string OsosNotLinked = "osos_not_linked";
    public const string EpiasNotLinked = "epias_not_linked";
    public const string EpiasAuthFailed = "epias_auth_failed";
}
