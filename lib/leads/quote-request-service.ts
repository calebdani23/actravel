import "server-only";

import { buildTrackedWhatsAppUrl } from "@/lib/whatsapp/link";
import { quoteConfirmationMessage, quoteWhatsAppMessage } from "@/lib/content/public-site";
import { processQuoteSheetSync } from "@/lib/google-sheets/quote-sheet-sync";
import { processQuoteNotifications } from "@/lib/leads/quote-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput, type QuoteRequestSuccessResponse } from "@/lib/validations/quote-request";

const WHATSAPP_PHONE = "529988453455" as const;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type BoundaryLogSummary = { kind: string; status: "queued" | "sent" | "success" | "skipped" | "failed"; reason?: string; recipient?: string | null; rowId?: string | null };

function splitName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ");
  const firstName = parts.shift() ?? fullName.trim();
  const lastName = parts.length ? parts.join(" ") : null;
  return { firstName, lastName };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || null;
}

function quotePayload(input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string, consentAt: string, boundaryLogs?: { notifications: BoundaryLogSummary[]; sheetSync: BoundaryLogSummary | null }): Json {
  return {
    locale: input.locale,
    preferredCurrency: input.preferredCurrency,
    holderName: input.holderName,
    email: normalizedEmail,
    whatsapp: normalizedWhatsapp,
    origin: input.origin,
    mainDestination: input.mainDestination,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    adults: input.adults,
    children: input.children,
    travelersCount: input.adults + input.children,
    serviceInterest: input.serviceInterest,
    approximateBudget: input.approximateBudget,
    sourceChannel: input.sourceChannel,
    contactConsent: input.contactConsent,
    consentAt,
    notes: input.notes ?? null,
    boundaryLogs: boundaryLogs ?? null,
  };
}

async function findCatalogId(supabase: SupabaseAdminClient, table: "destinations" | "services", value: string, locale: QuoteRequestInput["locale"]) {
  const slug = slugify(value);
  if (!slug) return null;
  const slugColumn = locale === "es" ? "slug_es" : "slug_en";
  const { data } = await supabase.from(table).select("id").eq(slugColumn, slug).maybeSingle();
  return data?.id ?? null;
}

async function getInitialStatusId(supabase: SupabaseAdminClient) {
  const byName = await supabase.from("lead_statuses").select("id").eq("name", "new").maybeSingle();
  if (byName.data?.id) return byName.data.id;

  const fallback = await supabase.from("lead_statuses").select("id").order("sort_order", { ascending: true }).limit(1).maybeSingle();
  if (!fallback.data?.id) throw new Error("No lead status is configured");
  return fallback.data.id;
}

async function upsertContact(supabase: SupabaseAdminClient, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string) {
  const { firstName, lastName } = splitName(input.holderName);
  const source = input.sourceChannel || "website_quote";
  const notes = input.notes ? `Quote request notes: ${input.notes}` : null;

  const phoneMatch = await supabase.from("contacts").select("id").eq("phone", normalizedWhatsapp).maybeSingle();
  const emailMatch = !phoneMatch.data?.id && normalizedEmail
    ? await supabase.from("contacts").select("id").ilike("email", normalizedEmail).maybeSingle()
    : null;
  const existingId = phoneMatch.data?.id ?? emailMatch?.data?.id;

  if (existingId) {
    const { data, error } = await supabase
      .from("contacts")
      .update({ first_name: firstName, last_name: lastName, email: normalizedEmail, phone: normalizedWhatsapp, preferred_locale: input.locale, source, consent_marketing: true, notes })
      .eq("id", existingId)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ first_name: firstName, last_name: lastName, email: normalizedEmail, phone: normalizedWhatsapp, preferred_locale: input.locale, source, consent_marketing: true, notes })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function createQuoteRequest(input: QuoteRequestInput): Promise<QuoteRequestSuccessResponse> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedWhatsapp = normalizeWhatsApp(input.whatsapp);
  const consentAt = new Date().toISOString();
  const contactId = await upsertContact(supabase, input, normalizedEmail, normalizedWhatsapp);
  const statusId = await getInitialStatusId(supabase);
  const destinationId = await findCatalogId(supabase, "destinations", input.mainDestination, input.locale);
  const serviceId = await findCatalogId(supabase, "services", input.serviceInterest, input.locale);
  const travelersCount = input.adults + input.children;
  const destinationSlug = slugify(input.mainDestination);
  const serviceSlug = slugify(input.serviceInterest);
  const summary = `${input.holderName} · ${input.mainDestination} · ${input.departureDate} to ${input.returnDate} · ${travelersCount} travelers`;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      contact_id: contactId,
      status_id: statusId,
      destination_id: destinationId,
      service_id: serviceId,
      travel_start_date: input.departureDate,
      travel_end_date: input.returnDate,
      travelers_count: travelersCount,
      budget_mxn: input.preferredCurrency === "MXN" ? input.approximateBudget : null,
      budget_usd: input.preferredCurrency === "USD" ? input.approximateBudget : null,
      source: input.sourceChannel || "website",
      priority: "normal",
      summary,
    })
    .select("id")
    .single();
  if (leadError) throw leadError;

  const { data: quoteRequest, error: quoteError } = await supabase
    .from("quote_requests")
    .insert({ lead_id: lead.id, contact_id: contactId, locale: input.locale, destination_slug: destinationSlug, service_slug: serviceSlug, payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt), status: "received" })
    .select("id")
    .single();
  if (quoteError) throw quoteError;

  const eventPayload: Json = { source: "website_quote_form", locale: input.locale, destination: input.mainDestination, service: input.serviceInterest, travelers: { adults: input.adults, children: input.children, total: travelersCount }, quoteRequestId: quoteRequest.id };
  const { error: eventError } = await supabase.from("lead_events").insert({ lead_id: lead.id, actor_id: null, event_type: "quote_submitted", payload: eventPayload });
  if (eventError) throw eventError;

  const whatsappText = quoteWhatsAppMessage(input.locale, input.holderName, input.mainDestination);
  const whatsappHref = buildTrackedWhatsAppUrl({ message: whatsappText, phone: WHATSAPP_PHONE, locale: input.locale, pagePath: "quote-confirmation", leadId: lead.id, contactId });
  let notifications: BoundaryLogSummary[] = [];
  try {
    notifications = await processQuoteNotifications({ supabase, leadId: lead.id, contactId, quoteRequestId: quoteRequest.id, input, normalizedEmail, whatsappHref });
  } catch (error) {
    notifications = [{ kind: "quote_email_notifications", status: "failed", reason: error instanceof Error ? error.message : "Email notification boundary failed" }];
  }

  let sheetSync: BoundaryLogSummary | null = null;
  try {
    sheetSync = await processQuoteSheetSync({ supabase, leadId: lead.id, quoteRequestId: quoteRequest.id, input, normalizedEmail, normalizedWhatsapp });
  } catch (error) {
    sheetSync = { kind: "quote_request_sheet_sync", status: "failed", reason: error instanceof Error ? error.message : "Google Sheets boundary failed" };
  }

  await supabase
    .from("quote_requests")
    .update({ payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt, { notifications, sheetSync }) })
    .eq("id", quoteRequest.id);

  return {
    ok: true,
    leadReference: lead.id.slice(0, 8).toUpperCase(),
    message: quoteConfirmationMessage(input.locale, input.holderName, input.mainDestination),
    whatsapp: {
      phone: WHATSAPP_PHONE,
      text: whatsappText,
      href: whatsappHref,
    },
  };
}
