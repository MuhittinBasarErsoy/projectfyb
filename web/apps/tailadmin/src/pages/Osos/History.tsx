import PageMeta from "@/components/common/PageMeta";
import { DataTable, Pager, ResultPanel, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, IconButton, Notice, PageHeader, SkeletonRows } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { CloseIcon, DownloadIcon, EyeIcon, PlayIcon, RegenerateIcon, TimeIcon, TrashBinIcon } from "@/icons";
import { cn } from "@/utils";
import { fmtShortDate, fmtShortDateTime, PAGE_TEXT, screenName, useHistory } from "@fyblue/core";
import { Link } from "react-router";

export default function History() {
  const h = useHistory();

  return (
    <>
      <PageMeta title="Sorgu Geçmişi · FyBlue" description={PAGE_TEXT.history.subtitle} />
      <PageHeader
        module="osos"
        title={PAGE_TEXT.history.title}
        subtitle={PAGE_TEXT.history.subtitle}
        crumbs={[{ title: "OSOS" }]}
        actions={
          <Button variant="outline" size="sm" onClick={h.reload} disabled={h.loading} startIcon={<RegenerateIcon className="size-5" />}>
            Yenile
          </Button>
        }
      />

      <div className="space-y-6">
        {h.notice && (
          <Notice kind={h.notice.ok ? "success" : "error"} onClose={h.dismissNotice}>
            {h.notice.text}
          </Notice>
        )}

        <Card flush>
          {h.page === null ? (
            <div className="p-6">
              <SkeletonRows rows={5} />
            </div>
          ) : h.page.items.length === 0 ? (
            <EmptyState
              icon={<TimeIcon className="size-7" />}
              title="Henüz sorgu yok"
              text="Sorgu sayfasından yaptığınız her arama burada listelenir."
            >
              <Link
                to="/osos/query"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
              >
                Sorguya git
              </Link>
            </EmptyState>
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
                  <Tr key={row.id} className={cn(row.id === h.viewId && h.snapshot && "bg-brand-25 dark:bg-brand-500/5")}>
                    <Td>{row.id}</Td>
                    <Td>
                      <span className="block font-medium text-gray-800 dark:text-white/90">{screenName(row.screen)}</span>
                      <span className="text-theme-xs">{row.methodName}</span>
                    </Td>
                    <Td>{row.serno}</Td>
                    <Td>
                      {fmtShortDate(row.startDate)}–{fmtShortDate(row.endDate)}
                    </Td>
                    <Td num>{row.error ? <span className="text-error-500" title={row.error}>Hata</span> : row.rowCount}</Td>
                    <Td>{fmtShortDateTime(row.createdAt)}</Td>
                    <Td className="text-end">
                      <div className="inline-flex">
                        <IconButton title="Görüntüle" onClick={() => h.open(row.id)}>
                          <EyeIcon className="size-5 fill-current" />
                        </IconButton>
                        <IconButton title="CSV indir" onClick={() => h.download(row.id)}>
                          <DownloadIcon className="size-5" />
                        </IconButton>
                        <IconButton title="Tekrar çalıştır" onClick={() => h.rerun(row.id)}>
                          <PlayIcon className="size-5" />
                        </IconButton>
                        <IconButton title="Sil" danger onClick={() => h.remove(row.id)}>
                          <TrashBinIcon className="size-5" />
                        </IconButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </DataTable>
              {h.page.total > h.page.pageSize && <Pager page={h.pageNo} pageCount={h.pageCount} onChange={h.setPageNo} />}
            </>
          )}
        </Card>

        {h.snapshot && (
          <ResultPanel
            title={
              <>
                Kayıtlı sonuç <span className="text-gray-400">#{h.viewId}</span>
              </>
            }
            json={h.snapshot.resultJson}
            view={h.view}
            onView={h.setView}
            actions={
              <IconButton title="Kapat" onClick={h.closeSnapshot}>
                <CloseIcon className="size-5" />
              </IconButton>
            }
          />
        )}
      </div>
    </>
  );
}
