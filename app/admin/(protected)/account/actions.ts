"use server";

import { revalidatePath } from "next/cache";
import type { EmailChangeActionState, PasswordChangeActionState } from "@/app/admin/(protected)/account/action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { changeCurrentStaffPassword, requestCurrentStaffEmailChange } from "@/lib/admin/staff";
import { parseEmailChangeFormData, parsePasswordChangeFormData } from "@/lib/validations/staff";

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

export async function requestEmailChangeAction(_previous: EmailChangeActionState, formData: FormData): Promise<EmailChangeActionState> {
  const session = await requireAdminRole();
  const parsed = parseEmailChangeFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: parsed.fieldErrors };
  }

  const currentEmail = session.user.email?.trim().toLowerCase();
  if (currentEmail && parsed.data.email === currentEmail) {
    return {
      ok: false,
      message: "El nuevo correo debe ser diferente al actual.",
      fieldErrors: { email: ["Enter a different email address"] },
    };
  }

  try {
    await requestCurrentStaffEmailChange(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidatePath("/admin/account");
    return {
      ok: true,
      message: "Solicitud enviada. Revisa tu correo nuevo y, si aplica, también el actual para completar la verificación antes de usar la nueva dirección para iniciar sesión.",
      fieldErrors: {},
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo solicitar el cambio de correo.",
      fieldErrors: {},
    };
  }
}
