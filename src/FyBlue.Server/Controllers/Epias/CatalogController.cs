using Epias.Contracts;
using Epias.Core.Catalog;
using Epias.Core.Data;
using Epias.Core.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers.Epias;

[ApiController]
[Route("api/epias/catalog")]
[Authorize]
public sealed class CatalogController(
    EndpointCatalog catalog,
    DynamicTableStore store,
    EpiasDbContext db) : ControllerBase
{
    /// <summary>Katalogdaki tüm servisler. İsteğe bağlı etiket/arama filtresi.</summary>
    [HttpGet("endpoints")]
    public async Task<ActionResult<List<EndpointSummaryDto>>> List(
        [FromQuery] string? tag,
        [FromQuery] string? search,
        [FromQuery] bool includeExport = false,
        [FromQuery] bool includeCounts = true,
        CancellationToken ct = default)
    {
        var query = catalog.All.AsEnumerable();

        if (!includeExport) query = query.Where(e => !e.IsExport && e.Fields.Count > 0);
        if (!string.IsNullOrWhiteSpace(tag))
            query = query.Where(e => e.Tag.Contains(tag, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(e =>
                e.Title.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                e.Key.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                e.Path.Contains(search, StringComparison.OrdinalIgnoreCase));

        var endpoints = query.OrderBy(e => e.Tag).ThenBy(e => e.Title).ToList();

        var counts = includeCounts
            ? await store.GetAllRowCountsAsync(ct)
            : new Dictionary<string, long>();

        var keys = endpoints.Select(e => e.Key).ToList();
        var lastSync = await db.SyncRuns.AsNoTracking()
            .Where(r => keys.Contains(r.EndpointKey) && r.Success)
            .GroupBy(r => r.EndpointKey)
            .Select(g => new { Key = g.Key, Last = g.Max(x => x.FinishedAt) })
            .ToDictionaryAsync(x => x.Key, x => x.Last, ct);

        return Ok(endpoints.Select(e => ToSummary(e, counts, lastSync)).ToList());
    }

    [HttpGet("tags")]
    public ActionResult<List<string>> Tags() => Ok(catalog.Tags);

    [HttpGet("endpoints/{key}")]
    public async Task<ActionResult<EndpointDetailDto>> Detail(string key, CancellationToken ct)
    {
        var ep = catalog.Get(key);
        if (ep is null) return NotFound(new ApiError { Message = $"'{key}' bulunamadı." });

        var rowCount = ep.IsExport ? -1 : await store.GetRowCountAsync(ep.TableName, ct);
        var last = await db.SyncRuns.AsNoTracking()
            .Where(r => r.EndpointKey == key && r.Success)
            .OrderByDescending(r => r.FinishedAt)
            .Select(r => r.FinishedAt)
            .FirstOrDefaultAsync(ct);

        return Ok(new EndpointDetailDto
        {
            Key = ep.Key,
            Path = ep.Path,
            Method = ep.Method,
            Tag = ep.Tag,
            Title = ep.Title,
            TableName = ep.TableName,
            IsExport = ep.IsExport,
            SupportsDateRange = ep.SupportsDateRange,
            RequiresParameters = ep.RequiresExtraParameters,
            RowCount = rowCount,
            LastSyncedAt = last,
            Description = ep.Description,
            Parameters = ep.Parameters.Select(p => new ParameterDto
            {
                Name = p.Name,
                Type = p.Type,
                Required = p.Required,
                Description = p.Description,
                Example = p.Example,
                In = p.In,
                EnumValues = p.EnumValues
            }).ToList(),
            Columns = ep.Fields.Select(f => new ColumnDto
            {
                Name = f.ColumnName,
                SqlType = f.SqlType,
                ClrType = f.ClrType.Name,
                IsNumeric = f.IsNumeric,
                IsDate = f.IsDate,
                Description = f.Description
            }).ToList()
        });
    }

    private static EndpointSummaryDto ToSummary(
        EndpointDescriptor e,
        IReadOnlyDictionary<string, long> counts,
        IReadOnlyDictionary<string, DateTimeOffset?> lastSync) => new()
    {
        Key = e.Key,
        Path = e.Path,
        Method = e.Method,
        Tag = e.Tag,
        Title = e.Title,
        TableName = e.TableName,
        IsExport = e.IsExport,
        SupportsDateRange = e.SupportsDateRange,
        RequiresParameters = e.RequiresExtraParameters,
        RowCount = counts.TryGetValue(e.TableName, out var c) ? c : 0,
        LastSyncedAt = lastSync.TryGetValue(e.Key, out var l) ? l : null
    };
}
