import Checkbox from "@/components/form/input/Checkbox";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Field, IconButton, inputClass, Notice, SelectInput, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { DownloadIcon, FileIcon, RegenerateIcon, TrashBinIcon, UploadIcon } from "@/icons";
import { cn } from "@/utils";
import { fmtDate, fmtFileSize, useDocuments } from "@fyblue/core";

export default function DocumentsTab({ customerId, invoices = false }: { customerId: number; invoices?: boolean }) {
  const d = useDocuments(customerId, invoices);
  const f = d.form;

  return (
    <div className="space-y-6">
      {d.uploadOpen && (
        <Card title={invoices ? "Fatura yükle" : "Belge yükle"} desc="En fazla 20 MB · PDF, görsel, Office, CSV, ZIP">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void d.upload();
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Dosya *" className="sm:col-span-2 lg:col-span-3">
                <input
                  key={d.formKey}
                  type="file"
                  className={cn(inputClass, "h-auto py-2 file:me-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 dark:file:bg-gray-800")}
                  onChange={(e) => d.set("file", e.target.files?.[0] ?? null)}
                />
              </Field>
              {!invoices && (
                <Field label="Belge tipi *">
                  <SelectInput value={String(f.documentTypeId ?? "")} onChange={(v) => d.set("documentTypeId", v ? Number(v) : null)}>
                    <option value="">— seçin —</option>
                    {d.types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}
              <Field label="Başlık" hint="Boşsa dosya adı kullanılır">
                <TextInput value={f.title} onChange={(e) => d.set("title", e.target.value)} />
              </Field>
              <Field label="Tesisat (ops.)">
                <SelectInput value={String(f.installationId ?? "")} onChange={(v) => d.set("installationId", v ? Number(v) : null)}>
                  <option value="">— müşteri geneli —</option>
                  {d.installations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Belge tarihi">
                <TextInput type="date" value={f.documentDate} onChange={(e) => d.set("documentDate", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Dönem yılı">
                  <TextInput type="number" value={f.periodYear} onChange={(e) => d.set("periodYear", e.target.value)} />
                </Field>
                <Field label="Dönem ayı">
                  <TextInput type="number" min={1} max={12} value={f.periodMonth} onChange={(e) => d.set("periodMonth", e.target.value)} />
                </Field>
              </div>
              <Field label="Geçerlilik bitişi">
                <TextInput type="date" value={f.expiryDate} onChange={(e) => d.set("expiryDate", e.target.value)} />
              </Field>
              <Field label="Açıklama" className="sm:col-span-2 lg:col-span-3">
                <textarea rows={2} className={cn(inputClass, "h-auto")} value={f.description} onChange={(e) => d.set("description", e.target.value)} />
              </Field>
            </div>
            {d.notice && <Notice kind={d.notice.ok ? "success" : "error"}>{d.notice.text}</Notice>}
            <div className="flex gap-3">
              <Button size="sm" type="submit" disabled={d.busy}>
                {d.busy ? <Spinner /> : <UploadIcon className="size-5" />} Yükle
              </Button>
              <Button size="sm" variant="outline" onClick={d.closeUpload}>
                Vazgeç
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        flush
        title={invoices ? "Faturalar" : "Belgeler"}
        actions={
          <>
            {!invoices && (
              <SelectInput value={String(d.typeFilter ?? "")} onChange={(v) => d.setTypeFilter(v ? Number(v) : null)} className="w-48">
                <option value="">Tüm tipler</option>
                {d.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectInput>
            )}
            {d.canSeeInactive && <Checkbox label="Silinenleri göster" checked={d.includeInactive} onChange={d.setIncludeInactive} />}
            {!d.uploadOpen && (
              <Button size="sm" onClick={d.openUpload} startIcon={<UploadIcon className="size-5" />}>
                Yükle
              </Button>
            )}
          </>
        }
      >
        {!d.uploadOpen && d.notice && (
          <div className="p-6 pb-0">
            <Notice kind={d.notice.ok ? "success" : "error"}>{d.notice.text}</Notice>
          </div>
        )}
        {d.items === null ? (
          <div className="p-6">
            <SkeletonRows rows={3} />
          </div>
        ) : d.items.length === 0 ? (
          <EmptyState icon={<FileIcon className="size-7" />} title={invoices ? "Fatura yok" : "Belge yok"} text="“Yükle” ile ekleyin." />
        ) : (
          <DataTable
            head={
              <>
                <Th>Başlık</Th>
                {!invoices && <Th>Tip</Th>}
                <Th>Tesisat</Th>
                <Th>Tarih / dönem</Th>
                <Th num>Boyut</Th>
                <Th>Yükleyen</Th>
                <Th />
              </>
            }
          >
            {d.items.map((doc) => (
              <Tr key={doc.id}>
                <Td>
                  <span className={cn("font-medium text-gray-800 dark:text-white/90", !doc.isActive && "line-through opacity-60")}>{doc.title}</span>
                  <div className="text-theme-xs text-gray-400">{doc.fileName}</div>
                </Td>
                {!invoices && <Td>{doc.documentTypeName}</Td>}
                <Td>{doc.installationName ?? "—"}</Td>
                <Td>
                  {doc.periodYear ? `${String(doc.periodMonth ?? "").padStart(2, "0")}/${doc.periodYear}` : fmtDate(doc.documentDate ?? doc.createdAt)}
                  {doc.expiryDate && <div className="text-theme-xs text-gray-400">bitiş {fmtDate(doc.expiryDate)}</div>}
                </Td>
                <Td num>{fmtFileSize(doc.fileSize)}</Td>
                <Td>
                  <Badge size="sm" color={doc.uploadedByType === "CUSTOMER" ? "info" : "light"}>
                    {doc.uploadedByType === "CUSTOMER" ? "Müşteri" : "Danışman"}
                  </Badge>
                  {doc.uploadedByName && <div className="text-theme-xs text-gray-400">{doc.uploadedByName}</div>}
                </Td>
                <Td className="text-end">
                  <div className="inline-flex">
                    <IconButton title="İndir" onClick={() => d.download(doc)}>
                      <DownloadIcon className="size-5" />
                    </IconButton>
                    {d.canDelete &&
                      (doc.isActive ? (
                        <IconButton title="Sil (pasife al)" danger onClick={() => d.remove(doc)}>
                          <TrashBinIcon className="size-5" />
                        </IconButton>
                      ) : (
                        <IconButton title="Geri al" onClick={() => d.restore(doc)}>
                          <RegenerateIcon className="size-5" />
                        </IconButton>
                      ))}
                  </div>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
