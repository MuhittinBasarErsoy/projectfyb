using System.Text;

namespace Epias.Core.Storage;

/// <summary>
/// Dinamik DDL/DML ürettiğimiz için tüm tablo ve kolon adları burada
/// beyaz listeye göre normalize edilir. Kullanıcıdan gelen hiçbir metin
/// doğrudan SQL'e gömülmez; yalnızca bu sınıftan geçen tanımlayıcılar gömülür.
/// </summary>
public static class SqlIdentifier
{
    /// <summary>
    /// Tüm tanımlayıcılar köşeli parantezle sarıldığı için T-SQL anahtar sözcükleri
    /// aslında sorun çıkarmaz; yine de dış araçlarda (bcp, rapor motorları) tırnaksız
    /// kullanıldığında ayrıştırma hatası veren sözcükler yeniden adlandırılır.
    /// <c>date</c> ve <c>hour</c> bilinçli olarak listede değildir: formüllerde
    /// en sık başvurulan kolonlar bunlardır ve okunabilirlikleri önemlidir.
    /// </summary>
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "key", "value", "user", "group", "order", "table", "column",
        "index", "primary", "check", "default", "public", "current", "percent", "period"
    };

    /// <summary>
    /// ASCII harf/rakam. Türkçe ve diğer aksanlı harfler bilinçli olarak dışarıda
    /// bırakılır: tablo adları yedekleme, bcp ve rapor araçlarında da sorunsuz taşınsın.
    /// </summary>
    private static bool IsAsciiLetterOrDigit(char ch) =>
        ch is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9';

    /// <summary>camelCase JSON alanını snake_case SQL kolonuna çevirir.</summary>
    public static string ToColumn(string jsonName)
    {
        var sb = new StringBuilder(jsonName.Length + 8);
        for (var i = 0; i < jsonName.Length; i++)
        {
            var ch = jsonName[i];
            if (ch is >= 'A' and <= 'Z')
            {
                if (i > 0 && sb.Length > 0 && sb[^1] != '_') sb.Append('_');
                sb.Append(char.ToLowerInvariant(ch));
            }
            else if (IsAsciiLetterOrDigit(ch))
            {
                sb.Append(ch);
            }
            else if (sb.Length > 0 && sb[^1] != '_')
            {
                sb.Append('_');
            }
        }

        var name = sb.ToString().Trim('_');
        if (name.Length == 0) name = "col";
        if (char.IsDigit(name[0])) name = "c_" + name;
        if (name.Length > 120) name = name[..120];
        if (Reserved.Contains(name)) name += "_v";
        return name;
    }

    /// <summary>Serbest metni güvenli bir SQL tanımlayıcısına indirger.</summary>
    public static string Sanitize(string raw)
    {
        var sb = new StringBuilder(raw.Length);
        foreach (var ch in raw)
        {
            if (IsAsciiLetterOrDigit(ch) || ch == '_') sb.Append(char.ToLowerInvariant(ch));
            else if (sb.Length > 0 && sb[^1] != '_') sb.Append('_');
        }

        var name = sb.ToString().Trim('_');
        if (name.Length == 0) name = "obj";
        if (char.IsDigit(name[0])) name = "t_" + name;
        return name.Length > 120 ? name[..120] : name;
    }

    /// <summary>Köşeli parantezle sarar; kapanış parantezini kaçırır.</summary>
    public static string Quote(string identifier) => "[" + identifier.Replace("]", "]]") + "]";

    public static string QualifiedTable(string schema, string table) =>
        Quote(schema) + "." + Quote(table);
}
