using System.Globalization;
using System.Text;

namespace Epias.Core.Formulas;

/// <summary>
/// Kullanıcı formüllerini ayrıştırır. Dilbilgisi bilinçli olarak dardır:
/// sayılar, <c>[tablo.kolon]</c> başvuruları, dört işlem, üs alma ve
/// beyaz listedeki işlevler. SQL'e çeviri yalnızca bu ağaçtan yapılır,
/// böylece kullanıcı metni hiçbir zaman doğrudan sorguya girmez.
/// </summary>
public static class FormulaParser
{
    private static readonly HashSet<string> Aggregates = new(StringComparer.OrdinalIgnoreCase)
        { "SUM", "AVG", "MIN", "MAX", "COUNT", "FIRST", "LAST" };

    private static readonly Dictionary<string, int> Functions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ABS"] = 1,
        ["SQRT"] = 1,
        ["FLOOR"] = 1,
        ["CEILING"] = 1,
        ["LOG"] = 1,
        ["EXP"] = 1,
        ["SIGN"] = 1,
        ["ROUND"] = 2,
        ["POWER"] = 2,
        ["COALESCE"] = -1, // değişken sayıda
        ["GREATEST"] = -1,
        ["LEAST"] = -1
    };

    public static bool IsAggregate(string name) => Aggregates.Contains(name);
    public static bool IsFunction(string name) => Functions.ContainsKey(name);

    public static FormulaNode Parse(string expression)
    {
        if (string.IsNullOrWhiteSpace(expression))
            throw new FormulaException("Formül boş olamaz.");

        var tokens = Tokenize(expression);
        var parser = new Impl(tokens);
        var node = parser.ParseExpression();
        parser.ExpectEnd();
        return node;
    }

    // -- sözcükleme ---------------------------------------------------------

    private enum TokenKind { Number, Reference, Identifier, Operator, LParen, RParen, Comma, End }

    private readonly record struct Token(TokenKind Kind, string Text, int Position);

    private static List<Token> Tokenize(string s)
    {
        var tokens = new List<Token>();
        var i = 0;

        while (i < s.Length)
        {
            var c = s[i];

            if (char.IsWhiteSpace(c)) { i++; continue; }

            if (c == '[')
            {
                var close = s.IndexOf(']', i + 1);
                if (close < 0) throw new FormulaException($"{i + 1}. karakterde kapanmayan '[' var.");
                tokens.Add(new Token(TokenKind.Reference, s[(i + 1)..close].Trim(), i));
                i = close + 1;
                continue;
            }

            if (char.IsDigit(c) || (c == '.' && i + 1 < s.Length && char.IsDigit(s[i + 1])))
            {
                var start = i;
                while (i < s.Length && (char.IsDigit(s[i]) || s[i] == '.')) i++;
                tokens.Add(new Token(TokenKind.Number, s[start..i], start));
                continue;
            }

            if (char.IsLetter(c) || c == '_')
            {
                var start = i;
                while (i < s.Length && (char.IsLetterOrDigit(s[i]) || s[i] is '_' or '.')) i++;
                var text = s[start..i];

                // Parantezsiz "tablo.kolon" yazımı da başvuru sayılır.
                tokens.Add(new Token(
                    text.Contains('.') ? TokenKind.Reference : TokenKind.Identifier, text, start));
                continue;
            }

            switch (c)
            {
                case '(': tokens.Add(new Token(TokenKind.LParen, "(", i)); i++; continue;
                case ')': tokens.Add(new Token(TokenKind.RParen, ")", i)); i++; continue;
                case ',': case ';': tokens.Add(new Token(TokenKind.Comma, ",", i)); i++; continue;
                case '+': case '-': case '*': case '/': case '%': case '^':
                    tokens.Add(new Token(TokenKind.Operator, c.ToString(), i)); i++; continue;
                default:
                    throw new FormulaException($"{i + 1}. karakterde beklenmeyen simge: '{c}'.");
            }
        }

        tokens.Add(new Token(TokenKind.End, "", s.Length));
        return tokens;
    }

    // -- özyinelemeli iniş --------------------------------------------------

    private sealed class Impl(List<Token> tokens)
    {
        private int _pos;

        private Token Current => tokens[_pos];
        private Token Next() => tokens[_pos++];

        public void ExpectEnd()
        {
            if (Current.Kind != TokenKind.End)
                throw new FormulaException(
                    $"{Current.Position + 1}. karakterden sonrası çözümlenemedi: '{Current.Text}'.");
        }

        /// <summary>toplama düzeyi: <c>a + b - c</c></summary>
        public FormulaNode ParseExpression()
        {
            var left = ParseTerm();
            while (Current.Kind == TokenKind.Operator && Current.Text is "+" or "-")
            {
                var op = Next().Text[0];
                left = new BinaryNode(op, left, ParseTerm());
            }
            return left;
        }

        /// <summary>çarpma düzeyi: <c>a * b / c % d</c></summary>
        private FormulaNode ParseTerm()
        {
            var left = ParsePower();
            while (Current.Kind == TokenKind.Operator && Current.Text is "*" or "/" or "%")
            {
                var op = Next().Text[0];
                left = new BinaryNode(op, left, ParsePower());
            }
            return left;
        }

        /// <summary>üs alma sağdan birleşir: <c>a ^ b ^ c</c></summary>
        private FormulaNode ParsePower()
        {
            var left = ParseUnary();
            if (Current.Kind == TokenKind.Operator && Current.Text == "^")
            {
                Next();
                return new BinaryNode('^', left, ParsePower());
            }
            return left;
        }

        private FormulaNode ParseUnary()
        {
            if (Current.Kind == TokenKind.Operator && Current.Text is "+" or "-")
            {
                var op = Next().Text[0];
                var operand = ParseUnary();
                return op == '-' ? new UnaryNode('-', operand) : operand;
            }
            return ParsePrimary();
        }

        private FormulaNode ParsePrimary()
        {
            var token = Next();

            switch (token.Kind)
            {
                case TokenKind.Number:
                    if (!decimal.TryParse(token.Text, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
                        throw new FormulaException($"Geçersiz sayı: '{token.Text}'.");
                    return new NumberNode(d);

                case TokenKind.Reference:
                    return ParseReference(token.Text, token.Position);

                case TokenKind.LParen:
                {
                    var inner = ParseExpression();
                    Expect(TokenKind.RParen, ")");
                    return inner;
                }

                case TokenKind.Identifier:
                    return ParseCall(token);

                default:
                    throw new FormulaException(
                        $"{token.Position + 1}. karakterde beklenmeyen ifade: '{token.Text}'.");
            }
        }

        private FormulaNode ParseCall(Token nameToken)
        {
            var name = nameToken.Text;

            if (Current.Kind != TokenKind.LParen)
                throw new FormulaException(
                    $"'{name}' bir tablo.kolon başvurusu değil. Kolon için [tablo.kolon] yazın, " +
                    "işlev için parantez açın.");

            Next(); // (

            var args = new List<FormulaNode>();
            if (Current.Kind != TokenKind.RParen)
            {
                args.Add(ParseExpression());
                while (Current.Kind == TokenKind.Comma)
                {
                    Next();
                    args.Add(ParseExpression());
                }
            }
            Expect(TokenKind.RParen, ")");

            if (IsAggregate(name))
            {
                if (args.Count != 1 || args[0] is not ColumnNode col)
                    throw new FormulaException(
                        $"'{name}' yalnızca tek bir kolon başvurusuna uygulanabilir. " +
                        $"Örnek: {name.ToUpperInvariant()}([tablo.kolon]).");
                return col with { Aggregate = name.ToUpperInvariant() };
            }

            if (!Functions.TryGetValue(name, out var arity))
                throw new FormulaException($"Bilinmeyen işlev: '{name}'.");

            if (arity >= 0 && args.Count != arity)
                throw new FormulaException($"'{name}' işlevi {arity} argüman bekler, {args.Count} verildi.");
            if (arity < 0 && args.Count == 0)
                throw new FormulaException($"'{name}' işlevi en az bir argüman bekler.");

            return new FunctionNode(name.ToUpperInvariant(), args);
        }

        private static ColumnNode ParseReference(string raw, int position)
        {
            var parts = raw.Split('.', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
                throw new FormulaException(
                    $"{position + 1}. karakterdeki '{raw}' başvurusu 'tablo.kolon' biçiminde olmalı.");
            return new ColumnNode(parts[0], parts[1]);
        }

        private void Expect(TokenKind kind, string what)
        {
            if (Current.Kind != kind)
                throw new FormulaException($"{Current.Position + 1}. karakterde '{what}' bekleniyordu.");
            Next();
        }
    }

    /// <summary>Ağaçtaki tüm kolon başvurularını toplar.</summary>
    public static IEnumerable<ColumnNode> CollectColumns(FormulaNode node) => node switch
    {
        ColumnNode c => new[] { c },
        UnaryNode u => CollectColumns(u.Operand),
        BinaryNode b => CollectColumns(b.Left).Concat(CollectColumns(b.Right)),
        FunctionNode f => f.Args.SelectMany(CollectColumns),
        _ => Array.Empty<ColumnNode>()
    };

    /// <summary>Ağacı okunabilir metne geri çevirir (doğrulama ekranı için).</summary>
    public static string ToDisplayString(FormulaNode node)
    {
        var sb = new StringBuilder();
        Write(node, sb);
        return sb.ToString();

        static void Write(FormulaNode n, StringBuilder sb)
        {
            switch (n)
            {
                case NumberNode num:
                    sb.Append(num.Value.ToString(CultureInfo.InvariantCulture));
                    break;
                case ColumnNode c:
                    if (c.Aggregate != "AVG") sb.Append(c.Aggregate).Append('(');
                    sb.Append('[').Append(c.Table).Append('.').Append(c.Column).Append(']');
                    if (c.Aggregate != "AVG") sb.Append(')');
                    break;
                case UnaryNode u:
                    sb.Append(u.Op);
                    Write(u.Operand, sb);
                    break;
                case BinaryNode b:
                    sb.Append('(');
                    Write(b.Left, sb);
                    sb.Append(' ').Append(b.Op).Append(' ');
                    Write(b.Right, sb);
                    sb.Append(')');
                    break;
                case FunctionNode f:
                    sb.Append(f.Name).Append('(');
                    for (var i = 0; i < f.Args.Count; i++)
                    {
                        if (i > 0) sb.Append(", ");
                        Write(f.Args[i], sb);
                    }
                    sb.Append(')');
                    break;
            }
        }
    }
}
