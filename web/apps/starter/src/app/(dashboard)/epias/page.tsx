'use client';

import PageContainer from '@/components/layout/page-container';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { LinkGate } from "@/components/fyblue/shell";
import { FormField, Notice, PageHeader, Section, SkeletonRows, Stat } from "@/components/fyblue/ui";
import { fmtInt, PAGE_TEXT, useEpiasDashboard } from "@fyblue/core";
import { IconCircleCheck, IconDatabase, IconDownload, IconRefresh, IconStack2 } from "@tabler/icons-react";
import type { ReactNode } from "react";
import Link from "next/link";

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-background">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function EpiasDashboard() {
  const d = useEpiasDashboard();

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader module="epias" title={PAGE_TEXT.epias.title} subtitle={PAGE_TEXT.epias.subtitle} items={[{ title: "EPİAŞ" }]} />

      {d.error && (
        <Notice kind="error" onClose={d.dismissError}>
          {d.error}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.loading || !d.status ? (
          Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="bg-background p-4">
              <SkeletonRows rows={2} />
            </Card>
          ))
        ) : (
          <>
            <MetricCard icon={<IconStack2 className="size-4" />} label="Katalogdaki operasyon" value={fmtInt(d.status.totalOperations)} />
            <MetricCard icon={<IconDatabase className="size-4" />} label="Tabloya yazılabilir servis" value={fmtInt(d.status.dataEndpoints)} />
            <MetricCard icon={<IconCircleCheck className="size-4" />} label="En az bir kez çekilmiş" value={fmtInt(d.status.syncedEndpoints)} />
            <MetricCard icon={<IconDownload className="size-4" />} label="Export (dosya) servisi" value={fmtInt(d.status.exportEndpoints)} />
          </>
        )}
      </div>

      <LinkGate system="epias">
        <Section title="Toplu senkronizasyon" description="Ek parametre istemeyen tüm veri servislerini seçilen tarih aralığı için paralel çeker.">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label="Başlangıç">
              <Input type="date" value={d.from} onChange={(e) => d.setFrom(e.target.value)} />
            </FormField>
            <FormField label="Bitiş">
              <Input type="date" value={d.to} onChange={(e) => d.setTo(e.target.value)} />
            </FormField>
            <FormField label="Parça (gün)">
              <Input type="number" min={0} max={365} value={d.chunkDays} onChange={(e) => d.setChunkDays(Number(e.target.value))} />
            </FormField>
            <FormField label="Paralellik">
              <Input type="number" min={1} max={8} value={d.maxParallel} onChange={(e) => d.setMaxParallel(Number(e.target.value))} />
            </FormField>
            <div>
              <Button onClick={d.runBulk} disabled={d.syncing}>
                {d.syncing ? <Spinner /> : <IconRefresh />}
                {d.syncing ? "Çekiliyor…" : "Tümünü senkronize et"}
              </Button>
            </div>
          </div>

          {d.syncing && (
            <div className="flex flex-col gap-2">
              <Progress value={null} />
              <p className="text-muted-foreground text-sm">Bu işlem servis sayısına ve tarih aralığına göre birkaç dakika sürebilir.</p>
            </div>
          )}

          {d.summary && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat tone="success" value={d.summary.ok} label="başarılı" />
                <Stat tone="error" value={d.summary.failed} label="hatalı" />
                <Stat value={fmtInt(d.summary.inserted)} label="yeni satır" />
                <Stat value={fmtInt(d.summary.duplicates)} label="kopya atlandı" />
              </div>
              <div className="border">
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
                        <Link href={`/epias/endpoints/detail/?key=${encodeURIComponent(r.endpointKey)}`} className="font-medium underline-offset-4 hover:underline">
                          {r.endpointKey}
                        </Link>
                      </Td>
                      <Td num>{fmtInt(r.fetched)}</Td>
                      <Td num>{fmtInt(r.inserted)}</Td>
                      <Td num>{fmtInt(r.duplicates)}</Td>
                      <Td num>{r.elapsedMs} ms</Td>
                      <Td className="whitespace-normal">
                        {r.success ? (
                          <Badge>Tamam</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Badge variant="destructive">Hata</Badge>
                            <span className="text-muted-foreground text-xs">{r.error}</span>
                          </span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </DataTable>
              </div>
            </>
          )}
        </Section>
      </LinkGate>
    </div>
      </PageContainer>
  );
}
