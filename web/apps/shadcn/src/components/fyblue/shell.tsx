// Kabukla ilgili parçalar: oturum koruması, hesap kapısı, şablon seçici, menü ikonları.

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  switchTemplate,
  TEMPLATES,
  useAuth,
  useConnections,
  type ExternalSystem,
  type NavIcon,
  type TemplateId,
} from "@fyblue/core";
import {
  Check,
  Clock,
  CloudSun,
  FunctionSquare,
  Gauge,
  History,
  LayoutDashboard,
  Layers,
  Building2,
  Link2,
  Search,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { EmptyBox, Notice, SkeletonRows } from "./ui";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: LayoutDashboard,
  search: Search,
  history: History,
  clock: Clock,
  weather: CloudSun,
  gauge: Gauge,
  layers: Layers,
  function: FunctionSquare,
  link: Link2,
  user: UserRound,
  building: Building2,
  sliders: SlidersHorizontal,
};

export function RequireAuth({ children }: { children: ReactNode }) {
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
      <Card className="bg-background">
        <CardContent>
          <SkeletonRows rows={3} />
        </CardContent>
      </Card>
    );
  if (c.get(system)?.linked) return <>{children}</>;
  return (
    <Card className="bg-background">
      <EmptyBox
        icon={<Link2 />}
        title={`${label} hesabı bağlı değil`}
        text={`Bu modül ${label} kullanıcı adı ve şifrenizle çalışır. FyBlue girişinizden bağımsızdır; bir kez bağlamanız yeterli.`}
      >
        <Link to="/settings/connections" className={buttonVariants()}>
          <Link2 /> {label} hesabını bağla
        </Link>
      </EmptyBox>
    </Card>
  );
}

export function TemplateThumb({ id }: { id: TemplateId }) {
  const p = TEMPLATES.find((x) => x.id === id)!.preview;
  const r = `${p.radius}px`;
  return (
    <span aria-hidden="true" className="flex h-14 overflow-hidden border" style={{ background: p.bg, borderColor: p.line, borderRadius: p.radius + 2 }}>
      <span className="flex w-[28%] flex-col gap-1 p-1.5" style={{ background: p.sidebar, borderRight: `1px solid ${p.line}` }}>
        <i className="h-1.5 w-3/5" style={{ background: p.accent, borderRadius: r }} />
        <i className="mt-1 h-1.5" style={{ background: p.accent, opacity: 0.2, borderRadius: r }} />
        <i className="h-1.5" style={{ background: p.line, borderRadius: r }} />
      </span>
      <span className="flex flex-1 flex-col gap-1 px-1.5 pb-1.5">
        <span className="-mx-1.5 h-2.5" style={{ borderBottom: `1px solid ${p.line}`, background: "#fff" }} />
        <span className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <i key={i} className="h-3 border bg-white" style={{ borderColor: p.line, borderRadius: r }} />
          ))}
        </span>
        <span className="flex-1 border bg-white" style={{ borderColor: p.line, borderRadius: r }} />
      </span>
    </span>
  );
}

/** Arayüz şablonu seçici. Başka bir şablon seçilince o şablonun aynı ekranı açılır. */
export function TemplatePicker({ path = "/signin" }: { path?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Arayüz şablonu">
      {TEMPLATES.map((t) => {
        const active = t.id === "shadcn";
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
              "relative flex flex-col gap-1.5 border p-1.5 text-left transition-colors",
              active ? "border-foreground ring-foreground/20 ring-1" : "hover:bg-muted border-border",
            )}
          >
            <TemplateThumb id={t.id} />
            <span className="truncate text-xs font-medium">{t.name}</span>
            {active && (
              <span className="bg-primary text-primary-foreground absolute top-2.5 right-2.5 flex size-4 items-center justify-center">
                <Check className="size-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
