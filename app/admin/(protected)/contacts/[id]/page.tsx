import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DetailList, EmptyState, ErrorState, PageContainer, PageHeader, SectionCard, StatusBadge } from "@/components/admin/admin-primitives";
import { ContactSelection, SelectableRow } from "@/components/admin/contacts/contact-selection";
import { ContactBulkToolbar, OpportunityBulkToolbar } from "@/components/admin/contacts/bulk-toolbar";
import { requireAdminRole } from "@/lib/admin/auth";
import { getContact360, type ContactOpportunity, type ContactOpportunityQuote, type ContactOpportunityState } from "@/lib/admin/contacts";
import { blockContacts, deleteRestoreContacts, deleteRestoreOpportunities, featureOpportunities } from "../actions";
import { formatLeadSourceLabel, formatQuoteRequestStatusLabel, getLeadStatuses } from "@/lib/admin/leads";
import { quoteVersionStatusLabel } from "@/lib/admin/quote-versions";
import { formatAdminCurrency, formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const lifecycleLabel: Record<string, string> = { active: "Activo", follow_up: "Seguimiento", customer: "Cliente", inactive: "Inactivo", blocked: "Bloqueado", deleted: "Eliminado" };
const opportunityStateLabel: Record<Exclude<ContactOpportunityState, "all">, string> = { active: "Activas", archived: "Archivadas", deleted: "Eliminadas" };
const value = (params: Record<string, string | string[] | undefined>, key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];

function validCursor(updatedAt?: string, id?: string) {
  if (!updatedAt || !id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) || Number.isNaN(new Date(updatedAt).getTime())) return null;
  return { updatedAt, id };
}

function quoteAmount(quote: ContactOpportunityQuote) {
  return quote.amount === null ? `Monto pendiente (${quote.currency})` : formatAdminCurrency(quote.amount, quote.currency);
}

function quoteTitle(opportunity: ContactOpportunity) {
  if (opportunity.acceptedQuote) return "Cotización comercial aceptada";
  if (opportunity.latestQuote) return "Última cotización comercial";
  return "Sin cotización comercial";
}

function OpportunityQuote({ opportunity, compact = false }: Readonly<{ opportunity: ContactOpportunity; compact?: boolean }>) {
  const quote = opportunity.acceptedQuote ?? opportunity.latestQuote;
  if (!quote) return <p className="text-xs text-[color:var(--admin-muted-foreground)]">Sin cotización comercial · {opportunity.quoteCount} versión(es)</p>;
  return (
    <div className={opportunity.acceptedQuote && !compact ? "rounded-[var(--admin-radius-control)] border border-emerald-300 bg-emerald-50 p-3" : "space-y-1"}>
      <p className={opportunity.acceptedQuote ? "font-semibold text-emerald-900" : "font-medium"}>{quoteTitle(opportunity)}</p>
      <p className="text-xs">Versión {quote.versionNumber} · {quoteVersionStatusLabel(quote.status)} · {quoteAmount(quote)}</p>
      {quote.acceptedAt && !compact ? <p className="text-xs text-emerald-900">Aceptada {formatAdminDateTime(quote.acceptedAt)}</p> : null}
      <p className="text-xs text-[color:var(--admin-muted-foreground)]">{opportunity.quoteCount} versión(es) · {opportunity.activeQuoteCount} activa(s)</p>
    </div>
  );
}

function OpportunityRequest({ opportunity }: Readonly<{ opportunity: ContactOpportunity }>) {
  return (
    <div className="space-y-1">
      <p className="font-medium">Solicitud del cliente</p>
      <p className="text-xs">{opportunity.requestCount} total · {opportunity.openRequestCount} abierta(s)</p>
      {opportunity.latestRequest ? (
        <p className="text-xs text-[color:var(--admin-muted-foreground)]">
          Última: {opportunity.latestRequest.source} · {formatQuoteRequestStatusLabel(opportunity.latestRequest.status)} · {formatAdminDateTime(opportunity.latestRequest.createdAt)}
        </p>
      ) : <p className="text-xs text-[color:var(--admin-muted-foreground)]">Sin solicitud vinculada</p>}
    </div>
  );
}

export default async function ContactDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, queryParams, session] = await Promise.all([params, searchParams, requireAdminRole(["admin", "asesor"])]);
  const isAdmin = session.roles.includes("admin");
  const requestedState = value(queryParams, "state");
  const allowedStates: Array<Exclude<ContactOpportunityState, "all">> = isAdmin ? ["active", "archived", "deleted"] : ["active", "archived"];
  const state = allowedStates.includes(requestedState as Exclude<ContactOpportunityState, "all">) ? requestedState as Exclude<ContactOpportunityState, "all"> : "active";
  const cursor = validCursor(value(queryParams, "afterUpdatedAt"), value(queryParams, "afterId"));
  const [detail, statuses] = await Promise.all([
    getContact360(id, { state, afterUpdatedAt: cursor?.updatedAt, afterId: cursor?.id }),
    getLeadStatuses(),
  ]);
  if (!detail) notFound();

  const { contact, opportunities, payments, bookings, documents, activity, warnings } = detail;
  const title = contact ? `${contact.firstName} ${contact.lastName ?? ""}`.trim() : "Contacto 360";
  const stateHref = (nextState: Exclude<ContactOpportunityState, "all">) => `/admin/contacts/${id}?state=${nextState}`;
  const loadMoreHref = detail.nextCursor
    ? `/admin/contacts/${id}?${new URLSearchParams({ state, afterUpdatedAt: detail.nextCursor.updatedAt, afterId: detail.nextCursor.id }).toString()}`
    : null;

  return (
    <PageContainer>
      <PageHeader eyebrow="CRM · Contacto 360" title={title} description="Identidad canónica, gobierno, oportunidades y contexto operativo visible." breadcrumbs={[{ label: "Contactos CRM", href: "/admin/leads" }, { label: "Contacto 360" }]} actions={<Button asChild variant="outline"><Link href="/admin/leads">Volver a Contactos CRM</Link></Button>} />

      {warnings.map((item) => <ErrorState key={item.section} title={item.title} description={item.message} />)}

      {contact ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.9fr)]">
          <SectionCard title="Identidad y gobierno" actions={<StatusBadge tone={contact.lifecycleStatus === "blocked" || contact.deletedAt ? "warning" : "info"}>{lifecycleLabel[contact.lifecycleStatus] ?? "Sin estado"}</StatusBadge>}>
            <DetailList columns={3} items={[
              { label: "Correo", value: contact.email ?? "Sin correo" },
              { label: "WhatsApp", value: contact.phone ?? "Sin WhatsApp" },
              { label: "Idioma", value: contact.preferredLocale === "en" ? "Inglés" : "Español" },
              { label: "Origen", value: formatLeadSourceLabel(contact.source) },
              { label: "Marketing", value: contact.consentMarketing ? "Con consentimiento" : "Sin consentimiento" },
              { label: "Creado", value: formatAdminDateTime(contact.createdAt) },
              { label: "Actualizado", value: formatAdminDateTime(contact.updatedAt) },
              { label: "Última actividad", value: contact.lastActivityAt ? formatAdminDateTime(contact.lastActivityAt) : "Sin actividad" },
              { label: "Datos de prueba", value: contact.isTestData ? "Sí" : "No" },
            ]} />
            <div className="mt-4 flex flex-wrap gap-2">
              {contact.blockedAt ? <StatusBadge tone="warning">Bloqueado {formatAdminDateTime(contact.blockedAt)}</StatusBadge> : null}
              {contact.deletedAt ? <StatusBadge tone="warning">Eliminado {formatAdminDateTime(contact.deletedAt)}</StatusBadge> : null}
              {contact.duplicateRisk ? <StatusBadge tone="warning">Riesgo de duplicado</StatusBadge> : null}
            </div>
            {contact.blockedReason ? <p className="mt-3 text-sm">Bloqueo: {contact.blockedReason}{contact.blockedByName ? ` · ${contact.blockedByName}` : ""}</p> : null}
            {contact.deletedReason ? <p className="mt-3 text-sm">Eliminación: {contact.deletedReason}{contact.deletedByName ? ` · ${contact.deletedByName}` : ""}</p> : null}
            {contact.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--admin-muted-foreground)]">{contact.notes}</p> : null}
            {isAdmin ? <div className="mt-4"><ContactBulkToolbar isAdmin selected={[contact.id]} blockAction={blockContacts} deleteAction={deleteRestoreContacts} /></div> : null}
          </SectionCard>

          <SectionCard title="Resumen comercial">
            <DetailList columns={2} items={[
              { label: "Oportunidades abiertas", value: contact.openOpportunityCount },
              { label: "Activas / archivadas", value: `${contact.activeOpportunityCount} / ${contact.archivedOpportunityCount}` },
              { label: "Eliminadas / totales", value: `${contact.deletedOpportunityCount} / ${contact.totalOpportunityCount}` },
              { label: "Solicitudes del cliente", value: contact.requestCount },
              { label: "Solicitudes sin asignar", value: contact.unassignedRequestCount },
              { label: "Cotizaciones comerciales", value: contact.quoteVersionCount },
              { label: "Cotizaciones aceptadas", value: contact.acceptedQuoteCount },
              { label: "Seguimientos vencidos", value: contact.overdueFollowUpCount },
              { label: "Próximo seguimiento", value: contact.nextFollowUpAt ? formatAdminDateTime(contact.nextFollowUpAt) : "Sin seguimiento" },
              { label: "Duplicados por correo", value: contact.duplicateEmailCount },
              { label: "Duplicados por teléfono", value: contact.duplicatePhoneCount },
              { label: "Pipeline MXN", value: formatAdminCurrency(contact.pipelineMxn, "MXN") },
              { label: "Pipeline USD", value: formatAdminCurrency(contact.pipelineUsd, "USD") },
              { label: "Aceptado MXN", value: formatAdminCurrency(contact.acceptedQuoteValueMxn, "MXN") },
              { label: "Aceptado USD", value: formatAdminCurrency(contact.acceptedQuoteValueUsd, "USD") },
              { label: "Reservas / pagos / documentos", value: `${contact.bookingCount} / ${contact.paymentCount} / ${contact.documentCount}` },
            ]} />
          </SectionCard>
        </section>
      ) : null}

      <SectionCard title="Oportunidades" description="Página estable por actualización. La gestión completa de cada oportunidad permanece en su espacio dedicado.">
        <nav aria-label="Estado de oportunidades" className="mb-4 flex flex-wrap gap-2">
          {allowedStates.map((item) => <Button asChild key={item} size="sm" variant={state === item ? "default" : "outline"}><Link href={stateHref(item)}>{opportunityStateLabel[item]}</Link></Button>)}
        </nav>
        <ContactSelection ids={opportunities.map((opportunity) => opportunity.id)} selectAllLabel="Seleccionar todas las oportunidades visibles">
          <OpportunityBulkToolbar isAdmin={isAdmin} contactId={contact?.id} statuses={statuses} featureAction={featureOpportunities} deleteAction={deleteRestoreOpportunities} />

          <div className="grid gap-4 lg:hidden">
            {opportunities.map((opportunity) => (
              <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] p-4" key={opportunity.id}>
                <div className="flex items-start gap-3">
                  <SelectableRow id={opportunity.id} label={`Seleccionar oportunidad ${opportunity.destinationName}`} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{opportunity.destinationName}</p><p className="text-xs">{opportunity.serviceName} · {opportunity.advisorName}</p></div>
                      <StatusBadge tone={opportunity.state === "deleted" ? "warning" : "neutral"}>{opportunity.statusLabel}</StatusBadge>
                    </div>
                    <p className="text-xs">{formatAdminDate(opportunity.startDate)} → {formatAdminDate(opportunity.endDate)} · {opportunity.travelers} viajero(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {opportunity.isFeatured ? <StatusBadge tone="brand">Destacada</StatusBadge> : null}
                      {opportunity.state !== "active" ? <StatusBadge tone="warning">{opportunityStateLabel[opportunity.state]}</StatusBadge> : null}
                      {opportunity.overdue ? <StatusBadge tone="warning">Seguimiento vencido</StatusBadge> : null}
                      {opportunity.budgetMxn !== null ? <StatusBadge tone="neutral">{formatAdminCurrency(opportunity.budgetMxn, "MXN")}</StatusBadge> : null}
                      {opportunity.budgetUsd !== null ? <StatusBadge tone="neutral">{formatAdminCurrency(opportunity.budgetUsd, "USD")}</StatusBadge> : null}
                    </div>
                    <OpportunityRequest opportunity={opportunity} />
                    <OpportunityQuote opportunity={opportunity} />
                    <Button asChild size="sm"><Link href={opportunity.href}>Abrir gestión completa</Link></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Oportunidades del contacto</caption>
              <thead className="text-xs uppercase tracking-[0.12em]"><tr>{["", "Oportunidad", "Estado", "Viaje y valor", "Solicitud del cliente", "Cotización comercial", "Seguimiento", "Actualizada", ""].map((label, index) => <th className="px-3 py-3" key={label || index}>{label}</th>)}</tr></thead>
              <tbody>{opportunities.map((opportunity) => (
                <tr className="border-t border-[color:var(--admin-border-subtle)] align-top" key={opportunity.id}>
                  <td className="px-3 py-4"><SelectableRow id={opportunity.id} label={`Seleccionar oportunidad ${opportunity.destinationName}`} /></td>
                  <td className="px-3 py-4"><p className="font-semibold">{opportunity.destinationName}</p><p className="text-xs">{opportunity.serviceName} · {opportunity.advisorName}</p></td>
                  <td className="px-3 py-4"><StatusBadge tone={opportunity.state === "deleted" ? "warning" : "neutral"}>{opportunity.statusLabel}</StatusBadge>{opportunity.isFeatured ? <StatusBadge className="ml-1" tone="brand">Destacada</StatusBadge> : null}<p className="mt-1 text-xs">{opportunityStateLabel[opportunity.state]}</p></td>
                  <td className="px-3 py-4 whitespace-nowrap">{formatAdminDate(opportunity.startDate)} → {formatAdminDate(opportunity.endDate)}<p className="text-xs">{opportunity.travelers} viajero(s)</p><p className="mt-1 text-xs">{opportunity.budgetMxn !== null ? formatAdminCurrency(opportunity.budgetMxn, "MXN") : "Sin presupuesto MXN"}<br />{opportunity.budgetUsd !== null ? formatAdminCurrency(opportunity.budgetUsd, "USD") : "Sin presupuesto USD"}</p></td>
                  <td className="max-w-64 px-3 py-4"><OpportunityRequest opportunity={opportunity} /></td>
                  <td className="max-w-64 px-3 py-4"><OpportunityQuote compact opportunity={opportunity} /></td>
                  <td className="px-3 py-4">{opportunity.overdue ? <StatusBadge tone="warning">Vencido</StatusBadge> : opportunity.latestFollowUpAt ? formatAdminDateTime(opportunity.latestFollowUpAt) : "Sin seguimiento"}<p className="mt-1 text-xs">Actividad {formatAdminDateTime(opportunity.lastActivityAt)}</p></td>
                  <td className="px-3 py-4 whitespace-nowrap">{formatAdminDateTime(opportunity.updatedAt)}</td>
                  <td className="px-3 py-4"><Button asChild size="sm" variant="outline"><Link href={opportunity.href}>Gestión completa</Link></Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!opportunities.length ? <EmptyState title={`Sin oportunidades ${opportunityStateLabel[state].toLowerCase()}`} description="Este contacto no tiene oportunidades de este estado dentro de tu alcance." /> : null}
        </ContactSelection>

        {loadMoreHref ? <div className="mt-5 flex justify-end"><Button asChild variant="outline"><Link href={loadMoreHref}>Cargar más oportunidades</Link></Button></div> : null}
      </SectionCard>

      <SectionCard title="Contexto operativo" description="Contextos acotados e independientes; una falla opcional no afecta el resto del Contacto 360.">
        <div className="grid gap-5 sm:grid-cols-3">
          {([['Pagos', payments], ['Reservas', bookings], ['Documentos', documents]] as Array<[string, typeof payments]>).map(([label, items]) => (
            <div key={label}>
              <h3 className="font-semibold">{label}</h3>
              <p className="mt-1 text-2xl font-semibold">{items.length}</p>
              {items.slice(0, 3).map((item) => <p className="mt-2 text-xs" key={item.id}>{item.label} · {item.status}{item.amount ? ` · ${item.amount}` : ""}</p>)}
              {!items.length ? <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">Sin registros visibles.</p> : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Actividad reciente" description="Actividad visible de las oportunidades incluidas en esta página.">
        <div className="space-y-3">
          {activity.map((item) => <div className="border-b border-[color:var(--admin-border-subtle)] pb-3" key={item.id}><p className="font-medium">{item.label}</p><p className="text-sm">{item.summary}</p><p className="text-xs">{item.at}</p><Link className="text-xs font-medium text-[color:var(--admin-accent)] hover:underline" href={item.href}>Abrir oportunidad</Link></div>)}
          {!activity.length ? <p className="text-sm">Sin actividad reciente visible.</p> : null}
        </div>
      </SectionCard>
    </PageContainer>
  );
}
