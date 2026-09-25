using Xunit;
using Epias.Core.Catalog;
using Epias.Core.Epias;
using Epias.Core.Formulas;
using Epias.Core.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Epias.Core.Tests;

public sealed class FormulaParserTests
{
    [Fact]
    public void Dort_islem_onceligi_dogru()
    {
        var ast = FormulaParser.Parse("[a.x] + [b.y] * 2");
        var binary = Assert.IsType<BinaryNode>(ast);
        Assert.Equal('+', binary.Op);
        Assert.IsType<BinaryNode>(binary.Right);
    }

    [Fact]
    public void Parantez_onceligi_ezer()
    {
        var ast = FormulaParser.Parse("([a.x] + [b.y]) * 2");
        var binary = Assert.IsType<BinaryNode>(ast);
        Assert.Equal('*', binary.Op);
    }

    [Fact]
    public void Toplama_islevi_kolona_uygulanir()
    {
        var ast = FormulaParser.Parse("SUM([a.x]) / 5");
        var binary = Assert.IsType<BinaryNode>(ast);
        var column = Assert.IsType<ColumnNode>(binary.Left);
        Assert.Equal("SUM", column.Aggregate);
        Assert.Equal("a", column.Table);
        Assert.Equal("x", column.Column);
    }

    [Fact]
    public void Parantezsiz_tablo_nokta_kolon_da_kabul_edilir()
    {
        var ast = FormulaParser.Parse("a.x * 3");
        var binary = Assert.IsType<BinaryNode>(ast);
        Assert.IsType<ColumnNode>(binary.Left);
    }

    [Theory]
    [InlineData("")]
    [InlineData("[a.x] +")]
    [InlineData("[a.x] ** 2")]
    [InlineData("[ax] * 2")]
    [InlineData("BILINMEYEN([a.x])")]
    [InlineData("[a.x] $ 2")]
    [InlineData("SUM([a.x] + [b.y])")]
    public void Gecersiz_ifadeler_reddedilir(string expression) =>
        Assert.Throws<FormulaException>(() => FormulaParser.Parse(expression));

    [Fact]
    public void Kolon_basvurulari_toplanir()
    {
        var ast = FormulaParser.Parse("([a.x] * [b.y]) / ([a.x] + 1)");
        var columns = FormulaParser.CollectColumns(ast).ToList();
        Assert.Equal(3, columns.Count);
        Assert.Equal(2, columns.Select(c => c.Table).Distinct().Count());
    }
}

public sealed class FormulaCompilerTests
{
    private static FormulaCompiler CreateCompiler()
    {
        var catalog = new EndpointCatalog(
            Options.Create(new EpiasOptions
            {
                SwaggerPath = Path.Combine(AppContext.BaseDirectory, "specs", "electricity-swagger.json")
            }),
            new StubHttpClientFactory(),
            NullLogger<EndpointCatalog>.Instance);

        catalog.InitializeAsync().GetAwaiter().GetResult();

        var store = new DynamicTableStore(
            Options.Create(new StorageOptions { ConnectionString = "Server=(local);Database=x;" }),
            NullLogger<DynamicTableStore>.Instance);

        return new FormulaCompiler(catalog, store, new StubSourceProvider());
    }

    private static readonly FormulaCompiler Compiler = CreateCompiler();

    private sealed class StubSourceProvider : IFormulaSourceProvider
    {
        public IReadOnlyList<ExternalFormulaSource> Sources { get; } =
        [
            new ExternalFormulaSource
            {
                Name = "osos_weather",
                Title = "Hava durumu",
                Tag = "OSOS",
                Schema = "dbo",
                Table = "Rows_Weather",
                TimestampColumn = "time",
                HasHour = true,
                Fields = [new ExternalFormulaField("temperature_2m", "Sıcaklık")],
                OwnerColumn = "AppUserId",
                VersionColumn = "SearchHistoryId",
                VersionPartitionColumns = ["Serno"]
            }
        ];

        public Task RefreshAsync(bool force = false, CancellationToken ct = default) => Task.CompletedTask;
    }

    [Fact]
    public void Osos_kaynagi_kullaniciya_gore_suzulur_ve_epias_ile_hizalanir()
    {
        var compiled = Compiler.Compile(
            "[markets_dam_data_mcp.price] * [osos_weather.temperature_2m]", AlignmentMode.DateHour);

        Assert.Contains("[dbo].[Rows_Weather]", compiled.Sql);
        Assert.Contains("@appUserId", compiled.Sql);
        Assert.Contains("[__latest]", compiled.Sql);   // yinelenen sorgulardan yalnızca en sonuncusu
        Assert.Contains("TRY_CAST(TRY_CAST([temperature_2m] AS FLOAT)", compiled.Sql);
        Assert.Contains("LEFT JOIN", compiled.Sql);
        Assert.Equal(["markets_dam_data_mcp", "osos_weather"], compiled.ReferencedTables);
    }

    [Fact]
    public void Osos_kaynaginda_olmayan_alan_anlasilir_hata_verir()
    {
        var ex = Assert.Throws<FormulaException>(() =>
            Compiler.Compile("[osos_weather.olmayan] * 2", AlignmentMode.DateHour));
        Assert.Contains("temperature_2m", ex.Message);
    }

    [Fact]
    public void Ptf_carpi_sabit_sql_uretir()
    {
        var compiled = Compiler.Compile(
            "[markets_dam_data_mcp.price] * 2 / 5", AlignmentMode.DateHour);

        Assert.Contains("[epias].[markets_dam_data_mcp]", compiled.Sql);
        Assert.Contains("NULLIF", compiled.Sql);          // sıfıra bölme koruması
        Assert.Contains("@from", compiled.Sql);
        Assert.Contains("@maxRows", compiled.Sql);
        Assert.Single(compiled.ReferencedTables);
    }

    [Fact]
    public void Iki_tablo_tarih_saat_uzerinden_hizalanir()
    {
        var compiled = Compiler.Compile(
            "[markets_dam_data_mcp.price] * [markets_dam_data_mcp.price_usd]",
            AlignmentMode.DateHour);

        Assert.Contains("axis", compiled.Sql);
        Assert.Contains("LEFT JOIN", compiled.Sql);
        Assert.Equal(2, compiled.ReferencedColumns.Count);
    }

    [Fact]
    public void Ic_ice_with_uretilmez()
    {
        var compiled = Compiler.Compile(
            "[markets_dam_data_mcp.price] / 5", AlignmentMode.DateHour, "ptf_bolu_bes");

        // T-SQL iç içe WITH kabul etmez; INSERT tek bir WITH zinciri olmalı.
        // Ham dize satır sonları kaynak dosyanınkini izler (Windows'ta CRLF olabilir).
        Assert.Equal(1, CountOccurrences(compiled.InsertSql.Replace("\r\n", "\n"), "WITH\n"));
        Assert.Contains("INSERT INTO [formula].[ptf_bolu_bes]", compiled.InsertSql);
        Assert.Contains("HASHBYTES('SHA2_256'", compiled.InsertSql);
        Assert.Contains("NOT EXISTS", compiled.InsertSql);
    }

    [Fact]
    public void Bilinmeyen_tablo_anlasilir_hata_verir()
    {
        var ex = Assert.Throws<FormulaException>(() =>
            Compiler.Compile("[olmayan_tablo.kolon] * 2", AlignmentMode.DateHour));
        Assert.Contains("olmayan_tablo", ex.Message);
    }

    [Fact]
    public void Bilinmeyen_kolon_mevcut_kolonlari_listeler()
    {
        var ex = Assert.Throws<FormulaException>(() =>
            Compiler.Compile("[markets_dam_data_mcp.olmayan] * 2", AlignmentMode.DateHour));
        Assert.Contains("price", ex.Message);
    }

    [Fact]
    public void Sayisal_olmayan_kolon_carpimda_reddedilir()
    {
        var ex = Assert.Throws<FormulaException>(() =>
            Compiler.Compile("[markets_dam_data_mcp.hour] * 2", AlignmentMode.DateHour));
        Assert.Contains("sayısal", ex.Message);
    }

    [Fact]
    public void Hizalamasiz_mod_tek_satir_uretir()
    {
        var compiled = Compiler.Compile(
            "SUM([markets_dam_data_mcp.price])", AlignmentMode.None);

        Assert.DoesNotContain("axis", compiled.Sql);
        Assert.Contains("CAST(NULL AS date)", compiled.Sql);
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var index = 0;
        while ((index = haystack.IndexOf(needle, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += needle.Length;
        }
        return count;
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}

public sealed class SqlIdentifierTests
{
    [Theory]
    [InlineData("priceUsd", "price_usd")]
    [InlineData("date", "date")]
    [InlineData("value", "value_v")]
    [InlineData("contractName", "contract_name")]
    [InlineData("id", "id")]
    [InlineData("2ndValue", "c_2nd_value")]
    public void Kolon_adlari_normalize_edilir(string input, string expected) =>
        Assert.Equal(expected, SqlIdentifier.ToColumn(input));

    [Fact]
    public void Kapanis_parantezi_kacirilir() =>
        Assert.Equal("[a]]b]", SqlIdentifier.Quote("a]b"));

    [Theory]
    [InlineData("tablo; DROP TABLE x--", "tablo_drop_table_x")]
    [InlineData("Formül Çıktısı", "form_l_kt_s")]
    public void Serbest_metin_guvenli_tanimlayiciya_indirgenir(string input, string expected) =>
        Assert.Equal(expected, SqlIdentifier.Sanitize(input));
}

