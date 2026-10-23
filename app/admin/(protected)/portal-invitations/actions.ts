"use server";
import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function issueInvitationAction(_previous: { message: string; link: string | null }, form: FormData) {
  await requireAdminRole(["admin"]);
  const contactId = form.get("contactId");
  if (typeof contactId !== "string" || !/^[a-f0-9-]{36}$/.test(contactId)) return { message: "Select a valid Contact ID.", link: null };
  try {
    const { data, error } = await (await createClient()).rpc("issue_portal_invitation", { p_contact_id: contactId });
    if (error || data?.ok !== true || typeof data.token !== "string" || !/^[a-f0-9]{64}$/.test(data.token))
      return { message: "Invitation unavailable. Check the Contact, unique email, account status, and staff separation.", link: null };
    revalidatePath("/admin/portal-invitations");
    return { message: "Invitation created for 72 hours. Share this link securely with the selected Contact; it is shown only now.", link: `/mis-viajes/acceso#invite=${data.token}` };
  } catch { return { message: "Invitation unavailable. Please try again.", link: null }; }
}

export async function revokeInvitationAction(form: FormData) {
  await requireAdminRole(["admin"]);
  const invitationId = form.get("invitationId");
  if (typeof invitationId !== "string" || !/^[a-f0-9-]{36}$/.test(invitationId)) return;
  const { data, error } = await (await createClient()).rpc("revoke_portal_invitation", { p_invitation_id: invitationId });
  if (error || data?.ok !== true) throw new Error("Invitation could not be revoked.");
  revalidatePath("/admin/portal-invitations");
}

export async function disableCustomerAction(form: FormData) {
  await requireAdminRole(["admin"]);
  const userId = form.get("userId");
  if (typeof userId !== "string" || !/^[a-f0-9-]{36}$/.test(userId)) return;
  const { data, error } = await (await createClient()).rpc("disable_customer_account", { p_user_id: userId });
  if (error || data?.ok !== true) throw new Error("Customer access could not be disabled.");
  revalidatePath("/admin/portal-invitations");
}
