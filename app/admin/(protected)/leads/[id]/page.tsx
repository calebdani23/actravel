import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { hasAnyRole } from "@/lib/supabase/roles";
import { getAdvisors, getLeadDetail, getLeadStatuses } from "@/lib/admin/leads";
import { addLeadNoteAction, assignLeadAction, updateLeadStatusAction } from "./actions";

type PageProps = { params: Promise<{ id: string }> };

function money(mxn?: number | null, usd?: number | null) {
  if (mxn !== null && mxn !== undefined) return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mxn);
  if (usd !== null && usd !== undefined) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
  return "—";
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value || "—"}</dd></div>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, requireAdminRole(["admin", "asesor"])]);
  const [{ lead, notes, events, payments, bookings, documents, error }, statuses, advisors] = await Promise.all([
    getLeadDetail(id),
    getLeadStatuses(),
    getAdvisors(),
  ]);

  if (!lead && !error) notFound();
  const canAssign = hasAnyRole(session.roles, ["admin"]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--ac-blue)] hover:underline" href="/admin/leads">← Volver a leads</Link>
          <h1 className="mt-2 text-3xl font-bold">{[lead?.contacts?.first_name, lead?.contacts?.last_name].filter(Boolean).join(" ") || "Lead"}</h1>
          <p className="mt-2 text-muted-foreground">{lead?.summary ?? "Detalle de seguimiento interno."}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold">{lead?.lead_statuses?.label_es ?? "Sin estado"}</span>
      </div>

      {error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudo cargar el lead: {error}</CardContent></Card> : null}
      {!lead ? null : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Datos del lead</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-4 md:grid-cols-3">
                  <Field label="Email" value={lead.contacts?.email} />
                  <Field label="WhatsApp" value={lead.contacts?.phone} />
                  <Field label="Idioma" value={lead.contacts?.preferred_locale?.toUpperCase()} />
                  <Field label="Destino" value={lead.destinations?.name_es} />
                  <Field label="Servicio" value={lead.services?.name_es} />
                  <Field label="Viaje" value={`${lead.travel_start_date ?? "—"} → ${lead.travel_end_date ?? "—"}`} />
                  <Field label="Viajeros" value={lead.travelers_count} />
                  <Field label="Budget" value={money(lead.budget_mxn, lead.budget_usd)} />
                  <Field label="Canal" value={lead.source} />
                  <Field label="Prioridad" value={lead.priority} />
                  <Field label="Asesor" value={lead.profiles?.full_name ?? "Sin asignar"} />
                  <Field label="Actualizado" value={new Date(lead.updated_at).toLocaleString("es-MX")} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Acciones rápidas</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <form action={updateLeadStatusAction} className="space-y-2">
                  <input name="leadId" type="hidden" value={lead.id} />
                  <label className="text-sm font-medium" htmlFor="statusId">Cambiar estado</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={lead.lead_statuses?.id ?? ""} id="statusId" name="statusId">
                    {statuses.map((status) => <option key={status.id} value={status.id}>{status.label_es}</option>)}
                  </select>
                  <Button className="w-full" type="submit">Guardar estado</Button>
                </form>

                {canAssign ? (
                  <form action={assignLeadAction} className="space-y-2">
                    <input name="leadId" type="hidden" value={lead.id} />
                    <label className="text-sm font-medium" htmlFor="advisorId">Asignar asesor</label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={lead.profiles?.id ?? ""} id="advisorId" name="advisorId">
                      <option value="">Sin asignar</option>
                      {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
                    </select>
                    <Button className="w-full" type="submit" variant="outline">Guardar asignación</Button>
                  </form>
                ) : null}

                <form action={addLeadNoteAction} className="space-y-2">
                  <input name="leadId" type="hidden" value={lead.id} />
                  <label className="text-sm font-medium" htmlFor="body">Nota interna</label>
                  <textarea className="min-h-28 w-full rounded-md border px-3 py-2 text-sm" id="body" name="body" required />
                  <Button className="w-full" type="submit">Agregar nota</Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Notas</CardTitle></CardHeader><CardContent>{notes.length ? <ul className="space-y-3 text-sm">{notes.map((note) => <li key={note.id} className="rounded-md border p-3"><p>{note.body}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString("es-MX")}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin notas visibles.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Eventos</CardTitle></CardHeader><CardContent>{events.length ? <ul className="space-y-3 text-sm">{events.map((event) => <li key={event.id} className="rounded-md border p-3"><p className="font-semibold">{event.event_type}</p><p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("es-MX")}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin eventos visibles.</p>}</CardContent></Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle>Pagos</CardTitle></CardHeader><CardContent>{payments.length ? <ul className="space-y-2 text-sm">{payments.map((payment) => <li key={payment.id} className="flex justify-between border-b pb-2"><span>{payment.payment_type} · {payment.status}</span><span>{money(payment.currency === "MXN" ? payment.amount : null, payment.currency === "USD" ? payment.amount : null)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin pagos visibles.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Reservas</CardTitle></CardHeader><CardContent>{bookings.length ? <ul className="space-y-2 text-sm">{bookings.map((booking) => <li key={booking.id} className="border-b pb-2"><p className="font-medium">{booking.booking_code ?? booking.id.slice(0, 8)}</p><p className="text-muted-foreground">{booking.status} · {booking.starts_on ?? "—"}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin reservas visibles.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Documentos</CardTitle></CardHeader><CardContent>{documents.length ? <ul className="space-y-2 text-sm">{documents.map((document) => <li key={document.id} className="border-b pb-2"><p className="font-medium">{document.title}</p><p className="text-muted-foreground">{document.document_type} · {document.status}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin documentos visibles.</p>}</CardContent></Card>
          </section>
        </>
      )}
    </main>
  );
}
