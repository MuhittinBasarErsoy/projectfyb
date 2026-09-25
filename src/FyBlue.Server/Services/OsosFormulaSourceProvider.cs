using System.Globalization;
using System.Text.RegularExpressions;
using Epias.Core.Formulas;
using Microsoft.Data.SqlClient;

namespace FyBlue.Server.Services;

/// <summary>
/// OSOS sorgu sonuçlarını (<see cref="ResultMaterializer"/>'ın yazdığı <c>dbo.Rows_*</c>
/// tabloları) formül kaynağı olarak sunar. Bu tabloların kolonları çalışma anında
/// oluşur ve hepsi metindir; hangi kolonun zaman, hangisinin sayı olduğu son
/// satırlardan örneklenerek bulunur.
/// </summary>
public sealed class OsosFormulaSourceProvider(
    IConfiguration configuration,
    ILogger<OsosFormulaSourceProvider> logger) : IFormulaSourceProvider
{
    private const string Schema = "dbo";
    private const string TablePrefix = "Rows_";
    private const int SampleSize = 200;
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(1);

    /// <summary>ResultMaterializer'ın her tabloya eklediği sabit kolonlar.</summary>
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
        { "Id", "SearchHistoryId", "AppUserId", "Serno", "CapturedAt" };

    private static readonly Dictionary<string, string> ScreenTitles = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Consumption"] = "Tüketim",
        ["Endex"] = "Endeks",
        ["Profiles"] = "Akım/Gerilim/Cosφ",
        ["Subscriptions"] = "Aboneler",
        ["Dashboard"] = "Dashboard",
        ["Weather"] = "Hava durumu (Open-Meteo)"
    };

    private static readonly Dictionary<string, string> FieldLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["temperature_2m"] = "Sıcaklık (°C)",
        ["relative_humidity_2m"] = "Bağıl nem (%)",
        ["dew_point_2m"] = "Çiy noktası (°C)",
        ["apparent_temperature"] = "Hissedilen sıcaklık (°C)",
        ["precipitation"] = "Yağış (mm)",
        ["rain"] = "Yağmur (mm)",
        ["snowfall"] = "Kar yağışı (cm)",
        ["snow_depth"] = "Kar derinliği (m)",
        ["weather_code"] = "Hava kodu",
        ["pressure_msl"] = "Deniz seviyesi basıncı (hPa)",
        ["surface_pressure"] = "Yüzey basıncı (hPa)",
        ["cloud_cover"] = "Bulutluluk (%)",
        ["cloud_cover_low"] = "Alçak bulutluluk (%)",
        ["cloud_cover_mid"] = "Orta bulutluluk (%)",
        ["cloud_cover_high"] = "Yüksek bulutluluk (%)",
        ["et0_fao_evapotranspiration"] = "Evapotranspirasyon (mm)",
        ["vapour_pressure_deficit"] = "Buhar basıncı açığı (kPa)",
        ["wind_speed_10m"] = "Rüzgar hızı 10 m (km/sa)",
        ["wind_speed_100m"] = "Rüzgar hızı 100 m (km/sa)",
        ["wind_direction_10m"] = "Rüzgar yönü 10 m (°)",
        ["wind_direction_100m"] = "Rüzgar yönü 100 m (°)",
        ["wind_gusts_10m"] = "Rüzgar hamlesi (km/sa)",
        ["soil_temperature_0_to_7cm"] = "Toprak sıcaklığı 0–7 cm (°C)",
        ["soil_temperature_7_to_28cm"] = "Toprak sıcaklığı 7–28 cm (°C)",
        ["soil_temperature_28_to_100cm"] = "Toprak sıcaklığı 28–100 cm (°C)",
        ["soil_temperature_100_to_255cm"] = "Toprak sıcaklığı 100–255 cm (°C)",
        ["soil_moisture_0_to_7cm"] = "Toprak nemi 0–7 cm (m³/m³)",
        ["soil_moisture_7_to_28cm"] = "Toprak nemi 7–28 cm (m³/m³)",
        ["soil_moisture_28_to_100cm"] = "Toprak nemi 28–100 cm (m³/m³)",
        ["soil_moisture_100_to_255cm"] = "Toprak nemi 100–255 cm (m³/m³)",
        ["shortwave_radiation"] = "Güneş ışınımı (W/m²)",
        ["direct_radiation"] = "Direkt ışınım (W/m²)",
        ["diffuse_radiation"] = "Yaygın ışınım (W/m²)",
        ["direct_normal_irradiance"] = "Direkt normal ışınım (W/m²)",
        ["global_tilted_irradiance"] = "Eğik yüzey ışınımı (W/m²)"
    };

    private static readonly string[] TimestampNameHints = ["time", "date", "tarih", "zaman", "period", "donem"];

    private static readonly string[] TimestampFormats =
    [
        "dd.MM.yyyy HH:mm:ss", "dd.MM.yyyy HH:mm", "dd.MM.yyyy",
        "dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "dd/MM/yyyy"
    ];

    private readonly string _connectionString = configuration.GetConnectionString("Default") ?? "";
    private readonly SemaphoreSlim _lock = new(1, 1);
    private IReadOnlyList<ExternalFormulaSource> _sources = [];
    private DateTime _loadedAt = DateTime.MinValue;

    public IReadOnlyList<ExternalFormulaSource> Sources => _sources;

    public async Task RefreshAsync(bool force = false, CancellationToken ct = default)
    {
        if (!force && DateTime.UtcNow - _loadedAt < CacheFor) return;

        await _lock.WaitAsync(ct);
        try
        {
            if (!force && DateTime.UtcNow - _loadedAt < CacheFor) return;
            _sources = await DiscoverAsync(ct);
            _loadedAt = DateTime.UtcNow;
        }
        catch (SqlException ex)
        {
            // OSOS kaynakları olmadan da EPİAŞ formülleri çalışmalı.
            logger.LogWarning(ex, "OSOS formül kaynakları okunamadı.");
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>Kaynak başına, verilen kullanıcıya ait satır sayısı.</summary>
    public async Task<Dictionary<string, long>> GetRowCountsAsync(string? appUserId, CancellationToken ct)
    {
        var result = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        if (appUserId is null || _sources.Count == 0) return result;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        foreach (var s in _sources)
        {
            await using var cmd = new SqlCommand(
                $"SELECT COUNT_BIG(*) FROM [{Schema}].{Quote(s.Table)} WHERE [AppUserId] = @u", conn);
            cmd.Parameters.AddWithValue("@u", appUserId);
            result[s.Name] = (long)(await cmd.ExecuteScalarAsync(ct) ?? 0L);
        }
        return result;
    }

    // -----------------------------------------------------------------------

    private async Task<IReadOnlyList<ExternalFormulaSource>> DiscoverAsync(CancellationToken ct)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);

        var tables = new List<string>();
        await using (var cmd = new SqlCommand(
            "SELECT t.name FROM sys.tables t WHERE SCHEMA_NAME(t.schema_id) = @s AND t.name LIKE @p ORDER BY t.name", conn))
        {
            cmd.Parameters.AddWithValue("@s", Schema);
            cmd.Parameters.AddWithValue("@p", TablePrefix.Replace("_", "[_]") + "%");
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) tables.Add(reader.GetString(0));
        }

        var sources = new List<ExternalFormulaSource>();
        foreach (var table in tables)
        {
            var source = await DescribeAsync(conn, table, ct);
            if (source is not null) sources.Add(source);
        }
        return sources;
    }

    /// <summary>Son satırları okuyup zaman ve sayı kolonlarını belirler.</summary>
    private static async Task<ExternalFormulaSource?> DescribeAsync(SqlConnection conn, string table, CancellationToken ct)
    {
        var samples = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        long rowCount;

        await using (var cmd = new SqlCommand($"SELECT TOP ({SampleSize}) * FROM [{Schema}].{Quote(table)} ORDER BY [Id] DESC", conn))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            var columns = Enumerable.Range(0, reader.FieldCount)
                .Select(i => (Index: i, Name: reader.GetName(i)))
                .Where(c => !Reserved.Contains(c.Name))
                .ToList();
            foreach (var c in columns) samples[c.Name] = new List<string>();

            while (await reader.ReadAsync(ct))
                foreach (var (index, name) in columns)
                {
                    if (reader.IsDBNull(index)) continue;
                    var value = Convert.ToString(reader.GetValue(index), CultureInfo.InvariantCulture)?.Trim();
                    if (!string.IsNullOrEmpty(value)) samples[name].Add(value);
                }
        }

        await using (var cmd = new SqlCommand($"SELECT COUNT_BIG(*) FROM [{Schema}].{Quote(table)}", conn))
            rowCount = (long)(await cmd.ExecuteScalarAsync(ct) ?? 0L);

        var timestampColumn = samples
            .Where(kv => kv.Value.Count > 0 && kv.Value.All(v => TryParseTimestamp(v, out _)))
            .Select(kv => kv.Key)
            .OrderByDescending(name => TimestampNameHints.Any(h => name.Contains(h, StringComparison.OrdinalIgnoreCase)))
            .FirstOrDefault();

        var hasHour = timestampColumn is not null && samples[timestampColumn]
            .Any(v => TryParseTimestamp(v, out var ts) && ts.TimeOfDay != TimeSpan.Zero);

        var fields = samples
            .Where(kv => kv.Key != timestampColumn && kv.Value.Count > 0 && kv.Value.All(IsNumber) && !IsIdentifier(kv.Key))
            .Select(kv => new ExternalFormulaField(kv.Key, FieldLabels.GetValueOrDefault(kv.Key) ?? Humanize(kv.Key)))
            .ToList();

        if (fields.Count == 0) return null;

        var screen = table[TablePrefix.Length..];
        return new ExternalFormulaSource
        {
            Name = "osos_" + Regex.Replace(screen.ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_'),
            Title = ScreenTitles.GetValueOrDefault(screen) ?? Humanize(screen),
            Tag = "OSOS",
            Schema = Schema,
            Table = table,
            TimestampColumn = timestampColumn,
            HasHour = hasHour,
            Fields = fields,
            OwnerColumn = "AppUserId",
            VersionColumn = "SearchHistoryId",
            VersionPartitionColumns = ["Serno"],
            RowCount = rowCount
        };
    }

    /// <summary>
    /// SQL tarafındaki çözümlemeyle (FormulaCompiler.ParseTimestamp) aynı biçimleri kabul eder:
    /// ISO 8601 (saat dilimli ya da dilimsiz) ve gg.aa.yyyy / gg/aa/yyyy.
    /// </summary>
    private static bool TryParseTimestamp(string value, out DateTime result)
    {
        result = default;
        // Yalnızca saat ("13:00") ya da düz sayı zaman damgası sayılmaz.
        if (value.Length < 8 || !Regex.IsMatch(value, @"\d{4}")) return false;

        if (Regex.IsMatch(value, @"^\d{4}-\d{2}-\d{2}") &&
            DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
        {
            result = dto.DateTime;
            return true;
        }

        return DateTime.TryParseExact(value, TimestampFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out result);
    }

    private static bool IsNumber(string value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out _);

    /// <summary>Sayısal görünen ama ölçüm olmayan kimlik kolonları (Serno, MeterId…).</summary>
    private static bool IsIdentifier(string name) =>
        name.EndsWith("Serno", StringComparison.OrdinalIgnoreCase) ||
        name.EndsWith("Id", StringComparison.Ordinal) ||
        name.EndsWith("ID", StringComparison.Ordinal) ||
        name.EndsWith("_id", StringComparison.OrdinalIgnoreCase);

    private static string Humanize(string name)
    {
        var spaced = Regex.Replace(name.Replace('_', ' '), "(?<=[a-z0-9])(?=[A-Z])", " ").Trim();
        return spaced.Length == 0 ? name : char.ToUpperInvariant(spaced[0]) + spaced[1..].ToLowerInvariant();
    }

    private static string Quote(string identifier) => "[" + identifier.Replace("]", "]]") + "]";
}
