import Link from "next/link";
import { AlertBanner, EmptyState, MetricCard, PageContainer, PageHeader, QuietActionButton, SectionCard, StatusBadge } from "@/components/admin/admin-primitives";
import { Button } from "@/components/ui/button";
import { formatAdminDate, formatAdminDateTime, formatAdminDateWindowLabel, formatAdminInteger } from "@/lib/admin/format";
import { getDuplicateAuditSnapshot } from "@/lib/admin/data-quality";
import { getDashboardMetrics } from "@/lib/admin/dashboard";

function alertTone(level: "healthy" | "warning" | "critical") {
  if (level === "critical") return "error" as const;
  if (level === "warning") return "warning" as const;
  return "success" as const;
}

function incidentTone(status: "open" | "resolved") {
  return status === "open" ? "warning" : "success";
}

function tripRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Sin fechas cargadas";
  const startLabel = start ? formatAdminDate(start) : "Por definir";
  const endLabel = end ? formatAdminDate(end) : "Por definir";
  return `${startLabel} → ${endLabel}`;
}

function followUpTone(overdue: boolean) {
  return overdue ? "warning" : "info";
}

export default async function AdminDashboardPage() {
  const [metrics, dataQuality] = await Promise.all([getDashboardMetrics(), getDuplicateAuditSnapshot()]);
  const today = new Date();
  const currentWindow = formatAdminDateWindowLabel(today, "próximos 7 días");

  if (metrics.errors.length) console.error("Dashboard operational metrics partial error", { errors: metrics.errors });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operación diaria"
        title="Dashboard operativo"
        description="Prioriza alertas, seguimientos, pagos y reservas reales sin exponer detalles técnicos de proveedores o integraciones."
        breadcrumbs={[{ label: "Panel interno", href: "/admin/dashboard" }, { label: "Dashboard operativo" }]}
        actions={
          <>
            {metrics.lastSynchronizedAt ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">Actualizado {formatAdminDateTime(metrics.lastSynchronizedAt)}</p> : null}
            <QuietActionButton asChild>
              <Link href="/admin/dashboard">Actualizar</Link>
            </QuietActionButton>
          </>
        }
      />

      <AlertBanner description={`Ventana actual: ${currentWindow}. La sesión muestra solo la información permitida por tu rol y RLS.`} tone="info" />

      {metrics.alerts.map((alert) => (
        <AlertBanner description={alert.detail} key={`${alert.level}-${alert.title}`} title={alert.title} tone={alertTone(alert.level)} />
      ))}

      {metrics.errors.length ? (
        <AlertBanner description="Algunas métricas no pudieron cargarse por completo en esta sesión. Los datos visibles siguen respetando tus permisos y puedes revisar los logs autorizados si necesitas más detalle técnico." title="Carga parcial" tone="warning" />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail={metrics.windows.overdueFollowUps} label="Seguimientos vencidos" tone={metrics.counts.overdueFollowUps ? "warning" : "info"} value={formatAdminInteger(metrics.counts.overdueFollowUps)} />
        <MetricCard detail={metrics.windows.pendingPayments} label="Pagos pendientes" tone={metrics.counts.pendingPayments ? "warning" : "neutral"} value={formatAdminInteger(metrics.counts.pendingPayments)} />
        <MetricCard detail={metrics.windows.upcomingBookings} label="Reservas próximas" tone={metrics.counts.upcomingBookings ? "brand" : "neutral"} value={formatAdminInteger(metrics.counts.upcomingBookings)} />
        <MetricCard detail={metrics.windows.leadsToday} label="Prospectos de hoy" tone="brand" value={formatAdminInteger(metrics.counts.leadsToday)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Seguimientos por atender"
          description="Primero aparecen los leads vencidos o con contacto programado más cercano."
          actions={<QuietActionButton asChild><Link href="/admin/leads">Ver CRM</Link></QuietActionButton>}
        >
          {metrics.followUps.length ? (
            <div className="space-y-3">
              {metrics.followUps.slice(0, 8).map((item) => (
                <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={item.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-1">
                      <Link className="font-semibold text-[color:var(--admin-accent)] hover:underline" href={`/admin/leads/${item.leadId}`}>{item.contactName}</Link>
                      <p className="text-sm text-[color:var(--admin-foreground)]">{item.summary}</p>
                      <p className="text-xs text-[color:var(--admin-muted-foreground)]">{item.statusLabel} · {item.advisorName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={followUpTone(item.overdue)}>{item.overdue ? "Vencido" : "Programado"}</StatusBadge>
                       <span className="text-xs text-[color:var(--admin-muted-foreground)]">{formatAdminDateTime(item.followUpAt)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="Todavía no hay seguimientos programados visibles para esta sesión." title="Sin seguimientos pendientes" />
          )}
        </SectionCard>

        <SectionCard
          title="Pagos pendientes"
          description="Registro operativo con acceso directo al módulo de pagos cuando exista trabajo pendiente."
          actions={<QuietActionButton asChild><Link href="/admin/payments">Abrir pagos</Link></QuietActionButton>}
        >
          {metrics.pendingPayments.length ? (
            <div className="space-y-3">
              {metrics.pendingPayments.map((payment) => (
                <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={payment.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[color:var(--admin-foreground)]">{payment.contactName}</p>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{payment.paymentTypeLabel} · {payment.amountLabel}</p>
                    </div>
                    <StatusBadge tone="warning">{payment.statusLabel}</StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--admin-muted-foreground)]">
                     <span>Registrado {formatAdminDateTime(payment.createdAt)}</span>
                    {payment.leadId ? <Link className="font-medium text-[color:var(--admin-accent)] hover:underline" href={`/admin/leads/${payment.leadId}`}>Abrir lead</Link> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="No hay pagos pendientes visibles en este momento." title="Operación de pagos al día" />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Embudo por estado" description="Distribución real de los prospectos visibles según su etapa actual.">
          {metrics.statusBreakdown.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[color:var(--admin-border-subtle)] text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">
                  <tr>
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Prospectos</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.statusBreakdown.map((item) => (
                    <tr className="border-b border-[color:var(--admin-border-subtle)] last:border-b-0" key={item.status}>
                      <td className="py-3 pr-4 text-[color:var(--admin-foreground)]">{item.label}</td>
                      <td className="py-3 pr-4 font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(item.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState description="Cuando existan leads visibles, aquí verás su distribución por estado." title="Sin embudo disponible" />
          )}
        </SectionCard>

        <SectionCard title="Reservas de los próximos 7 días" description="Calendario corto para anticipar salidas y atención operativa." actions={<QuietActionButton asChild><Link href="/admin/operations/bookings">Abrir reservas</Link></QuietActionButton>}>
          {metrics.upcomingBookings.length ? (
            <div className="space-y-3">
              {metrics.upcomingBookings.map((booking) => (
                <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={booking.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-[color:var(--admin-foreground)]">{booking.bookingCode ?? booking.contactName}</p>
                      <p className="text-sm text-[color:var(--admin-foreground)]">{booking.contactName} · {booking.destinationName}</p>
                      <p className="text-xs text-[color:var(--admin-muted-foreground)]">{tripRange(booking.startsOn, booking.endsOn)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="brand">{booking.statusLabel}</StatusBadge>
                      {booking.leadId ? <Link className="text-xs font-medium text-[color:var(--admin-accent)] hover:underline" href={`/admin/leads/${booking.leadId}`}>Abrir lead</Link> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="No hay reservas próximas cargadas dentro de la ventana operativa actual." title="Sin salidas cercanas" />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Actividad comercial reciente" description="Últimos leads actualizados para retomar conversación o resolver bloqueos. Se muestran hasta 6 registros recientes." className="xl:col-span-2">
          {metrics.recentLeadActivity.length ? (
            <div className="space-y-3">
              {metrics.recentLeadActivity.map((item) => (
                <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={item.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <Link className="font-semibold text-[color:var(--admin-accent)] hover:underline" href={`/admin/leads/${item.leadId}`}>{item.title}</Link>
                      <p className="text-sm text-[color:var(--admin-foreground)]">{item.summary}</p>
                      <p className="text-xs text-[color:var(--admin-muted-foreground)]">{item.statusLabel} · {item.advisorName}</p>
                    </div>
                    <span className="text-xs text-[color:var(--admin-muted-foreground)]">{formatAdminDateTime(item.updatedAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="Todavía no hay actividad reciente visible para construir esta lista." title="Sin actividad reciente" />
          )}
        </SectionCard>

        <SectionCard title="Calidad de datos" description="Resumen corto para detectar duplicados o identidades ambiguas antes del cierre del día.">
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
                <p className="text-[color:var(--admin-muted-foreground)]">Contactos auditados</p>
                <p className="mt-1 text-2xl font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(dataQuality.totalContacts)}</p>
              </div>
              <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
                <p className="text-[color:var(--admin-muted-foreground)]">Eventos ambiguos</p>
                <p className="mt-1 text-2xl font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(dataQuality.ambiguousIdentityEvents)}</p>
              </div>
            </div>
            <p className="text-[color:var(--admin-muted-foreground)]">Duplicados detectados: <span className="font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(dataQuality.duplicateEmailGroups)}</span> por correo y <span className="font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(dataQuality.duplicatePhoneGroups)}</span> por teléfono.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/data-quality">Abrir auditoría de duplicados</Link>
            </Button>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Incidentes recientes" description="Solo se muestran resúmenes operativos sin mensajes técnicos del proveedor." actions={<QuietActionButton asChild><Link href="/admin/logs">Abrir logs</Link></QuietActionButton>}>
          {metrics.recentIncidents.length ? (
            <div className="space-y-3">
              {metrics.recentIncidents.map((incident) => (
                <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={`${incident.source}-${incident.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--admin-foreground)]">{incident.title}</p>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{incident.detail}</p>
                    </div>
                    <StatusBadge tone={incidentTone(incident.incidentStatus)}>{incident.incidentStatus === "open" ? "Abierto" : "Resuelto"}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">Actualizado {formatAdminDateTime(incident.updatedAt)}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="Cuando exista una incidencia visible para tu rol aparecerá aquí con su estado actual." title="Sin incidentes recientes" />
          )}
        </SectionCard>

        <SectionCard title="Canal y asesor" description="Volumen reciente por origen de captación y carga comercial actual.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Canales recientes</h2>
              {metrics.leadsByChannel.length ? (
                <ul className="space-y-2 text-sm">
                  {metrics.leadsByChannel.map((item) => (
                    <li className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] px-3 py-2" key={item.source}>
                      <span className="text-[color:var(--admin-foreground)]">{item.label}</span>
                      <span className="font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(item.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState description="Todavía no hay leads recientes para construir este desglose." title="Sin datos por canal" />
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Asesores activos</h2>
              {metrics.advisorPerformance.length ? (
                <ul className="space-y-2 text-sm">
                  {metrics.advisorPerformance.map((item) => (
                    <li className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] px-3 py-2" key={item.advisorId ?? item.advisorName}>
                      <span className="text-[color:var(--admin-foreground)]">{item.advisorName}</span>
                      <span className="font-semibold text-[color:var(--admin-foreground)]">{formatAdminInteger(item.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState description="Cuando existan leads asignados visibles, esta tabla mostrará la carga por asesor." title="Sin carga comercial visible" />
              )}
            </div>
          </div>
        </SectionCard>
      </section>
    </PageContainer>
  );
}
