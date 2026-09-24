namespace Osos.Contracts;

/// <summary>Uygulama kullanıcısına OSOS hesabını bağlar / doğrular.</summary>
public sealed record OsosLinkRequest(string OsosUserCode, string OsosPassword, bool RememberMe = true);

public sealed record OsosLinkResponse(bool Success, string? Message);
