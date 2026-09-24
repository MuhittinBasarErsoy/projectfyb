using System.Text.Json.Serialization;

namespace Epias.Contracts;

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

public class EndpointSummaryDto
{
    public string Key { get; set; } = "";
    public string Path { get; set; } = "";
    public string Method { get; set; } = "";
    public string Tag { get; set; } = "";
    public string Title { get; set; } = "";
    public string TableName { get; set; } = "";
    public bool IsExport { get; set; }
    public bool SupportsDateRange { get; set; }
    public bool RequiresParameters { get; set; }
    public long RowCount { get; set; }
    public DateTimeOffset? LastSyncedAt { get; set; }
}

public sealed class EndpointDetailDto : EndpointSummaryDto
{
    public string? Description { get; set; }
    public List<ParameterDto> Parameters { get; set; } = new();
    public List<ColumnDto> Columns { get; set; } = new();
}

public sealed class ParameterDto
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public bool Required { get; set; }
    public string? Description { get; set; }
    public string? Example { get; set; }
    /// <summary>body / query / path.</summary>
    public string In { get; set; } = "body";
    public List<string>? EnumValues { get; set; }
}

public sealed class ColumnDto
{
    public string Name { get; set; } = "";
    public string SqlType { get; set; } = "";
    public string ClrType { get; set; } = "";
    public bool IsNumeric { get; set; }
    public bool IsDate { get; set; }
    public string? Description { get; set; }
}

// ---------------------------------------------------------------------------
// Senkronizasyon
// ---------------------------------------------------------------------------

public sealed class SyncRequest
{
    public string EndpointKey { get; set; } = "";

    /// <summary>Endpoint gövdesine gönderilecek parametreler (startDate, endDate, region vb.).</summary>
    public Dictionary<string, object?> Parameters { get; set; } = new();

    /// <summary>Tarih aralığı verilirse gün/ay bazlı parçalanarak çekilir.</summary>
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }

    /// <summary>Uzun aralıkları parçalamak için gün sayısı (0 = parçalama yok).</summary>
    public int ChunkDays { get; set; } = 0;
}

public sealed class SyncResultDto
{
    public string EndpointKey { get; set; } = "";
    public string TableName { get; set; } = "";
    public int Fetched { get; set; }
    public int Inserted { get; set; }
    public int Duplicates { get; set; }
    public int Requests { get; set; }
    public long ElapsedMs { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}

public sealed class BulkSyncRequest
{
    public List<string> EndpointKeys { get; set; } = new();
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public int ChunkDays { get; set; } = 0;
    public int MaxParallel { get; set; } = 4;
    /// <summary>Boş bırakılırsa tüm veri (export olmayan) endpointleri.</summary>
    public string? TagFilter { get; set; }
}

// ---------------------------------------------------------------------------
// Veri sorgulama
// ---------------------------------------------------------------------------

public sealed class TableQueryRequest
{
    public string EndpointKey { get; set; } = "";
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
    public string? OrderBy { get; set; }
    public bool Descending { get; set; }
}

public sealed class TableQueryResult
{
    public List<string> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public long Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

// ---------------------------------------------------------------------------
// Formüller
// ---------------------------------------------------------------------------

public sealed class FormulaDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }

    /// <summary>
    /// Örn: <c>[markets_dam_data_mcp.price] * [consumption_data_realtime.consumption] / 5</c>
    /// </summary>
    public string Expression { get; set; } = "";

    /// <summary>
    /// Satırların hizalanacağı anahtar. <c>DateHour</c> (tarih+saat), <c>Date</c> (gün) veya <c>None</c>.
    /// </summary>
    public string AlignmentMode { get; set; } = "DateHour";

    /// <summary>Sonuçların yazılacağı tablo adı (boş ise sadece hesaplanır, kaydedilmez).</summary>
    public string? OutputTable { get; set; }

    public DateTimeOffset? DefaultFrom { get; set; }
    public DateTimeOffset? DefaultTo { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public sealed class FormulaValidationResult
{
    public bool IsValid { get; set; }
    public string? Error { get; set; }
    public List<string> ReferencedTables { get; set; } = new();
    public List<string> ReferencedColumns { get; set; } = new();
    public string? GeneratedSql { get; set; }
}

public sealed class FormulaRunRequest
{
    public int FormulaId { get; set; }
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
    /// <summary>true ise sonuçlar OutputTable'a (tekrarsız) yazılır.</summary>
    public bool Persist { get; set; }
    public int MaxRows { get; set; } = 5000;
}

public sealed class FormulaRunResult
{
    public int FormulaId { get; set; }
    public string Name { get; set; } = "";
    public List<FormulaRowDto> Rows { get; set; } = new();
    public int Persisted { get; set; }
    public long ElapsedMs { get; set; }
    public string? Sql { get; set; }
    public string? Error { get; set; }
}

public sealed class FormulaRowDto
{
    public DateTimeOffset? Date { get; set; }
    public string? Hour { get; set; }
    public decimal? Value { get; set; }
}

/// <summary>Ad-hoc (kaydedilmemiş) formül denemesi için.</summary>
public sealed class FormulaPreviewRequest
{
    public string Expression { get; set; } = "";
    public string AlignmentMode { get; set; } = "DateHour";
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
    public int MaxRows { get; set; } = 200;
}

// ---------------------------------------------------------------------------
// Ortak
// ---------------------------------------------------------------------------

public sealed class ApiError
{
    public string Message { get; set; } = "";
    public string? Detail { get; set; }
}

[JsonSerializable(typeof(List<EndpointSummaryDto>))]
[JsonSerializable(typeof(EndpointDetailDto))]
[JsonSerializable(typeof(SyncRequest))]
[JsonSerializable(typeof(SyncResultDto))]
[JsonSerializable(typeof(List<SyncResultDto>))]
[JsonSerializable(typeof(BulkSyncRequest))]
[JsonSerializable(typeof(TableQueryRequest))]
[JsonSerializable(typeof(TableQueryResult))]
[JsonSerializable(typeof(FormulaDto))]
[JsonSerializable(typeof(List<FormulaDto>))]
[JsonSerializable(typeof(FormulaValidationResult))]
[JsonSerializable(typeof(FormulaRunRequest))]
[JsonSerializable(typeof(FormulaRunResult))]
[JsonSerializable(typeof(FormulaPreviewRequest))]
[JsonSerializable(typeof(ApiError))]
public partial class EpiasJsonContext : JsonSerializerContext;
