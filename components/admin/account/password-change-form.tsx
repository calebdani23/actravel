"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/admin/(protected)/account/actions";
import { initialPasswordChangeActionState, type PasswordChangeActionState } from "@/app/admin/(protected)/account/action-state";

function fieldError(state: PasswordChangeActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function PasswordChangeForm() {
  const [state, action] = useActionState(changePasswordAction, initialPasswordChangeActionState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="new_password">New password</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="new_password" name="new_password" required type="password" />
        {fieldError(state, "new_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "new_password")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="confirm_new_password">Confirm new password</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="confirm_new_password" name="confirm_new_password" required type="password" />
        {fieldError(state, "confirm_new_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "confirm_new_password")}</p> : null}
      </div>
      <p className="text-xs text-muted-foreground">Admins cannot view or retrieve existing passwords. Initial password rotation remains manual in MVP.</p>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null}
      <div className="flex justify-end">
        <button className="rounded-md bg-[var(--ac-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" type="submit">Update password</button>
      </div>
    </form>
  );
}
