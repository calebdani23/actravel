import "server-only";

import { sendMetaLeadEvent } from "@/lib/analytics/meta-conversions";
import { parseMetaAttributionSnapshot } from "@/lib/analytics/meta-attribution";
import { buildAbsoluteTrackedWhatsAppUrl, buildTrackedWhatsAppUrl, buildWhatsAppUrl } from "@/lib/whatsapp/link";
import { adminQuoteFollowUpWhatsAppMessage, quoteConfirmationMessage, quoteWhatsAppMessage } from "@/lib/content/public-site";
import {
  buildPhoneIdentityVariants,
  buildSafeContactUpdate as buildSafeCoreContactUpdate,
  findCatalogId,
  getInitialStatusId,
  recordLeadEvent,
  resolveContactIdentity,
  resolveOrCreateContact,
  resolveOrCreateOpportunityLead,
  slugify,
  type ContactIdentityResolution,
  type OpportunityResolution,
} from "@/lib/leads/lead-intake-core";
import { processQuoteNotifications } from "@/lib/leads/quote-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput, type QuoteRequestSuccessResponse } from "@/lib/validations/quote-request";

const WHATSAPP_PHONE = "529988453455" as const;
export const PUBLIC_QUOTE_CANONICAL_SOURCE = "website_quote" as const;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type BoundaryLogSummary = { kind: string; status: "queued" | "processing" | "sent" | "success" | "skipped" | "failed" | "ambiguous"; reason?: string; recipient?: string | null; rowId?: string | null };
type QuoteRequestRuntimeContext = { userAgent?: string | null; requestIp?: string | null; requestReferrer?: string | null };

function clampRequestOwnedValue(value?: string | null, maxLength = 512) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function buildTrustedQuoteAttribution(input: QuoteRequestInput, runtimeContext: QuoteRequestRuntimeContext = {}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const quotePath = input.locale === "es" ? "/es/cotizar" : "/en/quote";

  return {
    canonicalSource: PUBLIC_QUOTE_CANONICAL_SOURCE,
    quotePagePath: quotePath,
    quotePageUrl: siteUrl ? `${siteUrl}${quotePath}` : undefined,
    requestReferrer: clampRequestOwnedValue(runtimeContext.requestReferrer) ?? null,
  };
}

export function buildAdvisoryMarketingContext(input: QuoteRequestInput) {
  return {
    sourceChannel: input.sourceChannel,
    campaignContext: input.campaignContext ?? null,
    clientAttribution: parseMetaAttributionSnapshot(input.attributionSnapshot) ?? null,
  };
}

export function buildSafeContactUpdate(existing: import("@/lib/leads/lead-intake-core").ContactRow, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string) {
  return buildSafeCoreContactUpdate(existing, {
    preferredLocale: input.locale,
    source: PUBLIC_QUOTE_CANONICAL_SOURCE,
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
  opportunityResolution: OpportunityResolution,
  runtimeContext: QuoteRequestRuntimeContext,
  boundaryLogs?: { notifications: BoundaryLogSummary[]; metaConversions: BoundaryLogSummary | null },
): Json {
  const trustedAttribution = buildTrustedQuoteAttribution(input, runtimeContext);
  const advisoryMarketingContext = buildAdvisoryMarketingContext(input);

  return {
    locale: input.locale,
    canonicalSource: PUBLIC_QUOTE_CANONICAL_SOURCE,
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
    trustedAttribution,
    advisoryMarketingContext,
    metaLeadEventId: input.metaLeadEventId ?? null,
    contactConsent: input.contactConsent,
    consentAt,
    notes: input.notes ?? null,
    identityResolution,
    opportunityResolution: {
      status: opportunityResolution.status,
      reason: opportunityResolution.reason,
      reviewRequired: opportunityResolution.reviewRequired,
      serialized: opportunityResolution.serialized,
      signature: opportunityResolution.signature,
      signatureVersion: opportunityResolution.signatureVersion,
      reliablePurpose: opportunityResolution.reliablePurpose,
      basis: opportunityResolution.basis,
    },
    boundaryLogs: boundaryLogs ?? null,
  };
}

async function upsertContact(supabase: SupabaseAdminClient, input: QuoteRequestInput, normalizedEmail: string | null, normalizedWhatsapp: string): Promise<ContactIdentityResolution> {
  const notes = input.notes ? `Quote request notes: ${input.notes}` : null;
  return resolveOrCreateContact(supabase, {
    name: input.holderName,
    email: normalizedEmail,
    phone: normalizedWhatsapp,
    preferredLocale: input.locale,
    source: PUBLIC_QUOTE_CANONICAL_SOURCE,
    notes,
    consentMarketing: true,
  });
}

export async function createQuoteRequest(input: QuoteRequestInput, runtimeContext: QuoteRequestRuntimeContext = {}): Promise<QuoteRequestSuccessResponse> {
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

  const opportunityResolution = await resolveOrCreateOpportunityLead(supabase, {
    contactId,
    statusId,
    destinationId,
    destinationLabel: input.mainDestination,
    serviceId,
    serviceLabel: input.serviceInterest,
    travelStartDate: input.departureDate,
    travelEndDate: input.returnDate,
    travelersCount,
    budgetMxn: input.preferredCurrency === "MXN" ? input.approximateBudget : null,
    budgetUsd: input.preferredCurrency === "USD" ? input.approximateBudget : null,
    source: PUBLIC_QUOTE_CANONICAL_SOURCE,
    priority: "normal",
    summary,
    contactReviewRequired: identityResolution.blocked || identityResolution.deleted,
  });

  const { data: quoteRequest, error: quoteError } = await supabase
    .from("quote_requests")
    .insert({ lead_id: opportunityResolution.leadId, contact_id: contactId, locale: input.locale, destination_slug: destinationSlug, service_slug: serviceSlug, payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt, identityResolution, opportunityResolution, runtimeContext), status: "received" })
    .select("id")
    .single();
  if (quoteError) throw quoteError;

  const eventPayload: Json = { source: PUBLIC_QUOTE_CANONICAL_SOURCE, sourceChannel: input.sourceChannel, campaignContext: input.campaignContext ?? null, trustedAttribution: buildTrustedQuoteAttribution(input, runtimeContext), advisoryMarketingContext: buildAdvisoryMarketingContext(input), metaLeadEventId: input.metaLeadEventId ?? null, locale: input.locale, destination: input.mainDestination, service: input.serviceInterest, travelers: { adults: input.adults, children: input.children, total: travelersCount }, quoteRequestId: quoteRequest.id, identityResolution, opportunityResolution: opportunityResolution.status, opportunityResolutionReason: opportunityResolution.reason, opportunityReviewRequired: opportunityResolution.reviewRequired, opportunitySerialized: opportunityResolution.serialized, opportunitySignature: opportunityResolution.signature, opportunitySignatureVersion: opportunityResolution.signatureVersion, opportunityReliablePurpose: opportunityResolution.reliablePurpose };
  await recordLeadEvent(supabase, { leadId: opportunityResolution.leadId, actorId: null, eventType: "quote_submitted", payload: eventPayload });

  if (identityResolution.ambiguous) {
    await recordLeadEvent(supabase, { leadId: opportunityResolution.leadId, actorId: null, eventType: "contact_identity_ambiguous", payload: { quoteRequestId: quoteRequest.id, identityResolution } satisfies Json });
  }

  if (opportunityResolution.reviewRequired) {
    await recordLeadEvent(supabase, { leadId: opportunityResolution.leadId, actorId: null, eventType: "opportunity_duplicate_review_required", payload: { quoteRequestId: quoteRequest.id, opportunitySignature: opportunityResolution.signature, opportunitySignatureVersion: opportunityResolution.signatureVersion, opportunityBasis: opportunityResolution.basis, reason: opportunityResolution.reason ?? "canonical_reuse_hidden_by_scope" } satisfies Json });
  }

  if (identityResolution.blocked || identityResolution.deleted) {
    await recordLeadEvent(supabase, { leadId: opportunityResolution.leadId, actorId: null, eventType: "blocked_contact_review_required", payload: { quoteRequestId: quoteRequest.id, contactId, reason: identityResolution.deleted ? "contact_deleted" : "contact_blocked" } satisfies Json });
  }

  const outboundSuppressed = identityResolution.blocked || identityResolution.deleted;
  const outboundSuppressionReason = identityResolution.deleted ? "contact_deleted_review" : "blocked_contact_review";
  const whatsappText = outboundSuppressed ? "" : quoteWhatsAppMessage(input.locale, input.holderName, input.mainDestination);
  const clientWhatsAppHref = outboundSuppressed ? "" : buildAbsoluteTrackedWhatsAppUrl({ message: whatsappText, phone: WHATSAPP_PHONE, locale: input.locale, pagePath: "quote-confirmation", leadId: opportunityResolution.leadId, contactId });
  const adminWhatsAppHref = outboundSuppressed ? "" : buildWhatsAppUrl(adminQuoteFollowUpWhatsAppMessage(input.locale, input.holderName, input.mainDestination), normalizedWhatsapp);
  const onsiteWhatsappHref = outboundSuppressed ? "" : buildTrackedWhatsAppUrl({ message: whatsappText, phone: WHATSAPP_PHONE, locale: input.locale, pagePath: "quote-confirmation", leadId: opportunityResolution.leadId, contactId });
  let notifications: BoundaryLogSummary[] = outboundSuppressed ? [{ kind: "quote_email_notifications", status: "skipped", reason: outboundSuppressionReason }] : [];
  if (!outboundSuppressed) {
    try {
      notifications = await processQuoteNotifications({ supabase, leadId: opportunityResolution.leadId, contactId, quoteRequestId: quoteRequest.id, input, normalizedEmail, adminWhatsAppHref, clientWhatsAppHref });
    } catch (error) {
      notifications = [{ kind: "quote_email_notifications", status: "failed", reason: error instanceof Error ? error.message : "Email notification boundary failed" }];
    }
  }

  let metaConversions: BoundaryLogSummary | null = outboundSuppressed ? { kind: "meta_conversions_api", status: "skipped", reason: outboundSuppressionReason } : null;
  if (!outboundSuppressed) {
    try {
      metaConversions = await sendMetaLeadEvent(input, {
        createdAt: consentAt,
        eventId: input.metaLeadEventId,
        eventSourceUrl: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/${input.locale === "es" ? "es/cotizar" : "en/quote"}` : undefined,
        leadId: opportunityResolution.leadId,
        requestIp: runtimeContext.requestIp,
        userAgent: runtimeContext.userAgent,
      });
    } catch (error) {
      metaConversions = { kind: "meta_conversions_api", status: "failed", reason: error instanceof Error ? error.message : "Meta CAPI boundary failed" };
    }
  }

  await supabase
    .from("quote_requests")
    .update({ payload: quotePayload(input, normalizedEmail, normalizedWhatsapp, consentAt, identityResolution, opportunityResolution, runtimeContext, { notifications, metaConversions }) })
    .eq("id", quoteRequest.id);

  return {
    ok: true,
    leadReference: opportunityResolution.leadId.slice(0, 8).toUpperCase(),
    message: quoteConfirmationMessage(input.locale, input.holderName, input.mainDestination),
    whatsapp: {
      phone: WHATSAPP_PHONE,
      text: whatsappText,
      href: onsiteWhatsappHref,
    },
  };
}

export { buildPhoneIdentityVariants, resolveContactIdentity, slugify };
