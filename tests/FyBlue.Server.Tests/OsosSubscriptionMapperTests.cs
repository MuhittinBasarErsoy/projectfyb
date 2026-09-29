using System.Text.Json;
using FyBlue.Server.Data;
using FyBlue.Server.Services.Customers;

namespace FyBlue.Server.Tests;

public class OsosSubscriptionMapperTests
{
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement.Clone();

    [Fact]
    public void Apply_MapsPascalCaseAndAliases_AndKeepsRawJson()
    {
        var src = Json("""
            { "Serno": 596743, "IdentifierValue": "4001234", "Title": "ÇİLEK MOBİLYA", "Adres": "Bursa",
              "InstalledPower": "125,5", "ContractPowerKw": 100, "Carpan": 40,
              "LastIndexDate": 20260928143000, "EtsoCode": "40Z0000123", "Unknown": "x" }
            """);
        var sub = new OsosSubscription();
        OsosSubscriptionMapper.Apply(src, sub);

        Assert.Equal("4001234", sub.IdentifierValue);
        Assert.Equal("ÇİLEK MOBİLYA", sub.SourceTitle);
        Assert.Equal("Bursa", sub.SourceAddress);
        Assert.Equal(125.5m, sub.InstalledPowerKw);
        Assert.Equal(100m, sub.ContractPowerKw);
        Assert.Equal(40m, sub.Multiplier);
        Assert.Equal(new DateTime(2026, 9, 28, 14, 30, 0), sub.LastIndexAt);
        Assert.Equal("40Z0000123", sub.EtsoCode);
        Assert.Contains("\"Unknown\"", sub.CustomerFieldsJson);
    }

    [Fact]
    public void ApplySourceToInstallation_UpdatesSourceOnly_NeverManual()
    {
        var inst = new Installation
        {
            SourceAddress = "eski", ManualAddress = "danışman adresi",
            SourceInstalledPowerKw = 10, ManualInstalledPowerKw = 12,
            SourceContractPowerKw = 8, ManualContractPowerKw = 9,
        };
        var sub = new OsosSubscription { SubscriptionSerno = 1, SourceAddress = "OSOS adresi", InstalledPowerKw = 50, ContractPowerKw = 40 };

        OsosSubscriptionMapper.ApplySourceToInstallation(inst, [sub]);

        Assert.Equal("OSOS adresi", inst.SourceAddress);
        Assert.Equal(50m, inst.SourceInstalledPowerKw);
        Assert.Equal(40m, inst.SourceContractPowerKw);
        Assert.Equal("danışman adresi", inst.ManualAddress);
        Assert.Equal(12m, inst.ManualInstalledPowerKw);
        Assert.Equal(9m, inst.ManualContractPowerKw);
    }

    [Fact]
    public void ApplySourceToInstallation_MissingOsosValue_KeepsPreviousSource()
    {
        var inst = new Installation { SourceInstalledPowerKw = 10 };
        OsosSubscriptionMapper.ApplySourceToInstallation(inst, [new OsosSubscription { SubscriptionSerno = 1 }]);
        Assert.Equal(10m, inst.SourceInstalledPowerKw);
    }

    [Fact]
    public void SnakeCase_MatchesDocumentColumnNames()
    {
        Assert.Equal("source_installed_power_kw", AppDbContextNames("SourceInstalledPowerKw"));
        Assert.Equal("dc_power_kwp", AppDbContextNames("DcPowerKwp"));
        Assert.Equal("customer_fields_json", AppDbContextNames("CustomerFieldsJson"));
    }

    private static string AppDbContextNames(string n) =>
        (string)typeof(AppDbContext).GetMethod("ToSnakeCase", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic)!
            .Invoke(null, [n])!;
}
