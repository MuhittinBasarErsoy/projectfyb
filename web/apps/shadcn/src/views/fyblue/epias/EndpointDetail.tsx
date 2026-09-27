import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, Pager, Td, Th, Tr } from "@/components/fyblue/data";
import { LinkGate } from "@/components/fyblue/shell";
import { EmptyBox, FormField, Notice, PageHeader, Section, Select, SkeletonRows } from "@/components/fyblue/ui";
import { fmtCell, fmtInt, syncResultText, useEndpointDetail } from "@fyblue/core";
import { ArrowLeft, ArrowRight, Database, Download, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router";

export default function EndpointDetail() {
  const { key = "" } = useParams();
  const d = useEndpointDetail(key);
  const ep = d.endpoint;

  return (
    <div className="flex flex-col gap-6">
      {d.error && (
        <Notice kind="error" onClose={d.dismissError}>
          {d.error}
        </Notice>
      )}

      {!ep ? (
        !d.error && (
          <Card className="bg-background">
            <CardContent>
              <SkeletonRows rows={4} />
            </CardContent>
          </Card>
        )
      ) : (
        <>
          <PageHeader
            module="epias"
            title={ep.title}
            subtitle={ep.description}
            items={[{ title: "EPİAŞ" }, { title: "Servisler", to: "/epias/endpoints" }]}
            actions={
              <Link to="/epias/endpoints" className={buttonVariants({ variant: "ghost" })}>
                <ArrowLeft /> Servisler
              </Link>
            }
          />

          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{ep.method}</Badge>
            <code>{ep.path}</code>
            <ArrowRight className="size-4" />
            <code>epias.{ep.tableName}</code>
          </div>

          <LinkGate system="epias">
            <Section title="Veri çek">
              {ep.supportsDateRange && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField label="Başlangıç">
                    <Input type="date" value={d.from} onChange={(e) => d.setFrom(e.target.value)} />
                  </FormField>
                  <FormField label="Bitiş">
                    <Input type="date" value={d.to} onChange={(e) => d.setTo(e.target.value)} />
                  </FormField>
                  <FormField label="Parça (gün)">
                    <Input type="number" min={0} max={365} value={d.chunkDays} onChange={(e) => d.setChunkDays(Number(e.target.value))} />
                  </FormField>
                </div>
              )}

              {d.editable.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {d.editable.map((p) => (
                    <FormField
                      key={p.name}
                      label={
                        <>
                          {p.name} {p.required && <span className="text-destructive">*</span>}
                        </>
                      }
                      hint={p.description}
                    >
                      {p.enumValues?.length ? (
                        <Select value={d.params[p.name] ?? ""} onChange={(v) => d.setParam(p.name, v)}>
                          <option value=""></option>
                          {p.enumValues.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={d.inputType(p)}
                          placeholder={p.example ?? undefined}
                          value={d.params[p.name] ?? ""}
                          onChange={(e) => d.setParam(p.name, e.target.value)}
                        />
                      )}
                    </FormField>
                  ))}
                </div>
              )}

              <div>
                <Button onClick={d.sync} disabled={d.syncing}>
                  {d.syncing ? <Spinner /> : <Download />}
                  {d.syncing ? "Çekiliyor…" : "Çek ve kaydet"}
                </Button>
              </div>
              {d.syncResult && <Notice kind={d.syncResult.success ? "success" : "error"}>{syncResultText(d.syncResult)}</Notice>}
            </Section>
          </LinkGate>

          <Section
            flush
            title={
              <>
                Tablo içeriği <span className="text-muted-foreground font-normal">{fmtInt(d.total)} satır</span>
              </>
            }
            action={
              <>
                <Button variant="outline" size="sm" onClick={d.downloadCsv} disabled={d.total === 0}>
                  <Download /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={d.reload} disabled={d.querying}>
                  <RefreshCw /> Yenile
                </Button>
              </>
            }
          >
            {d.rows.length === 0 ? (
              <EmptyBox icon={<Database />} title="Tablo boş" text="Bu tabloda henüz kayıt yok. Yukarıdan veri çekin." />
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
          </Section>

          <Section
            flush
            title="Kolonlar"
            description={
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
                    <code>{c.name}</code>
                  </Td>
                  <Td>{c.sqlType}</Td>
                  <Td className="whitespace-normal">{c.description}</Td>
                </Tr>
              ))}
            </DataTable>
          </Section>
        </>
      )}
    </div>
  );
}
