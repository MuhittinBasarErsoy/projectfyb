'use client';

import PageContainer from '@/components/layout/page-container';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ResultPanel } from "@/components/fyblue/data";
import { LinkGate } from "@/components/fyblue/shell";
import { FormField, Notice, PageHeader, Section, Segmented, Select } from "@/components/fyblue/ui";
import { OSOS_SCREENS, PAGE_TEXT, useOsosQuery } from "@fyblue/core";
import { IconChevronDown, IconFilter, IconSearch } from "@tabler/icons-react";

export default function Query() {
  const q = useOsosQuery();

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader module="osos" title={PAGE_TEXT.query.title} subtitle={PAGE_TEXT.query.subtitle} items={[{ title: "OSOS" }]} />

      <LinkGate system="osos">
        <Section>
          <Segmented value={q.screen} onChange={q.setScreen} options={OSOS_SCREENS.map((s) => ({ value: s.key, label: s.label }))} />

          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {q.screen === "Subscriptions" ? (
              <p className="text-muted-foreground text-sm sm:col-span-2 lg:col-span-3">Ek bilgi gerekmez — hesabınızdaki tesisatlar listelenir.</p>
            ) : (
              <>
                {q.screen === "Dashboard" &&
                  (q.subs.length > 0 ? (
                    <FormField label="Tesisat">
                      <Select value={String(q.ownerSerno)} onChange={(v) => q.setOwnerSerno(Number(v))}>
                        <option value="0">— seçin —</option>
                        {q.subs.map((s) => (
                          <option key={s.serno} value={s.serno}>
                            {s.label} (#{s.serno})
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  ) : (
                    <FormField label="Owner Serno (tesisat)">
                      <Input type="number" value={q.ownerSerno} onChange={(e) => q.setOwnerSerno(Number(e.target.value))} />
                    </FormField>
                  ))}
                <FormField label="Başlangıç">
                  <Input type="date" value={q.start} onChange={(e) => q.setStart(e.target.value)} />
                </FormField>
                <FormField label="Bitiş">
                  <Input type="date" value={q.end} onChange={(e) => q.setEnd(e.target.value)} />
                </FormField>
                {q.screen === "Consumption" && (
                  <FormField label="Tip">
                    <Input type="number" value={q.type} onChange={(e) => q.setType(Number(e.target.value))} />
                  </FormField>
                )}
              </>
            )}
            <div>
              <Button onClick={q.run} disabled={q.busy}>
                {q.busy ? <Spinner /> : <IconSearch />}
                {q.busy ? "Sorgulanıyor…" : "Sorgula"}
              </Button>
            </div>
          </div>

          {q.usesFilter && (
            <Collapsible className="border">
              <CollapsibleTrigger className="group/c flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
                <IconFilter className="size-4" /> Tesisat filtresi
                <Badge variant="outline">{q.selected.length === 0 ? "tümü" : `${q.selected.length} seçili`}</Badge>
                <IconChevronDown className="ml-auto size-4 transition-transform group-data-[panel-open]/c:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid max-h-64 grid-cols-1 gap-3 overflow-y-auto border-t p-3 sm:grid-cols-2">
                  {q.subs.map((s) => (
                    <label key={s.serno} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={q.selected.includes(s.serno)} onCheckedChange={(on) => q.toggle(s.serno, on)} />
                      {s.label} {s.serno > 0 && <span className="text-muted-foreground">#{s.serno}</span>}
                    </label>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Notice kind="error">{q.error}</Notice>
        </Section>

        {q.result && (
          <ResultPanel
            json={q.result.rawJson}
            view={q.view}
            onView={q.setView}
            meta={`#${q.result.searchHistoryId} · ${q.result.rowCount} satır`}
            onDownload={() => q.download(q.result!.searchHistoryId)}
          />
        )}
      </LinkGate>
    </div>
      </PageContainer>
  );
}
