import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp } from "@/lib/validations/quote-request";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
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
};

const CONTACT_SELECT = "id, first_name, last_name, email, phone, preferred_locale, source, consent_marketing, notes, created_at, updated_at" as const;

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
  const phoneVariants = buildPhoneIdentityVariants(params.normalizedWhatsapp);
  const phoneMatchIds = uniqueStrings(params.candidates.filter((candidate) => candidate.phone && phoneVariants.includes(normalizeWhatsApp(candidate.phone))).map((candidate) => candidate.id));
  const emailMatchIds = uniqueStrings(params.normalizedEmail ? params.candidates.filter((candidate) => normalizeEmail(candidate.email) === params.normalizedEmail).map((candidate) => candidate.id) : []);
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
  if (!existing.notes && input.notes) update.notes = input.notes;
  if (typeof existing.consent_marketing !== "boolean") update.consent_marketing = input.consentMarketing;

  return update;
}

function hasSafeContactUpdate(update: Database["public"]["Tables"]["contacts"]["Update"]) {
  return Object.keys(update).length > 0;
}

export async function getInitialStatusId(supabase: SupabaseAdminClient) {
  const byName = await supabase.from("lead_statuses").select("id").eq("name", "new").maybeSingle();
  if (byName.data?.id) return byName.data.id;

  const fallback = await supabase.from("lead_statuses").select("id").order("sort_order", { ascending: true }).limit(1).maybeSingle();
  if (!fallback.data?.id) throw new Error("No lead status is configured");
  return fallback.data.id;
}

export async function findCatalogId(supabase: SupabaseAdminClient, table: "destinations" | "services", value: string, locale: "es" | "en") {
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

export async function resolveOrCreateContact(supabase: SupabaseAdminClient, input: ResolveOrCreateContactInput): Promise<ContactIdentityResolution> {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedWhatsapp = input.phone ? normalizeWhatsApp(input.phone) : "";
  const phoneVariants = normalizedWhatsapp ? buildPhoneIdentityVariants(normalizedWhatsapp) : [];
  const [phoneMatches, emailMatches] = await Promise.all([
    phoneVariants.length ? supabase.from("contacts").select(CONTACT_SELECT).in("phone", phoneVariants) : Promise.resolve({ data: [], error: null }),
    normalizedEmail ? supabase.from("contacts").select(CONTACT_SELECT).ilike("email", normalizedEmail) : Promise.resolve({ data: [], error: null }),
  ]);
  if (phoneMatches.error) throw phoneMatches.error;
  if (emailMatches.error) throw emailMatches.error;

  const candidates = [...(phoneMatches.data ?? []), ...(emailMatches.data ?? [])] as ContactRow[];
  const decision = resolveContactIdentity({ candidates, normalizedEmail, normalizedWhatsapp });
  const preferredLocale = input.preferredLocale ?? "es";
  const nameParts = input.name ? splitName(input.name) : null;
  const firstName = input.firstName?.trim() || nameParts?.firstName || (normalizedWhatsapp ? `WhatsApp ${normalizedWhatsapp.slice(-4)}` : normalizedEmail?.split("@")[0] ?? "Contacto");
  const lastName = input.lastName?.trim() || nameParts?.lastName || null;
  const notes = input.notes?.trim() || null;
  const consentMarketing = input.consentMarketing ?? false;

  if (decision.existingContactId) {
    const existingContact = candidates.find((candidate) => candidate.id === decision.existingContactId);
    const update = existingContact ? buildSafeContactUpdate(existingContact, { preferredLocale, source: input.source, notes, consentMarketing }, normalizedEmail, normalizedWhatsapp) : { preferred_locale: preferredLocale, consent_marketing: consentMarketing };
    if (!hasSafeContactUpdate(update)) {
      return { contactId: decision.existingContactId, status: "matched_existing", reason: decision.reason, ambiguous: false, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
    }
    const { data, error } = await supabase.from("contacts").update(update).eq("id", decision.existingContactId).select("id").single();
    if (error) throw error;
    return { contactId: data.id, status: "matched_existing", reason: decision.reason, ambiguous: false, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
  }

  const insertPayload: Database["public"]["Tables"]["contacts"]["Insert"] = {
    first_name: firstName,
    last_name: lastName,
    email: normalizedEmail,
    phone: normalizedWhatsapp || null,
    preferred_locale: preferredLocale,
    source: input.source,
    consent_marketing: consentMarketing,
    notes,
  };
  const { data, error } = await supabase.from("contacts").insert(insertPayload).select("id").single();
  if (error) throw error;
  return { contactId: data.id, status: decision.ambiguous ? "created_new_from_ambiguity" : "created_new", reason: decision.reason, ambiguous: decision.ambiguous, phoneVariants: decision.phoneVariants, phoneMatchIds: decision.phoneMatchIds, emailMatchIds: decision.emailMatchIds, matchedContactIds: decision.matchedContactIds };
}

export type CreateCrmLeadInput = {
  contactId: string;
  statusId?: string;
  assignedTo?: string | null;
  source: string;
  priority?: LeadPriority;
  summary?: string | null;
  destinationId?: string | null;
  serviceId?: string | null;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  travelersCount?: number;
  budgetMxn?: number | null;
  budgetUsd?: number | null;
};

export async function createCrmLead(supabase: SupabaseAdminClient, input: CreateCrmLeadInput) {
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
  }).select("id").single();
  if (error) throw error;
  return data;
}

export async function recordLeadEvent(supabase: SupabaseAdminClient, input: { leadId: string; actorId: string | null; eventType: string; payload: Json }) {
  const { error } = await supabase.from("lead_events").insert({ lead_id: input.leadId, actor_id: input.actorId, event_type: input.eventType, payload: input.payload });
  if (error) throw error;
}

export async function createLeadIntake(supabase: SupabaseAdminClient, input: {
  contact: ResolveOrCreateContactInput;
  lead: Omit<CreateCrmLeadInput, "contactId" | "statusId"> & { statusId?: string };
  event: { actorId: string | null; eventType: string; payload: Json };
}) {
  const identityResolution = await resolveOrCreateContact(supabase, input.contact);
  const lead = await createCrmLead(supabase, { ...input.lead, contactId: identityResolution.contactId, statusId: input.lead.statusId });
  await recordLeadEvent(supabase, { leadId: lead.id, actorId: input.event.actorId, eventType: input.event.eventType, payload: input.event.payload });
  return { contactId: identityResolution.contactId, leadId: lead.id, identityResolution };
}
