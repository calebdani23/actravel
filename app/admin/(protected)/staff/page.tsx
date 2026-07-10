import { StaffCreateForm } from "@/components/admin/staff/staff-create-form";
import { StaffList } from "@/components/admin/staff/staff-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getStaffAccounts, getStaffAuditEvents } from "@/lib/admin/staff";

function actionLabel(action: string) {
  return {
    staff_created: "Created",
    staff_create_failed: "Create failed",
    staff_updated: "Profile updated",
    staff_deactivated: "Deactivated",
    staff_reactivated: "Reactivated",
    staff_role_changed: "Role changed",
    staff_deleted: "Deleted permanently",
    staff_password_changed: "Password changed",
  }[action] ?? action;
}

export default async function StaffPage() {
  await requireAdminRole(["admin"]);
  const [staff, events] = await Promise.all([getStaffAccounts(), getStaffAuditEvents(20)]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Administración interna</p>
        <h1 className="mt-2 text-3xl font-bold">Staff</h1>
        <p className="mt-2 text-muted-foreground">Hostinger mailbox first, AC Travel app access second. This page provisions only AC Travel app access for internal admin and advisor staff.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provision new staff account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Create or confirm the mailbox manually in Hostinger/hPanel.</li>
            <li>Create the AC Travel app account here with a strong initial password.</li>
            <li>Active/inactive here controls <strong>app authorization only</strong> through <code>profiles.is_active</code>; it does not ban the Supabase Auth user or suspend the mailbox.</li>
            <li>Share credentials through an approved secure manual channel.</li>
            <li>Ask the staff member to change their password after first login from <code>/admin/account</code>.</li>
          </ol>
          <StaffCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{staff.length} staff record(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffList staff={staff} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent audit events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? events.map((event) => (
                  <tr className="border-b align-top" key={event.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{actionLabel(event.action)}</td>
                    <td className="py-2 pr-4">{event.actor_name ?? "System"}</td>
                    <td className="py-2 pr-4">{event.target_name ?? event.target_email ?? "—"}</td>
                    <td className="py-2 break-words text-xs text-muted-foreground">{JSON.stringify(event.metadata)}</td>
                  </tr>
                )) : <tr><td className="py-2 text-muted-foreground" colSpan={5}>No staff audit events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
