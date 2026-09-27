'use client';

// Sürükle-bırak formül oluşturucu — mantık @fyblue/core'da, görünüm shadcn/ui bileşenleriyle.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AGGREGATES,
  aggregateLabel,
  fmtInt,
  FUNCTIONS,
  functionLabel,
  functionTemplate,
  granularity,
  OPERATORS,
  operatorSymbol,
  parseExpression,
  Token,
  tokenKey,
  useFormulaBuilder,
  type FieldLookup,
  type FormulaSourceDto,
  type FormulaToken,
} from "@fyblue/core";
import { IconChevronRight, IconDatabase, IconInfoCircle, IconMathFunction, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { Fragment, useMemo } from "react";
import { SkeletonRows } from "./ui";

type B = ReturnType<typeof useFormulaBuilder>;

const chip =
  "inline-flex min-h-7 cursor-grab items-center gap-1 border bg-background px-2 py-0.5 text-xs font-medium select-none hover:bg-muted active:cursor-grabbing";

function tokenClass(t: FormulaToken, known: boolean) {
  switch (t.kind) {
    case "field":
      return known ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive bg-destructive/10";
    case "number":
      return "border-amber-500/40 bg-amber-500/10";
    case "function":
      return "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "operator":
      return "min-w-8 justify-center bg-background font-mono text-base";
    default:
      return "border-transparent bg-transparent px-1 font-mono text-lg text-muted-foreground";
  }
}

export function FormulaBuilder({
  expression,
  onChange,
  sources,
  lookup,
}: {
  expression: string;
  onChange: (expression: string) => void;
  sources: FormulaSourceDto[] | null;
  lookup: FieldLookup;
}) {
  const b = useFormulaBuilder({ expression, onChange, sources, lookup });
  let lastTag: string | null = null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside
        {...b.paletteProps}
        className={cn(
          "relative flex max-h-[520px] min-h-0 flex-col overflow-hidden border",
          b.isMoving ? "border-destructive bg-destructive/5 border-dashed" : "bg-muted/30",
        )}
      >
        <div className="bg-background flex flex-col gap-2 border-b p-2">
          <div className="relative">
            <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input type="search" value={b.search} onChange={(e) => b.setSearch(e.target.value)} placeholder="Veri ara: PTF, tüketim, rüzgar…" className="pl-8" />
          </div>
          {b.anyWithData && (
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={b.onlyWithData} onCheckedChange={b.setOnlyWithData} />
              Yalnızca verisi çekilmiş olanlar
            </label>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {sources === null ? (
            <div className="p-2">
              <SkeletonRows rows={6} />
            </div>
          ) : (
            <>
              {b.visibleSources.length === 0 && (
                <p className="text-muted-foreground p-2 text-xs">
                  {b.searching ? "Aramanızla eşleşen veri alanı yok." : "Formülde kullanılabilecek veri tablosu yok. Önce Servisler sayfasından veri çekin."}
                </p>
              )}
              {b.visibleSources.slice(0, b.searching ? 60 : undefined).map(({ source: s, fields }) => {
                const showTag = s.tag !== lastTag;
                lastTag = s.tag;
                const open = b.isOpen(s.tableName);
                return (
                  <Fragment key={s.tableName}>
                    {showTag && <div className="text-muted-foreground px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase">{s.tag}</div>}
                    <button
                      type="button"
                      onClick={() => b.toggleSource(s.tableName)}
                      aria-expanded={open}
                      className="hover:bg-muted grid w-full grid-cols-[14px_1fr] gap-x-1.5 px-2 py-1.5 text-left"
                    >
                      <IconChevronRight className={cn("text-muted-foreground mt-0.5 size-3.5 transition-transform", open && "rotate-90")} />
                      <span className="text-xs font-medium">{s.title}</span>
                      <span className="text-muted-foreground col-start-2 text-[11px]">
                        {granularity(s)}
                        {s.rowCount > 0 ? ` · ${fmtInt(s.rowCount)} satır` : ""}
                      </span>
                    </button>
                    {open && (
                      <div className="flex flex-wrap gap-1 pr-2 pb-2 pl-6">
                        {fields.map((f) => (
                          <div
                            key={f.column}
                            {...b.chipProps(() => [Token.field(s.tableName, f.column)])}
                            title="Formüle eklemek için sürükleyin ya da tıklayın"
                            className={cn(chip, "border-emerald-500/40")}
                          >
                            <IconDatabase className="size-3 text-emerald-600" />
                            {f.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {b.searching && b.visibleSources.length > 60 && <p className="text-muted-foreground p-2 text-xs">İlk 60 tablo gösteriliyor, aramayı daraltın.</p>}
            </>
          )}
        </div>

        {b.isMoving && (
          <div className="bg-destructive pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 p-2 text-xs font-medium text-white">
            <IconTrash className="size-4" /> Formülden çıkarmak için buraya bırakın
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground w-12 text-[10px] font-semibold tracking-wider uppercase">İşlem</span>
            {OPERATORS.map((o) => (
              <div key={o.op} {...b.chipProps(() => [Token.op(o.op)])} title={o.hint} className={cn(chip, "min-w-8 justify-center font-mono text-sm")}>
                {o.symbol}
              </div>
            ))}
            <div {...b.chipProps(() => [Token.open()])} title="Parantez aç" className={cn(chip, "min-w-8 justify-center font-mono text-sm")}>
              (
            </div>
            <div {...b.chipProps(() => [Token.close()])} title="Parantez kapat" className={cn(chip, "min-w-8 justify-center font-mono text-sm")}>
              )
            </div>
            <div {...b.chipProps(() => [Token.number("1")])} title="Sabit bir sayı ekle" className={cn(chip, "text-amber-700 dark:text-amber-400")}>
              123 Sayı
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground w-12 text-[10px] font-semibold tracking-wider uppercase">İşlev</span>
            {FUNCTIONS.map((f) => (
              <div key={f.name} {...b.chipProps(() => functionTemplate(f), 1)} title={f.hint} className={cn(chip, "text-violet-700 dark:text-violet-300")}>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div
          {...b.canvasProps}
          className={cn(
            "group/canvas focus-visible:ring-ring/50 flex min-h-36 flex-wrap content-start items-center gap-y-1.5 border-2 border-dashed p-2.5 outline-none focus-visible:ring-3",
            b.dragging ? "border-primary bg-primary/5" : "border-border",
            (b.tokens.length === 0 || b.textOnly) && "content-center justify-center",
          )}
        >
          {b.textOnly ? (
            <div className="text-muted-foreground pointer-events-none flex max-w-md flex-col items-center gap-1 text-center text-sm">
              <IconInfoCircle className="size-5" />
              <strong className="text-foreground">Bu formül görsel olarak gösterilemiyor</strong>
              <span className="text-xs">Aşağıdaki metin kutusundan düzenleyebilir ya da temizleyip yeniden oluşturabilirsiniz.</span>
            </div>
          ) : b.tokens.length === 0 ? (
            <div className="text-muted-foreground pointer-events-none flex max-w-md flex-col items-center gap-1 text-center text-sm">
              <IconMathFunction className="size-6" />
              <strong className="text-foreground">Soldan bir veri alanını buraya sürükleyin</strong>
              <span className="text-xs">Sonra işlem ekleyin (× ÷ + −) ve ikinci veriyi bırakın. Tıklayarak da ekleyebilirsiniz.</span>
            </div>
          ) : (
            <>
              {b.tokens.map((t, i) => (
                <Fragment key={t.id}>
                  <Gap b={b} index={i} />
                  <TokenView b={b} t={t} index={i} />
                </Fragment>
              ))}
              <Gap b={b} index={b.tokens.length} />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {b.balance > 0 && <Badge variant="outline">{b.balance} parantez kapatılmadı</Badge>}
          {b.balance < 0 && <Badge variant="outline">Fazladan {-b.balance} kapanan parantez var</Badge>}
          <span className="text-muted-foreground text-xs">Parçaları sürükleyerek yerini değiştirin, sola sürükleyerek çıkarın. Klavye: ← → gezin, ⌫ sil.</span>
          <span className="flex-1" />
          {(b.tokens.length > 0 || b.textOnly) && (
            <Button variant="ghost" size="sm" onClick={b.clear}>
              <IconTrash /> Temizle
            </Button>
          )}
        </div>

        <details open={b.textOnly} className="text-sm">
          <summary className="cursor-pointer font-medium">Metin olarak düzenle (gelişmiş)</summary>
          <Textarea
            rows={3}
            value={b.rawText}
            onChange={(e) => b.setRawText(e.target.value)}
            onBlur={() => b.applyText()}
            placeholder="[markets_dam_data_mcp.price] * 2"
            className="mt-2 font-mono text-xs"
          />
        </details>
      </div>
    </div>
  );
}

function Gap({ b, index }: { b: B; index: number }) {
  const hover = index === b.hover && b.dragging;
  const cursor = index === b.cursor;
  return (
    <span {...b.gapProps(index)} className={cn("relative min-h-9 w-2 shrink-0 cursor-text self-stretch", b.dragging && "w-4")}>
      <span
        className={cn(
          "absolute inset-y-1 left-1/2 -ml-px w-0.5",
          hover ? "bg-primary -ml-0.5 w-1" : cursor ? "bg-primary animate-pulse opacity-0 group-focus/canvas:opacity-100" : "",
        )}
      />
    </span>
  );
}

function TokenView({ b, t, index }: { b: B; t: FormulaToken; index: number }) {
  const info = t.kind === "field" ? b.lookup.find(t) : null;
  return (
    <div
      {...b.tokenProps(index)}
      className={cn(
        "group/tok relative inline-flex min-h-9 max-w-full cursor-grab items-center gap-1.5 border px-2 py-0.5 text-sm font-medium select-none",
        tokenClass(t, info !== null),
        b.movingIndex === index && "opacity-40",
      )}
    >
      {t.kind === "field" && (
        <>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-60 truncate" title={tokenKey(t)}>
              {info?.label ?? tokenKey(t)}
            </span>
            <small className="text-muted-foreground max-w-60 truncate text-[11px] font-normal">{info?.source ?? "Katalogda bulunamadı"}</small>
          </span>
          <select
            value={t.aggregate}
            title="Aynı gün/saate birden çok satır düşerse nasıl birleştirilsin?"
            onChange={(e) => b.setAggregate(t.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="bg-background h-6 border px-1 text-xs"
          >
            {AGGREGATES.map((a) => (
              <option key={a.code} value={a.code} title={a.hint}>
                {a.label}
              </option>
            ))}
          </select>
        </>
      )}
      {t.kind === "number" && (
        <input
          key={t.text}
          type="text"
          inputMode="decimal"
          aria-label="Sayı"
          defaultValue={t.text}
          style={{ width: `${Math.max(2, t.text.length + 1)}ch` }}
          onBlur={(e) => b.setNumber(t.id, e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background h-6 px-1 text-center font-mono outline-none"
        />
      )}
      {t.kind === "operator" && <span>{operatorSymbol(t.text)}</span>}
      {t.kind === "function" && <span>{functionLabel(t.text)} (</span>}
      {t.kind === "comma" && <span title="Argüman ayırıcı">;</span>}
      {(t.kind === "open" || t.kind === "close") && <span>{t.text}</span>}

      <button
        type="button"
        title="Kaldır"
        aria-label="Kaldır"
        onClick={(e) => {
          e.stopPropagation();
          b.removeAt(index);
        }}
        className="bg-background text-muted-foreground hover:text-destructive hover:border-destructive absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center border opacity-0 transition group-hover/tok:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <IconX className="size-3" />
      </button>

      {b.dragging && b.movingIndex !== index && (
        <>
          <span {...b.halfProps(index, "left")} className="absolute inset-y-0 left-0 z-[5] w-1/2" />
          <span {...b.halfProps(index, "right")} className="absolute inset-y-0 right-0 z-[5] w-1/2" />
        </>
      )}
    </div>
  );
}

export function FormulaReadout({ expression, lookup }: { expression: string; lookup: FieldLookup }) {
  const tokens = useMemo(() => parseExpression(expression), [expression]);
  if (!tokens) return <code className="bg-muted block p-2 text-xs break-all whitespace-pre-wrap">{expression}</code>;
  return (
    <div className="flex flex-wrap items-center gap-1" title={expression}>
      {tokens.map((t) => {
        const info = t.kind === "field" ? lookup.find(t) : null;
        return (
          <span key={t.id} className={cn("inline-flex min-h-6 items-center border px-1.5 py-0.5 text-xs font-medium", tokenClass(t, info !== null))}>
            {t.kind === "field" ? (
              <span className="flex flex-col leading-tight">
                <span className="max-w-56 truncate">{info?.label ?? tokenKey(t)}</span>
                <small className="text-muted-foreground font-normal">
                  {info?.source ?? "Katalogda bulunamadı"}
                  {t.aggregate !== "AVG" ? ` · ${aggregateLabel(t.aggregate)}` : ""}
                </small>
              </span>
            ) : t.kind === "operator" ? (
              operatorSymbol(t.text)
            ) : t.kind === "function" ? (
              `${functionLabel(t.text)} (`
            ) : t.kind === "comma" ? (
              ";"
            ) : (
              t.text
            )}
          </span>
        );
      })}
    </div>
  );
}
