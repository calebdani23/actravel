"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { QuoteVersionActionState } from "./quote-version-action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  canExpireQuoteVersion,
  canMarkQuoteVersionSent,
  canRejectQuoteVersion,
  createQuoteVersionSchema,
  isValidQuoteVersionTransition,
  quoteVersionActionErrorMessage,
  quoteVersionConcurrencyMessage,
  quoteVersionStatusLabel,
  quoteVersionValidationMessage,
  type CreateQuoteVersionInput,
  type QuoteVersionStatus,
} from "@/lib/admin/quote-versions";
import { createClient } from "@/lib/supabase/server";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error("missing_required_field");
  return value.trim();
}

async function insertLeadEvent(leadId: string, actorId: string, eventType: string, payload: Json) {
  const supabase = await createClient();
  await supabase.from("lead_events").insert({ lead_id: leadId, actor_id: actorId, event_type: eventType, payload });
}

async function insertLeadEventBestEffort(leadId: string, actorId: string, eventType: string, payload: Json) {
  try {
    await insertLeadEvent(leadId, actorId, eventType, payload);
  } catch (error) {
    console.warn("[quote-version] lead event logging failed after successful write", {
      error,
      eventType,
      leadId,
    });
  }
}

function isUniqueVersionError(error: PostgrestError | null) {
  return error?.code === "23505" && error.message.toLowerCase().includes("quote_versions_unique_per_lead_version");
}

function isUniqueIdempotencyError(error: PostgrestError | null) {
  return error?.code === "23505" && error.message.toLowerCase().includes("quote_versions_lead_idempotency_key_idx");
}

async function loadLeadScope(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  const { data, error } = await supabase.from("leads").select("id, contact_id").eq("id", leadId).maybeSingle();
  if (error || !data) throw new Error("lead_scope_unavailable");
  return data;
}

async function loadQuoteVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  quoteVersionId: string,
) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, lead_id, contact_id, quote_request_id, version_number, title, currency, total_amount, deposit_amount, status, sent_at, updated_at")
    .eq("lead_id", leadId)
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (error || !data) throw new Error("quote_version_not_found");
  return data;
}

async function nextVersionNumber(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("version_number")
    .eq("lead_id", leadId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("version_number_unavailable");
  return (data?.version_number ?? 0) + 1;
}

async function loadQuoteVersionByIdempotencyKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, version_number")
    .eq("lead_id", leadId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createQuoteVersionDraftRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionUserId: string,
  input: CreateQuoteVersionInput,
) {
  const lead = await loadLeadScope(supabase, input.leadId);

  if (input.idempotencyKey) {
    const existing = await loadQuoteVersionByIdempotencyKey(supabase, input.leadId, input.idempotencyKey);
    if (existing) return { ...existing, contact_id: lead.contact_id };
  }

  if (input.quoteRequestId) {
    const { data: request, error } = await supabase
      .from("quote_requests")
      .select("id, lead_id, contact_id")
      .eq("id", input.quoteRequestId)
      .eq("lead_id", input.leadId)
      .maybeSingle();

    if (error || !request || request.contact_id !== lead.contact_id) throw new Error("quote_request_scope_invalid");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const versionNumber = await nextVersionNumber(supabase, input.leadId);
    const row: TablesInsert<"quote_versions"> = {
      lead_id: input.leadId,
      contact_id: lead.contact_id,
      quote_request_id: input.quoteRequestId ?? null,
      version_number: versionNumber,
      title: input.title,
      summary: input.summary ?? null,
      currency: input.currency,
      total_amount: input.totalAmount ?? null,
      deposit_amount: input.depositAmount ?? null,
      notes: input.notes ?? null,
      status: "draft",
      valid_until: input.validUntil ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      created_by: sessionUserId,
    };

    const { data, error } = await supabase.from("quote_versions").insert(row).select("id, version_number").single();
    if (!error && data) return { ...data, contact_id: lead.contact_id };
    if (input.idempotencyKey && isUniqueIdempotencyError(error)) {
      const existing = await loadQuoteVersionByIdempotencyKey(supabase, input.leadId, input.idempotencyKey);
      if (existing) return { ...existing, contact_id: lead.contact_id };
    }
    if (!isUniqueVersionError(error)) throw error ?? new Error("quote_version_insert_failed");
  }

  throw new Error("quote_version_concurrency_exceeded");
}

async function updateQuoteVersionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  quoteVersionId: string,
  nextStatus: Extract<QuoteVersionStatus, "sent" | "rejected" | "expired">,
) {
  const current = await loadQuoteVersion(supabase, leadId, quoteVersionId);
  const currentStatus = current.status as QuoteVersionStatus;
  const nextTimestamp = new Date().toISOString();

  if (!isValidQuoteVersionTransition(currentStatus, nextStatus)) {
    throw new Error(quoteVersionValidationMessage(nextStatus));
  }

  if (nextStatus === "sent" && !canMarkQuoteVersionSent(currentStatus)) {
    throw new Error(quoteVersionValidationMessage(nextStatus));
  }
  if (nextStatus === "rejected" && !canRejectQuoteVersion(currentStatus)) {
    throw new Error(quoteVersionValidationMessage(nextStatus));
  }
  if (nextStatus === "expired" && !canExpireQuoteVersion(currentStatus)) {
    throw new Error(quoteVersionValidationMessage(nextStatus));
  }

  const { data, error } = await supabase
    .from("quote_versions")
    .update({
      status: nextStatus,
      sent_at: nextStatus === "sent" ? nextTimestamp : current.sent_at ?? null,
      rejected_at: nextStatus === "rejected" ? nextTimestamp : null,
      expired_at: nextStatus === "expired" ? nextTimestamp : null,
      accepted_at: null,
    })
    .eq("id", quoteVersionId)
    .eq("lead_id", leadId)
    .eq("status", currentStatus)
    .eq("updated_at", current.updated_at)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("quote_version_status_conflict");

  return current;
}

function quoteVersionActionMessage(
  action: "send" | "reject" | "expire",
  error: unknown,
) {
  const validationTarget = action === "send" ? "sent" : action === "reject" ? "rejected" : "expired";
  if (!(error instanceof Error)) return quoteVersionActionErrorMessage(action);
  if (error.message === quoteVersionValidationMessage(validationTarget)) return error.message;
  if (error.message === "quote_version_status_conflict") return quoteVersionConcurrencyMessage();
  return quoteVersionActionErrorMessage(action);
}

function revalidateLeadQuoteVersionPaths(leadId: string, contactId?: string | null) {
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
  if (contactId) revalidatePath(`/admin/contacts/${contactId}`);
}

export async function createQuoteVersionAction(
  _previous: QuoteVersionActionState,
  formData: FormData,
): Promise<QuoteVersionActionState> {
  const session = await requireAdminRole(["admin", "asesor"]);
  const parsed = createQuoteVersionSchema.safeParse({
    leadId: formData.get("leadId"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    currency: formData.get("currency"),
    totalAmount: formData.get("totalAmount"),
    depositAmount: formData.get("depositAmount"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey"),
    quoteRequestId: formData.get("quoteRequestId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Revisa los datos de la cotización.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const supabase = await createClient();
    const created = await createQuoteVersionDraftRecord(supabase, session.user.id, parsed.data);
    await insertLeadEventBestEffort(parsed.data.leadId, session.user.id, "quote_version_created", {
      title: parsed.data.title,
      versionNumber: created.version_number,
      currency: parsed.data.currency,
      totalAmount: parsed.data.totalAmount ?? null,
      statusLabel: quoteVersionStatusLabel("draft"),
    });
    revalidateLeadQuoteVersionPaths(parsed.data.leadId, created.contact_id);
    return { ok: true, message: `Cotización ${created.version_number} guardada como borrador.`, fieldErrors: {} };
  } catch (error) {
    console.error("[quote-version] create failed", { error });
    return { ok: false, message: quoteVersionActionErrorMessage("create"), fieldErrors: {} };
  }
}

export async function markQuoteVersionSentAction(
  _previous: QuoteVersionActionState,
  formData: FormData,
): Promise<QuoteVersionActionState> {
  const session = await requireAdminRole(["admin", "asesor"]);

  try {
    const leadId = requiredString(formData, "leadId");
    const quoteVersionId = requiredString(formData, "quoteVersionId");
    const supabase = await createClient();
    const current = await updateQuoteVersionStatus(supabase, leadId, quoteVersionId, "sent");
    await insertLeadEventBestEffort(leadId, session.user.id, "quote_version_sent", {
      title: current.title,
      versionNumber: current.version_number,
      statusLabel: quoteVersionStatusLabel("sent"),
    });
    revalidateLeadQuoteVersionPaths(leadId, current.contact_id);
    return { ok: true, message: `La cotización ${current.version_number} ya aparece como enviada.`, fieldErrors: {} };
  } catch (error) {
    console.error("[quote-version] send failed", { error });
    return {
      ok: false,
      message: quoteVersionActionMessage("send", error),
      fieldErrors: {},
    };
  }
}

async function closeQuoteVersionAction(
  sessionUserId: string,
  leadId: string,
  quoteVersionId: string,
  nextStatus: Extract<QuoteVersionStatus, "rejected" | "expired">,
) {
  const supabase = await createClient();
  const current = await updateQuoteVersionStatus(supabase, leadId, quoteVersionId, nextStatus);
  await insertLeadEventBestEffort(leadId, sessionUserId, nextStatus === "rejected" ? "quote_version_rejected" : "quote_version_expired", {
    title: current.title,
    versionNumber: current.version_number,
    statusLabel: quoteVersionStatusLabel(nextStatus),
  });
  revalidateLeadQuoteVersionPaths(leadId, current.contact_id);
  return current;
}

export async function rejectQuoteVersionAction(
  _previous: QuoteVersionActionState,
  formData: FormData,
): Promise<QuoteVersionActionState> {
  const session = await requireAdminRole(["admin", "asesor"]);

  try {
    const leadId = requiredString(formData, "leadId");
    const quoteVersionId = requiredString(formData, "quoteVersionId");
    const current = await closeQuoteVersionAction(session.user.id, leadId, quoteVersionId, "rejected");
    return { ok: true, message: `La cotización ${current.version_number} quedó rechazada.`, fieldErrors: {} };
  } catch (error) {
    console.error("[quote-version] reject failed", { error });
    return {
      ok: false,
      message: quoteVersionActionMessage("reject", error),
      fieldErrors: {},
    };
  }
}

export async function expireQuoteVersionAction(
  _previous: QuoteVersionActionState,
  formData: FormData,
): Promise<QuoteVersionActionState> {
  const session = await requireAdminRole(["admin", "asesor"]);

  try {
    const leadId = requiredString(formData, "leadId");
    const quoteVersionId = requiredString(formData, "quoteVersionId");
    const current = await closeQuoteVersionAction(session.user.id, leadId, quoteVersionId, "expired");
    return { ok: true, message: `La cotización ${current.version_number} quedó expirada.`, fieldErrors: {} };
  } catch (error) {
    console.error("[quote-version] expire failed", { error });
    return {
      ok: false,
      message: quoteVersionActionMessage("expire", error),
      fieldErrors: {},
    };
  }
}

export async function acceptQuoteVersionAction(
  _previous: QuoteVersionActionState,
  formData: FormData,
): Promise<QuoteVersionActionState> {
  await requireAdminRole(["admin", "asesor"]);

  try {
    const leadId = requiredString(formData, "leadId");
    const quoteVersionId = requiredString(formData, "quoteVersionId");
    const supabase = await createClient();
    const current = await loadQuoteVersion(supabase, leadId, quoteVersionId);
    const { data, error } = await supabase.rpc("crm_accept_quote_version", {
      p_lead_id: leadId,
      p_quote_version_id: quoteVersionId,
    });

    if (error || !data?.[0]) throw error ?? new Error("quote_version_accept_failed");

    revalidateLeadQuoteVersionPaths(leadId, current.contact_id);
    return {
      ok: true,
      message: data[0].rejected_version_count > 0
        ? `La cotización ${current.version_number} quedó aceptada y las demás alternativas activas se rechazaron.`
        : `La cotización ${current.version_number} quedó aceptada.`,
      fieldErrors: {},
    };
  } catch (error) {
    console.error("[quote-version] accept failed", { error });
    return { ok: false, message: quoteVersionActionErrorMessage("accept"), fieldErrors: {} };
  }
}
