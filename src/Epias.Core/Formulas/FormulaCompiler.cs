using System.Globalization;
using System.Text;
using Epias.Core.Catalog;
using Epias.Core.Storage;

namespace Epias.Core.Formulas;

public enum AlignmentMode
{
    /// <summary>Gün + saat kırılımında hizala (varsayılan).</summary>
    DateHour,
    /// <summary>Yalnızca gün kırılımında hizala.</summary>
    Date,
    /// <summary>Hizalama yok — tüm aralık için tek bir toplam değer üret.</summary>
    None
}

public sealed record CompiledFormula(
    string Sql,
    string InsertSql,
    IReadOnlyList<string> ReferencedTables,
    IReadOnlyList<string> ReferencedColumns,
    AlignmentMode Mode);

/// <summary>
/// Formül ağacını, endpoint tablolarını hizalayıp birleştiren tek bir
/// T-SQL sorgusuna çevirir. Tablo/kolon adları yalnızca katalogda
/// doğrulandıktan sonra sorguya girer.
/// </summary>
public sealed class FormulaCompiler(
    EndpointCatalog catalog,
    DynamicTableStore store,
    IFormulaSourceProvider? external = null)
{
    private const string Numeric = "DECIMAL(38,10)";

    /// <summary>Harici kaynağın zaman damgası: satırdaki metinden türetilen kolon.</summary>
    private const string TimestampAlias = "__ts";

    public static AlignmentMode ParseMode(string? mode) => mode?.Trim().ToLowerInvariant() switch
    {
        "date" => AlignmentMode.Date,
        "none" or "" or null => mode is null or "" ? AlignmentMode.DateHour : AlignmentMode.None,
        _ => AlignmentMode.DateHour
    };

    public CompiledFormula Compile(string expression, AlignmentMode mode, string? outputTable = null)
    {
        var ast = FormulaParser.Parse(expression);
        var refs = FormulaParser.CollectColumns(ast).ToList();

        if (refs.Count == 0)
            throw new FormulaException(
                "Formülde en az bir [tablo.kolon] başvurusu olmalı. Örnek: [markets_dam_data_mcp.price] * 2");

        // Aynı (tablo, kolon, işlev) üçlüsü tek bir kaynak olarak paylaşılır.
        var sources = new List<Source>();
        var sourceIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var r in refs)
        {
            var id = $"{r.Table}|{r.Column}|{r.Aggregate}";
            if (sourceIndex.ContainsKey(id)) continue;
            sourceIndex[id] = sources.Count;
            sources.Add(Resolve(r, mode, sources.Count));
        }

        var ctes = BuildCtes(sources, mode);
        var select = BuildSelect(ast, sources, sourceIndex, mode);

        var sql = "WITH\n" + ctes + "\n" + select;
        var insertSql = outputTable is null ? "" : BuildInsert(ctes, select, outputTable);

        return new CompiledFormula(
            sql,
            insertSql,
            sources.Select(s => s.Name).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            sources.Select(s => $"{s.Name}.{s.ColumnName}").Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            mode);
    }

    // -----------------------------------------------------------------------

    /// <summary>
    /// Formüldeki tek bir kolon başvurusunun SQL karşılığı. <see cref="FromSql"/>
    /// bir tablo ya da alt sorgudur; diğer ifadeler onun kolonlarına başvurur.
    /// <see cref="FromParam"/>/<see cref="ToParam"/>, tarih süzgecinde @from/@to'nun
    /// karşılaştırılacağı biçimdir.
    /// </summary>
    private sealed record Source(
        string Alias,
        string Name,
        string ColumnName,
        string Aggregate,
        string FromSql,
        string ValueSql,
        string? DateSql,
        string? HourSql,
        string FromParam,
        string ToParam);

    private Source Resolve(ColumnNode node, AlignmentMode mode, int index)
    {
        var ep = catalog.GetByTable(node.Table) ?? catalog.Get(node.Table);
        if (ep is null)
        {
            var ext = external?.Sources.FirstOrDefault(x =>
                x.Name.Equals(node.Table, StringComparison.OrdinalIgnoreCase));
            if (ext is not null) return ResolveExternal(ext, node, mode, index);

            throw new FormulaException(
                $"'{node.Table}' adında bir tablo/servis yok. Katalogdaki tablo adını kullanın.");
        }

        if (ep.IsExport || ep.Fields.Count == 0)
            throw new FormulaException($"'{node.Table}' bir veri tablosu değil (export servisi).");

        var field = ep.Fields.FirstOrDefault(f =>
                        f.ColumnName.Equals(node.Column, StringComparison.OrdinalIgnoreCase) ||
                        f.Name.Equals(node.Column, StringComparison.OrdinalIgnoreCase))
                    ?? throw new FormulaException(
                        $"'{node.Table}' tablosunda '{node.Column}' kolonu yok. " +
                        $"Mevcut kolonlar: {string.Join(", ", ep.Fields.Select(f => f.ColumnName).Take(20))}");

        if (!field.IsNumeric && node.Aggregate != "COUNT")
            throw new FormulaException(
                $"'{node.Table}.{node.Column}' sayısal değil. Sayısal olmayan kolonlarda yalnızca COUNT kullanılabilir.");

        var schema = SqlIdentifier.Sanitize(store.DataSchema);
        var dateColumn = mode == AlignmentMode.None ? null : ep.DateField?.ColumnName;
        var hourColumn = mode == AlignmentMode.DateHour ? ep.HourField?.ColumnName : null;

        return new Source(
            Alias: "s" + index,
            Name: ep.TableName,
            ColumnName: field.ColumnName,
            Aggregate: node.Aggregate,
            FromSql: SqlIdentifier.QualifiedTable(schema, SqlIdentifier.Sanitize(ep.TableName)),
            ValueSql: SqlIdentifier.Quote(field.ColumnName),
            DateSql: dateColumn is null ? null : SqlIdentifier.Quote(dateColumn),
            HourSql: hourColumn is null ? null : HourKey(SqlIdentifier.Quote(hourColumn)),
            FromParam: "@from",
            ToParam: "@to");
    }

    /// <summary>
    /// Harici (OSOS) tablo: kolonlar metindir, satırlar kullanıcıya aittir ve aynı
    /// dönem yeniden sorgulanmış olabilir. Alt sorgu yalnızca çalıştıran kullanıcının,
    /// her zaman damgası için en son sorgusundan gelen satırlarını bırakır.
    /// </summary>
    private static Source ResolveExternal(ExternalFormulaSource ext, ColumnNode node, AlignmentMode mode, int index)
    {
        var field = ext.Fields.FirstOrDefault(f => f.Column.Equals(node.Column, StringComparison.OrdinalIgnoreCase))
                    ?? throw new FormulaException(
                        $"'{ext.Title}' kaynağında '{node.Column}' alanı yok. " +
                        $"Mevcut alanlar: {string.Join(", ", ext.Fields.Select(f => f.Column).Take(20))}");

        var q = SqlIdentifier.Quote;
        var ts = ext.TimestampColumn is null ? null : q(ext.TimestampColumn);

        var inner = new StringBuilder("SELECT x.*");
        if (ext.VersionColumn is not null)
        {
            var partition = ext.VersionPartitionColumns.Select(c => "x." + q(c)).ToList();
            if (ts is not null) partition.Add("x." + ts);
            var over = partition.Count == 0 ? "" : "PARTITION BY " + string.Join(", ", partition);
            inner.Append($", MAX(x.{q(ext.VersionColumn)}) OVER ({over}) AS [__latest]");
        }
        inner.Append($" FROM {SqlIdentifier.QualifiedTable(ext.Schema, ext.Table)} x");
        if (ext.OwnerColumn is not null) inner.Append($" WHERE x.{q(ext.OwnerColumn)} = @appUserId");

        var from = new StringBuilder("(SELECT o.*");
        if (ts is not null) from.Append($", {ParseTimestamp("o." + ts)} AS {q(TimestampAlias)}");
        from.Append($" FROM ({inner}) o");
        if (ext.VersionColumn is not null) from.Append($" WHERE o.{q(ext.VersionColumn)} = o.[__latest]");
        from.Append(')');

        var hasDate = ts is not null && mode != AlignmentMode.None;
        var tsAlias = q(TimestampAlias);

        return new Source(
            Alias: "s" + index,
            Name: ext.Name,
            ColumnName: field.Column,
            Aggregate: node.Aggregate,
            FromSql: from.ToString(),
            ValueSql: $"TRY_CAST(TRY_CAST({q(field.Column)} AS FLOAT) AS {Numeric})",
            DateSql: hasDate ? tsAlias : null,
            // Saat altı veri (ör. 15 dk profil) saat dilimine toplanır: "13:00".
            HourSql: hasDate && ext.HasHour && mode == AlignmentMode.DateHour
                ? $"RIGHT(N'0' + CAST(DATEPART(hour, {tsAlias}) AS NVARCHAR(2)), 2) + N':00'"
                : null,
            // Zaman damgası yerel saattir; parametrenin saat dilimi atılarak karşılaştırılır.
            FromParam: "CAST(@from AS DATETIME2(7))",
            ToParam: "CAST(@to AS DATETIME2(7))");
    }

    /// <summary>OSOS/Open-Meteo metin zaman damgası → DATETIME2 (yerel saat).</summary>
    private static string ParseTimestamp(string column) =>
        $"COALESCE(CAST(TRY_CAST({column} AS DATETIMEOFFSET) AS DATETIME2(7)), " +
        $"TRY_CAST(REPLACE({column}, N'T', N' ') AS DATETIME2(7)), " +
        $"TRY_CONVERT(DATETIME2(7), {column}, 104), TRY_CONVERT(DATETIME2(7), {column}, 103))";

    /// <summary>
    /// Saat anahtarını "SS:dd" biçimine indirger. EPİAŞ'ta saat alanı kimi servislerde
    /// "13:00", kimilerinde tam tarih-saat metnidir; hizalama bu ortak biçim üzerinden yapılır.
    /// </summary>
    private static string HourKey(string column) =>
        $"COALESCE(CONVERT(NVARCHAR(5), CAST(TRY_CAST(CAST({column} AS NVARCHAR(40)) AS DATETIMEOFFSET) AS TIME), 108), " +
        $"LEFT(CAST({column} AS NVARCHAR(40)), 5))";

    /// <summary>Her kaynak için bir CTE, ardından ortak hizalama ekseni CTE'si üretir.</summary>
    private static string BuildCtes(List<Source> sources, AlignmentMode mode)
    {
        var parts = new List<string>();

        foreach (var s in sources)
        {
            var select = new List<string>();
            var group = new List<string>();

            if (s.DateSql is not null)
            {
                select.Add($"CAST({s.DateSql} AS date) AS d");
                group.Add($"CAST({s.DateSql} AS date)");
            }

            if (s.HourSql is not null)
            {
                select.Add($"{s.HourSql} AS h");
                group.Add(s.HourSql);
            }

            select.Add(s.Aggregate == "COUNT"
                ? $"CAST(COUNT_BIG({s.ValueSql}) AS {Numeric}) AS v"
                : $"{SqlAggregate(s.Aggregate)}(CAST({s.ValueSql} AS {Numeric})) AS v");

            var sb = new StringBuilder();
            sb.AppendLine($"  {s.Alias}_src AS (");
            sb.AppendLine($"    SELECT {string.Join(", ", select)}");
            sb.AppendLine($"    FROM {s.FromSql} t");
            if (s.DateSql is not null)
                sb.AppendLine(
                    $"    WHERE (@from IS NULL OR {s.DateSql} >= {s.FromParam})" +
                    $" AND (@to IS NULL OR {s.DateSql} <= {s.ToParam})");
            if (group.Count > 0)
                sb.AppendLine($"    GROUP BY {string.Join(", ", group)}");
            sb.Append("  )");
            parts.Add(sb.ToString());
        }

        if (NeedsAxis(sources, mode))
        {
            var hourSources = sources.Where(s => s.HourSql is not null).ToList();
            var dateSources = sources.Where(s => s.DateSql is not null).ToList();

            var sb = new StringBuilder();
            sb.AppendLine("  axis AS (");
            if (mode == AlignmentMode.DateHour && hourSources.Count > 0)
            {
                sb.AppendLine("    SELECT DISTINCT d, h FROM (");
                sb.AppendLine(string.Join("\n      UNION ALL\n",
                    hourSources.Select(s => $"      SELECT d, h FROM {s.Alias}_src")));
                sb.AppendLine("    ) a");
            }
            else
            {
                sb.AppendLine("    SELECT DISTINCT d, CAST(NULL AS NVARCHAR(20)) AS h FROM (");
                sb.AppendLine(string.Join("\n      UNION ALL\n",
                    dateSources.Select(s => $"      SELECT d FROM {s.Alias}_src")));
                sb.AppendLine("    ) a");
            }
            sb.Append("  )");
            parts.Add(sb.ToString());
        }

        return string.Join(",\n", parts);
    }

    /// <summary>Ekseni kaynaklarla birleştirip formülü değerlendiren nihai SELECT.</summary>
    private static string BuildSelect(
        FormulaNode ast,
        List<Source> sources,
        Dictionary<string, int> sourceIndex,
        AlignmentMode mode)
    {
        var expr = ToSql(ast, sourceIndex, sources);
        var axisHasHour = mode == AlignmentMode.DateHour && sources.Any(s => s.HourSql is not null);

        var sb = new StringBuilder();
        sb.AppendLine("SELECT q.[date], q.[hour], q.[value]");
        sb.AppendLine("FROM (");

        if (NeedsAxis(sources, mode))
        {
            sb.AppendLine($"  SELECT k.d AS [date], k.h AS [hour], CAST({expr} AS {Numeric}) AS [value]");
            sb.AppendLine("  FROM axis k");
            foreach (var s in sources)
            {
                var on = new List<string>();
                if (s.DateSql is not null) on.Add($"{s.Alias}.d = k.d");
                if (s.HourSql is not null && axisHasHour) on.Add($"{s.Alias}.h = k.h");

                sb.AppendLine(on.Count == 0
                    ? $"  CROSS JOIN {s.Alias}_src {s.Alias}"
                    : $"  LEFT JOIN {s.Alias}_src {s.Alias} ON {string.Join(" AND ", on)}");
            }
        }
        else
        {
            sb.AppendLine("  SELECT CAST(NULL AS date) AS [date], CAST(NULL AS NVARCHAR(20)) AS [hour], " +
                          $"CAST({expr} AS {Numeric}) AS [value]");
            sb.AppendLine($"  FROM {sources[0].Alias}_src {sources[0].Alias}");
            foreach (var s in sources.Skip(1))
                sb.AppendLine($"  CROSS JOIN {s.Alias}_src {s.Alias}");
        }

        sb.AppendLine(") q");
        sb.AppendLine("WHERE q.[value] IS NOT NULL");
        sb.AppendLine("ORDER BY q.[date], q.[hour]");
        sb.Append("OFFSET 0 ROWS FETCH NEXT @maxRows ROWS ONLY");
        return sb.ToString();
    }

    private static bool NeedsAxis(List<Source> sources, AlignmentMode mode) =>
        mode != AlignmentMode.None && sources.Any(s => s.DateSql is not null);

    private static string SqlAggregate(string aggregate) => aggregate.ToUpperInvariant() switch
    {
        "SUM" => "SUM",
        "MIN" => "MIN",
        "MAX" => "MAX",
        "FIRST" or "LAST" or "AVG" => "AVG",
        _ => "AVG"
    };

    /// <summary>Ağacı T-SQL ifadesine çevirir. Yalnızca doğrulanmış takma adlar kullanılır.</summary>
    private static string ToSql(
        FormulaNode node,
        Dictionary<string, int> sourceIndex,
        List<Source> sources) => node switch
    {
        NumberNode n => $"CAST({n.Value.ToString(CultureInfo.InvariantCulture)} AS {Numeric})",

        ColumnNode c => sources[sourceIndex[$"{c.Table}|{c.Column}|{c.Aggregate}"]].Alias + ".v",

        UnaryNode u => $"(-{ToSql(u.Operand, sourceIndex, sources)})",

        BinaryNode b => b.Op switch
        {
            '+' => $"({ToSql(b.Left, sourceIndex, sources)} + {ToSql(b.Right, sourceIndex, sources)})",
            '-' => $"({ToSql(b.Left, sourceIndex, sources)} - {ToSql(b.Right, sourceIndex, sources)})",
            '*' => $"({ToSql(b.Left, sourceIndex, sources)} * {ToSql(b.Right, sourceIndex, sources)})",
            // Sıfıra bölme satırı hataya değil NULL'a düşürür; NULL satırlar elenir.
            '/' => $"({ToSql(b.Left, sourceIndex, sources)} / NULLIF({ToSql(b.Right, sourceIndex, sources)}, 0))",
            '%' => $"({ToSql(b.Left, sourceIndex, sources)} % NULLIF({ToSql(b.Right, sourceIndex, sources)}, 0))",
            '^' => $"POWER({ToSql(b.Left, sourceIndex, sources)}, {ToSql(b.Right, sourceIndex, sources)})",
            _ => throw new FormulaException($"Desteklenmeyen işleç: '{b.Op}'.")
        },

        FunctionNode f => TranslateFunction(f, sourceIndex, sources),

        _ => throw new FormulaException("Çözümlenemeyen ifade düğümü.")
    };

    private static string TranslateFunction(
        FunctionNode f, Dictionary<string, int> sourceIndex, List<Source> sources)
    {
        var args = f.Args.Select(a => ToSql(a, sourceIndex, sources)).ToList();

        return f.Name switch
        {
            "ABS" => $"ABS({args[0]})",
            "SQRT" => $"SQRT(NULLIF({args[0]}, 0))",
            "FLOOR" => $"FLOOR({args[0]})",
            "CEILING" => $"CEILING({args[0]})",
            "LOG" => $"LOG(NULLIF({args[0]}, 0))",
            "EXP" => $"EXP({args[0]})",
            "SIGN" => $"SIGN({args[0]})",
            "ROUND" => $"ROUND({args[0]}, {args[1]})",
            "POWER" => $"POWER({args[0]}, {args[1]})",
            "COALESCE" => $"COALESCE({string.Join(", ", args)})",
            "GREATEST" => args.Aggregate((a, b) => $"(CASE WHEN {a} >= {b} THEN {a} ELSE {b} END)"),
            "LEAST" => args.Aggregate((a, b) => $"(CASE WHEN {a} <= {b} THEN {a} ELSE {b} END)"),
            _ => throw new FormulaException($"Desteklenmeyen işlev: '{f.Name}'.")
        };
    }

    // -----------------------------------------------------------------------
    // Çıktı tablosu
    // -----------------------------------------------------------------------

    public string BuildCreateOutputTable(string outputTable)
    {
        var schema = SqlIdentifier.Sanitize(store.FormulaSchema);
        var table = SqlIdentifier.Sanitize(outputTable);
        var full = SqlIdentifier.QualifiedTable(schema, table);

        return $"""
            IF OBJECT_ID('{schema}.{table}', 'U') IS NULL
            BEGIN
              CREATE TABLE {full} (
                [row_id]      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_{table}] PRIMARY KEY,
                [formula_id]  INT NOT NULL,
                [date]        DATE NULL,
                [hour]        NVARCHAR(20) NULL,
                [value]       DECIMAL(38,10) NULL,
                [row_hash]    BINARY(32) NOT NULL,
                [computed_at] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF_{table}_computed] DEFAULT SYSDATETIMEOFFSET()
              );
              CREATE UNIQUE NONCLUSTERED INDEX [UX_{table}_rowhash] ON {full} ([row_hash]);
              CREATE NONCLUSTERED INDEX [IX_{table}_date] ON {full} ([formula_id], [date]);
            END
            """;
    }

    /// <summary>Sonuçları tekrarsız biçimde çıktı tablosuna yazan INSERT.</summary>
    private string BuildInsert(string ctes, string selectSql, string outputTable)
    {
        var schema = SqlIdentifier.Sanitize(store.FormulaSchema);
        var table = SqlIdentifier.Sanitize(outputTable);
        var full = SqlIdentifier.QualifiedTable(schema, table);

        // Kaynak CTE'leri ile hesap CTE'si tek bir WITH zincirinde birleşir;
        // iç içe WITH T-SQL'de geçersizdir.
        return $"""
            WITH
            {ctes},
            computed AS (
            {Indent(selectSql)}
            ),
            hashed AS (
              SELECT
                @formulaId AS formula_id,
                [date],
                [hour],
                [value],
                HASHBYTES('SHA2_256', CONCAT(
                  CAST(@formulaId AS NVARCHAR(20)), N'|',
                  CONVERT(NVARCHAR(10), [date], 23), N'|',
                  ISNULL([hour], N''), N'|',
                  CONVERT(NVARCHAR(50), [value])
                )) AS row_hash
              FROM computed
            )
            INSERT INTO {full} ([formula_id], [date], [hour], [value], [row_hash])
            SELECT h.formula_id, h.[date], h.[hour], h.[value], h.row_hash
            FROM hashed h
            WHERE NOT EXISTS (
              SELECT 1 FROM {full} t WITH (UPDLOCK, HOLDLOCK)
              WHERE t.[row_hash] = h.row_hash
            );
            """;
    }

    private static string Indent(string sql) =>
        string.Join("\n", sql.Split('\n').Select(l => "  " + l.TrimEnd()));
}

