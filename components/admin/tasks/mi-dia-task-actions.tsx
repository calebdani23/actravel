"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { initialMiDiaActionState, type MiDiaActionState } from "@/app/admin/(protected)/dashboard/action-state";
import type { MiDiaItem } from "@/lib/admin/mi-dia";

type Intent = "start" | "complete" | "cancel";
type CancelReason = "no_longer_needed" | "duplicate" | "source_invalidated" | "other";
export type MiDiaTaskRequestIds = { start: string; complete: string; cancel: Record<CancelReason, string> };
type Props = {
  action: (state: MiDiaActionState, formData: FormData) => Promise<MiDiaActionState>;
  item: Pick<MiDiaItem, "taskId" | "kind" | "status">;
  requestIds: MiDiaTaskRequestIds;
};

const reasons: readonly [CancelReason, string][] = [
  ["no_longer_needed", "Ya no es necesaria"], ["duplicate", "Duplicada"],
  ["source_invalidated", "Origen invalidado"], ["other", "Otro"],
];

export function miDiaRequestId(ids: MiDiaTaskRequestIds, intent: Intent, reason: CancelReason) {
  return intent === "cancel" ? ids.cancel[reason] : ids[intent];
}

export function focusMiDiaFailureFeedback(status: MiDiaActionState["status"], feedbackRef: { readonly current: { focus(): void } | null }) {
  if (status === "failure") feedbackRef.current?.focus();
}

export function MiDiaTaskActions({ action, item, requestIds }: Props) {
  const [state, formAction, pending] = useActionState(action, initialMiDiaActionState);
  const [reason, setReason] = useState<CancelReason>("no_longer_needed");
  const requestRef = useRef<HTMLInputElement>(null), reasonRef = useRef<HTMLInputElement>(null), feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    focusMiDiaFailureFeedback(state.status, feedbackRef);
  }, [state.status, state.feedbackSequence]);

  function prepare(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value as Intent;
    if (!requestRef.current || !reasonRef.current || !["start", "complete", "cancel"].includes(intent)) return;
    requestRef.current.value = miDiaRequestId(requestIds, intent, reason);
    reasonRef.current.value = intent === "cancel" ? reason : "";
  }

  const label = (idle: string) => pending ? "Actualizando…" : idle;
  return (
    <form action={formAction} aria-busy={pending} className="mt-3 space-y-2" onSubmit={prepare}>
      <input defaultValue={item.status === "pending" ? requestIds.start : requestIds.complete} name="requestId" ref={requestRef} type="hidden" />
      <input name="taskId" type="hidden" value={item.taskId} />
      <input name="taskKind" type="hidden" value={item.kind} />
      <input defaultValue="" name="cancelReason" ref={reasonRef} type="hidden" />
      <label className="block text-xs font-medium">Motivo de cancelación
        <select className="ml-2 rounded border bg-white px-2 py-1" disabled={pending} onChange={(event) => setReason(event.target.value as CancelReason)} value={reason}>
          {reasons.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {item.status === "pending" ? <button className="rounded border px-3 py-1 text-sm" disabled={pending} name="intent" type="submit" value="start">{label("Iniciar")}</button> : null}
        <button className="rounded border px-3 py-1 text-sm" disabled={pending} name="intent" type="submit" value="complete">{label("Completar")}</button>
        <button className="rounded border px-3 py-1 text-sm" disabled={pending} name="intent" type="submit" value="cancel">{label("Cancelar")}</button>
      </div>
      {state.status !== "idle" ? <p aria-live={state.status === "success" ? "polite" : "assertive"} ref={feedbackRef} role={state.status === "success" ? "status" : "alert"} tabIndex={state.status === "failure" ? -1 : undefined}>{state.message}</p> : null}
    </form>
  );
}
