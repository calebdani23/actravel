import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteLifecyclePanel } from "@/components/admin/quotes/quote-lifecycle-panel";
import { QuotePdfPreview } from "@/components/admin/quotes/quote-pdf-preview";
import { QuotePdfUpload } from "@/components/admin/quotes/quote-pdf-upload";
import { QuoteVersionForm } from "@/components/admin/quotes/quote-editor-form";
import { QuoteVersionTimeline } from "@/components/admin/quotes/quote-version-timeline";
import { DetailList, EmptyState, ErrorState, PageContainer, PageHeader, SectionCard, StatusBadge } from "@/components/admin/admin-primitives";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminCurrency, formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { getQuotePortfolio, getQuoteWorkspace } from "@/lib/admin/quotes";

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };
const value = (params: SearchParams, key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function validUuid(input?: string) { return input && UUID.test(input) ? input : null; }
function validDate(input?: string) { return input && !Number.isNaN(new Date(input).getTime()) ? input : null; }
function validNumber(input?: string) { const number = Number(input); return Number.isInteger(number) && number > 0 ? number : null; }
function statusLabel(status: string) { return ({ draft: "Borrador", ready: "Lista", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada", expired: "Expirada", cancelled: "Cancelada", superseded: "Sustituida" } as Record<string, string>)[status] ?? "Estado no identificado"; }
function statusTone(status: string) { return status === "accepted" ? "success" as const : ["ready", "sent"].includes(status) ? "info" as const : status === "draft" ? "warning" as const : "neutral" as const; }
function money(amount: number | null, currency: string) { return amount === null ? `${currency} por definir` : formatAdminCurrency(amount, currency); }
function eventLabel(type: string) { return ({ quote_created: "Cotización creada", quote_version_created: "Nueva versión creada", quote_pdf_upload_started: "Carga de PDF iniciada", quote_pdf_upload_finalized: "PDF canónico finalizado", quote_pdf_upload_failed: "Carga de PDF fallida", quote_ready: "Cotización lista", quote_sent: "Cotización enviada", quote_accepted: "Cotización aceptada", quote_rejected: "Cotización rechazada", quote_expired: "Cotización expirada", quote_cancelled: "Cotización cancelada", quote_deleted: "Cotización eliminada", quote_restored: "Cotización restaurada", legacy_quote_document_linked: "PDF legado vinculado" } as Record<string, string>)[type] ?? "Actividad de cotización"; }

function pageHref(id: string, current: SearchParams, changes: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  Object.entries(current).forEach(([key, raw]) => {
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (item) next.set(key, item);
  });
  Object.entries(changes).forEach(([key, item]) => item ? next.set(key, item) : next.delete(key));
  return `/admin/quotes/${id}${next.size ? `?${next}` : ""}`;
}

export default async function QuoteDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, requireAdminRole(["admin", "asesor", "operaciones", "finanzas"])]);
  const isAdmin = session.roles.includes("admin");
  const canMutate = isAdmin || session.roles.includes("asesor");
  const canOpenCrm = canMutate;
  const workspace = await getQuoteWorkspace(id, {
    versionAfterNumber: validNumber(value(query, "versionAfterNumber")),
    versionAfterId: validUuid(value(query, "versionAfterId")),
    requestAfterCreatedAt: validDate(value(query, "requestAfterCreatedAt")),
    requestAfterId: validUuid(value(query, "requestAfterId")),
    eventAfterCreatedAt: validDate(value(query, "eventAfterCreatedAt")),
    eventAfterId: validUuid(value(query, "eventAfterId")),
  });
  if (!workspace.quote && !workspace.issues.length) notFound();
  const quote = workspace.quote;
  if (!quote) return <PageContainer>{workspace.issues.map((issue) => <ErrorState description={issue.message} key={issue.code} title="Cotización no disponible" />)}</PageContainer>;

  const currentVersion = quote.currentVersion;
  const acceptedQuotes = canMutate ? await getQuotePortfolio({ opportunityId: quote.opportunity.id, status: "accepted", limit: 2 }) : { quotes: [], issues: [] };
  const otherAccepted = acceptedQuotes.quotes.find((item) => item.id !== quote.id) ?? null;
  const previewVersion = currentVersion?.document?.state === "ready" ? currentVersion : quote.acceptedVersion?.document?.state === "ready" ? quote.acceptedVersion : null;
  const requestOptions = workspace.requests.map((request) => ({ id: request.id, contactId: quote.contact.id, opportunityId: quote.opportunity.id, status: request.status, locale: request.locale, destination: request.destination, service: request.service, createdAt: request.requestedAt }));
  const versionNext = workspace.versionPage.nextCursor;
  const requestNext = workspace.requestPage.nextCursor;
  const eventNext = workspace.eventPage.nextCursor;

  return (
    <PageContainer>
      <PageHeader
        actions={<Button asChild variant="outline"><Link href="/admin/quotes">Volver al portafolio</Link></Button>}
        breadcrumbs={[{ label: "Cotizaciones", href: "/admin/quotes" }, { label: quote.number }]}
        description={`${quote.title} · Actualizada ${formatAdminDateTime(quote.updatedAt)}`}
        eyebrow="Cotización comercial"
        title={quote.number}
      />
      <div className="flex flex-wrap gap-2"><StatusBadge tone={statusTone(quote.status)}>{statusLabel(quote.status)}</StatusBadge><StatusBadge tone="neutral">Folio {quote.number}</StatusBadge>{currentVersion ? <StatusBadge tone="brand">Actual V{currentVersion.number}</StatusBadge> : null}{quote.acceptedVersion ? <StatusBadge tone="success">Aceptada V{quote.acceptedVersion.number}</StatusBadge> : null}{quote.deletedAt ? <StatusBadge tone="warning">Eliminada</StatusBadge> : null}</div>
      {workspace.issues.map((issue) => <ErrorState description={issue.message} key={`${issue.section}-${issue.code}`} title="Carga parcial" />)}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)] xl:items-start">
        <div className="space-y-6">
          <SectionCard title="Resumen comercial" description="La versión actual y la aceptada se conservan como referencias independientes.">
            <DetailList columns={3} items={[
              { label: "Título", value: currentVersion?.title ?? quote.title },
              { label: "Estado actual", value: currentVersion ? statusLabel(currentVersion.status) : "Sin versión" },
              { label: "Total actual", value: currentVersion ? money(currentVersion.totalAmount, currentVersion.currency) : "—" },
              { label: "Anticipo actual", value: currentVersion ? money(currentVersion.depositAmount, currentVersion.currency) : "—" },
              { label: "Vigencia", value: currentVersion?.validUntil ? formatAdminDate(currentVersion.validUntil) : "Sin fecha" },
              { label: "Asesor", value: quote.owner.name ?? "Sin asignar" },
              { label: "Versión aceptada", value: quote.acceptedVersion ? `V${quote.acceptedVersion.number} · ${money(quote.acceptedVersion.totalAmount, quote.acceptedVersion.currency)}` : "Ninguna" },
              { label: "Versiones", value: quote.versionCount },
              { label: "Solicitudes del cliente", value: quote.requestCount },
            ]} />
          </SectionCard>

          <SectionCard title="Contacto y oportunidad" description="Relaciones canónicas verificadas por servidor y base de datos.">
            <div className="grid gap-4 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider">Contacto</p><p className="mt-1 font-medium">{canOpenCrm ? <Link className="text-[color:var(--admin-accent)] hover:underline" href={`/admin/contacts/${quote.contact.id}`}>{quote.contact.name}</Link> : quote.contact.name}</p><p className="text-sm text-[color:var(--admin-muted-foreground)]">{quote.contact.email ?? quote.contact.phone ?? "Sin dato visible"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider">Oportunidad</p><p className="mt-1 font-medium">{canOpenCrm ? <Link className="text-[color:var(--admin-accent)] hover:underline" href={`/admin/leads/${quote.opportunity.id}`}>{quote.opportunity.label}</Link> : quote.opportunity.label}</p><p className="text-sm text-[color:var(--admin-muted-foreground)]">La Solicitud del cliente se presenta por separado.</p></div></div>
          </SectionCard>

          <SectionCard title={previewVersion ? `PDF canónico · V${previewVersion.number}` : "PDF canónico"} description={previewVersion && previewVersion.id === quote.acceptedVersion?.id && previewVersion.id !== currentVersion?.id ? "Mostrando el PDF de la versión aceptada; la versión actual aún no tiene PDF listo." : "Vista privada temporal del documento canónico visible para tu rol."}>
            <QuotePdfPreview document={previewVersion?.document ?? null} title={`${quote.number} V${previewVersion?.number ?? ""}`} />
          </SectionCard>

          <SectionCard title="Historial de versiones" description="Contenido inmutable después de envío o estado terminal.">
            <QuoteVersionTimeline acceptedVersionId={quote.acceptedVersion?.id ?? null} currentVersionId={quote.currentVersion?.id ?? null} versions={workspace.versions} />
            {versionNext ? <div className="mt-4 flex justify-end"><Button asChild variant="outline"><Link href={pageHref(id, query, { versionAfterNumber: String(versionNext.versionNumber), versionAfterId: versionNext.id })}>Siguiente página de versiones</Link></Button></div> : null}
          </SectionCard>

          <SectionCard title="Solicitudes del cliente relacionadas" description="Historial de intake distinto de las propuestas comerciales.">
            {workspace.requests.length ? <div className="space-y-3">{workspace.requests.map((request) => <article className="rounded-lg border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={request.linkId}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Solicitud {request.requestedAt.slice(0, 10)}</p><StatusBadge tone="neutral">{request.status}</StatusBadge></div><p className="mt-1 text-sm">{request.destination ?? "Sin destino"} · {request.service ?? "Sin servicio"} · {request.relation}</p></article>)}</div> : <EmptyState description="Esta cotización no tiene solicitudes del cliente vinculadas dentro de tu alcance." title="Sin solicitudes relacionadas" />}
            {requestNext ? <div className="mt-4 flex justify-end"><Button asChild variant="outline"><Link href={pageHref(id, query, { requestAfterCreatedAt: requestNext.createdAt, requestAfterId: requestNext.id })}>Siguiente página de solicitudes</Link></Button></div> : null}
          </SectionCard>

          <SectionCard title="Actividad de la cotización" description="Eventos auditados sin exponer payloads internos.">
            {workspace.events.length ? <ol className="space-y-3">{workspace.events.map((event) => <li className="rounded-lg border border-[color:var(--admin-border-subtle)] p-4" key={event.id}><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium">{eventLabel(event.type)}</p><time className="text-xs text-[color:var(--admin-muted-foreground)]" dateTime={event.createdAt}>{formatAdminDateTime(event.createdAt)}</time></div><p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{event.actor.name ?? "Sistema"}{event.quoteVersionId ? " · Evento de versión" : " · Evento de cabecera"}</p></li>)}</ol> : <EmptyState description="Aún no hay actividad de cotización visible." title="Sin actividad" />}
            {eventNext ? <div className="mt-4 flex justify-end"><Button asChild variant="outline"><Link href={pageHref(id, query, { eventAfterCreatedAt: eventNext.createdAt, eventAfterId: eventNext.id })}>Siguiente página de actividad</Link></Button></div> : null}
          </SectionCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24">
          {workspace.handoff ? <SectionCard title="Handoff operativo" description="La aceptación no crea reservas ni pagos automáticamente."><div className="space-y-3 text-sm"><p><strong>{workspace.handoff.acceptedVersion.title}</strong></p><p>{money(workspace.handoff.acceptedVersion.totalAmount, workspace.handoff.acceptedVersion.currency)} · Saldo {money(workspace.handoff.acceptedVersion.balanceAmount, workspace.handoff.acceptedVersion.currency)}</p><p>{workspace.handoff.operations.bookingCount} reserva(s) · {workspace.handoff.operations.paymentCount} pago(s) vinculados</p><div className="grid gap-2">{workspace.handoff.operations.canManageBooking ? <Button asChild><Link href={`/admin/operations/bookings?quoteId=${quote.id}&acceptedQuoteVersionId=${workspace.handoff.acceptedVersion.id}`}>Crear reserva desde cotización</Link></Button> : null}{workspace.handoff.operations.canManagePayment ? <Button asChild><Link href={`/admin/payments?quoteId=${quote.id}&acceptedQuoteVersionId=${workspace.handoff.acceptedVersion.id}`}>Registrar pago desde cotización</Link></Button> : null}</div></div></SectionCard> : null}

          {canMutate && currentVersion?.status === "draft" && currentVersion.document?.state !== "ready" ? <SectionCard title="PDF de la versión actual" description="Las versiones posteriores pueden iniciar como borrador, pero no pueden quedar listas ni enviarse sin su PDF."><QuotePdfUpload quoteId={quote.id} quoteVersionId={currentVersion.id} /></SectionCard> : null}

          {canMutate && currentVersion ? <SectionCard title="Acciones" description="Todas las mutaciones usan los RPC transaccionales de Cotizaciones."><QuoteLifecyclePanel acceptedQuoteToSupersede={otherAccepted ? { id: otherAccepted.id, number: otherAccepted.number } : null} canMutate={canMutate} deleted={Boolean(quote.deletedAt)} lockVersion={quote.lockVersion} quoteId={quote.id} quoteVersionId={currentVersion.id} versionStatus={currentVersion.status} /></SectionCard> : <SectionCard title="Acceso de consulta" description="Tu rol puede revisar y descargar la cotización, pero no modificarla."><QuoteLifecyclePanel canMutate={false} deleted={Boolean(quote.deletedAt)} lockVersion={quote.lockVersion} quoteId={quote.id} quoteVersionId={currentVersion?.id ?? quote.id} versionStatus={currentVersion?.status ?? quote.status} /></SectionCard>}

          {canMutate && !quote.deletedAt ? <SectionCard title="Nueva versión" description="Nunca edita contenido enviado o terminal; crea un borrador nuevo."><QuoteVersionForm acceptedVersion={quote.acceptedVersion} currentVersion={quote.currentVersion} lockVersion={quote.lockVersion} quoteId={quote.id} requests={requestOptions} versions={workspace.versions} /></SectionCard> : null}
        </aside>
      </section>
    </PageContainer>
  );
}
