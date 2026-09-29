import { ResultPanel } from "@/components/fyblue/data";
import { Card, Field, Notice, SelectInput, Spinner, TextInput } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { SearchIcon } from "@/icons";
import { CUSTOMER_OSOS_TABS, useCustomerOsosTab } from "@fyblue/core";
import { useState } from "react";

export default function OsosDataTab({ customerId, kind }: { customerId: number; kind: "consumption" | "production" | "endex" }) {
  const info = CUSTOMER_OSOS_TABS[kind];
  const q = useCustomerOsosTab(customerId, kind);
  const [view, setView] = useState<"table" | "chart">("table");

  return (
    <div className="space-y-6">
      <Card title={info.title} desc={info.hint}>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Tesisat">
            <SelectInput value={String(q.installationId ?? "")} onChange={(v) => q.setInstallationId(v ? Number(v) : null)}>
              <option value="">Tümü</option>
              {q.installations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Başlangıç">
            <TextInput type="date" value={q.start} onChange={(e) => q.setStart(e.target.value)} />
          </Field>
          <Field label="Bitiş">
            <TextInput type="date" value={q.end} onChange={(e) => q.setEnd(e.target.value)} />
          </Field>
          {q.usesType && (
            <Field label="Tip">
              <TextInput type="number" value={q.type} onChange={(e) => q.setType(Number(e.target.value))} />
            </Field>
          )}
          <div>
            <Button onClick={q.query} disabled={q.busy}>
              {q.busy ? <Spinner /> : <SearchIcon className="size-5" />} Sorgula
            </Button>
          </div>
        </div>
        {q.notice && <Notice kind={q.notice.ok ? "success" : "error"}>{q.notice.text}</Notice>}
        {q.result?.warnings.map((w) => (
          <Notice key={w} kind="warning">
            {w}
          </Notice>
        ))}
      </Card>

      {q.result && q.result.rowCount > 0 && (
        <ResultPanel
          json={q.result.rawJson}
          view={view}
          onView={setView}
          meta={`${q.result.rowCount} satır · ${q.result.subscriptionCount} abonelik`}
        />
      )}
      {q.result && q.result.rowCount === 0 && q.result.warnings.length === 0 && (
        <Notice kind="info">Seçilen aralıkta veri gelmedi.</Notice>
      )}
    </div>
  );
}
