namespace Epias.Core.Security;

/// <summary>
/// EPİAŞ şifresini veritabanında saklarken şifreleyip çözer.
/// Gerçekleştirimi ASP.NET Core Data Protection ile API katmanındadır.
/// </summary>
public interface ICredentialProtector
{
    string Protect(string plaintext);
    string? Unprotect(string ciphertext);
}
