using System.Diagnostics;
using System.Text.Json;
using Epias.Contracts;
using Epias.Core.Catalog;
using Epias.Core.Data;
using Epias.Core.Epias;
using Epias.Core.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Epias.Core.Ingestion;

/// <summary>
/// Bir endpoint'i çağırır, dönen satırları kendi tablosuna tekrarsız yazar
/// ve çalışmayı <c>app.sync_runs</c> tablosuna kaydeder.
/// </summary>
public sealed class IngestionService(
    EndpointCatalog catalog,
    EpiasDataClient client,
    DynamicTableStore store,
    IEpiasTicketAccessor ticketAccessor,
    EpiasDbContext db,
    IOptions<EpiasOptions> options,
    ILogger<IngestionService> logger)
{
    private readonly EpiasOptions _options = options.Value;

    public async Task<SyncResultDto> SyncAsync(SyncRequest request, CancellationToken ct = default)
    {
        var ep = catalog.Get(request.EndpointKey);
        if (ep is null)
            return Failure(request.EndpointKey, "", $"'{request.EndpointKey}' anahtarlı servis bulunamadı.");

        if (ep.IsExport)
            return Failure(ep.Key, ep.TableName,
                "Export servisleri dosya döndürür; tabloya kaydedilmez. Karşılığı olan veri servisini kullanın.");

        if (ep.Fields.Count == 0)
            return Failure(ep.Key, ep.TableName, "Bu servisin yanıt şeması tablo üretmeye uygun değil.");

        var sw = Stopwatch.StartNew();
        var run = new SyncRun
        {
            EndpointKey = ep.Key,
            ParametersJson = JsonSerializer.Serialize(request.Parameters),
            TriggeredBy = ticketAccessor.Username
        };
        db.SyncRuns.Add(run);

        int fetched = 0, inserted = 0, duplicates = 0, requests = 0;

        try
        {
            var ticket = await ticketAccessor.GetTicketAsync(ct);
            await store.EnsureTableAsync(ep, ct);

            foreach (var window in BuildWindows(ep, request))
            {
                var parameters = BuildParameters(ep, request, window);
                var scope = BuildScope(ep, parameters);

                await foreach (var page in client.FetchAllPagesAsync(ep, parameters, ticket, ct))
                {
                    requests++;
                    if (page.Items.Count == 0) continue;

                    var result = await store.WriteItemsAsync(ep, page.Items, scope, ct);
                    fetched += result.Fetched;
                    inserted += result.Inserted;
                    duplicates += result.Duplicates;
                }
            }

            run.Fetched = fetched;
            run.Inserted = inserted;
            run.Duplicates = duplicates;
            run.Requests = requests;
            run.Success = true;
            run.FinishedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            return new SyncResultDto
            {
                EndpointKey = ep.Key,
                TableName = ep.TableName,
                Fetched = fetched,
                Inserted = inserted,
                Duplicates = duplicates,
                Requests = requests,
                ElapsedMs = sw.ElapsedMilliseconds,
                Success = true
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "{Key} senkronizasyonu başarısız.", ep.Key);

            run.Success = false;
            run.Error = ex.Message;
            run.Fetched = fetched;
            run.Inserted = inserted;
            run.Duplicates = duplicates;
            run.Requests = requests;
            run.FinishedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);

            return new SyncResultDto
            {
                EndpointKey = ep.Key,
                TableName = ep.TableName,
                Fetched = fetched,
                Inserted = inserted,
                Duplicates = duplicates,
                Requests = requests,
                ElapsedMs = sw.ElapsedMilliseconds,
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>Toplu senkronizasyonda işlenecek servis anahtarlarını belirler.</summary>
    public List<string> ResolveKeys(BulkSyncRequest request)
    {
        if (request.EndpointKeys.Count > 0)
            return request.EndpointKeys.Where(k => catalog.Get(k) is { IsExport: false }).ToList();

        return catalog.DataEndpoints
            .Where(e => request.TagFilter is null ||
                        e.Tag.Contains(request.TagFilter, StringComparison.OrdinalIgnoreCase))
            .Where(e => !e.RequiresExtraParameters)
            .Select(e => e.Key)
            .ToList();
    }

    // -----------------------------------------------------------------------

    private sealed record DateWindow(DateTimeOffset? Start, DateTimeOffset? End);

    private static IEnumerable<DateWindow> BuildWindows(EndpointDescriptor ep, SyncRequest request)
    {
        if (!ep.SupportsDateRange || request.StartDate is null || request.EndDate is null)
        {
            yield return new DateWindow(request.StartDate, request.EndDate);
            yield break;
        }

        var start = request.StartDate.Value;
        var end = request.EndDate.Value;

        if (request.ChunkDays <= 0 || end <= start)
        {
            yield return new DateWindow(start, end);
            yield break;
        }

        var cursor = start;
        while (cursor < end)
        {
            var next = cursor.AddDays(request.ChunkDays);
            if (next > end) next = end;
            yield return new DateWindow(cursor, next);
            cursor = next;
        }
    }

    private Dictionary<string, object?> BuildParameters(
        EndpointDescriptor ep, SyncRequest request, DateWindow window)
    {
        var parameters = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        foreach (var kv in request.Parameters)
            if (kv.Value is not null)
                parameters[kv.Key] = Normalize(kv.Value);

        if (ep.SupportsDateRange)
        {
            if (window.Start.HasValue) parameters["startDate"] = window.Start.Value;
            if (window.End.HasValue) parameters["endDate"] = window.End.Value;
        }

        // Zorunlu tarih parametreleri hiç verilmemişse son 1 günü çek.
        foreach (var p in ep.Parameters.Where(p => p.Required && p.IsDateTime))
        {
            if (parameters.ContainsKey(p.Name)) continue;
            parameters[p.Name] = p.Name.Equals("endDate", StringComparison.OrdinalIgnoreCase)
                ? DateTimeOffset.UtcNow.ToOffset(EpiasDataClient.TurkeyOffset).Date
                    .AddDays(1).AddSeconds(-1).ToDateTimeOffset(EpiasDataClient.TurkeyOffset)
                : DateTimeOffset.UtcNow.ToOffset(EpiasDataClient.TurkeyOffset).Date
                    .ToDateTimeOffset(EpiasDataClient.TurkeyOffset);
        }

        return parameters;
    }

    /// <summary>
    /// Satırın hangi bağlamda çekildiğini belirleyen parametreler.
    /// Tarih aralığı hariç tutulur — aynı satırın farklı pencerelerden
    /// tekrar gelmesi kopya sayılmalıdır.
    /// </summary>
    private static Dictionary<string, object?> BuildScope(
        EndpointDescriptor ep, IReadOnlyDictionary<string, object?> parameters)
    {
        var scope = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in parameters)
        {
            if (kv.Key.Equals("startDate", StringComparison.OrdinalIgnoreCase)) continue;
            if (kv.Key.Equals("endDate", StringComparison.OrdinalIgnoreCase)) continue;
            if (kv.Key.Equals("page", StringComparison.OrdinalIgnoreCase)) continue;
            scope[kv.Key] = kv.Value;
        }
        return scope;
    }

    private static object? Normalize(object value) => value switch
    {
        JsonElement je => je.ValueKind switch
        {
            JsonValueKind.String => je.GetString(),
            JsonValueKind.Number => je.TryGetInt64(out var l) ? l : je.GetDecimal(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => je
        },
        _ => value
    };

    private static SyncResultDto Failure(string key, string table, string error) => new()
    {
        EndpointKey = key,
        TableName = table,
        Success = false,
        Error = error
    };
}

internal static class DateExtensions
{
    public static DateTimeOffset ToDateTimeOffset(this DateTime value, TimeSpan offset) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), offset);
}
