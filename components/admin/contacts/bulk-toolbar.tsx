"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { useContactSelectionContext } from "@/components/admin/contacts/contact-selection";
import { archiveOpportunities, deleteRestoreOpportunities, restoreContacts, unblockContacts, unfeatureOpportunities, updateContactLifecycle, updateOpportunityStatus, unarchiveOpportunities, type BulkCrmActionState } from "@/app/admin/(protected)/contacts/actions";

type Action = (state: BulkCrmActionState, formData: FormData) => Promise<BulkCrmActionState>;
const initial: BulkCrmActionState = { ok: false, message: "" };

function ActionForm({ action, ids, label, confirmation, restore = false, hiddenField, contactId }: Readonly<{ action: Action; ids: readonly string[]; label: string; confirmation?: string; restore?: boolean; hiddenField?: { name: string; value: string }; contactId?: string }>) {
  const [state, formAction, pending] = useActionState(action, initial);
  const form = <form action={formAction} className="flex flex-wrap items-center gap-2"><input name="ids" type="hidden" value={JSON.stringify(ids)} />{contactId ? <input name="contactId" type="hidden" value={contactId} /> : null}{restore ? <input name="restore" type="hidden" value="true" /> : null}{hiddenField ? <input name={hiddenField.name} type="hidden" value={hiddenField.value} /> : null}{confirmation ? <input name="confirmation" required type="text" placeholder={confirmation} aria-label={confirmation} /> : null}<Button disabled={pending} size="sm" type="submit" variant="outline">{pending ? "Procesando…" : label}</Button>{state.message ? <span className={state.ok ? "text-sm text-emerald-700" : "text-sm text-amber-700"} role="status">{state.message}</span> : null}</form>;
  return confirmation ? <OperationDialog triggerLabel={label} title="Confirmar operación" description={`Escribe ${confirmation} para confirmar. La selección se valida nuevamente en el servidor.`}>{form}</OperationDialog> : form;
}

export function SoftDeleteOpportunityForm({ opportunityId, contactId, action }: Readonly<{ opportunityId: string; contactId?: string; action: Action }>) {
  const [state, formAction, pending] = useActionState(action, initial);
  return <OperationDialog triggerLabel="Eliminar del CRM" title="Confirmar eliminación del CRM" description="Escribe ELIMINAR para confirmar. El historial se conserva y el servidor vuelve a validar la oportunidad."><form action={formAction} className="flex flex-wrap items-center gap-2"><input name="ids" type="hidden" value={JSON.stringify([opportunityId])} />{contactId ? <input name="contactId" type="hidden" value={contactId} /> : null}<label className="text-xs"><span className="sr-only">Confirmación</span><input aria-label="Escribe ELIMINAR para confirmar" name="confirmation" placeholder="ELIMINAR" required type="text" /></label><Button disabled={pending} size="sm" type="submit" variant="outline">{pending ? "Procesando…" : "Confirmar"}</Button>{state.message ? <span className={state.ok ? "text-sm text-emerald-700" : "text-sm text-amber-700"} role="status">{state.message}</span> : null}</form></OperationDialog>;
}

export function RestoreOpportunityForm({ opportunityId, contactId, action }: Readonly<{ opportunityId: string; contactId?: string; action: Action }>) {
  const [state, formAction, pending] = useActionState(action, initial);
  return <OperationDialog triggerLabel="Restaurar oportunidad" title="Restaurar oportunidad" description="La restauración vuelve a hacer visible la oportunidad. El servidor valida nuevamente el registro."><form action={formAction} className="flex flex-wrap items-center gap-2"><input name="ids" type="hidden" value={JSON.stringify([opportunityId])} />{contactId ? <input name="contactId" type="hidden" value={contactId} /> : null}<input name="restore" type="hidden" value="true" /><input aria-label="Escribe RESTAURAR para confirmar" name="confirmation" placeholder="RESTAURAR" required type="text" /><Button disabled={pending} size="sm" type="submit" variant="outline">{pending ? "Procesando…" : "Confirmar"}</Button>{state.message ? <span className="text-sm" role="status">{state.message}</span> : null}</form></OperationDialog>;
}

export function ContactBulkToolbar({ selected: selectedProp, blockAction, deleteAction, lifecycleAction = updateContactLifecycle, isAdmin = true }: Readonly<{ selected?: readonly string[]; blockAction: Action; deleteAction: Action; lifecycleAction?: Action; isAdmin?: boolean }>) {
  const selection = useContactSelectionContext();
  const selected = selectedProp ?? selection?.selected ?? [];
  if (!isAdmin || !selected.length) return null;
  const confirmation = selected.length === 1 ? "ELIMINAR" : `ELIMINAR ${selected.length}`;
  return <div className="flex flex-wrap items-center gap-2 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] p-3"><span className="text-sm font-medium">{selected.length} seleccionado(s)</span>{lifecycleAction ? <LifecycleBulkForm action={lifecycleAction} ids={selected} /> : null}<ActionForm action={blockAction} ids={selected} label="Bloquear" /><ActionForm action={unblockContacts} ids={selected} label="Desbloquear" /><ActionForm action={deleteAction} ids={selected} label="Eliminar del CRM" confirmation={confirmation} /><ActionForm action={restoreContacts} ids={selected} label="Restaurar" restore confirmation="RESTAURAR" /></div>;
}

export function LifecycleBulkForm({ action, ids }: Readonly<{ action: Action; ids: readonly string[] }>) {
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} className="flex flex-wrap items-center gap-2"><input name="ids" type="hidden" value={JSON.stringify(ids)} /><select aria-label="Cambiar ciclo de vida" className="h-9 rounded-md border px-2 text-sm" defaultValue="active" name="lifecycle"><option value="active">Activo</option><option value="follow_up">Seguimiento</option><option value="customer">Cliente</option><option value="inactive">Inactivo</option><option value="blocked">Bloqueado</option></select><Button disabled={pending} size="sm" type="submit" variant="outline">Cambiar ciclo</Button>{state.message ? <span className="text-xs" role="status">{state.message}</span> : null}</form>;
}

export function StatusBulkForm({ action, ids, statuses, contactId }: Readonly<{ action: Action; ids: readonly string[]; statuses: Array<{ id: string; label_es: string }>; contactId?: string }>) {
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} className="flex flex-wrap items-center gap-2"><input name="ids" type="hidden" value={JSON.stringify(ids)} />{contactId ? <input name="contactId" type="hidden" value={contactId} /> : null}<select aria-label="Cambiar estado de oportunidad" className="h-9 rounded-md border px-2 text-sm" defaultValue={statuses[0]?.id ?? ""} name="statusId">{statuses.map((status) => <option key={status.id} value={status.id}>{status.label_es}</option>)}</select><Button disabled={pending} size="sm" type="submit" variant="outline">Cambiar estado</Button>{state.message ? <span className="text-xs" role="status">{state.message}</span> : null}</form>;
}

export function OpportunityBulkToolbar({ selected: selectedProp, featureAction, deleteAction, statusAction = updateOpportunityStatus, statuses = [], isAdmin = true, contactId }: Readonly<{ selected?: readonly string[]; featureAction: Action; deleteAction: Action; statusAction?: Action; statuses?: Array<{ id: string; label_es: string }>; isAdmin?: boolean; contactId?: string }>) {
  const selection = useContactSelectionContext();
  const selected = selectedProp ?? selection?.selected ?? [];
  if (!isAdmin || !selected.length) return null;
  const confirmation = selected.length === 1 ? "ELIMINAR" : `ELIMINAR ${selected.length}`;
  return <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{selected.length} oportunidad(es)</span>{statuses.length ? <StatusBulkForm action={statusAction} contactId={contactId} ids={selected} statuses={statuses} /> : null}<ActionForm action={featureAction} contactId={contactId} ids={selected} label="Destacar" /><ActionForm action={unfeatureOpportunities} contactId={contactId} ids={selected} label="Quitar destacada" hiddenField={{ name: "featured", value: "false" }} /><ActionForm action={archiveOpportunities} contactId={contactId} ids={selected} label="Archivar" /><ActionForm action={unarchiveOpportunities} contactId={contactId} ids={selected} label="Desarchivar" hiddenField={{ name: "archived", value: "false" }} /><ActionForm action={deleteAction} contactId={contactId} ids={selected} label="Eliminar del CRM" confirmation={confirmation} /><ActionForm action={deleteRestoreOpportunities} contactId={contactId} ids={selected} label="Restaurar" restore confirmation="RESTAURAR" /></div>;
}
