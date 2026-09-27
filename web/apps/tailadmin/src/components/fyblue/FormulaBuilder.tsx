// Sürükle-bırak formül oluşturucu — mantık @fyblue/core'da, görünüm TailAdmin sınıflarıyla.

import Checkbox from "@/components/form/input/Checkbox";
import { ChevronDownIcon, CloseIcon, DataBaseIcon, InfoIcon, SearchIcon, TaskIcon, TrashBinIcon } from "@/icons";
import { cn } from "@/utils";
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
import { Fragment, useMemo } from "react";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import { inputClass, SkeletonRows } from "./ui";

const chip =
  "inline-flex min-h-8 cursor-grab items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-theme-xs font-medium text-gray-700 shadow-theme-xs select-none hover:border-brand-300 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

function tokenClass(t: FormulaToken, known: boolean) {
  switch (t.kind) {
    case "field":
      return known
        ? "border-success-300 bg-success-50 dark:border-success-500/40 dark:bg-success-500/10"
        : "border-error-500 bg-error-50 dark:bg-error-500/10";
    case "number":
      return "border-transparent bg-warning-50 dark:bg-warning-500/15";
    case "function":
      return "border-transparent bg-theme-purple-500/10 text-theme-purple-500";
    case "operator":
      return "min-w-9 justify-center border-gray-300 bg-white font-mono text-base dark:border-gray-700 dark:bg-gray-900";
    default:
      return "border-transparent bg-transparent px-1 font-mono text-lg text-gray-400";
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
      {/* Sol panel: veri kaynakları */}
      <aside
        {...b.paletteProps}
        className={cn(
          "relative flex max-h-[520px] min-h-0 flex-col overflow-hidden rounded-xl border bg-gray-50 transition dark:bg-white/[0.02]",
          b.isMoving ? "border-dashed border-error-500 bg-error-50 dark:bg-error-500/10" : "border-gray-200 dark:border-gray-800",
        )}
      >
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="relative">
            <span className="pointer-events-none absolute inset-s-3 top-1/2 -translate-y-1/2">
              <SearchIcon className="size-4 text-gray-500" />
            </span>
            <input
              type="search"
              value={b.search}
              onChange={(e) => b.setSearch(e.target.value)}
              placeholder="Veri ara: PTF, tüketim, rüzgar…"
              className={cn(inputClass, "h-10 ps-9")}
            />
          </div>
          {b.anyWithData && <Checkbox checked={b.onlyWithData} onChange={b.setOnlyWithData} label="Yalnızca verisi çekilmiş olanlar" />}
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
          {sources === null ? (
            <div className="p-2">
              <SkeletonRows rows={6} />
            </div>
          ) : (
            <>
              {b.visibleSources.length === 0 && (
                <p className="p-2 text-theme-sm text-gray-500 dark:text-gray-400">
                  {b.searching
                    ? "Aramanızla eşleşen veri alanı yok."
                    : "Formülde kullanılabilecek veri tablosu yok. Önce Servisler sayfasından veri çekin."}
                </p>
              )}
              {b.visibleSources.slice(0, b.searching ? 60 : undefined).map(({ source: s, fields }) => {
                const showTag = s.tag !== lastTag;
                lastTag = s.tag;
                const open = b.isOpen(s.tableName);
                return (
                  <Fragment key={s.tableName}>
                    {showTag && <div className="px-2 pt-3 pb-1 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">{s.tag}</div>}
                    <div>
                      <button
                        type="button"
                        onClick={() => b.toggleSource(s.tableName)}
                        aria-expanded={open}
                        className="grid w-full grid-cols-[16px_1fr] gap-x-1.5 rounded-lg p-2 text-start hover:bg-gray-100 dark:hover:bg-white/5"
                      >
                        <ChevronDownIcon className={cn("mt-0.5 size-4 text-gray-400 transition-transform", !open && "-rotate-90")} />
                        <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{s.title}</span>
                        <span className="col-start-2 text-theme-xs text-gray-500 dark:text-gray-400">
                          {granularity(s)}
                          {s.rowCount > 0 ? ` · ${fmtInt(s.rowCount)} satır` : ""}
                        </span>
                      </button>
                      {open && (
                        <div className="flex flex-wrap gap-1.5 ps-7 pe-2 pb-2">
                          {fields.map((f) => (
                            <div
                              key={f.column}
                              {...b.chipProps(() => [Token.field(s.tableName, f.column)])}
                              title="Formüle eklemek için sürükleyin ya da tıklayın"
                              className={cn(chip, "border-success-300 hover:bg-success-50 dark:border-success-500/40")}
                            >
                              <DataBaseIcon className="size-3.5 text-success-600" />
                              {f.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
              {b.searching && b.visibleSources.length > 60 && (
                <p className="p-2 text-theme-xs text-gray-500">İlk 60 tablo gösteriliyor, aramayı daraltın.</p>
              )}
            </>
          )}
        </div>

        {b.isMoving && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-lg bg-error-500 p-2.5 text-theme-sm font-medium text-white">
            <TrashBinIcon className="size-4" /> Formülden çıkarmak için buraya bırakın
          </div>
        )}
      </aside>

      {/* Sağ: araçlar + formül alanı */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">İşlem</span>
            {OPERATORS.map((o) => (
              <div key={o.op} {...b.chipProps(() => [Token.op(o.op)])} title={o.hint} className={cn(chip, "min-w-9 justify-center font-mono text-sm")}>
                {o.symbol}
              </div>
            ))}
            <div {...b.chipProps(() => [Token.open()])} title="Parantez aç" className={cn(chip, "min-w-9 justify-center font-mono text-sm")}>
              (
            </div>
            <div {...b.chipProps(() => [Token.close()])} title="Parantez kapat" className={cn(chip, "min-w-9 justify-center font-mono text-sm")}>
              )
            </div>
            <div {...b.chipProps(() => [Token.number("1")])} title="Sabit bir sayı ekle" className={cn(chip, "text-warning-600")}>
              123 Sayı
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">İşlev</span>
            {FUNCTIONS.map((f) => (
              <div key={f.name} {...b.chipProps(() => functionTemplate(f), 1)} title={f.hint} className={cn(chip, "text-theme-purple-500")}>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div
          {...b.canvasProps}
          className={cn(
            "group/canvas flex min-h-40 flex-wrap content-start items-center gap-y-2 rounded-xl border-2 border-dashed p-3 transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden",
            b.dragging ? "border-brand-500 bg-brand-25 dark:bg-brand-500/5" : "border-gray-300 dark:border-gray-700",
            (b.tokens.length === 0 || b.textOnly) && "content-center justify-center",
          )}
        >
          {b.textOnly ? (
            <div className="pointer-events-none flex max-w-md flex-col items-center gap-1 text-center text-gray-500 dark:text-gray-400">
              <InfoIcon className="size-6 fill-current text-brand-500" />
              <strong className="text-gray-700 dark:text-gray-300">Bu formül görsel olarak gösterilemiyor</strong>
              <span className="text-theme-sm">Aşağıdaki metin kutusundan düzenleyebilir ya da temizleyip yeniden oluşturabilirsiniz.</span>
            </div>
          ) : b.tokens.length === 0 ? (
            <div className="pointer-events-none flex max-w-md flex-col items-center gap-1 text-center text-gray-500 dark:text-gray-400">
              <TaskIcon className="size-7 text-brand-500" />
              <strong className="text-gray-700 dark:text-gray-300">Soldan bir veri alanını buraya sürükleyin</strong>
              <span className="text-theme-sm">Sonra işlem ekleyin (× ÷ + −) ve ikinci veriyi bırakın. Tıklayarak da ekleyebilirsiniz.</span>
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

        <div className="flex flex-wrap items-center gap-3">
          {b.balance > 0 && (
            <Badge size="sm" color="warning">
              {b.balance} parantez kapatılmadı
            </Badge>
          )}
          {b.balance < 0 && (
            <Badge size="sm" color="warning">
              Fazladan {-b.balance} kapanan parantez var
            </Badge>
          )}
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            Parçaları sürükleyerek yerini değiştirin, sola sürükleyerek çıkarın. Klavye: ← → gezin, ⌫ sil.
          </span>
          <span className="flex-1" />
          {(b.tokens.length > 0 || b.textOnly) && (
            <Button size="xs" variant="ghost" onClick={b.clear} startIcon={<TrashBinIcon className="size-4" />}>
              Temizle
            </Button>
          )}
        </div>

        <details open={b.textOnly} className="text-theme-sm">
          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">Metin olarak düzenle (gelişmiş)</summary>
          <textarea
            rows={3}
            value={b.rawText}
            onChange={(e) => b.setRawText(e.target.value)}
            onBlur={() => b.applyText()}
            placeholder="[markets_dam_data_mcp.price] * 2"
            className="mt-2 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 font-mono text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:text-white/90"
          />
        </details>
      </div>
    </div>
  );
}

type B = ReturnType<typeof useFormulaBuilder>;

function Gap({ b, index }: { b: B; index: number }) {
  const cursor = index === b.cursor;
  const hover = index === b.hover && b.dragging;
  return (
    <span {...b.gapProps(index)} className={cn("relative min-h-10 w-2.5 shrink-0 cursor-text self-stretch", b.dragging && "w-4")}>
      <span
        className={cn(
          "absolute inset-y-1 left-1/2 -ml-px w-0.5 rounded",
          hover ? "-ml-0.5 w-1 bg-brand-500" : cursor ? "animate-pulse bg-brand-500 opacity-0 group-focus/canvas:opacity-100" : "",
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
        "group/tok relative inline-flex min-h-10 max-w-full cursor-grab items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium text-gray-800 select-none dark:text-white/90",
        tokenClass(t, info !== null),
        b.movingIndex === index && "opacity-40",
      )}
    >
      {t.kind === "field" && (
        <>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-64 truncate" title={tokenKey(t)}>
              {info?.label ?? tokenKey(t)}
            </span>
            <small className="max-w-64 truncate text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              {info?.source ?? "Katalogda bulunamadı"}
            </small>
          </span>
          <select
            value={t.aggregate}
            title="Aynı gün/saate birden çok satır düşerse nasıl birleştirilsin?"
            onChange={(e) => b.setAggregate(t.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-7 rounded-md border border-gray-300 bg-white px-1.5 text-theme-xs dark:border-gray-700 dark:bg-gray-900"
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
          className="h-7 rounded-md bg-white px-1 text-center font-mono dark:bg-gray-900"
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
        className="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 opacity-0 transition group-hover/tok:opacity-100 hover:border-error-500 hover:text-error-500 dark:border-gray-700 dark:bg-gray-900 [@media(hover:none)]:opacity-100"
      >
        <CloseIcon className="size-3" />
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

/** Kayıtlı bir formülü, oluşturucudaki gibi okunur parçalar hâlinde gösterir. */
export function FormulaReadout({ expression, lookup }: { expression: string; lookup: FieldLookup }) {
  const tokens = useMemo(() => parseExpression(expression), [expression]);
  if (!tokens) return <code className="block rounded-lg bg-gray-100 p-2 text-theme-xs break-all whitespace-pre-wrap dark:bg-white/5">{expression}</code>;
  return (
    <div className="flex flex-wrap items-center gap-1" title={expression}>
      {tokens.map((t) => {
        const info = t.kind === "field" ? lookup.find(t) : null;
        return (
          <span
            key={t.id}
            className={cn(
              "inline-flex min-h-7 items-center rounded-md border px-2 py-0.5 text-theme-xs font-medium text-gray-800 dark:text-white/90",
              tokenClass(t, info !== null),
              t.kind === "operator" && "min-w-7 text-sm",
            )}
          >
            {t.kind === "field" ? (
              <span className="flex flex-col leading-tight">
                <span className="max-w-56 truncate">{info?.label ?? tokenKey(t)}</span>
                <small className="font-normal text-gray-500 dark:text-gray-400">
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
