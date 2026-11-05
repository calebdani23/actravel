"use client";
import { useActionState } from "react";
import { publishTermsAction } from "@/app/admin/(protected)/portal-terms/actions";

export function PublishTerms() {
  const [message, action, pending] = useActionState(publishTermsAction, "");
  return <form action={action} className="space-y-4 rounded border p-4">
    <p>Publish only text approved by your business/legal owner. No default legal terms are supplied. Published text is immutable; corrections require a new revision.</p>
    <label className="block">Revision label<input className="block w-full rounded border p-2" name="revision" required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" /></label>
    <label className="block">Approved terms<textarea className="block w-full rounded border p-2" name="body" rows={10} required maxLength={16000} /></label>
    <label className="block"><input type="checkbox" name="approved" required /> I confirm this exact text is approved for customer acceptance.</label>
    <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-white">{pending ? "Publishing…" : "Publish revision"}</button>
    <p role="status">{message}</p>
  </form>;
}
