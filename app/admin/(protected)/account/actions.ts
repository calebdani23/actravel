"use server";

import { revalidatePath } from "next/cache";
import type { PasswordChangeActionState } from "@/app/admin/(protected)/account/action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { changeCurrentStaffPassword } from "@/lib/admin/staff";
import { parsePasswordChangeFormData } from "@/lib/validations/staff";

export async function changePasswordAction(_previous: PasswordChangeActionState, formData: FormData): Promise<PasswordChangeActionState> {
  const session = await requireAdminRole();
  const parsed = parsePasswordChangeFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Review the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }

  try {
    await changeCurrentStaffPassword(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidatePath("/admin/account");
    return { ok: true, message: "Password updated successfully.", fieldErrors: {} };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update your password.", fieldErrors: {} };
  }
}
