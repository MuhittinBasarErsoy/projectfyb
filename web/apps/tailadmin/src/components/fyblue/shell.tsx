// Kabukla ilgili parçalar: logo, menü ikonları, oturum koruması, hesap kapısı, şablon seçici.

import {
  SettingsAltIcon,
  MultiUserIcon,
  BoltIcon,
  ClockIcon,
  DataBaseIcon,
  GridIcon,
  PieChartIcon,
  PlugInIcon,
  SearchIcon,
  TaskIcon,
  TimeIcon,
  UserCircleIcon,
} from "@/icons";
import { asset } from "@/utils/asset";
import { cn } from "@/utils";
import {
  CONNECTION_INFO,
  TEMPLATES,
  switchTemplate,
  useAuth,
  useConnections,
  type ExternalSystem,
  type NavIcon,
  type TemplateId,
} from "@fyblue/core";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Card, EmptyState, Notice, SkeletonRows } from "./ui";

export function NavGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  const map = {
    home: GridIcon,
    search: SearchIcon,
    history: TimeIcon,
    clock: ClockIcon,
    weather: BoltIcon,
    gauge: PieChartIcon,
    layers: DataBaseIcon,
    function: TaskIcon,
    link: PlugInIcon,
    user: UserCircleIcon,
    building: MultiUserIcon,
    sliders: SettingsAltIcon,
  } as const;
  const Icon = map[icon];
  return <Icon className={className} />;
}

export function Logo({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src={asset("images/logo/logo-icon.svg")} alt="" width={32} height={32} />
      {!compact && (
        <span className={cn("text-2xl font-semibold tracking-tight", light ? "text-white" : "text-gray-900 dark:text-white")}>
          FyBlue
        </span>
      )}
    </span>
  );
}

/** Oturum yoksa giriş ekranına yönlendirir; dönüş adresi korunur. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const back = location.pathname + location.search;
    return <Navigate to={back && back !== "/" ? `/signin?returnUrl=${encodeURIComponent(back)}` : "/signin"} replace />;
  }
  return <>{children}</>;
}

/** Modül sayfalarını sarar: ilgili dış hesap bağlı değilse içerik yerine bağlama çağrısı gösterir. */
export function LinkGate({ system, children }: { system: ExternalSystem; children: ReactNode }) {
  const c = useConnections();
  const label = system === "osos" ? "OSOS" : "EPİAŞ";
  if (c.error && !c.loaded) return <Notice kind="error">{c.error}</Notice>;
  if (!c.loaded)
    return (
      <Card>
        <SkeletonRows rows={3} />
      </Card>
    );
  if (c.get(system)?.linked) return <>{children}</>;
  return (
    <Card>
      <EmptyState
        icon={<PlugInIcon className="size-7" />}
        title={`${label} hesabı bağlı değil`}
        text={`Bu modül ${label} kullanıcı adı ve şifrenizle çalışır. FyBlue girişinizden bağımsızdır; bir kez bağlamanız yeterli.`}
      >
        <Link
          to="/settings/connections"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
        >
          <PlugInIcon className="size-5" /> {label} hesabını bağla
        </Link>
      </EmptyState>
    </Card>
  );
}

export function connectionTitle(system: ExternalSystem) {
  return CONNECTION_INFO[system].title;
}

/** Şablon önizlemesi: her şablon kendi renkleriyle çizilir. */
export function TemplateThumb({ id }: { id: TemplateId }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const p = t.preview;
  const r = `${p.radius}px`;
  return (
    <span
      aria-hidden="true"
      className="flex h-16 overflow-hidden border"
      style={{ background: p.bg, borderColor: p.line, borderRadius: p.radius + 2 }}
    >
      <span className="flex w-[28%] flex-col gap-1 p-1.5" style={{ background: p.sidebar, borderRight: `1px solid ${p.line}` }}>
        <i className="h-1.5 w-3/5" style={{ background: p.accent, borderRadius: r }} />
        <i className="mt-1 h-1.5" style={{ background: p.accent, opacity: 0.2, borderRadius: r }} />
        <i className="h-1.5" style={{ background: p.line, borderRadius: r }} />
        <i className="h-1.5" style={{ background: p.line, borderRadius: r }} />
      </span>
      <span className="flex flex-1 flex-col gap-1 px-1.5 pb-1.5">
        <span className="-mx-1.5 h-2.5" style={{ borderBottom: `1px solid ${p.line}`, background: "#fff" }} />
        <span className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <i key={i} className="h-3.5 border bg-white" style={{ borderColor: p.line, borderRadius: r }} />
          ))}
        </span>
        <span className="flex-1 border bg-white" style={{ borderColor: p.line, borderRadius: r }} />
      </span>
    </span>
  );
}

/**
 * Giriş ekranındaki şablon seçici. Başka bir şablon seçilince o şablonun
 * aynı ekranı açılır (oturum ortak olduğu için giriş yapılmışsa ana sayfası).
 */
export function TemplatePicker({ current, path = "/signin" }: { current: TemplateId; path?: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Arayüz şablonu">
      {TEMPLATES.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.name}
            title={t.description}
            onClick={() => !active && switchTemplate(t.id, path)}
            className={cn(
              "relative flex flex-col gap-2 rounded-xl border p-2 text-start transition",
              active
                ? "border-brand-500 ring-3 ring-brand-500/15"
                : "border-gray-200 hover:border-brand-300 dark:border-gray-800 dark:hover:border-brand-800",
            )}
          >
            <TemplateThumb id={t.id} />
            <span className="px-0.5">
              <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">{t.name}</span>
              <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">{t.origin}</span>
            </span>
            {active && (
              <span className="absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full bg-brand-500 text-white">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
