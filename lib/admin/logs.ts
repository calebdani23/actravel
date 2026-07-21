import "server-only";

import { templateDisplayLabel } from "@/lib/admin/leads";
import { formatAdminModuleLabelFromPath } from "@/lib/admin/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type IncidentStatus = "open" | "resolved";
export type WhatsappClickRow = Tables<"whatsapp_clicks"> & { contacts: { first_name: string; last_name: string | null; phone: string | null } | null };
export type NotificationLogRow = Tables<"notification_logs"> & { contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null };

export type OperationalIncidentRow = {
  id: string;
  source: "email";
  status: string;
  incidentStatus: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
  title: string;
  detail: string;
  retryEligible: boolean;
};

type NotificationOperatorSummaryInput = {
  status: string;
  incidentStatus?: IncidentStatus | null;
  errorMessage?: string | null;
};

function asIncidentStatus(value: string | null | undefined): IncidentStatus {
  return value === "resolved" ? "resolved" : "open";
}

function retryEligible(status: string) {
  return status === "failed" || status === "queued";
}

function notificationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "En cola",
    processing: "Procesando",
    sent: "Enviado",
    success: "Completado",
    failed: "Fallido",
    ambiguous: "Ambiguo",
    skipped: "Omitido",
  };
  return labels[status] ?? "Estado no identificado";
}

function notificationTemplateLabel(name?: string | null) {
  return templateDisplayLabel(name) ?? "Plantilla operativa";
}

function notificationOperatorSummary({ status, incidentStatus, errorMessage }: NotificationOperatorSummaryInput) {
  if (!errorMessage && !(status === "failed" || status === "ambiguous" || status === "queued" || status === "processing" || status === "skipped")) return null;
  if (status === "ambiguous" || incidentStatus === "open") return "La incidencia requiere revisión.";
  if (status === "failed") return "No se pudo completar el envío.";
  if (status === "queued") return "El envío sigue en cola.";
  if (status === "processing") return "El envío sigue en proceso.";
  if (status === "skipped") return "El envío fue omitido.";
  return "Se registró una actualización operativa.";
}

function partialLoadMessage(errors: string[]) {
  return errors.length ? "Parte del historial no pudo cargarse por completo. Intenta actualizar la vista." : null;
}

function whatsappModuleLabel(pagePath?: string | null) {
  return formatAdminModuleLabelFromPath(pagePath);
}

function buildNotificationIncident(row: NotificationLogRow): OperationalIncidentRow {
  return {
    id: row.id,
    source: "email",
    status: row.status,
    incidentStatus: asIncidentStatus(row.incident_status),
    createdAt: row.created_at,
    updatedAt: row.incident_updated_at ?? row.updated_at,
    errorMessage: notificationOperatorSummary({ status: row.status, incidentStatus: asIncidentStatus(row.incident_status), errorMessage: row.error_message }),
    title: notificationTemplateLabel(row.template_name),
    detail: row.recipient ?? row.contacts?.email ?? "Sin destinatario",
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

export async function getAdminLogs() {
  const supabase = await createClient();
  const errors: string[] = [];
  const [whatsapp, notifications, openNotifications] = await Promise.all([
    supabase.from("whatsapp_clicks").select("*, contacts(first_name, last_name, phone)").order("created_at", { ascending: false }).limit(25),
    supabase.from("notification_logs").select("*, contacts(first_name, last_name, email, phone)").order("created_at", { ascending: false }).limit(50),
    safeCount(
      "incidentes abiertos email",
      supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("incident_status", "open").in("status", ["failed", "ambiguous"]),
      errors,
    ),
  ]);

  const notificationRows = (notifications.data ?? []) as unknown as NotificationLogRow[];
  const recentIncidents = notificationRows.map(buildNotificationIncident)
    .filter(shouldShowIncident)
    .sort(compareByDateDesc)
    .slice(0, 12);

  return {
    whatsapp: (whatsapp.data ?? []) as unknown as WhatsappClickRow[],
    notifications: notificationRows,
    recentIncidents,
    incidentSummary: {
      openNotifications,
      resolvedIncidents: recentIncidents.filter((row) => row.incidentStatus === "resolved").length,
    },
    errors: [...errors, whatsapp.error?.message, notifications.error?.message].filter((value): value is string => Boolean(value)),
  };
}

export const adminLogsInternals = {
  buildNotificationIncident,
  notificationOperatorSummary,
  notificationStatusLabel,
  notificationTemplateLabel,
  partialLoadMessage,
  shouldShowIncident,
  whatsappModuleLabel,
};
