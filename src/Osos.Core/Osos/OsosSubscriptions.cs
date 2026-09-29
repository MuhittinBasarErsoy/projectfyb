using System.Text.Json;

namespace Osos.Core.Osos;

/// <summary>
/// GetCustomerPortalSubscriptions yanıtını çözer. Yanıtın şeması belgeli değil; alanlar ada göre
/// (büyük/küçük harf duyarsız) aranır. İstemcideki subscriptions.ts ile aynı kurallar.
/// </summary>
public static class OsosSubscriptions
{
    /// <summary>Yanıttaki ilk obje dizisini bulur (esb sarmalayıcısının içinde olabilir).</summary>
    public static JsonElement? FindFirstObjectArray(JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Array:
                foreach (var i in el.EnumerateArray())
                    if (i.ValueKind == JsonValueKind.Object) return el;
                return null;
            case JsonValueKind.Object:
                foreach (var p in el.EnumerateObject())
                {
                    var r = FindFirstObjectArray(p.Value);
                    if (r is not null) return r;
                }
                return null;
            default: return null;
        }
    }

    private static readonly string[] ForeignSernoPrefixes = ["customer", "owner", "parent", "user", "company", "distribution"];

    /// <summary>Aboneliğin kendi Serno'su (CustomerSerno/OwnerSerno gibi sahip alanları atlanır); yoksa 0.</summary>
    public static long ExtractSerno(JsonElement obj)
    {
        foreach (var name in new[] { "SubscriptionSerno", "Serno" })
            if (TryGetLong(obj, name, out var s)) return s;
        foreach (var p in obj.EnumerateObject())
        {
            var k = p.Name.ToLowerInvariant();
            if (k.Contains("serno") && !ForeignSernoPrefixes.Any(k.StartsWith) && ToLong(p.Value) is long v) return v;
        }
        return TryGetLong(obj, "Id", out var id) ? id : 0;
    }

    /// <summary>Yanıttaki tüm abonelik Serno'ları (0 ve tekrarlar hariç).</summary>
    public static long[] ExtractSernos(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var arr = FindFirstObjectArray(doc.RootElement);
        if (arr is null) return [];
        return arr.Value.EnumerateArray()
            .Where(i => i.ValueKind == JsonValueKind.Object)
            .Select(ExtractSerno)
            .Where(s => s > 0)
            .Distinct()
            .ToArray();
    }

    private static bool TryGetLong(JsonElement obj, string name, out long value)
    {
        foreach (var p in obj.EnumerateObject())
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase) && ToLong(p.Value) is long v)
            {
                value = v;
                return true;
            }
        value = 0;
        return false;
    }

    private static long? ToLong(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.Number when v.TryGetInt64(out var n) => n,
        JsonValueKind.String when long.TryParse(v.GetString(), out var n) => n,
        _ => null
    };
}
