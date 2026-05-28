import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getDocuments, getOperationOptions, type DocumentRow } from "@/lib/admin/operations";
import { STORAGE_UPLOAD_ACCEPT, STORAGE_UPLOAD_CONFIG } from "@/lib/admin/storage-uploads";
import { deleteDocumentAction, upsertDocumentAction } from "../actions";

type Options = Awaited<ReturnType<typeof getOperationOptions>>;

function contactName(contact: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null) {
  return contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() || contact.email || contact.phone || "Contacto" : "—";
}

function Input({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return <label className="space-y-1 text-sm font-medium"><span>{label}</span><input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} required={required} /></label>;
}

function DocumentForm({ document, options }: { document?: DocumentRow; options: Options }) {
  return (
    <form action={upsertDocumentAction} className="space-y-4 rounded-lg border p-4">
      {document ? <input name="id" type="hidden" value={document.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Input defaultValue={document?.title} label="Título" name="title" required />
        <label className="space-y-1 text-sm font-medium"><span>Tipo</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={document?.document_type ?? "other"} name="document_type"><option value="itinerary">Itinerario</option><option value="voucher">Voucher</option><option value="invoice">Factura</option><option value="identification">Identificación</option><option value="contract">Contrato</option><option value="other">Otro</option></select></label>
        <label className="space-y-1 text-sm font-medium"><span>Estado</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={document?.status ?? "draft"} name="status"><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Archivado</option></select></label>
        <label className="space-y-1 text-sm font-medium"><span>Contacto</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={document?.contact_id ?? ""} name="contact_id"><option value="">Sin contacto</option>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactName(contact)}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium"><span>Lead</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={document?.lead_id ?? ""} name="lead_id"><option value="">Sin lead</option>{options.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.summary ?? lead.id.slice(0, 8)}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium"><span>Reserva</span><select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={document?.booking_id ?? ""} name="booking_id"><option value="">Sin reserva</option>{options.bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.booking_code ?? booking.id.slice(0, 8)} · {booking.status}</option>)}</select></label>
        {!document ? (
          <label className="space-y-1 text-sm font-medium md:col-span-3">
            <span>Archivo</span>
            <input accept={STORAGE_UPLOAD_ACCEPT} className="w-full rounded-md border px-3 py-2 text-sm" name="document_file" required type="file" />
            <span className="block text-xs font-normal text-muted-foreground">{STORAGE_UPLOAD_CONFIG.documents.helpText}. La ruta segura se genera automáticamente.</span>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground md:col-span-3">Este primer corte permite editar metadatos; reemplazar archivo se atenderá después. {document.document_preview_url ? "El archivo actual tiene enlace firmado disponible." : "Sin archivo firmado disponible."}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2"><Button type="submit">{document ? "Guardar documento" : "Crear documento"}</Button>{document ? <Button formAction={deleteDocumentAction} type="submit" variant="outline">Eliminar</Button> : null}</div>
    </form>
  );
}

function DocumentLinks({ document }: { document: DocumentRow }) {
  if (!document.document_preview_url && !document.document_download_url) return <span className="text-xs text-muted-foreground">Sin archivo adjunto disponible</span>;
  return <span className="inline-flex gap-2">{document.document_preview_url ? <a className="text-[var(--ac-blue)] underline" href={document.document_preview_url} rel="noreferrer" target="_blank">Vista previa</a> : null}{document.document_download_url ? <a className="text-[var(--ac-blue)] underline" download href={document.document_download_url}>Descargar</a> : null}</span>;
}

export default async function DocumentsPage() {
  await requireAdminRole(["admin", "operaciones"]);
  const [{ documents, error }, options] = await Promise.all([getDocuments(), getOperationOptions()]);
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Operaciones</p><h1 className="mt-2 text-3xl font-bold">Documentos</h1><p className="mt-2 text-muted-foreground">Sube archivos privados reales con validación de tipo/tamaño, rutas seguras automáticas y URLs firmadas temporales.</p><Link className="mt-2 inline-block text-sm text-[var(--ac-blue)] underline" href="/admin/operations/bookings">Ir a reservas</Link></div>{error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudieron cargar documentos: {error}</CardContent></Card> : null}<Card><CardHeader><CardTitle>Nuevo documento</CardTitle></CardHeader><CardContent><DocumentForm options={options} /></CardContent></Card><Card><CardHeader><CardTitle>{documents.length} documentos visibles</CardTitle></CardHeader><CardContent className="space-y-4">{documents.length ? documents.map((document) => <details className="rounded-lg border p-4" key={document.id}><summary className="cursor-pointer font-semibold">{document.title} · {document.status} <span className="ml-2 text-xs font-normal text-muted-foreground">{document.document_type} · {contactName(document.contacts)} · <DocumentLinks document={document} /></span></summary><div className="mt-4"><DocumentForm document={document} options={options} /></div></details>) : <p className="text-sm text-muted-foreground">No hay documentos visibles para tu rol.</p>}</CardContent></Card></main>;
}
