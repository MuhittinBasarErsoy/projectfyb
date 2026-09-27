import PageMeta from "@/components/common/PageMeta";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { FormulaBuilder, FormulaReadout } from "@/components/fyblue/FormulaBuilder";
import { Card, EmptyState, Field, Notice, PageHeader, Segmented, SkeletonRows, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { CheckCircleIcon, EyeIcon, PencilIcon, PlayIcon, PlusIcon, TaskIcon, TrashBinIcon } from "@/icons";
import { cn } from "@/utils";
import {
  ALIGNMENT_MODES,
  alignmentLabel,
  fmtDate,
  fmtDecimal,
  formulaRunText,
  PAGE_TEXT,
  useFormulasPage,
} from "@fyblue/core";

export default function Formulas() {
  const f = useFormulasPage();
  const mode = ALIGNMENT_MODES.find((a) => a.mode === f.editing.alignmentMode) ?? ALIGNMENT_MODES[0];

  return (
    <>
      <PageMeta title="Formüller · FyBlue" description={PAGE_TEXT.formulas.subtitle} />
      <PageHeader module="epias" title={PAGE_TEXT.formulas.title} subtitle={PAGE_TEXT.formulas.subtitle} crumbs={[{ title: "EPİAŞ" }]} />

      <div className="space-y-6">
        {f.error && (
          <Notice kind="error" onClose={f.dismissError}>
            {f.error}
          </Notice>
        )}

        <Card
          title={f.editing.id > 0 ? "Formülü düzenle" : "Yeni formül"}
          actions={
            f.editing.id > 0 && (
              <Button size="xs" variant="ghost" onClick={f.newFormula} startIcon={<PlusIcon className="size-4" />}>
                Yeni formül
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Formülün adı">
              <TextInput value={f.editing.name} onChange={(e) => f.setName(e.target.value)} placeholder="Örn: PTF x Tüketim" />
            </Field>
            <Field
              label={
                <>
                  Açıklama <span className="font-normal text-gray-400">(isteğe bağlı)</span>
                </>
              }
            >
              <TextInput value={f.editing.description ?? ""} onChange={(e) => f.setDescription(e.target.value)} />
            </Field>
          </div>

          <FormulaBuilder expression={f.editing.expression} onChange={f.setExpression} sources={f.sources} lookup={f.lookup} />

          <div className="flex min-h-6 flex-wrap items-center gap-3 text-theme-sm">
            {!f.editing.expression.trim() ? (
              <span className="text-gray-500 dark:text-gray-400">Formül henüz boş.</span>
            ) : f.validating ? (
              <Badge size="sm" color="light">
                <Spinner className="size-3" /> Kontrol ediliyor…
              </Badge>
            ) : f.validation?.isValid ? (
              <>
                <Badge size="sm" color="success">
                  Formül geçerli
                </Badge>
                <span className="text-gray-500 dark:text-gray-400">{f.validation.referencedTables.length} veri kaynağı kullanılıyor</span>
              </>
            ) : f.validation ? (
              <>
                <Badge size="sm" color="error">
                  Hatalı
                </Badge>
                <span className="text-error-600 dark:text-error-500">{f.validation.error}</span>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1.6fr)_repeat(3,minmax(150px,1fr))]">
            <Field label="Sonuçlar nasıl gruplansın?" hint={mode.hint}>
              <Segmented value={f.editing.alignmentMode} onChange={f.setAlignment} options={ALIGNMENT_MODES.map((a) => ({ value: a.mode, label: a.label }))} />
            </Field>
            <Field label="Önizleme başlangıç">
              <TextInput type="date" value={f.from} onChange={(e) => f.setFrom(e.target.value)} />
            </Field>
            <Field label="Önizleme bitiş">
              <TextInput type="date" value={f.to} onChange={(e) => f.setTo(e.target.value)} />
            </Field>
            <Field
              label={
                <>
                  Sonuç tablosu <span className="font-normal text-gray-400">(çalıştırınca yazılır)</span>
                </>
              }
            >
              <TextInput value={f.editing.outputTable ?? ""} onChange={(e) => f.setOutputTable(e.target.value)} placeholder="ptf_x_tuketim" />
            </Field>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <Button size="sm" variant="outline" onClick={f.runPreview} disabled={!f.canPreview} startIcon={<EyeIcon className="size-5 fill-current" />}>
              Önizle
            </Button>
            <Button
              size="sm"
              onClick={f.save}
              disabled={!f.canSave}
              title={!f.editing.name.trim() ? "Önce formüle bir ad verin" : undefined}
              startIcon={<CheckCircleIcon className="size-5 fill-current" />}
            >
              Kaydet
            </Button>
            {f.validation?.isValid && f.validation.generatedSql && (
              <details className="basis-full text-theme-sm">
                <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">Üretilen SQL</summary>
                <pre className="custom-scrollbar mt-2 max-h-80 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-theme-xs text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
                  {f.validation.generatedSql}
                </pre>
              </details>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Card title="Önizleme" flush={!!f.preview && !f.preview.error}>
            {!f.preview ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Formülü oluşturup <strong>Önizle</strong>'ye bastığınızda seçili tarih aralığının ilk 200 sonucu burada görünür.
              </p>
            ) : f.preview.error ? (
              <Notice kind="error">{f.preview.error}</Notice>
            ) : (
              <>
                <p className="px-5 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                  {f.preview.rows.length} satır · {f.preview.elapsedMs} ms
                </p>
                <DataTable
                  maxHeight={320}
                  head={
                    <>
                      <Th>Tarih</Th>
                      <Th>Saat</Th>
                      <Th num>Değer</Th>
                    </>
                  }
                >
                  {f.preview.rows.slice(0, 200).map((row, i) => (
                    <Tr key={i}>
                      <Td>{fmtDate(row.date)}</Td>
                      <Td>{row.hour ?? "—"}</Td>
                      <Td num>{fmtDecimal(row.value)}</Td>
                    </Tr>
                  ))}
                </DataTable>
              </>
            )}
          </Card>

          <Card title="Kayıtlı formüller" flush>
            {f.formulas === null ? (
              <div className="p-6">
                <SkeletonRows rows={3} />
              </div>
            ) : f.formulas.length === 0 ? (
              <EmptyState icon={<TaskIcon className="size-7" />} title="Henüz formül yok" text="Yukarıdaki alana veri sürükleyerek ilk formülünüzü oluşturun." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {f.formulas.map((x) => (
                  <li key={x.id} className={cn("flex flex-col gap-3 px-6 py-4", x.id === f.editing.id && "bg-brand-25 dark:bg-brand-500/5")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-theme-sm text-gray-800 dark:text-white/90">{x.name}</strong>
                      <Badge size="sm" color="light">
                        {alignmentLabel(x.alignmentMode)}
                      </Badge>
                      {x.outputTable && (
                        <Badge size="sm" color="info">
                          formula.{x.outputTable}
                        </Badge>
                      )}
                    </div>
                    <FormulaReadout expression={x.expression} lookup={f.lookup} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="xs" variant="outline" onClick={() => f.edit(x)} startIcon={<PencilIcon className="size-4" />}>
                        Düzenle
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => f.run(x)}
                        disabled={f.busy || !x.outputTable?.trim()}
                        title={!x.outputTable?.trim() ? "Kaydetmek için çıktı tablosu gerekli" : "Seçili aralık için çalıştır ve kaydet"}
                        startIcon={<PlayIcon className="size-4" />}
                      >
                        Çalıştır
                      </Button>
                      <Button size="xs" variant="danger" onClick={() => f.remove(x)} startIcon={<TrashBinIcon className="size-4" />}>
                        Sil
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {f.runResult && (
              <div className="p-5">
                <Notice kind={f.runResult.error ? "error" : "success"}>{formulaRunText(f.runResult)}</Notice>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
