"use server";

import { revalidatePath } from "next/cache";
import { initialEmailChangeActionState, type EmailChangeActionState, type PasswordChangeActionState } from "@/app/admin/(protected)/account/action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { buildEmailFailureState, buildPasswordFailureState, logAccountActionFailure } from "@/lib/admin/account-action-errors";
import { changeCurrentStaffPassword, requestCurrentStaffEmailChange } from "@/lib/admin/staff";
import { parseEmailChangeFormData, parsePasswordChangeFormData } from "@/lib/validations/staff";

export async function changePasswordAction(_previous: PasswordChangeActionState, formData: FormData): Promise<PasswordChangeActionState> {
  const session = await requireAdminRole();
  const parsed = parsePasswordChangeFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: parsed.fieldErrors };
  }

  try {
    await changeCurrentStaffPassword(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidatePath("/admin/account");
    return { ok: true, message: "Contraseña actualizada correctamente.", fieldErrors: {} };
  } catch (error) {
    logAccountActionFailure("password-update", error);
    return buildPasswordFailureState(error);
  }
}

export async function requestEmailChangeAction(_previous: EmailChangeActionState, formData: FormData): Promise<EmailChangeActionState> {
  const session = await requireAdminRole();
  const parsed = parseEmailChangeFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: parsed.fieldErrors,
      values: {
        email: parsed.values.email,
        confirm_email: parsed.values.confirm_email,
      },
    };
  }

  const currentEmail = session.user.email?.trim().toLowerCase();
  if (currentEmail && parsed.data.email === currentEmail) {
    return {
      ok: false,
      message: "El nuevo correo debe ser diferente al actual.",
      fieldErrors: { email: ["Ingresa un correo distinto"] },
      values: {
        email: parsed.data.email,
        confirm_email: parsed.data.email,
      },
    };
  }

  try {
    await requestCurrentStaffEmailChange(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidatePath("/admin/account");
    return {
      ok: true,
      message: "Solicitud enviada. Revisa tu correo nuevo y, si aplica, también el actual para completar la verificación antes de usar la nueva dirección para iniciar sesión.",
      fieldErrors: {},
      values: initialEmailChangeActionState.values,
    };
  } catch (error) {
    logAccountActionFailure("email-update", error);
    return buildEmailFailureState(error, parsed.data.email);
  }
}
