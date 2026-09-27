import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { matches } from "../format";
import {
  normalizeNumber,
  parenBalance,
  parseExpression,
  toExpression,
  Token,
  type FieldLookup,
  type FormulaToken,
} from "../formula";
import type { FormulaSourceDto, FormulaSourceFieldDto } from "../types";

/**
 * Sürükle-bırak formül oluşturucunun görünümden bağımsız mantığı. Kullanıcı
 * tablo/kolon adı yazmaz: soldaki listeden veri alanlarını, araç çubuğundan
 * işlemleri sürükler (ya da tıklar). Çıktı, sunucunun beklediği ifade metnidir.
 *
 * Her şablon kendi bileşenleriyle çizer; sürükleme davranışı `*Props`
 * yardımcılarıyla verilir.
 */

interface DragPayload {
  create?: () => FormulaToken[];
  moveFrom?: number;
  cursorOffset: number;
}

export interface VisibleSource {
  source: FormulaSourceDto;
  fields: FormulaSourceFieldDto[];
}

// Firefox, dataTransfer'a veri yazılmadan sürüklemeyi başlatmaz.
function prime(e: DragEvent) {
  try {
    e.dataTransfer.setData("text/plain", "");
    e.dataTransfer.effectAllowed = "copyMove";
  } catch {
    /* yok say */
  }
}

export function useFormulaBuilder(options: {
  expression: string;
  onChange: (expression: string) => void;
  sources: FormulaSourceDto[] | null;
  lookup: FieldLookup;
}) {
  const { expression, onChange, sources, lookup } = options;

  const [tokens, setTokens] = useState<FormulaToken[]>(() => parseExpression(expression) ?? []);
  const [textOnly, setTextOnly] = useState(() => parseExpression(expression) === null);
  const [rawText, setRawText] = useState(expression);
  const [cursor, setCursor] = useState(tokens.length);
  const [hover, setHover] = useState(-1);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [search, setSearch] = useState("");
  const [onlyWithData, setOnlyWithData] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const lastExpression = useRef(expression);

  // Dışarıdan yeni bir ifade geldi (düzenle / yeni): parçalara ayır.
  useEffect(() => {
    if (expression === lastExpression.current) return;
    lastExpression.current = expression;
    const parsed = parseExpression(expression);
    setRawText(expression);
    setTextOnly(parsed === null);
    setTokens(parsed ?? []);
    setCursor(parsed?.length ?? 0);
  }, [expression]);

  function commit(next: FormulaToken[], nextCursor?: number) {
    setTokens(next);
    if (nextCursor !== undefined) setCursor(nextCursor);
    const expr = toExpression(next);
    lastExpression.current = expr;
    setRawText(expr);
    onChange(expr);
  }

  // ---- sol panel ----

  const anyWithData = useMemo(() => (sources ?? []).some((s) => s.rowCount > 0), [sources]);

  const visibleSources: VisibleSource[] = useMemo(() => {
    const q = search.trim();
    const out: VisibleSource[] = [];
    for (const s of sources ?? []) {
      if (onlyWithData && anyWithData && s.rowCount === 0 && q.length === 0) continue;
      if (!q) {
        out.push({ source: s, fields: s.fields });
        continue;
      }
      const hit = matches(s.title, q) || matches(s.tag, q) || matches(s.tableName, q);
      const fields = hit ? s.fields : s.fields.filter((f) => matches(f.label, q) || matches(f.column, q));
      if (fields.length) out.push({ source: s, fields });
    }
    return out;
  }, [sources, search, onlyWithData, anyWithData]);

  const searching = search.trim().length > 0;
  const isOpen = (table: string) => searching || expanded.has(table);
  const toggleSource = (table: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(table)) next.add(table);
      return next;
    });

  // ---- düzenleme ----

  function insertAt(index: number, items: FormulaToken[], cursorOffset = -1) {
    let base = tokens;
    if (textOnly) {
      // Metin modundaki çözümlenemeyen ifade, görsel düzenlemeye başlanınca bırakılır.
      base = [];
      setTextOnly(false);
      index = 0;
    }
    const next = [...base.slice(0, index), ...items, ...base.slice(index)];
    // İşlev kalıbında imleç parantezin içine konur; sıradaki parça oraya girer.
    commit(next, index + (cursorOffset >= 0 ? cursorOffset : items.length));
  }

  const insert = (items: FormulaToken[], cursorOffset = -1) =>
    insertAt(Math.min(Math.max(cursor, 0), tokens.length), items, cursorOffset);

  function removeAt(index: number) {
    if (index < 0 || index >= tokens.length) return;
    commit(
      tokens.filter((_, i) => i !== index),
      cursor > index ? cursor - 1 : cursor,
    );
  }

  const update = (id: number, patch: Partial<FormulaToken>) =>
    commit(tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const setAggregate = (id: number, aggregate: string) => update(id, { aggregate: aggregate || "AVG" });
  const setNumber = (id: number, text: string) => update(id, { text: normalizeNumber(text) });

  function clear() {
    setTextOnly(false);
    commit([], 0);
  }

  function applyText(text = rawText) {
    const parsed = parseExpression(text);
    setTextOnly(parsed === null);
    setTokens(parsed ?? []);
    setCursor(parsed?.length ?? 0);
    lastExpression.current = text;
    onChange(text);
  }

  function onCanvasKey(e: KeyboardEvent) {
    const k = e.key;
    const handled = () => e.preventDefault();
    switch (k) {
      case "Backspace":
        handled();
        if (cursor > 0) removeAt(cursor - 1);
        return;
      case "Delete":
        handled();
        removeAt(cursor);
        return;
      case "ArrowLeft":
        handled();
        setCursor(Math.max(0, cursor - 1));
        return;
      case "ArrowRight":
        handled();
        setCursor(Math.min(tokens.length, cursor + 1));
        return;
      case "Home":
        handled();
        setCursor(0);
        return;
      case "End":
        handled();
        setCursor(tokens.length);
        return;
      case "(":
        handled();
        insert([Token.open()]);
        return;
      case ")":
        handled();
        insert([Token.close()]);
        return;
      case "+":
      case "-":
      case "*":
      case "/":
      case "^":
      case "%":
        handled();
        insert([Token.op(k)]);
        return;
    }
    if (k.length === 1 && (/\d/.test(k) || k === "," || k === ".")) {
      handled();
      // Sayı yazımı: imleçten önce sayı varsa ona eklenir.
      const prev = cursor > 0 ? tokens[cursor - 1] : null;
      if (prev?.kind === "number") {
        const text =
          k === "," || k === "." ? (prev.text.includes(".") ? prev.text : prev.text + ".") : prev.text + k;
        commit(tokens.map((t) => (t.id === prev.id ? { ...t, text } : t)));
      } else if (/\d/.test(k)) {
        insert([Token.number(k)]);
      }
    }
  }

  // ---- sürükle-bırak ----

  function endDrag() {
    setDrag(null);
    setHover(-1);
  }

  function dropAt(index: number) {
    const d = drag;
    endDrag();
    if (!d) return;
    if (d.moveFrom !== undefined) {
      const from = d.moveFrom;
      if (from === index || from + 1 === index) return;
      const next = [...tokens];
      const [tok] = next.splice(from, 1);
      const to = from < index ? index - 1 : index;
      next.splice(to, 0, tok);
      commit(next, to + 1);
    } else if (d.create) {
      insertAt(index, d.create(), d.cursorOffset);
    }
  }

  function dropOnPalette() {
    const d = drag;
    endDrag();
    if (d?.moveFrom !== undefined) removeAt(d.moveFrom);
  }

  const isMoving = drag?.moveFrom !== undefined;

  /** Soldaki veri alanları ve araç çubuğundaki parçalar: sürüklenir veya tıklanır. */
  function chipProps(create: () => FormulaToken[], cursorOffset = -1) {
    return {
      role: "button" as const,
      tabIndex: 0,
      draggable: true,
      onDragStart: (e: DragEvent) => {
        prime(e);
        setDrag({ create, cursorOffset });
      },
      onDragEnd: endDrag,
      onClick: () => insert(create(), cursorOffset),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          insert(create(), cursorOffset);
        }
      },
    };
  }

  /** Formül alanındaki bir parça: yerini değiştirmek için sürüklenir. */
  function tokenProps(index: number) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        e.stopPropagation();
        prime(e);
        setDrag({ moveFrom: index, cursorOffset: -1 });
      },
      onDragEnd: endDrag,
      onClick: (e: { stopPropagation(): void }) => {
        e.stopPropagation();
        setCursor(index + 1);
      },
    };
  }

  /** Parçanın sol/sağ yarısına bırakınca önüne/arkasına ekler. */
  function halfProps(index: number, side: "left" | "right") {
    const target = side === "left" ? index : index + 1;
    return {
      onDragEnter: (e: DragEvent) => {
        e.stopPropagation();
        setHover(target);
      },
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropAt(target);
      },
    };
  }

  /** Parçalar arasındaki boşluk (imleç ve bırakma noktası). */
  function gapProps(index: number) {
    return {
      onClick: (e: { stopPropagation(): void }) => {
        e.stopPropagation();
        setCursor(index);
      },
      onDragEnter: (e: DragEvent) => {
        e.stopPropagation();
        setHover(index);
      },
      onDragOver: (e: DragEvent) => e.preventDefault(),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropAt(index);
      },
    };
  }

  const canvasProps = {
    tabIndex: 0,
    "aria-label": "Formül alanı. Silmek için Backspace, gezinmek için ok tuşları.",
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragEnter: () => setHover(tokens.length),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      dropAt(tokens.length);
    },
    onClick: () => setCursor(tokens.length),
    onKeyDown: onCanvasKey,
  };

  /** Sol panel: taşınan parça buraya bırakılırsa formülden çıkarılır. */
  const paletteProps = {
    onDragEnter: () => setHover(-1),
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      dropOnPalette();
    },
  };

  return {
    tokens,
    textOnly,
    rawText,
    setRawText,
    applyText,
    cursor,
    hover,
    dragging: drag !== null,
    isMoving,
    movingIndex: drag?.moveFrom ?? -1,
    balance: parenBalance(tokens),
    lookup,
    // sol panel
    search,
    setSearch,
    searching,
    onlyWithData,
    setOnlyWithData,
    anyWithData,
    visibleSources,
    isOpen,
    toggleSource,
    // düzenleme
    insert,
    removeAt,
    setAggregate,
    setNumber,
    clear,
    // sürükleme yardımcıları
    chipProps,
    tokenProps,
    halfProps,
    gapProps,
    canvasProps,
    paletteProps,
  };
}

export type FormulaBuilderState = ReturnType<typeof useFormulaBuilder>;
