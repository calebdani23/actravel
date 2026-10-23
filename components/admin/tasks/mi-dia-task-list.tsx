import Link from "next/link";

import type { MiDiaBucket, MiDiaItem, MiDiaResult, MiDiaScope } from "@/lib/admin/mi-dia";
import { MiDiaTaskActions, type MiDiaTaskRequestIds } from "./mi-dia-task-actions";

const scopeLabels: Record<MiDiaScope, string> = { self: "Mis tareas", team: "Tareas del equipo", all: "Todas las tareas" };
const kindLabels = { follow_up: "Seguimiento", first_contact: "Primer contacto", quote_follow_up: "Seguimiento de cotización" } as const;
const statusLabels = { pending: "Pendiente", in_progress: "En curso" } as const;
const bucketLabels: Record<MiDiaBucket, string> = { overdue: "Vencidas", today: "Hoy", upcoming: "Próximas" };
const timeFormatter = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });

const requestIds = (): MiDiaTaskRequestIds => {
  const create = () => crypto.randomUUID().toLowerCase();
  return { start: create(), complete: create(), cancel: { no_longer_needed: create(), duplicate: create(), source_invalidated: create(), other: create() } };
};

async function action(state: Parameters<typeof import("@/app/admin/(protected)/dashboard/actions").miDiaTaskAction>[0], formData: FormData) {
  "use server";
  return (await import("@/app/admin/(protected)/dashboard/actions")).miDiaTaskAction(state, formData);
}

export function MiDiaLoading() {
  return (
    <section aria-busy="true" aria-labelledby="mi-dia-loading-heading" className="space-y-4 rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border-subtle)] p-5">
      <h2 className="text-lg font-semibold" id="mi-dia-loading-heading">Cargando Mi día</h2>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className="h-20 animate-pulse rounded-[var(--admin-radius-control)] bg-[color:var(--admin-surface-muted)]" key={index} />)}
      </div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[var(--admin-radius-control)] bg-[color:var(--admin-surface-muted)] p-3"><dt className="text-xs text-[color:var(--admin-muted-foreground)]">{label}</dt><dd className="text-xl font-semibold">{value}</dd></div>;
}

function Task({ item }: { item: MiDiaItem }) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs"><strong>{kindLabels[item.kind]}</strong><span>{statusLabels[item.status]}</span>{item.bucket === "overdue" ? <span>Vencida</span> : null}</div>
      <p className="mt-2 text-sm">{item.description}</p>
      <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">Responsable: {item.ownerLabel}</p>
      <time className="mt-1 block text-xs text-[color:var(--admin-muted-foreground)]" dateTime={item.dueAt}>{timeFormatter.format(new Date(item.dueAt))} hora de Ciudad de México</time>
    </>
  );
  return (
    <li className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
      {item.navigationHref ? <Link className="block rounded-sm focus-visible:outline focus-visible:outline-2" href={item.navigationHref}>{content}</Link> : content}
      <MiDiaTaskActions action={action} item={item} requestIds={requestIds()} />
    </li>
  );
}

function nextHref(result: Extract<MiDiaResult, { ok: true }>) {
  const cursor = result.pageInfo.nextCursor;
  if (!result.pageInfo.hasMore || !cursor) return null;
  const query = new URLSearchParams({ referenceTime: cursor.referenceTime, afterDueAt: cursor.afterDueAt, afterId: cursor.afterId });
  return `/admin/dashboard?${query.toString()}`;
}

export function MiDiaTaskList({ result }: { result: MiDiaResult }) {
  if (!result.ok) {
    return (
      <section aria-labelledby="mi-dia-heading" className="space-y-3 rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border-subtle)] p-5">
        <h2 className="text-lg font-semibold" id="mi-dia-heading">Mi día</h2>
        <p role="alert">No pudimos cargar Mi día. Intenta de nuevo.</p>
        <Link autoFocus className="inline-flex rounded-sm font-medium text-[color:var(--admin-accent)] underline focus-visible:outline focus-visible:outline-2" href="/admin/dashboard">Reintentar</Link>
      </section>
    );
  }

  const href = nextHref(result);
  return (
    <section aria-labelledby="mi-dia-heading" className="space-y-5 rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border-subtle)] p-5">
      <div><p className="text-sm text-[color:var(--admin-muted-foreground)]">{scopeLabels[result.scope]}</p><h2 className="text-xl font-semibold" id="mi-dia-heading">Mi día</h2></div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Count label="Vencidas" value={result.counts.overdue} /><Count label="Hoy" value={result.counts.today} />
        <Count label="Próximas" value={result.counts.upcoming} /><Count label="Total" value={result.counts.total} />
      </dl>
      {result.items.length === 0 ? <p>{result.scope === "self" ? "No tienes tareas activas." : "No hay tareas activas para mostrar."}</p> : (
        <div className="space-y-5">
          {(Object.keys(bucketLabels) as MiDiaBucket[]).map((bucket) => {
            const items = result.items.filter((item) => item.bucket === bucket);
            return items.length ? <section aria-labelledby={`mi-dia-${bucket}`} key={bucket}><h3 className="mb-2 font-semibold" id={`mi-dia-${bucket}`}>{bucketLabels[bucket]} ({items.length})</h3><ul className="space-y-3">{items.map((item) => <Task item={item} key={item.taskId} />)}</ul></section> : null;
          })}
        </div>
      )}
      {href ? <nav aria-label="Paginación de Mi día"><Link className="font-medium text-[color:var(--admin-accent)] underline" href={href}>Siguiente</Link></nav> : null}
    </section>
  );
}
