import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { EmptyBox, Notice, PageHeader, Section, Select, SkeletonRows } from "@/components/fyblue/ui";
import { fmtDateTime, fmtInt, PAGE_TEXT, prettyTag, syncResultText, useEndpoints } from "@fyblue/core";
import { Search } from "lucide-react";
import { Link, useNavigate } from "react-router";

const detailHref = (key: string) => `/epias/endpoints/${encodeURIComponent(key)}`;

export default function Endpoints() {
  const navigate = useNavigate();
  const e = useEndpoints((key) => navigate(detailHref(key)));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader module="epias" title={PAGE_TEXT.endpoints.title} subtitle={PAGE_TEXT.endpoints.subtitle} items={[{ title: "EPİAŞ" }]} />

      <Section>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              type="search"
              aria-label="Servis ara"
              placeholder="Ad, anahtar veya yol ara…"
              value={e.search}
              onChange={(ev) => e.setSearch(ev.target.value)}
              className="pl-8"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select aria-label="Kategori" value={e.tag} onChange={e.setTag}>
              <option value="">Tüm kategoriler</option>
              {e.tags.map((t) => (
                <option key={t} value={t}>
                  {prettyTag(t)}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={e.includeExport} onCheckedChange={e.setIncludeExport} />
            Export servisleri
          </label>
        </div>
      </Section>

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

      <Section flush title={e.endpoints.length > 0 ? `${e.endpoints.length} servis` : undefined}>
        {e.loading && e.endpoints.length === 0 ? (
          <div className="px-4 pb-4">
            <SkeletonRows rows={6} />
          </div>
        ) : e.endpoints.length === 0 ? (
          <EmptyBox icon={<Search />} title="Sonuç yok" text="Arama veya kategori filtresini değiştirin." />
        ) : (
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
                  <Link to={detailHref(ep.key)} className="block font-medium underline-offset-4 hover:underline">
                    {ep.title}
                  </Link>
                  <code className="text-muted-foreground text-xs">{ep.path}</code>
                </Td>
                <Td>
                  <code className="text-xs">{ep.isExport ? "—" : ep.tableName}</code>
                </Td>
                <Td num>{ep.isExport ? "—" : fmtInt(ep.rowCount)}</Td>
                <Td>{fmtDateTime(ep.lastSyncedAt)}</Td>
                <Td className="text-right">
                  {!ep.isExport && (
                    <div className="inline-flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => navigate(detailHref(ep.key))}>
                        Aç
                      </Button>
                      <Button size="sm" disabled={e.syncingKey === ep.key || !e.epiasLinked} title={e.syncTitle(ep)} onClick={() => e.sync(ep)}>
                        {e.syncingKey === ep.key ? <Spinner /> : "Çek"}
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Section>
    </div>
  );
}
