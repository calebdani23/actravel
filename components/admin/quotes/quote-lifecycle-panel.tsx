"use client";

import { useActionState, useState } from "react";
import {
  acceptQuoteAction,
  cancelQuoteAction,
  expireQuoteAction,
  markQuoteReadyAction,
  markQuoteSentAction,
  rejectQuoteAction,
  restoreQuoteAction,
  softDeleteQuoteAction,
} from "@/app/admin/(protected)/quotes/actions";
import { initialQuoteActionState, type QuoteActionState } from "@/app/admin/(protected)/quotes/action-state";
import { adminFieldHintClassName, adminInputClassName } from "@/components/admin/admin-primitives";
import { createQuoteIdempotencyKey, quoteDeleteConfirmation, quoteRestoreConfirmation } from "@/lib/admin/quote-validation";

type QuoteServerAction = (state: QuoteActionState, formData: FormData) => Promise<QuoteActionState>;

type WorkflowFormProps = {
  action: QuoteServerAction;
  actionName: string;
  quoteId: string;
  quoteVersionId: string;
  lockVersion: number;
  idleLabel: string;
  pendingLabel: string;
  tone?: "primary" | "danger" | "neutral";
  acceptedQuoteToSupersede?: { id: string; number: string } | null;
};

function WorkflowForm({ action, actionName, quoteId, quoteVersionId, lockVersion, idleLabel, pendingLabel, tone = "neutral", acceptedQuoteToSupersede }: Readonly<WorkflowFormProps>) {
  const [state, formAction, pending] = useActionState(action, initialQuoteActionState);
  const [idempotencyKey] = useState(() => createQuoteIdempotencyKey(`quote_${actionName}`));
  const buttonClass = tone === "primary"
    ? "bg-[color:var(--admin-accent)] text-white"
    : tone === "danger"
      ? "border border-red-300 bg-white text-red-800 hover:bg-red-50"
      : "border border-[color:var(--admin-border)] bg-white text-[color:var(--admin-foreground)] hover:bg-[color:var(--admin-surface-muted)]";
  return (
    <form action={formAction} className="space-y-3">
      <input name="quoteId" type="hidden" value={quoteId} />
      <input name="quoteVersionId" type="hidden" value={quoteVersionId} />
      <input name="expectedLockVersion" type="hidden" value={lockVersion} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {acceptedQuoteToSupersede ? (
        <fieldset className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <legend className="px-1 text-sm font-semibold text-amber-950">Sustitución explícita</legend>
          <p className="text-sm text-amber-950">La oportunidad ya tiene aceptada {acceptedQuoteToSupersede.number}. Confirma su ID y documenta por qué se sustituye.</p>
          <input name="expectedAcceptedQuoteId" type="hidden" value={acceptedQuoteToSupersede.id} />
          <label className="space-y-2" htmlFor={`quote-${actionName}-supersede-reason`}>
            <span className="text-sm font-medium text-amber-950">Motivo de sustitución</span>
            <textarea aria-describedby={`quote-${actionName}-supersede-help`} className={`${adminInputClassName} min-h-24 bg-white py-3`} id={`quote-${actionName}-supersede-reason`} maxLength={500} name="supersedeReason" required />
            <span className={adminFieldHintClassName} id={`quote-${actionName}-supersede-help`}>El RPC bloquea la aceptación si cambió la cotización aceptada esperada.</span>
          </label>
        </fieldset>
      ) : null}
      {state.message ? <p className={state.ok ? "text-sm text-emerald-800" : "text-sm text-red-700"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      <button className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`} disabled={pending} type="submit">
        {pending ? pendingLabel : idleLabel}
      </button>
    </form>
  );
}

function DeleteQuoteForm({ quoteId, lockVersion }: Readonly<{ quoteId: string; lockVersion: number }>) {
  const [state, formAction, pending] = useActionState(softDeleteQuoteAction, initialQuoteActionState);
  const [idempotencyKey] = useState(() => createQuoteIdempotencyKey("quote_delete"));
  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <input name="quoteId" type="hidden" value={quoteId} />
      <input name="expectedLockVersion" type="hidden" value={lockVersion} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <p className="text-sm font-semibold text-red-950">Eliminación reversible</p>
      <label className="space-y-2" htmlFor="quote-delete-reason">
        <span className="text-sm font-medium text-red-950">Motivo</span>
        <textarea className={`${adminInputClassName} min-h-20 bg-white py-3`} id="quote-delete-reason" maxLength={500} name="reason" required />
      </label>
      <label className="space-y-2" htmlFor="quote-delete-confirmation">
        <span className="text-sm font-medium text-red-950">Escribe {quoteDeleteConfirmation}</span>
        <input aria-describedby="quote-delete-help" autoComplete="off" className={adminInputClassName} id="quote-delete-confirmation" name="confirmation" required />
        <span className="text-xs text-red-800" id="quote-delete-help">El historial, versiones y documentos no se borran permanentemente.</span>
      </label>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-800" : "text-sm text-red-800"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      <button className="min-h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Eliminando..." : "Eliminar cotización"}</button>
    </form>
  );
}

function RestoreQuoteForm({ quoteId, lockVersion }: Readonly<{ quoteId: string; lockVersion: number }>) {
  const [state, formAction, pending] = useActionState(restoreQuoteAction, initialQuoteActionState);
  const [idempotencyKey] = useState(() => createQuoteIdempotencyKey("quote_restore"));
  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <input name="quoteId" type="hidden" value={quoteId} />
      <input name="expectedLockVersion" type="hidden" value={lockVersion} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <label className="space-y-2" htmlFor="quote-restore-confirmation">
        <span className="text-sm font-medium text-emerald-950">Escribe {quoteRestoreConfirmation}</span>
        <input autoComplete="off" className={adminInputClassName} id="quote-restore-confirmation" name="confirmation" required />
      </label>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-800" : "text-sm text-red-800"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      <button className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Restaurando..." : "Restaurar cotización"}</button>
    </form>
  );
}

type QuoteLifecyclePanelProps = {
  quoteId: string;
  quoteVersionId: string;
  versionStatus: string;
  lockVersion: number;
  deleted: boolean;
  canMutate: boolean;
  acceptedQuoteToSupersede?: { id: string; number: string } | null;
};

export function QuoteLifecyclePanel({ quoteId, quoteVersionId, versionStatus, lockVersion, deleted, canMutate, acceptedQuoteToSupersede }: Readonly<QuoteLifecyclePanelProps>) {
  if (!canMutate) {
    return <p className="rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] p-4 text-sm" role="status">Tu rol tiene acceso de consulta y descarga, pero no puede modificar cotizaciones.</p>;
  }
  if (deleted) return <RestoreQuoteForm lockVersion={lockVersion} quoteId={quoteId} />;

  const active = ["draft", "ready", "sent"].includes(versionStatus);
  return (
    <section aria-labelledby="quote-lifecycle-title" className="space-y-5">
      <div>
        <h2 className="font-semibold" id="quote-lifecycle-title">Ciclo de la cotización</h2>
        <p className={adminFieldHintClassName}>Cada acción repite autorización, alcance, lock_version e idempotencia dentro del RPC.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {versionStatus === "draft" ? <WorkflowForm action={markQuoteReadyAction} actionName="ready" idleLabel="Marcar lista" lockVersion={lockVersion} pendingLabel="Validando PDF..." quoteId={quoteId} quoteVersionId={quoteVersionId} tone="primary" /> : null}
        {versionStatus === "ready" ? <WorkflowForm action={markQuoteSentAction} actionName="sent" idleLabel="Marcar enviada" lockVersion={lockVersion} pendingLabel="Marcando enviada..." quoteId={quoteId} quoteVersionId={quoteVersionId} tone="primary" /> : null}
        {["ready", "sent"].includes(versionStatus) ? <WorkflowForm acceptedQuoteToSupersede={acceptedQuoteToSupersede} action={acceptQuoteAction} actionName="accept" idleLabel="Aceptar cotización" lockVersion={lockVersion} pendingLabel="Aceptando..." quoteId={quoteId} quoteVersionId={quoteVersionId} tone="primary" /> : null}
        {active ? <WorkflowForm action={rejectQuoteAction} actionName="reject" idleLabel="Rechazar" lockVersion={lockVersion} pendingLabel="Rechazando..." quoteId={quoteId} quoteVersionId={quoteVersionId} tone="danger" /> : null}
        {["ready", "sent"].includes(versionStatus) ? <WorkflowForm action={expireQuoteAction} actionName="expire" idleLabel="Marcar expirada" lockVersion={lockVersion} pendingLabel="Expirando..." quoteId={quoteId} quoteVersionId={quoteVersionId} /> : null}
        {active ? <WorkflowForm action={cancelQuoteAction} actionName="cancel" idleLabel="Cancelar" lockVersion={lockVersion} pendingLabel="Cancelando..." quoteId={quoteId} quoteVersionId={quoteVersionId} tone="danger" /> : null}
      </div>
      <DeleteQuoteForm lockVersion={lockVersion} quoteId={quoteId} />
    </section>
  );
}
