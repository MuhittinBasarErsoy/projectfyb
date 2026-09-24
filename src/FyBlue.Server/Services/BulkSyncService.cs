using System.Collections.Concurrent;
using Epias.Contracts;
using Epias.Core.Ingestion;
using Microsoft.Extensions.DependencyInjection;

namespace FyBlue.Server.Services;

/// <summary>
/// Birden çok servisi sınırlı paralellikle çeker. Her iş kendi DI kapsamında
/// koşar (DbContext ve SqlConnection paylaşılmaz); EPİAŞ bileti bir kez
/// çözülüp kapsamlara <see cref="TicketContext"/> ile aktarılır.
/// </summary>
public sealed class BulkSyncService(
    IServiceScopeFactory scopeFactory,
    ILogger<BulkSyncService> logger)
{
    public async Task<List<SyncResultDto>> RunAsync(
        BulkSyncRequest request,
        string username,
        string ticket,
        CancellationToken ct = default)
    {
        List<string> keys;
        using (var scope = scopeFactory.CreateScope())
        {
            var ingestion = scope.ServiceProvider.GetRequiredService<IngestionService>();
            keys = ingestion.ResolveKeys(request);
        }

        logger.LogInformation("Toplu senkronizasyon: {Count} servis, paralellik {Parallel}.",
            keys.Count, request.MaxParallel);

        var results = new ConcurrentBag<SyncResultDto>();
        var gate = new SemaphoreSlim(Math.Clamp(request.MaxParallel, 1, 8));

        var tasks = keys.Select(async key =>
        {
            await gate.WaitAsync(ct);
            using var scope = scopeFactory.CreateScope();
            try
            {
                scope.ServiceProvider.GetRequiredService<TicketContext>().Set(username, ticket);

                var ingestion = scope.ServiceProvider.GetRequiredService<IngestionService>();
                results.Add(await ingestion.SyncAsync(new SyncRequest
                {
                    EndpointKey = key,
                    StartDate = request.StartDate,
                    EndDate = request.EndDate,
                    ChunkDays = request.ChunkDays
                }, ct));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "{Key} toplu senkronizasyonda hata verdi.", key);
                results.Add(new SyncResultDto { EndpointKey = key, Success = false, Error = ex.Message });
            }
            finally
            {
                gate.Release();
            }
        });

        await Task.WhenAll(tasks);
        return results.OrderBy(r => r.EndpointKey).ToList();
    }
}
