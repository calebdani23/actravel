"use client";

import { useActionState } from "react";
import { requestEmailChangeAction } from "@/app/admin/(protected)/account/actions";
import { initialEmailChangeActionState, type EmailChangeActionState } from "@/app/admin/(protected)/account/action-state";

function fieldError(state: EmailChangeActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function EmailChangeForm() {
  const [state, action] = useActionState(requestEmailChangeAction, initialEmailChangeActionState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="email">Nuevo correo</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="email" name="email" required type="email" />
        {fieldError(state, "email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "email")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="confirm_email">Confirmar nuevo correo</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="confirm_email" name="confirm_email" required type="email" />
        {fieldError(state, "confirm_email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "confirm_email")}</p> : null}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Te enviaremos una verificación antes de activar el nuevo correo de acceso.</p>
        <p>Si Supabase Secure Email Change está activo, puede pedir confirmación tanto en el buzón actual como en el nuevo.</p>
        <p>Mantén acceso a ambos buzones durante el cambio.</p>
        <p>Este cambio no crea, renombra ni elimina buzones de Hostinger.</p>
      </div>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null}
      <div className="flex justify-end">
        <button className="rounded-md bg-[var(--ac-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" type="submit">Solicitar cambio de correo</button>
      </div>
    </form>
  );
}
