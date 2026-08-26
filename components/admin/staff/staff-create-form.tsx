"use client";

import { useActionState } from "react";
import { createStaffAction } from "@/app/admin/(protected)/staff/actions";
import { initialStaffCreateActionState, type StaffCreateActionState } from "@/app/admin/(protected)/staff/action-state";
import { AlertBanner, adminFieldHintClassName, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

function fieldError(state: StaffCreateActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function StaffCreateForm() {
  const [state, action] = useActionState(createStaffAction, initialStaffCreateActionState);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="email">Correo de trabajo</label>
        <input className={`mt-1 ${adminInputClassName}`} defaultValue={state.values.email} id="email" name="email" required type="email" />
        {fieldError(state, "email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "email")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="full_name">Nombre completo</label>
        <input className={`mt-1 ${adminInputClassName}`} defaultValue={state.values.full_name} id="full_name" name="full_name" required />
        {fieldError(state, "full_name") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "full_name")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="role">Rol operativo</label>
        <select className={`mt-1 ${adminSelectClassName}`} defaultValue={state.values.role} id="role" name="role">
          <option value="asesor">Asesoría</option>
          <option value="admin">Administración</option>
          <option value="manager">Gerencia</option>
        </select>
        {fieldError(state, "role") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "role")}</p> : null}
      </div>
      <div className="flex items-center gap-2 pt-7">
        <input defaultChecked={state.values.is_active} id="is_active" name="is_active" type="checkbox" />
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="is_active">Activar acceso al panel desde ahora</label>
      </div>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="initial_password">Contraseña inicial</label>
        <input className={`mt-1 ${adminInputClassName}`} id="initial_password" name="initial_password" required type="password" />
        {fieldError(state, "initial_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "initial_password")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="confirm_initial_password">Confirmar contraseña inicial</label>
        <input className={`mt-1 ${adminInputClassName}`} id="confirm_initial_password" name="confirm_initial_password" required type="password" />
        {fieldError(state, "confirm_initial_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "confirm_initial_password")}</p> : null}
      </div>
      <div className={`md:col-span-2 space-y-1 ${adminFieldHintClassName}`}><p>La contraseña solo se usa para la provisión inicial. No se guarda en tablas operativas ni en auditoría.</p><p>El estado inactivo conserva la cuenta de acceso y el buzón, pero bloquea el uso del panel hasta reactivarlo.</p></div>
      {state.message ? <div className="md:col-span-2"><AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /></div> : null}
      <div className="md:col-span-2 flex justify-end">
        <PendingSubmitButton idleLabel="Crear usuario" pendingLabel="Creando…" type="submit" />
      </div>
    </form>
  );
}
