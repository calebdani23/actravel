import type { EmailChangeActionState, PasswordChangeActionState } from "@/app/admin/(protected)/account/action-state";

const SAFE_DUPLICATE_EMAIL_MESSAGE = "Ese correo no se puede usar. Intenta con otro o contacta a una persona administradora.";
const PASSWORD_UPDATE_FAILURE_MESSAGE = "No se pudo actualizar la contraseña. Inténtalo nuevamente.";
const EMAIL_UPDATE_FAILURE_MESSAGE = "No se pudo actualizar el correo electrónico. Inténtalo nuevamente.";

export function logAccountActionFailure(action: "password-update" | "email-update", error: unknown) {
  console.error("[admin-account] action failed", { action, error });
}

export function getSafeAccountFailureMessage(action: "password-update" | "email-update", error: unknown) {
  const message = error instanceof Error ? error.message : null;

  if (action === "email-update" && message === SAFE_DUPLICATE_EMAIL_MESSAGE) {
    return SAFE_DUPLICATE_EMAIL_MESSAGE;
  }

  return action === "password-update" ? PASSWORD_UPDATE_FAILURE_MESSAGE : EMAIL_UPDATE_FAILURE_MESSAGE;
}

export function buildPasswordFailureState(error: unknown): PasswordChangeActionState {
  return { ok: false, message: getSafeAccountFailureMessage("password-update", error), fieldErrors: {} };
}

export function buildEmailFailureState(error: unknown, email: string): EmailChangeActionState {
  return {
    ok: false,
    message: getSafeAccountFailureMessage("email-update", error),
    fieldErrors: {},
    values: {
      email,
      confirm_email: email,
    },
  };
}

export const accountActionErrorInternals = {
  buildEmailFailureState,
  buildPasswordFailureState,
  getSafeAccountFailureMessage,
};
