import "server-only";

import { buildOpportunityPurposeSignature } from "@/lib/leads/opportunity-resolver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp } from "@/lib/validations/quote-request";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SupabaseLeadClient = Pick<SupabaseAdminClient, "from" | "rpc">;
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type LeadPriority = Database["public"]["Tables"]["leads"]["Row"]["priority"];
export type ContactIdentityReason = "no_match" | "phone" | "email" | "phone_and_email" | "duplicate_phone" | "duplicate_email" | "split_phone_email" | "multiple_candidates";
export type ContactIdentityResolution = {
  contactId: string;
  status: "matched_existing" | "created_new" | "created_new_from_ambiguity";
  reason: ContactIdentityReason;
  ambiguous: boolean;
  phoneVariants: string[];
  phoneMatchIds: string[];
  emailMatchIds: string[];
  matchedContactIds: string[];
  blocked: boolean;
  deleted: boolean;
};

export type OpportunityResolution = {
  basis: Json;
  createdNew: boolean;
  leadId: string;
  reason: "canonical_reuse_hidden_by_scope" | "serialized_resolution_unavailable" | null;
  reviewRequired: boolean;
  reliablePurpose: boolean;
  signature: string | null;
  signatureVersion: number;
  serialized: boolean;
  status: "created_duplicate_review" | "created_new" | "reused_existing" | "resolution_unavailable";
};

const CONTACT_SELECT = "id, first_name, last_name, email, phone, normalized_email, normalized_phone, preferred_locale, source, consent_marketing, notes, lifecycle_status, blocked_at, blocked_by, blocked_reason, deleted_at, deleted_by, deleted_reason, created_at, updated_at" as const;

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function splitName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ");
  const firstName = parts.shift() ?? fullName.trim();
  const lastName = parts.length ? parts.join(" ") : null;
  return { firstName, lastName };
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || null;
}

function normalizedContactEmail(contact: ContactRow) {
  return contact.normalized_email ?? normalizeEmail(contact.email);
}

function normalizedContactPhone(contact: ContactRow) {
  return contact.normalized_phone ?? (contact.phone ? normalizeWhatsApp(contact.phone) : "");
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
  if (normalized.startsWith("1") && normalized.length === 11) variants.add(normalized.slice(1));

  return [...variants];
}

export function resolveContactIdentity(params: { candidates: ContactRow[]; normalizedEmail: string | null; normalizedWhatsapp: string }) {
  const candidates = params.candidates.filter((candidate) => !candidate.deleted_at);
  const phoneVariants = buildPhoneIdentityVariants(params.normalizedWhatsapp);
  const phoneMatchIds = uniqueStrings(candidates.filter((candidate) => normalizedContactPhone(candidate) && phoneVariants.includes(normalizedContactPhone(candidate))).map((candidate) => candidate.id));
  const emailMatchIds = uniqueStrings(params.normalizedEmail ? candidates.filter((candidate) => normalizedContactEmail(candidate) === params.normalizedEmail).map((candidate) => candidate.id) : []);
  const matchedContactIds = uniqueStrings([...phoneMatchIds, ...emailMatchIds]);
  const overlappingIds = phoneMatchIds.filter((id) => emailMatchIds.includes(id));

  if (matchedContactIds.length === 0) {
    return { existingContactId: null, shouldCreateNewContact: true, ambiguous: false, reason: "no_match" as const, phoneVariants, phoneMatchIds, emailMatchIds, matchedContactIds };
  }

  if (phoneMatchIds.length <= 1 && emailMatchIds.length <= 1 && matchedContactIds.length === 1) {
    return {
      existingContactId: matchedContactIds[0] ?? null,
      shouldCreateNewContact: false,
      ambiguous: false,
      reason: phoneMatchIds.length === 1 && emailMatchIds.length === 1 ? "phone_and_email" as const : phoneMatchIds.length === 1 ? "phone" as const : "email" as const,
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

export function buildSafeContactUpdate(existing: ContactRow, input: { preferredLocale: string; source: string; notes?: string | null; consentMarketing: boolean }, normalizedEmail: string | null, normalizedWhatsapp: string) {
  const update: Database["public"]["Tables"]["contacts"]["Update"] = {};

  if (!existing.preferred_locale?.trim()) update.preferred_locale = input.preferredLocale;
  if (!existing.source) update.source = input.source;
  if (!existing.email && normalizedEmail) update.email = normalizedEmail;
  if (!existing.phone && normalizedWhatsapp) update.phone = normalizedWhatsapp;
  if (!existing.normalized_email && normalizedEmail) update.normalized_email = normalizedEmail;
  if (!existing.normalized_phone && normalizedWhatsapp) update.normalized_phone = normalizedWhatsapp;
  if (!existing.notes && input.notes) update.notes = input.notes;
  if (typeof existing.consent_marketing !== "boolean") update.consent_marketing = input.consentMarketing;

  return update;
}

function hasSafeContactUpdate(update: Database["public"]["Tables"]["contacts"]["Update"]) {
  return Object.keys(update).length > 0;
}

export async function getInitialStatusId(supabase: SupabaseLeadClient) {
  const byName = await supabase.from("lead_statuses").select("id").eq("name", "new").maybeSingle();
  if (byName.data?.id) return byName.data.id;

  const fallback = await supabase.from("lead_statuses").select("id").order("sort_order", { ascending: true }).limit(1).maybeSingle();
  if (!fallback.data?.id) throw new Error("No lead status is configured");
  return fallback.data.id;
}

export async function findCatalogId(supabase: SupabaseLeadClient, table: "destinations" | "services", value: string, locale: "es" | "en") {
  const slug = slugify(value);
  if (!slug) return null;
  const slugColumn = locale === "es" ? "slug_es" : "slug_en";
  const { data } = await supabase.from(table).select("id").eq(slugColumn, slug).maybeSingle();
  return data?.id ?? null;
}

export type ResolveOrCreateContactInput = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredLocale?: string;
  source: string;
  notes?: string | null;
  consentMarketing?: boolean;
};

export async function resolveOrCreateContact(supabase: SupabaseLeadClient, input: ResolveOrCreateContactInput): Promise<ContactIdentityResolution> {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedWhatsapp = input.phone ? normalizeWhatsApp(input.phone) : "";
  const phoneVariants = normalizedWhatsapp ? buildPhoneIdentityVariants(normalizedWhatsapp) : [];
  const [phoneMatches, emailMatches] = await Promise.all([
    phoneVariants.length ? supabase.from("contacts").select(CONTACT_SELECT).in("normalized_phone", phoneVariants) : Promise.resolve({ data: [], error: null }),
    normalizedEmail ? supabase.from("contacts").select(CONTACT_SELECT).eq("normalized_email", normalizedEmail) : Promise.resolve({ data: [], error: null }),
  ]);
  if (phoneMatches.error) throw phoneMatches.error;
  if (emailMatches.error) throw emailMatches.error;

  const candidates = [...(phoneMatches.data ?? []), ...(emailMatches.data ?? [])] as ContactRow[];
  // Tombstones are historical records, not valid identity candidates.
  const activeCandidates = candidates.filter((candidate) => !candidate.deleted_at);
  const decision = resolveContactIdentity({ candidates: activeCandidates, normalizedEmail, normalizedWhatsapp });
  const preferredLocale = input.preferredLocale ?? "es";
  const nameParts = input.name ? splitName(input.name) : null;
  const firstName = input.firstName?.trim() || nameParts?.firstName || (normalizedWhatsapp ? `WhatsApp ${normalizedWhatsapp.slice(-4)}` : normalizedEmail?.split("@")[0] ?? "Contacto");
  const lastName = input.lastName?.trim() || nameParts?.lastName || null;
  const notes = input.notes?.trim() || null;
  const consentMarketing = input.consentMarketing ?? false;

  if (decision.existingContactId) {
    const existingContact = activeCandidates.find((candidate) => candidate.id === decision.existingContactId);
    const update = existingContact ? buildSafeContactUpdate(existingContact, { preferredLocale, source: input.source, notes, consentMarketing }, normalizedEmail, normalizedWhatsapp) : { preferred_locale: preferredLocale, consent_marketing: consentMarketing };
    if (!hasSafeContactUpdate(update)) {
      return { contactId: decision.existingContactId, status: "matched_existing", reason: decision.reason, ambiguous: false, blocked: existingContact?.lifecycle_status === "blocked", deleted: false, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
    }
    const { data, error } = await supabase.from("contacts").update(update).eq("id", decision.existingContactId).select("id").single();
    if (error) throw error;
    return { contactId: data.id, status: "matched_existing", reason: decision.reason, ambiguous: false, blocked: existingContact?.lifecycle_status === "blocked", deleted: false, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
  }

  const insertPayload: Database["public"]["Tables"]["contacts"]["Insert"] = {
    first_name: firstName,
    last_name: lastName,
    email: normalizedEmail,
    phone: normalizedWhatsapp || null,
    normalized_email: normalizedEmail,
    normalized_phone: normalizedWhatsapp || null,
    preferred_locale: preferredLocale,
    source: input.source,
    consent_marketing: consentMarketing,
    notes,
  };
  const { data, error } = await supabase.from("contacts").insert(insertPayload).select("id").single();
  if (error) throw error;
  return { contactId: data.id, status: decision.ambiguous ? "created_new_from_ambiguity" : "created_new", reason: decision.reason, ambiguous: decision.ambiguous, blocked: false, deleted: false, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
}

export type CreateCrmLeadInput = {
  contactId: string;
  statusId?: string;
  assignedTo?: string | null;
  source: string;
  priority?: LeadPriority;
  summary?: string | null;
  destinationId?: string | null;
  destinationLabel?: string | null;
  serviceId?: string | null;
  serviceLabel?: string | null;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  travelersCount?: number;
  budgetMxn?: number | null;
  budgetUsd?: number | null;
  opportunityBasis?: Json;
  opportunitySignature?: string | null;
  opportunitySignatureVersion?: number;
  contactReviewRequired?: boolean;
};

export async function createCrmLead(supabase: SupabaseLeadClient, input: CreateCrmLeadInput) {
  const statusId = input.statusId ?? await getInitialStatusId(supabase);
  const { data, error } = await supabase.from("leads").insert({
    contact_id: input.contactId,
    status_id: statusId,
    assigned_to: input.assignedTo ?? null,
    destination_id: input.destinationId ?? null,
    service_id: input.serviceId ?? null,
    travel_start_date: input.travelStartDate ?? null,
    travel_end_date: input.travelEndDate ?? null,
    travelers_count: input.travelersCount ?? 1,
    budget_mxn: input.budgetMxn ?? null,
    budget_usd: input.budgetUsd ?? null,
    source: input.source,
    priority: input.priority ?? "normal",
    summary: input.summary ?? null,
    opportunity_signature: input.opportunitySignature ?? null,
    opportunity_signature_version: input.opportunitySignatureVersion ?? 1,
    opportunity_basis: input.opportunityBasis ?? ({} as Json),
  }).select("id").single();
  if (error) throw error;
  return data;
}

function isOpportunityResolverRpcUnavailable(error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined) {
  const summary = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return summary.includes("crm_resolve_opportunity_lead") && (
    summary.includes("pgrst") ||
    summary.includes("schema cache") ||
    summary.includes("function") ||
    summary.includes("not found")
  );
}

type SerializedOpportunityRpcRow = {
  basis: Json;
  created_new: boolean;
  lead_id: string;
  reliable_purpose: boolean;
  resolution_status: OpportunityResolution["status"];
  review_required: boolean;
  signature: string | null;
  signature_version: number;
};

type SerializedOpportunityAttempt = {
  resolution: OpportunityResolution | null;
  unavailable: boolean;
};

async function resolveSerializedOpportunityLead(
  supabase: SupabaseLeadClient,
  input: CreateCrmLeadInput,
): Promise<SerializedOpportunityAttempt> {
  if (!input.opportunitySignature) return { resolution: null, unavailable: false };

  const { data, error } = await supabase.rpc("crm_resolve_opportunity_lead", {
    p_assigned_to: input.assignedTo ?? null,
    p_budget_mxn: input.budgetMxn ?? null,
    p_budget_usd: input.budgetUsd ?? null,
    p_contact_id: input.contactId,
    p_destination_id: input.destinationId ?? null,
    p_opportunity_basis: input.opportunityBasis ?? ({} as Json),
    p_opportunity_signature: input.opportunitySignature,
    p_opportunity_signature_version: input.opportunitySignatureVersion ?? 1,
    p_priority: input.priority ?? "normal",
    p_service_id: input.serviceId ?? null,
    p_source: input.source,
    p_status_id: input.statusId ?? null,
    p_summary: input.summary ?? null,
    p_travel_end_date: input.travelEndDate ?? null,
    p_travel_start_date: input.travelStartDate ?? null,
    p_travelers_count: input.travelersCount ?? 1,
  });

  if (error) {
    if (isOpportunityResolverRpcUnavailable(error)) {
      return { resolution: null, unavailable: true };
    }
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as SerializedOpportunityRpcRow | undefined) : (data as SerializedOpportunityRpcRow | null);
  if (!row?.lead_id) {
    return { resolution: null, unavailable: false };
  }

  return {
    unavailable: false,
    resolution: {
      basis: row.basis,
      createdNew: row.created_new,
      leadId: row.lead_id,
      reason: row.review_required ? "canonical_reuse_hidden_by_scope" : null,
      reliablePurpose: row.reliable_purpose,
      reviewRequired: row.review_required,
      serialized: true,
      signature: row.signature,
      signatureVersion: row.signature_version,
      status: row.resolution_status,
    },
  };
}

export async function resolveOrCreateOpportunityLead(
  supabase: SupabaseLeadClient,
  input: CreateCrmLeadInput,
): Promise<OpportunityResolution> {
  const statusId = input.statusId ?? await getInitialStatusId(supabase);
  const purpose = buildOpportunityPurposeSignature({
    destinationId: input.destinationId,
    destinationName: input.destinationLabel,
    serviceId: input.serviceId,
    serviceName: input.serviceLabel,
  });
  const leadInput: CreateCrmLeadInput = {
    ...input,
    statusId,
    opportunitySignature: purpose.signature,
    opportunitySignatureVersion: purpose.version,
    opportunityBasis: purpose.basis,
  };

  if (purpose.signature) {
    const serializedAttempt = await resolveSerializedOpportunityLead(supabase, leadInput);
    if (serializedAttempt.resolution) {
      return serializedAttempt.resolution;
    }

    const created = await createCrmLead(supabase, leadInput);
    return {
      leadId: created.id,
      status: "resolution_unavailable",
      createdNew: true,
      reviewRequired: true,
      reason: "serialized_resolution_unavailable",
      signature: purpose.signature,
      signatureVersion: purpose.version,
      basis: purpose.basis,
      reliablePurpose: purpose.reliable,
      serialized: false,
    };
  }

  const created = await createCrmLead(supabase, leadInput);
  return {
    leadId: created.id,
    status: "created_new",
    createdNew: true,
    reason: null,
    reviewRequired: false,
    signature: purpose.signature,
    signatureVersion: purpose.version,
    basis: purpose.basis,
    reliablePurpose: purpose.reliable,
    serialized: false,
  };
}

export async function recordLeadEvent(supabase: SupabaseLeadClient, input: { leadId: string; actorId: string | null; eventType: string; payload: Json }) {
  const { error } = await supabase.from("lead_events").insert({ lead_id: input.leadId, actor_id: input.actorId, event_type: input.eventType, payload: input.payload });
  if (error) throw error;
}

export async function createLeadIntake(supabase: SupabaseLeadClient, input: {
  contact: ResolveOrCreateContactInput;
  lead: Omit<CreateCrmLeadInput, "contactId" | "statusId"> & { statusId?: string };
  event: { actorId: string | null; eventType: string; payload: Json };
}) {
  const identityResolution = await resolveOrCreateContact(supabase, input.contact);
  const opportunityResolution = await resolveOrCreateOpportunityLead(supabase, { ...input.lead, contactId: identityResolution.contactId, statusId: input.lead.statusId, contactReviewRequired: identityResolution.blocked || identityResolution.deleted });
  await recordLeadEvent(supabase, {
    leadId: opportunityResolution.leadId,
    actorId: input.event.actorId,
    eventType: input.event.eventType,
    payload: { ...((input.event.payload as Record<string, Json>) ?? {}), opportunityResolution: opportunityResolution.status, opportunityReviewRequired: opportunityResolution.reviewRequired, opportunitySerialized: opportunityResolution.serialized, opportunitySignature: opportunityResolution.signature, opportunitySignatureVersion: opportunityResolution.signatureVersion, opportunityReliablePurpose: opportunityResolution.reliablePurpose },
  });
  if (opportunityResolution.reviewRequired) {
    await recordLeadEvent(supabase, {
      leadId: opportunityResolution.leadId,
      actorId: input.event.actorId,
      eventType: "opportunity_duplicate_review_required",
      payload: { opportunitySignature: opportunityResolution.signature, opportunitySignatureVersion: opportunityResolution.signatureVersion, opportunityBasis: opportunityResolution.basis, reason: opportunityResolution.reason ?? "canonical_reuse_hidden_by_scope" },
    });
  }
  if (identityResolution.blocked || identityResolution.deleted) {
    await recordLeadEvent(supabase, {
      leadId: opportunityResolution.leadId,
      actorId: input.event.actorId,
      eventType: "blocked_contact_review_required",
      payload: { reason: identityResolution.deleted ? "contact_deleted" : "contact_blocked", contactId: identityResolution.contactId } satisfies Json,
    });
  }
  return { contactId: identityResolution.contactId, leadId: opportunityResolution.leadId, identityResolution, opportunityResolution };
}
