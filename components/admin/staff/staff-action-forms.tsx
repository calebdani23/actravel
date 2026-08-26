"use client";

import { useActionState } from "react";
import { deleteStaffAction, updateStaffAction } from "@/app/admin/(protected)/staff/actions";
import { initialStaffDeleteActionState, initialStaffUpdateActionState } from "@/app/admin/(protected)/staff/action-state";
import { AlertBanner, adminFieldHintClassName, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import type { StaffAccount } from "@/lib/admin/staff";
import { staffManagementNote } from "@/lib/admin/staff-view";

export function StaffEditForm({ staff }: Readonly<{ staff: StaffAccount }>) {
  const [state, action] = useActionState(updateStaffAction, initialStaffUpdateActionState);

  return (
    <form action={action} className="space-y-5">
      <input name="profile_id" type="hidden" value={staff.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2" htmlFor={`full_name-${staff.id}`}>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Nombre completo</span>
          <input className={adminInputClassName} defaultValue={staff.full_name} id={`full_name-${staff.id}`} name="full_name" required />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Correo</span>
          <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] px-3.5 py-3 text-sm text-[color:var(--admin-foreground)]">{staff.email ?? "No identificado"}</div>
        </div>

        <label className="space-y-2" htmlFor={`role-${staff.id}`}>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Rol operativo</span>
          <select className={adminSelectClassName} defaultValue={staff.role ?? "asesor"} disabled={!staff.is_manageable_in_mvp} id={`role-${staff.id}`} name="role">
             <option value="asesor">Asesoría</option>
             <option value="admin">Administración</option>
             <option value="manager">Gerencia</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] px-4 py-3" htmlFor={`is_active-${staff.id}`}>
          <input defaultChecked={staff.is_active} disabled={!staff.is_manageable_in_mvp} id={`is_active-${staff.id}`} name="is_active" type="checkbox" />
          <span className="text-sm text-[color:var(--admin-foreground)]">Acceso activo al panel</span>
        </label>
      </div>

      <p className={adminFieldHintClassName}>{staffManagementNote(staff.management_block_reason)}</p>
      {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}

      <div className="flex justify-end">
        <PendingSubmitButton disabled={!staff.is_manageable_in_mvp} idleLabel="Guardar cambios" pendingLabel="Guardando…" type="submit" />
      </div>
    </form>
  );
}

export function StaffDeleteForm({ staff }: Readonly<{ staff: StaffAccount }>) {
  const [state, action] = useActionState(deleteStaffAction, initialStaffDeleteActionState);

  return (
    <form action={action} className="space-y-4">
      <input name="profile_id" type="hidden" value={staff.id} />
      <div className="rounded-[var(--admin-radius-control)] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">Confirmación requerida</p>
        <p className="mt-2">Esta acción elimina la cuenta de acceso de forma permanente. El sistema seguirá bloqueando autoeliminación, último administrador activo y cuentas con historial referenciado.</p>
        <p className="mt-2">Si este usuario todavía debe conservar trazabilidad operativa, desactívalo en lugar de eliminarlo.</p>
        {!staff.is_manageable_in_mvp ? <p className="mt-2">Esta cuenta está fuera del alcance gestionable del MVP y aquí no puede eliminarse.</p> : null}
      </div>
      {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}
      <div className="flex justify-end">
        <PendingSubmitButton className="border-red-200 bg-red-600 text-white hover:bg-red-700" disabled={!staff.is_manageable_in_mvp} idleLabel="Eliminar de forma permanente" pendingLabel="Eliminando…" type="submit" variant="outline" />
      </div>
    </form>
  );
}
