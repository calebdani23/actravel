"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
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
  const { error } = await supabase.from("leads").update({ status_id: statusId }).eq("id", leadId);
  if (error) throw new Error(error.message);
  await insertLeadEvent(leadId, session.user.id, "status_changed", { statusId });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
}

export async function assignLeadAction(formData: FormData) {
  const session = await requireAdminRole(["admin"]);
  const leadId = requiredString(formData, "leadId");
  const advisorId = formData.get("advisorId");
  const assignedTo = typeof advisorId === "string" && advisorId ? advisorId : null;
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ assigned_to: assignedTo }).eq("id", leadId);
  if (error) throw new Error(error.message);
  await insertLeadEvent(leadId, session.user.id, "assigned", { assignedTo });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
}

export async function addLeadNoteAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "asesor"]);
  const leadId = requiredString(formData, "leadId");
  const body = requiredString(formData, "body");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_notes").insert({ lead_id: leadId, author_id: session.user.id, body, is_internal: true });
  if (error) throw new Error(error.message);
  await insertLeadEvent(leadId, session.user.id, "note_added", { internal: true });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
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
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
}
