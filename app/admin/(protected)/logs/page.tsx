import Link from "next/link";
import type { LogActionState } from "@/app/admin/(protected)/logs/action-state";
import {
  retryNotificationLogAction,
  setNotificationIncidentStatusAction,
} from "@/app/admin/(protected)/logs/actions";
import { LogActionForm } from "@/components/admin/logs/log-action-form";
import { AlertBanner, EmptyState, MetricCard, PageContainer, PageHeader, SectionCard, StatusBadge } from "@/components/admin/admin-primitives";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { adminLogsInternals, getAdminLogs, type IncidentStatus, type NotificationLogRow, type OperationalIncidentRow } from "@/lib/admin/logs";
import { hasAnyRole } from "@/lib/supabase/roles";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

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

function IncidentControls({ canOperate, logId, incidentStatus, retryAction, retryLabel, setIncidentAction, status }: { canOperate: boolean; logId: string; incidentStatus: IncidentStatus; retryAction: (state: LogActionState, formData: FormData) => Promise<LogActionState>; retryLabel: string; setIncidentAction: (state: LogActionState, formData: FormData) => Promise<LogActionState>; status: string }) {
  if (!canOperate) return null;
  const canRetry = status === "failed" || status === "queued";
  const canResolve = incidentStatus === "open" && (status === "failed" || status === "ambiguous");
  const canReopen = incidentStatus === "resolved" && (status === "failed" || status === "ambiguous");

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canRetry ? <LogActionForm action={retryAction} label={retryLabel} logId={logId} pendingLabel="Reintentando…" variant="default" /> : null}
      {canResolve ? <LogActionForm action={setIncidentAction} incidentStatus="resolved" label="Marcar resuelto" logId={logId} pendingLabel="Actualizando…" /> : null}
      {canReopen ? <LogActionForm action={setIncidentAction} incidentStatus="open" label="Reabrir" logId={logId} pendingLabel="Actualizando…" /> : null}
    </div>
  );
}

function severityBadge(severity: "high" | "medium" | "info") {
  if (severity === "high") return <StatusBadge tone="warning">Alta</StatusBadge>;
  if (severity === "medium") return <StatusBadge tone="brand">Media</StatusBadge>;
  return <StatusBadge tone="neutral">Informativa</StatusBadge>;
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
        <div className="flex flex-wrap gap-2">
          <p className="font-medium text-[color:var(--admin-foreground)]">{adminLogsInternals.channelLabel(row.channel)} · {adminLogsInternals.notificationStatusLabel(row.status)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {severityBadge(adminLogsInternals.incidentSeverity(row.status, (row.incident_status as IncidentStatus) ?? "open"))}
          {retryBadge(row.status, row.incident_status as IncidentStatus)}
        </div>
      </div>
      <p className="text-[color:var(--admin-muted-foreground)]">{templateLabel} · Mensajería · {formatAdminDateTime(row.created_at)}</p>
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
        <div className="flex flex-wrap gap-2">
          {severityBadge(row.severity)}
          <StatusBadge tone={row.incidentStatus === "open" ? "warning" : "success"}>{row.incidentStatus === "open" ? "Abierto" : "Resuelto"}</StatusBadge>
        </div>
      </div>
      <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">{row.moduleLabel} · {adminLogsInternals.notificationStatusLabel(row.status)} · {formatAdminDateTime(row.createdAt)}</p>
      {row.errorMessage ? <p className="mt-2 text-xs text-[color:var(--admin-error-fg)]">{row.errorMessage}</p> : null}
    </li>
  );
}

function matchesDate(dateFilter: string | undefined, value: string) {
  if (!dateFilter) return true;
  const diff = Date.now() - new Date(value).getTime();
  if (dateFilter === "24h") return diff <= 24 * 60 * 60 * 1000;
  if (dateFilter === "7d") return diff <= 7 * 24 * 60 * 60 * 1000;
  if (dateFilter === "30d") return diff <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

export default async function LogsPage({ searchParams }: PageProps) {
  const session = await requireAdminRole(["admin", "marketing", "asesor"]);
  const params = await searchParams;
  const canOperate = hasAnyRole(session.roles, ["admin", "marketing"]);
  const { whatsapp, notifications, recentIncidents, incidentSummary, errors } = await getAdminLogs();
  const filters = {
    q: value(params, "q")?.trim().toLowerCase(),
    status: value(params, "status"),
    severity: value(params, "severity"),
    module: value(params, "module"),
    channel: value(params, "channel"),
    date: value(params, "date"),
  };
  const whatsappView = whatsapp.map((row) => ({
    id: row.id,
    channel: "whatsapp" as const,
    status: "readonly",
    severity: "info" as const,
    module: adminLogsInternals.whatsappModuleLabel(row.page_path),
    summary: row.phone ?? row.contacts?.phone ?? "Sin teléfono",
    detail: formatAdminDateTime(row.created_at),
    createdAt: row.created_at,
  })).filter((row) => {
    if (filters.channel && filters.channel !== row.channel) return false;
    if (filters.module && filters.module !== row.module) return false;
    if (filters.severity && filters.severity !== row.severity) return false;
    if (!matchesDate(filters.date, row.createdAt)) return false;
    if (filters.q && !`${row.summary} ${row.module}`.toLowerCase().includes(filters.q)) return false;
    return true;
  });
  const notificationView = notifications.filter((row) => {
    const severity = adminLogsInternals.incidentSeverity(row.status, (row.incident_status as IncidentStatus) ?? "open");
    const moduleLabel = "Mensajería";
    const haystack = `${row.recipient ?? ""} ${adminLogsInternals.notificationTemplateLabel(row.template_name)} ${adminLogsInternals.notificationStatusLabel(row.status)} ${moduleLabel}`.toLowerCase();
    if (filters.channel && filters.channel !== row.channel) return false;
    if (filters.status && filters.status !== row.status) return false;
    if (filters.severity && filters.severity !== severity) return false;
    if (filters.module && filters.module !== moduleLabel) return false;
    if (!matchesDate(filters.date, row.created_at)) return false;
    if (filters.q && !haystack.includes(filters.q)) return false;
    return true;
  });
  const filteredIncidents = recentIncidents.filter((row) => {
    if (filters.status && filters.status !== row.status) return false;
    if (filters.severity && filters.severity !== row.severity) return false;
    if (filters.module && filters.module !== row.moduleLabel) return false;
    if (!matchesDate(filters.date, row.createdAt)) return false;
    if (filters.q && !`${row.title} ${row.detail}`.toLowerCase().includes(filters.q)) return false;
    return true;
  });
  const retryEligibleCount = notificationView.filter((row) => row.status === "failed" || row.status === "queued").length;
  const activeFilterChips = [
    filters.q ? `Búsqueda: ${filters.q}` : null,
    filters.status ? `Estado: ${adminLogsInternals.notificationStatusLabel(filters.status)}` : null,
    filters.severity ? `Severidad: ${filters.severity === "high" ? "Alta" : filters.severity === "medium" ? "Media" : "Informativa"}` : null,
    filters.module ? `Módulo: ${filters.module}` : null,
    filters.channel ? `Canal: ${adminLogsInternals.channelLabel(filters.channel)}` : null,
    filters.date ? `Periodo: ${filters.date === "24h" ? "Últimas 24 horas" : filters.date === "7d" ? "Últimos 7 días" : "Últimos 30 días"}` : null,
  ].filter(Boolean) as string[];

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
        <MetricCard detail="Incidencias visibles en el historial filtrado." label="Incidentes recientes" tone="neutral" value={formatAdminInteger(filteredIncidents.length)} />
        <MetricCard detail="Notificaciones con acción de reintento disponible." label="Reintentos posibles" tone={retryEligibleCount ? "warning" : "success"} value={formatAdminInteger(retryEligibleCount)} />
        <MetricCard detail="Eventos visibles para la sesión actual." label="Clics de WhatsApp" tone="info" value={formatAdminInteger(whatsappView.length)} />
      </section>

      <SectionCard description="Busca y recorta el historial operativo por estado, severidad, módulo, canal o periodo." title="Filtros y búsqueda">
        <form className="grid gap-3 lg:grid-cols-[1.3fr_repeat(5,minmax(0,1fr))_auto]">
          <input className="h-10 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm" defaultValue={value(params, "q") ?? ""} name="q" placeholder="Buscar por destinatario, plantilla o módulo" />
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm" defaultValue={filters.status ?? ""} name="status">
            <option value="">Todo estado</option>
            <option value="failed">Fallido</option>
            <option value="ambiguous">Ambiguo</option>
            <option value="queued">En cola</option>
            <option value="processing">Procesando</option>
            <option value="sent">Enviado</option>
            <option value="success">Completado</option>
          </select>
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm" defaultValue={filters.severity ?? ""} name="severity">
            <option value="">Toda severidad</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="info">Informativa</option>
          </select>
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm" defaultValue={filters.module ?? ""} name="module">
            <option value="">Todos los módulos</option>
            <option value="Mensajería">Mensajería</option>
            <option value="Panel operativo">Panel operativo</option>
            <option value="Módulo de registros">Módulo de registros</option>
            <option value="Módulo administrativo">Módulo administrativo</option>
          </select>
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm" defaultValue={filters.channel ?? ""} name="channel">
            <option value="">Todos los canales</option>
            <option value="email">Correo</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <select className="h-10 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 text-sm" defaultValue={filters.date ?? ""} name="date">
            <option value="">Todo periodo</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit">Aplicar</Button>
            <Button asChild variant="outline"><Link href="/admin/logs">Limpiar</Link></Button>
          </div>
        </form>
        {activeFilterChips.length ? <div aria-label="Filtros activos" className="mt-4 flex flex-wrap gap-2">{activeFilterChips.map((chip) => <StatusBadge key={chip}>{chip}</StatusBadge>)}</div> : null}
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-4">
        <SectionCard className="lg:col-span-1" description="Los incidentes resueltos permanecen visibles en el historial reciente." title="Estado general">
          <div className="space-y-3 text-sm">
            <p className="text-[color:var(--admin-foreground)]">Correo electrónico: <span className="font-semibold">{formatAdminInteger(incidentSummary.openNotifications)}</span></p>
            <p className="text-[color:var(--admin-muted-foreground)]">{canOperate ? "Puedes intervenir en incidentes permitidos desde esta vista." : "Tu sesión no permite intervenir; solo consultar."}</p>
          </div>
        </SectionCard>
        <SectionCard className="lg:col-span-3" description="Resumen de errores o ambigüedades visibles para la sesión actual." title="Errores e incidentes recientes">
          <div>
            {filteredIncidents.length ? (
              <ul className="grid gap-3 md:grid-cols-2">{filteredIncidents.map((row) => <RecentIncidentItem key={`${row.source}-${row.id}`} row={row} />)}</ul>
            ) : (
              <EmptyState description="Cuando haya incidentes persistentes visibles para tu sesión, aparecerán aquí." title="Sin incidentes recientes" />
            )}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard description="Eventos recientes de apertura de conversación sin mutaciones sobre el dato original." title={`Clics de WhatsApp ${formatAdminInteger(whatsappView.length)}`}>
          <div>
            {whatsappView.length ? (
              <ul className="space-y-3 text-sm">
                {whatsapp.filter((row) => whatsappView.some((item) => item.id === row.id)).map((row) => (
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

        <SectionCard className="lg:col-span-2" description="Historial reciente de envíos e incidentes persistentes. Conserva las acciones actuales cuando el rol lo permite." title={`Notificaciones ${formatAdminInteger(notificationView.length)}`}>
          <div>
            {notificationView.length ? <ul className="space-y-3 text-sm">{notificationView.map((row) => <NotificationItem canOperate={canOperate} key={row.id} row={row} />)}</ul> : <EmptyState description="No hay notificaciones visibles para la sesión actual." title="Sin notificaciones visibles" />}
          </div>
        </SectionCard>
      </section>
    </PageContainer>
  );
}
