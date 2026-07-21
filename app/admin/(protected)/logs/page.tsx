import {
  retryNotificationLogAction,
  setNotificationIncidentStatusAction,
} from "@/app/admin/(protected)/logs/actions";
import { AlertBanner, EmptyState, MetricCard, PageContainer, PageHeader, SectionCard, StatusBadge } from "@/components/admin/admin-primitives";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { adminLogsInternals, getAdminLogs, type IncidentStatus, type NotificationLogRow, type OperationalIncidentRow } from "@/lib/admin/logs";
import { hasAnyRole } from "@/lib/supabase/roles";

function retryBadge(status: string, incidentStatus?: IncidentStatus, rowId?: string | null) {
  if (incidentStatus === "resolved" && (status === "failed" || status === "ambiguous")) {
    return <StatusBadge tone="success">Resuelto</StatusBadge>;
  }
  if (status === "failed" || status === "queued") return <StatusBadge tone="warning">Reintento posible</StatusBadge>;
  if (status === "processing") return <StatusBadge tone="info">Procesando</StatusBadge>;
  if (status === "ambiguous") return <StatusBadge tone="brand">Revisión manual</StatusBadge>;
  if (status === "sent" || (status === "success" && rowId)) return <StatusBadge tone="success">Completado</StatusBadge>;
  return <StatusBadge tone="neutral">Solo lectura</StatusBadge>;
}

function ActionButton({ label, tone = "primary" }: { label: string; tone?: "primary" | "secondary" }) {
  return (
    <Button size="sm" type="submit" variant={tone === "primary" ? "default" : "outline"}>{label}</Button>
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
  const templateLabel = adminLogsInternals.notificationTemplateLabel(row.template_name);
  const operatorSummary = adminLogsInternals.notificationOperatorSummary({
    status: row.status,
    incidentStatus: (row.incident_status as IncidentStatus) ?? "open",
    errorMessage: row.error_message,
  });

  return (
    <li className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-[color:var(--admin-foreground)]">{row.channel === "email" ? "Correo electrónico" : "WhatsApp"} · {adminLogsInternals.notificationStatusLabel(row.status)}</p>
        {retryBadge(row.status, row.incident_status as IncidentStatus)}
      </div>
      <p className="text-[color:var(--admin-muted-foreground)]">{templateLabel} · {formatAdminDateTime(row.created_at)}</p>
      <p className="text-xs text-[color:var(--admin-muted-foreground)]">Intentos: {formatAdminInteger(row.attempt_count ?? 0)}{row.last_attempt_at ? ` · Último: ${formatAdminDateTime(row.last_attempt_at)}` : ""}{row.incident_updated_at ? ` · Incidente: ${row.incident_status === "resolved" ? "resuelto" : "abierto"} ${formatAdminDateTime(row.incident_updated_at)}` : ""}</p>
      {operatorSummary ? <p className="text-xs text-[color:var(--admin-error-fg)]">{operatorSummary}</p> : null}
      <IncidentControls canOperate={canOperate} incidentStatus={(row.incident_status as IncidentStatus) ?? "open"} logId={row.id} retryAction={retryNotificationLogAction} retryLabel="Reintentar envío" setIncidentAction={setNotificationIncidentStatusAction} status={row.status} />
    </li>
  );
}

function RecentIncidentItem({ row }: { row: OperationalIncidentRow }) {
  return (
    <li className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[color:var(--admin-foreground)]">Correo electrónico · {row.title}</p>
          <p className="text-[color:var(--admin-muted-foreground)]">{row.detail}</p>
        </div>
        <StatusBadge tone={row.incidentStatus === "open" ? "warning" : "success"}>{row.incidentStatus === "open" ? "Abierto" : "Resuelto"}</StatusBadge>
      </div>
      <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">{adminLogsInternals.notificationStatusLabel(row.status)} · {formatAdminDateTime(row.createdAt)}</p>
      {row.errorMessage ? <p className="mt-2 text-xs text-[color:var(--admin-error-fg)]">{row.errorMessage}</p> : null}
    </li>
  );
}

export default async function LogsPage() {
  const session = await requireAdminRole(["admin", "marketing", "asesor"]);
  const canOperate = hasAnyRole(session.roles, ["admin", "marketing"]);
  const { whatsapp, notifications, recentIncidents, incidentSummary, errors } = await getAdminLogs();

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: "Resumen" }, { label: "Registro" }]}
        description={`WhatsApp y notificaciones con visibilidad de incidentes persistentes. ${canOperate ? "Puedes reintentar y cerrar o reabrir incidencias de correo." : "Tu acceso es de solo lectura."}`}
        eyebrow="Auditoría ligera"
        title="Registro operativo"
      />

      {errors.length ? <AlertBanner description={adminLogsInternals.partialLoadMessage(errors) ?? undefined} title="Carga parcial" tone="warning" /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Correo electrónico con estatus abierto y seguimiento pendiente." label="Incidentes abiertos" tone={incidentSummary.openNotifications ? "warning" : "success"} value={formatAdminInteger(incidentSummary.openNotifications)} />
        <MetricCard detail="Incidencias visibles en el historial reciente." label="Incidentes recientes" tone="neutral" value={formatAdminInteger(recentIncidents.length)} />
        <MetricCard detail="Eventos visibles para la sesión actual." label="Clics de WhatsApp" tone="info" value={formatAdminInteger(whatsapp.length)} />
        <MetricCard detail="Incluye filas con acción y filas de solo lectura." label="Notificaciones" tone="brand" value={formatAdminInteger(notifications.length)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <SectionCard className="lg:col-span-1" description="Los incidentes resueltos permanecen visibles en el historial reciente." title="Estado general">
          <div className="space-y-3 text-sm">
            <p className="text-[color:var(--admin-foreground)]">Correo electrónico: <span className="font-semibold">{formatAdminInteger(incidentSummary.openNotifications)}</span></p>
            <p className="text-[color:var(--admin-muted-foreground)]">{canOperate ? "Puedes intervenir en incidentes permitidos desde esta vista." : "Tu sesión no permite intervenir; solo consultar."}</p>
          </div>
        </SectionCard>
        <SectionCard className="lg:col-span-3" description="Resumen de errores o ambigüedades visibles para la sesión actual." title="Errores e incidentes recientes">
          <div>
            {recentIncidents.length ? (
              <ul className="grid gap-3 md:grid-cols-2">{recentIncidents.map((row) => <RecentIncidentItem key={`${row.source}-${row.id}`} row={row} />)}</ul>
            ) : (
              <EmptyState description="Cuando haya incidentes persistentes visibles para tu sesión, aparecerán aquí." title="Sin incidentes recientes" />
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard description="Eventos recientes de apertura de conversación sin mutaciones sobre el dato original." title={`Clics de WhatsApp ${formatAdminInteger(whatsapp.length)}`}>
          <div>
            {whatsapp.length ? (
              <ul className="space-y-3 text-sm">
                {whatsapp.map((row) => (
                  <li className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={row.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-[color:var(--admin-foreground)]">{row.phone ?? row.contacts?.phone ?? "Sin teléfono"}</p>
                      <StatusBadge tone="neutral">Solo lectura</StatusBadge>
                    </div>
                    <p className="text-[color:var(--admin-muted-foreground)]">{adminLogsInternals.whatsappModuleLabel(row.page_path)} · {formatAdminDateTime(row.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState description="Todavía no hay eventos de apertura de WhatsApp visibles para tu sesión." title="Sin clics visibles" />
            )}
          </div>
        </SectionCard>

        <SectionCard className="lg:col-span-2" description="Historial reciente de envíos e incidentes persistentes. Conserva las acciones actuales cuando el rol lo permite." title={`Notificaciones ${formatAdminInteger(notifications.length)}`}>
          <div>
            {notifications.length ? <ul className="space-y-3 text-sm">{notifications.map((row) => <NotificationItem canOperate={canOperate} key={row.id} row={row} />)}</ul> : <EmptyState description="No hay notificaciones visibles para la sesión actual." title="Sin notificaciones visibles" />}
          </div>
        </SectionCard>
      </section>
    </PageContainer>
  );
}
