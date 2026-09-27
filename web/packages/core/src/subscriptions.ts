/** /api/osos/me'den gelen abone/tesisat listesini (Serno, Etiket) çiftlerine çevirir. */

export interface SubscriptionItem {
  serno: number;
  label: string;
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

function extractSerno(obj: Record<string, unknown>): number {
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase().includes("serno")) {
      const s = toLong(v);
      if (s !== null) return s;
    }
  }
  for (const name of ["SubscriptionSerno", "Serno", "Id"]) {
    const s = toLong(get(obj, name));
    if (s !== null) return s;
  }
  return 0;
}

const SKIP = new Set(["RecordStatus", "DefinitionType", "AnnounceType"]);
const PREFER = [
  "Unvan",
  "Title",
  "MusteriUnvan",
  "AboneAdi",
  "Adres",
  "Address",
  "TesisatNo",
  "Tesisat",
  "Identifier",
  "IdentifierValue",
  "Name",
  "SayacSeriNo",
];

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
    .map((i) => ({ serno: extractSerno(i), label: buildLabel(i) }));
}
