import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type IncidentStatus = "open" | "resolved";
export type WhatsappClickRow = Tables<"whatsapp_clicks"> & { contacts: { first_name: string; last_name: string | null; phone: string | null } | null };
export type NotificationLogRow = Tables<"notification_logs"> & { contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null };
export type SheetSyncLogRow = Tables<"sheet_sync_logs">;
export type WhatsappInboundMessageRow = Tables<"whatsapp_inbound_messages">;

export type OperationalIncidentRow = {
  id: string;
  source: "email" | "sheets";
  status: string;
  incidentStatus: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
  title: string;
  detail: string;
  retryEligible: boolean;
};

function asIncidentStatus(value: string | null | undefined): IncidentStatus {
  return value === "resolved" ? "resolved" : "open";
}

function retryEligible(status: string) {
  return status === "failed" || status === "queued";
}

function buildNotificationIncident(row: NotificationLogRow): OperationalIncidentRow {
  return {
    id: row.id,
    source: "email",
    status: row.status,
    incidentStatus: asIncidentStatus(row.incident_status),
    createdAt: row.created_at,
    updatedAt: row.incident_updated_at ?? row.updated_at,
    errorMessage: row.error_message,
    title: row.template_name ?? row.recipient ?? "Email",
    detail: row.recipient ?? row.contacts?.email ?? "Sin destinatario",
    retryEligible: retryEligible(row.status),
  };
}

function buildSheetIncident(row: SheetSyncLogRow): OperationalIncidentRow {
  return {
    id: row.id,
    source: "sheets",
    status: row.status,
    incidentStatus: asIncidentStatus(row.incident_status),
    createdAt: row.created_at,
    updatedAt: row.incident_updated_at ?? row.updated_at,
    errorMessage: row.error_message,
    title: row.sheet_name ?? "Google Sheets",
    detail: row.row_id ?? row.idempotency_key ?? row.quote_request_id ?? "Sin referencia",
    retryEligible: retryEligible(row.status),
  };
}

function compareByDateDesc(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function shouldShowIncident(row: OperationalIncidentRow) {
  return row.status === "failed" || row.status === "ambiguous" || (row.incidentStatus === "resolved" && Boolean(row.errorMessage));
}

function safeCount(label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>, errors: string[]) {
  return query.then(({ count, error }) => {
    if (error) {
      errors.push(`${label}: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  });
}

export async function setNotificationIncidentStatus(logId: string, incidentStatus: IncidentStatus, actorId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_logs")
    .update({ incident_status: incidentStatus, incident_updated_at: new Date().toISOString(), incident_updated_by: actorId })
    .eq("id", logId);

  if (error) throw new Error(error.message);
}

export async function setSheetIncidentStatus(logId: string, incidentStatus: IncidentStatus, actorId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sheet_sync_logs")
    .update({ incident_status: incidentStatus, incident_updated_at: new Date().toISOString(), incident_updated_by: actorId })
    .eq("id", logId);

  if (error) throw new Error(error.message);
}

export async function getAdminLogs() {
  const supabase = await createClient();
  const errors: string[] = [];
  const [whatsapp, inboundMessages, notifications, sheets, openNotifications, openSheets] = await Promise.all([
    supabase.from("whatsapp_clicks").select("*, contacts(first_name, last_name, phone)").order("created_at", { ascending: false }).limit(25),
    supabase.from("whatsapp_inbound_messages").select("*").order("received_at", { ascending: false }).limit(25),
    supabase.from("notification_logs").select("*, contacts(first_name, last_name, email, phone)").order("created_at", { ascending: false }).limit(50),
    supabase.from("sheet_sync_logs").select("*").order("created_at", { ascending: false }).limit(50),
    safeCount(
      "incidentes abiertos email",
      supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").in("status", ["failed", "ambiguous"]),
      errors,
    ),
    safeCount(
      "incidentes abiertos sheets",
      supabase.from("sheet_sync_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").in("status", ["failed", "ambiguous"]),
      errors,
    ),
  ]);

  const notificationRows = (notifications.data ?? []) as unknown as NotificationLogRow[];
  const sheetRows = (sheets.data ?? []) as SheetSyncLogRow[];
  const recentIncidents = [...notificationRows.map(buildNotificationIncident), ...sheetRows.map(buildSheetIncident)]
    .filter(shouldShowIncident)
    .sort(compareByDateDesc)
    .slice(0, 12);

  return {
    whatsapp: (whatsapp.data ?? []) as unknown as WhatsappClickRow[],
    inboundMessages: (inboundMessages.data ?? []) as WhatsappInboundMessageRow[],
    notifications: notificationRows,
    sheets: sheetRows,
    recentIncidents,
    incidentSummary: {
      openNotifications,
      openSheets,
      resolvedIncidents: recentIncidents.filter((row) => row.incidentStatus === "resolved").length,
    },
    errors: [...errors, whatsapp.error?.message, inboundMessages.error?.message, notifications.error?.message, sheets.error?.message].filter(Boolean),
  };
}

export const adminLogsInternals = {
  buildNotificationIncident,
  buildSheetIncident,
  shouldShowIncident,
};
