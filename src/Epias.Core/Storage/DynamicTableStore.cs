using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Epias.Core.Catalog;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Epias.Core.Storage;

public sealed class StorageOptions
{
    public string ConnectionString { get; set; } = "";
    /// <summary>Endpoint tablolarının şeması.</summary>
    public string DataSchema { get; set; } = "epias";
    /// <summary>Formül çıktı tablolarının şeması.</summary>
    public string FormulaSchema { get; set; } = "formula";
    public int CommandTimeoutSeconds { get; set; } = 300;
}

/// <summary>
/// Her endpoint için ayrı bir MSSQL tablosu oluşturur ve tekrarsız (idempotent)
/// yazma yapar. Aynı içeriğe sahip satır ikinci kez gelirse eklenmez —
/// bunun için satırın SHA-256 özeti üzerinde tekil indeks kullanılır.
/// </summary>
public sealed class DynamicTableStore
{
    public const string RowHashColumn = "row_hash";
    public const string ScopeHashColumn = "scope_hash";
    public const string ScopeJsonColumn = "scope_json";
    public const string FetchedAtColumn = "fetched_at";
    public const string RowIdColumn = "row_id";

    private readonly StorageOptions _options;
    private readonly ILogger<DynamicTableStore> _logger;
    private readonly HashSet<string> _ensuredTables = new(StringComparer.OrdinalIgnoreCase);
    private readonly SemaphoreSlim _ddlLock = new(1, 1);

    public DynamicTableStore(IOptions<StorageOptions> options, ILogger<DynamicTableStore> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public string DataSchema => _options.DataSchema;
    public string FormulaSchema => _options.FormulaSchema;

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(ct);
        return conn;
    }

    private SqlCommand Command(SqlConnection conn, string sql, SqlTransaction? tx = null)
    {
        var cmd = new SqlCommand(sql, conn, tx) { CommandTimeout = _options.CommandTimeoutSeconds };
        return cmd;
    }

    // -----------------------------------------------------------------------
    // Şema kurulumu
    // -----------------------------------------------------------------------

    public async Task EnsureSchemasAsync(CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        foreach (var schema in new[] { _options.DataSchema, _options.FormulaSchema })
        {
            var safe = SqlIdentifier.Sanitize(schema);
            await using var cmd = Command(conn,
                $"IF SCHEMA_ID(@n) IS NULL EXEC('CREATE SCHEMA {SqlIdentifier.Quote(safe)}');");
            cmd.Parameters.AddWithValue("@n", safe);
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>Endpoint tablosunu (yoksa) oluşturur; eksik kolonları ekler.</summary>
    public async Task EnsureTableAsync(EndpointDescriptor ep, CancellationToken ct = default)
    {
        if (ep.IsExport || ep.Fields.Count == 0) return;
        if (_ensuredTables.Contains(ep.TableName)) return;

        await _ddlLock.WaitAsync(ct);
        try
        {
            if (_ensuredTables.Contains(ep.TableName)) return;

            await using var conn = await OpenAsync(ct);
            var schema = SqlIdentifier.Sanitize(_options.DataSchema);
            var table = SqlIdentifier.Sanitize(ep.TableName);
            var full = SqlIdentifier.QualifiedTable(schema, table);

            var sb = new StringBuilder();
            sb.AppendLine($"IF OBJECT_ID('{schema}.{table}', 'U') IS NULL");
            sb.AppendLine("BEGIN");
            sb.AppendLine($"  CREATE TABLE {full} (");
            sb.AppendLine($"    {SqlIdentifier.Quote(RowIdColumn)} BIGINT IDENTITY(1,1) NOT NULL,");
            foreach (var f in ep.Fields)
                sb.AppendLine($"    {SqlIdentifier.Quote(f.ColumnName)} {f.SqlType} NULL,");
            sb.AppendLine($"    {SqlIdentifier.Quote(ScopeHashColumn)} BINARY(32) NOT NULL,");
            sb.AppendLine($"    {SqlIdentifier.Quote(ScopeJsonColumn)} NVARCHAR(MAX) NULL,");
            sb.AppendLine($"    {SqlIdentifier.Quote(RowHashColumn)} BINARY(32) NOT NULL,");
            sb.AppendLine($"    {SqlIdentifier.Quote(FetchedAtColumn)} DATETIMEOFFSET(7) NOT NULL " +
                          $"CONSTRAINT {SqlIdentifier.Quote("DF_" + table + "_fetched")} DEFAULT SYSDATETIMEOFFSET(),");
            sb.AppendLine($"    CONSTRAINT {SqlIdentifier.Quote("PK_" + table)} PRIMARY KEY CLUSTERED ({SqlIdentifier.Quote(RowIdColumn)})");
            sb.AppendLine("  );");
            sb.AppendLine($"  CREATE UNIQUE NONCLUSTERED INDEX {SqlIdentifier.Quote("UX_" + table + "_rowhash")} " +
                          $"ON {full} ({SqlIdentifier.Quote(RowHashColumn)});");

            if (ep.DateField is { } df)
                sb.AppendLine($"  CREATE NONCLUSTERED INDEX {SqlIdentifier.Quote("IX_" + table + "_date")} " +
                              $"ON {full} ({SqlIdentifier.Quote(df.ColumnName)});");

            sb.AppendLine("END");

            await using (var cmd = Command(conn, sb.ToString()))
                await cmd.ExecuteNonQueryAsync(ct);

            await AddMissingColumnsAsync(conn, schema, table, ep, ct);
            _ensuredTables.Add(ep.TableName);
        }
        finally
        {
            _ddlLock.Release();
        }
    }

    /// <summary>EPİAŞ yeni alan eklediğinde tabloya kolon ekler (veri kaybı olmadan).</summary>
    private async Task AddMissingColumnsAsync(
        SqlConnection conn, string schema, string table, EndpointDescriptor ep, CancellationToken ct)
    {
        var existing = await GetColumnsAsync(conn, schema, table, ct);
        var missing = ep.Fields.Where(f => !existing.ContainsKey(f.ColumnName)).ToList();
        if (missing.Count == 0) return;

        var full = SqlIdentifier.QualifiedTable(schema, table);
        var sql = string.Join("\n", missing.Select(f =>
            $"ALTER TABLE {full} ADD {SqlIdentifier.Quote(f.ColumnName)} {f.SqlType} NULL;"));

        await using var cmd = Command(conn, sql);
        await cmd.ExecuteNonQueryAsync(ct);
        _logger.LogInformation("{Table}: {Count} yeni kolon eklendi.", table, missing.Count);
    }

    private async Task<Dictionary<string, string>> GetColumnsAsync(
        SqlConnection conn, string schema, string table, CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        await using var cmd = Command(conn,
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS " +
            "WHERE TABLE_SCHEMA = @s AND TABLE_NAME = @t");
        cmd.Parameters.AddWithValue("@s", schema);
        cmd.Parameters.AddWithValue("@t", table);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) map[r.GetString(0)] = r.GetString(1);
        return map;
    }

    // -----------------------------------------------------------------------
    // Yazma (tekrarsız)
    // -----------------------------------------------------------------------

    public sealed record WriteResult(int Fetched, int Inserted, int Duplicates);

    /// <summary>
    /// items[] dizisini tabloya yazar. <paramref name="scope"/>, satırı üreten
    /// istek parametreleridir (bölge, santral, tarife vb.); aynı değerlere sahip
    /// farklı kapsamlardan gelen satırların karışmaması için özete dahil edilir.
    /// </summary>
    public async Task<WriteResult> WriteItemsAsync(
        EndpointDescriptor ep,
        IReadOnlyList<JsonElement> items,
        IReadOnlyDictionary<string, object?> scope,
        CancellationToken ct = default)
    {
        if (items.Count == 0) return new WriteResult(0, 0, 0);
        await EnsureTableAsync(ep, ct);

        var scopeJson = CanonicalJson(scope);
        var scopeHash = Sha256(scopeJson);

        var dt = BuildDataTable(ep);
        var seen = new HashSet<string>(items.Count);

        foreach (var item in items)
        {
            if (item.ValueKind != JsonValueKind.Object) continue;

            var row = dt.NewRow();
            var hashInput = new StringBuilder(256);
            hashInput.Append(scopeJson).Append(Sep);

            foreach (var f in ep.Fields)
            {
                var value = ReadValue(item, f);
                row[f.ColumnName] = value ?? DBNull.Value;
                hashInput.Append(f.ColumnName).Append('=').Append(Stringify(value)).Append(Sep);
            }

            var rowHash = Sha256(hashInput.ToString());

            // Aynı yanıt içinde tekrarlanan satırları da ele — SqlBulkCopy tekil
            // indeksi ihlal etmeden staging'e yazılsın diye.
            if (!seen.Add(Convert.ToHexString(rowHash))) continue;

            row[ScopeHashColumn] = scopeHash;
            row[ScopeJsonColumn] = scopeJson;
            row[RowHashColumn] = rowHash;
            dt.Rows.Add(row);
        }

        if (dt.Rows.Count == 0) return new WriteResult(items.Count, 0, items.Count);

        var schema = SqlIdentifier.Sanitize(_options.DataSchema);
        var table = SqlIdentifier.Sanitize(ep.TableName);
        var full = SqlIdentifier.QualifiedTable(schema, table);
        var columns = ep.Fields.Select(f => f.ColumnName)
            .Concat(new[] { ScopeHashColumn, ScopeJsonColumn, RowHashColumn })
            .ToList();
        var columnList = string.Join(", ", columns.Select(SqlIdentifier.Quote));

        await using var conn = await OpenAsync(ct);
        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

        try
        {
            // 1) Geçici tabloya toplu yaz.
            var createTemp = new StringBuilder("CREATE TABLE #stage (");
            createTemp.Append(string.Join(", ", ep.Fields.Select(f =>
                $"{SqlIdentifier.Quote(f.ColumnName)} {f.SqlType} NULL")));
            createTemp.Append($", {SqlIdentifier.Quote(ScopeHashColumn)} BINARY(32) NOT NULL");
            createTemp.Append($", {SqlIdentifier.Quote(ScopeJsonColumn)} NVARCHAR(MAX) NULL");
            createTemp.Append($", {SqlIdentifier.Quote(RowHashColumn)} BINARY(32) NOT NULL);");

            await using (var cmd = Command(conn, createTemp.ToString(), tx))
                await cmd.ExecuteNonQueryAsync(ct);

            using (var bulk = new SqlBulkCopy(conn, SqlBulkCopyOptions.Default, tx)
                   {
                       DestinationTableName = "#stage",
                       BulkCopyTimeout = _options.CommandTimeoutSeconds,
                       BatchSize = 5000
                   })
            {
                foreach (var c in columns) bulk.ColumnMappings.Add(c, c);
                await bulk.WriteToServerAsync(dt, ct);
            }

            // 2) Yalnızca hedefte bulunmayan satırları aktar (tekrarsızlık burada).
            var insertSql =
                $"INSERT INTO {full} ({columnList})\n" +
                $"SELECT {columnList} FROM (\n" +
                $"  SELECT {columnList}, ROW_NUMBER() OVER (PARTITION BY {SqlIdentifier.Quote(RowHashColumn)} ORDER BY (SELECT NULL)) AS rn\n" +
                $"  FROM #stage\n" +
                $") s\n" +
                $"WHERE s.rn = 1 AND NOT EXISTS (\n" +
                $"  SELECT 1 FROM {full} t WITH (UPDLOCK, HOLDLOCK)\n" +
                $"  WHERE t.{SqlIdentifier.Quote(RowHashColumn)} = s.{SqlIdentifier.Quote(RowHashColumn)}\n" +
                $");";

            int inserted;
            await using (var cmd = Command(conn, insertSql, tx))
                inserted = await cmd.ExecuteNonQueryAsync(ct);

            await using (var cmd = Command(conn, "DROP TABLE #stage;", tx))
                await cmd.ExecuteNonQueryAsync(ct);

            await tx.CommitAsync(ct);
            return new WriteResult(items.Count, inserted, items.Count - inserted);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    private static DataTable BuildDataTable(EndpointDescriptor ep)
    {
        var dt = new DataTable();
        foreach (var f in ep.Fields)
            dt.Columns.Add(f.ColumnName, f.ClrType);
        dt.Columns.Add(ScopeHashColumn, typeof(byte[]));
        dt.Columns.Add(ScopeJsonColumn, typeof(string));
        dt.Columns.Add(RowHashColumn, typeof(byte[]));
        foreach (DataColumn c in dt.Columns) c.AllowDBNull = true;
        return dt;
    }

    /// <summary>JSON değerini kolonun CLR tipine dönüştürür; dönüşemezse null.</summary>
    private static object? ReadValue(JsonElement item, FieldDescriptor f)
    {
        if (!item.TryGetProperty(f.Name, out var v) || v.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;

        try
        {
            switch (f.JsonType)
            {
                case "integer" when f.Format == "int64":
                    return v.ValueKind == JsonValueKind.Number ? v.GetInt64()
                         : long.TryParse(v.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var l) ? l : null;

                case "integer":
                    return v.ValueKind == JsonValueKind.Number ? v.GetInt32()
                         : int.TryParse(v.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var i) ? i : null;

                case "number":
                    return v.ValueKind == JsonValueKind.Number ? v.GetDecimal()
                         : decimal.TryParse(v.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : null;

                case "boolean":
                    return v.ValueKind switch
                    {
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        _ => bool.TryParse(v.ToString(), out var b) ? b : null
                    };

                case "array":
                case "object":
                    return v.GetRawText();

                default:
                    if (f.Format == "date-time")
                        return DateTimeOffset.TryParse(v.GetString(), CultureInfo.InvariantCulture,
                            DateTimeStyles.None, out var dto) ? dto : null;
                    if (f.Format == "date")
                        return DateTime.TryParse(v.GetString(), CultureInfo.InvariantCulture,
                            DateTimeStyles.None, out var dt) ? dt.Date : null;

                    var s = v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
                    if (s is null) return null;
                    return s.Length > 1000 ? s[..1000] : s;
            }
        }
        catch (FormatException) { return null; }
        catch (InvalidOperationException) { return null; }
        catch (OverflowException) { return null; }
    }

    private static string Stringify(object? value) => value switch
    {
        null => "",
        decimal d => d.ToString("0.########", CultureInfo.InvariantCulture),
        double d => d.ToString("0.########", CultureInfo.InvariantCulture),
        DateTimeOffset dto => dto.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
        DateTime dt => dt.ToString("O", CultureInfo.InvariantCulture),
        bool b => b ? "1" : "0",
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? ""
    };

    /// <summary>Kapsam sözlüğünü sırası sabit, kültür bağımsız bir metne çevirir.</summary>
    public static string CanonicalJson(IReadOnlyDictionary<string, object?> scope)
    {
        if (scope.Count == 0) return "{}";
        var ordered = scope.OrderBy(k => k.Key, StringComparer.Ordinal);
        var sb = new StringBuilder("{");
        var first = true;
        foreach (var kv in ordered)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append('"').Append(kv.Key).Append("\":\"").Append(Stringify(kv.Value)).Append('"');
        }
        return sb.Append('}').ToString();
    }

    private const char Sep = '\u001f';


    private static byte[] Sha256(string input) => SHA256.HashData(Encoding.UTF8.GetBytes(input));

    // -----------------------------------------------------------------------
    // Okuma
    // -----------------------------------------------------------------------

    public async Task<long> GetRowCountAsync(string tableName, CancellationToken ct = default)
    {
        var schema = SqlIdentifier.Sanitize(_options.DataSchema);
        var table = SqlIdentifier.Sanitize(tableName);

        await using var conn = await OpenAsync(ct);
        await using var cmd = Command(conn,
            $"IF OBJECT_ID('{schema}.{table}', 'U') IS NULL SELECT CAST(-1 AS BIGINT) " +
            $"ELSE SELECT COUNT_BIG(1) FROM {SqlIdentifier.QualifiedTable(schema, table)};");
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is long l ? l : -1;
    }

    public async Task<Dictionary<string, long>> GetAllRowCountsAsync(CancellationToken ct = default)
    {
        var schema = SqlIdentifier.Sanitize(_options.DataSchema);
        var map = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);

        await using var conn = await OpenAsync(ct);
        await using var cmd = Command(conn, """
            SELECT t.name, SUM(p.rows)
            FROM sys.tables t
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
            WHERE s.name = @s
            GROUP BY t.name;
            """);
        cmd.Parameters.AddWithValue("@s", schema);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            map[r.GetString(0)] = r.IsDBNull(1) ? 0 : Convert.ToInt64(r.GetValue(1));
        return map;
    }

    public sealed record PagedRows(List<string> Columns, List<Dictionary<string, object?>> Rows, long Total);

    public async Task<PagedRows> QueryAsync(
        EndpointDescriptor ep,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        string? orderBy,
        bool descending,
        CancellationToken ct = default)
    {
        var schema = SqlIdentifier.Sanitize(_options.DataSchema);
        var table = SqlIdentifier.Sanitize(ep.TableName);
        var full = SqlIdentifier.QualifiedTable(schema, table);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 5000);

        var where = new List<string>();
        var dateCol = ep.DateField?.ColumnName;
        if (dateCol is not null)
        {
            if (from.HasValue) where.Add($"{SqlIdentifier.Quote(dateCol)} >= @from");
            if (to.HasValue) where.Add($"{SqlIdentifier.Quote(dateCol)} <= @to");
        }
        var whereSql = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        // Sıralama kolonu yalnızca bilinen kolon adlarından seçilebilir.
        var sortColumn = ep.Fields.FirstOrDefault(f =>
                             f.ColumnName.Equals(orderBy, StringComparison.OrdinalIgnoreCase))?.ColumnName
                         ?? dateCol ?? RowIdColumn;
        var direction = descending ? "DESC" : "ASC";

        var selectColumns = string.Join(", ",
            new[] { RowIdColumn }
                .Concat(ep.Fields.Select(f => f.ColumnName))
                .Concat(new[] { ScopeJsonColumn, FetchedAtColumn })
                .Select(SqlIdentifier.Quote));

        await using var conn = await OpenAsync(ct);

        long total;
        await using (var countCmd = Command(conn, $"SELECT COUNT_BIG(1) FROM {full} {whereSql};"))
        {
            AddRangeParams(countCmd, from, to, dateCol);
            total = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct));
        }

        var sql =
            $"SELECT {selectColumns} FROM {full} {whereSql} " +
            $"ORDER BY {SqlIdentifier.Quote(sortColumn)} {direction}, {SqlIdentifier.Quote(RowIdColumn)} {direction} " +
            $"OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY;";

        await using var cmd = Command(conn, sql);
        AddRangeParams(cmd, from, to, dateCol);
        cmd.Parameters.AddWithValue("@skip", (page - 1) * pageSize);
        cmd.Parameters.AddWithValue("@take", pageSize);

        var columns = new List<string>();
        var rows = new List<Dictionary<string, object?>>();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        for (var i = 0; i < reader.FieldCount; i++) columns.Add(reader.GetName(i));
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>(reader.FieldCount);
            for (var i = 0; i < reader.FieldCount; i++)
                row[columns[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }

        return new PagedRows(columns, rows, total);
    }

    private static void AddRangeParams(SqlCommand cmd, DateTimeOffset? from, DateTimeOffset? to, string? dateCol)
    {
        if (dateCol is null) return;
        if (from.HasValue) cmd.Parameters.AddWithValue("@from", from.Value);
        if (to.HasValue) cmd.Parameters.AddWithValue("@to", to.Value);
    }

    // -----------------------------------------------------------------------
    // Serbest SELECT (yalnızca formül motorunun ürettiği SQL için)
    // -----------------------------------------------------------------------

    public async Task<PagedRows> ExecuteSelectAsync(
        string sql, IReadOnlyDictionary<string, object?> parameters, CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = Command(conn, sql);
        foreach (var p in parameters) cmd.Parameters.AddWithValue(p.Key, p.Value ?? DBNull.Value);

        var columns = new List<string>();
        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        for (var i = 0; i < reader.FieldCount; i++) columns.Add(reader.GetName(i));
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>(reader.FieldCount);
            for (var i = 0; i < reader.FieldCount; i++)
                row[columns[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }
        return new PagedRows(columns, rows, rows.Count);
    }

    public async Task<int> ExecuteNonQueryAsync(
        string sql, IReadOnlyDictionary<string, object?> parameters, CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = Command(conn, sql);
        foreach (var p in parameters) cmd.Parameters.AddWithValue(p.Key, p.Value ?? DBNull.Value);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> TableExistsAsync(string schema, string table, CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = Command(conn,
            "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @s AND TABLE_NAME = @t");
        cmd.Parameters.AddWithValue("@s", SqlIdentifier.Sanitize(schema));
        cmd.Parameters.AddWithValue("@t", SqlIdentifier.Sanitize(table));
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }
}


