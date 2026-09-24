using Epias.Core.Security;
using Microsoft.AspNetCore.DataProtection;

namespace FyBlue.Server.Security;

/// <summary>EPİAŞ şifrelerini Data Protection anahtar zinciriyle şifreler.</summary>
public sealed class DataProtectionCredentialProtector : ICredentialProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionCredentialProtector(IDataProtectionProvider provider) =>
        _protector = provider.CreateProtector("Epias.Credentials.v1");

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string? Unprotect(string ciphertext)
    {
        try
        {
            return _protector.Unprotect(ciphertext);
        }
        catch (System.Security.Cryptography.CryptographicException)
        {
            // Anahtar zinciri değiştiyse saklanan şifre çözülemez; yeniden giriş gerekir.
            return null;
        }
    }
}
