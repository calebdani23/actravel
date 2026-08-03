"use server";

import { revalidatePath } from "next/cache";
import type {
  BeginQuotePdfUploadInput,
  BeginQuoteRegistrationInput,
  QuoteActionState,
  QuotePdfSagaActionState,
} from "@/app/admin/(protected)/quotes/action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { QUOTE_PDF_BUCKET, QUOTE_PDF_MIME_TYPE, validateDownloadedQuotePdf } from "@/lib/admin/quote-pdf";
import {
  acceptQuoteSchema,
  addQuoteVersionSchema,
  beginQuotePdfUploadSchema,
  beginQuoteRegistrationSchema,
  failQuotePdfIntentSchema,
  quotePdfIntentIdSchema,
  quoteCreateSelectionSchema,
  quoteWorkflowSchema,
  restoreQuoteSchema,
  softDeleteQuoteSchema,
} from "@/lib/admin/quote-validation";
import { logQuoteServerDiagnostic, requireSingleQuoteMutationResult, verifyQuoteCreateScope } from "@/lib/admin/quotes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type QuoteActionName = "registration" | "version" | "upload" | "ready" | "sent" | "accept" | "reject" | "expire" | "cancel" | "delete" | "restore";

type ErrorLike = { code?: string; message?: string };
type RpcRow<Name extends keyof Database["public"]["Functions"]> = Database["public"]["Functions"][Name]["Returns"] extends Array<infer Row> ? Row : never;

function fieldValue(formData: FormData, key: string) {
  return formData.get(key);
}

function optionalFieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function validationFailure(fieldErrors: Record<string, string[] | undefined>, message = "Revisa los campos marcados."): QuoteActionState {
  return {
    ok: false,
    message,
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).map(([field]) => [field, ["Revisa este dato."]])),
  };
}

function safeActionMessage(action: QuoteActionName, error: unknown) {
  const value = error && typeof error === "object" ? error as ErrorLike : {};
  const message = value.message ?? "";
  if (value.code === "40001" || /lock version changed/i.test(message)) return "La cotización cambió mientras trabajabas. Recarga la vista antes de volver a intentar.";
  if (value.code === "42501") return "No tienes permisos para modificar esta cotización o ya no está dentro de tu alcance.";
  if (/Expected accepted quote changed|Another accepted quote already exists/i.test(message)) return "La cotización aceptada de esta oportunidad cambió. Revisa el contexto y confirma de nuevo la sustitución.";
  if (/finalized ready PDF|requires .*PDF|PDF upload/i.test(message)) return "La cotización necesita un PDF canónico válido antes de continuar.";
  if (/request must belong|same contact and opportunity|scope/i.test(message)) return "La selección ya no pertenece al mismo contacto y oportunidad.";
  const messages: Record<QuoteActionName, string> = {
    registration: "No se pudo iniciar el registro de la cotización.",
    version: "No se pudo crear la nueva versión.",
    upload: "No se pudo guardar el PDF. Puedes volver a intentarlo sin perder el borrador.",
    ready: "No se pudo marcar la cotización como lista.",
    sent: "No se pudo marcar la cotización como enviada.",
    accept: "No se pudo aceptar la cotización.",
    reject: "No se pudo rechazar la cotización.",
    expire: "No se pudo expirar la cotización.",
    cancel: "No se pudo cancelar la cotización.",
    delete: "No se pudo eliminar la cotización.",
    restore: "No se pudo restaurar la cotización.",
  };
  return messages[action];
}

function revalidateQuotePaths(input: { quoteId?: string | null; contactId?: string | null; opportunityId?: string | null; documents?: boolean }) {
  revalidatePath("/admin/quotes");
  revalidatePath("/admin/dashboard");
  if (input.quoteId) revalidatePath(`/admin/quotes/${input.quoteId}`);
  if (input.contactId) revalidatePath(`/admin/contacts/${input.contactId}`);
  if (input.opportunityId) revalidatePath(`/admin/leads/${input.opportunityId}`);
  if (input.documents) revalidatePath("/admin/operations/documents");
}

async function quoteScopeForRevalidation(quoteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_quote_detail", { p_quote_id: quoteId });
  if (error) {
    logQuoteServerDiagnostic("action-revalidation-scope", error, { quoteId });
    return { quoteId };
  }
  const row = data?.[0];
  return { quoteId, contactId: row?.contact_id ?? null, opportunityId: row?.opportunity_id ?? null };
}

function deterministicTrustedPdfError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return ["trusted_pdf_mime_invalid", "trusted_pdf_size_invalid", "trusted_pdf_signature_invalid"].includes(message)
    || /Trusted PDF bytes do not match|object metadata or timing does not match|PDF object size metadata is invalid/i.test(message);
}

function trustedPdfIntent(bucket: string, path: string, expectedSizeBytes: number, intentId: string, intentStatus: string) {
  if (bucket !== QUOTE_PDF_BUCKET || !path.toLowerCase().endsWith(".pdf")) throw new Error("trusted_pdf_scope_invalid");
  return { bucket, path, expectedSizeBytes, intentId, intentStatus };
}

async function markRegistrationFailure(intentId: string, reason: "invalid_bytes" | "upload_rejected") {
  const failure = reason === "invalid_bytes"
    ? { code: "invalid_uploaded_pdf", message: "Uploaded object failed trusted PDF validation" }
    : { code: "direct_upload_rejected", message: "Direct PDF upload was rejected before finalization" };
  const supabase = await createClient();
  return supabase.rpc("crm_fail_quote_registration", {
    p_intent_id: intentId,
    p_error_code: failure.code,
    p_error_message: failure.message,
  });
}

async function markVersionUploadFailure(intentId: string, reason: "invalid_bytes" | "upload_rejected") {
  const failure = reason === "invalid_bytes"
    ? { code: "invalid_uploaded_pdf", message: "Uploaded object failed trusted PDF validation" }
    : { code: "direct_upload_rejected", message: "Direct PDF upload was rejected before finalization" };
  const supabase = await createClient();
  return supabase.rpc("crm_fail_quote_pdf_upload", {
    p_intent_id: intentId,
    p_error_code: failure.code,
    p_error_message: failure.message,
    p_idempotency_key: `trusted_failure_${intentId.replaceAll("-", "")}`,
  });
}

async function runWorkflowAction(action: Exclude<QuoteActionName, "registration" | "version" | "upload" | "delete" | "restore">, formData: FormData): Promise<QuoteActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const source = {
    quoteId: fieldValue(formData, "quoteId"),
    quoteVersionId: fieldValue(formData, "quoteVersionId"),
    expectedLockVersion: fieldValue(formData, "expectedLockVersion"),
    idempotencyKey: fieldValue(formData, "idempotencyKey"),
  };
  const parsed = action === "accept"
    ? acceptQuoteSchema.safeParse({
        ...source,
        expectedAcceptedQuoteId: optionalFieldValue(formData, "expectedAcceptedQuoteId"),
        supersedeReason: optionalFieldValue(formData, "supersedeReason"),
      })
    : quoteWorkflowSchema.safeParse(source);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors, "Revisa la versión, la confirmación y vuelve a intentar.");

  try {
    const supabase = await createClient();
    const common = {
      p_quote_id: parsed.data.quoteId,
      p_quote_version_id: parsed.data.quoteVersionId,
      p_expected_lock_version: parsed.data.expectedLockVersion,
      p_idempotency_key: parsed.data.idempotencyKey,
    };
    const result = action === "ready" ? await supabase.rpc("crm_mark_quote_ready", common)
      : action === "sent" ? await supabase.rpc("crm_mark_quote_sent", common)
        : action === "reject" ? await supabase.rpc("crm_reject_quote", common)
          : action === "expire" ? await supabase.rpc("crm_expire_quote", common)
            : action === "cancel" ? await supabase.rpc("crm_cancel_quote", common)
              : await supabase.rpc("crm_accept_quote", {
                  ...common,
                  p_expected_accepted_quote_id: "expectedAcceptedQuoteId" in parsed.data ? parsed.data.expectedAcceptedQuoteId ?? null : null,
                  p_supersede_reason: "supersedeReason" in parsed.data ? parsed.data.supersedeReason ?? null : null,
                });
    if (result.error) throw result.error;
    const row = requireSingleQuoteMutationResult(result.data as RpcRow<"crm_mark_quote_ready">[] | null, `quote_${action}`);
    const scope = await quoteScopeForRevalidation(parsed.data.quoteId);
    revalidateQuotePaths(scope);
    const labels: Record<typeof action, string> = {
      ready: "lista",
      sent: "enviada",
      accept: "aceptada",
      reject: "rechazada",
      expire: "expirada",
      cancel: "cancelada",
    };
    return {
      ok: true,
      message: row.idempotent_replay ? `La cotización ya estaba ${labels[action]}.` : `La cotización quedó ${labels[action]}.`,
      fieldErrors: {},
      quoteId: row.quote_id,
      quoteVersionId: row.quote_version_id,
      lockVersion: row.lock_version,
    };
  } catch (error) {
    logQuoteServerDiagnostic(`action-${action}`, error, { quoteId: parsed.data.quoteId, quoteVersionId: parsed.data.quoteVersionId });
    return { ok: false, message: safeActionMessage(action, error), fieldErrors: {} };
  }
}

export async function beginQuoteRegistrationAction(input: BeginQuoteRegistrationInput): Promise<QuotePdfSagaActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const selection = quoteCreateSelectionSchema.safeParse({
    contactId: input.contactId,
    opportunityId: input.opportunityId,
    originatingRequestId: input.originatingRequestId,
  });
  const quote = beginQuoteRegistrationSchema.safeParse(input);
  if (!selection.success || !quote.success) {
    return validationFailure({
      ...(selection.success ? {} : selection.error.flatten().fieldErrors),
      ...(quote.success ? {} : quote.error.flatten().fieldErrors),
    }, "Selecciona un contacto, una oportunidad y un PDF válido.");
  }

  try {
    const scope = await verifyQuoteCreateScope(selection.data.contactId, quote.data.opportunityId, quote.data.originatingRequestId);
    if (!scope) return { ok: false, message: "El contacto, la oportunidad o la solicitud ya no coinciden.", fieldErrors: { opportunityId: ["Vuelve a seleccionar la oportunidad."] } };
    const supabase = await createClient();
    const result = await supabase.rpc("crm_begin_quote_registration", {
      p_opportunity_id: quote.data.opportunityId,
      p_title: quote.data.title,
      p_summary: quote.data.summary ?? null,
      p_currency: quote.data.currency,
      p_total_amount: quote.data.totalAmount ?? null,
      p_deposit_amount: quote.data.depositAmount ?? null,
      p_valid_until: quote.data.validUntil ?? null,
      p_notes: quote.data.notes ?? null,
      p_originating_request_id: quote.data.originatingRequestId ?? null,
      p_expected_size_bytes: quote.data.expectedSizeBytes,
      p_advisory_sha256: quote.data.advisorySha256,
      p_idempotency_key: quote.data.idempotencyKey,
    });
    if (result.error) throw result.error;
    const row = requireSingleQuoteMutationResult(result.data as RpcRow<"crm_begin_quote_registration">[] | null, "begin_quote_registration");
    const intent = trustedPdfIntent(row.bucket, row.path, row.expected_size_bytes, row.intent_id, row.intent_status);
    if (row.intent_status === "abandoned") return { ok: false, message: "El registro anterior venció. Recarga la página para iniciar uno nuevo.", fieldErrors: {}, intent };
    return { ok: true, message: "Registro reservado. El PDF se cargará directamente a Storage.", fieldErrors: {}, intent };
  } catch (error) {
    logQuoteServerDiagnostic("action-begin-registration", error, { opportunityId: quote.data.opportunityId });
    return { ok: false, message: safeActionMessage("registration", error), fieldErrors: {} };
  }
}

export async function finalizeQuoteRegistrationAction(intentId: string): Promise<QuotePdfSagaActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = quotePdfIntentIdSchema.safeParse(intentId);
  if (!parsed.success) return { ok: false, message: "No se pudo identificar el registro de la cotización.", fieldErrors: {} };
  const supabase = await createClient();
  const lookup = await supabase.rpc("crm_quote_registration_intent", { p_intent_id: parsed.data });
  const registration = lookup.data?.[0];
  if (lookup.error || !registration) {
    if (lookup.error) logQuoteServerDiagnostic("action-read-registration", lookup.error, { intentId: parsed.data });
    return { ok: false, message: "No se pudo recuperar el registro dentro de tu alcance.", fieldErrors: {} };
  }
  const intent = trustedPdfIntent(registration.bucket, registration.path, registration.expected_size_bytes, registration.intent_id, registration.intent_status);
  if (registration.intent_status === "finalized") {
    revalidateQuotePaths({ quoteId: registration.target_quote_id, contactId: registration.contact_id, opportunityId: registration.opportunity_id, documents: true });
    return { ok: true, message: "La cotización ya estaba registrada con su PDF.", fieldErrors: {}, intent, quoteId: registration.target_quote_id, quoteVersionId: registration.target_quote_version_id };
  }
  if (registration.intent_status !== "pending" || !registration.upload_allowed) {
    return { ok: false, message: "El registro ya no acepta finalización. Vuelve a iniciar la carga autorizada.", fieldErrors: {}, intent, cleanupAllowed: registration.cleanup_allowed };
  }

  try {
    if (registration.expected_mime_type !== QUOTE_PDF_MIME_TYPE) throw new Error("trusted_pdf_mime_invalid");
    const admin = createSupabaseAdminClient();
    const download = await admin.storage.from(intent.bucket).download(intent.path);
    if (download.error || !download.data) throw download.error ?? new Error("trusted_pdf_download_unavailable");
    const metadata = await validateDownloadedQuotePdf(download.data, intent.expectedSizeBytes);
    const result = await admin.rpc("crm_register_quote_with_pdf", {
      p_intent_id: registration.intent_id,
      p_verified_size_bytes: metadata.byteSize,
      p_verified_sha256: metadata.sha256,
    });
    if (result.error) throw result.error;
    const row = requireSingleQuoteMutationResult(result.data as RpcRow<"crm_register_quote_with_pdf">[] | null, "register_quote_with_pdf");
    revalidateQuotePaths({ quoteId: row.quote_id, contactId: registration.contact_id, opportunityId: registration.opportunity_id, documents: true });
    return { ok: true, message: row.idempotent_replay ? "La cotización ya estaba registrada con su PDF." : "Cotización y PDF inicial registrados como listos.", fieldErrors: {}, intent: { ...intent, intentStatus: "finalized" }, quoteId: row.quote_id, quoteVersionId: row.quote_version_id, lockVersion: row.lock_version };
  } catch (error) {
    logQuoteServerDiagnostic("action-finalize-registration", error, { intentId: registration.intent_id });
    if (deterministicTrustedPdfError(error)) {
      const failure = await markRegistrationFailure(registration.intent_id, "invalid_bytes");
      if (!failure.error && failure.data?.[0]?.intent_status === "failed") {
        return { ok: false, message: "El objeto cargado no coincide con el PDF validado. Selecciona el archivo correcto y reintenta.", fieldErrors: { pdf: ["El PDF cargado no superó la validación confiable."] }, intent: { ...intent, intentStatus: "failed" }, cleanupAllowed: true };
      }
      if (failure.error) logQuoteServerDiagnostic("action-fail-registration", failure.error, { intentId: registration.intent_id });
    }
    return { ok: false, message: "No se pudo finalizar todavía. El PDF y el registro pendientes se conservaron para reintentar.", fieldErrors: {}, intent };
  }
}

export async function failQuoteRegistrationAction(intentId: string, reason: "invalid_bytes" | "upload_rejected"): Promise<QuotePdfSagaActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = failQuotePdfIntentSchema.safeParse({ intentId, reason });
  if (!parsed.success) return { ok: false, message: "No se pudo identificar la carga fallida.", fieldErrors: {} };
  const result = await markRegistrationFailure(parsed.data.intentId, parsed.data.reason);
  if (result.error) {
    logQuoteServerDiagnostic("action-fail-registration", result.error, { intentId: parsed.data.intentId });
    return { ok: false, message: "La carga pendiente se conservó para un reintento seguro.", fieldErrors: {} };
  }
  const row = result.data?.[0];
  return { ok: false, message: row?.intent_status === "finalized" ? "La cotización ya estaba finalizada." : "La carga inválida se cerró y puede reiniciarse.", fieldErrors: {}, quoteId: row?.intent_status === "finalized" ? row.target_quote_id : undefined, cleanupAllowed: row?.intent_status === "failed" || row?.intent_status === "abandoned" };
}

export async function addQuoteVersionAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = addQuoteVersionSchema.safeParse({
    quoteId: fieldValue(formData, "quoteId"),
    expectedLockVersion: fieldValue(formData, "expectedLockVersion"),
    cloneVersionId: optionalFieldValue(formData, "cloneVersionId"),
    title: optionalFieldValue(formData, "title"),
    summary: optionalFieldValue(formData, "summary"),
    currency: optionalFieldValue(formData, "currency"),
    totalAmount: optionalFieldValue(formData, "totalAmount"),
    depositAmount: optionalFieldValue(formData, "depositAmount"),
    validUntil: optionalFieldValue(formData, "validUntil"),
    notes: optionalFieldValue(formData, "notes"),
    quoteRequestId: optionalFieldValue(formData, "quoteRequestId"),
    idempotencyKey: fieldValue(formData, "idempotencyKey"),
  });
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors, "Revisa los datos de la nueva versión.");
  try {
    const supabase = await createClient();
    const result = await supabase.rpc("crm_add_quote_version", {
      p_quote_id: parsed.data.quoteId,
      p_expected_lock_version: parsed.data.expectedLockVersion,
      p_clone_version_id: parsed.data.cloneVersionId ?? null,
      p_title: parsed.data.title ?? null,
      p_summary: parsed.data.summary ?? null,
      p_currency: parsed.data.currency ?? null,
      p_total_amount: parsed.data.totalAmount ?? null,
      p_deposit_amount: parsed.data.depositAmount ?? null,
      p_valid_until: parsed.data.validUntil ?? null,
      p_notes: parsed.data.notes ?? null,
      p_quote_request_id: parsed.data.quoteRequestId ?? null,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (result.error) throw result.error;
    const row = requireSingleQuoteMutationResult(result.data as RpcRow<"crm_add_quote_version">[] | null, "add_quote_version");
    const scope = await quoteScopeForRevalidation(parsed.data.quoteId);
    revalidateQuotePaths(scope);
    return {
      ok: true,
      message: row.idempotent_replay ? `La versión ${row.version_number} ya existía.` : `Versión ${row.version_number} creada como borrador.`,
      fieldErrors: {},
      quoteId: row.quote_id,
      quoteVersionId: row.quote_version_id,
      lockVersion: row.lock_version,
    };
  } catch (error) {
    logQuoteServerDiagnostic("action-add-version", error, { quoteId: parsed.data.quoteId });
    return { ok: false, message: safeActionMessage("version", error), fieldErrors: {} };
  }
}

export async function beginQuotePdfUploadAction(input: BeginQuotePdfUploadInput): Promise<QuotePdfSagaActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = beginQuotePdfUploadSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors, "No se pudo identificar la cotización para la carga.");

  try {
    const supabase = await createClient();
    const begin = await supabase.rpc("crm_begin_quote_pdf_upload", {
      p_quote_id: parsed.data.quoteId,
      p_quote_version_id: parsed.data.quoteVersionId,
      p_expected_size_bytes: parsed.data.expectedSizeBytes,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (begin.error) throw begin.error;
    const row = requireSingleQuoteMutationResult(begin.data as RpcRow<"crm_begin_quote_pdf_upload">[] | null, "begin_quote_pdf_upload");
    const intent = trustedPdfIntent(row.bucket, row.path, row.expected_size_bytes, row.intent_id, row.intent_status);
    return { ok: true, message: "Carga reservada. El PDF se enviará directamente a Storage.", fieldErrors: {}, intent, quoteId: row.quote_id, quoteVersionId: row.quote_version_id };
  } catch (error) {
    logQuoteServerDiagnostic("action-begin-pdf-upload", error, { quoteId: parsed.data.quoteId, quoteVersionId: parsed.data.quoteVersionId });
    return { ok: false, message: safeActionMessage("upload", error), fieldErrors: {} };
  }
}

export async function finalizeQuotePdfUploadAction(intentId: string): Promise<QuotePdfSagaActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = quotePdfIntentIdSchema.safeParse(intentId);
  if (!parsed.success) return { ok: false, message: "No se pudo identificar la carga del PDF.", fieldErrors: {} };
  const supabase = await createClient();
  const lookup = await supabase.from("quote_upload_intents")
    .select("id, quote_id, quote_version_id, bucket, path, expected_mime_type, expected_size_bytes, status")
    .eq("id", parsed.data)
    .maybeSingle();
  if (lookup.error || !lookup.data || lookup.data.expected_size_bytes === null) {
    if (lookup.error) logQuoteServerDiagnostic("action-read-pdf-upload", lookup.error, { intentId: parsed.data });
    return { ok: false, message: "No se pudo recuperar la carga dentro de tu alcance.", fieldErrors: {} };
  }
  const uploadRow = lookup.data;
  const intent = trustedPdfIntent(uploadRow.bucket, uploadRow.path, uploadRow.expected_size_bytes, uploadRow.id, uploadRow.status);
  if (uploadRow.status === "finalized") {
    const scope = await quoteScopeForRevalidation(uploadRow.quote_id);
    revalidateQuotePaths({ ...scope, documents: true });
    return { ok: true, message: "El PDF canónico ya estaba finalizado.", fieldErrors: {}, intent, quoteId: uploadRow.quote_id, quoteVersionId: uploadRow.quote_version_id };
  }
  if (uploadRow.status !== "pending") return { ok: false, message: "La carga ya no está pendiente. Inicia un reintento autorizado.", fieldErrors: {}, intent, cleanupAllowed: uploadRow.status === "failed" || uploadRow.status === "abandoned" };

  try {
    if (uploadRow.expected_mime_type !== QUOTE_PDF_MIME_TYPE) throw new Error("trusted_pdf_mime_invalid");
    const admin = createSupabaseAdminClient();
    const download = await admin.storage.from(intent.bucket).download(intent.path);
    if (download.error || !download.data) throw download.error ?? new Error("trusted_pdf_download_unavailable");
    const metadata = await validateDownloadedQuotePdf(download.data, intent.expectedSizeBytes);
    const finalize = await admin.rpc("crm_finalize_quote_pdf_upload", {
      p_intent_id: uploadRow.id,
      p_sha256: metadata.sha256,
      p_idempotency_key: `trusted_finalize_${uploadRow.id.replaceAll("-", "")}`,
    });
    if (finalize.error) throw finalize.error;
    const row = requireSingleQuoteMutationResult(finalize.data as RpcRow<"crm_finalize_quote_pdf_upload">[] | null, "finalize_quote_pdf_upload");
    const scope = await quoteScopeForRevalidation(row.quote_id);
    revalidateQuotePaths({ ...scope, documents: true });
    return { ok: true, message: row.idempotent_replay ? "El PDF canónico ya estaba finalizado." : "PDF validado y finalizado. La versión ya puede avanzar.", fieldErrors: {}, intent: { ...intent, intentStatus: "finalized" }, quoteId: row.quote_id, quoteVersionId: row.quote_version_id, lockVersion: row.lock_version };
  } catch (error) {
    logQuoteServerDiagnostic("action-finalize-pdf-upload", error, { quoteId: uploadRow.quote_id, quoteVersionId: uploadRow.quote_version_id, intentId: uploadRow.id });
    if (deterministicTrustedPdfError(error)) {
      const failure = await markVersionUploadFailure(uploadRow.id, "invalid_bytes");
      if (!failure.error && failure.data?.[0]?.intent_status === "failed") {
        return { ok: false, message: "El objeto cargado no superó la validación confiable. Selecciona el PDF correcto y reintenta.", fieldErrors: { pdf: ["El PDF cargado no es válido."] }, intent: { ...intent, intentStatus: "failed" }, cleanupAllowed: true };
      }
      if (failure.error) logQuoteServerDiagnostic("action-fail-pdf-upload", failure.error, { intentId: uploadRow.id });
    }
    return { ok: false, message: "No se pudo finalizar todavía. El PDF pendiente se conservó para reintentar.", fieldErrors: {}, intent };
  }
}

export async function failQuotePdfUploadAction(intentId: string, reason: "invalid_bytes" | "upload_rejected"): Promise<QuotePdfSagaActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = failQuotePdfIntentSchema.safeParse({ intentId, reason });
  if (!parsed.success) return { ok: false, message: "No se pudo identificar la carga fallida.", fieldErrors: {} };
  const result = await markVersionUploadFailure(parsed.data.intentId, parsed.data.reason);
  if (result.error) {
    logQuoteServerDiagnostic("action-fail-pdf-upload", result.error, { intentId: parsed.data.intentId });
    return { ok: false, message: "La carga pendiente se conservó para un reintento seguro.", fieldErrors: {} };
  }
  const row = result.data?.[0];
  return { ok: false, message: row?.intent_status === "finalized" ? "El PDF ya estaba finalizado." : "La carga inválida se cerró y puede reiniciarse.", fieldErrors: {}, quoteId: row?.quote_id, quoteVersionId: row?.quote_version_id, cleanupAllowed: row?.intent_status === "failed" || row?.intent_status === "abandoned" };
}

export async function markQuoteReadyAction(_previous: QuoteActionState, formData: FormData) {
  return runWorkflowAction("ready", formData);
}

export async function markQuoteSentAction(_previous: QuoteActionState, formData: FormData) {
  return runWorkflowAction("sent", formData);
}

export async function acceptQuoteAction(_previous: QuoteActionState, formData: FormData) {
  return runWorkflowAction("accept", formData);
}

export async function rejectQuoteAction(_previous: QuoteActionState, formData: FormData) {
  return runWorkflowAction("reject", formData);
}

export async function expireQuoteAction(_previous: QuoteActionState, formData: FormData) {
  return runWorkflowAction("expire", formData);
}

export async function cancelQuoteAction(_previous: QuoteActionState, formData: FormData) {
  return runWorkflowAction("cancel", formData);
}

export async function softDeleteQuoteAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = softDeleteQuoteSchema.safeParse({
    quoteId: fieldValue(formData, "quoteId"),
    expectedLockVersion: fieldValue(formData, "expectedLockVersion"),
    confirmation: fieldValue(formData, "confirmation"),
    reason: fieldValue(formData, "reason"),
    idempotencyKey: fieldValue(formData, "idempotencyKey"),
  });
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors, "Escribe la confirmación exacta e indica el motivo.");
  try {
    const scope = await quoteScopeForRevalidation(parsed.data.quoteId);
    const supabase = await createClient();
    const result = await supabase.rpc("crm_soft_delete_quote", {
      p_quote_id: parsed.data.quoteId,
      p_expected_lock_version: parsed.data.expectedLockVersion,
      p_confirmation: parsed.data.confirmation,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (result.error) throw result.error;
    const row = requireSingleQuoteMutationResult(result.data as RpcRow<"crm_soft_delete_quote">[] | null, "soft_delete_quote");
    revalidateQuotePaths(scope);
    return { ok: true, message: row.idempotent_replay ? "La cotización ya estaba eliminada." : "Cotización eliminada de forma reversible.", fieldErrors: {}, quoteId: row.quote_id, lockVersion: row.lock_version };
  } catch (error) {
    logQuoteServerDiagnostic("action-soft-delete", error, { quoteId: parsed.data.quoteId });
    return { ok: false, message: safeActionMessage("delete", error), fieldErrors: {} };
  }
}

export async function restoreQuoteAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  await requireAdminRole(["admin", "asesor"]);
  const parsed = restoreQuoteSchema.safeParse({
    quoteId: fieldValue(formData, "quoteId"),
    expectedLockVersion: fieldValue(formData, "expectedLockVersion"),
    confirmation: fieldValue(formData, "confirmation"),
    idempotencyKey: fieldValue(formData, "idempotencyKey"),
  });
  if (!parsed.success) return validationFailure(parsed.error.flatten().fieldErrors, "Escribe la confirmación exacta para restaurar.");
  try {
    const scope = await quoteScopeForRevalidation(parsed.data.quoteId);
    const supabase = await createClient();
    const result = await supabase.rpc("crm_restore_quote", {
      p_quote_id: parsed.data.quoteId,
      p_expected_lock_version: parsed.data.expectedLockVersion,
      p_confirmation: parsed.data.confirmation,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (result.error) throw result.error;
    const row = requireSingleQuoteMutationResult(result.data as RpcRow<"crm_restore_quote">[] | null, "restore_quote");
    revalidateQuotePaths(scope);
    return { ok: true, message: row.idempotent_replay ? "La cotización ya estaba restaurada." : "Cotización restaurada.", fieldErrors: {}, quoteId: row.quote_id, lockVersion: row.lock_version };
  } catch (error) {
    logQuoteServerDiagnostic("action-restore", error, { quoteId: parsed.data.quoteId });
    return { ok: false, message: safeActionMessage("restore", error), fieldErrors: {} };
  }
}
