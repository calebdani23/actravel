"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadDeleteActionState } from "./lead-delete-action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { contactDeletionBlockedMessage, formatContactDeletionBlockerList, formatLeadDeletionBlockerList, leadDeleteBlockerCountsFromJson, leadDeletionBlockedMessage, leadDeletionNotFoundMessage, safeLeadListQueryString, sanitizeLeadDeleteActionError } from "@/lib/admin/lead-delete";
import { createClient } from "@/lib/supabase/server";
import { TEST_DATA_PURGE_CONFIRMATION } from "@/lib/admin/leads";
import type { Json } from "@/lib/supabase/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

function optionalChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function optionalContactId(formData: FormData) {
  const value = formData.get("contactId");
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function revalidateLeadWorkspace(leadId: string, contactId?: string | null) {
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
  if (contactId) revalidatePath(`/admin/contacts/${contactId}`);
}

async function insertLeadEvent(leadId: string, actorId: string, eventType: string, payload: Json) {
  const supabase = await createClient();
  await supabase.from("lead_events").insert({ lead_id: leadId, actor_id: actorId, event_type: eventType, payload });
}

export async function updateLeadStatusAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "asesor"]);
  const leadId = requiredString(formData, "leadId");
  const statusId = requiredString(formData, "statusId");
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update({ status_id: statusId }).eq("id", leadId).select("contact_id").maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "lead_status_update_failed");
  await insertLeadEvent(leadId, session.user.id, "status_changed", { statusId });
  revalidateLeadWorkspace(leadId, data.contact_id);
}

export async function assignLeadAction(formData: FormData) {
  const session = await requireAdminRole(["admin"]);
  const leadId = requiredString(formData, "leadId");
  const advisorId = formData.get("advisorId");
  const assignedTo = typeof advisorId === "string" && advisorId ? advisorId : null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update({ assigned_to: assignedTo }).eq("id", leadId).select("contact_id").maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "lead_assignment_failed");
  await insertLeadEvent(leadId, session.user.id, "assigned", { assignedTo });
  revalidateLeadWorkspace(leadId, data.contact_id);
}

export async function addLeadNoteAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "asesor"]);
  const leadId = requiredString(formData, "leadId");
  const body = requiredString(formData, "body");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_notes").insert({ lead_id: leadId, author_id: session.user.id, body, is_internal: true });
  if (error) throw new Error(error.message);
  await insertLeadEvent(leadId, session.user.id, "note_added", { internal: true });
  revalidateLeadWorkspace(leadId, optionalContactId(formData));
}

export async function registerFollowUpAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "asesor"]);
  const leadId = requiredString(formData, "leadId");
  const body = requiredString(formData, "followUpBody");
  const followUpAtValue = formData.get("followUpAt");
  let followUpAt: string | null = null;

  if (typeof followUpAtValue === "string" && followUpAtValue.trim()) {
    const parsed = new Date(followUpAtValue);
    if (Number.isNaN(parsed.getTime())) throw new Error("followUpAt must be a valid date/time");
    followUpAt = parsed.toISOString();
  }

  const supabase = await createClient();
  const { error: noteError } = await supabase.from("lead_notes").insert({ lead_id: leadId, author_id: session.user.id, body, is_internal: true });
  if (noteError) throw new Error(noteError.message);
  await insertLeadEvent(leadId, session.user.id, "follow_up_registered", { followUpAt, hasNote: true });
  revalidateLeadWorkspace(leadId, optionalContactId(formData));
}

export async function deleteLeadAction(
  _previous: LeadDeleteActionState,
  formData: FormData,
): Promise<LeadDeleteActionState> {
  await requireAdminRole(["admin"]);

  let leadId: string;
  try {
    leadId = requiredString(formData, "leadId");
  } catch {
    return { contactDeleteRequested: false, ok: false, message: leadDeletionNotFoundMessage(), blockerMessages: [] };
  }

  const returnToQuery = safeLeadListQueryString(formData.get("returnToQuery"));
  const deleteOrphanContact = optionalChecked(formData, "deleteOrphanContact");
  if (formData.get("confirmation") !== TEST_DATA_PURGE_CONFIRMATION) {
    return { contactDeleteRequested: deleteOrphanContact, ok: false, message: `Escribe ${TEST_DATA_PURGE_CONFIRMATION} para confirmar la purga permanente.`, blockerMessages: [] };
  }
  let redirectTarget: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("crm_delete_lead_guarded", { p_lead_id: leadId, p_delete_orphan_contact: deleteOrphanContact, p_confirmation: TEST_DATA_PURGE_CONFIRMATION });
    if (error) throw error;

    const result = data?.[0];
    if (!result) {
      return { contactDeleteRequested: deleteOrphanContact, ok: false, message: leadDeletionNotFoundMessage(), blockerMessages: [] };
    }

    const counts = leadDeleteBlockerCountsFromJson(result.blocker_counts);
    if (result.deleted) {
      revalidatePath("/admin/leads");
      revalidatePath("/admin/dashboard");
      redirectTarget = `/admin/leads${returnToQuery}`;
    } else if (result.blocked) {
      const leadBlockers = formatLeadDeletionBlockerList(counts.lead);
      const contactBlockers = formatContactDeletionBlockerList(counts.contact);
      return {
        contactDeleteRequested: deleteOrphanContact,
        ok: false,
        message: leadBlockers.length ? leadDeletionBlockedMessage(counts.lead) : contactDeletionBlockedMessage(counts.contact),
        blockerMessages: leadBlockers.length
          ? leadBlockers
          : contactBlockers.map((item) => `Contacto: ${item}`),
      };
    }
  } catch (error) {
    console.error("[lead-delete] delete failed", { error, leadId });
    return { contactDeleteRequested: deleteOrphanContact, ok: false, message: sanitizeLeadDeleteActionError(error), blockerMessages: [] };
  }

  if (redirectTarget) redirect(redirectTarget);
  return { contactDeleteRequested: deleteOrphanContact, ok: false, message: leadDeletionNotFoundMessage(), blockerMessages: [] };
}
