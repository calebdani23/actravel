export type AccountActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export type PasswordChangeActionState = AccountActionState;
export type EmailChangeActionState = AccountActionState;

export const initialPasswordChangeActionState: PasswordChangeActionState = { ok: false, message: null, fieldErrors: {} };
export const initialEmailChangeActionState: EmailChangeActionState = { ok: false, message: null, fieldErrors: {} };
