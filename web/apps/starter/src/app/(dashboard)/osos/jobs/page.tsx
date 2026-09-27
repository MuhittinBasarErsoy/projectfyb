'use client';

import PageContainer from '@/components/layout/page-container';
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Td, Th, Tr } from "@/components/fyblue/data";
import { EmptyBox, FormField, Notice, PageHeader, Section, Select, SkeletonRows } from "@/components/fyblue/ui";
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
import { IconCalendarTime, IconClock, IconExternalLink, IconPlayerPlay, IconRefresh, IconTrash } from "@tabler/icons-react";
import Link from "next/link";

function StateBadge({ state }: { state?: string | null }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  const tone = jobStateTone(state);
  return (
    <Badge variant={tone === "success" ? "default" : tone === "error" ? "destructive" : tone === "info" ? "secondary" : "outline"}>
      {state}
    </Badge>
  );
}

export default function Jobs() {
  const j = useJobs();

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader
        module="osos"
        title={PAGE_TEXT.jobs.title}
        subtitle={PAGE_TEXT.jobs.subtitle}
        items={[{ title: "OSOS" }]}
        actions={
          <a href="/hangfire" target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
            <IconExternalLink /> Hangfire paneli
          </a>
        }
      />

      {j.showOsosWarning && (
        <Notice kind="warning">
          OSOS sorgu işleri için hesabınızı bağlamanız gerekir.{" "}
          <Link href="/settings/connections" className="font-medium underline">
            Bağlı Hesaplar →
          </Link>{" "}
          Hava durumu işleri OSOS hesabı olmadan da çalışır.
        </Notice>
      )}

      <Section title="Yeni iş">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Sorgu">
            <Select value={j.screen} onChange={j.setScreen}>
              {JOB_SCREENS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormField>
          {j.isWeather ? (
            <>
              <FormField label="Enlem">
                <Input type="number" step="any" value={j.lat} onChange={(e) => j.setLat(Number(e.target.value))} />
              </FormField>
              <FormField label="Boylam">
                <Input type="number" step="any" value={j.lon} onChange={(e) => j.setLon(Number(e.target.value))} />
              </FormField>
              <FormField label="Saat dilimi">
                <Input value={j.tz} onChange={(e) => j.setTz(e.target.value)} />
              </FormField>
              <FormField label="Son kaç gün">
                <Input type="number" min={0} value={j.daysBack} onChange={(e) => j.setDaysBack(Number(e.target.value))} />
              </FormField>
              <FormField label="Tilt (ops.)">
                <Input type="number" step="any" value={j.tilt ?? ""} onChange={(e) => j.setTilt(parseOptionalNumber(e.target.value))} />
              </FormField>
              <FormField label="Azimuth (ops.)">
                <Input type="number" step="any" value={j.azimuth ?? ""} onChange={(e) => j.setAzimuth(parseOptionalNumber(e.target.value))} />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Tesisat (Serno)">
                <Select value={String(j.serno)} onChange={(v) => j.setSerno(Number(v))}>
                  <option value="0">Otomatik (müşteri)</option>
                  {j.subs.map((s) => (
                    <option key={s.serno} value={s.serno}>
                      {s.label} {s.serno > 0 ? `(#${s.serno})` : ""}
                    </option>
                  ))}
                </Select>
              </FormField>
              {j.screen !== "Subscriptions" && (
                <FormField label="Son kaç gün">
                  <Input type="number" min={0} value={j.daysBack} onChange={(e) => j.setDaysBack(Number(e.target.value))} />
                </FormField>
              )}
              {j.screen === "Consumption" && (
                <FormField label="Tip">
                  <Input type="number" value={j.type} onChange={(e) => j.setType(Number(e.target.value))} />
                </FormField>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Zamanlama">
            <Select value={j.cronPreset} onChange={j.setCronPreset}>
              {CRON_PRESETS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>
          {j.cronPreset === "custom" && (
            <FormField label="Özel cron">
              <Input value={j.customCron} onChange={(e) => j.setCustomCron(e.target.value)} placeholder="dk sa gün ay haftagünü" />
            </FormField>
          )}
          <FormField label="İsim (opsiyonel)">
            <Input value={j.name} onChange={(e) => j.setName(e.target.value)} placeholder="ör. gunluk-tuketim" />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={j.runNow} disabled={j.busy}>
            <IconPlayerPlay /> Şimdi çalıştır
          </Button>
          <Button variant="outline" onClick={j.schedule} disabled={j.busy || j.effectiveCron === ""}>
            <IconCalendarTime /> Zamanla
          </Button>
        </div>
        {j.notice && <Notice kind={j.notice.ok ? "success" : "error"}>{j.notice.text}</Notice>}
      </Section>

      <Section
        title="Zamanlanmış işler"
        flush
        action={
          <Button variant="outline" size="sm" onClick={j.reload}>
            <IconRefresh /> Yenile
          </Button>
        }
      >
        {j.jobs === null ? (
          <div className="px-4 pb-4">
            <SkeletonRows rows={3} />
          </div>
        ) : j.jobs.length === 0 ? (
          <EmptyBox icon={<IconClock />} title="Zamanlanmış iş yok" text="Yukarıdan bir zamanlama seçip “Zamanla”ya basın." />
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
                <Td className="font-medium">
                  <span title={job.id}>{shortJobId(job.id)}</span>
                </Td>
                <Td>{screenName(job.screen)}</Td>
                <Td>{job.serno === 0 ? "oto" : job.serno}</Td>
                <Td num>{job.daysBack}</Td>
                <Td>
                  <code className="bg-muted px-1 text-xs">{job.cron}</code>
                </Td>
                <Td>{job.nextRun}</Td>
                <Td>{job.lastRun}</Td>
                <Td>
                  <StateBadge state={job.lastState} />
                </Td>
                <Td className="text-right">
                  <div className="inline-flex gap-0.5">
                    <Button variant="ghost" size="icon-sm" title="Şimdi tetikle" aria-label="Şimdi tetikle" onClick={() => j.trigger(job.id)}>
                      <IconPlayerPlay />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Sil" aria-label="Sil" className="hover:text-destructive" onClick={() => j.remove(job.id)}>
                      <IconTrash />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Section>
    </div>
      </PageContainer>
  );
}
