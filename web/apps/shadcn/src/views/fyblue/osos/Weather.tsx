import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ResultPanel } from "@/components/fyblue/data";
import { FormField, Notice, PageHeader, Section } from "@/components/fyblue/ui";
import { PAGE_TEXT, parseOptionalNumber, useWeather } from "@fyblue/core";
import { CloudSun } from "lucide-react";

export default function Weather() {
  const w = useWeather();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader module="osos" title={PAGE_TEXT.weather.title} subtitle={PAGE_TEXT.weather.subtitle} items={[{ title: "OSOS" }]} />

      <Section>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Enlem">
            <Input type="number" step="any" value={w.lat} onChange={(e) => w.setLat(Number(e.target.value))} />
          </FormField>
          <FormField label="Boylam">
            <Input type="number" step="any" value={w.lon} onChange={(e) => w.setLon(Number(e.target.value))} />
          </FormField>
          <FormField label="Başlangıç">
            <Input type="date" value={w.start} onChange={(e) => w.setStart(e.target.value)} />
          </FormField>
          <FormField label="Bitiş">
            <Input type="date" value={w.end} onChange={(e) => w.setEnd(e.target.value)} />
          </FormField>
          <FormField label="Saat dilimi">
            <Input value={w.tz} onChange={(e) => w.setTz(e.target.value)} />
          </FormField>
          <FormField label="Panel tilt (ops.)">
            <Input type="number" step="any" placeholder="0–90°" value={w.tilt ?? ""} onChange={(e) => w.setTilt(parseOptionalNumber(e.target.value))} />
          </FormField>
          <FormField label="Azimuth (ops.)">
            <Input
              type="number"
              step="any"
              placeholder="-180–180°"
              value={w.azimuth ?? ""}
              onChange={(e) => w.setAzimuth(parseOptionalNumber(e.target.value))}
            />
          </FormField>
          <div>
            <Button onClick={w.run} disabled={w.busy}>
              {w.busy ? <Spinner /> : <CloudSun />}
              {w.busy ? "İndiriliyor…" : "Verileri getir"}
            </Button>
          </div>
        </div>
        <Notice kind="error">{w.error}</Notice>
      </Section>

      {w.result && (
        <ResultPanel
          json={w.result.rawJson}
          view={w.view}
          onView={w.setView}
          meta={`#${w.result.searchHistoryId} · ${w.result.rowCount} saat`}
          onDownload={() => w.download(w.result!.searchHistoryId)}
        />
      )}
    </div>
  );
}
