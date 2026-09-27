import PageMeta from "@/components/common/PageMeta";
import { DataTable, Pager, Td, Th, Tr } from "@/components/fyblue/data";
import { LinkGate } from "@/components/fyblue/shell";
import { Card, EmptyState, Field, Notice, PageHeader, SelectInput, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { ArrowRightIcon, ChevronLeftIcon, DataBaseIcon, DownloadIcon, RegenerateIcon } from "@/icons";
import { fmtCell, fmtInt, syncResultText, useEndpointDetail } from "@fyblue/core";
import { Link, useParams } from "react-router";

export default function EndpointDetail() {
  const { key = "" } = useParams();
  const d = useEndpointDetail(key);
  const ep = d.endpoint;

  return (
    <>
      <PageMeta title={`${ep?.title ?? "Servis"} · FyBlue`} description={ep?.description ?? ""} />
      {d.error && (
        <Notice kind="error" onClose={d.dismissError} className="mb-6">
          {d.error}
        </Notice>
      )}

      {!ep ? (
        !d.error && (
          <Card>
            <SkeletonRows rows={4} />
          </Card>
        )
      ) : (
        <>
          <PageHeader
            module="epias"
            title={ep.title}
            crumbs={[{ title: "EPİAŞ" }, { title: "Servisler", to: "/epias/endpoints" }]}
            actions={
              <Link
                to="/epias/endpoints"
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <ChevronLeftIcon className="size-5" /> Servisler
              </Link>
            }
          />

          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
              <Badge size="sm" color="light">
                {ep.method}
              </Badge>
              <code>{ep.path}</code>
              <ArrowRightIcon className="size-4" />
              <code>epias.{ep.tableName}</code>
            </div>
            {ep.description && <p className="max-w-4xl text-sm text-gray-600 dark:text-gray-400">{ep.description}</p>}

            <LinkGate system="epias">
              <Card title="Veri çek">
                {ep.supportsDateRange && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Başlangıç">
                      <TextInput type="date" value={d.from} onChange={(e) => d.setFrom(e.target.value)} />
                    </Field>
                    <Field label="Bitiş">
                      <TextInput type="date" value={d.to} onChange={(e) => d.setTo(e.target.value)} />
                    </Field>
                    <Field label="Parça (gün)">
                      <TextInput type="number" min={0} max={365} value={d.chunkDays} onChange={(e) => d.setChunkDays(Number(e.target.value))} />
                    </Field>
                  </div>
                )}

                {d.editable.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {d.editable.map((p) => (
                      <Field
                        key={p.name}
                        label={
                          <>
                            {p.name} {p.required && <span className="text-error-500">*</span>}
                          </>
                        }
                        hint={p.description}
                      >
                        {p.enumValues?.length ? (
                          <SelectInput value={d.params[p.name] ?? ""} onChange={(v) => d.setParam(p.name, v)}>
                            <option value=""></option>
                            {p.enumValues.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </SelectInput>
                        ) : (
                          <TextInput
                            type={d.inputType(p)}
                            placeholder={p.example ?? undefined}
                            value={d.params[p.name] ?? ""}
                            onChange={(e) => d.setParam(p.name, e.target.value)}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                )}

                <div>
                  <Button onClick={d.sync} disabled={d.syncing}>
                    {d.syncing ? (
                      <>
                        <Spinner /> Çekiliyor…
                      </>
                    ) : (
                      <>
                        <DownloadIcon className="size-5" /> Çek ve kaydet
                      </>
                    )}
                  </Button>
                </div>

                {d.syncResult && <Notice kind={d.syncResult.success ? "success" : "error"}>{syncResultText(d.syncResult)}</Notice>}
              </Card>
            </LinkGate>

            <Card
              flush
              title={
                <>
                  Tablo içeriği <span className="text-gray-400">{fmtInt(d.total)} satır</span>
                </>
              }
              actions={
                <>
                  <Button size="xs" variant="outline" onClick={d.downloadCsv} disabled={d.total === 0} startIcon={<DownloadIcon className="size-4" />}>
                    CSV
                  </Button>
                  <Button size="xs" variant="outline" onClick={d.reload} disabled={d.querying} startIcon={<RegenerateIcon className="size-4" />}>
                    Yenile
                  </Button>
                </>
              }
            >
              {d.rows.length === 0 ? (
                <EmptyState icon={<DataBaseIcon className="size-7" />} title="Tablo boş" text="Bu tabloda henüz kayıt yok. Yukarıdan veri çekin." />
              ) : (
                <>
                  <DataTable maxHeight={560} head={d.columns.map((c) => <Th key={c}>{c}</Th>)}>
                    {d.rows.map((row, i) => (
                      <Tr key={i}>
                        {d.columns.map((c) => (
                          <Td key={c}>{fmtCell(row[c])}</Td>
                        ))}
                      </Tr>
                    ))}
                  </DataTable>
                  <Pager page={d.page} pageCount={d.pageCount} hasNext={d.hasNext} onChange={d.goToPage} />
                </>
              )}
            </Card>

            <Card
              flush
              title="Kolonlar"
              desc={
                <>
                  Formüllerde <code>[{ep.tableName}.kolon_adi]</code> biçiminde kullanılır.
                </>
              }
            >
              <DataTable
                head={
                  <>
                    <Th>Kolon</Th>
                    <Th>SQL tipi</Th>
                    <Th>Açıklama</Th>
                  </>
                }
              >
                {ep.columns.map((c) => (
                  <Tr key={c.name}>
                    <Td>
                      <code className="text-gray-800 dark:text-white/90">{c.name}</code>
                    </Td>
                    <Td>{c.sqlType}</Td>
                    <Td className="whitespace-normal">{c.description}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
