import "server-only";

import { createClient } from "@/lib/supabase/server";
import { adminLogsInternals, type NotificationLogRow, type SheetSyncLogRow } from "@/lib/admin/logs";

type DashboardCounts = {
  leadsToday: number;
  failedEmails: number;
  failedSheetSyncs: number;
  openAmbiguousIncidents: number;
  whatsappClicks: number;
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

function countLeadSources(rows: Pick<LeadSourceRow, "source">[]) {
  return rows.reduce<Record<string, number>>((acc, lead) => {
    const source = lead.source || "sin_canal";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
}

function sortLeadChannelCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

async function getLeadChannelBreakdownExact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sevenDaysAgo: string,
  errors: string[],
  pageSize = 1000,
) {
  const counts: Record<string, number> = {};

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, source")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + pageSize - 1);

    if (error) {
      errors.push(`canales: ${error.message}`);
      return [];
    }

    const pageCounts = countLeadSources((data ?? []) as LeadSourceRow[]);
    for (const [source, count] of Object.entries(pageCounts)) {
      counts[source] = (counts[source] ?? 0) + count;
    }

    if (!data || data.length < pageSize) break;
  }

  return sortLeadChannelCounts(counts);
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

  const failedOps = values.counts.failedEmails + values.counts.failedSheetSyncs;
  if (failedOps >= 3) {
    alerts.push({
      level: "warning",
      title: "Backlog operativo activo",
      detail: `${failedOps} incidente(s) abiertos en email/Sheets dentro de la ventana de 7 días.`,
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
  const utcDayStart = startOfUtcDayIso();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [leadsToday, failedEmails, failedSheetSyncs, openAmbiguousEmailIncidents, openAmbiguousSheetIncidents, whatsappClicks, leadsByChannel, notificationIncidents, sheetIncidents] = await Promise.all([
    safeCount("leads hoy", supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", utcDayStart), errors),
    safeCount("emails fallidos", supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").in("status", ["failed", "ambiguous"]).gte("created_at", sevenDaysAgo), errors),
    safeCount("syncs fallidos", supabase.from("sheet_sync_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").in("status", ["failed", "ambiguous"]).gte("created_at", sevenDaysAgo), errors),
    safeCount("emails ambiguos abiertos", supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").eq("status", "ambiguous"), errors),
    safeCount("syncs ambiguos abiertos", supabase.from("sheet_sync_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").eq("status", "ambiguous"), errors),
    safeCount("whatsapp", supabase.from("whatsapp_clicks").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo), errors),
    getLeadChannelBreakdownExact(supabase, sevenDaysAgo, errors),
    supabase.from("notification_logs").select("*, contacts(first_name, last_name, email, phone)").or("status.eq.failed,status.eq.ambiguous").order("created_at", { ascending: false }).limit(8),
    supabase.from("sheet_sync_logs").select("*").or("status.eq.failed,status.eq.ambiguous").order("created_at", { ascending: false }).limit(8),
  ]);

  if (notificationIncidents.error) errors.push(`incidentes email: ${notificationIncidents.error.message}`);
  if (sheetIncidents.error) errors.push(`incidentes sheets: ${sheetIncidents.error.message}`);

  const recentIncidents = [
    ...((notificationIncidents.data ?? []) as unknown as NotificationLogRow[]).map((row) => adminLogsInternals.buildNotificationIncident(row)),
    ...((sheetIncidents.data ?? []) as SheetSyncLogRow[]).map((row) => adminLogsInternals.buildSheetIncident(row)),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const counts = {
    leadsToday,
    failedEmails,
    failedSheetSyncs,
    openAmbiguousIncidents: openAmbiguousEmailIncidents + openAmbiguousSheetIncidents,
    whatsappClicks,
  } satisfies DashboardCounts;

  return {
    counts,
    windows: {
      leadsToday: `Desde ${utcDayStart.slice(0, 16).replace("T", " ")} UTC`,
      failedEmails: "Incidentes abiertos · últimos 7 días",
      failedSheetSyncs: "Incidentes abiertos · últimos 7 días",
      whatsappClicks: "Últimos 7 días",
    },
    leadsByChannel,
    recentIncidents,
    alerts: buildDashboardAlerts({ counts }),
    errors,
  };
}

export const dashboardInternals = {
  startOfUtcDayIso,
  buildDashboardAlerts,
  countLeadSources,
  sortLeadChannelCounts,
};
