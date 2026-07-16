import "server-only";

import { buildAbsoluteTrackedWhatsAppUrl, buildTrackedWhatsAppUrl, buildWhatsAppUrl } from "@/lib/whatsapp/link";
import { adminQuoteFollowUpWhatsAppMessage, quoteConfirmationMessage, quoteWhatsAppMessage } from "@/lib/content/public-site";
import { processQuoteSheetSync } from "@/lib/google-sheets/quote-sheet-sync";
import {
  buildPhoneIdentityVariants,
  buildSafeContactUpdate as buildSafeCoreContactUpdate,
  createCrmLead,
  findCatalogId,
  getInitialStatusId,
  recordLeadEvent,
  resolveContactIdentity,
  resolveOrCreateContact,
  slugify,
  type ContactIdentityResolution,
} from "@/lib/leads/lead-intake-core";
import { processQuoteNotifications } from "@/lib/leads/quote-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput, type QuoteRequestSuccessResponse } from "@/lib/validations/quote-request";

const WHATSAPP_PHONE = "529988453455" as const;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type BoundaryLogSummary = { kind: string; status: "queued" | "processing" | "sent" | "success" | "skipped" | "failed" | "ambiguous"; reason?: string; recipient?: string | null; rowId?: string | null };

export function buildSafeContactUpdate(existing: import("@/lib/leads/lead-intake-core").ContactRow, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string) {
  return buildSafeCoreContactUpdate(existing, {
    preferredLocale: input.locale,
    source: input.sourceChannel || "website_quote",
    notes: input.notes ? `Quote request notes: ${input.notes}` : null,
    consentMarketing: true,
  }, normalizedEmail, normalizedWhatsapp);
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

async function upsertContact(supabase: SupabaseAdminClient, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string): Promise<ContactIdentityResolution> {
  const source = input.sourceChannel || "website_quote";
  const notes = input.notes ? `Quote request notes: ${input.notes}` : null;
  return resolveOrCreateContact(supabase, {
    name: input.holderName,
    email: normalizedEmail,
    phone: normalizedWhatsapp,
    preferredLocale: input.locale,
    source,
    notes,
    consentMarketing: true,
  });
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

  const lead = await createCrmLead(supabase, {
    contactId,
    statusId,
    destinationId,
    serviceId,
    travelStartDate: input.departureDate,
    travelEndDate: input.returnDate,
    travelersCount,
    budgetMxn: input.preferredCurrency === "MXN" ? input.approximateBudget : null,
    budgetUsd: input.preferredCurrency === "USD" ? input.approximateBudget : null,
    source: input.sourceChannel || "website",
    priority: "normal",
    summary,
  });

  const { data: quoteRequest, error: quoteError } = await supabase
    .from("quote_requests")
    .insert({ lead_id: lead.id, contact_id: contactId, locale: input.locale, destination_slug: destinationSlug, service_slug: serviceSlug, payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt, identityResolution), status: "received" })
    .select("id")
    .single();
  if (quoteError) throw quoteError;

  const eventPayload: Json = { source: "website_quote_form", sourceChannel: input.sourceChannel, campaignContext: input.campaignContext ?? null, locale: input.locale, destination: input.mainDestination, service: input.serviceInterest, travelers: { adults: input.adults, children: input.children, total: travelersCount }, quoteRequestId: quoteRequest.id, identityResolution };
  await recordLeadEvent(supabase, { leadId: lead.id, actorId: null, eventType: "quote_submitted", payload: eventPayload });

  if (identityResolution.ambiguous) {
    await recordLeadEvent(supabase, { leadId: lead.id, actorId: null, eventType: "contact_identity_ambiguous", payload: { quoteRequestId: quoteRequest.id, identityResolution } satisfies Json });
  }

  const whatsappText = quoteWhatsAppMessage(input.locale, input.holderName, input.mainDestination);
  const clientWhatsAppHref = buildAbsoluteTrackedWhatsAppUrl({ message: whatsappText, phone: WHATSAPP_PHONE, locale: input.locale, pagePath: "quote-confirmation", leadId: lead.id, contactId });
  const adminWhatsAppHref = buildWhatsAppUrl(adminQuoteFollowUpWhatsAppMessage(input.locale, input.holderName, input.mainDestination), normalizedWhatsapp);
  const onsiteWhatsappHref = buildTrackedWhatsAppUrl({ message: whatsappText, phone: WHATSAPP_PHONE, locale: input.locale, pagePath: "quote-confirmation", leadId: lead.id, contactId });
  let notifications: BoundaryLogSummary[] = [];
  try {
    notifications = await processQuoteNotifications({ supabase, leadId: lead.id, contactId, quoteRequestId: quoteRequest.id, input, normalizedEmail, adminWhatsAppHref, clientWhatsAppHref });
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
      href: onsiteWhatsappHref,
    },
  };
}

export { buildPhoneIdentityVariants, resolveContactIdentity, slugify };
