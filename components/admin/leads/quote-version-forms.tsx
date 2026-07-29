"use client";

import { useActionState, useState } from "react";
import {
  createQuoteVersionAction,
} from "@/app/admin/(protected)/leads/[id]/quote-version-actions";
import {
  initialQuoteVersionActionState,
  type QuoteVersionActionState,
} from "@/app/admin/(protected)/leads/[id]/quote-version-action-state";
import { AlertBanner, adminFieldHintClassName, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { createQuoteVersionSubmissionKey } from "@/lib/admin/quote-versions";

type QuoteRequestOption = {
  id: string;
  createdAt: string;
  channelLabel: string;
  statusLabel: string;
};

type QuoteVersionCreateFormProps = {
  leadId: string;
  quoteRequests: QuoteRequestOption[];
};

function fieldError(state: QuoteVersionActionState, key: string) {
  return state?.fieldErrors?.[key]?.[0] ?? null;
}

export function QuoteVersionCreateDialog({ leadId, quoteRequests }: Readonly<QuoteVersionCreateFormProps>) {
  const [state, action] = useActionState(createQuoteVersionAction, initialQuoteVersionActionState);
  const [submissionKey] = useState(() => createQuoteVersionSubmissionKey());

  return (
    <OperationDialog
      description="Crea una propuesta comercial de AC Travel sin alterar el historial de solicitudes del cliente."
      title="Nueva cotización comercial"
      triggerLabel="Nueva cotización comercial"
    >
      <form action={action} className="space-y-5">
        <input name="leadId" type="hidden" value={leadId} />
        <input name="idempotencyKey" type="hidden" value={submissionKey} />
        {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2" htmlFor="quote-version-title">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Título</span>
            <input className={adminInputClassName} id="quote-version-title" name="title" required />
            {fieldError(state, "title") ? <p className="text-xs text-red-700">{fieldError(state, "title")}</p> : null}
          </label>

          <label className="space-y-2 sm:col-span-2" htmlFor="quote-version-summary">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Resumen comercial</span>
            <textarea className={`${adminInputClassName} min-h-24 py-3`} id="quote-version-summary" name="summary" />
          </label>

          <label className="space-y-2" htmlFor="quote-version-currency">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Moneda</span>
            <select className={adminSelectClassName} defaultValue="MXN" id="quote-version-currency" name="currency">
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
            {fieldError(state, "currency") ? <p className="text-xs text-red-700">{fieldError(state, "currency")}</p> : null}
          </label>

          <label className="space-y-2" htmlFor="quote-version-valid-until">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Vigencia</span>
            <input className={adminInputClassName} id="quote-version-valid-until" name="validUntil" type="date" />
            {fieldError(state, "validUntil") ? <p className="text-xs text-red-700">{fieldError(state, "validUntil")}</p> : null}
          </label>

          <label className="space-y-2" htmlFor="quote-version-total">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Total</span>
            <input className={adminInputClassName} id="quote-version-total" min="0" name="totalAmount" step="0.01" type="number" />
            {fieldError(state, "totalAmount") ? <p className="text-xs text-red-700">{fieldError(state, "totalAmount")}</p> : null}
          </label>

          <label className="space-y-2" htmlFor="quote-version-deposit">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Anticipo</span>
            <input className={adminInputClassName} id="quote-version-deposit" min="0" name="depositAmount" step="0.01" type="number" />
            {fieldError(state, "depositAmount") ? <p className="text-xs text-red-700">{fieldError(state, "depositAmount")}</p> : null}
          </label>

          <label className="space-y-2 sm:col-span-2" htmlFor="quote-version-request">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Solicitud del cliente relacionada (opcional)</span>
            <select className={adminSelectClassName} id="quote-version-request" name="quoteRequestId">
              <option value="">Sin vincular</option>
              {quoteRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.channelLabel} · {request.createdAt} · {request.statusLabel}
                </option>
              ))}
            </select>
            <p className={adminFieldHintClassName}>Esta relación solo referencia la solicitud original del cliente; no reemplaza su historial.</p>
          </label>

          <label className="space-y-2 sm:col-span-2" htmlFor="quote-version-notes">
            <span className="text-sm font-medium text-[color:var(--admin-foreground)]">Notas internas</span>
            <textarea className={`${adminInputClassName} min-h-28 py-3`} id="quote-version-notes" name="notes" />
          </label>
        </div>

        <div className="flex justify-end">
          <PendingSubmitButton idleLabel="Guardar borrador" pendingLabel="Guardando…" type="submit" />
        </div>
      </form>
    </OperationDialog>
  );
}

type QuoteVersionActionFormProps = {
  action: (state: QuoteVersionActionState, formData: FormData) => Promise<QuoteVersionActionState>;
  confirmMessage?: string;
  idleLabel: string;
  leadId: string;
  pendingLabel: string;
  quoteVersionId: string;
  variant?: "default" | "outline";
};

export function QuoteVersionActionForm({ action, confirmMessage, idleLabel, leadId, pendingLabel, quoteVersionId, variant = "outline" }: Readonly<QuoteVersionActionFormProps>) {
  const [state, formAction] = useActionState(action, initialQuoteVersionActionState);

  const form = (
    <form action={formAction} className="flex flex-col gap-2">
      <input name="leadId" type="hidden" value={leadId} />
      <input name="quoteVersionId" type="hidden" value={quoteVersionId} />
      {state.message ? <AlertBanner description={state.message} tone={state.ok ? "success" : "warning"} /> : null}
      <PendingSubmitButton idleLabel={idleLabel} pendingLabel={pendingLabel} size="sm" type="submit" variant={variant} />
    </form>
  );

  if (!confirmMessage) return form;

  const triggerClassName = variant === "outline"
    ? "border border-[color:var(--admin-border)] bg-transparent text-[color:var(--admin-foreground)] hover:bg-[color:var(--admin-surface-muted)]"
    : undefined;

  return (
    <OperationDialog
      description={confirmMessage}
      title={idleLabel}
      triggerClassName={triggerClassName}
      triggerLabel={idleLabel}
    >
      <div className="space-y-4">
        <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4 text-sm text-[color:var(--admin-foreground)]">
          {confirmMessage}
        </div>
        {form}
      </div>
    </OperationDialog>
  );
}
