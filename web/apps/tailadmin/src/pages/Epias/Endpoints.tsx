import PageMeta from "@/components/common/PageMeta";
import Checkbox from "@/components/form/input/Checkbox";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Notice, PageHeader, SelectInput, SkeletonRows, Spinner, inputClass } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { SearchIcon } from "@/icons";
import { cn } from "@/utils";
import { fmtDateTime, fmtInt, PAGE_TEXT, prettyTag, syncResultText, useEndpoints } from "@fyblue/core";
import { Link, useNavigate } from "react-router";

const detailHref = (key: string) => `/epias/endpoints/${encodeURIComponent(key)}`;

export default function Endpoints() {
  const navigate = useNavigate();
  const e = useEndpoints((key) => navigate(detailHref(key)));

  return (
    <>
      <PageMeta title="Servisler · FyBlue" description={PAGE_TEXT.endpoints.subtitle} />
      <PageHeader module="epias" title={PAGE_TEXT.endpoints.title} subtitle={PAGE_TEXT.endpoints.subtitle} crumbs={[{ title: "EPİAŞ" }]} />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-60 flex-1">
              <span className="pointer-events-none absolute inset-s-4 top-1/2 -translate-y-1/2">
                <SearchIcon className="size-5 text-gray-500 dark:text-gray-400" />
              </span>
              <input
                type="search"
                aria-label="Servis ara"
                placeholder="Ad, anahtar veya yol ara…"
                value={e.search}
                onChange={(ev) => e.setSearch(ev.target.value)}
                className={cn(inputClass, "ps-12")}
              />
            </div>
            <div className="w-full sm:w-64">
              <SelectInput aria-label="Kategori" value={e.tag} onChange={e.setTag}>
                <option value="">Tüm kategoriler</option>
                {e.tags.map((t) => (
                  <option key={t} value={t}>
                    {prettyTag(t)}
                  </option>
                ))}
              </SelectInput>
            </div>
            <Checkbox checked={e.includeExport} onChange={e.setIncludeExport} label="Export servisleri" />
          </div>
        </Card>

        {e.error && (
          <Notice kind="error" onClose={e.dismissError}>
            {e.error}
          </Notice>
        )}
        {e.lastResult && (
          <Notice kind={e.lastResult.success ? "success" : "error"} onClose={e.dismissResult}>
            {syncResultText(e.lastResult, true)}
          </Notice>
        )}

        <Card flush>
          {e.loading && e.endpoints.length === 0 ? (
            <div className="p-6">
              <SkeletonRows rows={6} />
            </div>
          ) : e.endpoints.length === 0 ? (
            <EmptyState icon={<SearchIcon className="size-7" />} title="Sonuç yok" text="Arama veya kategori filtresini değiştirin." />
          ) : (
            <>
              <div className="px-5 py-3 text-theme-sm text-gray-500 dark:text-gray-400">{e.endpoints.length} servis</div>
              <DataTable
                head={
                  <>
                    <Th>Servis</Th>
                    <Th>Tablo</Th>
                    <Th num>Satır</Th>
                    <Th>Son çekim</Th>
                    <Th />
                  </>
                }
              >
                {e.endpoints.map((ep) => (
                  <Tr key={ep.key}>
                    <Td className="min-w-72 whitespace-normal">
                      <Link to={detailHref(ep.key)} className="block font-medium text-gray-800 hover:text-brand-500 dark:text-white/90">
                        {ep.title}
                      </Link>
                      <code className="text-theme-xs">{ep.path}</code>
                    </Td>
                    <Td>
                      <code className="text-theme-xs">{ep.isExport ? "—" : ep.tableName}</code>
                    </Td>
                    <Td num>{ep.isExport ? "—" : fmtInt(ep.rowCount)}</Td>
                    <Td>{fmtDateTime(ep.lastSyncedAt)}</Td>
                    <Td className="text-end">
                      {!ep.isExport && (
                        <div className="inline-flex gap-2">
                          <Button size="xs" variant="outline" onClick={() => navigate(detailHref(ep.key))}>
                            Aç
                          </Button>
                          <Button
                            size="xs"
                            disabled={e.syncingKey === ep.key || !e.epiasLinked}
                            title={e.syncTitle(ep)}
                            onClick={() => e.sync(ep)}
                          >
                            {e.syncingKey === ep.key ? <Spinner /> : "Çek"}
                          </Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </DataTable>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
