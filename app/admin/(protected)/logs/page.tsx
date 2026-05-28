import { retryNotificationLogAction, retrySheetSyncLogAction } from "@/app/admin/(protected)/logs/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getAdminLogs, type NotificationLogRow, type SheetSyncLogRow } from "@/lib/admin/logs";

function retryBadge(status: string, rowId?: string | null) {
  if (status === "failed" || status === "queued") return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Retry eligible</span>;
  if (status === "processing") return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Processing</span>;
  if (status === "ambiguous") return <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">Manual review</span>;
  if (status === "sent" || (status === "success" && rowId)) return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Complete</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Read-only</span>;
}

function RetryButton({ id, action, label }: { id: string; action: (formData: FormData) => Promise<void>; label: string }) {
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="logId" value={id} />
      <button className="rounded-md bg-[var(--ac-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90" type="submit">{label}</button>
    </form>
  );
}

function NotificationItem({ row }: { row: NotificationLogRow }) {
  const canRetry = row.status === "failed" || row.status === "queued";
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3"><p className="font-medium">{row.channel} · {row.status}</p>{retryBadge(row.status)}</div>
      <p className="text-muted-foreground">{row.template_name ?? row.recipient ?? "—"} · {new Date(row.created_at).toLocaleString("es-MX")}</p>
      <p className="text-xs text-muted-foreground">Intentos: {row.attempt_count ?? 0}{row.last_attempt_at ? ` · Último: ${new Date(row.last_attempt_at).toLocaleString("es-MX")}` : ""}</p>
      {row.error_message ? <p className="text-xs text-red-700">{row.error_message}</p> : null}
      {canRetry ? <RetryButton id={row.id} action={retryNotificationLogAction} label="Reintentar email" /> : null}
    </li>
  );
}

function SheetItem({ row }: { row: SheetSyncLogRow }) {
  const canRetry = row.status === "failed" || row.status === "queued";
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3"><p className="font-medium">{row.sheet_name ?? "Sheet"} · {row.status}</p>{retryBadge(row.status, row.row_id)}</div>
      <p className="text-muted-foreground">{row.row_id ?? row.idempotency_key ?? "—"} · {new Date(row.created_at).toLocaleString("es-MX")}</p>
      <p className="text-xs text-muted-foreground">Intentos: {row.attempt_count ?? 0}{row.last_attempt_at ? ` · Último: ${new Date(row.last_attempt_at).toLocaleString("es-MX")}` : ""}</p>
      {row.error_message ? <p className="text-xs text-red-700">{row.error_message}</p> : null}
      {canRetry ? <RetryButton id={row.id} action={retrySheetSyncLogAction} label="Reintentar Sheets" /> : null}
    </li>
  );
}

export default async function LogsPage() {
  await requireAdminRole(["admin", "marketing", "asesor"]);
  const { whatsapp, notifications, sheets, errors } = await getAdminLogs();
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Auditoría ligera</p><h1 className="mt-2 text-3xl font-bold">Logs</h1><p className="mt-2 text-muted-foreground">Vistas de WhatsApp clicks, notificaciones y sincronización con Sheets. Los reintentos están protegidos por rol y sólo aparecen en filas elegibles.</p></div>{errors.length ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">Algunas consultas fallaron: {errors.join("; ")}</CardContent></Card> : null}<section className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>WhatsApp clicks ({whatsapp.length})</CardTitle></CardHeader><CardContent>{whatsapp.length ? <ul className="space-y-3 text-sm">{whatsapp.map((row) => <li className="rounded-md border p-3" key={row.id}><div className="flex items-start justify-between gap-3"><p className="font-medium">{row.phone ?? row.contacts?.phone ?? "Sin teléfono"}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Read-only</span></div><p className="text-muted-foreground">{row.page_path ?? "—"} · {new Date(row.created_at).toLocaleString("es-MX")}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin clicks visibles.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Notificaciones ({notifications.length})</CardTitle></CardHeader><CardContent>{notifications.length ? <ul className="space-y-3 text-sm">{notifications.map((row) => <NotificationItem key={row.id} row={row} />)}</ul> : <p className="text-sm text-muted-foreground">Sin notificaciones visibles.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Sheets ({sheets.length})</CardTitle></CardHeader><CardContent>{sheets.length ? <ul className="space-y-3 text-sm">{sheets.map((row) => <SheetItem key={row.id} row={row} />)}</ul> : <p className="text-sm text-muted-foreground">Sin sincronizaciones visibles.</p>}</CardContent></Card></section></main>;
}
