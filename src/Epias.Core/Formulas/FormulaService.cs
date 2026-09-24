using System.Diagnostics;
using Epias.Contracts;
using Epias.Core.Data;
using Epias.Core.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Epias.Core.Formulas;

/// <summary>Formüllerin CRUD, doğrulama ve çalıştırma işlemleri.</summary>
public sealed class FormulaService(
    EpiasDbContext db,
    FormulaCompiler compiler,
    DynamicTableStore store,
    ILogger<FormulaService> logger)
{
    public async Task<List<FormulaDto>> ListAsync(CancellationToken ct = default)
    {
        var entities = await db.Formulas.AsNoTracking().OrderBy(f => f.Name).ToListAsync(ct);
        return entities.Select(ToDto).ToList();
    }

    public async Task<FormulaDto?> GetAsync(int id, CancellationToken ct = default)
    {
        var f = await db.Formulas.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return f is null ? null : ToDto(f);
    }

    public FormulaValidationResult Validate(string expression, string alignmentMode)
    {
        try
        {
            var compiled = compiler.Compile(expression, FormulaCompiler.ParseMode(alignmentMode));
            return new FormulaValidationResult
            {
                IsValid = true,
                ReferencedTables = compiled.ReferencedTables.ToList(),
                ReferencedColumns = compiled.ReferencedColumns.ToList(),
                GeneratedSql = compiled.Sql
            };
        }
        catch (FormulaException ex)
        {
            return new FormulaValidationResult { IsValid = false, Error = ex.Message };
        }
    }

    public async Task<FormulaDto> SaveAsync(FormulaDto dto, string? user, CancellationToken ct = default)
    {
        // Kaydetmeden önce derlenebilirliği garanti et.
        var mode = FormulaCompiler.ParseMode(dto.AlignmentMode);
        var outputTable = string.IsNullOrWhiteSpace(dto.OutputTable)
            ? null
            : SqlIdentifier.Sanitize(dto.OutputTable);

        compiler.Compile(dto.Expression, mode, outputTable);

        var entity = dto.Id > 0
            ? await db.Formulas.FirstOrDefaultAsync(x => x.Id == dto.Id, ct)
              ?? throw new KeyNotFoundException($"{dto.Id} numaralı formül yok.")
            : new Formula { CreatedBy = user };

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description;
        entity.Expression = dto.Expression.Trim();
        entity.AlignmentMode = mode.ToString();
        entity.OutputTable = outputTable;
        entity.DefaultFrom = dto.DefaultFrom;
        entity.DefaultTo = dto.DefaultTo;
        entity.IsActive = dto.IsActive;

        if (dto.Id > 0) entity.UpdatedAt = DateTimeOffset.UtcNow;
        else db.Formulas.Add(entity);

        await db.SaveChangesAsync(ct);

        if (outputTable is not null)
            await store.ExecuteNonQueryAsync(
                compiler.BuildCreateOutputTable(outputTable),
                new Dictionary<string, object?>(), ct);

        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await db.Formulas.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return false;
        db.Formulas.Remove(entity);
        await db.SaveChangesAsync(ct);
        return true;
    }

    // -----------------------------------------------------------------------

    /// <summary>Kaydedilmemiş bir ifadeyi çalıştırıp önizleme döner.</summary>
    public async Task<FormulaRunResult> PreviewAsync(FormulaPreviewRequest request, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var compiled = compiler.Compile(request.Expression, FormulaCompiler.ParseMode(request.AlignmentMode));
            var rows = await ReadRowsAsync(compiled.Sql, request.From, request.To, request.MaxRows, ct);

            return new FormulaRunResult
            {
                Name = "(önizleme)",
                Rows = rows,
                ElapsedMs = sw.ElapsedMilliseconds,
                Sql = compiled.Sql
            };
        }
        catch (Exception ex) when (ex is FormulaException or Microsoft.Data.SqlClient.SqlException)
        {
            return new FormulaRunResult
            {
                Name = "(önizleme)",
                Error = ex.Message,
                ElapsedMs = sw.ElapsedMilliseconds
            };
        }
    }

    public async Task<FormulaRunResult> RunAsync(FormulaRunRequest request, CancellationToken ct = default)
    {
        var entity = await db.Formulas.FirstOrDefaultAsync(x => x.Id == request.FormulaId, ct)
                     ?? throw new KeyNotFoundException($"{request.FormulaId} numaralı formül yok.");

        var sw = Stopwatch.StartNew();
        var run = new FormulaRun { FormulaId = entity.Id };
        db.FormulaRuns.Add(run);

        var from = request.From ?? entity.DefaultFrom;
        var to = request.To ?? entity.DefaultTo;

        try
        {
            var compiled = compiler.Compile(
                entity.Expression,
                FormulaCompiler.ParseMode(entity.AlignmentMode),
                entity.OutputTable);

            var rows = await ReadRowsAsync(compiled.Sql, from, to, request.MaxRows, ct);

            var persisted = 0;
            if (request.Persist && !string.IsNullOrWhiteSpace(entity.OutputTable))
            {
                await store.ExecuteNonQueryAsync(
                    compiler.BuildCreateOutputTable(entity.OutputTable),
                    new Dictionary<string, object?>(), ct);

                persisted = await store.ExecuteNonQueryAsync(compiled.InsertSql, new Dictionary<string, object?>
                {
                    ["@from"] = from,
                    ["@to"] = to,
                    ["@maxRows"] = request.MaxRows,
                    ["@formulaId"] = entity.Id
                }, ct);
            }

            run.RowsProduced = rows.Count;
            run.RowsPersisted = persisted;
            run.Success = true;
            run.FinishedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return new FormulaRunResult
            {
                FormulaId = entity.Id,
                Name = entity.Name,
                Rows = rows,
                Persisted = persisted,
                ElapsedMs = sw.ElapsedMilliseconds,
                Sql = compiled.Sql
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Formül {Id} çalıştırılamadı.", entity.Id);
            run.Success = false;
            run.Error = ex.Message;
            run.FinishedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);

            return new FormulaRunResult
            {
                FormulaId = entity.Id,
                Name = entity.Name,
                Error = ex.Message,
                ElapsedMs = sw.ElapsedMilliseconds
            };
        }
    }

    private async Task<List<FormulaRowDto>> ReadRowsAsync(
        string sql, DateTimeOffset? from, DateTimeOffset? to, int maxRows, CancellationToken ct)
    {
        var result = await store.ExecuteSelectAsync(sql, new Dictionary<string, object?>
        {
            ["@from"] = from,
            ["@to"] = to,
            ["@maxRows"] = Math.Clamp(maxRows, 1, 100_000)
        }, ct);

        return result.Rows.Select(r => new FormulaRowDto
        {
            Date = r.TryGetValue("date", out var d) && d is DateTime dt
                ? new DateTimeOffset(dt, TimeSpan.Zero)
                : null,
            Hour = r.TryGetValue("hour", out var h) ? h?.ToString() : null,
            Value = r.TryGetValue("value", out var v) && v is decimal dec ? dec : null
        }).ToList();
    }

    private static FormulaDto ToDto(Formula f) => new()
    {
        Id = f.Id,
        Name = f.Name,
        Description = f.Description,
        Expression = f.Expression,
        AlignmentMode = f.AlignmentMode,
        OutputTable = f.OutputTable,
        DefaultFrom = f.DefaultFrom,
        DefaultTo = f.DefaultTo,
        IsActive = f.IsActive,
        CreatedAt = f.CreatedAt,
        CreatedBy = f.CreatedBy
    };
}
