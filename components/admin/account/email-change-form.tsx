"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestEmailChangeAction } from "@/app/admin/(protected)/account/actions";
import { initialEmailChangeActionState, type EmailChangeActionState } from "@/app/admin/(protected)/account/action-state";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { AlertBanner, adminFieldHintClassName, adminInputClassName } from "@/components/admin/admin-primitives";

function fieldError(state: EmailChangeActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function EmailChangeForm() {
  const [state, action] = useActionState(requestEmailChangeAction, initialEmailChangeActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
  }, [state.ok, state.message]);

  return (
    <form action={action} className="space-y-4" ref={formRef}>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="email">Nuevo correo</label>
        <input className={`mt-1 ${adminInputClassName}`} id="email" name="email" required type="email" />
        {fieldError(state, "email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "email")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="confirm_email">Confirmar nuevo correo</label>
        <input className={`mt-1 ${adminInputClassName}`} id="confirm_email" name="confirm_email" required type="email" />
        {fieldError(state, "confirm_email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "confirm_email")}</p> : null}
      </div>
      <div className={`space-y-1 ${adminFieldHintClassName}`}>
        <p>Te enviaremos una verificación antes de activar el nuevo correo de acceso.</p>
        <p>Si el flujo seguro de cambio de correo está activo, puede pedir confirmación tanto en el buzón actual como en el nuevo.</p>
        <p>Mantén acceso a ambos buzones durante el cambio.</p>
        <p>Este cambio no crea, renombra ni elimina buzones de Hostinger.</p>
      </div>
      {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}
      <div className="flex justify-end">
        <PendingSubmitButton idleLabel="Solicitar cambio de correo" pendingLabel="Solicitando…" type="submit" />
      </div>
    </form>
  );
}
