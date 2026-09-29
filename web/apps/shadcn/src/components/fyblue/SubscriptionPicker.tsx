// Aranabilir tesisat seçici: yazdıkça ünvan / abone no / Serno ile filtreler, listenin tamamını göstermez.

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

  const item = "block w-full truncate rounded-sm px-2 py-1.5 text-start text-sm hover:bg-accent hover:text-accent-foreground";

  return (
    <div ref={box} className="relative">
      <Input
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
        <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[20rem] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {allowAuto && !p.query && (
            <button type="button" className={cn(item, "font-medium text-primary")} onClick={() => p.pick(0)}>
              {AUTO_SUBSCRIPTION_TEXT}
            </button>
          )}
          {p.results.map((s) => (
            <button
              key={s.serno}
              type="button"
              title={p.text(s)}
              className={cn(item, s.serno === value && "bg-accent")}
              onClick={() => p.pick(s.serno)}
            >
              {s.label}
              <span className="ms-2 text-xs text-muted-foreground">{s.aboneNo ? `Abone: ${s.aboneNo}` : `#${s.serno}`}</span>
            </button>
          ))}
          {p.results.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Eşleşen tesisat yok.</div>}
          {p.matchCount > p.results.length && (
            <div className="mt-1 border-t px-2 py-1.5 text-xs text-muted-foreground">
              {p.matchCount} sonuçtan {p.results.length} tanesi gösteriliyor — aramayı daraltın.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
