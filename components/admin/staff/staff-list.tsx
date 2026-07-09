"use client";

import { useActionState } from "react";
import { initialStaffUpdateActionState, updateStaffAction } from "@/app/admin/(protected)/staff/actions";
import type { StaffAccount } from "@/lib/admin/staff";

function RowForm({ staff }: { staff: StaffAccount }) {
  const [state, action] = useActionState(updateStaffAction, initialStaffUpdateActionState);
  const isEditable = staff.is_manageable_in_mvp;

  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
      <input name="profile_id" type="hidden" value={staff.id} />
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`full_name-${staff.id}`}>Full name</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={staff.full_name} id={`full_name-${staff.id}`} name="full_name" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <p className="mt-2 break-all text-sm">{staff.email ?? "—"}</p>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`role-${staff.id}`}>Role</label>
        <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={staff.role ?? "asesor"} disabled={!isEditable} id={`role-${staff.id}`} name="role">
          <option value="asesor">Asesor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex items-center gap-2 pt-6">
        <input defaultChecked={staff.is_active} disabled={!isEditable} id={`is_active-${staff.id}`} name="is_active" type="checkbox" />
        <label className="text-sm" htmlFor={`is_active-${staff.id}`}>App access active</label>
      </div>
      <div className="flex items-end justify-end">
        <button className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={!isEditable} type="submit">Save</button>
      </div>
      <div className="md:col-span-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>ID: {staff.id}</span>
        <span>App access: {staff.is_active ? "Active" : "Inactive"}</span>
        <span>Current roles: {staff.roles.join(", ") || "Unassigned"}</span>
        <span>Created: {new Date(staff.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(staff.updated_at).toLocaleString()}</span>
      </div>
      {!isEditable ? <p className="md:col-span-6 text-xs text-amber-700">{staff.management_block_reason}</p> : <p className="md:col-span-6 text-xs text-muted-foreground">Inactive blocks AC Travel admin access via <code>profiles.is_active</code>; it does not suspend the mailbox or ban the Supabase Auth user.</p>}
      {state.message ? <p className={`md:col-span-6 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null}
    </form>
  );
}

export function StaffList({ staff }: { staff: StaffAccount[] }) {
  return (
    <div className="space-y-4">
      {staff.length ? staff.map((row) => <RowForm key={row.id} staff={row} />) : <p className="text-sm text-muted-foreground">No staff records were found.</p>}
    </div>
  );
}
