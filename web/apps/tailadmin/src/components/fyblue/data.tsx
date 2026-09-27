// Tablo, grafik, sayfalama ve istatistik kartları — TailAdmin'in RecentOrders / BarChartOne /
// EcommerceMetrics bileşenlerindeki sınıflarla.

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from "@/context/ThemeContext";
import { ChevronLeftIcon, DownloadIcon, PieChartIcon, TableIcon } from "@/icons";
import { cn } from "@/utils";
import { cellText, useResultView, type ResultViewMode } from "@fyblue/core";
import type { ApexOptions } from "apexcharts";
import type { ReactNode } from "react";
import Chart from "react-apexcharts";
import Button from "../ui/button/Button";
import { EmptyState, Field, Segmented, SelectInput } from "./ui";

export const thClass = "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
export const tdClass = "px-5 py-3.5 text-theme-sm whitespace-nowrap text-gray-500 dark:text-gray-400";

export function DataTable({
  head,
  children,
  className,
  maxHeight,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
  maxHeight?: number;
}) {
  return (
    <div className={cn("custom-scrollbar max-w-full overflow-auto", className)} style={maxHeight ? { maxHeight } : undefined}>
      <Table>
        <TableHeader className="sticky top-0 z-1 border-y border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <TableRow>{head}</TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</TableBody>
      </Table>
    </div>
  );
}

export function Th({ children, num, className }: { children?: ReactNode; num?: boolean; className?: string }) {
  return (
    <TableCell isHeader className={cn(thClass, num && "text-end", className)}>
      {children}
    </TableCell>
  );
}

export function Td({ children, num, className }: { children?: ReactNode; num?: boolean; className?: string }) {
  return <TableCell className={cn(tdClass, num && "text-end tabular-nums", className)}>{children}</TableCell>;
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
    <div className="flex items-center justify-center gap-3 border-t border-gray-100 px-5 py-3 text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      <Button size="xs" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeftIcon className="size-4" />
      </Button>
      <span>
        Sayfa {page} / {pageCount}
      </span>
      <Button
        size="xs"
        variant="outline"
        disabled={hasNext === undefined ? page >= pageCount : !hasNext}
        onClick={() => onChange(page + 1)}
      >
        <ChevronLeftIcon className="size-4 rotate-180" />
      </Button>
    </div>
  );
}

// ---- Metrik kartı (EcommerceMetrics) ----

export function MetricCard({ icon, label, value }: { icon: ReactNode; label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90">
        {icon}
      </div>
      <div className="mt-5">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <h4 className="mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90">{value}</h4>
      </div>
    </div>
  );
}

// ---- OSOS / hava durumu sonucu: tablo + grafik ----

export function ResultTable({ json }: { json: string | null | undefined }) {
  const { table } = useResultView(json);
  if (!table) return <p className="text-sm text-gray-500 dark:text-gray-400">Sonuç yok.</p>;
  if (table.rows.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">Kayıt bulunamadı.</p>;
  return (
    <>
      <DataTable head={table.columns.map((c) => <Th key={c}>{c}</Th>)} maxHeight={560}>
        {table.rows.map((row, i) => (
          <TableRow key={i}>
            {table.columns.map((c) => (
              <Td key={c}>{cellText(row[c])}</Td>
            ))}
          </TableRow>
        ))}
      </DataTable>
      <p className="px-5 py-3 text-theme-xs text-gray-500 dark:text-gray-400">{table.rows.length} satır</p>
    </>
  );
}

export function ResultChart({ json }: { json: string | null | undefined }) {
  const v = useResultView(json);
  const { theme } = useTheme();

  if (!v.table || v.table.rows.length === 0)
    return <p className="text-sm text-gray-500 dark:text-gray-400">Grafik için veri yok.</p>;
  if (v.numericColumns.length === 0)
    return <p className="text-sm text-gray-500 dark:text-gray-400">Sayısal sütun bulunamadı (grafik çizilemedi).</p>;

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: { fontFamily: "Outfit, sans-serif", type: "bar", toolbar: { show: false }, foreColor: theme === "dark" ? "#98a2b3" : "#667085" },
    plotOptions: { bar: { horizontal: false, columnWidth: "55%", borderRadius: 5, borderRadiusApplication: "end" } },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    xaxis: {
      categories: v.series.map((p) => p.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { rotate: -35, trim: true, hideOverlappingLabels: true },
      tickAmount: Math.min(24, v.series.length),
    },
    yaxis: { labels: { formatter: (val: number) => val.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) } },
    grid: { borderColor: theme === "dark" ? "#1d2939" : "#e4e7ec", yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    tooltip: { theme: theme, y: { formatter: (val: number) => val.toLocaleString("tr-TR", { maximumFractionDigits: 3 }) } },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Field label="Değer sütunu" className="min-w-48">
          <SelectInput value={v.valueCol} onChange={v.setValueCol}>
            {v.numericColumns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </Field>
        {v.labelColumns.length > 0 && (
          <Field label="Etiket sütunu" className="min-w-48">
            <SelectInput value={v.labelCol} onChange={v.setLabelCol}>
              <option value="">(sıra no)</option>
              {v.labelColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
      </div>
      <div className="custom-scrollbar max-w-full overflow-x-auto">
        <div className="min-w-160">
          <Chart options={options} series={[{ name: v.valueCol, data: v.series.map((p) => p.value) }]} type="bar" height={340} />
        </div>
      </div>
    </div>
  );
}

/** Sorgu / geçmiş / hava durumu sonucu kartı: tablo-grafik geçişi ve CSV. */
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
        {title && <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>}
        <Segmented
          value={view}
          onChange={onView}
          options={[
            { value: "table", label: <><TableIcon className="size-4" /> Tablo</> },
            { value: "chart", label: <><PieChartIcon className="size-4" /> Grafik</> },
          ]}
        />
        {meta && <span className="text-theme-sm text-gray-500 dark:text-gray-400">{meta}</span>}
        <span className="flex-1" />
        {onDownload && (
          <Button size="xs" variant="outline" onClick={onDownload} startIcon={<DownloadIcon className="size-4" />}>
            CSV
          </Button>
        )}
        {actions}
      </div>
      <div className={view === "chart" ? "border-t border-gray-100 p-5 sm:p-6 dark:border-gray-800" : ""}>
        {view === "table" ? <ResultTable json={json} /> : <ResultChart json={json} />}
      </div>
    </div>
  );
}

export { EmptyState };
