import "server-only";

import { createClient } from "@/lib/supabase/server";
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
};

export type LeadListRow = {
  id: string;
  contact_id: string;
  created_at: string;
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

export type LeadDetail = LeadListRow & {
  contacts: (LeadListRow["contacts"] & { preferred_locale: string; source: string | null; notes: string | null }) | null;
  services: { id: string; name_es: string } | null;
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

function compact(values: Array<string | undefined | null | false>) {
  return values.filter((value): value is string => Boolean(value));
}

export function formatLeadSourceLabel(source: string | null | undefined) {
  const labels: Record<string, string> = {
    website: "Website",
    website_quote: "Website Quote",
    whatsapp_inbound_ad: "WhatsApp Ad Lead",
    whatsapp_inbound_facebook: "WhatsApp Facebook Lead",
    whatsapp_inbound_instagram: "WhatsApp Instagram Lead",
    manual_admin: "Manual Admin",
    manual_asesor: "Manual Advisor",
    phone_call: "Phone Call",
    whatsapp_manual: "WhatsApp Manual",
    instagram_dm: "Instagram DM",
    referral: "Referral",
    walk_in: "Walk-in",
  };
  return labels[source ?? ""] ?? source ?? "—";
}

export async function getLeadStatuses() {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_statuses").select("id, name, label_es").order("sort_order");
  return data ?? [];
}

export async function getAdvisors() {
  return getAdvisorCapableStaff();
}

export async function getDestinations() {
  const supabase = await createClient();
  const { data } = await supabase.from("destinations").select("id, name_es").order("name_es");
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

export async function getLeads(filters: LeadFilters) {
  const supabase = await createClient();
  const search = await findSearchMatches(supabase, filters.q);
  let query = supabase
    .from("leads")
    .select("id, contact_id, created_at, updated_at, travel_start_date, travel_end_date, travelers_count, budget_mxn, budget_usd, source, priority, summary, contacts(first_name, last_name, email, phone), lead_statuses!inner(id, name, label_es), destinations(id, name_es), profiles!leads_assigned_to_fkey(id, full_name)")
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
  return { leads: (data ?? []) as unknown as LeadListRow[], error: error?.message ?? null };
}

function eventLabel(type: string) {
  const labels: Record<string, string> = { status_changed: "Estado actualizado", assigned: "Asesor asignado", note_added: "Nota agregada", follow_up_registered: "Seguimiento registrado", quote_received: "Cotización recibida", quote_submitted: "Cotización recibida", contact_identity_ambiguous: "Identidad ambigua", whatsapp_inbound_received: "WhatsApp recibido", manual_lead_created: "Lead manual creado" };
  return labels[type] ?? type.replaceAll("_", " ");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { queued: "En cola", processing: "Procesando", sent: "Enviado", success: "Sincronizado", failed: "Fallido", skipped: "Omitido", ambiguous: "Ambiguo" };
  return labels[status] ?? status;
}

function eventSummary(eventType: string, payload: JsonRecord) {
  if (eventType === "whatsapp_inbound_received") return payloadString(payload, "messageText");
  if (eventType === "manual_lead_created") return payloadString(payload, "source") ? `Origen: ${payloadString(payload, "source")}` : undefined;
  return undefined;
}

function eventMetadata(eventType: string, payload: JsonRecord) {
  const referral = jsonObject(payload.referral);
  const base = compact([
    payloadString(payload, "statusLabel"),
    payloadString(payload, "statusId") ? `Estado: ${payloadString(payload, "statusId")}` : undefined,
    payloadString(payload, "assignedTo") ? `Asignado a: ${payloadString(payload, "assignedTo")}` : undefined,
    payloadString(payload, "followUpAt") ? `Próximo: ${payloadString(payload, "followUpAt")}` : undefined,
  ]);
  if (eventType === "whatsapp_inbound_received") {
    return compact([
      ...base,
      payloadString(payload, "fromPhone") ? `Tel: ${payloadString(payload, "fromPhone")}` : undefined,
      payloadString(payload, "source") ? `Canal: ${formatLeadSourceLabel(payloadString(payload, "source"))}` : undefined,
      payloadString(referral, "headline") ? `Anuncio: ${payloadString(referral, "headline")}` : undefined,
      payloadString(referral, "source_type") ? `Red: ${payloadString(referral, "source_type")}` : undefined,
      payloadString(referral, "ctwa_clid") ? `CTWA: ${payloadString(referral, "ctwa_clid")}` : undefined,
    ]);
  }
  if (eventType === "manual_lead_created") {
    return compact([
      ...base,
      payloadString(payload, "source") ? `Canal: ${formatLeadSourceLabel(payloadString(payload, "source"))}` : undefined,
      payload.hasNote === true ? "Con nota inicial" : undefined,
    ]);
  }
  return base;
}

function buildTimeline(input: { events: unknown[]; notes: unknown[]; whatsappClicks: unknown[]; notifications: unknown[]; sheetLogs: unknown[] }) {
  const items: LeadTimelineItem[] = [];

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
    items.push({ id: `whatsapp-${click.id}`, at: click.created_at, kind: "whatsapp", label: "WhatsApp abierto", summary: click.message ?? undefined, metadata: compact([click.phone ? `Tel: ${click.phone}` : undefined, click.page_path ? `Origen: ${click.page_path}` : undefined]) });
  }

  for (const raw of input.notifications) {
    const log = raw as { id: string; created_at: string; channel: string; provider: string | null; template_name: string | null; status: string; error_message: string | null; recipient: string | null };
    items.push({ id: `notification-${log.id}`, at: log.created_at, kind: "notification", label: `${log.channel} ${statusLabel(log.status)}`, summary: log.error_message ?? undefined, metadata: compact([log.template_name ? `Template: ${log.template_name}` : undefined, log.provider ? `Provider: ${log.provider}` : undefined, log.recipient ? `Para: ${log.recipient}` : undefined]) });
  }

  for (const raw of input.sheetLogs) {
    const log = raw as { id: string; created_at: string; sheet_name: string | null; row_id: string | null; status: string; error_message: string | null };
    items.push({ id: `sheet-${log.id}`, at: log.created_at, kind: "sheet", label: `Google Sheets ${statusLabel(log.status)}`, summary: log.error_message ?? undefined, metadata: compact([log.sheet_name ? `Hoja: ${log.sheet_name}` : undefined, log.row_id ? `Fila: ${log.row_id}` : undefined]) });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export async function getLeadDetail(id: string) {
  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, contact_id, created_at, updated_at, travel_start_date, travel_end_date, travelers_count, budget_mxn, budget_usd, source, priority, summary, contacts(first_name, last_name, email, phone, preferred_locale, source, notes), lead_statuses(id, name, label_es), destinations(id, name_es), services(id, name_es), profiles!leads_assigned_to_fkey(id, full_name)")
    .eq("id", id)
    .maybeSingle();

  const contactId = lead?.contact_id as string | undefined;
  const [{ data: notes }, { data: events }, { data: whatsappClicks }, { data: notifications }, { data: sheetLogs }, { data: payments }, { data: bookings }, { data: documents }] = await Promise.all([
    supabase.from("lead_notes").select("id, created_at, body, is_internal, profiles!lead_notes_author_id_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("lead_events").select("id, created_at, event_type, payload, profiles!lead_events_actor_id_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("whatsapp_clicks").select("id, created_at, phone, page_path, message").or(`lead_id.eq.${id}${contactId ? `,contact_id.eq.${contactId}` : ""}`).order("created_at", { ascending: false }).limit(20),
    supabase.from("notification_logs").select("id, created_at, channel, provider, recipient, template_name, status, error_message").or(`lead_id.eq.${id}${contactId ? `,contact_id.eq.${contactId}` : ""}`).order("created_at", { ascending: false }).limit(20),
    supabase.from("sheet_sync_logs").select("id, created_at, sheet_name, row_id, status, error_message").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("payments").select("id, created_at, amount, currency, status, payment_type").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("bookings").select("id, created_at, booking_code, status, starts_on, ends_on, currency, total_mxn, total_usd").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("documents").select("id, created_at, title, document_type, status").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  const timeline = buildTimeline({ events: events ?? [], notes: notes ?? [], whatsappClicks: whatsappClicks ?? [], notifications: notifications ?? [], sheetLogs: sheetLogs ?? [] });
  return { lead: (lead ?? null) as unknown as LeadDetail | null, notes: notes ?? [], events: events ?? [], timeline, payments: payments ?? [], bookings: bookings ?? [], documents: documents ?? [], error: error?.message ?? null };
}

export const leadSearchInternals = { splitSearchTerms, buildLeadSearchPlan, buildLeadSearchClauses, buildQuoteRequestSearchClauses, buildLeadEventSearchClauses, validDate, resolveCreatedAtRange, formatLeadSourceLabel };
