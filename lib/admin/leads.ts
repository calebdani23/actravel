import "server-only";

import { formatAdminCurrency, formatAdminDate, formatAdminFollowUpLabel, formatAdminModuleLabelFromPath } from "@/lib/admin/format";
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

  const timeline = buildTimeline({ lead: lead ? { id: lead.id, created_at: lead.created_at, summary: lead.summary } : null, events: events ?? [], notes: notes ?? [], whatsappClicks: whatsappClicks ?? [], notifications: notifications ?? [], sheetLogs: sheetLogs ?? [], payments: payments ?? [], bookings: bookings ?? [], documents: documents ?? [] });
  return { lead: (lead ?? null) as unknown as LeadDetail | null, notes: notes ?? [], events: events ?? [], timeline, payments: payments ?? [], bookings: bookings ?? [], documents: documents ?? [], error: error?.message ?? null };
}

export const leadSearchInternals = { splitSearchTerms, buildLeadSearchPlan, buildLeadSearchClauses, buildQuoteRequestSearchClauses, buildLeadEventSearchClauses, validDate, resolveCreatedAtRange, formatLeadSourceLabel, formatLeadPriorityLabel, formatCurrencyAmount, buildTimeline, templateDisplayLabel, paymentTypeLabel, paymentStatusLabel, bookingStatusLabel, documentTypeLabel, documentStatusLabel };
