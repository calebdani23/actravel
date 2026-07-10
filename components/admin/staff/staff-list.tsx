"use client";

import { useActionState } from "react";
import { deleteStaffAction, updateStaffAction } from "@/app/admin/(protected)/staff/actions";
import { initialStaffDeleteActionState, initialStaffUpdateActionState } from "@/app/admin/(protected)/staff/action-state";
import type { StaffAccount } from "@/lib/admin/staff";

function RowForm({ staff }: { staff: StaffAccount }) {
  const [updateState, updateAction] = useActionState(updateStaffAction, initialStaffUpdateActionState);
  const [deleteState, deleteAction] = useActionState(deleteStaffAction, initialStaffDeleteActionState);
  const isEditable = staff.is_manageable_in_mvp;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <form action={updateAction} className="grid gap-3 md:grid-cols-6">
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
      </form>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>ID: {staff.id}</span>
        <span>App access: {staff.is_active ? "Active" : "Inactive"}</span>
        <span>Current roles: {staff.roles.join(", ") || "Unassigned"}</span>
        <span>Created: {new Date(staff.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(staff.updated_at).toLocaleString()}</span>
      </div>

      {!isEditable ? <p className="text-xs text-amber-700">{staff.management_block_reason}</p> : <p className="text-xs text-muted-foreground">Inactive blocks AC Travel admin access via <code>profiles.is_active</code>; it does not suspend the mailbox or ban the Supabase Auth user.</p>}
      {updateState.message ? <p className={`text-sm ${updateState.ok ? "text-emerald-700" : "text-red-700"}`}>{updateState.message}</p> : null}

      <form action={deleteAction} className="rounded-md border border-red-200 bg-red-50/60 p-3">
        <input name="profile_id" type="hidden" value={staff.id} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-xs text-red-900">
            <p className="font-semibold">Permanent delete</p>
            <p>Only use this when the account is truly disposable. Self-delete, deleting the last active admin, and deleting accounts still referenced in leads/bookings/history are blocked automatically.</p>
            <p>If AC Travel still has historical references to this staff member, deactivate the account instead.</p>
          </div>
          <button className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100" type="submit">Permanently delete</button>
        </div>
        {deleteState.message ? <p className={`mt-3 text-sm ${deleteState.ok ? "text-emerald-700" : "text-red-700"}`}>{deleteState.message}</p> : null}
      </form>
    </div>
  );
}

export function StaffList({ staff }: { staff: StaffAccount[] }) {
  return (
    <div className="space-y-4">
      {staff.length ? staff.map((row) => <RowForm key={row.id} staff={row} />) : <p className="text-sm text-muted-foreground">No staff records were found.</p>}
    </div>
  );
}
