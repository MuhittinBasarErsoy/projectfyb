/**
 * Formül oluşturucunun parça modeli. Oluşturucu düz bir parça listesi tutar;
 * sunucuya giden ifade metni bu listeden üretilir, kayıtlı ifadeler de yeniden
 * parçalara ayrılır. Asıl doğrulama sunucudaki ayrıştırıcıdadır.
 */

import type { FormulaSourceDto } from "./types";

export type TokenKind = "field" | "number" | "operator" | "open" | "close" | "comma" | "function";

export interface FormulaToken {
  /** React anahtarı; ifadeye yazılmaz. */
  id: number;
  kind: TokenKind;
  /** İşleç (`+`), işlev adı (`ABS`) ya da sayı metni. */
  text: string;
  table?: string;
  column?: string;
  /** Aynı gün/saate birden çok satır düştüğünde uygulanacak birleştirme. */
  aggregate: string;
}

let seq = 0;
const make = (kind: TokenKind, text: string, extra: Partial<FormulaToken> = {}): FormulaToken => ({
  id: ++seq,
  kind,
  text,
  aggregate: "AVG",
  ...extra,
});

export const Token = {
  field: (table: string, column: string) => make("field", "", { table, column }),
  number: (text: string) => make("number", text),
  op: (op: string) => make("operator", op),
  open: () => make("open", "("),
  close: () => make("close", ")"),
  comma: () => make("comma", ","),
  fn: (name: string) => make("function", name),
};

export const tokenKey = (t: FormulaToken) => `${t.table}.${t.column}`;

export interface FunctionInfo {
  name: string;
  label: string;
  hint: string;
  args: number;
}

export const AGGREGATES: { code: string; label: string; hint: string }[] = [
  { code: "AVG", label: "ortalama", hint: "Aynı gün/saatteki satırların ortalaması" },
  { code: "SUM", label: "toplam", hint: "Aynı gün/saatteki satırların toplamı" },
  { code: "MIN", label: "en az", hint: "Aynı gün/saatteki en küçük değer" },
  { code: "MAX", label: "en çok", hint: "Aynı gün/saatteki en büyük değer" },
  { code: "COUNT", label: "adet", hint: "Aynı gün/saatteki satır sayısı" },
];

export const OPERATORS: { op: string; symbol: string; hint: string }[] = [
  { op: "+", symbol: "+", hint: "Topla" },
  { op: "-", symbol: "−", hint: "Çıkar" },
  { op: "*", symbol: "×", hint: "Çarp" },
  { op: "/", symbol: "÷", hint: "Böl (sıfıra bölmede satır atlanır)" },
  { op: "^", symbol: "xʸ", hint: "Üssünü al" },
  { op: "%", symbol: "mod", hint: "Bölümden kalan" },
];

export const FUNCTIONS: FunctionInfo[] = [
  { name: "ROUND", label: "Yuvarla", hint: "Yuvarla(değer, basamak)", args: 2 },
  { name: "ABS", label: "Mutlak değer", hint: "Negatif işaretini kaldırır", args: 1 },
  { name: "GREATEST", label: "En büyüğü", hint: "Değerlerden büyük olanı", args: 2 },
  { name: "LEAST", label: "En küçüğü", hint: "Değerlerden küçük olanı", args: 2 },
  { name: "COALESCE", label: "Boşsa diğeri", hint: "İlk dolu değeri kullanır", args: 2 },
  { name: "SQRT", label: "Karekök", hint: "Karekök", args: 1 },
  { name: "POWER", label: "Üssü", hint: "Üssü(taban, üs)", args: 2 },
  { name: "FLOOR", label: "Aşağı yuvarla", hint: "Tam sayıya aşağı yuvarlar", args: 1 },
  { name: "CEILING", label: "Yukarı yuvarla", hint: "Tam sayıya yukarı yuvarlar", args: 1 },
  { name: "LOG", label: "Doğal log", hint: "ln(x)", args: 1 },
  { name: "EXP", label: "e üssü", hint: "eˣ", args: 1 },
  { name: "SIGN", label: "İşaret", hint: "-1, 0 veya 1", args: 1 },
];

export const operatorSymbol = (op: string) => OPERATORS.find((o) => o.op === op)?.symbol ?? op;
export const functionLabel = (name: string) =>
  FUNCTIONS.find((f) => f.name.toUpperCase() === name.toUpperCase())?.label ?? name;
export const aggregateLabel = (code: string) =>
  AGGREGATES.find((a) => a.code === code)?.label ?? code.toLowerCase();

/** Bir işlevin boş kalıbı: `Yuvarla( ; 2 )` gibi. */
export function functionTemplate(f: FunctionInfo): FormulaToken[] {
  const list = [Token.fn(f.name)];
  for (let i = 1; i < f.args; i++) {
    list.push(Token.comma());
    if (f.name === "ROUND") list.push(Token.number("2"));
  }
  list.push(Token.close());
  return list;
}

// ---- metne çevirme ----

/** "1.234,5" / "0,5" gibi Türkçe yazımları `0.5` biçimine çevirir. */
export function normalizeNumber(text: string): string {
  let s = (text ?? "").trim().replace(/ /g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? String(n) : "0";
}

export function toExpression(tokens: FormulaToken[]): string {
  let out = "";
  for (const t of tokens) {
    let text: string;
    switch (t.kind) {
      case "field":
        text = t.aggregate === "AVG" ? `[${t.table}.${t.column}]` : `${t.aggregate}([${t.table}.${t.column}])`;
        break;
      case "number":
        text = normalizeNumber(t.text);
        break;
      case "function":
        text = t.text + "(";
        break;
      default:
        text = t.text;
    }
    const last = out[out.length - 1];
    if (out.length > 0 && last !== "(" && t.kind !== "close" && t.kind !== "comma") out += " ";
    out += text;
  }
  return out;
}

export function parenBalance(tokens: FormulaToken[]): number {
  return tokens.reduce(
    (sum, t) => sum + (t.kind === "open" || t.kind === "function" ? 1 : t.kind === "close" ? -1 : 0),
    0,
  );
}

// ---- metinden parçalara ----

type Lexeme = { kind: "r" | "n" | "o" | "(" | ")" | "," | "i"; text: string };

/** Sunucudaki sözcükleyicinin sadeleştirilmiş eşi. */
function lex(s: string): Lexeme[] | null {
  const list: Lexeme[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isLetter = (c: string) => /\p{L}/u.test(c);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "[") {
      const close = s.indexOf("]", i + 1);
      if (close < 0) return null;
      list.push({ kind: "r", text: s.slice(i + 1, close).trim() });
      i = close + 1;
      continue;
    }
    if (isDigit(c) || (c === "." && i + 1 < s.length && isDigit(s[i + 1]))) {
      const start = i;
      while (i < s.length && (isDigit(s[i]) || s[i] === ".")) i++;
      list.push({ kind: "n", text: s.slice(start, i) });
      continue;
    }
    if (isLetter(c) || c === "_") {
      const start = i;
      while (i < s.length && (isLetter(s[i]) || isDigit(s[i]) || s[i] === "_" || s[i] === ".")) i++;
      const text = s.slice(start, i);
      list.push({ kind: text.includes(".") ? "r" : "i", text });
      continue;
    }
    switch (c) {
      case "(":
        list.push({ kind: "(", text: "(" });
        break;
      case ")":
        list.push({ kind: ")", text: ")" });
        break;
      case ",":
      case ";":
        list.push({ kind: ",", text: "," });
        break;
      case "+":
      case "-":
      case "*":
      case "/":
      case "%":
      case "^":
        list.push({ kind: "o", text: c });
        break;
      default:
        return null;
    }
    i++;
  }
  return list;
}

function toField(raw: string): FormulaToken | null {
  const parts = raw
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length === 2 ? Token.field(parts[0], parts[1]) : null;
}

/**
 * İfade metnini parçalara ayırır. Oluşturucunun gösteremeyeceği bir yapı varsa
 * `null` döner; ekran bu durumda metin düzenleyiciye düşer.
 */
export function parseExpression(expression: string | null | undefined): FormulaToken[] | null {
  const result: FormulaToken[] = [];
  if (!expression || !expression.trim()) return result;
  const raw = lex(expression);
  if (!raw) return null;

  for (let i = 0; i < raw.length; i++) {
    const { kind, text } = raw[i];
    switch (kind) {
      case "r": {
        const f = toField(text);
        if (!f) return null;
        result.push(f);
        break;
      }
      case "n":
        result.push(Token.number(text));
        break;
      case "o":
        result.push(Token.op(text));
        break;
      case "(":
        result.push(Token.open());
        break;
      case ")":
        result.push(Token.close());
        break;
      case ",":
        result.push(Token.comma());
        break;
      case "i": {
        const name = text.toUpperCase();
        if (i + 1 >= raw.length || raw[i + 1].kind !== "(") return null;
        if (AGGREGATES.some((a) => a.code === name)) {
          // SUM([t.c]) → tek bir alan parçası
          if (i + 3 >= raw.length || raw[i + 2].kind !== "r" || raw[i + 3].kind !== ")") return null;
          const agg = toField(raw[i + 2].text);
          if (!agg) return null;
          agg.aggregate = name;
          result.push(agg);
          i += 3;
        } else if (FUNCTIONS.some((f) => f.name === name)) {
          result.push(Token.fn(name));
          i += 1;
        } else return null;
        break;
      }
    }
  }
  return result;
}

// ---- alan adları ----

export interface FieldInfo {
  label: string;
  source: string;
}

/** `tablo.kolon` → kullanıcıya gösterilen ad ve kaynak başlığı. */
export class FieldLookup {
  private map = new Map<string, FieldInfo>();

  static readonly empty = new FieldLookup([]);

  constructor(sources: FormulaSourceDto[]) {
    for (const s of sources)
      for (const f of s.fields) {
        const key = `${s.tableName}.${f.column}`.toLowerCase();
        if (!this.map.has(key)) this.map.set(key, { label: f.label, source: s.title });
      }
  }

  find(t: FormulaToken): FieldInfo | null {
    return this.map.get(tokenKey(t).toLowerCase()) ?? null;
  }
}

export function granularity(s: FormulaSourceDto): string {
  return s.hasHour ? "saatlik" : s.hasDate ? "günlük" : "tarihsiz";
}
