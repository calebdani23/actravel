import "server-only";

import { formatAdminCurrency, formatAdminDate, formatAdminFollowUpLabel, formatAdminModuleLabelFromPath } from "@/lib/admin/format";
import { blockedContactDeletionItems, blockedLeadDeletionItems, contactDeletionCountsFromJson, countMeaningfulLeadNotes, type ContactDeletionDependencyCounts, type LeadDeletionDependencyCounts } from "@/lib/admin/lead-delete";
import { quoteVersionStatusLabel, type QuoteVersionStatus } from "@/lib/admin/quote-versions";
import { createClient } from "@/lib/supabase/server";
import { hasRole, isRoleName, type RoleName } from "@/lib/supabase/roles";
import { getAdvisorCapableStaff } from "@/lib/admin/staff";

export type LeadFilters = {
  q?: string;
  status?: string;
  destination?: string;
  channel?: string;
  advisor?: string;
  currency?: string;
  from?: string;
  to?: string;
  quickView?: "unassigned" | "overdue_follow_up" | "multiple_requests" | "duplicate_review";
};

export const TEST_DATA_PURGE_CONFIRMATION = "PURGAR DATOS DE PRUEBA" as const;

export type LeadListRow = {
  archived_at: string | null;
  archived_by: string | null;
  id: string;
  is_test_data: boolean;
  is_featured: boolean;
  contact_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  updated_at: string;
  travel_start_date: string | null;
  travel_end_date: string | null;
  travelers_count: number;
  budget_mxn: number | null;
  budget_usd: number | null;
  source: string;
  priority: string;
  summary: string | null;
  contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
  lead_statuses: { id: string; name: string; label_es: string } | null;
  destinations: { id: string; name_es: string } | null;
  profiles: { id: string; full_name: string } | null;
};

export type LeadListItem = LeadListRow & {
  contactOpportunityCount: number;
  followUpOverdue: boolean;
  hasDuplicateRisk: boolean;
  hasIdentityReview: boolean;
  nextFollowUpAt: string | null;
  quoteRequestCount: number;
  repeatContact: boolean;
};

export type LeadDetail = LeadListRow & {
  contacts: (LeadListRow["contacts"] & { preferred_locale: string; source: string | null; notes: string | null; lifecycle_status: string; blocked_at: string | null; deleted_at: string | null }) | null;
  services: { id: string; name_es: string } | null;
};

export type LeadQuoteRequestHistoryItem = {
  channelLabel: string;
  createdAt: string;
  href: string;
  id: string;
  locale: string;
  status: string;
  statusLabel: string;
};

export type RelatedOpportunityItem = {
  advisorName: string;
  destinationName: string;
  followUpOverdue: boolean;
  href: string;
  id: string;
  nextFollowUpAt: string | null;
  quoteRequestCount: number;
  statusLabel: string;
  summary: string | null;
  updatedAt: string;
};

export type LeadQuoteVersionItem = {
  acceptedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  currency: string;
  depositAmount: number | null;
  expiredAt: string | null;
  id: string;
  notes: string | null;
  quoteRequestId: string | null;
  rejectedAt: string | null;
  sentAt: string | null;
  status: QuoteVersionStatus;
  statusLabel: string;
  summary: string | null;
  title: string;
  totalAmount: number | null;
  updatedAt: string;
  validUntil: string | null;
  versionNumber: number;
};

export type Contact360Summary = {
  ambiguousIdentityEvents: number;
  duplicateEmailMatches: number;
  duplicatePhoneMatches: number;
  hasDuplicateRisk: boolean;
  hasIdentityReview: boolean;
  opportunityCount: number;
  overdueFollowUps: number;
  requestCount: number;
  upcomingFollowUps: number;
};

export type LeadDeletionSummary = {
  blocked: boolean;
  canDeleteOrphanContact: boolean;
  contactId: string;
  contactCounts: ContactDeletionDependencyCounts;
  counts: LeadDeletionDependencyCounts;
  error: string | null;
  leadId: string;
  isTestData: boolean;
  contactIsTestData: boolean;
};

export type LeadTimelineItem = {
  id: string;
  at: string;
  kind: "event" | "note" | "whatsapp" | "notification" | "sheet";
  label: string;
  actorName?: string;
  summary?: string;
  metadata?: string[];
};

type JsonRecord = Record<string, unknown>;

function escapeSearch(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function cleanText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? undefined : value;
}

function resolveCreatedAtRange(filters: Pick<LeadFilters, "from" | "to">) {
  const from = validDate(filters.from);
  const to = validDate(filters.to);
  if (from && to && from > to) return {};
  return { from, to };
}

function jsonObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function payloadString(payload: unknown, key: string) {
  const value = jsonObject(payload)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function payloadObject(payload: unknown, key: string) {
  const value = jsonObject(payload)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function safeDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function followUpAtFromPayload(payload: unknown) {
  return safeDateTime(payloadString(payload, "followUpAt"));
}

function quoteRequestChannelLabel(payload: unknown) {
  const trustedAttribution = payloadObject(payload, "trustedAttribution");
  const canonicalSource = payloadString(payload, "canonicalSource") ?? payloadString(trustedAttribution, "canonicalSource") ?? payloadString(payload, "sourceChannel");
  return formatLeadSourceLabel(canonicalSource);
}

function compact(values: Array<string | undefined | null | false>) {
  return values.filter((value): value is string => Boolean(value));
}

type AuxiliaryActivityQueryScope =
  | { mode: "lead_only"; leadIds: string[] }
  | { mode: "lead_or_contact"; orClause: string };

type RoleRow = { roles?: { name?: string | null } | { name?: string | null }[] | null };

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function getLeadActorRoles(supabase: Awaited<ReturnType<typeof createClient>>): Promise<RoleName[]> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const userId = userResult.user?.id;
  if (userError || !userId) return [];

  const { data, error } = await supabase.from("profile_roles").select("roles(name)").eq("profile_id", userId);
  if (error) return [];

  return ((data ?? []) as RoleRow[])
    .flatMap((row) => Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [])
    .map((role) => role.name ?? "")
    .filter(isRoleName);
}

function buildAuxiliaryActivityQueryScope(input: { contactId?: string; leadId: string; visibleLeadIds: string[]; restrictToVisibleLeadIds: boolean }): AuxiliaryActivityQueryScope {
  const leadIds = unique([input.leadId, ...input.visibleLeadIds.filter(Boolean)]);
  if (input.restrictToVisibleLeadIds || !input.contactId) {
    return { mode: "lead_only", leadIds };
  }
  return { mode: "lead_or_contact", orClause: `lead_id.eq.${input.leadId},contact_id.eq.${input.contactId}` };
}

export function formatLeadSourceLabel(source: string | null | undefined) {
  const labels: Record<string, string> = {
    website: "Sitio web",
    website_quote: "Cotización web",
    whatsapp: "WhatsApp",
    whatsapp_inbound_ad: "WhatsApp anuncio",
    whatsapp_inbound_facebook: "WhatsApp Facebook",
    whatsapp_inbound_instagram: "WhatsApp Instagram",
    manual_admin: "Captura manual interna",
    manual_asesor: "Captura manual de asesor",
    phone_call: "Llamada telefónica",
    whatsapp_manual: "WhatsApp manual",
    instagram_dm: "Mensaje de Instagram",
    referral: "Referido",
    walk_in: "Visita directa",
    sin_canal: "Canal no identificado",
  };
  if (!source) return labels.sin_canal;
  return labels[source] ?? labels.sin_canal;
}

export function formatLeadPriorityLabel(priority?: string | null) {
  const labels: Record<string, string> = {
    low: "Baja",
    normal: "Media",
    medium: "Media",
    high: "Alta",
    urgent: "Urgente",
  };
  if (!priority) return "Sin prioridad";
  return labels[priority] ?? "Prioridad no identificada";
}

export function formatQuoteRequestStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    received: "Recibida",
    processing: "En proceso",
    converted: "Convertida",
    closed: "Cerrada",
  };
  if (!status) return "Sin estado";
  return labels[status] ?? "Estado no identificado";
}

export async function getLeadStatuses() {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_statuses").select("id, name, label_es").order("sort_order");
  return data ?? [];
}

export async function getAdvisors() {
  return getAdvisorCapableStaff();
}

async function exactCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  return { count: count ?? 0, error: error?.message ?? null };
}

export async function getLeadDeletionSummary(id: string): Promise<LeadDeletionSummary | null> {
  const supabase = await createClient();
  const { data: lead, error } = await supabase.from("leads").select("id, contact_id, is_test_data, contacts(is_test_data)").eq("id", id).maybeSingle();
  if (error || !lead?.contact_id) return null;

  const [
    quoteVersions,
    quoteRequests,
    payments,
    bookings,
    documents,
    leadNotes,
    notificationLogs,
    whatsappClicks,
    whatsappInboundMessages,
    sheetSyncLogs,
    leadEvents,
    siblingLeads,
    contactQuoteVersions,
    contactQuoteRequests,
    contactBookings,
    contactPayments,
    contactDocuments,
    contactNotificationLogs,
    contactWhatsappClicks,
    contactWhatsappInboundMessages,
  ] = await Promise.all([
    exactCount(supabase.from("quote_versions").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("payments").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("documents").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    supabase.from("lead_notes").select("body").eq("lead_id", id),
    exactCount(supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("whatsapp_clicks").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("whatsapp_inbound_messages").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("sheet_sync_logs").select("id", { count: "exact", head: true }).eq("lead_id", id)),
    exactCount(supabase.from("lead_events").select("id", { count: "exact", head: true }).eq("lead_id", id).neq("event_type", "manual_lead_created")),
    exactCount(supabase.from("leads").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id).neq("id", id)),
    exactCount(supabase.from("quote_versions").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("payments").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("documents").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("notification_logs").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("whatsapp_clicks").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
    exactCount(supabase.from("whatsapp_inbound_messages").select("id", { count: "exact", head: true }).eq("contact_id", lead.contact_id)),
  ]);
  const leadNoteRows = (leadNotes.data ?? []) as Array<{ body: string | null }>;
  const leadNotesError = leadNotes.error?.message ?? null;

  const counts: LeadDeletionDependencyCounts = {
    quoteVersions: quoteVersions.count,
    quoteRequests: quoteRequests.count,
    payments: payments.count,
    bookings: bookings.count,
    documents: documents.count,
    leadNotes: countMeaningfulLeadNotes(leadNoteRows),
    notificationLogs: notificationLogs.count,
    whatsappClicks: whatsappClicks.count,
    whatsappInboundMessages: whatsappInboundMessages.count,
    sheetSyncLogs: sheetSyncLogs.count,
    leadEvents: leadEvents.count,
  };

  const contactCounts = contactDeletionCountsFromJson({
    otherLeads: siblingLeads.count,
    quoteVersions: contactQuoteVersions.count,
    quoteRequests: contactQuoteRequests.count,
    bookings: contactBookings.count,
    payments: contactPayments.count,
    documents: contactDocuments.count,
    notificationLogs: contactNotificationLogs.count,
    whatsappClicks: contactWhatsappClicks.count,
    whatsappInboundMessages: contactWhatsappInboundMessages.count,
  });

  const leadTestData = lead as unknown as { is_test_data: boolean; contacts?: { is_test_data: boolean } | Array<{ is_test_data: boolean }> | null };
  return {
    blocked: blockedLeadDeletionItems(counts).length > 0,
    canDeleteOrphanContact: blockedContactDeletionItems(contactCounts).length === 0,
    contactId: lead.contact_id,
    contactCounts,
    counts,
    error: [
      quoteVersions.error,
      quoteRequests.error,
      payments.error,
      bookings.error,
      documents.error,
      leadNotesError,
      notificationLogs.error,
      whatsappClicks.error,
      whatsappInboundMessages.error,
      sheetSyncLogs.error,
      leadEvents.error,
      siblingLeads.error,
      contactQuoteVersions.error,
      contactQuoteRequests.error,
      contactBookings.error,
      contactPayments.error,
      contactDocuments.error,
      contactNotificationLogs.error,
      contactWhatsappClicks.error,
      contactWhatsappInboundMessages.error,
    ].filter(Boolean).join(" | ") || null,
    leadId: lead.id,
    isTestData: leadTestData.is_test_data === true,
    contactIsTestData: (Array.isArray(leadTestData.contacts) ? leadTestData.contacts[0]?.is_test_data : leadTestData.contacts?.is_test_data) === true,
  };
}

export async function getDestinations() {
  const supabase = await createClient();
  const { data } = await supabase.from("destinations").select("id, name_es").order("name_es");
  return data ?? [];
}

export async function getServices() {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, name_es").order("name_es");
  return data ?? [];
}

export async function getLeadSources() {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("source").order("source");
  return Array.from(new Set((data ?? []).map((row) => row.source).filter(Boolean))).sort();
}

type LeadSearchPlan = {
  term: string;
  terms: string[];
  exactIds: string[];
};

function splitSearchTerms(q?: string) {
  const normalized = cleanText(q)?.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const parts = normalized.split(" ").map((term) => term.trim()).filter((term) => term.length >= 2);
  return unique(parts.length ? parts : [normalized]).slice(0, 5);
}

function buildLeadSearchPlan(q?: string): LeadSearchPlan | null {
  const terms = splitSearchTerms(q);
  if (!terms.length) return null;
  return {
    term: terms.join(" "),
    terms,
    exactIds: terms.filter((term) => /^[0-9a-f-]{8,}$/i.test(term)),
  };
}

function buildLeadSearchClauses(search: LeadSearchPlan, ids: { contactIds: string[]; destinationIds: string[]; leadIds: string[] }) {
  return unique([
    ...search.terms.flatMap((term) => {
      const escaped = escapeSearch(term);
      return [`summary.ilike.%${escaped}%`, `source.ilike.%${escaped}%`];
    }),
    ...search.exactIds.map((id) => `id.eq.${id}`),
    ...(ids.contactIds.length ? [`contact_id.in.(${ids.contactIds.join(",")})`] : []),
    ...(ids.destinationIds.length ? [`destination_id.in.(${ids.destinationIds.join(",")})`] : []),
    ...(ids.leadIds.length ? [`id.in.(${ids.leadIds.join(",")})`] : []),
  ]);
}

function buildQuoteRequestSearchClauses(search: LeadSearchPlan) {
  return search.terms.flatMap((term) => {
    const like = `%${escapeSearch(term)}%`;
    const digits = term.replace(/\D/g, "");
    const phoneLike = digits.length >= 4 ? `%${digits}%` : like;
    return [
      `payload->>holderName.ilike.${like}`,
      `payload->>email.ilike.${like}`,
      `payload->>whatsapp.ilike.${phoneLike}`,
      `payload->>origin.ilike.${like}`,
      `payload->>mainDestination.ilike.${like}`,
      `payload->>serviceInterest.ilike.${like}`,
      `payload->>campaignContext.ilike.${like}`,
      `payload->>notes.ilike.${like}`,
    ];
  }).join(",");
}

function buildLeadEventSearchClauses(search: LeadSearchPlan) {
  return search.terms.flatMap((term) => {
    const like = `%${escapeSearch(term)}%`;
    return [
      `event_type.ilike.${like}`,
      `payload->>messageText.ilike.${like}`,
      `payload->>source.ilike.${like}`,
      `payload->referral->>headline.ilike.${like}`,
      `payload->referral->>body.ilike.${like}`,
    ];
  }).join(",");
}

async function findSearchMatches(supabase: Awaited<ReturnType<typeof createClient>>, q?: string) {
  const search = buildLeadSearchPlan(q);
  if (!search) return null;

  const contactFilters = search.terms.flatMap((term) => {
    const like = `%${escapeSearch(term)}%`;
    const digits = term.replace(/\D/g, "");
    const phoneLike = digits.length >= 4 ? `%${digits}%` : like;
    return [`first_name.ilike.${like}`, `last_name.ilike.${like}`, `email.ilike.${like}`, `phone.ilike.${phoneLike}`];
  }).join(",");

  const destinationFilters = search.terms.flatMap((term) => {
    const like = `%${escapeSearch(term)}%`;
    return [`name_es.ilike.${like}`, `name_en.ilike.${like}`];
  }).join(",");

  const leadFilters = search.terms.flatMap((term) => {
    const like = `%${escapeSearch(term)}%`;
    return [`summary.ilike.${like}`, `source.ilike.${like}`];
  }).join(",");

  const quoteFilters = buildQuoteRequestSearchClauses(search);
  const eventFilters = buildLeadEventSearchClauses(search);

  const [{ data: contacts }, { data: destinations }, { data: leads }, { data: quoteRequests }, { data: leadEvents }] = await Promise.all([
    supabase.from("contacts").select("id").or(contactFilters).limit(100),
    supabase.from("destinations").select("id").or(destinationFilters).limit(100),
    supabase.from("leads").select("id, contact_id").or(leadFilters).limit(100),
    supabase.from("quote_requests").select("lead_id, contact_id").or(quoteFilters).limit(100),
    supabase.from("lead_events").select("lead_id").or(eventFilters).limit(100),
  ]);

  return {
    ...search,
    contactIds: unique([...(contacts ?? []).map((row) => row.id), ...(leads ?? []).map((row) => row.contact_id).filter(Boolean), ...(quoteRequests ?? []).map((row) => row.contact_id).filter(Boolean)]),
    destinationIds: unique((destinations ?? []).map((row) => row.id)),
    leadIds: unique([...(leads ?? []).map((row) => row.id), ...(quoteRequests ?? []).map((row) => row.lead_id).filter(Boolean), ...(leadEvents ?? []).map((row) => row.lead_id).filter(Boolean)]),
  };
}

function buildLatestFollowUpIndex(rows: Array<{ lead_id: string; created_at: string; payload: unknown }>, reference = new Date()) {
  const latestByLead = new Map<string, { createdAt: string; nextFollowUpAt: string | null; followUpOverdue: boolean }>();

  for (const row of rows) {
    const nextFollowUpAt = followUpAtFromPayload(row.payload);
    if (!nextFollowUpAt) continue;
    const previous = latestByLead.get(row.lead_id);
    if (!previous || new Date(row.created_at).getTime() > new Date(previous.createdAt).getTime()) {
      latestByLead.set(row.lead_id, {
        createdAt: row.created_at,
        nextFollowUpAt,
        followUpOverdue: new Date(nextFollowUpAt).getTime() < reference.getTime(),
      });
    }
  }

  return new Map(Array.from(latestByLead.entries()).map(([leadId, value]) => [leadId, { nextFollowUpAt: value.nextFollowUpAt, followUpOverdue: value.followUpOverdue }]));
}

function countByLeadId(rows: Array<{ lead_id: string | null }>) {
  return rows.reduce((map, row) => {
    if (!row.lead_id) return map;
    map.set(row.lead_id, (map.get(row.lead_id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

function countByContactId(rows: Array<{ contact_id: string }>) {
  return rows.reduce((map, row) => {
    map.set(row.contact_id, (map.get(row.contact_id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

function duplicateRiskIndex(rows: Array<{ id: string; normalized_email: string | null; normalized_phone: string | null }>) {
  const emailCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.normalized_email) emailCounts.set(row.normalized_email, (emailCounts.get(row.normalized_email) ?? 0) + 1);
    if (row.normalized_phone) phoneCounts.set(row.normalized_phone, (phoneCounts.get(row.normalized_phone) ?? 0) + 1);
  }

  return rows.reduce((map, row) => {
    map.set(row.id, Boolean((row.normalized_email && (emailCounts.get(row.normalized_email) ?? 0) > 1) || (row.normalized_phone && (phoneCounts.get(row.normalized_phone) ?? 0) > 1)));
    return map;
  }, new Map<string, boolean>());
}

function applyQuickViewFilter(leads: LeadListItem[], quickView?: LeadFilters["quickView"]) {
  if (!quickView) return leads;
  if (quickView === "unassigned") return leads.filter((lead) => !lead.profiles?.id);
  if (quickView === "overdue_follow_up") return leads.filter((lead) => lead.followUpOverdue);
  if (quickView === "multiple_requests") return leads.filter((lead) => lead.quoteRequestCount > 1);
  if (quickView === "duplicate_review") return leads.filter((lead) => lead.hasDuplicateRisk || lead.hasIdentityReview);
  return leads;
}

export async function getLeads(filters: LeadFilters) {
  const supabase = await createClient();
  const search = await findSearchMatches(supabase, filters.q);
  const errors: string[] = [];
  let query = supabase
    .from("leads")
    .select("id, contact_id, created_at, updated_at, travel_start_date, travel_end_date, travelers_count, budget_mxn, budget_usd, source, priority, summary, is_featured, archived_at, archived_by, deleted_at, deleted_by, deleted_reason, is_test_data, contacts(first_name, last_name, email, phone), lead_statuses!inner(id, name, label_es), destinations(id, name_es), profiles!leads_assigned_to_fkey(id, full_name)")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (filters.status) query = query.eq("lead_statuses.name", filters.status);
  if (filters.destination) query = query.eq("destination_id", filters.destination);
  if (cleanText(filters.channel)) query = query.eq("source", cleanText(filters.channel)!);
  if (filters.advisor === "unassigned") query = query.is("assigned_to", null);
  else if (filters.advisor) query = query.eq("assigned_to", filters.advisor);
  if (filters.currency === "MXN") query = query.not("budget_mxn", "is", null);
  if (filters.currency === "USD") query = query.not("budget_usd", "is", null);
  const { from, to } = resolveCreatedAtRange(filters);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (search) {
    const clauses = buildLeadSearchClauses(search, search);
    if (clauses.length) query = query.or(clauses.join(","));
  }

  const { data, error } = await query;
  if (error) return { leads: [] as LeadListItem[], error: error.message };

  const baseLeads = (data ?? []) as unknown as LeadListRow[];
  if (!baseLeads.length) return { leads: [] as LeadListItem[], error: null };

  const leadIds = baseLeads.map((lead) => lead.id);
  const contactIds = unique(baseLeads.map((lead) => lead.contact_id));
  const [{ data: relatedLeads, error: relatedLeadsError }, { data: quoteRequests, error: quoteRequestsError }, { data: followUps, error: followUpsError }, { data: ambiguousEvents, error: ambiguousEventsError }, { data: visibleContacts, error: visibleContactsError }] = await Promise.all([
    supabase.from("leads").select("id, contact_id").in("contact_id", contactIds),
    supabase.from("quote_requests").select("id, lead_id").in("lead_id", leadIds),
    supabase.from("lead_events").select("lead_id, created_at, payload").in("lead_id", leadIds).eq("event_type", "follow_up_registered"),
    supabase.from("lead_events").select("lead_id").in("lead_id", leadIds).eq("event_type", "contact_identity_ambiguous"),
    supabase.from("contacts").select("id, normalized_email, normalized_phone").in("id", contactIds),
  ]);

  if (relatedLeadsError) errors.push(relatedLeadsError.message);
  if (quoteRequestsError) errors.push(quoteRequestsError.message);
  if (followUpsError) errors.push(followUpsError.message);
  if (ambiguousEventsError) errors.push(ambiguousEventsError.message);
  if (visibleContactsError) errors.push(visibleContactsError.message);

  const visibleContactRows = (visibleContacts ?? []) as Array<{ id: string; normalized_email: string | null; normalized_phone: string | null }>;
  const emailValues = unique(visibleContactRows.map((contact) => contact.normalized_email).filter(Boolean) as string[]);
  const phoneValues = unique(visibleContactRows.map((contact) => contact.normalized_phone).filter(Boolean) as string[]);
  const duplicateEmailQuery = emailValues.length ? supabase.from("contacts").select("id, normalized_email, normalized_phone").in("normalized_email", emailValues) : Promise.resolve({ data: [], error: null });
  const duplicatePhoneQuery = phoneValues.length ? supabase.from("contacts").select("id, normalized_email, normalized_phone").in("normalized_phone", phoneValues) : Promise.resolve({ data: [], error: null });
  const [{ data: duplicateEmailContacts, error: duplicateEmailError }, { data: duplicatePhoneContacts, error: duplicatePhoneError }] = await Promise.all([duplicateEmailQuery, duplicatePhoneQuery]);
  if (duplicateEmailError) errors.push(duplicateEmailError.message);
  if (duplicatePhoneError) errors.push(duplicatePhoneError.message);

  const contactOpportunityCounts = countByContactId((relatedLeads ?? []) as Array<{ contact_id: string }>);
  const quoteRequestCounts = countByLeadId((quoteRequests ?? []) as Array<{ lead_id: string | null }>);
  const ambiguousLeadIds = new Set(((ambiguousEvents ?? []) as Array<{ lead_id: string }>).map((row) => row.lead_id));
  const latestFollowUps = buildLatestFollowUpIndex((followUps ?? []) as Array<{ lead_id: string; created_at: string; payload: unknown }>);
  const duplicateRisk = duplicateRiskIndex(unique([...(duplicateEmailContacts ?? []), ...(duplicatePhoneContacts ?? [])] as Array<{ id: string; normalized_email: string | null; normalized_phone: string | null }>));

  const leads = applyQuickViewFilter(baseLeads.map((lead) => {
    const followUp = latestFollowUps.get(lead.id);
    const contactOpportunityCount = contactOpportunityCounts.get(lead.contact_id) ?? 1;
    const quoteRequestCount = quoteRequestCounts.get(lead.id) ?? 0;
    return {
      ...lead,
      contactOpportunityCount,
      quoteRequestCount,
      repeatContact: contactOpportunityCount > 1,
      hasDuplicateRisk: duplicateRisk.get(lead.contact_id) ?? false,
      hasIdentityReview: ambiguousLeadIds.has(lead.id),
      nextFollowUpAt: followUp?.nextFollowUpAt ?? null,
      followUpOverdue: followUp?.followUpOverdue ?? false,
    } satisfies LeadListItem;
  }), filters.quickView);

  return { leads, error: errors.length ? errors.join(" | ") : null };
}

function eventLabel(type: string) {
  const labels: Record<string, string> = { status_changed: "Estado actualizado", assigned: "Asesor asignado", note_added: "Nota agregada", follow_up_registered: "Seguimiento registrado", quote_received: "Cotización recibida", quote_submitted: "Cotización recibida", quote_version_created: "Cotización creada", quote_version_sent: "Cotización marcada como enviada", quote_version_accepted: "Cotización aceptada", quote_version_rejected: "Cotización rechazada", quote_version_expired: "Cotización expirada", contact_identity_ambiguous: "Identidad ambigua", whatsapp_inbound_received: "WhatsApp recibido", manual_lead_created: "Lead manual creado" };
  return labels[type] ?? "Evento operativo";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { queued: "En cola", processing: "Procesando", sent: "Enviado", success: "Sincronizado", failed: "Fallido", skipped: "Omitido", ambiguous: "Ambiguo" };
  return labels[status] ?? "Estado no identificado";
}

function sheetStatusLabel(status: string) {
  const labels: Record<string, string> = { queued: "en cola", processing: "en proceso", success: "completada", failed: "con error", skipped: "omitida", ambiguous: "ambigua" };
  return labels[status] ?? "con estado no identificado";
}

function eventSummary(eventType: string, payload: JsonRecord) {
  if (eventType === "whatsapp_inbound_received") return payloadString(payload, "messageText");
  if (eventType === "manual_lead_created") return payloadString(payload, "source") ? `Origen: ${formatLeadSourceLabel(payloadString(payload, "source"))}` : undefined;
  if (eventType === "quote_submitted") return payloadString(payload, "destination") ? `Destino: ${payloadString(payload, "destination")}` : undefined;
  if (eventType.startsWith("quote_version_")) return payloadString(payload, "title") || undefined;
  return undefined;
}

export function formatCurrencyAmount(amount: number, currency: string) {
  return formatAdminCurrency(amount, currency);
}

export function templateDisplayLabel(name?: string | null) {
  const labels: Record<string, string> = {
    client_quote_request_confirmation: "Confirmación de solicitud de cotización",
    admin_quote_request_received: "Nueva solicitud de cotización",
    quote_received_email: "Confirmación de cotización recibida",
    payment_received_email: "Confirmación de pago recibido",
    whatsapp_followup: "Seguimiento por WhatsApp",
  };
  if (!name) return undefined;
  return labels[name] ?? "Plantilla operativa";
}

function notificationLabel(channel: string, status: string) {
  const normalized = channel.toLowerCase();
  if (normalized === "email") return status === "success" ? "Correo enviado" : `Correo ${statusLabel(status).toLowerCase()}`;
  if (normalized === "whatsapp") return status === "success" ? "WhatsApp preparado" : `WhatsApp ${statusLabel(status).toLowerCase()}`;
  return `Notificación operativa ${statusLabel(status).toLowerCase()}`;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "pendiente",
    received: "recibido",
    verified: "verificado",
    rejected: "rechazado",
    refunded: "reembolsado",
  };
  return labels[status] ?? "Estado no identificado";
}

function paymentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    deposit: "Anticipo",
    partial: "Parcial",
    balance: "Liquidación",
    full: "Pago total",
    refund: "Reembolso",
  };
  return labels[type] ?? "Pago operativo";
}

function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "borrador",
    confirmed: "confirmada",
    in_progress: "en viaje",
    completed: "completada",
    cancelled: "cancelada",
  };
  return labels[status] ?? "Estado no identificado";
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    passport: "Pasaporte",
    visa: "Visa",
    itinerary: "Itinerario",
    voucher: "Voucher",
    ticket: "Boleto",
    invoice: "Factura",
    receipt: "Comprobante",
  };
  return labels[type] ?? "Documento operativo";
}

function documentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "pendiente",
    requested: "solicitado",
    received: "recibido",
    approved: "aprobado",
    rejected: "rechazado",
    archived: "archivado",
  };
  return labels[status] ?? "Estado no identificado";
}

function eventMetadata(eventType: string, payload: JsonRecord) {
  const referral = jsonObject(payload.referral);
  const base = compact([
    payloadString(payload, "statusLabel"),
    payloadString(payload, "statusId") ? "Estado actualizado" : undefined,
    formatAdminFollowUpLabel(payloadString(payload, "followUpAt")),
  ]);
  if (eventType === "whatsapp_inbound_received") {
    return compact([
      ...base,
      payloadString(payload, "fromPhone") ? `Tel: ${payloadString(payload, "fromPhone")}` : undefined,
      payloadString(payload, "source") ? `Canal: ${formatLeadSourceLabel(payloadString(payload, "source"))}` : undefined,
      payloadString(referral, "headline") ? `Anuncio: ${payloadString(referral, "headline")}` : undefined,
      payloadString(referral, "source_type") ? `Red: ${payloadString(referral, "source_type")}` : undefined,
    ]);
  }
  if (eventType === "manual_lead_created") {
    return compact([
      ...base,
      payloadString(payload, "source") ? `Canal: ${formatLeadSourceLabel(payloadString(payload, "source"))}` : undefined,
      payload.hasNote === true ? "Con nota inicial" : undefined,
    ]);
  }
  if (eventType === "quote_submitted") {
    return compact([
      ...base,
      payloadString(payload, "opportunityResolution") === "reused_existing"
        ? "Oportunidad reutilizada"
        : payloadString(payload, "opportunityResolution") === "created_new"
          ? "Oportunidad nueva"
          : payloadString(payload, "opportunityResolution") === "created_duplicate_review"
            ? "Revisión de duplicado requerida"
            : payloadString(payload, "opportunityResolution") === "resolution_unavailable"
              ? "Revisión manual por resolución no disponible"
              : undefined,
      typeof payload.quoteRequestId === "string" ? "Solicitud registrada" : undefined,
    ]);
  }
  if (eventType.startsWith("quote_version_")) {
    const amount = typeof payload.totalAmount === "number" && payloadString(payload, "currency")
      ? formatAdminCurrency(payload.totalAmount as number, payloadString(payload, "currency")!)
      : undefined;
    return compact([
      ...base,
      typeof payload.versionNumber === "number" ? `Versión ${payload.versionNumber}` : undefined,
      amount,
      typeof payload.rejectedAlternatives === "number" && payload.rejectedAlternatives > 0
        ? `${payload.rejectedAlternatives} alternativa(s) activa(s) rechazada(s)`
        : undefined,
    ]);
  }
  return base;
}

function buildTimeline(input: {
  lead?: { id: string; created_at: string; summary: string | null } | null;
  events: unknown[];
  notes: unknown[];
  whatsappClicks: unknown[];
  notifications: unknown[];
  sheetLogs: unknown[];
  payments: unknown[];
  bookings: unknown[];
  documents: unknown[];
}) {
  const items: LeadTimelineItem[] = [];

  if (input.lead) {
    items.push({
      id: `lead-created-${input.lead.id}`,
      at: input.lead.created_at,
      kind: "event",
      label: "Lead creado",
      summary: input.lead.summary ?? undefined,
    });
  }

  for (const raw of input.events) {
    const event = raw as { id: string; created_at: string; event_type: string; payload: unknown; profiles?: { full_name: string | null } | null };
    const payload = jsonObject(event.payload);
    items.push({
      id: `event-${event.id}`,
      at: event.created_at,
      kind: "event",
      label: eventLabel(event.event_type),
      actorName: event.profiles?.full_name ?? undefined,
      summary: eventSummary(event.event_type, payload),
      metadata: eventMetadata(event.event_type, payload),
    });
  }

  for (const raw of input.notes) {
    const note = raw as { id: string; created_at: string; body: string; profiles?: { full_name: string | null } | null };
    items.push({ id: `note-${note.id}`, at: note.created_at, kind: "note", label: "Nota interna", actorName: note.profiles?.full_name ?? undefined, summary: note.body });
  }

  for (const raw of input.whatsappClicks) {
    const click = raw as { id: string; created_at: string; phone: string | null; page_path: string | null; message: string | null };
    items.push({ id: `whatsapp-${click.id}`, at: click.created_at, kind: "whatsapp", label: "WhatsApp preparado", summary: click.message ?? undefined, metadata: compact([click.phone ? `Tel: ${click.phone}` : undefined, click.page_path ? `Origen: ${formatAdminModuleLabelFromPath(click.page_path)}` : undefined]) });
  }

  for (const raw of input.notifications) {
    const log = raw as { id: string; created_at: string; channel: string; provider: string | null; template_name: string | null; status: string; error_message: string | null; recipient: string | null };
    items.push({
      id: `notification-${log.id}`,
      at: log.created_at,
      kind: "notification",
      label: notificationLabel(log.channel, log.status),
      metadata: compact([templateDisplayLabel(log.template_name) ? `Plantilla: ${templateDisplayLabel(log.template_name)}` : undefined, log.recipient ? `Para: ${log.recipient}` : undefined]),
    });
  }

  for (const raw of input.sheetLogs) {
    const log = raw as { id: string; created_at: string; sheet_name: string | null; row_id: string | null; status: string; error_message: string | null };
    items.push({ id: `sheet-${log.id}`, at: log.created_at, kind: "sheet", label: `Sincronización operativa ${sheetStatusLabel(log.status)}` });
  }

  for (const raw of input.payments) {
    const payment = raw as { id: string; created_at: string; amount: number; currency: string; status: string; payment_type: string };
    items.push({
      id: `payment-${payment.id}`,
      at: payment.created_at,
      kind: "event",
      label: `Pago ${paymentStatusLabel(payment.status)}`,
      metadata: [paymentTypeLabel(payment.payment_type), formatCurrencyAmount(payment.amount, payment.currency)],
    });
  }

  for (const raw of input.bookings) {
    const booking = raw as { id: string; created_at: string; booking_code: string | null; status: string; starts_on: string | null };
    items.push({
      id: `booking-${booking.id}`,
      at: booking.created_at,
      kind: "event",
      label: `Reserva ${bookingStatusLabel(booking.status)}`,
        metadata: compact([booking.booking_code ? `Código: ${booking.booking_code}` : undefined, booking.starts_on ? `Inicio: ${formatAdminDate(booking.starts_on)}` : undefined]),
      });
    }

  for (const raw of input.documents) {
    const document = raw as { id: string; created_at: string; title: string; document_type: string; status: string };
    items.push({
      id: `document-${document.id}`,
      at: document.created_at,
      kind: "event",
      label: `Documento ${documentStatusLabel(document.status)}`,
      metadata: [documentTypeLabel(document.document_type), document.title],
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function buildContact360Summary(input: {
  ambiguousIdentityEvents: number;
  duplicateEmailMatches: number;
  duplicatePhoneMatches: number;
  followUps: Map<string, { nextFollowUpAt: string | null; followUpOverdue: boolean }>;
  opportunities: Array<{ id: string }>;
  quoteRequests: Array<{ lead_id: string | null }>;
}) {
  const followUpValues = Array.from(input.followUps.values());
  return {
    opportunityCount: input.opportunities.length,
    requestCount: input.quoteRequests.length,
    duplicateEmailMatches: input.duplicateEmailMatches,
    duplicatePhoneMatches: input.duplicatePhoneMatches,
    ambiguousIdentityEvents: input.ambiguousIdentityEvents,
    hasDuplicateRisk: input.duplicateEmailMatches > 0 || input.duplicatePhoneMatches > 0,
    hasIdentityReview: input.ambiguousIdentityEvents > 0,
    overdueFollowUps: followUpValues.filter((item) => item.followUpOverdue).length,
    upcomingFollowUps: followUpValues.filter((item) => item.nextFollowUpAt && !item.followUpOverdue).length,
  } satisfies Contact360Summary;
}

function buildQuoteRequestHistory(items: Array<{ id: string; lead_id: string | null; created_at: string; locale: string; status: string; payload: unknown }>): LeadQuoteRequestHistoryItem[] {
  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      locale: item.locale,
      status: item.status,
      statusLabel: formatQuoteRequestStatusLabel(item.status),
      channelLabel: quoteRequestChannelLabel(item.payload),
      href: item.lead_id ? `/admin/leads/${item.lead_id}` : "/admin/leads",
    }));
}

function buildRelatedOpportunities(items: Array<{ id: string; updated_at: string; summary: string | null; destinations: { name_es: string | null } | null; profiles: { full_name: string | null } | null; lead_statuses: { label_es: string | null } | null }>, followUps: Map<string, { nextFollowUpAt: string | null; followUpOverdue: boolean }>, requestCounts: Map<string, number>): RelatedOpportunityItem[] {
  return items
    .map((item) => ({
      id: item.id,
      href: `/admin/leads/${item.id}`,
      updatedAt: item.updated_at,
      summary: item.summary,
      destinationName: item.destinations?.name_es ?? "Sin destino",
      advisorName: item.profiles?.full_name ?? "Sin asignar",
      statusLabel: item.lead_statuses?.label_es ?? "Sin estado",
      quoteRequestCount: requestCounts.get(item.id) ?? 0,
      nextFollowUpAt: followUps.get(item.id)?.nextFollowUpAt ?? null,
      followUpOverdue: followUps.get(item.id)?.followUpOverdue ?? false,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function buildQuoteVersionHistory(
  items: Array<{
    accepted_at: string | null;
    created_at: string;
    created_by: string | null;
    currency: string;
    deposit_amount: number | null;
    expired_at: string | null;
    id: string;
    notes: string | null;
    quote_request_id: string | null;
    rejected_at: string | null;
    sent_at: string | null;
    status: string;
    summary: string | null;
    title: string;
    total_amount: number | null;
    updated_at: string;
    valid_until: string | null;
    version_number: number;
  }>,
  creatorNames: Map<string, string>,
): LeadQuoteVersionItem[] {
  return items
    .map((item) => ({
      acceptedAt: item.accepted_at,
      createdAt: item.created_at,
      createdByName: item.created_by ? creatorNames.get(item.created_by) ?? null : null,
      currency: item.currency,
      depositAmount: item.deposit_amount,
      expiredAt: item.expired_at,
      id: item.id,
      notes: item.notes,
      quoteRequestId: item.quote_request_id,
      rejectedAt: item.rejected_at,
      sentAt: item.sent_at,
      status: item.status as QuoteVersionStatus,
      statusLabel: quoteVersionStatusLabel(item.status),
      summary: item.summary,
      title: item.title,
      totalAmount: item.total_amount,
      updatedAt: item.updated_at,
      validUntil: item.valid_until,
      versionNumber: item.version_number,
    }))
    .sort((a, b) => {
      if (a.status === "accepted" && b.status !== "accepted") return -1;
      if (a.status !== "accepted" && b.status === "accepted") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export async function getLeadDetail(id: string) {
  const supabase = await createClient();
  const actorRoles = await getLeadActorRoles(supabase);
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, contact_id, created_at, updated_at, travel_start_date, travel_end_date, travelers_count, budget_mxn, budget_usd, source, priority, summary, is_featured, archived_at, archived_by, deleted_at, deleted_by, deleted_reason, is_test_data, contacts(first_name, last_name, email, phone, preferred_locale, source, notes, lifecycle_status, blocked_at, deleted_at), lead_statuses(id, name, label_es), destinations(id, name_es), services(id, name_es), profiles!leads_assigned_to_fkey(id, full_name)")
    .eq("id", id)
    .maybeSingle();

  const contactId = lead?.contact_id as string | undefined;
  const relatedLeadIds = contactId
    ? (((await supabase.from("leads").select("id").eq("contact_id", contactId)).data ?? []) as Array<{ id: string }>).map((row) => row.id)
    : [id];
  const auxiliaryActivityScope = buildAuxiliaryActivityQueryScope({
    leadId: id,
    contactId,
    visibleLeadIds: relatedLeadIds,
    restrictToVisibleLeadIds: hasRole(actorRoles, "asesor") && !hasRole(actorRoles, "admin"),
  });
  const whatsappClicksQuery = supabase.from("whatsapp_clicks").select("id, created_at, phone, page_path, message");
  const notificationsQuery = supabase.from("notification_logs").select("id, created_at, channel, provider, recipient, template_name, status, error_message");
  const [{ data: notes }, { data: events }, { data: whatsappClicks }, { data: notifications }, { data: sheetLogs }, { data: payments }, { data: bookings }, { data: documents }, { data: quoteRequests }, { data: quoteVersions }, { data: relatedOpportunities }, { data: contactRows }, { data: crossOpportunityFollowUps }, { data: ambiguousEvents }] = await Promise.all([
    supabase.from("lead_notes").select("id, created_at, body, is_internal, profiles!lead_notes_author_id_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("lead_events").select("id, created_at, event_type, payload, profiles!lead_events_actor_id_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    auxiliaryActivityScope.mode === "lead_only"
      ? whatsappClicksQuery.in("lead_id", auxiliaryActivityScope.leadIds).order("created_at", { ascending: false }).limit(20)
      : whatsappClicksQuery.or(auxiliaryActivityScope.orClause).order("created_at", { ascending: false }).limit(20),
    auxiliaryActivityScope.mode === "lead_only"
      ? notificationsQuery.in("lead_id", auxiliaryActivityScope.leadIds).order("created_at", { ascending: false }).limit(20)
      : notificationsQuery.or(auxiliaryActivityScope.orClause).order("created_at", { ascending: false }).limit(20),
    supabase.from("sheet_sync_logs").select("id, created_at, sheet_name, row_id, status, error_message").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("payments").select("id, created_at, amount, currency, status, payment_type").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("bookings").select("id, created_at, booking_code, status, starts_on, ends_on, currency, total_mxn, total_usd").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("documents").select("id, created_at, title, document_type, status").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("quote_requests").select("id, lead_id, created_at, locale, status, payload").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("quote_versions").select("id, quote_request_id, version_number, title, summary, currency, total_amount, deposit_amount, notes, status, valid_until, created_by, created_at, updated_at, sent_at, accepted_at, rejected_at, expired_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    contactId ? supabase.from("leads").select("id, contact_id, updated_at, summary, destinations(name_es), profiles!leads_assigned_to_fkey(full_name), lead_statuses(label_es)").eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
    contactId ? supabase.from("contacts").select("id, normalized_email, normalized_phone").eq("id", contactId).limit(1) : Promise.resolve({ data: [], error: null }),
    supabase.from("lead_events").select("lead_id, created_at, payload").eq("event_type", "follow_up_registered").in("lead_id", relatedLeadIds),
    supabase.from("lead_events").select("lead_id").eq("event_type", "contact_identity_ambiguous").in("lead_id", relatedLeadIds),
  ]);

  const timeline = buildTimeline({ lead: lead ? { id: lead.id, created_at: lead.created_at, summary: lead.summary } : null, events: events ?? [], notes: notes ?? [], whatsappClicks: whatsappClicks ?? [], notifications: notifications ?? [], sheetLogs: sheetLogs ?? [], payments: payments ?? [], bookings: bookings ?? [], documents: documents ?? [] });
  const relatedLeadRows = ((relatedOpportunities ?? []) as Array<{ id: string; contact_id: string; updated_at: string; summary: string | null; destinations: Array<{ name_es: string | null }> | { name_es: string | null } | null; profiles: Array<{ full_name: string | null }> | { full_name: string | null } | null; lead_statuses: Array<{ label_es: string | null }> | { label_es: string | null } | null }>).map((item) => ({
    id: item.id,
    contact_id: item.contact_id,
    updated_at: item.updated_at,
    summary: item.summary,
    destinations: firstRelation(item.destinations),
    profiles: firstRelation(item.profiles),
    lead_statuses: firstRelation(item.lead_statuses),
  }));
  const allLeadIds = unique(relatedLeadRows.map((item) => item.id));
  const quoteRequestRows = (quoteRequests ?? []) as Array<{ id: string; lead_id: string | null; created_at: string; locale: string; status: string; payload: unknown }>;
  const quoteVersionRows = (quoteVersions ?? []) as Array<{ accepted_at: string | null; created_at: string; created_by: string | null; currency: string; deposit_amount: number | null; expired_at: string | null; id: string; notes: string | null; quote_request_id: string | null; rejected_at: string | null; sent_at: string | null; status: string; summary: string | null; title: string; total_amount: number | null; updated_at: string; valid_until: string | null; version_number: number }>;
  const allQuoteRequests = contactId && allLeadIds.length ? ((await supabase.from("quote_requests").select("id, lead_id, created_at, locale, status, payload").in("lead_id", allLeadIds)).data ?? []) as Array<{ id: string; lead_id: string | null; created_at: string; locale: string; status: string; payload: unknown }> : quoteRequestRows;
  const latestFollowUps = buildLatestFollowUpIndex((crossOpportunityFollowUps ?? []) as Array<{ lead_id: string; created_at: string; payload: unknown }>);
  const quoteRequestCountByLead = countByLeadId(allQuoteRequests);
  const duplicateContact = ((contactRows ?? []) as Array<{ id: string; normalized_email: string | null; normalized_phone: string | null }>)[0] ?? null;
  const creatorIds = unique(quoteVersionRows.map((item) => item.created_by).filter(Boolean) as string[]);
  const creatorProfiles = creatorIds.length
    ? (((await supabase.from("profiles").select("id, full_name").in("id", creatorIds)).data ?? []) as Array<{ id: string; full_name: string | null }>)
    : [];
  const creatorNames = new Map(creatorProfiles.map((profile) => [profile.id, profile.full_name ?? "Equipo interno"]));
  const [duplicateEmailMatches, duplicatePhoneMatches] = await Promise.all([
    duplicateContact?.normalized_email ? supabase.from("contacts").select("id", { count: "exact", head: true }).eq("normalized_email", duplicateContact.normalized_email).neq("id", duplicateContact.id) : Promise.resolve({ count: 0, error: null }),
    duplicateContact?.normalized_phone ? supabase.from("contacts").select("id", { count: "exact", head: true }).eq("normalized_phone", duplicateContact.normalized_phone).neq("id", duplicateContact.id) : Promise.resolve({ count: 0, error: null }),
  ]);
  const contact360 = buildContact360Summary({
    opportunities: relatedLeadRows,
    quoteRequests: allQuoteRequests,
    followUps: latestFollowUps,
    duplicateEmailMatches: duplicateEmailMatches.count ?? 0,
    duplicatePhoneMatches: duplicatePhoneMatches.count ?? 0,
    ambiguousIdentityEvents: (ambiguousEvents ?? []).length,
  });
  return {
    lead: (lead ?? null) as unknown as LeadDetail | null,
    notes: notes ?? [],
    events: events ?? [],
    timeline,
    payments: payments ?? [],
    bookings: bookings ?? [],
    documents: documents ?? [],
    quoteVersions: buildQuoteVersionHistory(quoteVersionRows, creatorNames),
    quoteRequests: buildQuoteRequestHistory(quoteRequestRows),
    relatedOpportunities: buildRelatedOpportunities(relatedLeadRows.filter((item) => item.id !== id), latestFollowUps, quoteRequestCountByLead),
    contact360,
    error: [error?.message ?? null, duplicateEmailMatches.error?.message ?? null, duplicatePhoneMatches.error?.message ?? null].filter(Boolean).join(" | ") || null,
  };
}

export const leadSearchInternals = { splitSearchTerms, buildLeadSearchPlan, buildLeadSearchClauses, buildQuoteRequestSearchClauses, buildLeadEventSearchClauses, validDate, resolveCreatedAtRange, formatLeadSourceLabel, formatLeadPriorityLabel, formatCurrencyAmount, buildTimeline, templateDisplayLabel, paymentTypeLabel, paymentStatusLabel, bookingStatusLabel, documentTypeLabel, documentStatusLabel, buildAuxiliaryActivityQueryScope, buildQuoteVersionHistory };
