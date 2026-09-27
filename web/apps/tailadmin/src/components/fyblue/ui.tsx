// FyBlue ekranlarında ortak kullanılan parçalar; TailAdmin'in kendi sınıfları ve bileşenleriyle.

import Label from "@/components/form/Label";
import Badge from "@/components/ui/badge/Badge";
import { CheckCircleIcon, CloseIcon, ErrorIcon, InfoIcon } from "@/icons";
import { cn } from "@/utils";
import type { ReactNode } from "react";
import { Link } from "react-router";

// ---- Kart (ComponentCard düzeni) ----

export function Card({
  title,
  desc,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Gövde dolgusuz (tablolar için). */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            {title && <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>}
            {desc && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{desc}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children !== undefined && (
        <div
          className={cn(
            (title || actions) && "border-t border-gray-100 dark:border-gray-800",
            flush ? "" : "space-y-6 p-4 sm:p-6",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ---- Sayfa başlığı (PageBreadCrumb düzeni) ----

export function PageHeader({
  title,
  subtitle,
  module,
  actions,
  crumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  module?: "osos" | "epias";
  actions?: ReactNode;
  crumbs?: { title: string; to?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl">
        {module && (
          <div className="mb-2">
            <Badge size="sm" color={module === "osos" ? "primary" : "success"}>
              {module === "osos" ? "OSOS" : "EPİAŞ"}
            </Badge>
          </div>
        )}
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-end gap-3">
        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400" to="/">
                Ana sayfa
                <Chevron />
              </Link>
            </li>
            {(crumbs ?? []).map((c) => (
              <li key={c.title}>
                {c.to ? (
                  <Link
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                    to={c.to}
                  >
                    {c.title}
                    <Chevron />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    {c.title}
                    <Chevron />
                  </span>
                )}
              </li>
            ))}
            <li className="text-sm text-gray-800 dark:text-white/90">{typeof title === "string" ? title : ""}</li>
          </ol>
        </nav>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="stroke-current rtl:rotate-180" width="17" height="16" viewBox="0 0 17 16" fill="none">
      <path d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366" stroke="" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Uyarı (Alert düzeni, kapatılabilir) ----

type NoticeKind = "success" | "error" | "warning" | "info";

const noticeStyles: Record<NoticeKind, { box: string; icon: string }> = {
  success: {
    box: "border-success-500 bg-success-50 dark:border-success-500/30 dark:bg-success-500/15",
    icon: "text-success-500",
  },
  error: {
    box: "border-error-500 bg-error-50 dark:border-error-500/30 dark:bg-error-500/15",
    icon: "text-error-500",
  },
  warning: {
    box: "border-warning-500 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/15",
    icon: "text-warning-500",
  },
  info: {
    box: "border-blue-light-500 bg-blue-light-50 dark:border-blue-light-500/30 dark:bg-blue-light-500/15",
    icon: "text-blue-light-500",
  },
};

export function Notice({
  kind,
  title,
  children,
  onClose,
  className,
}: {
  kind: NoticeKind;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  if (!title && !children) return null;
  const s = noticeStyles[kind];
  const Icon = kind === "success" ? CheckCircleIcon : kind === "error" ? ErrorIcon : InfoIcon;
  return (
    <div className={cn("rounded-xl border p-4", s.box, className)} role={kind === "error" ? "alert" : "status"}>
      <div className="flex items-start gap-3">
        <div className={cn("-mt-0.5 shrink-0", s.icon)}>
          <Icon className="size-6 fill-current" />
        </div>
        <div className="min-w-0 flex-1 break-words">
          {title && <h4 className="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>}
          {children && <div className="text-sm text-gray-600 dark:text-gray-400">{children}</div>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <CloseIcon className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Form alanları ----

export const inputClass =
  "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

/** TailAdmin Select görünümünde, dışarıdan kontrol edilen seçim kutusu. */
export function SelectInput({
  value,
  onChange,
  children,
  className,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & { onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, "pe-11 dark:bg-gray-900", className)}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-400"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
      >
        <path d="M4.79175 8.02075L10.0001 13.2291L15.2084 8.02075" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ---- Sekme düğmeleri (ChartTab düzeni) ----

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-fit flex-wrap items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-theme-sm font-medium hover:text-gray-900 dark:hover:text-white",
            value === o.value
              ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
              : "text-gray-500 dark:text-gray-400",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Yükleniyor / boş durum ----

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-e-transparent", className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-3.5 rounded bg-gray-200 dark:bg-gray-800" style={{ width: `${90 - (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && (
        <div className="mb-2 flex size-14 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          {icon}
        </div>
      )}
      <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h4>
      {text && <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">{text}</p>}
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </div>
  );
}

export function IconButton({
  title,
  onClick,
  children,
  danger,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
        danger && "hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/15 dark:hover:text-error-500",
      )}
    >
      {children}
    </button>
  );
}

/** Kısa istatistik kutusu (Genel Bakış / sonuç özetleri). */
export function MiniStat({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: "success" | "error" }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
      <div
        className={cn(
          "text-title-sm font-bold text-gray-800 dark:text-white/90",
          tone === "success" && "text-success-600 dark:text-success-500",
          tone === "error" && "text-error-600 dark:text-error-500",
        )}
      >
        {value}
      </div>
      <div className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
