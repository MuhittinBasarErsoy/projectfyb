import PageMeta from "@/components/common/PageMeta";
import { MiniStat, Notice, PageHeader, SkeletonRows } from "@/components/fyblue/ui";
import Badge from "@/components/ui/badge/Badge";
import { BoltIcon, DataBaseIcon, PieChartIcon, PlugInIcon, SearchIcon, TaskIcon, TimeIcon } from "@/icons";
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
import type { ReactNode } from "react";
import { Link } from "react-router";

function ConnectionBadge({ status }: { status: ExternalAccountStatus | null }) {
  if (!status) return <Badge color="light">Kontrol ediliyor…</Badge>;
  return status.linked ? <Badge color="success">Bağlı · {status.username}</Badge> : <Badge color="light">Bağlı değil</Badge>;
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
    <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {status && !status.linked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{linkText}</p>
          <Link
            to="/settings/connections"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
          >
            <PlugInIcon className="size-5" /> {title} hesabını bağla
          </Link>
        </div>
      )}

      {children}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200"
          >
            {l.icon}
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Overview() {
  const { username } = useAuth();
  const conn = useConnections();
  const o = useOverview();

  return (
    <>
      <PageMeta title="Genel Bakış · FyBlue" description={PAGE_TEXT.overview.subtitle} />
      <PageHeader title={`Merhaba, ${username}`} subtitle={PAGE_TEXT.overview.subtitle} />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-6">
          <ModuleCard
            icon={<PieChartIcon className="size-6" />}
            title="OSOS"
            subtitle="UEDAŞ sayaç verileri"
            status={conn.osos}
            linkText="Sorgu yapabilmek için OSOS kullanıcı kodu ve şifrenizi bağlayın."
            links={[
              { to: "/osos/query", label: "Yeni sorgu", icon: <SearchIcon className="size-5" /> },
              { to: "/osos/history", label: "Geçmiş", icon: <TimeIcon className="size-5" /> },
              { to: "/osos/jobs", label: "İşler", icon: <TaskIcon className="size-5" /> },
            ]}
          >
            <div>
              <h4 className="mb-3 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">Son sorgular</h4>
              {o.ososError ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{o.ososError}</p>
              ) : o.recent === null ? (
                <SkeletonRows rows={3} />
              ) : o.recent.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Henüz sorgu yok.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {o.recent.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 py-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                        <SearchIcon className="size-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {screenName(h.screen)}
                        </span>
                        <span className="text-theme-xs text-gray-500 dark:text-gray-400">{h.rowCount ?? 0} satır</span>
                      </span>
                      <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
                        {fmtShortDateTime(h.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ModuleCard>
        </div>

        <div className="col-span-12 xl:col-span-6">
          <ModuleCard
            icon={<BoltIcon className="size-6" />}
            title="EPİAŞ"
            subtitle="Şeffaflık Platformu"
            status={conn.epias}
            linkText="Veri çekebilmek için EPİAŞ kullanıcı adı ve şifrenizi bağlayın."
            links={[
              { to: "/epias", label: "Toplu senkron", icon: <PieChartIcon className="size-5" /> },
              { to: "/epias/endpoints", label: "Servisler", icon: <DataBaseIcon className="size-5" /> },
              { to: "/epias/formulas", label: "Formüller", icon: <TaskIcon className="size-5" /> },
            ]}
          >
            <div>
              <h4 className="mb-3 text-theme-xs font-medium tracking-wide text-gray-400 uppercase">Katalog</h4>
              {o.epiasError ? (
                <Notice kind="error">{o.epiasError}</Notice>
              ) : o.stats === null ? (
                <SkeletonRows rows={2} />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat value={fmtInt(o.stats.dataEndpoints)} label="veri servisi" />
                  <MiniStat value={fmtInt(o.stats.syncedEndpoints)} label="senkronize" />
                  <MiniStat value={fmtInt(o.stats.totalOperations)} label="toplam operasyon" />
                </div>
              )}
            </div>
          </ModuleCard>
        </div>
      </div>
    </>
  );
}
