using System.Text.Json;
using Epias.Contracts;

namespace FyBlue.Web.Services;

/// <summary>EPİAŞ modülü uçları (<c>/api/epias/...</c>). Hatalar <see cref="ApiException"/> olarak fırlatılır.</summary>
public sealed class EpiasApiClient(ApiHttp api)
{
    // -- katalog ------------------------------------------------------------

    public async Task<List<EndpointSummaryDto>> GetEndpointsAsync(
        string? tag = null, string? search = null, bool includeExport = false, CancellationToken ct = default)
    {
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(tag)) query.Add($"tag={Uri.EscapeDataString(tag)}");
        if (!string.IsNullOrWhiteSpace(search)) query.Add($"search={Uri.EscapeDataString(search)}");
        query.Add($"includeExport={includeExport.ToString().ToLowerInvariant()}");

        return await api.GetAsync<List<EndpointSummaryDto>>("api/epias/catalog/endpoints?" + string.Join("&", query), ct)
               ?? new();
    }

    public async Task<List<string>> GetTagsAsync(CancellationToken ct = default) =>
        await api.GetAsync<List<string>>("api/epias/catalog/tags", ct) ?? new();

    public Task<EndpointDetailDto?> GetEndpointAsync(string key, CancellationToken ct = default) =>
        api.GetAsync<EndpointDetailDto>($"api/epias/catalog/endpoints/{Uri.EscapeDataString(key)}", ct);

    // -- senkronizasyon -----------------------------------------------------

    public Task<SyncResultDto?> SyncAsync(SyncRequest request, CancellationToken ct = default) =>
        api.PostAllowingResultErrorsAsync<SyncResultDto>("api/epias/sync/run", request, ct);

    public Task<List<SyncResultDto>?> SyncBulkAsync(BulkSyncRequest request, CancellationToken ct = default) =>
        api.PostAsync<List<SyncResultDto>>("api/epias/sync/run-bulk", request, ct);

    public async Task<JsonElement?> GetSyncStatusAsync(CancellationToken ct = default)
    {
        var status = await api.GetAsync<JsonElement>("api/epias/sync/status", ct);
        return status.ValueKind == JsonValueKind.Undefined ? null : status;
    }

    // -- veri ---------------------------------------------------------------

    public Task<TableQueryResult?> QueryAsync(TableQueryRequest request, CancellationToken ct = default) =>
        api.PostAsync<TableQueryResult>("api/epias/data/query", request, ct);

    public Task<(byte[] Bytes, string FileName)> ExportCsvAsync(string endpointKey, DateTimeOffset? from, DateTimeOffset? to)
    {
        var query = new List<string>();
        if (from.HasValue) query.Add($"from={Uri.EscapeDataString(from.Value.ToString("O"))}");
        if (to.HasValue) query.Add($"to={Uri.EscapeDataString(to.Value.ToString("O"))}");
        var suffix = query.Count > 0 ? "?" + string.Join("&", query) : "";
        return api.DownloadAsync($"api/epias/data/{Uri.EscapeDataString(endpointKey)}/csv{suffix}", $"{endpointKey}.csv");
    }

    // -- formüller ----------------------------------------------------------

    public async Task<List<FormulaDto>> GetFormulasAsync(CancellationToken ct = default) =>
        await api.GetAsync<List<FormulaDto>>("api/epias/formulas", ct) ?? new();

    public async Task<List<FormulaSourceDto>> GetFormulaSourcesAsync(CancellationToken ct = default) =>
        await api.GetAsync<List<FormulaSourceDto>>("api/epias/formulas/sources", ct) ?? new();

    public Task<FormulaValidationResult?> ValidateFormulaAsync(FormulaPreviewRequest request, CancellationToken ct = default) =>
        api.PostAllowingResultErrorsAsync<FormulaValidationResult>("api/epias/formulas/validate", request, ct);

    public Task<FormulaRunResult?> PreviewFormulaAsync(FormulaPreviewRequest request, CancellationToken ct = default) =>
        api.PostAllowingResultErrorsAsync<FormulaRunResult>("api/epias/formulas/preview", request, ct);

    public Task<FormulaDto?> SaveFormulaAsync(FormulaDto dto, CancellationToken ct = default) =>
        api.PostAsync<FormulaDto>("api/epias/formulas", dto, ct);

    public Task<FormulaRunResult?> RunFormulaAsync(FormulaRunRequest request, CancellationToken ct = default) =>
        api.PostAllowingResultErrorsAsync<FormulaRunResult>("api/epias/formulas/run", request, ct);

    public Task DeleteFormulaAsync(int id, CancellationToken ct = default) =>
        api.SendAsync(HttpMethod.Delete, $"api/epias/formulas/{id}", ct);

    /// <summary>EPİAŞ tüm tarihleri Türkiye saatiyle (+03:00) bekler.</summary>
    public static DateTimeOffset? ToOffset(DateTime? date, bool endOfDay = false)
    {
        if (date is not { } d) return null;
        var local = endOfDay ? d.Date.AddDays(1).AddSeconds(-1) : d.Date;
        return new DateTimeOffset(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), TimeSpan.FromHours(3));
    }
}
