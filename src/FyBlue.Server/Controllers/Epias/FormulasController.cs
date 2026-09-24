using System.Security.Claims;
using Epias.Contracts;
using Epias.Core.Formulas;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FyBlue.Server.Controllers.Epias;

[ApiController]
[Route("api/epias/formulas")]
[Authorize]
public sealed class FormulasController(FormulaService formulas) : ControllerBase
{
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
    public ActionResult<FormulaValidationResult> Validate([FromBody] FormulaPreviewRequest request) =>
        Ok(formulas.Validate(request.Expression, request.AlignmentMode));

    /// <summary>İfadeyi kaydetmeden çalıştırır (ilk N satır).</summary>
    [HttpPost("preview")]
    public async Task<ActionResult<FormulaRunResult>> Preview(
        [FromBody] FormulaPreviewRequest request, CancellationToken ct) =>
        Ok(await formulas.PreviewAsync(request, ct));

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
            var result = await formulas.RunAsync(request, ct);
            return result.Error is null ? Ok(result) : StatusCode(StatusCodes.Status422UnprocessableEntity, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiError { Message = ex.Message });
        }
    }
}
