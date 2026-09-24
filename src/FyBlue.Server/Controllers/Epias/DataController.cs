using Epias.Contracts;
using Epias.Core.Catalog;
using Epias.Core.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FyBlue.Server.Controllers.Epias;

[ApiController]
[Route("api/epias/data")]
[Authorize]
public sealed class DataController(EndpointCatalog catalog, DynamicTableStore store) : ControllerBase
{
    /// <summary>Bir endpoint tablosundan sayfalı okuma.</summary>
    [HttpPost("query")]
    public async Task<ActionResult<TableQueryResult>> Query(
        [FromBody] TableQueryRequest request, CancellationToken ct)
    {
        var ep = catalog.Get(request.EndpointKey) ?? catalog.GetByTable(request.EndpointKey);
        if (ep is null)
            return NotFound(new ApiError { Message = $"'{request.EndpointKey}' bulunamadı." });

        if (ep.IsExport || ep.Fields.Count == 0)
            return BadRequest(new ApiError { Message = "Bu servisin veri tablosu yok." });

        if (!await store.TableExistsAsync(store.DataSchema, ep.TableName, ct))
            return Ok(new TableQueryResult { Page = request.Page, PageSize = request.PageSize });

        var result = await store.QueryAsync(
            ep, request.From, request.To, request.Page, request.PageSize,
            request.OrderBy, request.Descending, ct);

        return Ok(new TableQueryResult
        {
            Columns = result.Columns,
            Rows = result.Rows,
            Total = result.Total,
            Page = request.Page,
            PageSize = request.PageSize
        });
    }

    /// <summary>Tarayıcıdan doğrudan indirilebilir CSV çıktısı.</summary>
    [HttpGet("{endpointKey}/csv")]
    public async Task<IActionResult> Csv(
        string endpointKey,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int maxRows = 50_000,
        CancellationToken ct = default)
    {
        var ep = catalog.Get(endpointKey) ?? catalog.GetByTable(endpointKey);
        if (ep is null) return NotFound();

        var result = await store.QueryAsync(ep, from, to, 1, Math.Clamp(maxRows, 1, 5000),
            null, false, ct);

        var csv = new System.Text.StringBuilder();
        csv.AppendLine(string.Join(";", result.Columns.Select(Escape)));
        foreach (var row in result.Rows)
            csv.AppendLine(string.Join(";", result.Columns.Select(c => Escape(Format(row[c])))));

        return File(System.Text.Encoding.UTF8.GetPreamble()
                .Concat(System.Text.Encoding.UTF8.GetBytes(csv.ToString())).ToArray(),
            "text/csv", $"{ep.TableName}.csv");

        static string Format(object? v) => v switch
        {
            null => "",
            DateTimeOffset d => d.ToString("yyyy-MM-dd HH:mm:sszzz"),
            DateTime d => d.ToString("yyyy-MM-dd HH:mm:ss"),
            byte[] b => Convert.ToHexString(b),
            IFormattable f => f.ToString(null, System.Globalization.CultureInfo.InvariantCulture),
            _ => v.ToString() ?? ""
        };

        static string Escape(string s) =>
            s.Contains(';') || s.Contains('"') || s.Contains('\n')
                ? "\"" + s.Replace("\"", "\"\"") + "\""
                : s;
    }
}
