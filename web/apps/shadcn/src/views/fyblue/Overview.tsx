import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice, PageHeader, SkeletonRows, Stat } from "@/components/fyblue/ui";
import {
  fmtInt,
  fmtShortDateTime,
  PAGE_TEXT,
  screenName,
  useAuth,
  useConnections,
  useOverview,
  type ExternalAccountStatus,
} from "@fyblue/core";
import { Clock, FunctionSquare, Gauge, History, Layers, Link2, Search, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

function Status({ s }: { s: ExternalAccountStatus | null }) {
  if (!s) return <Badge variant="outline">Kontrol ediliyor…</Badge>;
  return s.linked ? <Badge>Bağlı · {s.username}</Badge> : <Badge variant="secondary">Bağlı değil</Badge>;
}

function ModuleCard({
  icon,
  title,
  subtitle,
  status,
  linkText,
  links,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  status: ExternalAccountStatus | null;
  linkText: string;
  links: { to: string; label: string; icon: ReactNode }[];
  children: ReactNode;
}) {
  return (
    <Card className="bg-background h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="bg-muted flex size-8 items-center justify-center">{icon}</span>
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
        <CardAction>
          <Status s={status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {status && !status.linked && (
          <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 border p-3">
            <p className="text-muted-foreground text-sm">{linkText}</p>
            <Link to="/settings/connections" className={buttonVariants({ size: "sm" })}>
              <Link2 /> {title} hesabını bağla
            </Link>
          </div>
        )}
        {children}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {l.icon}
            {l.label}
          </Link>
        ))}
      </CardFooter>
    </Card>
  );
}

export default function Overview() {
  const { username } = useAuth();
  const conn = useConnections();
  const o = useOverview();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Merhaba, ${username}`} subtitle={PAGE_TEXT.overview.subtitle} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ModuleCard
          icon={<Gauge className="size-4" />}
          title="OSOS"
          subtitle="UEDAŞ sayaç verileri"
          status={conn.osos}
          linkText="Sorgu yapabilmek için OSOS kullanıcı kodu ve şifrenizi bağlayın."
          links={[
            { to: "/osos/query", label: "Yeni sorgu", icon: <Search /> },
            { to: "/osos/history", label: "Geçmiş", icon: <History /> },
            { to: "/osos/jobs", label: "İşler", icon: <Clock /> },
          ]}
        >
          <div className="text-muted-foreground text-xs font-semibold uppercase">Son sorgular</div>
          {o.ososError ? (
            <p className="text-muted-foreground text-sm">{o.ososError}</p>
          ) : o.recent === null ? (
            <SkeletonRows rows={3} />
          ) : o.recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz sorgu yok.</p>
          ) : (
            <ul className="divide-y">
              {o.recent.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Search className="text-muted-foreground size-4" />
                  <span className="font-medium">{screenName(h.screen)}</span>
                  <span className="text-muted-foreground">{h.rowCount ?? 0} satır</span>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">{fmtShortDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </ModuleCard>

        <ModuleCard
          icon={<Zap className="size-4" />}
          title="EPİAŞ"
          subtitle="Şeffaflık Platformu"
          status={conn.epias}
          linkText="Veri çekebilmek için EPİAŞ kullanıcı adı ve şifrenizi bağlayın."
          links={[
            { to: "/epias", label: "Toplu senkron", icon: <Gauge /> },
            { to: "/epias/endpoints", label: "Servisler", icon: <Layers /> },
            { to: "/epias/formulas", label: "Formüller", icon: <FunctionSquare /> },
          ]}
        >
          <div className="text-muted-foreground text-xs font-semibold uppercase">Katalog</div>
          {o.epiasError ? (
            <Notice kind="error">{o.epiasError}</Notice>
          ) : o.stats === null ? (
            <SkeletonRows rows={2} />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat value={fmtInt(o.stats.dataEndpoints)} label="veri servisi" />
              <Stat value={fmtInt(o.stats.syncedEndpoints)} label="senkronize" />
              <Stat value={fmtInt(o.stats.totalOperations)} label="toplam operasyon" />
            </div>
          )}
        </ModuleCard>
      </div>
    </div>
  );
}
