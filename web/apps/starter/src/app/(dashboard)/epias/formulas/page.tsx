'use client';

import PageContainer from '@/components/layout/page-container';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { FormulaBuilder, FormulaReadout } from "@/components/fyblue/FormulaBuilder";
import { EmptyBox, FormField, Notice, PageHeader, Section, Segmented, SkeletonRows } from "@/components/fyblue/ui";
import { cn } from "@/lib/utils";
import { ALIGNMENT_MODES, alignmentLabel, fmtDate, fmtDecimal, formulaRunText, PAGE_TEXT, useFormulasPage } from "@fyblue/core";
import { IconCircleCheck, IconEye, IconMathFunction, IconPencil, IconPlayerPlay, IconPlus, IconTrash } from "@tabler/icons-react";

export default function Formulas() {
  const f = useFormulasPage();
  const mode = ALIGNMENT_MODES.find((a) => a.mode === f.editing.alignmentMode) ?? ALIGNMENT_MODES[0];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader module="epias" title={PAGE_TEXT.formulas.title} subtitle={PAGE_TEXT.formulas.subtitle} items={[{ title: "EPİAŞ" }]} />

      {f.error && (
        <Notice kind="error" onClose={f.dismissError}>
          {f.error}
        </Notice>
      )}

      <Section
        title={f.editing.id > 0 ? "Formülü düzenle" : "Yeni formül"}
        action={
          f.editing.id > 0 && (
            <Button variant="ghost" size="sm" onClick={f.newFormula}>
              <IconPlus /> Yeni formül
            </Button>
          )
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Formülün adı">
            <Input value={f.editing.name} onChange={(e) => f.setName(e.target.value)} placeholder="Örn: PTF x Tüketim" />
          </FormField>
          <FormField label="Açıklama (isteğe bağlı)">
            <Input value={f.editing.description ?? ""} onChange={(e) => f.setDescription(e.target.value)} />
          </FormField>
        </div>

        <FormulaBuilder expression={f.editing.expression} onChange={f.setExpression} sources={f.sources} lookup={f.lookup} />

        <div className="flex min-h-6 flex-wrap items-center gap-2 text-sm">
          {!f.editing.expression.trim() ? (
            <span className="text-muted-foreground">Formül henüz boş.</span>
          ) : f.validating ? (
            <Badge variant="outline">
              <Spinner /> Kontrol ediliyor…
            </Badge>
          ) : f.validation?.isValid ? (
            <>
              <Badge>Formül geçerli</Badge>
              <span className="text-muted-foreground">{f.validation.referencedTables.length} veri kaynağı kullanılıyor</span>
            </>
          ) : f.validation ? (
            <>
              <Badge variant="destructive">Hatalı</Badge>
              <span className="text-destructive">{f.validation.error}</span>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1.6fr)_repeat(3,minmax(150px,1fr))]">
          <FormField label="Sonuçlar nasıl gruplansın?" hint={mode.hint}>
            <Segmented value={f.editing.alignmentMode} onChange={f.setAlignment} options={ALIGNMENT_MODES.map((a) => ({ value: a.mode, label: a.label }))} />
          </FormField>
          <FormField label="Önizleme başlangıç">
            <Input type="date" value={f.from} onChange={(e) => f.setFrom(e.target.value)} />
          </FormField>
          <FormField label="Önizleme bitiş">
            <Input type="date" value={f.to} onChange={(e) => f.setTo(e.target.value)} />
          </FormField>
          <FormField label="Sonuç tablosu (çalıştırınca yazılır)">
            <Input value={f.editing.outputTable ?? ""} onChange={(e) => f.setOutputTable(e.target.value)} placeholder="ptf_x_tuketim" />
          </FormField>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <Button variant="outline" onClick={f.runPreview} disabled={!f.canPreview}>
            <IconEye /> Önizle
          </Button>
          <Button onClick={f.save} disabled={!f.canSave} title={!f.editing.name.trim() ? "Önce formüle bir ad verin" : undefined}>
            <IconCircleCheck /> Kaydet
          </Button>
          {f.validation?.isValid && f.validation.generatedSql && (
            <details className="basis-full text-sm">
              <summary className="cursor-pointer font-medium">Üretilen SQL</summary>
              <pre className="bg-muted mt-2 max-h-80 overflow-auto border p-3 text-xs">{f.validation.generatedSql}</pre>
            </details>
          )}
        </div>
      </Section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Section title="Önizleme" flush={!!f.preview && !f.preview.error}>
          {!f.preview ? (
            <p className="text-muted-foreground text-sm">
              Formülü oluşturup <strong>Önizle</strong>'ye bastığınızda seçili tarih aralığının ilk 200 sonucu burada görünür.
            </p>
          ) : f.preview.error ? (
            <Notice kind="error">{f.preview.error}</Notice>
          ) : (
            <>
              <p className="text-muted-foreground px-4 text-sm">
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
        </Section>

        <Section title="Kayıtlı formüller" flush>
          {f.formulas === null ? (
            <div className="px-4 pb-4">
              <SkeletonRows rows={3} />
            </div>
          ) : f.formulas.length === 0 ? (
            <EmptyBox icon={<IconMathFunction />} title="Henüz formül yok" text="Yukarıdaki alana veri sürükleyerek ilk formülünüzü oluşturun." />
          ) : (
            <ul className="divide-y">
              {f.formulas.map((x) => (
                <li key={x.id} className={cn("flex flex-col gap-2.5 px-4 py-3", x.id === f.editing.id && "bg-muted/50")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{x.name}</strong>
                    <Badge variant="outline">{alignmentLabel(x.alignmentMode)}</Badge>
                    {x.outputTable && <Badge variant="secondary">formula.{x.outputTable}</Badge>}
                  </div>
                  <FormulaReadout expression={x.expression} lookup={f.lookup} />
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => f.edit(x)}>
                      <IconPencil /> Düzenle
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => f.run(x)}
                      disabled={f.busy || !x.outputTable?.trim()}
                      title={!x.outputTable?.trim() ? "Kaydetmek için çıktı tablosu gerekli" : "Seçili aralık için çalıştır ve kaydet"}
                    >
                      <IconPlayerPlay /> Çalıştır
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => f.remove(x)}>
                      <IconTrash /> Sil
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {f.runResult && (
            <div className="p-4">
              <Notice kind={f.runResult.error ? "error" : "success"}>{formulaRunText(f.runResult)}</Notice>
            </div>
          )}
        </Section>
      </div>
    </div>
      </PageContainer>
  );
}
