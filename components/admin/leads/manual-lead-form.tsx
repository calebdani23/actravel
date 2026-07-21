"use client";

import { useActionState } from "react";
import { createManualLeadAction, type ManualLeadActionState } from "@/app/admin/(protected)/leads/new/actions";
import { manualLeadPriorityValues, manualLeadSourceValues } from "@/lib/validations/manual-lead";

const initialState: ManualLeadActionState = { ok: false, message: null, fieldErrors: {} };

const priorityLabels: Record<(typeof manualLeadPriorityValues)[number], string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const sourceLabels: Record<(typeof manualLeadSourceValues)[number], string> = {
  manual_admin: "Captura administrativa",
  manual_asesor: "Captura de asesor",
  phone_call: "Llamada telefónica",
  whatsapp_manual: "WhatsApp manual",
  instagram_dm: "Mensaje directo de Instagram",
  referral: "Referido",
  walk_in: "Visita en sucursal",
};

function SubmitButton() {
  return <button className="rounded-md bg-[var(--ac-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" type="submit">Crear prospecto</button>;
}

function fieldError(state: ManualLeadActionState, key: string) {
  return state.fieldErrors[key]?.[0] ?? null;
}

export function ManualLeadForm({ advisors, allowAssignment, defaultSource }: { advisors: Array<{ id: string; full_name: string }>; allowAssignment: boolean; defaultSource: string }) {
  const [state, action] = useActionState(createManualLeadAction, initialState);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium" htmlFor="name">Nombre</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="name" name="name" required />
        {fieldError(state, "name") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "name")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="source">Origen</label>
        <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultSource} id="source" name="source">
          {manualLeadSourceValues.map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="phone">WhatsApp / teléfono</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="phone" name="phone" />
        {fieldError(state, "phone") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "phone")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="email">Correo electrónico</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="email" name="email" type="email" />
        {fieldError(state, "email") ? <p className="mt-1 text-xs text-red-700">{fieldError(state, "email")}</p> : null}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="priority">Prioridad</label>
        <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue="normal" id="priority" name="priority">
          {manualLeadPriorityValues.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
        </select>
      </div>
      {allowAssignment ? (
        <div>
          <label className="text-sm font-medium" htmlFor="assignedTo">Asignación</label>
          <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="assignedTo" name="assignedTo">
            <option value="">Sin asignar</option>
            {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
          </select>
        </div>
      ) : null}
      <div>
        <label className="text-sm font-medium" htmlFor="destination">Destino</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="destination" name="destination" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="service">Servicio</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="service" name="service" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="travelStartDate">Salida</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="travelStartDate" name="travelStartDate" type="date" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="travelEndDate">Regreso</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="travelEndDate" name="travelEndDate" type="date" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="travelersCount">Viajeros</label>
        <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={1} id="travelersCount" min={1} name="travelersCount" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium" htmlFor="budgetAmount">Presupuesto</label>
          <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" id="budgetAmount" min={0} name="budgetAmount" type="number" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="budgetCurrency">Moneda</label>
          <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue="MXN" id="budgetCurrency" name="budgetCurrency">
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div className="md:col-span-2">
        <label className="text-sm font-medium" htmlFor="notes">Notas internas</label>
        <textarea className="mt-1 min-h-32 w-full rounded-md border px-3 py-2 text-sm" id="notes" name="notes" />
      </div>
      {state.message ? <p className="md:col-span-2 text-sm text-red-700">{state.message}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
