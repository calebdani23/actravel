"use client";
import { useActionState } from "react";
import { issueInvitationAction } from "@/app/admin/(protected)/portal-invitations/actions";

export function IssueInvitation() {
  const [state, action, pending] = useActionState(issueInvitationAction, { message: "", link: null });
  return <form action={action} className="space-y-3 rounded border p-4">
    <label className="block">Canonical Contact ID
      <input className="block w-full rounded border p-2" name="contactId" required pattern="[a-f0-9-]{36}" placeholder="Select the exact Contact from CRM" />
    </label>
    <p>The Contact must have a unique email and no staff identity. A new invitation revokes previous pending invitations.</p>
    <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Creating…" : "Create invitation"}</button>
    <p role="status">{state.message}</p>
    {state.link && <a href={state.link} className="block break-all underline" referrerPolicy="no-referrer">{state.link}</a>}
  </form>;
}
