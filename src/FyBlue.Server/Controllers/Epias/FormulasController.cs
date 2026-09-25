using System.Security.Claims;
using System.Text.RegularExpressions;
using Epias.Contracts;
using Epias.Core.Catalog;
using Epias.Core.Formulas;
using Epias.Core.Storage;
using FyBlue.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FyBlue.Server.Controllers.Epias;

[ApiController]
[Route("api/epias/formulas")]
[Authorize]
public sealed class FormulasController(
    FormulaService formulas,
    EndpointCatalog catalog,
    DynamicTableStore store,
    OsosFormulaSourceProvider osos) : ControllerBase
{
    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    /// <summary>
    /// Formül oluşturucunun sol panelindeki veri kaynakları: kullanıcının OSOS
    /// sorgu sonuçları ve sayısal alanı olan her EPİAŞ veri tablosu, Türkçe adlarıyla.
    /// </summary>
    [HttpGet("sources")]
    public async Task<ActionResult<List<FormulaSourceDto>>> Sources(CancellationToken ct)
    {
        await osos.RefreshAsync(force: true, ct);
        var ososCounts = await osos.GetRowCountsAsync(UserId, ct);

        var ososSources = osos.Sources.Select(x => new FormulaSourceDto
        {
            Key = x.Name,
            Title = x.Title,
            Tag = x.Tag,
            TableName = x.Name,
            RowCount = ososCounts.TryGetValue(x.Name, out var n) ? n : 0,
            HasDate = x.TimestampColumn is not null,
            HasHour = x.HasHour,
            Fields = x.Fields.Select(f => new FormulaSourceFieldDto { Column = f.Column, Label = f.Label }).ToList()
        });

        var counts = await store.GetAllRowCountsAsync(ct);

        // Derleyici tabloyu adıyla çözer; aynı tabloya yazan servislerden ilki geçerlidir.
        var sources = catalog.DataEndpoints
            .GroupBy(e => e.TableName, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .Where(e => e.Fields.Any(f => f.IsNumeric))
            .OrderBy(e => e.Tag).ThenBy(e => e.Title)
            .Select(e => new FormulaSourceDto
            {
                Key = e.Key,
                Title = e.Title,
                Tag = e.Tag,
                TableName = e.TableName,
                RowCount = counts.TryGetValue(e.TableName, out var c) ? c : 0,
                HasDate = e.DateField is not null,
                HasHour = e.HourField is not null,
                Fields = e.Fields
                    .Where(f => f.IsNumeric)
                    .Select(f => new FormulaSourceFieldDto
                    {
                        Column = f.ColumnName,
                        Label = string.IsNullOrWhiteSpace(f.Description) ? Humanize(f.Name) : f.Description.Trim()
                    })
                    .ToList()
            })
            .ToList();

        // Kullanıcının kendi sayaç verisi listenin başında dursun.
        return Ok(ososSources.Concat(sources).ToList());
    }

    /// <summary><c>amountOfSalesTowardsMatchedBlock</c> → <c>Amount of sales towards matched block</c>.</summary>
    private static string Humanize(string name)
    {
        var spaced = Regex.Replace(name.Replace('_', ' '), "(?<=[a-z0-9])(?=[A-Z])", " ").Trim();
        return spaced.Length == 0 ? name : char.ToUpperInvariant(spaced[0]) + spaced[1..].ToLowerInvariant();
    }

    [HttpGet]
    public async Task<ActionResult<List<FormulaDto>>> List(CancellationToken ct) =>
        Ok(await formulas.ListAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FormulaDto>> Get(int id, CancellationToken ct)
    {
        var dto = await formulas.GetAsync(id, ct);
        return dto is null ? NotFound(new ApiError { Message = $"{id} numaralı formül yok." }) : Ok(dto);
    }

    /// <summary>İfadeyi kaydetmeden doğrular ve üretilecek SQL'i döner.</summary>
    [HttpPost("validate")]
    public async Task<ActionResult<FormulaValidationResult>> Validate(
        [FromBody] FormulaPreviewRequest request, CancellationToken ct) =>
        Ok(await formulas.ValidateAsync(request.Expression, request.AlignmentMode, ct));

    /// <summary>İfadeyi kaydetmeden çalıştırır (ilk N satır).</summary>
    [HttpPost("preview")]
    public async Task<ActionResult<FormulaRunResult>> Preview(
        [FromBody] FormulaPreviewRequest request, CancellationToken ct) =>
        Ok(await formulas.PreviewAsync(request, UserId, ct));

    [HttpPost]
    public async Task<ActionResult<FormulaDto>> Save([FromBody] FormulaDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new ApiError { Message = "Formül adı zorunludur." });

        try
        {
            var saved = await formulas.SaveAsync(dto, User.FindFirstValue(ClaimTypes.Name), ct);
            return Ok(saved);
        }
        catch (FormulaException ex)
        {
            return BadRequest(new ApiError { Message = "Formül geçersiz.", Detail = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiError { Message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) =>
        await formulas.DeleteAsync(id, ct) ? NoContent() : NotFound();

    /// <summary>Kayıtlı formülü çalıştırır; istenirse sonucu çıktı tablosuna yazar.</summary>
    [HttpPost("run")]
    public async Task<ActionResult<FormulaRunResult>> Run(
        [FromBody] FormulaRunRequest request, CancellationToken ct)
    {
        try
        {
            var result = await formulas.RunAsync(request, UserId, ct);
            return result.Error is null ? Ok(result) : StatusCode(StatusCodes.Status422UnprocessableEntity, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiError { Message = ex.Message });
        }
    }
}
