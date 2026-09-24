using System.Text.Json;
using Epias.Core.Catalog;
using Epias.Core.Epias;
using Epias.Core.Formulas;
using Epias.Core.Storage;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Epias.Core.Tests;

/// <summary>
/// Gerçek bir MSSQL örneğine karşı çalışır. Varsayılan olarak LocalDB kullanılır;
/// <c>EPIAS_TEST_SQL</c> ortam değişkeniyle başka bir sunucu verilebilir.
/// SQL Server yoksa testler atlanır (CI'da kırmızıya düşmesin).
/// </summary>
[Collection("sql")]
public sealed class StorageIntegrationTests : IAsyncLifetime
{
    private const string DatabaseName = "EpiasSyncTests";

    private static string? _skipReason;
    private DynamicTableStore _store = default!;
    private EndpointDescriptor _endpoint = default!;

    private static string MasterConnectionString =>
        Environment.GetEnvironmentVariable("EPIAS_TEST_SQL")
        ?? @"Server=(localdb)\MSSQLLocalDB;Database=master;Integrated Security=true;TrustServerCertificate=True";

    private static string TestConnectionString =>
        MasterConnectionString.Replace("Database=master", $"Database={DatabaseName}");

    public async ValueTask InitializeAsync()
    {
        try
        {
            await using var conn = new SqlConnection(MasterConnectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(
                $"IF DB_ID('{DatabaseName}') IS NULL CREATE DATABASE [{DatabaseName}];", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (SqlException ex)
        {
            _skipReason = "SQL Server bulunamadı: " + ex.Message;
            return;
        }
        catch (PlatformNotSupportedException ex)
        {
            _skipReason = "LocalDB bu platformda yok: " + ex.Message;
            return;
        }

        _store = new DynamicTableStore(
            Options.Create(new StorageOptions
            {
                ConnectionString = TestConnectionString,
                DataSchema = "epias",
                FormulaSchema = "formula"
            }),
            NullLogger<DynamicTableStore>.Instance);

        await _store.EnsureSchemasAsync();

        _endpoint = CatalogTests.Catalog.Single(e => e.Path == "/v1/markets/dam/data/mcp");
        await DropTableAsync(_endpoint.TableName);
        await _store.EnsureTableAsync(_endpoint);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    private async Task DropTableAsync(string table)
    {
        await using var conn = new SqlConnection(TestConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand($"DROP TABLE IF EXISTS [epias].[{table}];", conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static List<JsonElement> Items(params string[] json) =>
        json.Select(j => JsonDocument.Parse(j).RootElement.Clone()).ToList();

    private static readonly Dictionary<string, object?> NoScope = new();

    [Fact]
    public async Task Ayni_kayit_ikinci_kez_yazilmaz()
    {
        Assert.SkipWhen(_skipReason is not null, _skipReason ?? "");

        var rows = Items(
            """{"date":"2025-01-01T00:00:00+03:00","hour":"00:00","price":1000.5,"priceUsd":30.1,"priceEur":28.2}""",
            """{"date":"2025-01-01T01:00:00+03:00","hour":"01:00","price":990.25,"priceUsd":29.8,"priceEur":27.9}""");

        var first = await _store.WriteItemsAsync(_endpoint, rows, NoScope);
        Assert.Equal(2, first.Fetched);
        Assert.Equal(2, first.Inserted);
        Assert.Equal(0, first.Duplicates);

        // Birebir aynı yanıt tekrar gelirse hiçbir satır eklenmemeli.
        var second = await _store.WriteItemsAsync(_endpoint, rows, NoScope);
        Assert.Equal(0, second.Inserted);
        Assert.Equal(2, second.Duplicates);

        Assert.Equal(2, await _store.GetRowCountAsync(_endpoint.TableName));
    }

    [Fact]
    public async Task Degisen_deger_yeni_satir_olarak_eklenir()
    {
        Assert.SkipWhen(_skipReason is not null, _skipReason ?? "");

        await _store.WriteItemsAsync(_endpoint, Items(
            """{"date":"2025-02-01T00:00:00+03:00","hour":"00:00","price":100}"""), NoScope);

        var before = await _store.GetRowCountAsync(_endpoint.TableName);

        // Aynı saat, farklı fiyat → EPİAŞ revize etmiş demektir; kopya değildir.
        var result = await _store.WriteItemsAsync(_endpoint, Items(
            """{"date":"2025-02-01T00:00:00+03:00","hour":"00:00","price":101}"""), NoScope);

        Assert.Equal(1, result.Inserted);
        Assert.Equal(before + 1, await _store.GetRowCountAsync(_endpoint.TableName));
    }

    [Fact]
    public async Task Farkli_kapsam_ayni_degerler_kopya_sayilmaz()
    {
        Assert.SkipWhen(_skipReason is not null, _skipReason ?? "");

        var row = Items("""{"date":"2025-03-01T00:00:00+03:00","hour":"00:00","price":500}""");

        var a = await _store.WriteItemsAsync(_endpoint, row,
            new Dictionary<string, object?> { ["region"] = "TR1" });
        var b = await _store.WriteItemsAsync(_endpoint, row,
            new Dictionary<string, object?> { ["region"] = "TR2" });

        // Aynı sayısal değerler farklı bölgelerden gelmiş olabilir; ikisi de saklanmalı.
        Assert.Equal(1, a.Inserted);
        Assert.Equal(1, b.Inserted);
    }

    [Fact]
    public async Task Ayni_yanit_icinde_tekrar_eden_satirlar_elenir()
    {
        Assert.SkipWhen(_skipReason is not null, _skipReason ?? "");

        var duplicated = """{"date":"2025-04-01T00:00:00+03:00","hour":"00:00","price":777}""";
        var result = await _store.WriteItemsAsync(_endpoint, Items(duplicated, duplicated, duplicated), NoScope);

        Assert.Equal(3, result.Fetched);
        Assert.Equal(1, result.Inserted);
        Assert.Equal(2, result.Duplicates);
    }

    [Fact]
    public async Task Uretilen_formul_sql_i_veritabaninda_calisir()
    {
        Assert.SkipWhen(_skipReason is not null, _skipReason ?? "");

        await _store.WriteItemsAsync(_endpoint, Items(
            """{"date":"2025-05-01T00:00:00+03:00","hour":"00:00","price":1000,"priceUsd":25}""",
            """{"date":"2025-05-01T01:00:00+03:00","hour":"01:00","price":2000,"priceUsd":50}"""), NoScope);

        var catalog = new EndpointCatalog(
            Options.Create(new EpiasOptions
            {
                SwaggerPath = Path.Combine(AppContext.BaseDirectory, "specs", "electricity-swagger.json")
            }),
            new StubFactory(),
            NullLogger<EndpointCatalog>.Instance);
        await catalog.InitializeAsync();

        var compiler = new FormulaCompiler(catalog, _store);
        var compiled = compiler.Compile(
            "[markets_dam_data_mcp.price] * [markets_dam_data_mcp.price_usd] / 5",
            AlignmentMode.DateHour);

        var result = await _store.ExecuteSelectAsync(compiled.Sql, new Dictionary<string, object?>
        {
            ["@from"] = new DateTimeOffset(2025, 5, 1, 0, 0, 0, TimeSpan.FromHours(3)),
            ["@to"] = new DateTimeOffset(2025, 5, 2, 0, 0, 0, TimeSpan.FromHours(3)),
            ["@maxRows"] = 100
        });

        Assert.Equal(2, result.Rows.Count);
        Assert.Equal(new[] { "date", "hour", "value" }, result.Columns);

        // 1000 * 25 / 5 = 5000 ve 2000 * 50 / 5 = 20000
        var values = result.Rows.Select(r => (decimal)r["value"]!).OrderBy(v => v).ToList();
        Assert.Equal(5000m, values[0]);
        Assert.Equal(20000m, values[1]);
    }

    [Fact]
    public async Task Formul_ciktisi_tekrarsiz_yazilir()
    {
        Assert.SkipWhen(_skipReason is not null, _skipReason ?? "");

        await _store.WriteItemsAsync(_endpoint, Items(
            """{"date":"2025-06-01T00:00:00+03:00","hour":"00:00","price":300,"priceUsd":10}"""), NoScope);

        var catalog = new EndpointCatalog(
            Options.Create(new EpiasOptions
            {
                SwaggerPath = Path.Combine(AppContext.BaseDirectory, "specs", "electricity-swagger.json")
            }),
            new StubFactory(),
            NullLogger<EndpointCatalog>.Instance);
        await catalog.InitializeAsync();

        var compiler = new FormulaCompiler(catalog, _store);
        const string outputTable = "test_formul_ciktisi";

        await _store.ExecuteNonQueryAsync(
            $"DROP TABLE IF EXISTS [formula].[{outputTable}];", new Dictionary<string, object?>());
        await _store.ExecuteNonQueryAsync(
            compiler.BuildCreateOutputTable(outputTable), new Dictionary<string, object?>());

        var compiled = compiler.Compile(
            "[markets_dam_data_mcp.price] / 5", AlignmentMode.DateHour, outputTable);

        var parameters = new Dictionary<string, object?>
        {
            ["@from"] = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.FromHours(3)),
            ["@to"] = new DateTimeOffset(2025, 6, 2, 0, 0, 0, TimeSpan.FromHours(3)),
            ["@maxRows"] = 100,
            ["@formulaId"] = 1
        };

        var firstInsert = await _store.ExecuteNonQueryAsync(compiled.InsertSql, parameters);
        var secondInsert = await _store.ExecuteNonQueryAsync(compiled.InsertSql, parameters);

        Assert.Equal(1, firstInsert);
        Assert.Equal(0, secondInsert); // aynı sonuç ikinci kez yazılmaz

        var rows = await _store.ExecuteSelectAsync(
            $"SELECT [value] FROM [formula].[{outputTable}];", new Dictionary<string, object?>());
        Assert.Single(rows.Rows);
        Assert.Equal(60m, (decimal)rows.Rows[0]["value"]!);
    }

    private sealed class StubFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}
