import PageMeta from "@/components/common/PageMeta";
import Checkbox from "@/components/form/input/Checkbox";
import { ResultPanel } from "@/components/fyblue/data";
import SubscriptionPicker from "@/components/fyblue/SubscriptionPicker";
import { LinkGate } from "@/components/fyblue/shell";
import { Card, Field, Notice, PageHeader, Segmented, Spinner, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { ChevronDownIcon, SearchIcon } from "@/icons";
import { OSOS_SCREENS, PAGE_TEXT, subscriptionText, useOsosQuery } from "@fyblue/core";
import { useState } from "react";

export default function Query() {
  const q = useOsosQuery();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <>
      <PageMeta title="Sorgu · FyBlue" description={PAGE_TEXT.query.subtitle} />
      <PageHeader module="osos" title={PAGE_TEXT.query.title} subtitle={PAGE_TEXT.query.subtitle} crumbs={[{ title: "OSOS" }]} />

      <LinkGate system="osos">
        <div className="space-y-6">
          <Card>
            <Segmented value={q.screen} onChange={q.setScreen} options={OSOS_SCREENS.map((s) => ({ value: s.key, label: s.label }))} />

            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {q.screen === "Subscriptions" ? (
                <p className="text-sm text-gray-500 sm:col-span-2 lg:col-span-3 dark:text-gray-400">
                  Ek bilgi gerekmez — hesabınızdaki tesisatlar listelenir.
                </p>
              ) : (
                <>
                  {q.screen === "Dashboard" &&
                    (q.subs.length > 0 ? (
                      <Field label="Tesisat">
                        <SubscriptionPicker subs={q.subs} value={q.ownerSerno} onChange={q.setOwnerSerno} allowAuto={false} />
                      </Field>
                    ) : (
                      <Field label="Owner Serno (tesisat)">
                        <TextInput type="number" value={q.ownerSerno} onChange={(e) => q.setOwnerSerno(Number(e.target.value))} />
                      </Field>
                    ))}
                  <Field label="Başlangıç">
                    <TextInput type="date" value={q.start} onChange={(e) => q.setStart(e.target.value)} />
                  </Field>
                  <Field label="Bitiş">
                    <TextInput type="date" value={q.end} onChange={(e) => q.setEnd(e.target.value)} />
                  </Field>
                  {q.screen === "Consumption" && (
                    <Field label="Tip">
                      <TextInput type="number" value={q.type} onChange={(e) => q.setType(Number(e.target.value))} />
                    </Field>
                  )}
                </>
              )}
              <div>
                <Button onClick={q.run} disabled={q.busy} className="w-full sm:w-auto">
                  {q.busy ? (
                    <>
                      <Spinner /> Sorgulanıyor…
                    </>
                  ) : (
                    <>
                      <SearchIcon className="size-5" /> Sorgula
                    </>
                  )}
                </Button>
              </div>
            </div>

            {q.usesFilter && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setFilterOpen((o) => !o)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start text-theme-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Tesisat filtresi
                  <Badge size="sm" color="light">
                    {q.selected.length === 0 ? "tümü" : `${q.selected.length} seçili`}
                  </Badge>
                  <ChevronDownIcon className={`ms-auto size-5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                </button>
                {filterOpen && (
                  <div className="border-t border-gray-100 p-4 pb-0 dark:border-gray-800">
                    <TextInput
                      value={q.subsQuery}
                      onChange={(e) => q.setSubsQuery(e.target.value)}
                      placeholder="Ünvan, abone no veya serno ile ara…"
                    />
                  </div>
                )}
                {filterOpen && (
                  <div className="custom-scrollbar grid max-h-64 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
                    {q.visibleSubs.map((s) => (
                      <Checkbox
                        key={s.serno}
                        checked={q.selected.includes(s.serno)}
                        onChange={(on) => q.toggle(s.serno, on)}
                        label={subscriptionText(s)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <Notice kind="error">{q.error}</Notice>
          </Card>

          {q.result && (
            <ResultPanel
              json={q.result.rawJson}
              view={q.view}
              onView={q.setView}
              meta={`#${q.result.searchHistoryId} · ${q.result.rowCount} satır`}
              onDownload={() => q.download(q.result!.searchHistoryId)}
            />
          )}
        </div>
      </LinkGate>
    </>
  );
}
