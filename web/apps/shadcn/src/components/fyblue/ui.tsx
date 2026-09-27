// FyBlue ekranlarında ortak kullanılan parçalar — Shadcn Dashboard'un kendi shadcn/ui bileşenleriyle.

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { ReactNode } from "react";

export { default as PageHeader } from "@/layouts/full/shared/breadcrumb/BreadcrumbComp";

export function Section({
  title,
  description,
  action,
  children,
  flush,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  /** İçerik kenar boşluksuz (tablolar). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("bg-background", flush && "pb-0", className)}>
      {(title || action) && (
        <CardHeader className={cn(flush && "border-b")}>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction className="flex flex-wrap gap-2">{action}</CardAction>}
        </CardHeader>
      )}
      {children !== undefined && <CardContent className={cn("flex flex-col gap-4", flush && "px-0")}>{children}</CardContent>}
    </Card>
  );
}

export function Notice({
  kind,
  title,
  children,
  onClose,
  className,
}: {
  kind: "success" | "error" | "warning" | "info";
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  if (!title && !children) return null;
  const Icon = kind === "success" ? CheckCircle2 : kind === "info" ? Info : AlertCircle;
  return (
    <Alert
      variant={kind === "error" ? "destructive" : "default"}
      className={cn(
        kind === "success" && "text-emerald-700 dark:text-emerald-400",
        kind === "warning" && "text-amber-700 dark:text-amber-400",
        onClose && "pr-10",
        className,
      )}
    >
      <Icon />
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && <AlertDescription className="text-current/90">{children}</AlertDescription>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute top-2 right-2 rounded-sm p-0.5 opacity-70 hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </Alert>
  );
}

export function FormField({
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-muted-foreground font-normal">{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

export function Select({
  value,
  onChange,
  children,
  className,
  ...rest
}: Omit<React.ComponentProps<"select">, "onChange" | "size"> & { onChange: (v: string) => void }) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} className={cn("w-full", className)} {...rest}>
      {children}
    </NativeSelect>
  );
}

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
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList className="flex-wrap">
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${90 - (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}

export function EmptyBox({
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
    <Empty>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {text && <EmptyDescription>{text}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: "success" | "error" }) {
  return (
    <div className="bg-muted/50 flex flex-col gap-0.5 rounded-md border px-3 py-2.5">
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "error" && "text-destructive",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
