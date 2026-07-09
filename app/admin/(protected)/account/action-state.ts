export type PasswordChangeActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export const initialPasswordChangeActionState: PasswordChangeActionState = { ok: false, message: null, fieldErrors: {} };
