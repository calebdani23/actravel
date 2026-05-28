import "server-only";

import { createClient } from "@/lib/supabase/server";

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

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
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

export async function getLeadStatuses() {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_statuses").select("id, name, label_es").order("sort_order");
  return data ?? [];
}

export async function getAdvisors() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name");
  return data ?? [];
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

async function findSearchMatches(supabase: Awaited<ReturnType<typeof createClient>>, q?: string) {
  const term = cleanText(q)?.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  if (!term) return null;
  const like = `%${escapeSearch(term)}%`;
  const digits = term.replace(/\D/g, "");
  const phoneLike = digits.length >= 4 ? `%${digits}%` : like;

  const [{ data: contacts }, { data: destinations }, { data: quoteRequests }] = await Promise.all([
    supabase.from("contacts").select("id").or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${phoneLike}`).limit(100),
    supabase.from("destinations").select("id").or(`name_es.ilike.${like},name_en.ilike.${like}`).limit(100),
    supabase.from("quote_requests").select("lead_id, contact_id").filter("payload->>mainDestination", "ilike", like).limit(100),
  ]);

  return {
    term,
    contactIds: Array.from(new Set([...(contacts ?? []).map((row) => row.id), ...(quoteRequests ?? []).map((row) => row.contact_id).filter(Boolean)])),
    destinationIds: Array.from(new Set((destinations ?? []).map((row) => row.id))),
    leadIds: Array.from(new Set((quoteRequests ?? []).map((row) => row.lead_id).filter(Boolean))),
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
  const from = validDate(filters.from);
  const to = validDate(filters.to);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (search) {
    const clauses = [`summary.ilike.%${escapeSearch(search.term)}%`];
    if (search.contactIds.length) clauses.push(`contact_id.in.(${search.contactIds.join(",")})`);
    if (search.destinationIds.length) clauses.push(`destination_id.in.(${search.destinationIds.join(",")})`);
    if (search.leadIds.length) clauses.push(`id.in.(${search.leadIds.join(",")})`);
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query;
  return { leads: (data ?? []) as unknown as LeadListRow[], error: error?.message ?? null };
}

function eventLabel(type: string) {
  const labels: Record<string, string> = { status_changed: "Estado actualizado", assigned: "Asesor asignado", note_added: "Nota agregada", follow_up_registered: "Seguimiento registrado", quote_received: "Cotización recibida" };
  return labels[type] ?? type.replaceAll("_", " ");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { queued: "En cola", processing: "Procesando", sent: "Enviado", success: "Sincronizado", failed: "Fallido", skipped: "Omitido", ambiguous: "Ambiguo" };
  return labels[status] ?? status;
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
      metadata: compact([payloadString(payload, "statusLabel"), payloadString(payload, "statusId") ? `Estado: ${payloadString(payload, "statusId")}` : undefined, payloadString(payload, "assignedTo") ? `Asignado a: ${payloadString(payload, "assignedTo")}` : undefined, payloadString(payload, "followUpAt") ? `Próximo: ${payloadString(payload, "followUpAt")}` : undefined]),
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
