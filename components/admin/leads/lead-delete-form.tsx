"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteLeadAction } from "@/app/admin/(protected)/leads/[id]/actions";
import { initialLeadDeleteActionState } from "@/app/admin/(protected)/leads/[id]/lead-delete-action-state";
import { AlertBanner } from "@/components/admin/admin-primitives";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

type LeadDeleteFormProps = {
  canDeleteOrphanContact: boolean;
  leadId: string;
  returnToQuery: string;
};

function DeleteOrphanContactField({ canDeleteOrphanContact, defaultChecked, hasError }: Readonly<{ canDeleteOrphanContact: boolean; defaultChecked: boolean; hasError: boolean }>) {
  const { pending } = useFormStatus();
  const helpId = "lead-delete-contact-help";
  const errorId = hasError ? "lead-delete-status" : undefined;

  if (!canDeleteOrphanContact) return null;

  return (
    <div className="rounded-[var(--admin-radius-control)] border border-red-200 bg-white/70 p-3">
      <label className="flex items-start gap-3 text-sm text-red-900" htmlFor="deleteOrphanContact">
        <input
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
          className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
          defaultChecked={defaultChecked}
          disabled={pending}
          id="deleteOrphanContact"
          name="deleteOrphanContact"
          type="checkbox"
          value="on"
        />
        <span>
          <span className="font-medium">Eliminar también el contacto si queda huérfano</span>
          <span className="mt-1 block text-red-800" id={helpId}>Solo disponible cuando no existen otras oportunidades ni historial material relacionado.</span>
        </span>
      </label>
    </div>
  );
}

export function LeadDeleteForm({ canDeleteOrphanContact, leadId, returnToQuery }: Readonly<LeadDeleteFormProps>) {
  const [state, action] = useActionState(deleteLeadAction, initialLeadDeleteActionState);
  const statusId = state.message ? "lead-delete-status" : undefined;

  return (
    <form action={action} className="space-y-4">
      <input name="leadId" type="hidden" value={leadId} />
      <input name="returnToQuery" type="hidden" value={returnToQuery} />

      <div className="rounded-[var(--admin-radius-control)] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">Purga permanente de datos de prueba</p>
        <p className="mt-2">Esta acción solo purga una oportunidad marcada como dato de prueba y sin historial material. No es la acción normal de eliminar del CRM. Por defecto, el contacto canónico se conservará.</p>
        <p className="mt-2">Si necesitas conservar contexto comercial u operativo, recomendamos preservar o archivar la oportunidad en lugar de borrarla.</p>
      </div>

      <label className="block space-y-2 text-sm font-medium text-red-900" htmlFor="purgeConfirmation">
        <span>Escribe <strong>PURGAR DATOS DE PRUEBA</strong> para confirmar</span>
        <input aria-describedby="lead-delete-status" className="w-full rounded-md border border-red-300 bg-white px-3 py-2" id="purgeConfirmation" name="confirmation" placeholder="PURGAR DATOS DE PRUEBA" required type="text" />
      </label>

      <DeleteOrphanContactField canDeleteOrphanContact={canDeleteOrphanContact} defaultChecked={state.contactDeleteRequested} hasError={Boolean(state.message)} />

      {state.message ? (
        <div id={statusId}>
          <AlertBanner
            description={(
              <div className="space-y-2">
                <p>{state.message}</p>
                {state.blockerMessages.length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {state.blockerMessages.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
              </div>
            )}
            tone={state.ok ? "success" : "warning"}
          />
        </div>
      ) : null}

      <div className="flex justify-end">
        <PendingSubmitButton
          className="border-red-200 bg-red-600 text-white hover:bg-red-700"
          idleLabel="Eliminar oportunidad"
          pendingLabel="Eliminando…"
          type="submit"
          variant="outline"
        />
      </div>
    </form>
  );
}
