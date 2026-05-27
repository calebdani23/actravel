import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getOperationOptions, getPayments, type PaymentRow } from "@/lib/admin/operations";
import { deletePaymentAction, upsertPaymentAction } from "../operations/actions";

type Options = Awaited<ReturnType<typeof getOperationOptions>>;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-MX", { style: "currency", currency }).format(amount);
}

function contactName(contact: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null) {
  return contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() || contact.email || contact.phone || "Contacto" : "—";
}

function Input({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue?: string | number | null; type?: string; required?: boolean }) {
  return <label className="space-y-1 text-sm font-medium"><span>{label}</span><input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} required={required} type={type} /></label>;
}

function PaymentForm({ payment, options }: { payment?: PaymentRow; options: Options }) {
  return (
    <form action={upsertPaymentAction} className="space-y-4 rounded-lg border p-4">
      {payment ? <input name="id" type="hidden" value={payment.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm font-medium"><span>Contacto</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.contact_id ?? ""} name="contact_id"><option value="">Sin contacto</option>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactName(contact)}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium"><span>Lead</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.lead_id ?? ""} name="lead_id"><option value="">Sin lead</option>{options.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.summary ?? lead.id.slice(0, 8)}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium"><span>Reserva</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.booking_id ?? ""} name="booking_id"><option value="">Sin reserva</option>{options.bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.booking_code ?? booking.id.slice(0, 8)} · {booking.status}</option>)}</select></label>
        <Input defaultValue={payment?.amount} label="Monto" name="amount" required type="number" />
        <label className="space-y-1 text-sm font-medium"><span>Moneda</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.currency ?? "MXN"} name="currency"><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
        <label className="space-y-1 text-sm font-medium"><span>Método</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.method_id ?? ""} name="method_id"><option value="">Sin método</option>{options.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label_es}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium"><span>Tipo</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.payment_type ?? "deposit"} name="payment_type"><option value="deposit">Anticipo</option><option value="partial">Parcial</option><option value="balance">Liquidación</option><option value="full">Total</option><option value="refund">Reembolso</option></select></label>
        <label className="space-y-1 text-sm font-medium"><span>Estado</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.status ?? "pending"} name="status"><option value="pending">Pendiente</option><option value="received">Recibido</option><option value="verified">Verificado</option><option value="rejected">Rechazado</option><option value="refunded">Reembolsado</option></select></label>
        <Input defaultValue={payment?.paid_at?.slice(0, 16)} label="Fecha pagado" name="paid_at" type="datetime-local" />
        <Input defaultValue={payment?.proof_bucket ?? "payment-proofs"} label="Bucket comprobante" name="proof_bucket" />
        <Input defaultValue={payment?.proof_path} label="Ruta comprobante" name="proof_path" />
        <label className="space-y-1 text-sm font-medium"><span>Notas</span><textarea className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" defaultValue={payment?.notes ?? ""} name="notes" /></label>
      </div>
      <div className="flex flex-wrap gap-2"><Button type="submit">{payment ? "Guardar pago" : "Crear pago"}</Button>{payment ? <Button formAction={deletePaymentAction} type="submit" variant="outline">Eliminar</Button> : null}</div>
    </form>
  );
}

export default async function PaymentsPage() {
  await requireAdminRole(["admin", "finanzas"]);
  const [{ payments, error }, options] = await Promise.all([getPayments(), getOperationOptions()]);
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Operaciones</p><h1 className="mt-2 text-3xl font-bold">Pagos</h1><p className="mt-2 text-muted-foreground">CRUD manual RLS-aware. Los comprobantes se gestionan por bucket/ruta; si existe ruta, se muestra URL firmada temporal.</p></div>{error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudieron cargar pagos: {error}</CardContent></Card> : null}<Card><CardHeader><CardTitle>Nuevo pago</CardTitle></CardHeader><CardContent><PaymentForm options={options} /></CardContent></Card><Card><CardHeader><CardTitle>{payments.length} pagos visibles</CardTitle></CardHeader><CardContent className="space-y-4">{payments.length ? payments.map((payment) => <details className="rounded-lg border p-4" key={payment.id}><summary className="cursor-pointer font-semibold">{money(payment.amount, payment.currency)} · {payment.status} <span className="ml-2 text-xs font-normal text-muted-foreground">{contactName(payment.contacts)} · {payment.payment_methods?.label_es ?? "sin método"} {payment.proof_url ? <a className="ml-2 text-[var(--ac-blue)] underline" href={payment.proof_url}>comprobante</a> : null}</span></summary><div className="mt-4"><PaymentForm options={options} payment={payment} /></div></details>) : <p className="text-sm text-muted-foreground">No hay pagos visibles para tu rol.</p>}</CardContent></Card></main>;
}
