/** /api/osos/me'den gelen abone/tesisat listesini (Serno, Etiket, Abone no) çiftlerine çevirir. */

export interface SubscriptionItem {
  serno: number;
  label: string;
  /** Abone/tesisat numarası (OSOS IdentifierValue); yoksa boş. */
  aboneNo: string;
}

function toLong(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return null;
}

// OSOS alan adları PascalCase gelir; ASP.NET ham JsonElement'i olduğu gibi iletir.
function get(obj: Record<string, unknown>, name: string): unknown {
  if (name in obj) return obj[name];
  const key = Object.keys(obj).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? obj[key] : undefined;
}

// Aboneliğin kendi Serno'su değil, sahibine ait Serno'lar (yanlışlıkla seçilmesin).
const FOREIGN_SERNO = /^(customer|owner|parent|user|company|distribution)/i;

function extractSerno(obj: Record<string, unknown>): number {
  for (const name of ["SubscriptionSerno", "Serno"]) {
    const s = toLong(get(obj, name));
    if (s !== null) return s;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase().includes("serno") && !FOREIGN_SERNO.test(k)) {
      const s = toLong(v);
      if (s !== null) return s;
    }
  }
  const s = toLong(get(obj, "Id"));
  return s ?? 0;
}

const ABONE_FIELDS = ["IdentifierValue", "AboneNo", "SubscriberNo", "TesisatNo", "InstallationNo", "IdentifierValueSec"];

function extractAboneNo(obj: Record<string, unknown>): string {
  for (const f of ABONE_FIELDS) {
    const v = get(obj, f);
    if ((typeof v === "string" && v.trim()) || typeof v === "number") return String(v).trim();
  }
  return "";
}

const SKIP = new Set(["RecordStatus", "DefinitionType", "AnnounceType"]);
const PREFER = ["Unvan", "Title", "MusteriUnvan", "AboneAdi", "Adres", "Address", "Name", "SayacSeriNo"];

function buildLabel(obj: Record<string, unknown>): string {
  for (const p of PREFER) {
    const v = get(obj, p);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (SKIP.has(k)) continue;
    if (typeof v === "string" && v.trim()) {
      parts.push(v.trim());
      if (parts.length === 2) break;
    }
  }
  return parts.length ? parts.join(" · ") : "Tesisat";
}

export function parseSubscriptions(subs: unknown): SubscriptionItem[] {
  if (!Array.isArray(subs)) return [];
  return subs
    .filter((i): i is Record<string, unknown> => i !== null && typeof i === "object" && !Array.isArray(i))
    .map((i) => ({ serno: extractSerno(i), label: buildLabel(i), aboneNo: extractAboneNo(i) }));
}

/** Seçim listesinde gösterilecek metin: "ÜNVAN (Abone: 123)"; abone no yoksa Serno. */
export function subscriptionText(s: SubscriptionItem): string {
  if (s.aboneNo) return `${s.label} (Abone: ${s.aboneNo})`;
  return s.serno > 0 ? `${s.label} (#${s.serno})` : s.label;
}

const norm = (v: string) => v.toLocaleLowerCase("tr-TR");

/** Yazdıkça filtreleme: ünvan, abone no ve Serno içinde arar (Türkçe büyük/küçük harf duyarsız). */
export function filterSubscriptions(subs: SubscriptionItem[], query: string, limit = 50): SubscriptionItem[] {
  const q = norm(query.trim());
  const hits = q
    ? subs.filter((s) => norm(s.label).includes(q) || s.aboneNo.includes(q) || String(s.serno).includes(q))
    : subs;
  return hits.slice(0, limit);
}
