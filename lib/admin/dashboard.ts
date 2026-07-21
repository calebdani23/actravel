import "server-only";

import { formatAdminCurrency, formatAdminUtcWindowStartLabel } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";
import { adminLogsInternals, type NotificationLogRow } from "@/lib/admin/logs";
import { formatLeadSourceLabel } from "@/lib/admin/leads";

type DashboardCounts = {
  leadsToday: number;
  failedEmails: number;
  openAmbiguousIncidents: number;
  whatsappClicks: number;
  overdueFollowUps: number;
  pendingPayments: number;
  upcomingBookings: number;
};

type DashboardAlert = {
  level: "healthy" | "warning" | "critical";
  title: string;
  detail: string;
};

type LeadSourceRow = {
  id: string;
  source: string | null;
};

type LeadStatusRow = {
  id: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  status_id: string | null;
  assigned_to: string | null;
  contact_id: string;
  summary: string | null;
  lead_statuses: { name: string; label_es: string } | null;
  profiles: { full_name: string | null } | null;
  contacts: { first_name: string | null; last_name: string | null } | null;
};

type FollowUpEventRow = {
  id: string;
  lead_id: string;
  created_at: string;
  payload: { followUpAt?: string | null } | null;
  leads: {
    id: string;
    summary: string | null;
    lead_statuses: { label_es: string } | null;
    profiles: { full_name: string | null } | null;
    contacts: { first_name: string | null; last_name: string | null } | null;
  } | null;
};

type PaymentRow = {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  lead_id: string | null;
  contacts: { first_name: string | null; last_name: string | null }[] | { first_name: string | null; last_name: string | null } | null;
};

type BookingRow = {
  id: string;
  created_at: string;
  booking_code: string | null;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  lead_id: string | null;
  destinations: { name_es: string | null }[] | { name_es: string | null } | null;
  contacts: { first_name: string | null; last_name: string | null }[] | { first_name: string | null; last_name: string | null } | null;
};

function safeCount(label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>, errors: string[]) {
  return query.then(({ count, error }) => {
    if (error) {
      errors.push(`${label}: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  });
}

function startOfUtcDayIso(reference = new Date()) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())).toISOString();
}

function startOfDayIso(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).toISOString();
}

function addDaysIso(reference: Date, days: number) {
  const value = new Date(reference);
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

function personName(contact?: { first_name: string | null; last_name: string | null } | null) {
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "Contacto";
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatCurrencyAmount(amount: number, currency: string) {
  return formatAdminCurrency(amount, currency);
}

function paymentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    deposit: "Anticipo",
    partial: "Parcial",
    balance: "Liquidación",
    full: "Pago total",
    refund: "Reembolso",
  };
  return labels[type] ?? "Tipo de pago no identificado";
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    received: "Recibido",
    verified: "Verificado",
    rejected: "Rechazado",
    refunded: "Reembolsado",
  };
  return labels[status] ?? "Estado de pago no identificado";
}

function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    confirmed: "Confirmada",
    in_progress: "En viaje",
    completed: "Completada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? "Estado de reserva no identificado";
}

function countLeadSources(rows: Pick<LeadSourceRow, "source">[]) {
  return rows.reduce<Record<string, number>>((acc, lead) => {
    const source = lead.source || "sin_canal";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
}

function sortLeadChannelCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count, label: formatLeadSourceLabel(source) }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

function buildStatusBreakdown(rows: LeadStatusRow[]) {
  const counts = new Map<string, { status: string; label: string; count: number }>();

  for (const row of rows) {
    const status = row.lead_statuses?.name ?? "without_status";
    const label = row.lead_statuses?.label_es ?? "Sin estado";
    const current = counts.get(status) ?? { status, label, count: 0 };
    current.count += 1;
    counts.set(status, current);
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildAdvisorPerformance(rows: LeadStatusRow[]) {
  const counts = new Map<string, { advisorId: string | null; advisorName: string; count: number }>();

  for (const row of rows) {
    const key = row.assigned_to ?? "unassigned";
    const current = counts.get(key) ?? { advisorId: row.assigned_to, advisorName: row.profiles?.full_name ?? "Sin asignar", count: 0 };
    current.count += 1;
    counts.set(key, current);
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.advisorName.localeCompare(b.advisorName));
}

function buildRecentLeadActivity(rows: LeadStatusRow[]) {
  return rows.slice(0, 6).map((row) => ({
    id: row.id,
    leadId: row.id,
    title: personName(row.contacts),
    summary: row.summary ?? "Sin resumen comercial",
    statusLabel: row.lead_statuses?.label_es ?? "Sin estado",
    advisorName: row.profiles?.full_name ?? "Sin asignar",
    updatedAt: row.updated_at,
  }));
}

function buildFollowUpQueue(rows: FollowUpEventRow[], reference = new Date()) {
  const latestByLead = new Map<string, FollowUpEventRow>();

  for (const row of rows) {
    if (!row.payload?.followUpAt) continue;
    const previous = latestByLead.get(row.lead_id);
    if (!previous || new Date(row.created_at).getTime() > new Date(previous.created_at).getTime()) latestByLead.set(row.lead_id, row);
  }

  return Array.from(latestByLead.values())
    .map((row) => {
      const followUpAt = row.payload?.followUpAt ?? row.created_at;
      return {
        id: row.id,
        leadId: row.lead_id,
        contactName: personName(row.leads?.contacts),
        summary: row.leads?.summary ?? "Sin resumen comercial",
        statusLabel: row.leads?.lead_statuses?.label_es ?? "Sin estado",
        advisorName: row.leads?.profiles?.full_name ?? "Sin asignar",
        followUpAt,
        overdue: new Date(followUpAt).getTime() < reference.getTime(),
      };
    })
    .sort((a, b) => new Date(a.followUpAt).getTime() - new Date(b.followUpAt).getTime());
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null;
}

async function fetchAllPages<T>(
  label: string,
  fetchPage: (start: number, end: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  errors: string[],
  pageSize = 1000,
) {
  const rows: T[] = [];

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await Promise.resolve(fetchPage(start, start + pageSize - 1));

    if (error) {
      errors.push(`${label}: ${error.message}`);
      return rows;
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

function buildDashboardAlerts(values: { counts: DashboardCounts }): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (values.counts.openAmbiguousIncidents > 0) {
    alerts.push({
      level: "critical",
      title: "Hay incidentes ambiguos abiertos",
      detail: `${values.counts.openAmbiguousIncidents} registro(s) requieren validación manual antes de reintentar o cerrar el incidente.`,
    });
  }

  const failedOps = values.counts.failedEmails;
  if (failedOps >= 3) {
    alerts.push({
      level: "warning",
      title: "Backlog operativo activo",
      detail: `${failedOps} incidente(s) abiertos de email dentro de la ventana de 7 días.`,
    });
  }

  if (values.counts.overdueFollowUps > 0) {
    alerts.push({
      level: "warning",
      title: "Hay seguimientos vencidos",
      detail: `${values.counts.overdueFollowUps} prospectos requieren contacto comercial o reprogramación.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "healthy",
      title: "Operación sin alertas críticas",
      detail: "No hay incidentes abiertos críticos en la ventana operativa actual.",
    });
  }

  return alerts;
}

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const errors: string[] = [];
  const now = new Date();
  const utcDayStart = startOfUtcDayIso();
  const dayStart = startOfDayIso(now);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAhead = addDaysIso(now, 7);

  const [leadsToday, failedEmails, openAmbiguousEmailIncidents, whatsappClicks, pendingPaymentsCount, upcomingBookingsCount, notificationIncidents, leadSnapshot, followUpEvents, pendingPayments, upcomingBookings] = await Promise.all([
    safeCount("prospectos de hoy", supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", utcDayStart), errors),
    safeCount("emails fallidos", supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").in("status", ["failed", "ambiguous"]).gte("created_at", sevenDaysAgo), errors),
    safeCount("emails ambiguos abiertos", supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").eq("status", "ambiguous"), errors),
    safeCount("whatsapp", supabase.from("whatsapp_clicks").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo), errors),
    safeCount("pagos pendientes", supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"), errors),
    safeCount("reservas próximas", supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_on", dayStart.slice(0, 10)).lte("starts_on", sevenDaysAhead.slice(0, 10)), errors),
    supabase.from("notification_logs").select("*, contacts(first_name, last_name, email, phone)").or("status.eq.failed,status.eq.ambiguous").order("created_at", { ascending: false }).limit(8),
    fetchAllPages<LeadStatusRow>(
      "prospectos dashboard",
      (start, end) => supabase
        .from("leads")
        .select("id, source, contact_id, created_at, updated_at, status_id, assigned_to, summary, lead_statuses(name, label_es), profiles!leads_assigned_to_fkey(full_name), contacts(first_name, last_name)")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, end),
      errors,
    ),
    fetchAllPages<FollowUpEventRow>(
      "seguimientos dashboard",
      (start, end) => supabase
        .from("lead_events")
        .select("id, lead_id, created_at, payload, leads(id, summary, lead_statuses(label_es), profiles!leads_assigned_to_fkey(full_name), contacts(first_name, last_name))")
        .eq("event_type", "follow_up_registered")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, end),
      errors,
    ),
    supabase.from("payments").select("id, created_at, amount, currency, status, payment_type, lead_id, contacts(first_name, last_name)").eq("status", "pending").order("created_at", { ascending: true }).limit(8),
    supabase.from("bookings").select("id, created_at, booking_code, status, starts_on, ends_on, lead_id, destinations(name_es), contacts(first_name, last_name)").gte("starts_on", dayStart.slice(0, 10)).lte("starts_on", sevenDaysAhead.slice(0, 10)).order("starts_on", { ascending: true }).limit(8),
  ]);

  if (notificationIncidents.error) errors.push(`incidentes email: ${notificationIncidents.error.message}`);
  if (pendingPayments.error) errors.push(`pagos dashboard: ${pendingPayments.error.message}`);
  if (upcomingBookings.error) errors.push(`reservas dashboard: ${upcomingBookings.error.message}`);

  const recentIncidents = ((notificationIncidents.data ?? []) as unknown as NotificationLogRow[])
    .map((row) => adminLogsInternals.buildNotificationIncident(row))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const leadsByChannel = sortLeadChannelCounts(countLeadSources(leadSnapshot.filter((row) => new Date(row.created_at).getTime() >= new Date(sevenDaysAgo).getTime())));
  const followUps = buildFollowUpQueue(followUpEvents, now);
  const overdueFollowUps = followUps.filter((item) => item.overdue).length;

  const counts = {
    leadsToday,
    failedEmails,
    openAmbiguousIncidents: openAmbiguousEmailIncidents,
    whatsappClicks,
    overdueFollowUps,
    pendingPayments: pendingPaymentsCount,
    upcomingBookings: upcomingBookingsCount,
  } satisfies DashboardCounts;

  return {
    counts,
    windows: {
      leadsToday: formatAdminUtcWindowStartLabel(utcDayStart),
      failedEmails: "Incidentes abiertos · últimos 7 días",
      whatsappClicks: "Últimos 7 días",
      overdueFollowUps: "Seguimientos vencidos o programados",
      pendingPayments: "Pagos con estado pendiente",
      upcomingBookings: "Próximos 7 días",
    },
    leadsByChannel,
    statusBreakdown: buildStatusBreakdown(leadSnapshot),
    advisorPerformance: buildAdvisorPerformance(leadSnapshot),
    followUps,
    recentLeadActivity: buildRecentLeadActivity(leadSnapshot),
    pendingPayments: ((pendingPayments.data ?? []) as unknown as PaymentRow[]).map((payment) => ({
      id: payment.id,
      leadId: payment.lead_id,
      contactName: personName(firstRelation(payment.contacts)),
      amountLabel: formatCurrencyAmount(payment.amount, payment.currency),
      paymentTypeLabel: paymentTypeLabel(payment.payment_type),
      statusLabel: paymentStatusLabel(payment.status),
      createdAt: payment.created_at,
    })),
    upcomingBookings: ((upcomingBookings.data ?? []) as unknown as BookingRow[]).map((booking) => ({
      id: booking.id,
      leadId: booking.lead_id,
      bookingCode: booking.booking_code,
      statusLabel: bookingStatusLabel(booking.status),
      startsOn: booking.starts_on,
      endsOn: booking.ends_on,
      destinationName: firstRelation(booking.destinations)?.name_es ?? "Sin destino",
      contactName: personName(firstRelation(booking.contacts)),
    })),
    recentIncidents,
    lastSynchronizedAt: latestTimestamp([
      ...recentIncidents.map((item) => item.createdAt),
      ...(leadSnapshot.map((item) => item.updated_at)),
      ...followUps.map((item) => item.followUpAt),
      ...((pendingPayments.data ?? []) as unknown as PaymentRow[]).map((item) => item.created_at),
      ...((upcomingBookings.data ?? []) as unknown as BookingRow[]).map((item) => item.created_at),
    ]),
    alerts: buildDashboardAlerts({ counts }),
    errors,
  };
}

export const dashboardInternals = {
  startOfUtcDayIso,
  buildDashboardAlerts,
  countLeadSources,
  sortLeadChannelCounts,
  buildFollowUpQueue,
  buildStatusBreakdown,
  buildAdvisorPerformance,
};
