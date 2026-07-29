"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type BulkCrmActionState = { ok: boolean; message: string; jobId?: string };
const UUID = /^[0-9a-f-]{8,}$/i;
const CONTACT_UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const MAX_BULK_IDS = 500;

function ids(formData: FormData) {
  const raw = formData.get("ids");
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? Array.from(new Set(parsed.filter((id): id is string => typeof id === "string" && UUID.test(id)))) : [];
  } catch { return []; }
}

function confirmation(formData: FormData, count: number, restore = false) {
  const value = formData.get("confirmation");
  if (typeof value !== "string") return false;
  return restore ? value === "RESTAURAR" : value === (count === 1 ? "ELIMINAR" : `ELIMINAR ${count}`);
}

function withField(formData: FormData, name: string, value: string) {
  const next = new FormData();
  formData.forEach((entry, key) => next.append(key, entry));
  next.set(name, value);
  return next;
}

type BulkRpcName = keyof Pick<Database["public"]["Functions"], "crm_bulk_block_contacts" | "crm_bulk_unblock_contacts" | "crm_bulk_update_contact_lifecycle" | "crm_bulk_delete_restore_contacts" | "crm_bulk_feature_opportunities" | "crm_bulk_update_opportunity_status" | "crm_bulk_delete_restore_opportunities" | "crm_bulk_archive_opportunities">;

function contactId(formData: FormData) {
  const value = formData.get("contactId");
  return typeof value === "string" && CONTACT_UUID.test(value) ? value : null;
}

async function runRpc(name: BulkRpcName, args: Record<string, unknown>, revalidateContactId?: string | null): Promise<BulkCrmActionState> {
  const supabase = await createClient();
  const call = name === "crm_bulk_block_contacts" ? supabase.rpc(name, { p_contact_ids: args.p_contact_ids as string[] })
    : name === "crm_bulk_unblock_contacts" ? supabase.rpc(name, { p_contact_ids: args.p_contact_ids as string[] })
      : name === "crm_bulk_update_contact_lifecycle" ? supabase.rpc(name, { p_contact_ids: args.p_contact_ids as string[], p_lifecycle_status: args.p_lifecycle_status as string })
        : name === "crm_bulk_delete_restore_contacts" ? supabase.rpc(name, { p_contact_ids: args.p_contact_ids as string[], p_restore: args.p_restore as boolean, p_confirmation: args.p_confirmation as string })
          : name === "crm_bulk_feature_opportunities" ? supabase.rpc(name, { p_opportunity_ids: args.p_opportunity_ids as string[], p_featured: args.p_featured as boolean })
            : name === "crm_bulk_update_opportunity_status" ? supabase.rpc(name, { p_opportunity_ids: args.p_opportunity_ids as string[], p_status_id: args.p_status_id as string })
              : name === "crm_bulk_delete_restore_opportunities" ? supabase.rpc(name, { p_opportunity_ids: args.p_opportunity_ids as string[], p_restore: args.p_restore as boolean, p_confirmation: args.p_confirmation as string })
                : supabase.rpc(name, { p_opportunity_ids: args.p_opportunity_ids as string[], p_archived: args.p_archived as boolean });
  const { data, error } = await call;
  if (error) return { ok: false, message: "No se pudo completar la operación. La selección se conserva para revisar el bloqueo." };
  const result = Array.isArray(data) ? data[0] as { job_id?: string; success_count?: number; failure_count?: number } | undefined : undefined;
  if (!result) return { ok: false, message: "La operación no devolvió un resultado verificable." };
  revalidatePath("/admin/leads");
  revalidatePath("/admin/contacts");
  revalidatePath("/admin/dashboard");
  if (revalidateContactId) revalidatePath(`/admin/contacts/${revalidateContactId}`);
  return result.failure_count ? { ok: false, message: `Se aplicaron ${result.success_count ?? 0} cambios y ${result.failure_count} quedaron pendientes por validación.`, jobId: result.job_id } : { ok: true, message: `Operación completada para ${result.success_count ?? 0} registro(s).`, jobId: result.job_id };
}

async function execute(formData: FormData, operation: BulkRpcName, restore = false): Promise<BulkCrmActionState> {
  await requireAdminRole(["admin"]);
  const selected = ids(formData);
  if (!selected.length) return { ok: false, message: "Selecciona al menos un registro." };
  if (selected.length > MAX_BULK_IDS) return { ok: false, message: `Selecciona como máximo ${MAX_BULK_IDS} registros por operación. La selección no fue modificada.` };
  if ((operation.includes("delete") || restore) && !confirmation(formData, selected.length, restore)) return { ok: false, message: restore ? "Escribe RESTAURAR para confirmar." : `Escribe ${selected.length === 1 ? "ELIMINAR" : `ELIMINAR ${selected.length}`} para confirmar.` };
  const args: Record<string, unknown> = operation.includes("contact") ? { p_contact_ids: selected } : { p_opportunity_ids: selected };
  if (operation === "crm_bulk_feature_opportunities") args.p_featured = formData.get("featured") !== "false";
  if (operation === "crm_bulk_archive_opportunities") args.p_archived = formData.get("archived") !== "false";
  if (operation.includes("delete_restore")) { args.p_restore = restore; args.p_confirmation = restore ? "RESTORE CONTACTS" : "DELETE CONTACTS"; if (!operation.includes("contact")) args.p_confirmation = restore ? "RESTORE OPPORTUNITIES" : "DELETE OPPORTUNITIES"; }
  return runRpc(operation, args, contactId(formData));
}

export async function blockContacts(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_block_contacts"); }
export async function unblockContacts(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_unblock_contacts"); }
export async function deleteRestoreContacts(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_delete_restore_contacts", formData.get("restore") === "true"); }
export async function restoreContacts(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_delete_restore_contacts", true); }
export async function featureOpportunities(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_feature_opportunities"); }
export async function unfeatureOpportunities(_state: BulkCrmActionState, formData: FormData) { return execute(withField(formData, "featured", "false"), "crm_bulk_feature_opportunities"); }
export async function archiveOpportunities(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_archive_opportunities"); }
export async function unarchiveOpportunities(_state: BulkCrmActionState, formData: FormData) { return execute(withField(formData, "archived", "false"), "crm_bulk_archive_opportunities"); }
export async function deleteRestoreOpportunities(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_delete_restore_opportunities", formData.get("restore") === "true"); }

// Explicit names prevent the detail-page soft-delete path from being confused
// with the permanent test-data purge action.
export async function softDeleteOpportunityAction(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_delete_restore_opportunities", false); }
export async function restoreOpportunityAction(_state: BulkCrmActionState, formData: FormData) { return execute(formData, "crm_bulk_delete_restore_opportunities", true); }

export async function updateContactLifecycle(_state: BulkCrmActionState, formData: FormData) {
  await requireAdminRole(["admin"]);
  const selected = ids(formData);
  if (selected.length > MAX_BULK_IDS) return { ok: false, message: `Selecciona como máximo ${MAX_BULK_IDS} registros por operación. La selección no fue modificada.` };
  const lifecycle = formData.get("lifecycle");
  if (!selected.length || typeof lifecycle !== "string") return { ok: false, message: "Selecciona registros y un ciclo de vida." };
  return runRpc("crm_bulk_update_contact_lifecycle", { p_contact_ids: selected, p_lifecycle_status: lifecycle }, contactId(formData));
}

export async function updateOpportunityStatus(_state: BulkCrmActionState, formData: FormData) {
  await requireAdminRole(["admin"]);
  const selected = ids(formData);
  if (selected.length > MAX_BULK_IDS) return { ok: false, message: `Selecciona como máximo ${MAX_BULK_IDS} registros por operación. La selección no fue modificada.` };
  const statusId = formData.get("statusId");
  if (!selected.length || typeof statusId !== "string") return { ok: false, message: "Selecciona registros y un estado." };
  return runRpc("crm_bulk_update_opportunity_status", { p_opportunity_ids: selected, p_status_id: statusId }, contactId(formData));
}
