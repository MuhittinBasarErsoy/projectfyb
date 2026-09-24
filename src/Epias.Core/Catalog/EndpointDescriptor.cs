namespace Epias.Core.Catalog;

/// <summary>Swagger'dan türetilmiş, tek bir EPİAŞ servisini tanımlayan model.</summary>
public sealed class EndpointDescriptor
{
    /// <summary>Yol'dan türetilen benzersiz anahtar. Örn: <c>markets_dam_data_mcp</c>.</summary>
    public required string Key { get; init; }

    /// <summary>Örn: <c>/v1/markets/dam/data/mcp</c>.</summary>
    public required string Path { get; init; }

    /// <summary>GET veya POST.</summary>
    public required string Method { get; init; }

    public required string Tag { get; init; }
    public required string Title { get; init; }
    public string? Description { get; init; }

    /// <summary>Bu endpoint'in verisinin yazılacağı MSSQL tablosu (şema dahil değil).</summary>
    public required string TableName { get; init; }

    /// <summary>Dosya indirme (export) servisi ise true — tablo oluşturulmaz.</summary>
    public bool IsExport { get; init; }

    public List<ParameterDescriptor> Parameters { get; init; } = new();

    /// <summary>Yanıttaki <c>items[]</c> dizisinin eleman alanları.</summary>
    public List<FieldDescriptor> Fields { get; init; } = new();

    public bool SupportsDateRange =>
        Parameters.Any(p => p.Name.Equals("startDate", StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// İstek gövdesinde <c>page</c> nesnesi var mı. Bu parametre kullanıcıya
    /// gösterilmediği için <see cref="Parameters"/> içinden okunamaz; yükleyici doldurur.
    /// </summary>
    public bool SupportsPaging { get; init; }

    /// <summary>startDate/endDate dışında zorunlu parametresi olan servisler kullanıcı girdisi ister.</summary>
    public bool RequiresExtraParameters => Parameters.Any(p =>
        p.Required &&
        !p.Name.Equals("startDate", StringComparison.OrdinalIgnoreCase) &&
        !p.Name.Equals("endDate", StringComparison.OrdinalIgnoreCase));

    /// <summary>Satırın gününü belirleyen alan (varsa).</summary>
    public FieldDescriptor? DateField => Fields.FirstOrDefault(f => f.IsDate);

    public FieldDescriptor? HourField =>
        Fields.FirstOrDefault(f => f.Name.Equals("hour", StringComparison.OrdinalIgnoreCase))
        ?? Fields.FirstOrDefault(f => f.Name.Equals("time", StringComparison.OrdinalIgnoreCase));
}

public sealed class ParameterDescriptor
{
    public required string Name { get; init; }
    /// <summary>string | integer | number | boolean | array | object</summary>
    public required string Type { get; init; }
    public string? Format { get; init; }
    public bool Required { get; init; }
    public string? Description { get; init; }
    public string? Example { get; init; }
    /// <summary>body | query | path | header</summary>
    public string In { get; init; } = "body";
    public List<string>? EnumValues { get; init; }

    public bool IsDateTime => Format == "date-time" || Format == "date";
}

/// <summary>items[] içindeki tek bir alan → tek bir SQL kolonu.</summary>
public sealed class FieldDescriptor
{
    public required string Name { get; init; }
    /// <summary>SQL'e uygun kolon adı.</summary>
    public required string ColumnName { get; init; }
    public required string JsonType { get; init; }
    public string? Format { get; init; }
    public string? Description { get; init; }

    public bool IsDate => JsonType == "string" && (Format == "date-time" || Format == "date");

    public bool IsNumeric => JsonType is "number" or "integer";

    /// <summary>MSSQL kolon tipi.</summary>
    public string SqlType => JsonType switch
    {
        "integer" when Format == "int64" => "BIGINT",
        "integer" => "INT",
        "number" => "DECIMAL(28,8)",
        "boolean" => "BIT",
        "string" when Format == "date-time" => "DATETIMEOFFSET(7)",
        "string" when Format == "date" => "DATE",
        "array" or "object" => "NVARCHAR(MAX)",
        _ => "NVARCHAR(1000)"
    };

    public Type ClrType => JsonType switch
    {
        "integer" when Format == "int64" => typeof(long),
        "integer" => typeof(int),
        "number" => typeof(decimal),
        "boolean" => typeof(bool),
        "string" when Format == "date-time" => typeof(DateTimeOffset),
        "string" when Format == "date" => typeof(DateTime),
        _ => typeof(string)
    };
}

