// OSOS / hava durumu ham JSON sonuçlarını tabloya ve grafiğe çevirir.

export type Row = Record<string, unknown>;

export interface ResultTable {
  columns: string[];
  rows: Row[];
}

/** JSON içindeki ilk "nesne dizisi"ni bulur (OSOS yanıtları farklı sarmalayıcılarla gelir). */
function findFirstObjectArray(el: unknown): Row[] | null {
  if (Array.isArray(el)) {
    return el.some((i) => i !== null && typeof i === "object" && !Array.isArray(i)) ? (el as Row[]) : null;
  }
  if (el !== null && typeof el === "object") {
    for (const v of Object.values(el)) {
      const r = findFirstObjectArray(v);
      if (r) return r;
    }
  }
  return null;
}

export function parseResult(json: string | null | undefined): ResultTable | null {
  if (!json || !json.trim()) return null;
  try {
    const arr = findFirstObjectArray(JSON.parse(json));
    if (!arr) return null;
    const columns: string[] = [];
    const rows: Row[] = [];
    for (const item of arr) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
      for (const k of Object.keys(item)) if (!columns.includes(k)) columns.push(k);
      rows.push(item);
    }
    return { columns, rows };
  } catch {
    return null;
  }
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());

export interface ChartColumns {
  numeric: string[];
  labels: string[];
  /** Tarih/saat içeren ilk etiket sütunu (varsayılan x ekseni). */
  defaultLabel: string;
}

export function chartColumns(table: ResultTable): ChartColumns {
  const numeric: string[] = [];
  const labels: string[] = [];
  const { rows } = table;
  if (rows.length === 0) return { numeric, labels, defaultLabel: "" };

  for (const key of Object.keys(rows[0])) {
    const isNum =
      rows.slice(0, 10).some((r) => toNumber(r[key]) !== null) &&
      rows.every((r) => !(key in r) || toNumber(r[key]) !== null || isEmpty(r[key]));
    (isNum ? numeric : labels).push(key);
  }
  const defaultLabel = labels.find((c) => /date|tarih|time/i.test(c)) ?? "";
  return { numeric, labels, defaultLabel };
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export function buildSeries(table: ResultTable, valueCol: string, labelCol: string): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  table.rows.forEach((r, i) => {
    const v = toNumber(r[valueCol]);
    if (v === null) return;
    out.push({ label: labelCol ? cellText(r[labelCol]) : String(i + 1), value: v });
  });
  return out;
}
