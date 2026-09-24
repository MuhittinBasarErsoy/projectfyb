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
public sealed class FormulaCompiler(EndpointCatalog catalog, DynamicTableStore store)
{
    private const string Numeric = "DECIMAL(38,10)";

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
            sources.Select(s => s.Endpoint.TableName).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            sources.Select(s => $"{s.Endpoint.TableName}.{s.Field.ColumnName}").Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            mode);
    }

    // -----------------------------------------------------------------------

    private sealed record Source(
        string Alias,
        EndpointDescriptor Endpoint,
        FieldDescriptor Field,
        string Aggregate,
        string? DateColumn,
        string? HourColumn);

    private Source Resolve(ColumnNode node, AlignmentMode mode, int index)
    {
        var ep = catalog.GetByTable(node.Table)
                 ?? catalog.Get(node.Table)
                 ?? throw new FormulaException(
                     $"'{node.Table}' adında bir tablo/servis yok. Katalogdaki tablo adını kullanın.");

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

        var hourColumn = mode == AlignmentMode.DateHour ? ep.HourField?.ColumnName : null;

        return new Source(
            Alias: "s" + index,
            Endpoint: ep,
            Field: field,
            Aggregate: node.Aggregate,
            DateColumn: mode == AlignmentMode.None ? null : ep.DateField?.ColumnName,
            HourColumn: hourColumn);
    }

    /// <summary>Her kaynak için bir CTE, ardından ortak hizalama ekseni CTE'si üretir.</summary>
    private string BuildCtes(List<Source> sources, AlignmentMode mode)
    {
        var schema = SqlIdentifier.Sanitize(store.DataSchema);
        var parts = new List<string>();

        foreach (var s in sources)
        {
            var table = SqlIdentifier.QualifiedTable(schema, SqlIdentifier.Sanitize(s.Endpoint.TableName));
            var select = new List<string>();
            var group = new List<string>();

            if (s.DateColumn is not null)
            {
                select.Add($"CAST({SqlIdentifier.Quote(s.DateColumn)} AS date) AS d");
                group.Add($"CAST({SqlIdentifier.Quote(s.DateColumn)} AS date)");
            }

            if (s.HourColumn is not null)
            {
                select.Add($"CAST({SqlIdentifier.Quote(s.HourColumn)} AS NVARCHAR(20)) AS h");
                group.Add($"CAST({SqlIdentifier.Quote(s.HourColumn)} AS NVARCHAR(20))");
            }

            select.Add(s.Aggregate == "COUNT"
                ? $"CAST(COUNT_BIG({SqlIdentifier.Quote(s.Field.ColumnName)}) AS {Numeric}) AS v"
                : $"{SqlAggregate(s.Aggregate)}(CAST({SqlIdentifier.Quote(s.Field.ColumnName)} AS {Numeric})) AS v");

            var sb = new StringBuilder();
            sb.AppendLine($"  {s.Alias}_src AS (");
            sb.AppendLine($"    SELECT {string.Join(", ", select)}");
            sb.AppendLine($"    FROM {table}");
            if (s.DateColumn is not null)
                sb.AppendLine(
                    $"    WHERE (@from IS NULL OR {SqlIdentifier.Quote(s.DateColumn)} >= @from)" +
                    $" AND (@to IS NULL OR {SqlIdentifier.Quote(s.DateColumn)} <= @to)");
            if (group.Count > 0)
                sb.AppendLine($"    GROUP BY {string.Join(", ", group)}");
            sb.Append("  )");
            parts.Add(sb.ToString());
        }

        if (NeedsAxis(sources, mode))
        {
            var hourSources = sources.Where(s => s.HourColumn is not null).ToList();
            var dateSources = sources.Where(s => s.DateColumn is not null).ToList();

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
        var axisHasHour = mode == AlignmentMode.DateHour && sources.Any(s => s.HourColumn is not null);

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
                if (s.DateColumn is not null) on.Add($"{s.Alias}.d = k.d");
                if (s.HourColumn is not null && axisHasHour) on.Add($"{s.Alias}.h = k.h");

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
        mode != AlignmentMode.None && sources.Any(s => s.DateColumn is not null);

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

