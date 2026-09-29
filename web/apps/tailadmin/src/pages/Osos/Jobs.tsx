import PageMeta from "@/components/common/PageMeta";
import SubscriptionPicker from "@/components/fyblue/SubscriptionPicker";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { Card, EmptyState, Field, IconButton, Notice, PageHeader, SelectInput, SkeletonRows, TextInput } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { CalenderIcon, ClockIcon, PlayIcon, RegenerateIcon, ShareIcon, TrashBinIcon } from "@/icons";
import {
  CRON_PRESETS,
  JOB_SCREENS,
  jobStateTone,
  PAGE_TEXT,
  parseOptionalNumber,
  screenName,
  shortJobId,
  useJobs,
} from "@fyblue/core";
import { Link } from "react-router";

function StateBadge({ state }: { state?: string | null }) {
  if (!state) return <span>—</span>;
  const tone = jobStateTone(state);
  const color = tone === "success" ? "success" : tone === "error" ? "error" : tone === "info" ? "info" : "light";
  return (
    <Badge size="sm" color={color}>
      {state}
    </Badge>
  );
}

export default function Jobs() {
  const j = useJobs();

  return (
    <>
      <PageMeta title="Zamanlanmış İşler · FyBlue" description={PAGE_TEXT.jobs.subtitle} />
      <PageHeader
        module="osos"
        title={PAGE_TEXT.jobs.title}
        subtitle={PAGE_TEXT.jobs.subtitle}
        crumbs={[{ title: "OSOS" }]}
        actions={
          <a
            href="/hangfire"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            <ShareIcon className="size-4" /> Hangfire paneli
          </a>
        }
      />

      <div className="space-y-6">
        {j.showOsosWarning && (
          <Notice kind="warning">
            OSOS sorgu işleri için hesabınızı bağlamanız gerekir.{" "}
            <Link to="/settings/connections" className="font-medium text-brand-500 underline">
              Bağlı Hesaplar →
            </Link>{" "}
            Hava durumu işleri OSOS hesabı olmadan da çalışır.
          </Notice>
        )}

        <Card title="Yeni iş">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Sorgu">
              <SelectInput value={j.screen} onChange={j.setScreen}>
                {JOB_SCREENS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {j.isWeather ? (
              <>
                <Field label="Enlem">
                  <TextInput type="number" step="any" value={j.lat} onChange={(e) => j.setLat(Number(e.target.value))} />
                </Field>
                <Field label="Boylam">
                  <TextInput type="number" step="any" value={j.lon} onChange={(e) => j.setLon(Number(e.target.value))} />
                </Field>
                <Field label="Saat dilimi">
                  <TextInput value={j.tz} onChange={(e) => j.setTz(e.target.value)} />
                </Field>
                <Field label="Son kaç gün">
                  <TextInput type="number" min={0} value={j.daysBack} onChange={(e) => j.setDaysBack(Number(e.target.value))} />
                </Field>
                <Field label="Tilt (ops.)">
                  <TextInput type="number" step="any" value={j.tilt ?? ""} onChange={(e) => j.setTilt(parseOptionalNumber(e.target.value))} />
                </Field>
                <Field label="Azimuth (ops.)">
                  <TextInput
                    type="number"
                    step="any"
                    value={j.azimuth ?? ""}
                    onChange={(e) => j.setAzimuth(parseOptionalNumber(e.target.value))}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Tesisat" className="sm:col-span-2">
                  <SubscriptionPicker subs={j.subs} value={j.serno} onChange={j.setSerno} />
                </Field>
                {j.screen !== "Subscriptions" && (
                  <Field label="Son kaç gün">
                    <TextInput type="number" min={0} value={j.daysBack} onChange={(e) => j.setDaysBack(Number(e.target.value))} />
                  </Field>
                )}
                {j.screen === "Consumption" && (
                  <Field label="Tip">
                    <TextInput type="number" value={j.type} onChange={(e) => j.setType(Number(e.target.value))} />
                  </Field>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Zamanlama">
              <SelectInput value={j.cronPreset} onChange={j.setCronPreset}>
                {CRON_PRESETS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {j.cronPreset === "custom" && (
              <Field label="Özel cron">
                <TextInput value={j.customCron} onChange={(e) => j.setCustomCron(e.target.value)} placeholder="dk sa gün ay haftagünü" />
              </Field>
            )}
            <Field label="İsim (opsiyonel)">
              <TextInput value={j.name} onChange={(e) => j.setName(e.target.value)} placeholder="ör. gunluk-tuketim" />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={j.runNow} disabled={j.busy} startIcon={<PlayIcon className="size-5" />}>
              Şimdi çalıştır
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={j.schedule}
              disabled={j.busy || j.effectiveCron === ""}
              startIcon={<CalenderIcon className="size-5" />}
            >
              Zamanla
            </Button>
          </div>
          {j.notice && <Notice kind={j.notice.ok ? "success" : "error"}>{j.notice.text}</Notice>}
        </Card>

        <Card
          title="Zamanlanmış işler"
          flush
          actions={
            <Button size="xs" variant="outline" onClick={j.reload} startIcon={<RegenerateIcon className="size-4" />}>
              Yenile
            </Button>
          }
        >
          {j.jobs === null ? (
            <div className="p-6">
              <SkeletonRows rows={3} />
            </div>
          ) : j.jobs.length === 0 ? (
            <EmptyState icon={<ClockIcon className="size-7" />} title="Zamanlanmış iş yok" text="Yukarıdan bir zamanlama seçip “Zamanla”ya basın." />
          ) : (
            <DataTable
              head={
                <>
                  <Th>İsim</Th>
                  <Th>Sorgu</Th>
                  <Th>Serno</Th>
                  <Th num>Gün</Th>
                  <Th>Cron</Th>
                  <Th>Sonraki</Th>
                  <Th>Son</Th>
                  <Th>Durum</Th>
                  <Th />
                </>
              }
            >
              {j.jobs.map((job) => (
                <Tr key={job.id}>
                  <Td>
                    <span className="font-medium text-gray-800 dark:text-white/90" title={job.id}>
                      {shortJobId(job.id)}
                    </span>
                  </Td>
                  <Td>{screenName(job.screen)}</Td>
                  <Td>{job.serno === 0 ? "oto" : job.serno}</Td>
                  <Td num>{job.daysBack}</Td>
                  <Td>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-theme-xs dark:bg-white/5">{job.cron}</code>
                  </Td>
                  <Td>{job.nextRun}</Td>
                  <Td>{job.lastRun}</Td>
                  <Td>
                    <StateBadge state={job.lastState} />
                  </Td>
                  <Td className="text-end">
                    <div className="inline-flex">
                      <IconButton title="Şimdi tetikle" onClick={() => j.trigger(job.id)}>
                        <PlayIcon className="size-5" />
                      </IconButton>
                      <IconButton title="Sil" danger onClick={() => j.remove(job.id)}>
                        <TrashBinIcon className="size-5" />
                      </IconButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </>
  );
}
