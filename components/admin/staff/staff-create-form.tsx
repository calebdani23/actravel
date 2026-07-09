"use client";

import { useActionState } from "react";
import { createStaffAction, initialStaffCreateActionState } from "@/app/admin/(protected)/staff/actions";

function fieldError(state: typeof initialStaffCreateActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function StaffCreateForm() {
  const [state, action] = useActionState(createStaffAction, initialStaffCreateActionState);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium" htmlFor="email">Business email</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={state.values.email} id="email" name="email" required type="email" />
        {fieldError(state, "email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "email")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="full_name">Full name</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={state.values.full_name} id="full_name" name="full_name" required />
        {fieldError(state, "full_name") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "full_name")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="role">Role</label>
        <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={state.values.role} id="role" name="role">
          <option value="asesor">Asesor</option>
          <option value="admin">Admin</option>
        </select>
        {fieldError(state, "role") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "role")}</p> : null}
      </div>
      <div className="flex items-center gap-2 pt-7">
        <input defaultChecked={state.values.is_active} id="is_active" name="is_active" type="checkbox" />
        <label className="text-sm font-medium" htmlFor="is_active">App access active immediately</label>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="initial_password">Initial password</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="initial_password" name="initial_password" required type="password" />
        {fieldError(state, "initial_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "initial_password")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="confirm_initial_password">Confirm initial password</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="confirm_initial_password" name="confirm_initial_password" required type="password" />
        {fieldError(state, "confirm_initial_password") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "confirm_initial_password")}</p> : null}
      </div>
      <div className="md:col-span-2 space-y-1 text-xs text-muted-foreground"><p>Passwords are used only for the provisioning request. They are never stored in AC Travel tables or audit metadata.</p><p>Inactive staff keep their Auth account and mailbox, but AC Travel blocks protected admin access until <code>profiles.is_active</code> is turned back on.</p></div>
      {state.message ? <p className={`md:col-span-2 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <button className="rounded-md bg-[var(--ac-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" type="submit">Create account</button>
      </div>
    </form>
  );
}
