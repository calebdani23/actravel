"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { optionalFile, removeStoredObject, removeStoredObjects, requiredFile, sameStorageObject, uploadPrivateFile } from "@/lib/admin/storage-uploads";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${key} is required`);
  return result || null;
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : Number(value);
}

function revalidateOperations() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/operations/bookings");
  revalidatePath("/admin/operations/documents");
  revalidatePath("/admin/dashboard");
}

async function getExistingPaymentFile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("id, proof_bucket, proof_path").eq("id", id).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el comprobante actual: ${error.message}`);
  return { supabase, file: data ? { bucket: data.proof_bucket, path: data.proof_path } : null };
}

async function getExistingDocumentFile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select("id, bucket, path").eq("id", id).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el documento actual: ${error.message}`);
  return { supabase, file: data ? { bucket: data.bucket, path: data.path } : null };
}

async function getBookingDocumentFiles(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select("bucket, path").eq("booking_id", id);
  if (error) throw new Error(`No se pudieron cargar los documentos de la reserva: ${error.message}`);
  return {
    supabase,
    files: (data ?? []).map((file) => ({ bucket: file.bucket, path: file.path })),
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
    ...(upload ? { proof_bucket: upload.bucket, proof_path: upload.path } : {}),
  };
  const { error } = id ? await supabase.from("payments").update(payload).eq("id", id) : await supabase.from("payments").insert(payload);
  if (error) {
    if (upload) await upload.cleanup();
    throw new Error(`No se pudo guardar el pago: ${error.message}`);
  }
  if (upload && existing?.file && !sameStorageObject(existing.file, upload)) {
    try {
      await removeStoredObject(supabase, existing.file);
    } catch (cleanupError) {
      console.error("[payments] replaced proof cleanup failed", cleanupError);
    }
  }
  revalidateOperations();
}

export async function deletePaymentAction(formData: FormData) {
  await requireAdminRole(["admin", "finanzas"]);
  const id = text(formData, "id", true)!;
  const { supabase, file } = await getExistingPaymentFile(id);
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (file) {
    try {
      await removeStoredObject(supabase, file);
    } catch (cleanupError) {
      console.error("[payments] deleted proof cleanup failed", cleanupError);
    }
  }
  revalidateOperations();
}

export async function upsertBookingAction(formData: FormData) {
  await requireAdminRole(["admin", "operaciones"]);
  const supabase = await createClient();
  const id = text(formData, "id");
  const payload = {
    lead_id: text(formData, "lead_id"),
    contact_id: text(formData, "contact_id", true),
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
  };
  const { error } = id ? await supabase.from("bookings").update(payload).eq("id", id) : await supabase.from("bookings").insert(payload);
  if (error) throw new Error(error.message);
  revalidateOperations();
}

export async function deleteBookingAction(formData: FormData) {
  await requireAdminRole(["admin", "operaciones"]);
  const id = text(formData, "id", true);
  const { supabase, files } = await getBookingDocumentFiles(id!);
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (files.length) {
    try {
      await removeStoredObjects(supabase, files);
    } catch (cleanupError) {
      console.error("[bookings] deleted documents cleanup failed", cleanupError);
    }
  }
  revalidateOperations();
}

export async function upsertDocumentAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "operaciones"]);
  const id = text(formData, "id");
  const existing = id ? await getExistingDocumentFile(id) : null;
  const supabase = existing?.supabase ?? await createClient();
  const title = text(formData, "title", true);
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
    throw new Error(`No se pudo guardar el documento: ${error.message}`);
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
  const id = text(formData, "id", true)!;
  const { supabase, file } = await getExistingDocumentFile(id);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (file) {
    try {
      await removeStoredObject(supabase, file);
    } catch (cleanupError) {
      console.error("[documents] deleted file cleanup failed", cleanupError);
    }
  }
  revalidateOperations();
}
