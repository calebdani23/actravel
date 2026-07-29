import type { Json } from "@/lib/supabase/database.types";

export const leadDeletionCountKeys = [
  "quoteVersions",
  "quoteRequests",
  "payments",
  "bookings",
  "documents",
  "leadNotes",
  "notificationLogs",
  "whatsappClicks",
  "whatsappInboundMessages",
  "sheetSyncLogs",
  "leadEvents",
] as const;

export const contactDeletionCountKeys = [
  "otherLeads",
  "quoteVersions",
  "quoteRequests",
  "bookings",
  "payments",
  "documents",
  "notificationLogs",
  "whatsappClicks",
  "whatsappInboundMessages",
] as const;

export type LeadDeletionCountKey = (typeof leadDeletionCountKeys)[number];

export type ContactDeletionCountKey = (typeof contactDeletionCountKeys)[number];

export type LeadDeletionDependencyCounts = Record<LeadDeletionCountKey, number>;

export type ContactDeletionDependencyCounts = Record<ContactDeletionCountKey, number>;

export type LeadDeleteBlockerCounts = {
  contact: ContactDeletionDependencyCounts;
  lead: LeadDeletionDependencyCounts;
};

export type LeadDeletionBlockerItem = {
  key: LeadDeletionCountKey;
  count: number;
  label: string;
};

export type ContactDeletionBlockerItem = {
  key: ContactDeletionCountKey;
  count: number;
  label: string;
};

const leadDeletionLabels: Record<LeadDeletionCountKey, { one: string; many: string }> = {
  quoteVersions: { one: "cotización comercial", many: "cotizaciones comerciales" },
  quoteRequests: { one: "solicitud de cotización", many: "solicitudes de cotización" },
  payments: { one: "pago", many: "pagos" },
  bookings: { one: "reserva", many: "reservas" },
  documents: { one: "documento", many: "documentos" },
  leadNotes: { one: "nota interna", many: "notas internas" },
  notificationLogs: { one: "notificación operativa", many: "notificaciones operativas" },
  whatsappClicks: { one: "clic de WhatsApp", many: "clics de WhatsApp" },
  whatsappInboundMessages: { one: "mensaje entrante de WhatsApp", many: "mensajes entrantes de WhatsApp" },
  sheetSyncLogs: { one: "sincronización operativa", many: "sincronizaciones operativas" },
  leadEvents: { one: "evento comercial", many: "eventos comerciales" },
};

const contactDeletionLabels: Record<ContactDeletionCountKey, { one: string; many: string }> = {
  otherLeads: { one: "otra oportunidad", many: "otras oportunidades" },
  quoteVersions: { one: "cotización comercial", many: "cotizaciones comerciales" },
  quoteRequests: { one: "solicitud de cotización", many: "solicitudes de cotización" },
  bookings: { one: "reserva", many: "reservas" },
  payments: { one: "pago", many: "pagos" },
  documents: { one: "documento", many: "documentos" },
  notificationLogs: { one: "notificación operativa", many: "notificaciones operativas" },
  whatsappClicks: { one: "clic de WhatsApp", many: "clics de WhatsApp" },
  whatsappInboundMessages: { one: "mensaje entrante de WhatsApp", many: "mensajes entrantes de WhatsApp" },
};

export function emptyLeadDeletionCounts(): LeadDeletionDependencyCounts {
  return {
    quoteVersions: 0,
    quoteRequests: 0,
    payments: 0,
    bookings: 0,
    documents: 0,
    leadNotes: 0,
    notificationLogs: 0,
    whatsappClicks: 0,
    whatsappInboundMessages: 0,
    sheetSyncLogs: 0,
    leadEvents: 0,
  };
}

export function emptyContactDeletionCounts(): ContactDeletionDependencyCounts {
  return {
    otherLeads: 0,
    quoteVersions: 0,
    quoteRequests: 0,
    bookings: 0,
    payments: 0,
    documents: 0,
    notificationLogs: 0,
    whatsappClicks: 0,
    whatsappInboundMessages: 0,
  };
}

export function leadDeletionCountsFromJson(value: Json | null | undefined): LeadDeletionDependencyCounts {
  const counts = emptyLeadDeletionCounts();
  if (!value || typeof value !== "object" || Array.isArray(value)) return counts;

  for (const key of leadDeletionCountKeys) {
    const raw = value[key];
    counts[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  }

  return counts;
}

export function contactDeletionCountsFromJson(value: Json | null | undefined): ContactDeletionDependencyCounts {
  const counts = emptyContactDeletionCounts();
  if (!value || typeof value !== "object" || Array.isArray(value)) return counts;

  for (const key of contactDeletionCountKeys) {
    const raw = value[key];
    counts[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  }

  return counts;
}

export function leadDeleteBlockerCountsFromJson(value: Json | null | undefined): LeadDeleteBlockerCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { lead: emptyLeadDeletionCounts(), contact: emptyContactDeletionCounts() };
  }

  const leadValue = "lead" in value ? value.lead : value;
  const contactValue = "contact" in value ? value.contact : null;

  return {
    lead: leadDeletionCountsFromJson(leadValue),
    contact: contactDeletionCountsFromJson(contactValue),
  };
}

export function isMeaningfulLeadNoteBody(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function countMeaningfulLeadNotes(rows: Array<{ body: string | null } | null | undefined>) {
  return rows.reduce((count, row) => count + (isMeaningfulLeadNoteBody(row?.body) ? 1 : 0), 0);
}

function countLabel(key: LeadDeletionCountKey, count: number) {
  const labels = leadDeletionLabels[key];
  return `${count} ${count === 1 ? labels.one : labels.many}`;
}

function contactCountLabel(key: ContactDeletionCountKey, count: number) {
  const labels = contactDeletionLabels[key];
  return `${count} ${count === 1 ? labels.one : labels.many}`;
}

export function blockedLeadDeletionItems(counts: LeadDeletionDependencyCounts): LeadDeletionBlockerItem[] {
  return leadDeletionCountKeys
    .map((key) => ({ key, count: counts[key], label: countLabel(key, counts[key]) }))
    .filter((item) => item.count > 0);
}

export function blockedContactDeletionItems(counts: ContactDeletionDependencyCounts): ContactDeletionBlockerItem[] {
  return contactDeletionCountKeys
    .map((key) => ({ key, count: counts[key], label: contactCountLabel(key, counts[key]) }))
    .filter((item) => item.count > 0);
}

export function formatLeadDeletionBlockerList(counts: LeadDeletionDependencyCounts) {
  return blockedLeadDeletionItems(counts).map((item) => item.label);
}

export function formatContactDeletionBlockerList(counts: ContactDeletionDependencyCounts) {
  return blockedContactDeletionItems(counts).map((item) => item.label);
}

export function leadDeletionBlockedMessage(counts: LeadDeletionDependencyCounts) {
  const blockers = formatLeadDeletionBlockerList(counts);
  if (!blockers.length) return "La oportunidad todavía no se puede eliminar.";
  return `No se puede eliminar esta oportunidad porque conserva ${blockers.join(", ")}. Recomendamos conservarla o archivarla.`;
}

export function contactDeletionBlockedMessage(counts: ContactDeletionDependencyCounts) {
  const blockers = formatContactDeletionBlockerList(counts);
  if (!blockers.length) return "No se puede eliminar el contacto junto con la oportunidad.";
  return `No se puede eliminar la oportunidad junto con el contacto porque el contacto todavía conserva ${blockers.join(", ")}. Conservamos ambos registros para proteger el historial.`;
}

export function leadDeletionUnavailableMessage() {
  return "No se pudo validar si la oportunidad es segura para eliminar. Actualiza la vista e inténtalo nuevamente.";
}

export function leadDeletionFailureMessage() {
  return "No se pudo eliminar la oportunidad. Intenta nuevamente.";
}

export function leadDeletionNotFoundMessage() {
  return "La oportunidad ya no está disponible.";
}

export function sanitizeLeadDeleteActionError(error: unknown) {
  if (error instanceof Error && /lead (was )?not found/i.test(error.message)) {
    return leadDeletionNotFoundMessage();
  }
  return leadDeletionFailureMessage();
}

export function safeLeadListQueryString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("?")) return "";
  const params = new URLSearchParams(trimmed.slice(1));
  const query = params.toString();
  return query ? `?${query}` : "";
}
