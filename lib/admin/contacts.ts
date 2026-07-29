import "server-only";

import { formatAdminCurrency, formatAdminDateTime } from "@/lib/admin/format";
import { formatLeadSourceLabel } from "@/lib/admin/leads";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

export type ContactFilters = {
  page?: number;
  q?: string;
  lifecycle?: string;
  blocked?: "yes" | "no";
  advisor?: string;
  open?: "yes";
  overdue?: "yes";
  duplicate?: "yes";
  destination?: string;
  service?: string;
  source?: string;
  deleted?: "yes";
  deletedOpportunities?: "yes";
  quickView?: "follow_up" | "unassigned" | "duplicates" | "blocked" | "recurring" | "high_value" | "multiple_requests";
};

export type ContactOpportunityState = "active" | "archived" | "deleted" | "all";

export type ContactOpportunityQuote = {
  id: string;
  versionNumber: number;
  title: string | null;
  status: string;
  currency: string;
  amount: number | null;
  updatedAt: string | null;
  acceptedAt: string | null;
};

export type ContactOpportunity = {
  id: string;
  contactId: string;
  state: Exclude<ContactOpportunityState, "all">;
  statusId: string;
  statusName: string;
  statusLabel: string;
  statusTerminal: boolean;
  assignedTo: string | null;
  advisorName: string;
  destinationId: string | null;
  destinationName: string;
  serviceId: string | null;
  serviceName: string;
  summary: string | null;
  source: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  budgetMxn: number | null;
  budgetUsd: number | null;
  isFeatured: boolean;
  isTestData: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedBy: string | null;
  archivedByName: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deletedByName: string | null;
  deletedReason: string | null;
  requestCount: number;
  openRequestCount: number;
  latestRequest: {
    id: string;
    status: string;
    locale: string;
    source: string;
    createdAt: string;
  } | null;
  quoteCount: number;
  activeQuoteCount: number;
  latestQuote: ContactOpportunityQuote | null;
  acceptedQuote: ContactOpportunityQuote | null;
  latestFollowUpAt: string | null;
  latestFollowUpCreatedAt: string | null;
  overdue: boolean;
  lastActivityAt: string;
  href: string;
};

export type ContactAggregate = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  lifecycleStatus: string;
  blockedAt: string | null;
  blockedReason: string | null;
  deletedAt: string | null;
  deletedReason: string | null;
  duplicateRisk: boolean;
  identityReview: boolean;
  opportunities: ContactOpportunity[];
  openOpportunityCount: number;
  totalOpportunityCount: number;
  deletedOpportunityCount: number;
  featuredOpportunityCount: number;
  requestCount: number;
  quoteCount: number;
  overdueCount: number;
  nextActionAt: string | null;
  owners: string[];
  destinations: string[];
  services: string[];
  sources: string[];
  lastActivityAt: string | null;
  pipelineMxn: number;
  pipelineUsd: number;
  highValue: boolean;
  href: string;
};

export type Contact360Summary = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  preferredLocale: string;
  source: string | null;
  consentMarketing: boolean;
  notes: string | null;
  lifecycleStatus: string;
  blockedAt: string | null;
  blockedBy: string | null;
  blockedByName: string | null;
  blockedReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deletedByName: string | null;
  deletedReason: string | null;
  isTestData: boolean;
  createdAt: string;
  updatedAt: string;
  openOpportunityCount: number;
  activeOpportunityCount: number;
  archivedOpportunityCount: number;
  deletedOpportunityCount: number;
  totalOpportunityCount: number;
  requestCount: number;
  unassignedRequestCount: number;
  quoteVersionCount: number;
  acceptedQuoteCount: number;
  bookingCount: number;
  paymentCount: number;
  documentCount: number;
  duplicateEmailCount: number;
  duplicatePhoneCount: number;
  duplicateRisk: boolean;
  overdueFollowUpCount: number;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  pipelineMxn: number;
  pipelineUsd: number;
  acceptedQuoteValueMxn: number;
  acceptedQuoteValueUsd: number;
};

export type ContactContextItem = {
  id: string;
  label: string;
  status: string;
  amount?: string;
  at: string;
  href?: string;
};

export type ContactActivity = {
  id: string;
  at: string;
  label: string;
  summary: string;
  href: string;
};

export type Contact360Section = "summary" | "opportunities" | "payments" | "bookings" | "documents" | "activity";

export type Contact360Warning = {
  section: Contact360Section;
  severity: "error" | "warning";
  title: string;
  message: string;
};

export type Contact360 = {
  contact: Contact360Summary | null;
  opportunities: ContactOpportunity[];
  opportunityState: ContactOpportunityState;
  pageHasMore: boolean;
  nextCursor: { updatedAt: string; id: string } | null;
  payments: ContactContextItem[];
  bookings: ContactContextItem[];
  documents: ContactContextItem[];
  activity: ContactActivity[];
  warnings: Contact360Warning[];
};

type ContactAggregateRow = Database["public"]["Functions"]["crm_contact_aggregate_page"]["Returns"][number];
type Contact360SummaryRow = Database["public"]["Functions"]["crm_contact_360_summary"]["Returns"][number];
type ContactOpportunityRow = Database["public"]["Functions"]["crm_contact_opportunity_page"]["Returns"][number];

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json | undefined> : {};
}

function payloadString(value: Json, key: string) {
  const candidate = jsonObject(value)[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function logReadError(scope: "contact-list" | "contact-360", section: string, error: { code?: string; message?: string; details?: string; hint?: string } | null, contactId?: string) {
  if (!error) return;
  console.error(`[${scope}] read section unavailable`, {
    section,
    contactId,
    code: error.code ?? "unknown",
    message: error.message ?? "unknown",
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

function mapContactAggregate(row: ContactAggregateRow): ContactAggregate {
  return {
    id: row.contact_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    lifecycleStatus: row.lifecycle_status,
    blockedAt: row.blocked_at,
    blockedReason: row.blocked_reason,
    deletedAt: row.deleted_at,
    deletedReason: null,
    duplicateRisk: row.duplicate_risk,
    identityReview: false,
    opportunities: [],
    openOpportunityCount: row.open_opportunity_count,
    totalOpportunityCount: row.total_opportunity_count,
    deletedOpportunityCount: row.deleted_opportunity_count,
    featuredOpportunityCount: row.featured_opportunity_count,
    requestCount: row.request_count,
    quoteCount: row.quote_count,
    overdueCount: row.overdue_count,
    nextActionAt: row.next_follow_up_at,
    owners: row.owners,
    destinations: row.destinations,
    services: row.services,
    sources: [],
    lastActivityAt: row.last_activity_at,
    pipelineMxn: row.pipeline_mxn,
    pipelineUsd: row.pipeline_usd,
    highValue: row.pipeline_mxn >= 100000 || row.pipeline_usd >= 10000,
    href: `/admin/contacts/${row.contact_id}`,
  };
}

function mapContactSummary(row: Contact360SummaryRow): Contact360Summary {
  return {
    id: row.contact_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    normalizedEmail: row.normalized_email,
    normalizedPhone: row.normalized_phone,
    preferredLocale: row.preferred_locale,
    source: row.source,
    consentMarketing: row.consent_marketing,
    notes: row.notes,
    lifecycleStatus: row.lifecycle_status,
    blockedAt: row.blocked_at,
    blockedBy: row.blocked_by,
    blockedByName: row.blocked_by_name,
    blockedReason: row.blocked_reason,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    deletedByName: row.deleted_by_name,
    deletedReason: row.deleted_reason,
    isTestData: row.is_test_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openOpportunityCount: row.open_opportunity_count,
    activeOpportunityCount: row.active_opportunity_count,
    archivedOpportunityCount: row.archived_opportunity_count,
    deletedOpportunityCount: row.deleted_opportunity_count,
    totalOpportunityCount: row.total_opportunity_count,
    requestCount: row.request_count,
    unassignedRequestCount: row.unassigned_request_count,
    quoteVersionCount: row.quote_version_count,
    acceptedQuoteCount: row.accepted_quote_count,
    bookingCount: row.booking_count,
    paymentCount: row.payment_count,
    documentCount: row.document_count,
    duplicateEmailCount: row.duplicate_email_count,
    duplicatePhoneCount: row.duplicate_phone_count,
    duplicateRisk: row.duplicate_risk,
    overdueFollowUpCount: row.overdue_follow_up_count,
    nextFollowUpAt: row.next_follow_up_at,
    lastActivityAt: row.last_activity_at,
    pipelineMxn: row.pipeline_mxn,
    pipelineUsd: row.pipeline_usd,
    acceptedQuoteValueMxn: row.accepted_quote_value_mxn,
    acceptedQuoteValueUsd: row.accepted_quote_value_usd,
  };
}

function latestQuote(row: ContactOpportunityRow): ContactOpportunityQuote | null {
  if (!row.latest_quote_id || row.latest_quote_version_number === null || !row.latest_quote_currency || !row.latest_quote_status) return null;
  return {
    id: row.latest_quote_id,
    versionNumber: row.latest_quote_version_number,
    title: row.latest_quote_title,
    status: row.latest_quote_status,
    currency: row.latest_quote_currency,
    amount: row.latest_quote_amount,
    updatedAt: row.latest_quote_updated_at,
    acceptedAt: null,
  };
}

function acceptedQuote(row: ContactOpportunityRow): ContactOpportunityQuote | null {
  if (!row.accepted_quote_id || row.accepted_quote_version_number === null || !row.accepted_quote_currency) return null;
  return {
    id: row.accepted_quote_id,
    versionNumber: row.accepted_quote_version_number,
    title: null,
    status: "accepted",
    currency: row.accepted_quote_currency,
    amount: row.accepted_quote_amount,
    updatedAt: row.accepted_quote_accepted_at,
    acceptedAt: row.accepted_quote_accepted_at,
  };
}

function mapContactOpportunity(row: ContactOpportunityRow): ContactOpportunity {
  return {
    id: row.opportunity_id,
    contactId: row.contact_id,
    state: row.opportunity_state as ContactOpportunity["state"],
    statusId: row.status_id,
    statusName: row.status_name,
    statusLabel: row.status_label,
    statusTerminal: row.status_is_terminal,
    assignedTo: row.assigned_to,
    advisorName: row.owner_name ?? "Sin asignar",
    destinationId: row.destination_id,
    destinationName: row.destination_name ?? "Sin destino",
    serviceId: row.service_id,
    serviceName: row.service_name ?? "Sin servicio",
    summary: row.summary,
    source: row.source,
    priority: row.priority,
    startDate: row.travel_start_date,
    endDate: row.travel_end_date,
    travelers: row.travelers_count,
    budgetMxn: row.budget_mxn,
    budgetUsd: row.budget_usd,
    isFeatured: row.is_featured,
    isTestData: row.is_test_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    archivedByName: row.archived_by_name,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    deletedByName: row.deleted_by_name,
    deletedReason: row.deleted_reason,
    requestCount: row.request_count,
    openRequestCount: row.open_request_count,
    latestRequest: row.latest_request_id && row.latest_request_status && row.latest_request_locale && row.latest_request_created_at ? {
      id: row.latest_request_id,
      status: row.latest_request_status,
      locale: row.latest_request_locale,
      source: formatLeadSourceLabel(row.latest_request_source),
      createdAt: row.latest_request_created_at,
    } : null,
    quoteCount: row.quote_version_count,
    activeQuoteCount: row.active_quote_version_count,
    latestQuote: latestQuote(row),
    acceptedQuote: acceptedQuote(row),
    latestFollowUpAt: row.latest_follow_up_at,
    latestFollowUpCreatedAt: row.latest_follow_up_created_at,
    overdue: row.follow_up_overdue,
    lastActivityAt: row.last_activity_at,
    href: `/admin/leads/${row.opportunity_id}`,
  };
}

function warning(section: Contact360Section, severity: Contact360Warning["severity"]): Contact360Warning {
  const content: Record<Contact360Section, [string, string]> = {
    summary: ["Resumen no disponible", "No se pudo cargar la identidad y el gobierno del contacto."],
    opportunities: ["Oportunidades no disponibles", "No se pudo cargar la página de oportunidades solicitada."],
    payments: ["Pagos no disponibles", "El contexto de pagos no está disponible en este momento."],
    bookings: ["Reservas no disponibles", "El contexto de reservas no está disponible en este momento."],
    documents: ["Documentos no disponibles", "El contexto documental no está disponible en este momento."],
    activity: ["Actividad no disponible", "La actividad reciente no está disponible en este momento."],
  };
  return { section, severity, title: content[section][0], message: content[section][1] };
}

export async function getContacts(filters: ContactFilters = {}) {
  const supabase = await createClient();
  const includeDeleted = filters.deleted === "yes";
  const page = Math.max(1, filters.page ?? 1);
  const aggregateResult = await supabase.rpc("crm_contact_aggregate_page", {
    p_limit: 50,
    p_offset: (page - 1) * 50,
    p_include_deleted: includeDeleted,
    p_deleted_only: includeDeleted,
    p_search: filters.q ?? null,
    p_lifecycle: filters.lifecycle ?? null,
    p_blocked: filters.blocked ? filters.blocked === "yes" : null,
    p_advisor: filters.advisor && filters.advisor !== "unassigned" ? filters.advisor : null,
    p_unassigned: filters.advisor === "unassigned",
    p_open_only: filters.open === "yes",
    p_overdue: filters.overdue === "yes",
    p_duplicate: filters.duplicate === "yes",
    p_destination: filters.destination ?? null,
    p_service: filters.service ?? null,
    p_source: filters.source ?? null,
    p_quick_view: filters.quickView ?? null,
    p_deleted_opportunity_only: filters.deletedOpportunities === "yes",
  });

  logReadError("contact-list", "aggregate", aggregateResult.error);
  const aggregateRows = rows<ContactAggregateRow>(aggregateResult.data);
  const contacts = aggregateRows.map(mapContactAggregate);
  const totalCount = aggregateRows[0]?.total_count ?? 0;
  return {
    contacts,
    totalCount,
    partial: (page - 1) * 50 + contacts.length < totalCount,
    error: aggregateResult.error ? "contacts" : null,
  };
}

export async function getContact360(id: string, options: {
  state?: ContactOpportunityState;
  limit?: number;
  afterUpdatedAt?: string | null;
  afterId?: string | null;
} = {}): Promise<Contact360 | null> {
  const supabase = await createClient();
  const state = options.state ?? "active";
  const [summaryResult, opportunityResult, paymentsResult, bookingsResult, documentsResult] = await Promise.all([
    supabase.rpc("crm_contact_360_summary", { p_contact_id: id }),
    supabase.rpc("crm_contact_opportunity_page", {
      p_contact_id: id,
      p_state: state,
      p_limit: options.limit ?? 20,
      p_after_updated_at: options.afterUpdatedAt ?? null,
      p_after_id: options.afterId ?? null,
    }),
    supabase.from("payments").select("id,status,amount,currency,created_at,lead_id").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("bookings").select("id,status,booking_code,created_at,lead_id").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("documents").select("id,status,title,document_type,created_at,lead_id").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  logReadError("contact-360", "summary", summaryResult.error, id);
  logReadError("contact-360", "opportunities", opportunityResult.error, id);
  logReadError("contact-360", "payments", paymentsResult.error, id);
  logReadError("contact-360", "bookings", bookingsResult.error, id);
  logReadError("contact-360", "documents", documentsResult.error, id);

  const summaryRow = rows<Contact360SummaryRow>(summaryResult.data)[0];
  if (!summaryResult.error && !summaryRow) return null;

  const opportunityRows = rows<ContactOpportunityRow>(opportunityResult.data);
  const opportunities = opportunityRows.map(mapContactOpportunity);
  const opportunityIds = opportunities.map((item) => item.id);
  const activityResult = opportunityIds.length
    ? await supabase.from("lead_events").select("id,lead_id,event_type,payload,created_at").in("lead_id", opportunityIds).order("created_at", { ascending: false }).limit(30)
    : { data: [], error: null };
  logReadError("contact-360", "activity", activityResult.error, id);

  const warnings: Contact360Warning[] = [];
  if (summaryResult.error) warnings.push(warning("summary", "error"));
  if (opportunityResult.error) warnings.push(warning("opportunities", "error"));
  if (paymentsResult.error) warnings.push(warning("payments", "warning"));
  if (bookingsResult.error) warnings.push(warning("bookings", "warning"));
  if (documentsResult.error) warnings.push(warning("documents", "warning"));
  if (activityResult.error) warnings.push(warning("activity", "warning"));

  const payments: ContactContextItem[] = (paymentsResult.data ?? []).map((item) => ({
    id: item.id,
    label: "Pago",
    status: item.status,
    amount: formatAdminCurrency(item.amount, item.currency),
    at: formatAdminDateTime(item.created_at),
    href: item.lead_id ? `/admin/leads/${item.lead_id}` : undefined,
  }));
  const bookings: ContactContextItem[] = (bookingsResult.data ?? []).map((item) => ({
    id: item.id,
    label: item.booking_code ?? "Reserva sin código",
    status: item.status,
    at: formatAdminDateTime(item.created_at),
    href: item.lead_id ? `/admin/leads/${item.lead_id}` : undefined,
  }));
  const documents: ContactContextItem[] = (documentsResult.data ?? []).map((item) => ({
    id: item.id,
    label: item.title || item.document_type,
    status: item.status,
    at: formatAdminDateTime(item.created_at),
    href: item.lead_id ? `/admin/leads/${item.lead_id}` : undefined,
  }));
  const activity: ContactActivity[] = (activityResult.data ?? []).map((event) => ({
    id: event.id,
    at: formatAdminDateTime(event.created_at),
    label: event.event_type === "follow_up_registered" ? "Seguimiento registrado" : "Actividad comercial",
    summary: payloadString(event.payload, "message") ?? payloadString(event.payload, "title") ?? "Actividad registrada",
    href: `/admin/leads/${event.lead_id}`,
  }));
  const pageHasMore = opportunityRows[0]?.page_has_more ?? false;
  const lastOpportunity = opportunities.at(-1);

  return {
    contact: summaryRow ? mapContactSummary(summaryRow) : null,
    opportunities,
    opportunityState: state,
    pageHasMore,
    nextCursor: pageHasMore && lastOpportunity ? { updatedAt: lastOpportunity.updatedAt, id: lastOpportunity.id } : null,
    payments,
    bookings,
    documents,
    activity,
    warnings,
  };
}
