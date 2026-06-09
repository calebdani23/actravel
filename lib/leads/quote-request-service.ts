import "server-only";

import { buildTrackedWhatsAppUrl } from "@/lib/whatsapp/link";
import { quoteConfirmationMessage, quoteWhatsAppMessage } from "@/lib/content/public-site";
import { processQuoteSheetSync } from "@/lib/google-sheets/quote-sheet-sync";
import { processQuoteNotifications } from "@/lib/leads/quote-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { type Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput, type QuoteRequestSuccessResponse } from "@/lib/validations/quote-request";

const WHATSAPP_PHONE = "529988453455" as const;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type BoundaryLogSummary = { kind: string; status: "queued" | "processing" | "sent" | "success" | "skipped" | "failed" | "ambiguous"; reason?: string; recipient?: string | null; rowId?: string | null };
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ContactIdentityReason = "no_match" | "phone" | "email" | "phone_and_email" | "duplicate_phone" | "duplicate_email" | "split_phone_email" | "multiple_candidates";
type ContactIdentityResolution = {
  contactId: string;
  status: "matched_existing" | "created_new" | "created_new_from_ambiguity";
  reason: ContactIdentityReason;
  ambiguous: boolean;
  phoneVariants: string[];
  phoneMatchIds: string[];
  emailMatchIds: string[];
  matchedContactIds: string[];
};

const CONTACT_SELECT = "id, first_name, last_name, email, phone, preferred_locale, source, consent_marketing, notes, created_at, updated_at" as const;

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

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildPhoneIdentityVariants(value: string) {
  const normalized = normalizeWhatsApp(value);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (normalized.startsWith("52") && normalized.length === 12) {
    variants.add(`521${normalized.slice(2)}`);
    variants.add(normalized.slice(2));
  }
  if (normalized.startsWith("521") && normalized.length === 13) {
    variants.add(`52${normalized.slice(3)}`);
    variants.add(normalized.slice(3));
  }
  if (normalized.startsWith("1") && normalized.length === 11) {
    variants.add(normalized.slice(1));
  }

  return [...variants];
}

export function resolveContactIdentity(params: { candidates: ContactRow[]; normalizedEmail: string | null; normalizedWhatsapp: string }): Omit<ContactIdentityResolution, "contactId" | "status"> & { existingContactId: string | null; shouldCreateNewContact: boolean } {
  const phoneVariants = buildPhoneIdentityVariants(params.normalizedWhatsapp);
  const phoneMatchIds = uniqueStrings(params.candidates.filter((candidate) => candidate.phone && phoneVariants.includes(normalizeWhatsApp(candidate.phone))).map((candidate) => candidate.id));
  const emailMatchIds = uniqueStrings(params.normalizedEmail ? params.candidates.filter((candidate) => normalizeEmail(candidate.email) === params.normalizedEmail).map((candidate) => candidate.id) : []);
  const matchedContactIds = uniqueStrings([...phoneMatchIds, ...emailMatchIds]);
  const overlappingIds = phoneMatchIds.filter((id) => emailMatchIds.includes(id));

  if (matchedContactIds.length === 0) {
    return { existingContactId: null, shouldCreateNewContact: true, ambiguous: false, reason: "no_match", phoneVariants, phoneMatchIds, emailMatchIds, matchedContactIds };
  }

  if (phoneMatchIds.length <= 1 && emailMatchIds.length <= 1 && matchedContactIds.length === 1) {
    return {
      existingContactId: matchedContactIds[0] ?? null,
      shouldCreateNewContact: false,
      ambiguous: false,
      reason: phoneMatchIds.length === 1 && emailMatchIds.length === 1 ? "phone_and_email" : phoneMatchIds.length === 1 ? "phone" : "email",
      phoneVariants,
      phoneMatchIds,
      emailMatchIds,
      matchedContactIds,
    };
  }

  let reason: ContactIdentityReason = "multiple_candidates";
  if (phoneMatchIds.length > 1 && emailMatchIds.length === 0) reason = "duplicate_phone";
  else if (emailMatchIds.length > 1 && phoneMatchIds.length === 0) reason = "duplicate_email";
  else if (phoneMatchIds.length === 1 && emailMatchIds.length === 1 && overlappingIds.length === 0) reason = "split_phone_email";
  else if (phoneMatchIds.length > 1) reason = "duplicate_phone";
  else if (emailMatchIds.length > 1) reason = "duplicate_email";

  return { existingContactId: null, shouldCreateNewContact: true, ambiguous: true, reason, phoneVariants, phoneMatchIds, emailMatchIds, matchedContactIds };
}

export function buildSafeContactUpdate(existing: ContactRow, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string) {
  const source = input.sourceChannel || "website_quote";
  const notes = input.notes ? `Quote request notes: ${input.notes}` : null;
  const update: Database["public"]["Tables"]["contacts"]["Update"] = {
    preferred_locale: input.locale,
    consent_marketing: true,
  };

  if (!existing.source) update.source = source;
  if (!existing.email && normalizedEmail) update.email = normalizedEmail;
  if (!existing.phone && normalizedWhatsapp) update.phone = normalizedWhatsapp;
  if (!existing.notes && notes) update.notes = notes;

  return update;
}

function quotePayload(
  input: QuoteRequestInput,
  normalizedEmail: string | null,
  normalizedWhatsapp: string,
  consentAt: string,
  identityResolution: ContactIdentityResolution,
  boundaryLogs?: { notifications: BoundaryLogSummary[]; sheetSync: BoundaryLogSummary | null },
): Json {
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
    campaignContext: input.campaignContext ?? null,
    contactConsent: input.contactConsent,
    consentAt,
    notes: input.notes ?? null,
    identityResolution,
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

async function upsertContact(supabase: SupabaseAdminClient, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string): Promise<ContactIdentityResolution> {
  const { firstName, lastName } = splitName(input.holderName);
  const source = input.sourceChannel || "website_quote";
  const notes = input.notes ? `Quote request notes: ${input.notes}` : null;

  const phoneVariants = buildPhoneIdentityVariants(normalizedWhatsapp);
  const [phoneMatches, emailMatches] = await Promise.all([
    phoneVariants.length ? supabase.from("contacts").select(CONTACT_SELECT).in("phone", phoneVariants) : Promise.resolve({ data: [], error: null }),
    normalizedEmail ? supabase.from("contacts").select(CONTACT_SELECT).ilike("email", normalizedEmail) : Promise.resolve({ data: [], error: null }),
  ]);
  if (phoneMatches.error) throw phoneMatches.error;
  if (emailMatches.error) throw emailMatches.error;

  const candidates = [...(phoneMatches.data ?? []), ...(emailMatches.data ?? [])] as ContactRow[];
  const decision = resolveContactIdentity({ candidates, normalizedEmail, normalizedWhatsapp });

  if (decision.existingContactId) {
    const existingContact = candidates.find((candidate) => candidate.id === decision.existingContactId);
    const update = existingContact ? buildSafeContactUpdate(existingContact, input, normalizedEmail, normalizedWhatsapp) : { preferred_locale: input.locale, consent_marketing: true };
    const { data, error } = await supabase
      .from("contacts")
      .update(update)
      .eq("id", decision.existingContactId)
      .select("id")
      .single();
    if (error) throw error;
    return { contactId: data.id, status: "matched_existing", reason: decision.reason, ambiguous: false, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ first_name: firstName, last_name: lastName, email: normalizedEmail, phone: normalizedWhatsapp, preferred_locale: input.locale, source, consent_marketing: true, notes })
    .select("id")
    .single();
  if (error) throw error;
  return {
    contactId: data.id,
    status: decision.ambiguous ? "created_new_from_ambiguity" : "created_new",
    reason: decision.reason,
    ambiguous: decision.ambiguous,
    phoneVariants: decision.phoneVariants,
    phoneMatchIds: decision.phoneMatchIds,
    emailMatchIds: decision.emailMatchIds,
    matchedContactIds: decision.matchedContactIds,
  };
}

export async function createQuoteRequest(input: QuoteRequestInput): Promise<QuoteRequestSuccessResponse> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedWhatsapp = normalizeWhatsApp(input.whatsapp);
  const consentAt = new Date().toISOString();
  const identityResolution = await upsertContact(supabase, input, normalizedEmail, normalizedWhatsapp);
  const contactId = identityResolution.contactId;
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
    .insert({ lead_id: lead.id, contact_id: contactId, locale: input.locale, destination_slug: destinationSlug, service_slug: serviceSlug, payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt, identityResolution), status: "received" })
    .select("id")
    .single();
  if (quoteError) throw quoteError;

  const eventPayload: Json = { source: "website_quote_form", sourceChannel: input.sourceChannel, campaignContext: input.campaignContext ?? null, locale: input.locale, destination: input.mainDestination, service: input.serviceInterest, travelers: { adults: input.adults, children: input.children, total: travelersCount }, quoteRequestId: quoteRequest.id, identityResolution };
  const { error: eventError } = await supabase.from("lead_events").insert({ lead_id: lead.id, actor_id: null, event_type: "quote_submitted", payload: eventPayload });
  if (eventError) throw eventError;

  if (identityResolution.ambiguous) {
    const { error: identityEventError } = await supabase.from("lead_events").insert({ lead_id: lead.id, actor_id: null, event_type: "contact_identity_ambiguous", payload: { quoteRequestId: quoteRequest.id, identityResolution } satisfies Json });
    if (identityEventError) throw identityEventError;
  }

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
    .update({ payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt, identityResolution, { notifications, sheetSync }) })
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
