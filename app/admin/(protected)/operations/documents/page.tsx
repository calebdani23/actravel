import Link from "next/link";
import { RefreshCcw, Search } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageContainer,
  PageHeader,
  QuietActionButton,
  SectionCard,
  StatusBadge,
  adminFieldHintClassName,
  adminInputClassName,
  adminSelectClassName,
} from "@/components/admin/admin-primitives";
import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { PrivateFileInput } from "@/components/admin/operations/private-file-input";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDate, formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { buildAdminSearchQueryString } from "@/lib/admin/navigation";
import { getDocuments, getOperationOptions, type DocumentRow } from "@/lib/admin/operations";
import {
  bookingDisplayName,
  bookingStatusLabel,
  contactDisplayName,
  documentRelationLabel,
  documentStatusLabel,
  documentStatusTone,
  documentTypeLabel,
  filterDocuments,
  leadDisplayName,
  type DocumentFilters,
} from "@/lib/admin/operations-view";
import { STORAGE_UPLOAD_ACCEPT, STORAGE_UPLOAD_CONFIG } from "@/lib/admin/storage-uploads";
import { deleteDocumentAction, upsertDocumentAction } from "../actions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Options = Awaited<ReturnType<typeof getOperationOptions>>;

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function latestUpdate(documents: DocumentRow[]) {
  return documents.reduce<string | null>((latest, document) => {
    if (!latest || document.updated_at > latest) return document.updated_at;
    return latest;
  }, null);
}

function isCurrentMonth(document: DocumentRow) {
  const now = new Date();
  const created = new Date(document.created_at);
  return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
}

function DocumentForm({ document, options }: Readonly<{ document?: DocumentRow; options: Options }>) {
  const prefix = document?.id ?? "new-document";

  return (
    <form action={upsertDocumentAction} className="space-y-5">
      {document ? <input name="id" type="hidden" value={document.id} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Documento</h3>
            <p className={adminFieldHintClassName}>Se conserva el mismo título, tipo y estado con etiquetas seguras para operación.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2 md:col-span-3" htmlFor={`${prefix}-title`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Título</span>
              <input className={adminInputClassName} defaultValue={document?.title ?? ""} id={`${prefix}-title`} name="title" required />
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-type`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Tipo</span>
              <select className={adminSelectClassName} defaultValue={document?.document_type ?? "other"} id={`${prefix}-type`} name="document_type">
                <option value="itinerary">Itinerario</option>
                <option value="voucher">Voucher</option>
                <option value="invoice">Factura</option>
                <option value="identification">Identificación</option>
                <option value="contract">Contrato</option>
                <option value="other">Otro</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-status`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={document?.status ?? "draft"} id={`${prefix}-status`} name="status">
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Relación operativa</h3>
            <p className={adminFieldHintClassName}>La vinculación con contacto, prospecto o reserva se mantiene al guardar.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2" htmlFor={`${prefix}-contact`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Contacto</span>
              <select className={adminSelectClassName} defaultValue={document?.contact_id ?? ""} id={`${prefix}-contact`} name="contact_id">
                <option value="">Sin contacto</option>
                {options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactDisplayName(contact)}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-lead`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Prospecto</span>
              <select className={adminSelectClassName} defaultValue={document?.lead_id ?? ""} id={`${prefix}-lead`} name="lead_id">
                <option value="">Sin prospecto</option>
                {options.leads.map((lead) => <option key={lead.id} value={lead.id}>{leadDisplayName(lead)}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-booking`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Reserva</span>
              <select className={adminSelectClassName} defaultValue={document?.booking_id ?? ""} id={`${prefix}-booking`} name="booking_id">
                <option value="">Sin reserva</option>
                {options.bookings.map((booking) => <option key={booking.id} value={booking.id}>{bookingDisplayName(booking)} · {bookingStatusLabel(booking.status)}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Archivo privado</h3>
          <p className={adminFieldHintClassName}>La vista no expone ubicaciones internas ni enlaces permanentes. Solo muestra accesos temporales cuando existen.</p>
        </div>

        <PrivateFileInput
          accept={STORAGE_UPLOAD_ACCEPT}
          helpText={STORAGE_UPLOAD_CONFIG.documents.helpText}
          label={document ? "Reemplazar archivo (opcional)" : "Archivo"}
          maxSizeBytes={STORAGE_UPLOAD_CONFIG.documents.maxSizeBytes}
          name="document_file"
          replacementHelpText={document ? "Si eliges uno nuevo, el archivo anterior se limpia automáticamente después de guardar." : "El documento privado se prepara automáticamente al guardar."}
          required={!document}
        />
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {document ? <Button formAction={deleteDocumentAction} type="submit" variant="outline">Eliminar documento</Button> : null}
        <Button type="submit">{document ? "Guardar documento" : "Registrar documento"}</Button>
      </div>
    </form>
  );
}

function DocumentLinks({ document }: Readonly<{ document: DocumentRow }>) {
  if (!document.document_preview_url && !document.document_download_url) return <span className="text-sm text-[color:var(--admin-muted-foreground)]">Sin archivo temporal disponible</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {document.document_preview_url ? <Button asChild size="sm" variant="outline"><a href={document.document_preview_url} rel="noreferrer" target="_blank">Vista previa</a></Button> : null}
      {document.document_download_url ? <Button asChild size="sm" variant="outline"><a download href={document.document_download_url}>Descargar</a></Button> : null}
    </div>
  );
}

function ActiveFilterChips({ filters }: Readonly<{ filters: DocumentFilters }>) {
  const relationLabel = filters.relation === "contact" ? "Contacto" : filters.relation === "lead" ? "Prospecto" : filters.relation === "booking" ? "Reserva" : filters.relation === "quote" ? "Cotización" : null;
  const chips = [
    filters.q ? `Búsqueda: ${filters.q}` : null,
    filters.type ? `Tipo: ${documentTypeLabel(filters.type)}` : null,
    filters.status ? `Estado: ${documentStatusLabel(filters.status)}` : null,
    relationLabel ? `Relación: ${relationLabel}` : null,
    filters.from ? `Desde: ${formatAdminDate(filters.from)}` : null,
    filters.to ? `Hasta: ${formatAdminDate(filters.to)}` : null,
  ].filter(Boolean) as string[];

  if (!chips.length) return null;
  return <div aria-label="Filtros activos" className="flex flex-wrap gap-2">{chips.map((chip) => <StatusBadge className="font-medium" key={chip}>{chip}</StatusBadge>)}</div>;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  await requireAdminRole(["admin", "operaciones"]);
  const [params, { documents, error }, options] = await Promise.all([searchParams, getDocuments(), getOperationOptions()]);

  const filters: DocumentFilters = {
    q: value(params, "q"),
    type: value(params, "type"),
    status: value(params, "status"),
    relation: value(params, "relation"),
    from: value(params, "from"),
    to: value(params, "to"),
  };

  if (error) console.error("Documents view partial load", { error });

  const filteredDocuments = filterDocuments(documents, filters);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const updatedAt = latestUpdate(filteredDocuments.length ? filteredDocuments : documents);
  const currentQuery = buildAdminSearchQueryString(params);
  const active = filteredDocuments.filter((document) => document.status === "active");
  const drafts = filteredDocuments.filter((document) => document.status === "draft");
  const uploadedThisMonth = filteredDocuments.filter(isCurrentMonth);

  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            {updatedAt ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">Actualizado {formatAdminDateTime(updatedAt)}</p> : null}
            <QuietActionButton asChild>
              <Link href={`/admin/operations/documents${currentQuery}`}><RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />Actualizar</Link>
            </QuietActionButton>
            <OperationDialog description="La carga conserva autorización, enlaces temporales, limpieza segura y validación privada del archivo." title="Registrar documento" triggerLabel="Registrar documento">
              <DocumentForm options={options} />
            </OperationDialog>
          </>
        }
        breadcrumbs={[{ label: "Operaciones", href: "/admin/dashboard" }, { label: "Documentos" }]}
        description="Centro seguro para localizar archivos operativos y proyectar PDF canónicos de cotización en modo de solo lectura."
        eyebrow="Operaciones"
        title="Documentos"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Archivos visibles para tu sesión operativa actual." label="Visibles" tone="brand" value={formatAdminInteger(filteredDocuments.length)} />
        <MetricCard detail="Documentos activos disponibles para consulta o entrega." label="Activos" tone={active.length ? "success" : "neutral"} value={formatAdminInteger(active.length)} />
        <MetricCard detail="Documentos creados durante el mes actual." label="Cargados este mes" tone={uploadedThisMonth.length ? "info" : "neutral"} value={formatAdminInteger(uploadedThisMonth.length)} />
        <MetricCard detail="Archivos todavía en preparación interna." label="Borradores" tone={drafts.length ? "warning" : "success"} value={formatAdminInteger(drafts.length)} />
      </section>

      <SectionCard actions={activeFilters ? <QuietActionButton asChild><Link href="/admin/operations/documents">Limpiar filtros</Link></QuietActionButton> : null} description="Puedes refinar por nombre, tipo, estado, relación y fecha sin exponer detalles técnicos del almacenamiento privado." title="Filtros de documentos">
        <form className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))_auto]">
            <label className="space-y-2" htmlFor="documents-search">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Buscar</span>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--admin-muted-foreground)]" />
                <input className={`${adminInputClassName} pl-9`} defaultValue={filters.q ?? ""} id="documents-search" name="q" placeholder="Documento, contacto, prospecto o reserva" />
              </div>
            </label>

            <label className="space-y-2" htmlFor="documents-type">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Tipo</span>
              <select className={adminSelectClassName} defaultValue={filters.type ?? ""} id="documents-type" name="type">
                <option value="">Todos</option>
                <option value="itinerary">Itinerario</option>
                <option value="voucher">Voucher</option>
                <option value="invoice">Factura</option>
                <option value="identification">Identificación</option>
                <option value="contract">Contrato</option>
                <option value="other">Otro</option>
                <option value="quote">Cotización</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="documents-status">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={filters.status ?? ""} id="documents-status" name="status">
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="documents-relation">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Relación</span>
              <select className={adminSelectClassName} defaultValue={filters.relation ?? ""} id="documents-relation" name="relation">
                <option value="">Cualquiera</option>
                <option value="contact">Contacto</option>
                <option value="lead">Prospecto</option>
                <option value="booking">Reserva</option>
                <option value="quote">Cotización</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="documents-from">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Desde</span>
              <input className={adminInputClassName} defaultValue={filters.from ?? ""} id="documents-from" name="from" type="date" />
            </label>

            <div className="flex flex-wrap items-end gap-2 xl:col-start-6">
              <Button type="submit">Aplicar</Button>
              <Button asChild type="button" variant="outline"><Link href="/admin/operations/documents">Limpiar</Link></Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2" htmlFor="documents-to">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Hasta</span>
              <input className={adminInputClassName} defaultValue={filters.to ?? ""} id="documents-to" name="to" type="date" />
            </label>
          </div>

          <ActiveFilterChips filters={filters} />
          <p className={adminFieldHintClassName}>Los resultados siguen sujetos a tu rol y a las políticas privadas de almacenamiento ya configuradas.</p>
        </form>
      </SectionCard>

      {error ? <ErrorState description="No se pudieron cargar todos los documentos de esta vista. Intenta actualizar o revisa los registros autorizados si el problema persiste." title="Carga incompleta" /> : null}

      <SectionCard description="Accesos temporales solo cuando el archivo ya está disponible. Nunca se muestran enlaces permanentes ni detalles técnicos del sistema." title={`${formatAdminInteger(filteredDocuments.length)} documentos visibles`}>
        {!filteredDocuments.length ? (
          <EmptyState
            action={activeFilters ? <Button asChild variant="outline"><Link href="/admin/operations/documents">Quitar filtros</Link></Button> : undefined}
            description={activeFilters ? "No hay documentos visibles con los filtros actuales." : "Todavía no hay documentos visibles para esta sesión operativa."}
            title={activeFilters ? "Sin resultados" : "Sin documentos registrados"}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {filteredDocuments.map((document) => {
                const rowHref = `/admin/operations/documents${currentQuery}#document-edit-${document.id}`;
                return (
                  <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={document.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-[color:var(--admin-foreground)]">{document.title}</p>
                        <p className="text-sm text-[color:var(--admin-muted-foreground)]">{documentTypeLabel(document.document_type)} · {documentRelationLabel(document)}</p>
                      </div>
                      <StatusBadge tone={documentStatusTone(document.status)}>{documentStatusLabel(document.status)}</StatusBadge>
                    </div>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Relacionado con</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{contactDisplayName(document.contacts)}</dd>
                          <dd className="text-xs text-[color:var(--admin-muted-foreground)]">{leadDisplayName(document.leads)} · {bookingDisplayName(document.bookings)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Cargado</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{formatAdminDateTime(document.created_at)}</dd>
                        </div>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                       {document.quote_version ? <Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${document.quote_version.quote_id}`}>Abrir cotización</Link></Button> : <Button asChild size="sm" variant="outline"><Link href={rowHref}>Editar</Link></Button>}
                      {document.document_preview_url ? <Button asChild size="sm" variant="outline"><a href={document.document_preview_url} rel="noreferrer" target="_blank">Vista previa</a></Button> : null}
                      {document.document_download_url ? <Button asChild size="sm" variant="outline"><a download href={document.document_download_url}>Descargar</a></Button> : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)]">
                <table className="w-full table-fixed text-left text-sm">
                  <caption className="sr-only">Tabla de documentos operativos</caption>
                  <thead className="bg-[color:var(--admin-surface-muted)] text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3" scope="col">Documento</th>
                      <th className="px-4 py-3" scope="col">Tipo</th>
                      <th className="px-4 py-3" scope="col">Relacionado</th>
                      <th className="px-4 py-3" scope="col">Cargado</th>
                      <th className="px-4 py-3" scope="col">Estado</th>
                      <th className="px-4 py-3" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((document) => {
                      const rowHref = `/admin/operations/documents${currentQuery}#document-edit-${document.id}`;
                      return (
                        <tr className="border-t border-[color:var(--admin-border-subtle)] align-top" key={document.id}>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[color:var(--admin-foreground)]">{document.title}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{documentRelationLabel(document)}</p>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{documentTypeLabel(document.document_type)}</td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">
                            <p>{contactDisplayName(document.contacts)}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{leadDisplayName(document.leads)} · {bookingDisplayName(document.bookings)}</p>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]"><span className="whitespace-nowrap">{formatAdminDateTime(document.created_at)}</span></td>
                          <td className="px-4 py-4"><StatusBadge tone={documentStatusTone(document.status)}>{documentStatusLabel(document.status)}</StatusBadge></td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                               {document.quote_version ? <Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${document.quote_version.quote_id}`}>Abrir cotización</Link></Button> : <Button asChild size="sm" variant="outline"><Link href={rowHref}>Editar</Link></Button>}
                              {document.document_preview_url ? <Button asChild size="sm" variant="outline"><a href={document.document_preview_url} rel="noreferrer" target="_blank">Vista previa</a></Button> : null}
                              {document.document_download_url ? <Button asChild size="sm" variant="outline"><a download href={document.document_download_url}>Descargar</a></Button> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {filteredDocuments.some((document) => !document.quote_version_id) ? (
        <SectionCard description="Solo los documentos operativos genéricos pueden editarse aquí. Los PDF de cotización permanecen inmutables y se administran desde Cotizaciones." title="Edición y mantenimiento">
          <div className="space-y-4">
            {filteredDocuments.filter((document) => !document.quote_version_id).map((document) => (
              <details className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)]" id={`document-edit-${document.id}`} key={document.id}>
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-[color:var(--admin-foreground)]">{document.title} · {documentTypeLabel(document.document_type)}</p>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{contactDisplayName(document.contacts)} · {formatAdminDateTime(document.created_at)}</p>
                    </div>
                    <StatusBadge tone={documentStatusTone(document.status)}>{documentStatusLabel(document.status)}</StatusBadge>
                  </div>
                </summary>
                <div className="border-t border-[color:var(--admin-border-subtle)] p-4 sm:p-6">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <DocumentLinks document={document} />
                  </div>
                  <DocumentForm document={document} options={options} />
                </div>
              </details>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </PageContainer>
  );
}
