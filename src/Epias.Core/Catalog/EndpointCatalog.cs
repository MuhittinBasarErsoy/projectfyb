using Epias.Core.Epias;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Epias.Core.Catalog;

/// <summary>
/// Swagger'dan yüklenen endpoint kataloğunu bellek içinde tutar.
/// Uygulama açılışında bir kez doldurulur.
/// </summary>
public sealed class EndpointCatalog(
    IOptions<EpiasOptions> options,
    IHttpClientFactory httpClientFactory,
    ILogger<EndpointCatalog> logger)
{
    private readonly EpiasOptions _options = options.Value;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private IReadOnlyList<EndpointDescriptor> _all = Array.Empty<EndpointDescriptor>();
    private Dictionary<string, EndpointDescriptor> _byKey = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, EndpointDescriptor> _byTable = new(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyList<EndpointDescriptor> All => _all;

    public IReadOnlyList<EndpointDescriptor> DataEndpoints =>
        _all.Where(e => !e.IsExport && e.Fields.Count > 0).ToList();

    public IReadOnlyList<string> Tags =>
        _all.Select(e => e.Tag).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(t => t).ToList();

    public EndpointDescriptor? Get(string key) =>
        _byKey.TryGetValue(key, out var ep) ? ep : null;

    public EndpointDescriptor GetRequired(string key) =>
        Get(key) ?? throw new KeyNotFoundException($"'{key}' anahtarlı endpoint bulunamadı.");

    public EndpointDescriptor? GetByTable(string tableName) =>
        _byTable.TryGetValue(tableName, out var ep) ? ep : null;

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        if (_all.Count > 0) return;

        await _lock.WaitAsync(ct);
        try
        {
            if (_all.Count > 0) return;

            var json = await ReadSpecAsync(ct);
            var descriptors = SwaggerCatalogLoader.LoadFromJson(json);

            _all = descriptors;
            _byKey = descriptors.ToDictionary(d => d.Key, StringComparer.OrdinalIgnoreCase);
            _byTable = descriptors
                .Where(d => !d.IsExport)
                .GroupBy(d => d.TableName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            logger.LogInformation(
                "Katalog yüklendi: {Total} operasyon, {Data} veri servisi, {Export} export servisi.",
                _all.Count, DataEndpoints.Count, _all.Count(e => e.IsExport));
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<string> ReadSpecAsync(CancellationToken ct)
    {
        var path = Path.IsPathRooted(_options.SwaggerPath)
            ? _options.SwaggerPath
            : Path.Combine(AppContext.BaseDirectory, _options.SwaggerPath);

        if (File.Exists(path))
            return await File.ReadAllTextAsync(path, ct);

        logger.LogWarning("Swagger dosyası bulunamadı ({Path}); {Url} adresinden indiriliyor.",
            path, _options.SwaggerUrl);

        var client = httpClientFactory.CreateClient(EpiasDataClient.HttpClientName);
        var json = await client.GetStringAsync(_options.SwaggerUrl, ct);

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllTextAsync(path, json, ct);
        }
        catch (IOException ex)
        {
            logger.LogWarning(ex, "Swagger dosyası önbelleğe yazılamadı.");
        }

        return json;
    }
}
