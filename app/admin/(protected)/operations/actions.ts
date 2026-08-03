"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { requiredTextFromOperationFormData, textFromOperationFormData, throwOperationActionError } from "@/lib/admin/operation-action-errors";
import { optionalFile, removeStoredObject, removeStoredObjects, requiredFile, sameStorageObject, uploadPrivateFile } from "@/lib/admin/storage-uploads";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return textFromOperationFormData(formData, key);
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : Number(value);
}

function revalidateOperations(quoteId?: string | null) {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/operations/bookings");
  revalidatePath("/admin/operations/documents");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/quotes");
  if (quoteId) revalidatePath(`/admin/quotes/${quoteId}`);
}

async function getExistingPaymentFile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("id, proof_bucket, proof_path, accepted_quote_version:quote_versions!payments_accepted_quote_version_id_fkey(quote_id)").eq("id", id).maybeSingle();
  if (error) throwOperationActionError("payment-load-proof", error);
  const accepted = data?.accepted_quote_version;
  const quoteVersion = Array.isArray(accepted) ? accepted[0] : accepted;
  return { supabase, file: data ? { bucket: data.proof_bucket, path: data.proof_path } : null, quoteId: quoteVersion?.quote_id ?? null };
}

async function getExistingDocumentFile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select("id, bucket, path, quote_version_id").eq("id", id).maybeSingle();
  if (error) throwOperationActionError("document-load-file", error);
  return { supabase, file: data ? { bucket: data.bucket, path: data.path } : null, quoteVersionId: data?.quote_version_id ?? null };
}

async function getBookingDocumentFiles(id: string) {
  const supabase = await createClient();
  const [documents, booking] = await Promise.all([
    supabase.from("documents").select("bucket, path").eq("booking_id", id),
    supabase.from("bookings").select("accepted_quote_version:quote_versions!bookings_accepted_quote_version_id_fkey(quote_id)").eq("id", id).maybeSingle(),
  ]);
  if (documents.error || booking.error) throwOperationActionError("booking-load-documents", documents.error ?? booking.error);
  const accepted = booking.data?.accepted_quote_version;
  const quoteVersion = Array.isArray(accepted) ? accepted[0] : accepted;
  return {
    supabase,
    files: (documents.data ?? []).map((file) => ({ bucket: file.bucket, path: file.path })),
    quoteId: quoteVersion?.quote_id ?? null,
  };
}

export async function upsertPaymentAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "finanzas"]);
  const id = text(formData, "id");
  const existing = id ? await getExistingPaymentFile(id) : null;
  const supabase = existing?.supabase ?? await createClient();
  const status = text(formData, "status") ?? "pending";
  const isVerified = status === "verified";
  const proofFile = optionalFile(formData, "proof_file");
  const upload = proofFile
    ? await uploadPrivateFile(supabase, "payment-proofs", proofFile, {
        bookingId: text(formData, "booking_id"),
        leadId: text(formData, "lead_id"),
        contactId: text(formData, "contact_id"),
        title: `comprobante-${text(formData, "amount") ?? "pago"}`,
      })
    : null;
  const payload = {
    booking_id: text(formData, "booking_id"),
    lead_id: text(formData, "lead_id"),
    contact_id: text(formData, "contact_id"),
    method_id: text(formData, "method_id"),
    amount: numberValue(formData, "amount") ?? 0,
    currency: text(formData, "currency") ?? "MXN",
    status,
    payment_type: text(formData, "payment_type") ?? "deposit",
    paid_at: text(formData, "paid_at"),
    verified_by: isVerified ? session.user.id : null,
    verified_at: isVerified ? new Date().toISOString() : null,
    notes: text(formData, "notes"),
    accepted_quote_version_id: text(formData, "accepted_quote_version_id"),
    ...(upload ? { proof_bucket: upload.bucket, proof_path: upload.path } : {}),
  };
  const { error } = id ? await supabase.from("payments").update(payload).eq("id", id) : await supabase.from("payments").insert(payload);
  if (error) {
    if (upload) await upload.cleanup();
    throwOperationActionError("payment-save", error);
  }
  if (upload && existing?.file && !sameStorageObject(existing.file, upload)) {
    try {
      await removeStoredObject(supabase, existing.file);
    } catch (cleanupError) {
      console.error("[payments] replaced proof cleanup failed", cleanupError);
    }
  }
  revalidateOperations(text(formData, "quote_id"));
}

export async function deletePaymentAction(formData: FormData) {
  await requireAdminRole(["admin", "finanzas"]);
  const id = requiredTextFromOperationFormData(formData, "id", "payment-delete");
  const { supabase, file, quoteId } = await getExistingPaymentFile(id);
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throwOperationActionError("payment-delete", error);
  if (file) {
    try {
      await removeStoredObject(supabase, file);
    } catch (cleanupError) {
      console.error("[payments] deleted proof cleanup failed", cleanupError);
    }
  }
  revalidateOperations(quoteId);
}

export async function upsertBookingAction(formData: FormData) {
  await requireAdminRole(["admin", "operaciones"]);
  const supabase = await createClient();
  const id = text(formData, "id");
  const payload = {
    lead_id: text(formData, "lead_id"),
    contact_id: requiredTextFromOperationFormData(formData, "contact_id", "booking-save"),
    assigned_to: text(formData, "assigned_to"),
    booking_code: text(formData, "booking_code"),
    status: text(formData, "status") ?? "draft",
    destination_id: text(formData, "destination_id"),
    service_id: text(formData, "service_id"),
    starts_on: text(formData, "starts_on"),
    ends_on: text(formData, "ends_on"),
    travelers_count: numberValue(formData, "travelers_count") ?? 1,
    total_mxn: numberValue(formData, "total_mxn"),
    total_usd: numberValue(formData, "total_usd"),
    currency: text(formData, "currency") ?? "MXN",
    notes: text(formData, "notes"),
    accepted_quote_version_id: text(formData, "accepted_quote_version_id"),
  };
  const { error } = id ? await supabase.from("bookings").update(payload).eq("id", id) : await supabase.from("bookings").insert(payload);
  if (error) throwOperationActionError("booking-save", error);
  revalidateOperations(text(formData, "quote_id"));
}

export async function deleteBookingAction(formData: FormData) {
  await requireAdminRole(["admin", "operaciones"]);
  const id = requiredTextFromOperationFormData(formData, "id", "booking-delete");
  const { supabase, files, quoteId } = await getBookingDocumentFiles(id);
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throwOperationActionError("booking-delete", error);
  if (files.length) {
    try {
      await removeStoredObjects(supabase, files);
    } catch (cleanupError) {
      console.error("[bookings] deleted documents cleanup failed", cleanupError);
    }
  }
  revalidateOperations(quoteId);
}

export async function upsertDocumentAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "operaciones"]);
  const id = text(formData, "id");
  const existing = id ? await getExistingDocumentFile(id) : null;
  if (existing?.quoteVersionId) throwOperationActionError("document-quote-linked", new Error("quote-linked document mutation rejected"));
  const supabase = existing?.supabase ?? await createClient();
  const title = requiredTextFromOperationFormData(formData, "title", "document-save");
  const documentFile = id ? optionalFile(formData, "document_file") : requiredFile(formData, "document_file", "Selecciona un archivo para crear el documento.");
  const upload = documentFile
    ? await uploadPrivateFile(supabase, "documents", documentFile, {
        bookingId: text(formData, "booking_id"),
        leadId: text(formData, "lead_id"),
        contactId: text(formData, "contact_id"),
        title,
      })
    : null;
  const payload = {
    booking_id: text(formData, "booking_id"),
    lead_id: text(formData, "lead_id"),
    contact_id: text(formData, "contact_id"),
    uploaded_by: session.user.id,
    document_type: text(formData, "document_type") ?? "other",
    title,
    status: text(formData, "status") ?? "draft",
    ...(upload ? { bucket: upload.bucket, path: upload.path } : {}),
  };
  const { error } = id ? await supabase.from("documents").update(payload).eq("id", id) : await supabase.from("documents").insert(payload);
  if (error) {
    if (upload) await upload.cleanup();
    throwOperationActionError("document-save", error);
  }
  if (upload && existing?.file && !sameStorageObject(existing.file, upload)) {
    try {
      await removeStoredObject(supabase, existing.file);
    } catch (cleanupError) {
      console.error("[documents] replaced file cleanup failed", cleanupError);
    }
  }
  revalidateOperations();
}

export async function deleteDocumentAction(formData: FormData) {
  await requireAdminRole(["admin", "operaciones"]);
  const id = requiredTextFromOperationFormData(formData, "id", "document-delete");
  const existing = await getExistingDocumentFile(id);
  if (existing.quoteVersionId) throwOperationActionError("document-quote-linked", new Error("quote-linked document deletion rejected"));
  const { error } = await existing.supabase.from("documents").delete().eq("id", id);
  if (error) throwOperationActionError("document-delete", error);
  if (existing.file) {
    try {
      await removeStoredObject(existing.supabase, existing.file);
    } catch (cleanupError) {
      console.error("[documents] deleted file cleanup failed", cleanupError);
    }
  }
  revalidateOperations();
}
