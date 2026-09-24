namespace Epias.Core.Ingestion;

/// <summary>
/// Kapsam (scope) başına önceden çözülmüş EPİAŞ bileti. Toplu senkronizasyonda
/// her iş kendi DI kapsamında koşar; HTTP bağlamı taşımak yerine bilet buradan verilir.
/// </summary>
public sealed class TicketContext
{
    public string? Username { get; private set; }
    public string? Ticket { get; private set; }

    public bool HasTicket => !string.IsNullOrEmpty(Ticket);

    public void Set(string username, string ticket)
    {
        Username = username;
        Ticket = ticket;
    }

    public void Clear()
    {
        Username = null;
        Ticket = null;
    }
}
