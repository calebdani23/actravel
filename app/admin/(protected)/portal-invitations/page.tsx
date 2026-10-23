import { requireAdminRoute } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { IssueInvitation } from "@/components/customer/issue-invitation";
import { disableCustomerAction, revokeInvitationAction } from "./actions";

export default async function PortalInvitationsPage() {
  await requireAdminRoute("/admin/portal-invitations", ["admin"]);
  const client = await createClient();
  const [invitations, accounts, events] = await Promise.all([
    client.from("portal_invitations").select("id,email,expires_at,revoked_at,redeemed_at").order("created_at", { ascending: false }).limit(50),
    client.from("customer_accounts").select("user_id,email,is_active").order("created_at", { ascending: false }).limit(50),
    client.from("portal_access_events").select("id,event_type,contact_id,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  if (invitations.error || accounts.error || events.error) throw new Error("Customer access data is unavailable.");
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Customer portal access</h1>
    <IssueInvitation />
    <h2 className="text-xl font-semibold">Recent invitations</h2>
    <ul className="space-y-3">{(invitations.data ?? []).map(row => <li key={row.id} className="rounded border p-3">
      <p>{row.email} — {row.revoked_at ? "Revoked" : row.redeemed_at ? "Redeemed" : new Date(row.expires_at) < new Date() ? "Expired" : "Pending"}</p>
      {!row.revoked_at && !row.redeemed_at && <form action={revokeInvitationAction}><input type="hidden" name="invitationId" value={row.id} /><button className="underline">Revoke invitation</button></form>}
    </li>)}</ul>
    <h2 className="text-xl font-semibold">Customer accounts</h2>
    <ul>{(accounts.data ?? []).map(row => <li key={row.user_id} className="rounded border p-3">
      <p>{row.email} — {row.is_active ? "Active" : "Disabled"}</p>
      {row.is_active && <form action={disableCustomerAction}><input type="hidden" name="userId" value={row.user_id} /><button className="underline">Disable customer access</button></form>}
    </li>)}</ul>
    <h2 className="text-xl font-semibold">Recent access events</h2>
    <ul>{(events.data ?? []).map(row => <li key={row.id}>{row.event_type} — Contact {row.contact_id} — {row.created_at}</li>)}</ul>
  </div>;
}
