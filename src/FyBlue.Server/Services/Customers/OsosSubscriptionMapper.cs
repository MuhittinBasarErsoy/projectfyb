using System.Globalization;
using System.Text.Json;
using FyBlue.Server.Data;

namespace FyBlue.Server.Services.Customers;

/// <summary>
/// OSOS GetCustomerPortalSubscriptions kaydını osos_subscriptions satırına eşler. Yanıt şeması belgeli değil:
/// her kolon için kolon adının PascalCase hâli ve bilinen Türkçe/alternatif adlar (büyük/küçük harf duyarsız) denenir.
/// Ham kayıt her zaman customer_fields_json'a yazılır; eşlenemeyen alanlar kaybolmaz.
/// </summary>
public static class OsosSubscriptionMapper
{
    private static readonly Dictionary<string, string[]> Aliases = new()
    {
        [nameof(OsosSubscription.SourceTitle)] = ["Title", "Unvan", "MusteriUnvan", "AboneAdi", "Name"],
        [nameof(OsosSubscription.SourceAddress)] = ["Address", "Adres"],
        [nameof(OsosSubscription.MeterSerial)] = ["MeterSerialNo", "MeterSerialNumber", "SerialNumber", "SayacSeriNo", "SeriNo"],
        [nameof(OsosSubscription.MeterBrand)] = ["Brand", "MeterMark", "Mark", "Marka", "SayacMarka"],
        [nameof(OsosSubscription.MeterModel)] = ["Model", "SayacModel"],
        [nameof(OsosSubscription.Multiplier)] = ["Carpan"],
        [nameof(OsosSubscription.LastIndexAt)] = ["LastIndexDate", "LastEndexDate", "LastEndexAt"],
        [nameof(OsosSubscription.LastProfileAt)] = ["LastProfileDate", "LastLoadProfileDate"],
        [nameof(OsosSubscription.ScheduleCode)] = ["Schedule", "TariffCode", "TarifeKodu", "Tarife"],
        [nameof(OsosSubscription.InstalledPowerKw)] = ["InstalledPower", "KuruluGuc"],
        [nameof(OsosSubscription.ContractPowerKw)] = ["ContractPower", "SozlesmeGucu"],
        [nameof(OsosSubscription.GroupInfo)] = ["Group", "GroupName", "Grup"],
        [nameof(OsosSubscription.EtsoCode)] = ["Etso", "EtsoKodu"],
        [nameof(OsosSubscription.MeterPointAssignedAt)] = ["MeterPointAssignedDate", "MeterPointAssignDate"],
        [nameof(OsosSubscription.MultiplierChangedAt)] = ["MultiplierChangeDate", "MultiplierChangedDate"],
    };

    public static void Apply(JsonElement src, OsosSubscription target)
    {
        target.IdentifierValue = Str(src, nameof(target.IdentifierValue));
        target.IdentifierValueSec = Str(src, nameof(target.IdentifierValueSec));
        target.DefinitionType = Str(src, nameof(target.DefinitionType));
        target.SourceTitle = Str(src, nameof(target.SourceTitle));
        target.SourceAddress = Str(src, nameof(target.SourceAddress));
        target.MeterSerial = Str(src, nameof(target.MeterSerial));
        target.MeterBrand = Str(src, nameof(target.MeterBrand));
        target.MeterModel = Str(src, nameof(target.MeterModel));
        target.Multiplier = Dec(src, nameof(target.Multiplier));
        target.LastIndexAt = Date(src, nameof(target.LastIndexAt));
        target.LastProfileAt = Date(src, nameof(target.LastProfileAt));
        target.ScheduleCode = Str(src, nameof(target.ScheduleCode));
        target.InstalledPowerKw = Dec(src, nameof(target.InstalledPowerKw));
        target.ContractPowerKw = Dec(src, nameof(target.ContractPowerKw));
        target.GroupInfo = Str(src, nameof(target.GroupInfo));
        target.EtsoCode = Str(src, nameof(target.EtsoCode));
        target.MeterPointAssignedAt = Date(src, nameof(target.MeterPointAssignedAt));
        target.MultiplierChangedAt = Date(src, nameof(target.MultiplierChangedAt));
        target.MinCapacitiveRate = Dec(src, nameof(target.MinCapacitiveRate));
        target.MinInductiveRate = Dec(src, nameof(target.MinInductiveRate));
        target.CustomerFieldsJson = src.GetRawText();
    }

    /// <summary>
    /// Eşleşmiş aboneliklerden tesisatın kaynak (source_*) alanlarını günceller. manual_* alanlarına
    /// asla dokunmaz; danışman düzeltmeleri senkronizasyonda korunur. Birden çok abonelik varsa ilki esas alınır.
    /// </summary>
    public static void ApplySourceToInstallation(Installation inst, IEnumerable<OsosSubscription> linked)
    {
        var first = linked.Where(s => s.IsActive).OrderBy(s => s.SubscriptionSerno).FirstOrDefault();
        if (first is null) return;
        inst.SourceAddress = first.SourceAddress ?? inst.SourceAddress;
        inst.SourceInstalledPowerKw = first.InstalledPowerKw ?? inst.SourceInstalledPowerKw;
        inst.SourceContractPowerKw = first.ContractPowerKw ?? inst.SourceContractPowerKw;
    }

    private static JsonElement? Find(JsonElement obj, string property)
    {
        var names = Aliases.TryGetValue(property, out var a) ? a.Prepend(property) : [property];
        foreach (var name in names)
            foreach (var p in obj.EnumerateObject())
                if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase) && p.Value.ValueKind != JsonValueKind.Null)
                    return p.Value;
        return null;
    }

    private static string? Str(JsonElement obj, string property)
    {
        if (Find(obj, property) is not { } v) return null;
        var s = v.ValueKind == JsonValueKind.String ? v.GetString() : v.GetRawText();
        s = s?.Trim();
        return string.IsNullOrEmpty(s) ? null : s.Length > 300 ? s[..300] : s;
    }

    private static decimal? Dec(JsonElement obj, string property) => Find(obj, property) switch
    {
        { ValueKind: JsonValueKind.Number } v when v.TryGetDecimal(out var d) => d,
        { ValueKind: JsonValueKind.String } v when decimal.TryParse(v.GetString()?.Replace(',', '.'),
            NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => d,
        _ => null
    };

    /// <summary>OSOS tarihleri yyyyMMddHHmmss (sayı) veya ISO metin olabilir.</summary>
    internal static DateTime? Date(JsonElement obj, string property)
    {
        if (Find(obj, property) is not { } v) return null;
        string? raw = v.ValueKind == JsonValueKind.Number ? v.GetRawText() : v.GetString();
        if (string.IsNullOrWhiteSpace(raw) || raw == "0") return null;
        if (raw.Length == 14 && DateTime.TryParseExact(raw, "yyyyMMddHHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
        if (raw.Length == 8 && DateTime.TryParseExact(raw, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d)) return d;
        return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out d) && d.Year > 1900 ? d : null;
    }
}
