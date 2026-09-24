using Epias.Contracts;
using Epias.Core.Catalog;
using Epias.Core.Data;
using FyBlue.Server.Services;
using Epias.Core.Ingestion;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FyBlue.Server.Controllers.Epias;

[ApiController]
[Route("api/epias/sync")]
[Authorize]
public sealed class SyncController(
    IngestionService ingestion,
    BulkSyncService bulkSync,
    IEpiasTicketAccessor ticketAccessor,
    EndpointCatalog catalog,
    EpiasDbContext db) : ControllerBase
{
    /// <summary>Tek bir servisi çekip kendi tablosuna tekrarsız kaydeder.</summary>
    [HttpPost("run")]
    public async Task<ActionResult<SyncResultDto>> Run([FromBody] SyncRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.EndpointKey))
            return BadRequest(new ApiError { Message = "endpointKey zorunludur." });

        // Hesap bağlı değilse/şifre geçersizse koşu kaydı açmadan 409 dönsün (ApiExceptionFilter).
        await ticketAccessor.GetTicketAsync(ct);

        var result = await ingestion.SyncAsync(request, ct);
        return result.Success ? Ok(result) : StatusCode(StatusCodes.Status502BadGateway, result);
    }

    /// <summary>
    /// Birden çok servisi (veya tüm katalogu) sınırlı paralellikle senkronize eder.
    /// Her servis kendi DI kapsamında çalışır — DbContext paylaşılmaz.
    /// </summary>
    [HttpPost("run-bulk")]
    public async Task<ActionResult<List<SyncResultDto>>> RunBulk(
        [FromBody] BulkSyncRequest request, CancellationToken ct)
    {
        // Bilet bir kez çözülür ve alt kapsamlara taşınır; her iş için yeniden
        // CAS'a gitmek hem yavaş hem gereksizdir.
        var ticket = await ticketAccessor.GetTicketAsync(ct);
        var username = ticketAccessor.Username ?? "";

        var results = await bulkSync.RunAsync(request, username, ticket, ct);
        return Ok(results);
    }

    /// <summary>Tüm veri servislerini (ek parametre istemeyenler) tek seferde çeker.</summary>
    [HttpPost("run-all")]
    public async Task<ActionResult<List<SyncResultDto>>> RunAll(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int chunkDays = 0,
        [FromQuery] int maxParallel = 4,
        [FromQuery] string? tag = null,
        CancellationToken ct = default)
    {
        return await RunBulk(new BulkSyncRequest
        {
            StartDate = from,
            EndDate = to,
            ChunkDays = chunkDays,
            MaxParallel = maxParallel,
            TagFilter = tag
        }, ct);
    }

    [HttpGet("runs")]
    public async Task<ActionResult<object>> Runs(
        [FromQuery] string? endpointKey,
        [FromQuery] int take = 100,
        CancellationToken ct = default)
    {
        var query = db.SyncRuns.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(endpointKey)) query = query.Where(r => r.EndpointKey == endpointKey);

        var runs = await query
            .OrderByDescending(r => r.StartedAt)
            .Take(Math.Clamp(take, 1, 1000))
            .ToListAsync(ct);

        return Ok(runs);
    }

    /// <summary>Katalogdaki senkronize edilebilir servis sayısı ve özet durum.</summary>
    [HttpGet("status")]
    public async Task<ActionResult<object>> Status(CancellationToken ct)
    {
        var lastRuns = await db.SyncRuns.AsNoTracking()
            .GroupBy(r => r.EndpointKey)
            .Select(g => new
            {
                EndpointKey = g.Key,
                LastRun = g.Max(x => x.StartedAt),
                Inserted = g.Sum(x => x.Inserted),
                Failures = g.Count(x => !x.Success)
            })
            .ToListAsync(ct);

        return Ok(new
        {
            totalOperations = catalog.All.Count,
            dataEndpoints = catalog.DataEndpoints.Count,
            exportEndpoints = catalog.All.Count(e => e.IsExport),
            syncedEndpoints = lastRuns.Count,
            details = lastRuns.OrderByDescending(r => r.LastRun).Take(200)
        });
    }
}

