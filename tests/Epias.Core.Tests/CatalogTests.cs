using Xunit;
using Epias.Core.Catalog;

namespace Epias.Core.Tests;

public sealed class CatalogTests
{
    internal static IReadOnlyList<EndpointDescriptor> Catalog { get; } =
        SwaggerCatalogLoader.LoadFromFile(
            Path.Combine(AppContext.BaseDirectory, "specs", "electricity-swagger.json"));

    [Fact]
    public void Spec_tum_operasyonlari_uretir()
    {
        Assert.True(Catalog.Count >= 290, $"Beklenenden az operasyon: {Catalog.Count}");
        Assert.All(Catalog, e => Assert.False(string.IsNullOrWhiteSpace(e.Key)));
    }

    [Fact]
    public void Anahtarlar_ve_tablo_adlari_benzersiz()
    {
        var duplicateKeys = Catalog.GroupBy(e => e.Key, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        Assert.Empty(duplicateKeys);

        var duplicateTables = Catalog.Where(e => !e.IsExport)
            .GroupBy(e => e.TableName, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        Assert.Empty(duplicateTables);
    }

    [Fact]
    public void Tablo_adlari_ve_kolonlar_sql_icin_gecerli()
    {
        foreach (var ep in Catalog.Where(e => !e.IsExport))
        {
            Assert.Matches("^[a-z][a-z0-9_]*$", ep.TableName);
            Assert.True(ep.TableName.Length <= 128);

            foreach (var f in ep.Fields)
            {
                Assert.Matches("^[a-z][a-z0-9_]*$", f.ColumnName);
                Assert.False(string.IsNullOrWhiteSpace(f.SqlType));
            }

            // Aynı tabloda kolon adı çakışması olmamalı.
            Assert.Equal(
                ep.Fields.Count,
                ep.Fields.Select(f => f.ColumnName).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        }
    }

    [Fact]
    public void Veri_servislerinin_buyuk_cogunlugu_kolon_uretir()
    {
        var data = Catalog.Where(e => !e.IsExport).ToList();
        var withFields = data.Count(e => e.Fields.Count > 0);
        Assert.True(withFields >= data.Count * 0.9,
            $"Kolon üretemeyen servis çok fazla: {data.Count - withFields}/{data.Count}");
    }

    [Fact]
    public void Ptf_servisi_beklenen_sekilde_cozulur()
    {
        var ptf = Catalog.Single(e => e.Path == "/v1/markets/dam/data/mcp");

        Assert.Equal("markets_dam_data_mcp", ptf.Key);
        Assert.Equal("POST", ptf.Method);
        Assert.True(ptf.SupportsDateRange);
        Assert.True(ptf.SupportsPaging);

        Assert.Contains(ptf.Fields, f => f.ColumnName == "price" && f.SqlType == "DECIMAL(28,8)");
        Assert.Contains(ptf.Fields, f => f.ColumnName == "price_usd");
        Assert.NotNull(ptf.DateField);
        Assert.NotNull(ptf.HourField);

        // page parametresi kullanıcıdan istenmez, altyapı ekler.
        Assert.DoesNotContain(ptf.Parameters, p => p.Name == "page");
        Assert.Contains(ptf.Parameters, p => p.Name == "startDate" && p.Required);
    }

    [Fact]
    public void Export_servisleri_tablo_uretmez()
    {
        var exports = Catalog.Where(e => e.IsExport).ToList();
        Assert.NotEmpty(exports);
        Assert.All(exports, e => Assert.Empty(e.Fields));
    }
}

