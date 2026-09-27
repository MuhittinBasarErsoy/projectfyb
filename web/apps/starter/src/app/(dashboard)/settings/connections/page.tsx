'use client';

import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormField, Notice, PageHeader } from "@/components/fyblue/ui";
import {
  CONNECTION_INFO,
  fmtDateTime,
  PAGE_TEXT,
  useConnectionCard,
  useConnections,
  type ExternalAccountStatus,
  type ExternalSystem,
} from "@fyblue/core";
import { IconBolt, IconCheck, IconGauge, IconLock, IconPencil, IconPlugConnected, IconPlugConnectedX } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";

function ConnectionCard({ system, status, loaded }: { system: ExternalSystem; status: ExternalAccountStatus | null; loaded: boolean }) {
  const info = CONNECTION_INFO[system];
  const c = useConnectionCard(system, status?.username);
  const linked = status?.linked === true;

  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="bg-muted flex size-8 items-center justify-center">
            {system === "osos" ? <IconGauge className="size-4" /> : <IconBolt className="size-4" />}
          </span>
          {info.title}
        </CardTitle>
        <CardDescription>{info.description}</CardDescription>
        <CardAction>
          {!loaded ? (
            <Badge variant="outline">Kontrol ediliyor…</Badge>
          ) : linked ? (
            <Badge>
              <IconCheck /> Bağlı · {status?.username}
            </Badge>
          ) : (
            <Badge variant="secondary">Bağlı değil</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {linked && !c.editing ? (
          <>
            <dl className="bg-muted/50 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 border p-3 text-sm">
              <dt className="text-muted-foreground">Kullanıcı</dt>
              <dd className="font-medium">{status?.username}</dd>
              <dt className="text-muted-foreground">Son güncelleme</dt>
              <dd className="font-medium">{fmtDateTime(status?.updatedAt)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={c.startEdit}>
                <IconPencil /> Bilgileri güncelle
              </Button>
              <Button variant="destructive" onClick={c.unlink} disabled={c.busy}>
                <IconPlugConnectedX /> Bağlantıyı kaldır
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={c.link} className="flex flex-col gap-4">
            <FormField label={info.userLabel}>
              <Input autoComplete="off" value={c.username} onChange={(e) => c.setUsername(e.target.value)} />
            </FormField>
            <FormField label="Şifre">
              <Input type="password" autoComplete="new-password" value={c.password} onChange={(e) => c.setPassword(e.target.value)} />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={c.busy}>
                {c.busy ? <Spinner /> : <IconPlugConnected />}
                Doğrula ve bağla
              </Button>
              {c.editing && (
                <Button type="button" variant="ghost" onClick={c.cancelEdit}>
                  Vazgeç
                </Button>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <IconLock className="size-3.5" /> Bilgiler önce {info.title} sunucusunda doğrulanır; yalnızca başarılıysa kaydedilir.
            </p>
          </form>
        )}
        {c.notice && <Notice kind={c.notice.ok ? "success" : "error"}>{c.notice.text}</Notice>}
      </CardContent>
    </Card>
  );
}

function Connections() {
  const params = useSearchParams();
  const conn = useConnections();

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
      <PageHeader title={PAGE_TEXT.connections.title} subtitle={PAGE_TEXT.connections.subtitle} items={[{ title: "Ayarlar" }]} />
      {params.get("welcome") === "1" && (
        <Notice kind="success" title="Hesabınız oluşturuldu.">
          Kullanmak istediğiniz modülün hesabını aşağıdan bağlayın — ikisini de bağlamak zorunda değilsiniz.
        </Notice>
      )}
      {conn.error && <Notice kind="error">{conn.error}</Notice>}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ConnectionCard system="osos" status={conn.osos} loaded={conn.loaded} />
        <ConnectionCard system="epias" status={conn.epias} loaded={conn.loaded} />
      </div>
    </div>
      </PageContainer>
  );
}

// useSearchParams statik yayında Suspense sınırı ister.
export default function Page() {
  return (
    <Suspense>
      <Connections />
    </Suspense>
  );
}
