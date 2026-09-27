import PageMeta from "@/components/common/PageMeta";
import { DataTable, MetricCard, Td, Th, Tr } from "@/components/fyblue/data";
import { LinkGate } from "@/components/fyblue/shell";
import { Card, Field, MiniStat, Notice, PageHeader, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { CheckCircleIcon, DataBaseIcon, DownloadIcon, RegenerateIcon, StackIcon } from "@/icons";
import { fmtInt, PAGE_TEXT, useEpiasDashboard } from "@fyblue/core";
import { Link } from "react-router";

export default function EpiasDashboard() {
  const d = useEpiasDashboard();

  return (
    <>
      <PageMeta title="EPİAŞ Özet · FyBlue" description={PAGE_TEXT.epias.subtitle} />
      <PageHeader module="epias" title={PAGE_TEXT.epias.title} subtitle={PAGE_TEXT.epias.subtitle} crumbs={[{ title: "EPİAŞ" }]} />

      <div className="space-y-6">
        {d.error && (
          <Notice kind="error" onClose={d.dismissError}>
            {d.error}
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {d.loading || !d.status ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
                <SkeletonRows rows={3} />
              </div>
            ))
          ) : (
            <>
              <MetricCard icon={<StackIcon className="size-6" />} label="Katalogdaki operasyon" value={fmtInt(d.status.totalOperations)} />
              <MetricCard icon={<DataBaseIcon className="size-6" />} label="Tabloya yazılabilir servis" value={fmtInt(d.status.dataEndpoints)} />
              <MetricCard icon={<CheckCircleIcon className="size-6 fill-current" />} label="En az bir kez çekilmiş" value={fmtInt(d.status.syncedEndpoints)} />
              <MetricCard icon={<DownloadIcon className="size-6" />} label="Export (dosya) servisi" value={fmtInt(d.status.exportEndpoints)} />
            </>
          )}
        </div>

        <LinkGate system="epias">
          <Card title="Toplu senkronizasyon" desc="Ek parametre istemeyen tüm veri servislerini seçilen tarih aralığı için paralel çeker.">
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Başlangıç">
                <TextInput type="date" value={d.from} onChange={(e) => d.setFrom(e.target.value)} />
              </Field>
              <Field label="Bitiş">
                <TextInput type="date" value={d.to} onChange={(e) => d.setTo(e.target.value)} />
              </Field>
              <Field label="Parça (gün)">
                <TextInput type="number" min={0} max={365} value={d.chunkDays} onChange={(e) => d.setChunkDays(Number(e.target.value))} />
              </Field>
              <Field label="Paralellik">
                <TextInput type="number" min={1} max={8} value={d.maxParallel} onChange={(e) => d.setMaxParallel(Number(e.target.value))} />
              </Field>
              <div>
                <Button onClick={d.runBulk} disabled={d.syncing}>
                  {d.syncing ? (
                    <>
                      <Spinner /> Çekiliyor…
                    </>
                  ) : (
                    <>
                      <RegenerateIcon className="size-5" /> Tümünü senkronize et
                    </>
                  )}
                </Button>
              </div>
            </div>

            {d.syncing && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Bu işlem servis sayısına ve tarih aralığına göre birkaç dakika sürebilir.
                </p>
              </div>
            )}

            {d.summary && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniStat tone="success" value={d.summary.ok} label="başarılı" />
                  <MiniStat tone="error" value={d.summary.failed} label="hatalı" />
                  <MiniStat value={fmtInt(d.summary.inserted)} label="yeni satır" />
                  <MiniStat value={fmtInt(d.summary.duplicates)} label="kopya atlandı" />
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <DataTable
                    maxHeight={560}
                    head={
                      <>
                        <Th>Servis</Th>
                        <Th num>Çekilen</Th>
                        <Th num>Eklenen</Th>
                        <Th num>Kopya</Th>
                        <Th num>Süre</Th>
                        <Th>Durum</Th>
                      </>
                    }
                  >
                    {d.summary.sorted.map((r) => (
                      <Tr key={r.endpointKey}>
                        <Td>
                          <Link to={`/epias/endpoints/${encodeURIComponent(r.endpointKey)}`} className="font-medium text-brand-500">
                            {r.endpointKey}
                          </Link>
                        </Td>
                        <Td num>{fmtInt(r.fetched)}</Td>
                        <Td num>{fmtInt(r.inserted)}</Td>
                        <Td num>{fmtInt(r.duplicates)}</Td>
                        <Td num>{r.elapsedMs} ms</Td>
                        <Td>
                          {r.success ? (
                            <Badge size="sm" color="success">
                              Tamam
                            </Badge>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <Badge size="sm" color="error">
                                Hata
                              </Badge>
                              <span className="text-theme-xs whitespace-normal">{r.error}</span>
                            </span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </DataTable>
                </div>
              </>
            )}
          </Card>
        </LinkGate>
      </div>
    </>
  );
}
