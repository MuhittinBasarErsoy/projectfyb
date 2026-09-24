namespace Epias.Core.Formulas;

public abstract record FormulaNode;

/// <summary>Sabit sayı.</summary>
public sealed record NumberNode(decimal Value) : FormulaNode;

/// <summary>
/// <c>[tablo.kolon]</c> başvurusu. <paramref name="Aggregate"/>, hizalama
/// anahtarı başına birden çok satır düştüğünde uygulanacak işlevdir.
/// </summary>
public sealed record ColumnNode(string Table, string Column, string Aggregate = "AVG") : FormulaNode;

public sealed record UnaryNode(char Op, FormulaNode Operand) : FormulaNode;

public sealed record BinaryNode(char Op, FormulaNode Left, FormulaNode Right) : FormulaNode;

public sealed record FunctionNode(string Name, IReadOnlyList<FormulaNode> Args) : FormulaNode;

public sealed class FormulaException(string message) : Exception(message);
