namespace Epias.Core.Ingestion;

/// <summary>
/// Çalışan isteğin EPİAŞ biletini sağlar. API katmanında oturum açmış
/// kullanıcının kimliğinden, zamanlanmış işlerde saklanan kimlik bilgisinden üretilir.
/// </summary>
public interface IEpiasTicketAccessor
{
    string? Username { get; }
    Task<string> GetTicketAsync(CancellationToken ct = default);
    void Invalidate();
}
