"use client";
import { useActionState, useState } from "react";
import { QuoteFeedback, submitQuoteAction, type QuoteFeedbackState } from "@/components/customer/quote-actions";
import type { QuoteWorkItem } from "@/lib/admin/customer-quote-work";
import type { TaskActionCancelReason, TaskActionTargetStatus } from "@/lib/admin/task-actions";

export type WorkRequestIds = { start: string; complete: string; cancel: Record<TaskActionCancelReason, string> };
const reasons: readonly [TaskActionCancelReason, string][] = [
  ["no_longer_needed", "No longer needed"], ["duplicate", "Duplicate"], ["source_invalidated", "Source invalidated"], ["other", "Other"],
];
export function workCommand(ids: WorkRequestIds, target: TaskActionTargetStatus, reason: TaskActionCancelReason) {
  return `${target}:${target === "canceled" ? ids.cancel[reason] : target === "completed" ? ids.complete : ids.start}`;
}
export function CustomerWorkItem({ item, action, requestIds }: {
  item: QuoteWorkItem; requestIds: WorkRequestIds;
  action(state: QuoteFeedbackState, form: FormData): Promise<QuoteFeedbackState>;
}) {
  const [ids] = useState(requestIds);
  const [reason, setReason] = useState<TaskActionCancelReason>("no_longer_needed");
  const [state, submit, pending] = useActionState<QuoteFeedbackState, FormData>(
    (previous, data) => submitQuoteAction(action, previous, data), { status: "idle", message: "", sequence: 0 });
  const active = item.taskStatus === "pending" || item.taskStatus === "in_progress";
  return <article className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-semibold">{item.number} · Version {item.versionNumber}</h2>
    <p>{item.kind === "quote_change" ? "Verified customer change request" : item.source === "customer" ? "Verified customer acceptance" : "Staff-recorded acceptance"}</p>
    <p>{item.kind === "acceptance_handoff" ? "Prepare handoff — acceptance pre-alert only; no trip or commercial closure is created." : "Review requested changes"}</p>
    <p>Current version status: {item.versionStatus}</p>
    {item.acceptanceId && <p>Acceptance receipt: {item.acceptanceId}</p>}
    {item.body && <p className="whitespace-pre-wrap">{item.body}</p>}
    <p>Due (UTC): <time dateTime={item.dueAt}>{item.dueAt}</time></p>
    <p>{item.taskId === null ? "Admin intake — no active advisor assignment was available." : `Task: ${item.taskStatus}`}</p>
    {(item.canClaim || item.canManage && active) && <form action={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-3">
        {item.canClaim ? <button className="rounded border px-3 py-2" name="command" value="claim">Claim intake</button> : <>
          <label className="block">Cancellation reason
            <select className="ml-2 rounded border p-2" name="cancelReason" value={reason} onChange={event => setReason(event.target.value as TaskActionCancelReason)}>
              {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {item.taskStatus === "pending" && <button className="rounded border px-3 py-2" name="command" value={workCommand(ids, "in_progress", reason)}>Start</button>}
            <button className="rounded border px-3 py-2" name="command" value={workCommand(ids, "completed", reason)}>Complete</button>
            <button className="rounded border px-3 py-2" name="command" value={workCommand(ids, "canceled", reason)}>Cancel</button>
          </div>
        </>}
      </fieldset>
      {pending && <p role="status">Updating…</p>}
    </form>}
    <QuoteFeedback state={state} />
  </article>;
}
