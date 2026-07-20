import {
  retryNotificationLogAction,
  setNotificationIncidentStatusAction,
} from "@/app/admin/(protected)/logs/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getAdminLogs, type IncidentStatus, type NotificationLogRow, type OperationalIncidentRow } from "@/lib/admin/logs";
import { hasAnyRole } from "@/lib/supabase/roles";

function retryBadge(status: string, incidentStatus?: IncidentStatus, rowId?: string | null) {
  if (incidentStatus === "resolved" && (status === "failed" || status === "ambiguous")) {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Resolved</span>;
  }
  if (status === "failed" || status === "queued") return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Retry eligible</span>;
  if (status === "processing") return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Processing</span>;
  if (status === "ambiguous") return <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">Manual review</span>;
  if (status === "sent" || (status === "success" && rowId)) return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Complete</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Read-only</span>;
}

function ActionButton({ label, tone = "primary" }: { label: string; tone?: "primary" | "secondary" }) {
  return (
    <button
      className={tone === "primary" ? "rounded-md bg-[var(--ac-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90" : "rounded-md border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"}
      type="submit"
    >
      {label}
    </button>
  );
}

function InlineAction({ action, logId, incidentStatus, label, tone = "secondary" }: { action: (formData: FormData) => Promise<void>; logId: string; incidentStatus?: IncidentStatus; label: string; tone?: "primary" | "secondary" }) {
  return (
    <form action={action} className="mt-3 inline-flex">
      <input name="logId" type="hidden" value={logId} />
      {incidentStatus ? <input name="incidentStatus" type="hidden" value={incidentStatus} /> : null}
      <ActionButton label={label} tone={tone} />
    </form>
  );
}

function IncidentControls({ canOperate, logId, incidentStatus, retryAction, retryLabel, setIncidentAction, status }: { canOperate: boolean; logId: string; incidentStatus: IncidentStatus; retryAction: (formData: FormData) => Promise<void>; retryLabel: string; setIncidentAction: (formData: FormData) => Promise<void>; status: string }) {
  if (!canOperate) return null;
  const canRetry = status === "failed" || status === "queued";
  const canResolve = incidentStatus === "open" && (status === "failed" || status === "ambiguous");
  const canReopen = incidentStatus === "resolved" && (status === "failed" || status === "ambiguous");

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canRetry ? <InlineAction action={retryAction} label={retryLabel} logId={logId} tone="primary" /> : null}
      {canResolve ? <InlineAction action={setIncidentAction} incidentStatus="resolved" label="Marcar resuelto" logId={logId} /> : null}
      {canReopen ? <InlineAction action={setIncidentAction} incidentStatus="open" label="Reabrir" logId={logId} /> : null}
    </div>
  );
}

function NotificationItem({ canOperate, row }: { canOperate: boolean; row: NotificationLogRow }) {
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{row.channel} · {row.status}</p>
        {retryBadge(row.status, row.incident_status as IncidentStatus)}
      </div>
      <p className="text-muted-foreground">{row.template_name ?? row.recipient ?? "—"} · {new Date(row.created_at).toLocaleString("es-MX")}</p>
      <p className="text-xs text-muted-foreground">Intentos: {row.attempt_count ?? 0}{row.last_attempt_at ? ` · Último: ${new Date(row.last_attempt_at).toLocaleString("es-MX")}` : ""}{row.incident_updated_at ? ` · Incidente: ${row.incident_status} ${new Date(row.incident_updated_at).toLocaleString("es-MX")}` : ""}</p>
      {row.error_message ? <p className="text-xs text-red-700">{row.error_message}</p> : null}
      <IncidentControls canOperate={canOperate} incidentStatus={(row.incident_status as IncidentStatus) ?? "open"} logId={row.id} retryAction={retryNotificationLogAction} retryLabel="Reintentar email" setIncidentAction={setNotificationIncidentStatusAction} status={row.status} />
    </li>
  );
}

function RecentIncidentItem({ row }: { row: OperationalIncidentRow }) {
  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Email · {row.title}</p>
          <p className="text-muted-foreground">{row.detail}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.incidentStatus === "open" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {row.incidentStatus === "open" ? "Abierto" : "Resuelto"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{row.status} · {new Date(row.createdAt).toLocaleString("es-MX")}</p>
      {row.errorMessage ? <p className="mt-2 text-xs text-red-700">{row.errorMessage}</p> : null}
    </li>
  );
}

export default async function LogsPage() {
  const session = await requireAdminRole(["admin", "marketing", "asesor"]);
  const canOperate = hasAnyRole(session.roles, ["admin", "marketing"]);
  const { whatsapp, notifications, recentIncidents, incidentSummary, errors } = await getAdminLogs();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Auditoría ligera</p>
        <h1 className="mt-2 text-3xl font-bold">Logs operativos</h1>
        <p className="mt-2 text-muted-foreground">WhatsApp y notificaciones con visibilidad de incidentes persistentes. {canOperate ? "Puedes reintentar y cerrar/reabrir incidentes de email." : "Tu acceso es de solo lectura."}</p>
      </div>

      {errors.length ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">Algunas consultas fallaron: {errors.join("; ")}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Incidentes abiertos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Email: <span className="font-semibold">{incidentSummary.openNotifications}</span></p>
            <p className="text-muted-foreground">Los incidentes resueltos permanecen visibles en el historial reciente.</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Errores e incidentes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentIncidents.length ? (
              <ul className="grid gap-3 md:grid-cols-2">{recentIncidents.map((row) => <RecentIncidentItem key={`${row.source}-${row.id}`} row={row} />)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin incidentes recientes visibles.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp clicks ({whatsapp.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {whatsapp.length ? (
              <ul className="space-y-3 text-sm">
                {whatsapp.map((row) => (
                  <li className="rounded-md border p-3" key={row.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{row.phone ?? row.contacts?.phone ?? "Sin teléfono"}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Read-only</span>
                    </div>
                    <p className="text-muted-foreground">{row.page_path ?? "—"} · {new Date(row.created_at).toLocaleString("es-MX")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin clicks visibles.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificaciones ({notifications.length})</CardTitle>
          </CardHeader>
          <CardContent>{notifications.length ? <ul className="space-y-3 text-sm">{notifications.map((row) => <NotificationItem canOperate={canOperate} key={row.id} row={row} />)}</ul> : <p className="text-sm text-muted-foreground">Sin notificaciones visibles.</p>}</CardContent>
        </Card>
      </section>
    </main>
  );
}
