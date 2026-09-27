// Tablo, grafik ve sonuç panelleri — shadcn/ui Table ve Chart (recharts) bileşenleriyle.

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { cellText, useResultView, type ResultViewMode } from "@fyblue/core";
import { BarChart3, ChevronLeft, ChevronRight, Download, TableIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { FormField, Segmented, Select } from "./ui";

export function DataTable({ head, children, maxHeight }: { head: ReactNode; children: ReactNode; maxHeight?: number }) {
  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <Table>
        <TableHeader className="bg-background sticky top-0 z-1">
          <TableRow>{head}</TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function Th({ children, num, className }: { children?: ReactNode; num?: boolean; className?: string }) {
  return <TableHead className={cn("px-4", num && "text-right", className)}>{children}</TableHead>;
}

export function Td({ children, num, className }: { children?: ReactNode; num?: boolean; className?: string }) {
  return <TableCell className={cn("px-4", num && "text-right tabular-nums", className)}>{children}</TableCell>;
}

export { TableRow as Tr };

export function Pager({
  page,
  pageCount,
  onChange,
  hasNext,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
  hasNext?: boolean;
}) {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-3 border-t px-4 py-3 text-sm">
      <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Önceki sayfa">
        <ChevronLeft />
      </Button>
      <span>
        Sayfa {page} / {pageCount}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={hasNext === undefined ? page >= pageCount : !hasNext}
        onClick={() => onChange(page + 1)}
        aria-label="Sonraki sayfa"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

export function ResultTable({ json }: { json: string | null | undefined }) {
  const { table } = useResultView(json);
  if (!table) return <p className="text-muted-foreground px-4 text-sm">Sonuç yok.</p>;
  if (table.rows.length === 0) return <p className="text-muted-foreground px-4 text-sm">Kayıt bulunamadı.</p>;
  return (
    <>
      <DataTable maxHeight={560} head={table.columns.map((c) => <Th key={c}>{c}</Th>)}>
        {table.rows.map((row, i) => (
          <TableRow key={i}>
            {table.columns.map((c) => (
              <Td key={c}>{cellText(row[c])}</Td>
            ))}
          </TableRow>
        ))}
      </DataTable>
      <p className="text-muted-foreground border-t px-4 py-3 text-xs">{table.rows.length} satır</p>
    </>
  );
}

export function ResultChart({ json }: { json: string | null | undefined }) {
  const v = useResultView(json);
  if (!v.table || v.table.rows.length === 0) return <p className="text-muted-foreground text-sm">Grafik için veri yok.</p>;
  if (v.numericColumns.length === 0)
    return <p className="text-muted-foreground text-sm">Sayısal sütun bulunamadı (grafik çizilemedi).</p>;

  const config = { value: { label: v.valueCol, color: "var(--chart-1)" } } satisfies ChartConfig;
  const data = v.series.map((p) => ({ label: p.label, value: p.value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <FormField label="Değer sütunu" className="min-w-48">
          <Select value={v.valueCol} onChange={v.setValueCol}>
            {v.numericColumns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
        {v.labelColumns.length > 0 && (
          <FormField label="Etiket sütunu" className="min-w-48">
            <Select value={v.labelCol} onChange={v.setLabelCol}>
              <option value="">(sıra no)</option>
              {v.labelColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </div>
      <ChartContainer config={config} className="aspect-auto h-[340px] w-full">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(t: string) => t.slice(0, 12)} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={2} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function ResultPanel({
  json,
  view,
  onView,
  meta,
  onDownload,
  actions,
  title,
}: {
  json: string;
  view: ResultViewMode;
  onView: (v: ResultViewMode) => void;
  meta?: ReactNode;
  onDownload?: () => void;
  actions?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <Card className={cn("bg-background", view === "table" && "pb-0")}>
      <CardHeader className="flex flex-wrap items-center gap-3 border-b">
        {title && <h3 className="font-semibold">{title}</h3>}
        <Segmented
          value={view}
          onChange={onView}
          options={[
            { value: "table", label: <><TableIcon /> Tablo</> },
            { value: "chart", label: <><BarChart3 /> Grafik</> },
          ]}
        />
        {meta && <span className="text-muted-foreground text-sm">{meta}</span>}
        <span className="flex-1" />
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download /> CSV
          </Button>
        )}
        {actions}
      </CardHeader>
      <CardContent className={cn(view === "table" && "px-0")}>
        {view === "table" ? <ResultTable json={json} /> : <ResultChart json={json} />}
      </CardContent>
    </Card>
  );
}
