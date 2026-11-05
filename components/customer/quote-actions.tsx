"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { CustomerQuoteDetail } from "@/lib/customer/quotes";

export type QuoteFeedbackState = { status: "idle" | "success" | "failure"; message: string; sequence: number };
export type QuoteActionState = QuoteFeedbackState & { operation: "accept" | "change" | null; nextRequestId: string | null };
export async function submitQuoteAction<S extends QuoteFeedbackState>(action: (state: S, form: FormData) => Promise<S>, previous: S, form: FormData): Promise<S> {
  try { return await action(previous, form); }
  catch {
    return { ...previous, status: "failure", sequence: previous.sequence + 1,
      message: "We could not confirm this submission. Retry with the same details." };
  }
}
type FormValues = { body: string; consent: boolean };
export function quoteConsentIsCurrent(consent: boolean, consentedView: string | null, viewKey: string) {
  return consent && consentedView === viewKey;
}
export function settleQuoteForm(form: FormValues, result: QuoteActionState): FormValues {
  if (result.status !== "success") return form;
  return result.operation === "change" ? { ...form, body: "" } : { ...form, consent: false };
}
export function focusQuoteFeedback(status: QuoteFeedbackState["status"], ref: { readonly current: { focus(): void } | null }) {
  if (status !== "idle") ref.current?.focus();
}
export function QuoteFeedback({ state }: { state: QuoteFeedbackState }) {
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { focusQuoteFeedback(state.status, feedbackRef); }, [state.status, state.sequence]);
  return state.status === "idle" ? null : <p key={state.sequence} ref={feedbackRef} tabIndex={-1}
    role={state.status === "failure" ? "alert" : "status"} aria-live={state.status === "failure" ? "assertive" : "polite"}>
    {state.message}
  </p>;
}

export function QuoteActions({ action, viewKey, canAccept, canRequestChanges, requestIds }: {
  action(state: QuoteActionState, form: FormData): Promise<QuoteActionState>;
  viewKey: string; canAccept: boolean; canRequestChanges: boolean; requestIds: { accept: string; change: string };
}) {
  // Keep server-issued identities across rerenders; rotate a change ID only after success.
  const [ids] = useState(requestIds);
  const [form, setForm] = useState<FormValues>({ body: "", consent: false });
  const [consentedView, setConsentedView] = useState<string | null>(null);
  const consent = quoteConsentIsCurrent(form.consent, consentedView, viewKey);
  const [state, submit, pending] = useActionState(async (previous: QuoteActionState, data: FormData) => {
    const result = await submitQuoteAction(action, previous, data);
    setForm(current => settleQuoteForm(current, result));
    return result;
  }, { status: "idle", message: "", sequence: 0, operation: null, nextRequestId: null });
  return <section aria-label="Proposal actions" className="space-y-3 rounded border p-4">
    {!canAccept && <p>Acceptance is unavailable for this version. Review its status, PDF and approved terms.</p>}
    {!canRequestChanges && <p>Change requests are unavailable for this version.</p>}
    {(canAccept || canRequestChanges) && <form action={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        <input type="hidden" name="acceptRequestId" value={ids.accept} />
        <input type="hidden" name="changeRequestId" value={state.nextRequestId ?? ids.change} />
        {canAccept && <div className="space-y-2">
          <label className="flex items-start gap-2"><input type="checkbox" name="consent" checked={consent}
            onChange={event => { setConsentedView(viewKey); setForm(current => ({ ...current, consent: event.target.checked })); }} />
            I accept this proposal PDF and the displayed approved terms.</label>
          <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={pending || !consent} name="intent" value="accept">Accept proposal</button>
        </div>}
        {canRequestChanges && <div className="space-y-2">
          <label className="block">Requested changes
            <textarea className="block w-full rounded border p-2" name="body" rows={5} value={form.body} aria-describedby="change-limit"
              onChange={event => setForm(current => ({ ...current, body: event.target.value }))} />
          </label>
          <p id="change-limit">1–2,000 characters, up to 8,000 UTF-8 bytes. {[...form.body.trim()].length} characters entered.</p>
          <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={pending} name="intent" value="change">Request changes</button>
        </div>}
      </fieldset>
      {pending && <p role="status">Submitting…</p>}
    </form>}
    <QuoteFeedback state={state} />
    {state.status === "failure" && <p>Retry with the same details, or reload this page to review the latest proposal before trying again.</p>}
  </section>;
}

export function QuoteEvidence({ detail }: { detail: CustomerQuoteDetail }) {
  const { acceptance, terms, version, requests } = detail;
  return <>
    {acceptance ? <section aria-label="Acceptance receipt" className="space-y-2 rounded border p-4">
      <h2 className="text-xl font-semibold">Verified customer acceptance</h2>
      <p>Receipt: {acceptance.acceptanceId}</p><p>Version {version.versionNumber} · Accepted at <time dateTime={acceptance.acceptedAt}>{acceptance.acceptedAt}</time></p>
      <p className="break-all">PDF SHA-256: {acceptance.documentSha256}</p>
    </section> : version.status === "accepted" && <p>Accepted by staff. No verified customer acceptance receipt is recorded.</p>}
    <section aria-label="Proposal terms" className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">{acceptance ? "Accepted terms (preserved receipt)" : "Approved terms"}</h2>
      {terms ? <><p>Revision {terms.revision}</p><p className="whitespace-pre-wrap">{terms.body}</p></>
        : <p>Acceptance is unavailable until approved terms are published.</p>}
    </section>
    <section aria-label="Recent change requests" className="space-y-3">
      <h2 className="text-xl font-semibold">Recent change requests</h2>
      {requests.length === 0 ? <p>No change requests recorded.</p> : <ul className="space-y-3">{requests.map(request => <li key={request.requestId} className="rounded border p-3">
        <p>Version {detail.history.find(row => row.versionId === request.versionId)?.versionNumber ?? request.versionId} · {request.status}</p>
        <time dateTime={request.createdAt}>{request.createdAt}</time><p className="whitespace-pre-wrap">{request.body}</p>
      </li>)}</ul>}
    </section>
  </>;
}
