using System.Text;
using System.Text.Json;
using Epias.Core.Storage;

namespace Epias.Core.Catalog;

/// <summary>
/// EPİAŞ Şeffaflık "transparency-electricity" Swagger 2.0 dokümanını okuyup
/// çalıştırılabilir endpoint kataloğuna çevirir. Tüm servisler (301 operasyon)
/// tek bir kaynaktan türetildiği için yeni sürümde spec dosyasını değiştirmek yeterlidir.
/// </summary>
public sealed class SwaggerCatalogLoader
{
    private readonly JsonElement _root;
    private readonly JsonElement _definitions;

    private SwaggerCatalogLoader(JsonDocument doc)
    {
        _root = doc.RootElement;
        _definitions = _root.TryGetProperty("definitions", out var d) ? d : default;
    }

    public static IReadOnlyList<EndpointDescriptor> LoadFromFile(string path)
    {
        using var stream = File.OpenRead(path);
        using var doc = JsonDocument.Parse(stream);
        return new SwaggerCatalogLoader(doc).Build();
    }

    public static IReadOnlyList<EndpointDescriptor> LoadFromJson(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return new SwaggerCatalogLoader(doc).Build();
    }

    public string BasePath =>
        _root.TryGetProperty("basePath", out var b) ? b.GetString() ?? "" : "";

    private List<EndpointDescriptor> Build()
    {
        var list = new List<EndpointDescriptor>();
        if (!_root.TryGetProperty("paths", out var paths)) return list;

        var usedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var pathProp in paths.EnumerateObject())
        {
            foreach (var opProp in pathProp.Value.EnumerateObject())
            {
                var method = opProp.Name.ToUpperInvariant();
                if (method is not ("GET" or "POST")) continue;

                var op = opProp.Value;
                var key = MakeUniqueKey(pathProp.Name, usedKeys);
                var isExport = pathProp.Name.Contains("/export", StringComparison.OrdinalIgnoreCase);

                list.Add(new EndpointDescriptor
                {
                    Key = key,
                    Path = pathProp.Name,
                    Method = method,
                    Tag = FirstTag(op),
                    Title = GetString(op, "summary") ?? pathProp.Name,
                    Description = GetString(op, "description"),
                    TableName = key,
                    IsExport = isExport,
                    Parameters = ReadParameters(op),
                    SupportsPaging = HasPagingParameter(op),
                    Fields = isExport ? new List<FieldDescriptor>() : ReadFields(op)
                });
            }
        }

        return list;
    }

    // -- anahtar üretimi ----------------------------------------------------

    /// <summary><c>/v1/markets/dam/data/mcp</c> → <c>markets_dam_data_mcp</c>.</summary>
    public static string MakeKey(string path)
    {
        var trimmed = path.TrimStart('/');
        if (trimmed.StartsWith("v1/", StringComparison.OrdinalIgnoreCase)) trimmed = trimmed[3..];
        if (trimmed.StartsWith("v2/", StringComparison.OrdinalIgnoreCase)) trimmed = "v2_" + trimmed[3..];

        var sb = new StringBuilder(trimmed.Length);
        var lastUnderscore = false;
        foreach (var ch in trimmed)
        {
            if (char.IsLetterOrDigit(ch))
            {
                sb.Append(char.ToLowerInvariant(ch));
                lastUnderscore = false;
            }
            else if (!lastUnderscore)
            {
                sb.Append('_');
                lastUnderscore = true;
            }
        }

        var key = sb.ToString().Trim('_');
        if (key.Length > 110) key = key[..110].Trim('_');
        return key.Length == 0 ? "endpoint" : key;
    }

    private static string MakeUniqueKey(string path, HashSet<string> used)
    {
        var baseKey = MakeKey(path);
        var key = baseKey;
        var i = 2;
        while (!used.Add(key)) key = $"{baseKey}_{i++}";
        return key;
    }

    private static string FirstTag(JsonElement op) =>
        op.TryGetProperty("tags", out var t) && t.ValueKind == JsonValueKind.Array && t.GetArrayLength() > 0
            ? t[0].GetString() ?? "diger"
            : "diger";

    /// <summary>
    /// İstek gövdesinde sayfalama nesnesi var mı. <c>page</c> kullanıcıya sorulmayan
    /// bir altyapı parametresi olduğu için ayrıca tespit edilir.
    /// </summary>
    private bool HasPagingParameter(JsonElement op)
    {
        if (!op.TryGetProperty("parameters", out var ps) || ps.ValueKind != JsonValueKind.Array)
            return false;

        foreach (var p in ps.EnumerateArray())
        {
            if (GetString(p, "in") != "body") continue;
            if (!p.TryGetProperty("schema", out var schema)) continue;

            var resolved = Resolve(schema);
            if (resolved.ValueKind == JsonValueKind.Object &&
                resolved.TryGetProperty("properties", out var props) &&
                props.TryGetProperty("page", out _))
                return true;
        }

        return false;
    }

    // -- parametreler -------------------------------------------------------

    private List<ParameterDescriptor> ReadParameters(JsonElement op)
    {
        var result = new List<ParameterDescriptor>();
        if (!op.TryGetProperty("parameters", out var ps) || ps.ValueKind != JsonValueKind.Array)
            return result;

        foreach (var p in ps.EnumerateArray())
        {
            var location = GetString(p, "in") ?? "query";

            // TGT header'ı istemci tarafından otomatik eklenir, kullanıcıdan istenmez.
            if (location == "header") continue;

            if (location == "body")
            {
                if (!p.TryGetProperty("schema", out var schema)) continue;
                var resolved = Resolve(schema);
                if (resolved.ValueKind != JsonValueKind.Object) continue;
                if (!resolved.TryGetProperty("properties", out var props)) continue;

                var required = ReadRequiredSet(resolved);

                foreach (var prop in props.EnumerateObject())
                {
                    // Sayfalama nesnesi altyapı tarafından yönetilir.
                    if (prop.Name.Equals("page", StringComparison.OrdinalIgnoreCase)) continue;

                    var pv = Resolve(prop.Value);
                    result.Add(new ParameterDescriptor
                    {
                        Name = prop.Name,
                        Type = GetString(pv, "type") ?? "string",
                        Format = GetString(pv, "format"),
                        Required = required.Contains(prop.Name),
                        Description = GetString(prop.Value, "description") ?? GetString(pv, "description"),
                        Example = GetExample(pv),
                        In = "body",
                        EnumValues = ReadEnum(pv)
                    });
                }
            }
            else
            {
                result.Add(new ParameterDescriptor
                {
                    Name = GetString(p, "name") ?? "param",
                    Type = GetString(p, "type") ?? "string",
                    Format = GetString(p, "format"),
                    Required = p.TryGetProperty("required", out var r) && r.ValueKind == JsonValueKind.True,
                    Description = GetString(p, "description"),
                    Example = GetExample(p),
                    In = location,
                    EnumValues = ReadEnum(p)
                });
            }
        }

        return result;
    }

    // -- yanıt alanları -----------------------------------------------------

    /// <summary>
    /// 200 yanıt şemasını çözer. EPİAŞ yanıtları neredeyse tamamen
    /// <c>{ items: [...], page, statistics }</c> kalıbındadır; kalıba uymayan
    /// düz nesneler tek satırlık kayıt olarak ele alınır.
    /// </summary>
    private List<FieldDescriptor> ReadFields(JsonElement op)
    {
        var fields = new List<FieldDescriptor>();
        if (!op.TryGetProperty("responses", out var responses)) return fields;
        if (!responses.TryGetProperty("200", out var ok)) return fields;
        if (!ok.TryGetProperty("schema", out var schema)) return fields;

        var body = Resolve(schema);
        if (body.ValueKind != JsonValueKind.Object) return fields;

        JsonElement itemSchema;
        if (body.TryGetProperty("properties", out var bodyProps) &&
            TryFindItemsArray(bodyProps, out var arr))
        {
            itemSchema = Resolve(arr);
        }
        else
        {
            itemSchema = body;
        }

        if (itemSchema.ValueKind != JsonValueKind.Object) return fields;
        if (!itemSchema.TryGetProperty("properties", out var itemProps)) return fields;

        var usedColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in itemProps.EnumerateObject())
        {
            var pv = Resolve(prop.Value);
            var type = GetString(pv, "type") ?? (pv.TryGetProperty("properties", out _) ? "object" : "string");

            var column = SqlIdentifier.ToColumn(prop.Name);
            var candidate = column;
            var i = 2;
            while (!usedColumns.Add(candidate)) candidate = $"{column}_{i++}";

            fields.Add(new FieldDescriptor
            {
                Name = prop.Name,
                ColumnName = candidate,
                JsonType = type,
                Format = GetString(pv, "format"),
                Description = GetString(prop.Value, "description") ?? GetString(pv, "description")
            });
        }

        return fields;
    }

    private static bool TryFindItemsArray(JsonElement properties, out JsonElement itemsSchema)
    {
        itemsSchema = default;

        // Öncelik: "items" adlı dizi.
        if (properties.TryGetProperty("items", out var items) &&
            GetString(items, "type") == "array" &&
            items.TryGetProperty("items", out var inner))
        {
            itemsSchema = inner;
            return true;
        }

        // Yedek: gövdedeki ilk dizi alanı (ör. "response").
        foreach (var p in properties.EnumerateObject())
        {
            if (GetString(p.Value, "type") == "array" && p.Value.TryGetProperty("items", out var i2))
            {
                itemsSchema = i2;
                return true;
            }
        }

        return false;
    }

    // -- yardımcılar --------------------------------------------------------

    private JsonElement Resolve(JsonElement schema, int depth = 0)
    {
        if (depth > 12 || schema.ValueKind != JsonValueKind.Object) return schema;

        if (schema.TryGetProperty("$ref", out var refEl) && refEl.GetString() is { } refPath)
        {
            const string prefix = "#/definitions/";
            if (refPath.StartsWith(prefix, StringComparison.Ordinal) &&
                _definitions.ValueKind == JsonValueKind.Object &&
                _definitions.TryGetProperty(refPath[prefix.Length..], out var def))
            {
                return Resolve(def, depth + 1);
            }
        }

        return schema;
    }

    private static HashSet<string> ReadRequiredSet(JsonElement schema)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (schema.TryGetProperty("required", out var r) && r.ValueKind == JsonValueKind.Array)
            foreach (var item in r.EnumerateArray())
                if (item.GetString() is { } s) set.Add(s);
        return set;
    }

    private static List<string>? ReadEnum(JsonElement el)
    {
        if (!el.TryGetProperty("enum", out var e) || e.ValueKind != JsonValueKind.Array) return null;
        var values = new List<string>();
        foreach (var item in e.EnumerateArray())
            values.Add(item.ValueKind == JsonValueKind.String ? item.GetString() ?? "" : item.ToString());
        return values.Count > 0 ? values : null;
    }

    private static string? GetString(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object &&
        el.TryGetProperty(name, out var v) &&
        v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static string? GetExample(JsonElement el)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty("example", out var v)) return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
    }
}

