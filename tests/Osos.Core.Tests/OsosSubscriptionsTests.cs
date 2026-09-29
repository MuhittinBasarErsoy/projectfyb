using System.Text.Json;
using Osos.Core.Osos;
using Xunit;

namespace Osos.Core.Tests;

public class OsosSubscriptionsTests
{
    [Fact]
    public void ExtractSernos_FindsNestedArray_AndSkipsOwnerSernos()
    {
        const string json = """
            { "Result": { "Messages": [], "Data": [
                { "CustomerSerno": 111, "Serno": 596743, "Title": "ÇİLEK MOBİLYA", "IdentifierValue": "4001234" },
                { "OwnerSerno": 111, "SubscriptionSerno": "596741", "Title": "ÇİLEK MOBİLYA" },
                { "Serno": 596743 },
                { "Title": "Serno'suz" }
            ] } }
            """;
        Assert.Equal([596743L, 596741L], OsosSubscriptions.ExtractSernos(json));
    }

    [Fact]
    public void ExtractSerno_FallsBackToOtherSernoKeys_ButNotCustomerSerno()
    {
        using var doc = JsonDocument.Parse("""{ "CustomerSerno": 1, "TesisatSerno": 42 }""");
        Assert.Equal(42, OsosSubscriptions.ExtractSerno(doc.RootElement));
    }

    [Fact]
    public void ExtractSernos_NoObjectArray_ReturnsEmpty()
    {
        Assert.Empty(OsosSubscriptions.ExtractSernos("""{ "Data": [] }"""));
    }
}
