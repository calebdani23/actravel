"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction } from "@/app/admin/(protected)/account/actions";
import { initialPasswordChangeActionState, type PasswordChangeActionState } from "@/app/admin/(protected)/account/action-state";
import { AlertBanner, adminFieldHintClassName, adminInputClassName } from "@/components/admin/admin-primitives";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

function fieldError(state: PasswordChangeActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function PasswordChangeForm() {
  const [state, action] = useActionState(changePasswordAction, initialPasswordChangeActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
  }, [state.ok, state.message]);

  return (
    <form action={action} className="space-y-4" ref={formRef}>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="new_password">Nueva contraseña</label>
        <input className={`mt-1 ${adminInputClassName}`} id="new_password" name="new_password" required type="password" />
        {fieldError(state, "new_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "new_password")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="confirm_new_password">Confirmar nueva contraseña</label>
        <input className={`mt-1 ${adminInputClassName}`} id="confirm_new_password" name="confirm_new_password" required type="password" />
        {fieldError(state, "confirm_new_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "confirm_new_password")}</p> : null}
      </div>
      <p className={adminFieldHintClassName}>Nadie puede consultar ni recuperar contraseñas existentes desde esta vista. La rotación inicial sigue siendo manual en el MVP.</p>
      {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}
      <div className="flex justify-end">
        <PendingSubmitButton idleLabel="Actualizar contraseña" pendingLabel="Actualizando…" type="submit" />
      </div>
    </form>
  );
}
