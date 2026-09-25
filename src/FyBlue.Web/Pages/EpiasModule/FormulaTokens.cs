using System.Globalization;
using System.Text;

namespace FyBlue.Web.Pages.EpiasModule;

public enum FormulaTokenKind { Field, Number, Operator, Open, Close, Comma, Function }

/// <summary>
/// Formül oluşturucudaki tek bir parça. Oluşturucu düz bir parça listesi tutar;
/// sunucuya giden ifade metni bu listeden üretilir, kayıtlı ifadeler de
/// yeniden parçalara ayrılır. Asıl doğrulama sunucudaki ayrıştırıcıdadır.
/// </summary>
public sealed class FormulaToken
{
    public FormulaTokenKind Kind { get; init; }

    /// <summary>İşleç (<c>+</c>), işlev adı (<c>ABS</c>) ya da sayı metni.</summary>
    public string Text { get; set; } = "";

    public string? Table { get; init; }
    public string? Column { get; init; }

    /// <summary>Aynı gün/saate birden çok satır düştüğünde uygulanacak birleştirme.</summary>
    public string Aggregate { get; set; } = "AVG";

    public static FormulaToken Field(string table, string column) =>
        new() { Kind = FormulaTokenKind.Field, Table = table, Column = column };

    public static FormulaToken Number(string text) => new() { Kind = FormulaTokenKind.Number, Text = text };
    public static FormulaToken Op(string op) => new() { Kind = FormulaTokenKind.Operator, Text = op };
    public static FormulaToken Open() => new() { Kind = FormulaTokenKind.Open, Text = "(" };
    public static FormulaToken Close() => new() { Kind = FormulaTokenKind.Close, Text = ")" };
    public static FormulaToken Comma() => new() { Kind = FormulaTokenKind.Comma, Text = "," };
    public static FormulaToken Function(string name) => new() { Kind = FormulaTokenKind.Function, Text = name };

    public FormulaToken Clone() => new()
    {
        Kind = Kind, Text = Text, Table = Table, Column = Column, Aggregate = Aggregate
    };

    public string Key => $"{Table}.{Column}";
}

public sealed record FormulaFunctionInfo(string Name, string Label, string Hint, int Args);

public static class FormulaTokens
{
    public static readonly IReadOnlyList<(string Code, string Label, string Hint)> Aggregates =
    [
        ("AVG", "ortalama", "Aynı gün/saatteki satırların ortalaması"),
        ("SUM", "toplam", "Aynı gün/saatteki satırların toplamı"),
        ("MIN", "en az", "Aynı gün/saatteki en küçük değer"),
        ("MAX", "en çok", "Aynı gün/saatteki en büyük değer"),
        ("COUNT", "adet", "Aynı gün/saatteki satır sayısı")
    ];

    public static readonly IReadOnlyList<(string Op, string Symbol, string Hint)> Operators =
    [
        ("+", "+", "Topla"),
        ("-", "−", "Çıkar"),
        ("*", "×", "Çarp"),
        ("/", "÷", "Böl (sıfıra bölmede satır atlanır)"),
        ("^", "xʸ", "Üssünü al"),
        ("%", "mod", "Bölümden kalan")
    ];

    public static readonly IReadOnlyList<FormulaFunctionInfo> Functions =
    [
        new("ROUND", "Yuvarla", "Yuvarla(değer, basamak)", 2),
        new("ABS", "Mutlak değer", "Negatif işaretini kaldırır", 1),
        new("GREATEST", "En büyüğü", "Değerlerden büyük olanı", 2),
        new("LEAST", "En küçüğü", "Değerlerden küçük olanı", 2),
        new("COALESCE", "Boşsa diğeri", "İlk dolu değeri kullanır", 2),
        new("SQRT", "Karekök", "Karekök", 1),
        new("POWER", "Üssü", "Üssü(taban, üs)", 2),
        new("FLOOR", "Aşağı yuvarla", "Tam sayıya aşağı yuvarlar", 1),
        new("CEILING", "Yukarı yuvarla", "Tam sayıya yukarı yuvarlar", 1),
        new("LOG", "Doğal log", "ln(x)", 1),
        new("EXP", "e üssü", "eˣ", 1),
        new("SIGN", "İşaret", "-1, 0 veya 1", 1)
    ];

    public static string OperatorSymbol(string op) =>
        Operators.FirstOrDefault(o => o.Op == op).Symbol ?? op;

    public static string FunctionLabel(string name) =>
        Functions.FirstOrDefault(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase))?.Label ?? name;

    public static string AggregateLabel(string code) =>
        Aggregates.FirstOrDefault(a => a.Code == code).Label ?? code.ToLowerInvariant();

    /// <summary>Bir işlevin boş kalıbı: <c>Yuvarla( , 2 )</c> gibi.</summary>
    public static List<FormulaToken> FunctionTemplate(FormulaFunctionInfo f)
    {
        var list = new List<FormulaToken> { FormulaToken.Function(f.Name) };
        for (var i = 1; i < f.Args; i++)
        {
            list.Add(FormulaToken.Comma());
            if (f.Name == "ROUND") list.Add(FormulaToken.Number("2"));
        }
        list.Add(FormulaToken.Close());
        return list;
    }

    // -- metne çevirme ----------------------------------------------------

    public static string ToExpression(IEnumerable<FormulaToken> tokens)
    {
        var sb = new StringBuilder();
        foreach (var t in tokens)
        {
            var text = t.Kind switch
            {
                FormulaTokenKind.Field => t.Aggregate == "AVG"
                    ? $"[{t.Table}.{t.Column}]"
                    : $"{t.Aggregate}([{t.Table}.{t.Column}])",
                FormulaTokenKind.Number => NormalizeNumber(t.Text),
                FormulaTokenKind.Function => t.Text + "(",
                _ => t.Text
            };

            if (sb.Length > 0 && NeedsSpace(sb[^1], t.Kind)) sb.Append(' ');
            sb.Append(text);
        }
        return sb.ToString();

        static bool NeedsSpace(char last, FormulaTokenKind next) =>
            last != '(' && next is not (FormulaTokenKind.Close or FormulaTokenKind.Comma);
    }

    /// <summary>"1.234,5" / "0,5" gibi Türkçe yazımları <c>0.5</c> biçimine çevirir.</summary>
    public static string NormalizeNumber(string text)
    {
        var s = (text ?? "").Trim().Replace(" ", "");
        if (s.Contains(',') && s.Contains('.')) s = s.Replace(".", "").Replace(',', '.');
        else s = s.Replace(',', '.');
        return decimal.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d)
            ? d.ToString(CultureInfo.InvariantCulture)
            : "0";
    }

    public static int ParenBalance(IEnumerable<FormulaToken> tokens) =>
        tokens.Sum(t => t.Kind is FormulaTokenKind.Open or FormulaTokenKind.Function ? 1
                      : t.Kind == FormulaTokenKind.Close ? -1 : 0);

    // -- metinden parçalara -------------------------------------------------

    /// <summary>
    /// İfade metnini parçalara ayırır. Oluşturucunun gösteremeyeceği bir yapı
    /// varsa <c>null</c> döner; ekran bu durumda metin düzenleyiciye düşer.
    /// </summary>
    public static List<FormulaToken>? Parse(string? expression)
    {
        var result = new List<FormulaToken>();
        if (string.IsNullOrWhiteSpace(expression)) return result;

        var raw = Lex(expression);
        if (raw is null) return null;

        for (var i = 0; i < raw.Count; i++)
        {
            var (kind, text) = raw[i];
            switch (kind)
            {
                case 'r':
                    var field = ToField(text);
                    if (field is null) return null;
                    result.Add(field);
                    break;

                case 'n': result.Add(FormulaToken.Number(text)); break;
                case 'o': result.Add(FormulaToken.Op(text)); break;
                case '(': result.Add(FormulaToken.Open()); break;
                case ')': result.Add(FormulaToken.Close()); break;
                case ',': result.Add(FormulaToken.Comma()); break;

                case 'i':
                    var name = text.ToUpperInvariant();
                    if (i + 1 >= raw.Count || raw[i + 1].Kind != '(') return null;

                    if (Aggregates.Any(a => a.Code == name))
                    {
                        // SUM([t.c]) → tek bir alan parçası
                        if (i + 3 >= raw.Count || raw[i + 2].Kind != 'r' || raw[i + 3].Kind != ')') return null;
                        var agg = ToField(raw[i + 2].Text);
                        if (agg is null) return null;
                        agg.Aggregate = name;
                        result.Add(agg);
                        i += 3;
                    }
                    else if (Functions.Any(f => f.Name == name))
                    {
                        result.Add(FormulaToken.Function(name));
                        i += 1;
                    }
                    else return null;
                    break;
            }
        }
        return result;
    }

    private static FormulaToken? ToField(string raw)
    {
        var parts = raw.Split('.', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 2 ? FormulaToken.Field(parts[0], parts[1]) : null;
    }

    /// <summary>Sunucudaki sözcükleyicinin sadeleştirilmiş eşi.</summary>
    private static List<(char Kind, string Text)>? Lex(string s)
    {
        var list = new List<(char, string)>();
        var i = 0;
        while (i < s.Length)
        {
            var c = s[i];
            if (char.IsWhiteSpace(c)) { i++; continue; }

            if (c == '[')
            {
                var close = s.IndexOf(']', i + 1);
                if (close < 0) return null;
                list.Add(('r', s[(i + 1)..close].Trim()));
                i = close + 1;
                continue;
            }

            if (char.IsDigit(c) || (c == '.' && i + 1 < s.Length && char.IsDigit(s[i + 1])))
            {
                var start = i;
                while (i < s.Length && (char.IsDigit(s[i]) || s[i] == '.')) i++;
                list.Add(('n', s[start..i]));
                continue;
            }

            if (char.IsLetter(c) || c == '_')
            {
                var start = i;
                while (i < s.Length && (char.IsLetterOrDigit(s[i]) || s[i] is '_' or '.')) i++;
                var text = s[start..i];
                list.Add((text.Contains('.') ? 'r' : 'i', text));
                continue;
            }

            switch (c)
            {
                case '(': list.Add(('(', "(")); break;
                case ')': list.Add((')', ")")); break;
                case ',': case ';': list.Add((',', ",")); break;
                case '+': case '-': case '*': case '/': case '%': case '^': list.Add(('o', c.ToString())); break;
                default: return null;
            }
            i++;
        }
        return list;
    }
}

/// <summary><c>tablo.kolon</c> → kullanıcıya gösterilen ad ve kaynak başlığı.</summary>
public sealed class FormulaFieldLookup
{
    private readonly Dictionary<string, (string Label, string Source)> _map = new(StringComparer.OrdinalIgnoreCase);

    public static readonly FormulaFieldLookup Empty = new([]);

    public FormulaFieldLookup(IEnumerable<Epias.Contracts.FormulaSourceDto> sources)
    {
        foreach (var s in sources)
            foreach (var f in s.Fields)
                _map.TryAdd($"{s.TableName}.{f.Column}", (f.Label, s.Title));
    }

    public (string Label, string Source)? Find(FormulaToken token) =>
        _map.TryGetValue(token.Key, out var v) ? v : null;
}
