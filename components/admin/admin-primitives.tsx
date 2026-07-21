import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleAlert, FileText, Info, MessageSquareMore, SearchX, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAdminDateTime } from "@/lib/admin/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Tone = "success" | "info" | "warning" | "error" | "neutral" | "brand";

const toneClasses: Record<Tone, string> = {
  success: "border-[color:var(--admin-success-border)] bg-[color:var(--admin-success-bg)] text-[color:var(--admin-success-fg)]",
  info: "border-[color:var(--admin-info-border)] bg-[color:var(--admin-info-bg)] text-[color:var(--admin-info-fg)]",
  warning: "border-[color:var(--admin-warning-border)] bg-[color:var(--admin-warning-bg)] text-[color:var(--admin-warning-fg)]",
  error: "border-[color:var(--admin-error-border)] bg-[color:var(--admin-error-bg)] text-[color:var(--admin-error-fg)]",
  neutral: "border-[color:var(--admin-neutral-border)] bg-[color:var(--admin-neutral-bg)] text-[color:var(--admin-neutral-fg)]",
  brand: "border-[color:var(--admin-brand-border)] bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]",
};

export function PageContainer({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <main className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-3">
        {breadcrumbs?.length ? (
          <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--admin-muted-foreground)]">
            {breadcrumbs.map((item, index) => (
              <span className="inline-flex items-center gap-2" key={`${item.label}-${index}`}>
                {index > 0 ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {item.href ? <Link className="hover:text-[color:var(--admin-foreground)] hover:underline" href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--admin-accent)]">{eyebrow}</p> : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--admin-foreground)] sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--admin-muted-foreground)] sm:text-[0.95rem]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: Readonly<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}>) {
  return (
    <Card className={cn("overflow-hidden border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] shadow-[var(--admin-shadow-card)]", className)}>
      {title || description || actions ? (
        <CardHeader className="border-b border-[color:var(--admin-border-subtle)] pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              {title ? <CardTitle className="text-base text-[color:var(--admin-foreground)] sm:text-lg">{title}</CardTitle> : null}
              {description ? <p className="text-sm text-[color:var(--admin-muted-foreground)]">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn("p-5 pt-5 sm:p-6 sm:pt-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function MetricCard({ label, value, detail, tone = "neutral" }: Readonly<{ label: string; value: ReactNode; detail?: ReactNode; tone?: Tone }>) {
  return (
    <Card className="border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] shadow-[var(--admin-shadow-card)]">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[color:var(--admin-muted-foreground)]">{label}</p>
          <span className={cn("h-2.5 w-2.5 rounded-full", toneClasses[tone])} aria-hidden="true" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-[color:var(--admin-foreground)]">{value}</p>
        {detail ? <p className="text-xs leading-5 text-[color:var(--admin-muted-foreground)]">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ children, tone = "neutral", className }: Readonly<{ children: ReactNode; tone?: Tone; className?: string }>) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", toneClasses[tone], className)}>{children}</span>;
}

export function AlertBanner({ title, description, tone = "info", className }: Readonly<{ title?: string; description: ReactNode; tone?: Tone; className?: string }>) {
  const Icon = tone === "error" ? CircleAlert : tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={cn("flex gap-3 rounded-[var(--admin-radius-card)] border px-4 py-3.5 text-sm", toneClasses[tone], className)} role="status">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{description}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[var(--admin-radius-card)] border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] px-5 py-6 text-sm">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]">
        <SearchX className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[color:var(--admin-foreground)]">{title}</h2>
        <p className="max-w-2xl leading-6 text-[color:var(--admin-muted-foreground)]">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function LoadingState({ title = "Cargando", description = "Estamos preparando esta vista." }: Readonly<{ title?: string; description?: string }>) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[color:var(--admin-skeleton)] motion-reduce:animate-none" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-full bg-[color:var(--admin-skeleton)] motion-reduce:animate-none" />
        <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-[color:var(--admin-skeleton)] motion-reduce:animate-none" />
      </div>
      <SectionCard>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="space-y-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-5" key={index}>
              <div className="h-3 w-24 animate-pulse rounded-full bg-[color:var(--admin-skeleton)] motion-reduce:animate-none" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-[color:var(--admin-skeleton)] motion-reduce:animate-none" />
              <div className="h-3 w-32 animate-pulse rounded-full bg-[color:var(--admin-skeleton)] motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </SectionCard>
      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{title}: {description}</p>
    </div>
  );
}

export function ErrorState({ title, description }: Readonly<{ title: string; description: ReactNode }>) {
  return <AlertBanner title={title} description={description} tone="error" />;
}

export function DetailList({
  items,
  columns = 2,
}: Readonly<{
  items: Array<{ label: string; value: ReactNode; hint?: ReactNode }>;
  columns?: 2 | 3;
}>) {
  return (
    <dl className={cn("grid gap-4", columns === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2")}>
      {items.map((item) => (
        <div className="space-y-1.5 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={item.label}>
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">{item.label}</dt>
          <dd className="text-sm font-medium text-[color:var(--admin-foreground)]">{item.value || "—"}</dd>
          {item.hint ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function timelineIcon(kind: string) {
  if (kind === "whatsapp") return MessageSquareMore;
  if (kind === "notification") return Info;
  if (kind === "sheet") return CalendarClock;
  if (kind === "note") return FileText;
  return Wallet;
}

export function ActivityTimeline({
  items,
  emptyTitle = "Sin actividad registrada",
  emptyDescription = "Cuando existan movimientos reales de este lead aparecerán aquí.",
}: Readonly<{
  items: Array<{ id: string; at: string; kind: string; label: string; actorName?: string; summary?: string; metadata?: string[] }>;
  emptyTitle?: string;
  emptyDescription?: string;
}>) {
  if (!items.length) return <EmptyState description={emptyDescription} title={emptyTitle} />;

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const Icon = timelineIcon(item.kind);

        return (
          <li className="flex gap-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={item.id}>
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]">
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
                <div>
                  <p className="font-semibold text-[color:var(--admin-foreground)]">{item.label}</p>
                  {item.actorName ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">Por {item.actorName}</p> : null}
                </div>
                <time className="text-xs text-[color:var(--admin-muted-foreground)]" dateTime={item.at}>{formatAdminDateTime(item.at)}</time>
              </div>
              {item.summary ? <p className="whitespace-pre-wrap text-sm text-[color:var(--admin-foreground)]">{item.summary}</p> : null}
              {item.metadata?.length ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">{item.metadata.join(" · ")}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export const adminInputClassName = "h-[var(--admin-control-height)] w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[color:var(--admin-placeholder)] hover:border-[color:var(--admin-accent-soft)] focus-visible:border-[color:var(--admin-accent)] focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--admin-surface-muted)] disabled:text-[color:var(--admin-placeholder)]";
export const adminSelectClassName = cn(adminInputClassName, "pr-9");
export const adminFieldHintClassName = "text-xs leading-5 text-[color:var(--admin-muted-foreground)]";

export function QuietActionButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button className={cn("border-[color:var(--admin-border)] text-[color:var(--admin-foreground)] hover:bg-[color:var(--admin-surface-muted)]", className)} size="sm" variant="outline" {...props}>
      {children}
    </Button>
  );
}
