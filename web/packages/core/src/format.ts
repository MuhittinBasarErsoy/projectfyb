// Türkçe biçimlendirme ve tarih yardımcıları.

const pad = (n: number) => String(n).padStart(2, "0");

/** `yyyy-MM-dd` (input[type=date] biçimi), yerel saate göre. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

/**
 * EPİAŞ tüm tarihleri Türkiye saatiyle (+03:00) bekler.
 * `endOfDay` verilirse günün son saniyesi kullanılır.
 */
export function toOffset(date: string | null | undefined, endOfDay = false): string | null {
  if (!date) return null;
  return `${date}T${endOfDay ? "23:59:59" : "00:00:00"}+03:00`;
}

const tr = "tr-TR";

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(v);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : fallback;
}

export function fmtShortDate(v: string | Date | null | undefined, fallback = ""): string {
  const d = toDate(v);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}` : fallback;
}

export function fmtDateTime(v: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(v);
  return d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : fallback;
}

export function fmtShortDateTime(v: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(v);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : fallback;
}

export function fmtLongDate(v: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString(tr, { day: "numeric", month: "long", year: "numeric" }) : fallback;
}

export function fmtInt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString(tr);
}

export function fmtDecimal(n: number | null | undefined, digits = 4, fallback = "—"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return fallback;
  return n.toLocaleString(tr, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Tablo hücresi için genel biçimlendirme (EPİAŞ veri tabloları). */
export function fmtCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? fmtInt(value) : fmtDecimal(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return fmtDateTime(value, value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Türkçe karakterleri sadeleştirip `ptf_x_tuketim` biçimine çevirir. */
export function slug(text: string | null | undefined): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  let out = "";
  for (const ch of (text ?? "").toLocaleLowerCase(tr)) {
    const c = map[ch] ?? ch;
    if (/[a-z0-9]/.test(c)) out += c;
    else if (out.length > 0 && !out.endsWith("_")) out += "_";
  }
  out = out.replace(/^_+|_+$/g, "");
  return out.length > 60 ? out.slice(0, 60).replace(/_+$/, "") : out;
}

/** Büyük/küçük harf ve aksan duyarsız arama ("tuketim" → "Tüketim"). */
export function matches(text: string | null | undefined, query: string): boolean {
  if (!text) return false;
  const norm = (s: string) =>
    s
      .toLocaleLowerCase(tr)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ı/g, "i");
  return norm(text).includes(norm(query));
}
