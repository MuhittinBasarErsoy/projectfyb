'use client';

import PageContainer from '@/components/layout/page-container';
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, Pager, ResultPanel, Td, Th, Tr } from "@/components/fyblue/data";
import { EmptyBox, Notice, PageHeader, Section, SkeletonRows } from "@/components/fyblue/ui";
import { cn } from "@/lib/utils";
import { fmtShortDate, fmtShortDateTime, PAGE_TEXT, screenName, useHistory } from "@fyblue/core";
import { IconDownload, IconEye, IconHistory, IconPlayerPlay, IconRefresh, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import Link from "next/link";

export default function History() {
  const h = useHistory();

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader
        module="osos"
        title={PAGE_TEXT.history.title}
        subtitle={PAGE_TEXT.history.subtitle}
        items={[{ title: "OSOS" }]}
        actions={
          <Button variant="outline" onClick={h.reload} disabled={h.loading}>
            <IconRefresh /> Yenile
          </Button>
        }
      />

      {h.notice && (
        <Notice kind={h.notice.ok ? "success" : "error"} onClose={h.dismissNotice}>
          {h.notice.text}
        </Notice>
      )}

      <Section flush>
        {h.page === null ? (
          <div className="px-4 pb-4">
            <SkeletonRows rows={5} />
          </div>
        ) : h.page.items.length === 0 ? (
          <EmptyBox icon={<IconHistory />} title="Henüz sorgu yok" text="Sorgu sayfasından yaptığınız her arama burada listelenir.">
            <Link href="/osos/query" className={buttonVariants()}>
              <IconSearch /> Sorguya git
            </Link>
          </EmptyBox>
        ) : (
          <>
            <DataTable
              head={
                <>
                  <Th>#</Th>
                  <Th>Ekran</Th>
                  <Th>Serno</Th>
                  <Th>Tarih aralığı</Th>
                  <Th num>Satır</Th>
                  <Th>Oluşturma</Th>
                  <Th />
                </>
              }
            >
              {h.page.items.map((row) => (
                <Tr key={row.id} data-state={row.id === h.viewId && h.snapshot ? "selected" : undefined}>
                  <Td className="text-muted-foreground">{row.id}</Td>
                  <Td>
                    <div className="font-medium">{screenName(row.screen)}</div>
                    <code className="text-muted-foreground text-xs">{row.methodName}</code>
                  </Td>
                  <Td>{row.serno}</Td>
                  <Td>
                    {fmtShortDate(row.startDate)}–{fmtShortDate(row.endDate)}
                  </Td>
                  <Td num>{row.rowCount}</Td>
                  <Td>{fmtShortDateTime(row.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-0.5">
                      <Button variant="ghost" size="icon-sm" title="Görüntüle" aria-label="Görüntüle" onClick={() => h.open(row.id)}>
                        <IconEye />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="CSV indir" aria-label="CSV indir" onClick={() => h.download(row.id)}>
                        <IconDownload />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Tekrar çalıştır" aria-label="Tekrar çalıştır" onClick={() => h.rerun(row.id)}>
                        <IconPlayerPlay />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Sil"
                        aria-label="Sil"
                        className={cn("hover:text-destructive")}
                        onClick={() => h.remove(row.id)}
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
            {h.page.total > h.page.pageSize && <Pager page={h.pageNo} pageCount={h.pageCount} onChange={h.setPageNo} />}
          </>
        )}
      </Section>

      {h.snapshot && (
        <ResultPanel
          title={
            <>
              Kayıtlı sonuç <span className="text-muted-foreground">#{h.viewId}</span>
            </>
          }
          json={h.snapshot.resultJson}
          view={h.view}
          onView={h.setView}
          actions={
            <Button variant="ghost" size="icon-sm" onClick={h.closeSnapshot} aria-label="Kapat">
              <IconX />
            </Button>
          }
        />
      )}
    </div>
      </PageContainer>
  );
}
