// Aranabilir tesisat seçici: yazdıkça ünvan / abone no / Serno ile filtreler, listenin tamamını göstermez.

import { inputClass } from "@/components/fyblue/ui";
import { cn } from "@/utils";
import { AUTO_SUBSCRIPTION_TEXT, useSubscriptionPicker, type SubscriptionItem } from "@fyblue/core";
import { useEffect, useRef } from "react";

export default function SubscriptionPicker({
  subs,
  value,
  onChange,
  allowAuto = true,
}: {
  subs: SubscriptionItem[];
  value: number;
  onChange: (serno: number) => void;
  allowAuto?: boolean;
}) {
  const p = useSubscriptionPicker(subs, value, onChange);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!p.open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) p.setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [p.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = "block w-full truncate px-4 py-2 text-start text-sm hover:bg-gray-100 dark:hover:bg-white/5";

  return (
    <div ref={box} className="relative">
      <input
        className={inputClass}
        value={p.open ? p.query : p.selectedText}
        placeholder="Ünvan, abone no veya serno yazın…"
        onFocus={(e) => {
          p.setOpen(true);
          e.target.select();
        }}
        onChange={(e) => p.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") p.setOpen(false);
          if (e.key === "Enter" && p.results[0]) {
            e.preventDefault();
            p.pick(p.results[0].serno);
          }
        }}
      />
      {p.open && (
        <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[20rem] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          {allowAuto && !p.query && (
            <button type="button" className={cn(item, "font-medium text-brand-500")} onClick={() => p.pick(0)}>
              {AUTO_SUBSCRIPTION_TEXT}
            </button>
          )}
          {p.results.map((s) => (
            <button
              key={s.serno}
              type="button"
              title={p.text(s)}
              className={cn(item, s.serno === value ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15" : "text-gray-700 dark:text-gray-300")}
              onClick={() => p.pick(s.serno)}
            >
              {s.label}
              <span className="ms-2 text-theme-xs text-gray-500 dark:text-gray-400">
                {s.aboneNo ? `Abone: ${s.aboneNo}` : `#${s.serno}`}
              </span>
            </button>
          ))}
          {p.results.length === 0 && <div className="px-4 py-2 text-sm text-gray-500">Eşleşen tesisat yok.</div>}
          {p.matchCount > p.results.length && (
            <div className="border-t border-gray-100 px-4 py-2 text-theme-xs text-gray-500 dark:border-gray-800">
              {p.matchCount} sonuçtan {p.results.length} tanesi gösteriliyor — aramayı daraltın.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
