using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Epias.Core.Catalog;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Epias.Core.Epias;

public sealed class EpiasApiException(string message, HttpStatusCode? status = null, string? body = null)
    : Exception(message)
{
    public HttpStatusCode? Status { get; } = status;
    public string? ResponseBody { get; } = body;
}

/// <summary>Tek bir EPİAŞ servisinden dönen sayfa.</summary>
public sealed record EpiasPage(List<JsonElement> Items, long? Total, int? PageNumber, int? PageSize);

/// <summary>
/// Katalogdaki herhangi bir endpoint'i çağırabilen genel istemci.
/// Servise özel sınıf yazmaya gerek yoktur; şekil Swagger'dan gelir.
/// </summary>
public sealed class EpiasDataClient(
    IHttpClientFactory httpClientFactory,
    IOptions<EpiasOptions> options,
    ILogger<EpiasDataClient> logger)
{
    public const string HttpClientName = "epias-data";

    private readonly EpiasOptions _options = options.Value;

    /// <summary>Sayfalama desteklemeyen ya da tek seferlik çağrılar için.</summary>
    public async Task<EpiasPage> FetchPageAsync(
        EndpointDescriptor ep,
        IReadOnlyDictionary<string, object?> parameters,
        string tgt,
        int? pageNumber,
        int? pageSize,
        CancellationToken ct = default)
    {
        var client = httpClientFactory.CreateClient(HttpClientName);
        var url = BuildUrl(ep, parameters);

        using var request = new HttpRequestMessage(new HttpMethod(ep.Method), url);
        request.Headers.TryAddWithoutValidation("TGT", tgt);
        request.Headers.Accept.ParseAdd("application/json");

        if (ep.Method == "POST")
        {
            var body = BuildBody(ep, parameters, pageNumber, pageSize);
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        using var response = await SendWithRetryAsync(client, request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new EpiasApiException(
                $"{ep.Path} çağrısı başarısız (HTTP {(int)response.StatusCode}).",
                response.StatusCode, Truncate(raw));

        return ParsePage(raw);
    }

    /// <summary>
    /// Servisin tüm sayfalarını sırayla çeker. Sayfalama desteklemeyen
    /// servislerde tek sayfa döner.
    /// </summary>
    public async IAsyncEnumerable<EpiasPage> FetchAllPagesAsync(
        EndpointDescriptor ep,
        IReadOnlyDictionary<string, object?> parameters,
        string tgt,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!ep.SupportsPaging || ep.Method == "GET")
        {
            yield return await FetchPageAsync(ep, parameters, tgt, null, null, ct);
            yield break;
        }

        var pageNumber = 1;
        long fetched = 0;

        while (pageNumber <= _options.MaxPages)
        {
            var page = await FetchPageAsync(ep, parameters, tgt, pageNumber, _options.PageSize, ct);
            yield return page;

            fetched += page.Items.Count;
            if (page.Items.Count == 0) yield break;
            if (page.Total is { } total && fetched >= total) yield break;
            if (page.Items.Count < _options.PageSize) yield break;

            pageNumber++;
        }

        logger.LogWarning("{Path}: azami sayfa sınırına ({Max}) ulaşıldı.", ep.Path, _options.MaxPages);
    }

    // -----------------------------------------------------------------------

    private string BuildUrl(EndpointDescriptor ep, IReadOnlyDictionary<string, object?> parameters)
    {
        var path = ep.Path;

        foreach (var p in ep.Parameters.Where(x => x.In == "path"))
        {
            var value = parameters.TryGetValue(p.Name, out var v) ? FormatScalar(v) : "";
            path = path.Replace("{" + p.Name + "}", Uri.EscapeDataString(value));
        }

        var query = ep.Parameters
            .Where(x => x.In == "query" && parameters.TryGetValue(x.Name, out var v) && v is not null)
            .Select(x => $"{Uri.EscapeDataString(x.Name)}={Uri.EscapeDataString(FormatScalar(parameters[x.Name]))}")
            .ToList();

        var url = _options.BaseUrl.TrimEnd('/') + path;
        if (query.Count > 0) url += "?" + string.Join("&", query);
        return url;
    }

    private string BuildBody(
        EndpointDescriptor ep,
        IReadOnlyDictionary<string, object?> parameters,
        int? pageNumber,
        int? pageSize)
    {
        using var ms = new MemoryStream();
        using (var w = new Utf8JsonWriter(ms))
        {
            w.WriteStartObject();

            foreach (var p in ep.Parameters.Where(x => x.In == "body"))
            {
                if (!parameters.TryGetValue(p.Name, out var value) || value is null) continue;
                WriteParameter(w, p, value);
            }

            if (ep.SupportsPaging && pageNumber.HasValue)
            {
                w.WritePropertyName("page");
                w.WriteStartObject();
                w.WriteNumber("number", pageNumber.Value);
                w.WriteNumber("size", pageSize ?? _options.PageSize);
                w.WriteEndObject();
            }

            w.WriteEndObject();
        }

        return Encoding.UTF8.GetString(ms.ToArray());
    }

    private static void WriteParameter(Utf8JsonWriter w, ParameterDescriptor p, object value)
    {
        w.WritePropertyName(p.Name);

        switch (value)
        {
            case JsonElement je:
                je.WriteTo(w);
                return;
            case string s when p.Type is "integer" && long.TryParse(s, out var sl):
                w.WriteNumberValue(sl);
                return;
            case string s when p.Type is "number" && decimal.TryParse(s,
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var sd):
                w.WriteNumberValue(sd);
                return;
            case string s when p.Type is "boolean" && bool.TryParse(s, out var sb):
                w.WriteBooleanValue(sb);
                return;
            case string s:
                w.WriteStringValue(s);
                return;
            case bool b:
                w.WriteBooleanValue(b);
                return;
            case int i:
                w.WriteNumberValue(i);
                return;
            case long l:
                w.WriteNumberValue(l);
                return;
            case decimal d:
                w.WriteNumberValue(d);
                return;
            case double dbl:
                w.WriteNumberValue(dbl);
                return;
            case DateTimeOffset dto:
                w.WriteStringValue(FormatDate(dto));
                return;
            case DateTime dt:
                w.WriteStringValue(FormatDate(new DateTimeOffset(dt, TurkeyOffset)));
                return;
            case System.Collections.IEnumerable en and not string:
                w.WriteStartArray();
                foreach (var item in en)
                {
                    if (item is null) w.WriteNullValue();
                    else if (item is string si) w.WriteStringValue(si);
                    else if (item is int ii) w.WriteNumberValue(ii);
                    else if (item is long li) w.WriteNumberValue(li);
                    else w.WriteStringValue(item.ToString());
                }
                w.WriteEndArray();
                return;
            default:
                w.WriteStringValue(value.ToString());
                return;
        }
    }

    /// <summary>EPİAŞ tüm tarihleri Türkiye saatiyle (+03:00) bekler.</summary>
    public static readonly TimeSpan TurkeyOffset = TimeSpan.FromHours(3);

    public static string FormatDate(DateTimeOffset value) =>
        value.ToOffset(TurkeyOffset).ToString("yyyy-MM-ddTHH:mm:sszzz",
            System.Globalization.CultureInfo.InvariantCulture);

    private static string FormatScalar(object? value) => value switch
    {
        null => "",
        DateTimeOffset dto => FormatDate(dto),
        DateTime dt => FormatDate(new DateTimeOffset(dt, TurkeyOffset)),
        bool b => b ? "true" : "false",
        IFormattable f => f.ToString(null, System.Globalization.CultureInfo.InvariantCulture),
        _ => value.ToString() ?? ""
    };

    private static EpiasPage ParsePage(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        var items = new List<JsonElement>();
        long? total = null;
        int? number = null, size = null;

        if (root.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in root.EnumerateArray()) items.Add(el.Clone());
            return new EpiasPage(items, items.Count, null, null);
        }

        if (root.ValueKind != JsonValueKind.Object)
            return new EpiasPage(items, 0, null, null);

        var arrayProp = FindArrayProperty(root);
        if (arrayProp is { } arr)
            foreach (var el in arr.EnumerateArray())
                items.Add(el.Clone());
        else
            items.Add(root.Clone()); // Dizi yok: gövdenin kendisi tek kayıt.

        if (root.TryGetProperty("page", out var page) && page.ValueKind == JsonValueKind.Object)
        {
            if (page.TryGetProperty("total", out var t) && t.ValueKind == JsonValueKind.Number)
                total = t.GetInt64();
            if (page.TryGetProperty("number", out var n) && n.ValueKind == JsonValueKind.Number)
                number = n.GetInt32();
            if (page.TryGetProperty("size", out var s) && s.ValueKind == JsonValueKind.Number)
                size = s.GetInt32();
        }

        return new EpiasPage(items, total, number, size);
    }

    private static JsonElement? FindArrayProperty(JsonElement root)
    {
        if (root.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array)
            return items;

        foreach (var p in root.EnumerateObject())
            if (p.Value.ValueKind == JsonValueKind.Array)
                return p.Value;

        return null;
    }

    private async Task<HttpResponseMessage> SendWithRetryAsync(
        HttpClient client, HttpRequestMessage request, CancellationToken ct)
    {
        var attempt = 0;
        while (true)
        {
            attempt++;
            HttpResponseMessage response;
            try
            {
                using var clone = await CloneAsync(request);
                response = await client.SendAsync(clone, ct);
            }
            catch (HttpRequestException) when (attempt <= _options.MaxRetries)
            {
                await Task.Delay(BackoffFor(attempt), ct);
                continue;
            }

            var retryable = response.StatusCode is HttpStatusCode.TooManyRequests
                or HttpStatusCode.BadGateway
                or HttpStatusCode.ServiceUnavailable
                or HttpStatusCode.GatewayTimeout;

            if (!retryable || attempt > _options.MaxRetries) return response;

            var wait = response.Headers.RetryAfter?.Delta ?? BackoffFor(attempt);
            response.Dispose();
            logger.LogInformation("EPİAŞ {Status}; {Delay} sonra yeniden denenecek.",
                (int)response.StatusCode, wait);
            await Task.Delay(wait, ct);
        }
    }

    private static TimeSpan BackoffFor(int attempt) =>
        TimeSpan.FromMilliseconds(500 * Math.Pow(2, attempt - 1));

    private static async Task<HttpRequestMessage> CloneAsync(HttpRequestMessage source)
    {
        var clone = new HttpRequestMessage(source.Method, source.RequestUri);
        foreach (var h in source.Headers) clone.Headers.TryAddWithoutValidation(h.Key, h.Value);

        if (source.Content is not null)
        {
            var bytes = await source.Content.ReadAsByteArrayAsync();
            var content = new ByteArrayContent(bytes);
            foreach (var h in source.Content.Headers) content.Headers.TryAddWithoutValidation(h.Key, h.Value);
            clone.Content = content;
        }

        return clone;
    }

    private static string Truncate(string s) => s.Length <= 1000 ? s : s[..1000] + "…";
}
