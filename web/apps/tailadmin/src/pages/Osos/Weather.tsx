import PageMeta from "@/components/common/PageMeta";
import { ResultPanel } from "@/components/fyblue/data";
import { Card, Field, Notice, PageHeader, Spinner, TextInput } from "@/components/fyblue/ui";
import Button from "@/components/ui/button/Button";
import { BoltIcon } from "@/icons";
import { PAGE_TEXT, parseOptionalNumber, useWeather } from "@fyblue/core";

export default function Weather() {
  const w = useWeather();

  return (
    <>
      <PageMeta title="Hava Durumu · FyBlue" description={PAGE_TEXT.weather.subtitle} />
      <PageHeader module="osos" title={PAGE_TEXT.weather.title} subtitle={PAGE_TEXT.weather.subtitle} crumbs={[{ title: "OSOS" }]} />

      <div className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Enlem">
              <TextInput type="number" step="any" value={w.lat} onChange={(e) => w.setLat(Number(e.target.value))} />
            </Field>
            <Field label="Boylam">
              <TextInput type="number" step="any" value={w.lon} onChange={(e) => w.setLon(Number(e.target.value))} />
            </Field>
            <Field label="Başlangıç">
              <TextInput type="date" value={w.start} onChange={(e) => w.setStart(e.target.value)} />
            </Field>
            <Field label="Bitiş">
              <TextInput type="date" value={w.end} onChange={(e) => w.setEnd(e.target.value)} />
            </Field>
            <Field label="Saat dilimi">
              <TextInput value={w.tz} onChange={(e) => w.setTz(e.target.value)} />
            </Field>
            <Field label="Panel tilt (ops.)">
              <TextInput
                type="number"
                step="any"
                placeholder="0–90°"
                value={w.tilt ?? ""}
                onChange={(e) => w.setTilt(parseOptionalNumber(e.target.value))}
              />
            </Field>
            <Field label="Azimuth (ops.)">
              <TextInput
                type="number"
                step="any"
                placeholder="-180–180°"
                value={w.azimuth ?? ""}
                onChange={(e) => w.setAzimuth(parseOptionalNumber(e.target.value))}
              />
            </Field>
            <div>
              <Button onClick={w.run} disabled={w.busy}>
                {w.busy ? (
                  <>
                    <Spinner /> İndiriliyor…
                  </>
                ) : (
                  <>
                    <BoltIcon className="size-5" /> Verileri getir
                  </>
                )}
              </Button>
            </div>
          </div>
          <Notice kind="error">{w.error}</Notice>
        </Card>

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
    </>
  );
}
