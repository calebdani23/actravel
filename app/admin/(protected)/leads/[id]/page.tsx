import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline, DetailList, ErrorState, PageContainer, PageHeader, QuietActionButton, SectionCard, StatusBadge, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { LeadDeleteForm } from "@/components/admin/leads/lead-delete-form";
import { QuoteVersionActionForm, QuoteVersionCreateDialog } from "@/components/admin/leads/quote-version-forms";
import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatLeadDeletionBlockerList, leadDeletionUnavailableMessage } from "@/lib/admin/lead-delete";
import { canAcceptQuoteVersion, canExpireQuoteVersion, canMarkQuoteVersionSent, canRejectQuoteVersion, formatQuoteVersionAmount, quoteVersionBalance, quoteVersionStatusTone } from "@/lib/admin/quote-versions";
import { formatLeadPriorityLabel, formatLeadSourceLabel, getAdvisors, getLeadDeletionSummary, getLeadDetail, getLeadStatuses } from "@/lib/admin/leads";
import { formatAdminCurrency, formatAdminDate, formatAdminDateTime, formatAdminInteger, formatAdminTravelerCount } from "@/lib/admin/format";
import { buildAdminSearchQueryString } from "@/lib/admin/navigation";
import { getActiveMessageTemplates } from "@/lib/admin/templates";
import { leadTemplateVariables } from "@/lib/admin/template-renderer";
import { buildTrackedWhatsAppUrl, sanitizeWhatsAppPhone } from "@/lib/whatsapp/link";
import { LeadTemplateActions } from "@/components/admin/leads/whatsapp-template-actions";
import { addLeadNoteAction, assignLeadAction, registerFollowUpAction, updateLeadStatusAction } from "./actions";
import { acceptQuoteVersionAction, expireQuoteVersionAction, markQuoteVersionSentAction, rejectQuoteVersionAction } from "./quote-version-actions";
import { hasAnyRole } from "@/lib/supabase/roles";
import { RestoreOpportunityForm, SoftDeleteOpportunityForm } from "@/components/admin/contacts/bulk-toolbar";
import { restoreOpportunityAction, softDeleteOpportunityAction } from "../../contacts/actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function money(mxn?: number | null, usd?: number | null) {
  if (mxn !== null && mxn !== undefined) return formatAdminCurrency(mxn, "MXN");
  if (usd !== null && usd !== undefined) return formatAdminCurrency(usd, "USD");
  return "—";
}

function formatDateTime(value: string) {
  return formatAdminDateTime(value);
}

function formatDate(value?: string | null) {
  return formatAdminDate(value);
}

function leadStatusTone(status?: string | null) {
  if (!status) return "neutral" as const;
  if (["won", "booked", "converted", "paid"].includes(status)) return "success" as const;
  if (["new", "contacted", "qualified", "proposal_sent"].includes(status)) return "info" as const;
  if (["lost", "cancelled", "archived"].includes(status)) return "neutral" as const;
  return "brand" as const;
}

function paymentTypeLabel(type: string) {
  const labels: Record<string, string> = { deposit: "Anticipo", partial: "Parcial", balance: "Liquidación", full: "Pago total", refund: "Reembolso" };
  return labels[type] ?? "Tipo de pago no identificado";
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = { pending: "Pendiente", received: "Recibido", verified: "Verificado", rejected: "Rechazado", refunded: "Reembolsado" };
  return labels[status] ?? "Estado de pago no identificado";
}

function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = { draft: "Borrador", confirmed: "Confirmada", in_progress: "En viaje", completed: "Completada", cancelled: "Cancelada" };
  return labels[status] ?? "Estado de reserva no identificado";
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = { passport: "Pasaporte", visa: "Visa", itinerary: "Itinerario", voucher: "Voucher", ticket: "Boleto", invoice: "Factura", receipt: "Comprobante" };
  return labels[type] ?? "Documento operativo";
}

function documentStatusLabel(status: string) {
  const labels: Record<string, string> = { pending: "Pendiente", requested: "Solicitado", received: "Recibido", approved: "Aprobado", rejected: "Rechazado", archived: "Archivado" };
  return labels[status] ?? "Estado documental no identificado";
}

function localeLabel(locale?: string | null) {
  const labels: Record<string, string> = {
    es: "Español",
    "es-MX": "Español (MX)",
    en: "Inglés",
    "en-US": "Inglés (US)",
  };
  if (!locale) return "Sin preferencia";
  return labels[locale] ?? "Idioma no identificado";
}

function relatedName(profile?: { full_name: string | null } | Array<{ full_name: string | null }> | null) {
  if (Array.isArray(profile)) return profile[0]?.full_name ?? null;
  return profile?.full_name ?? null;
}

function quoteRequestStatusTone(status: string) {
  if (status === "received" || status === "processing") return "info" as const;
  if (status === "converted") return "success" as const;
  if (status === "closed") return "neutral" as const;
  return "neutral" as const;
}

function quoteVersionCardTone(status: string) {
  if (status === "accepted") return "border-[color:var(--admin-accent)] bg-[color:var(--admin-surface)]";
  if (status === "rejected" || status === "expired") return "border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] opacity-95";
  return "border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)]";
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, currentSearchParams, session] = await Promise.all([params, searchParams, requireAdminRole(["admin", "asesor"])]);
  const canDeleteLead = hasAnyRole(session.roles, ["admin"]);
  const [{ lead, notes, timeline, payments, bookings, documents, quoteVersions, quoteRequests, relatedOpportunities, contact360, error }, statuses, advisors, messageTemplates, deletionSummary] = await Promise.all([
    getLeadDetail(id),
    getLeadStatuses(),
    getAdvisors(),
    getActiveMessageTemplates(),
    canDeleteLead ? getLeadDeletionSummary(id) : Promise.resolve(null),
  ]);

  if (!lead && !error) notFound();
  const canAssign = hasAnyRole(session.roles, ["admin"]);
  const contactName = [lead?.contacts?.first_name, lead?.contacts?.last_name].filter(Boolean).join(" ") || "Oportunidad";
  const templateVariables = lead ? leadTemplateVariables({
    contactName,
    destination: lead.destinations?.name_es ?? lead.summary,
    travelStartDate: lead.travel_start_date,
    travelEndDate: lead.travel_end_date,
    travelersCount: lead.travelers_count,
    budget: money(lead.budget_mxn, lead.budget_usd),
    advisorName: lead.profiles?.full_name,
    status: lead.lead_statuses?.label_es,
  }) : {};
  const whatsappHref = lead ? buildTrackedWhatsAppUrl({
    message: `Hola ${contactName}, continuamos con tu viaje a ${lead.destinations?.name_es ?? lead.summary ?? "AC Travel"}.`,
    phone: lead.contacts?.phone,
    locale: lead.contacts?.preferred_locale,
    pagePath: "admin-lead-detail",
    leadId: lead.id,
    contactId: lead.contact_id,
  }) : null;
  const hasWhatsApp = Boolean(sanitizeWhatsAppPhone(lead?.contacts?.phone)) && lead?.contacts?.lifecycle_status !== "blocked" && !lead?.contacts?.blocked_at && !lead?.contacts?.deleted_at;
  const crmBaseHref = `/admin/leads${buildAdminSearchQueryString(currentSearchParams)}`;
  const leadDeletionBlockers = deletionSummary ? formatLeadDeletionBlockerList(deletionSummary.counts) : [];

  if (error) console.error("Lead detail dashboard-safe error", { leadId: id, error });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="CRM"
        title={contactName}
        description={lead ? `${lead.destinations?.name_es ?? "Sin destino"} · ${formatDate(lead.travel_start_date)} → ${formatDate(lead.travel_end_date)} · ${lead.profiles?.full_name ?? "Sin asesor asignado"}` : "Detalle de la oportunidad."}
        breadcrumbs={[{ label: "Comercial", href: crmBaseHref }, { label: "Oportunidades", href: crmBaseHref }, { label: contactName }]}
        actions={
          <>
            <QuietActionButton asChild>
              <Link href={crmBaseHref}>Volver al CRM</Link>
            </QuietActionButton>
            {lead?.contact_id ? <QuietActionButton asChild><Link href="/admin/payments">Registrar pago</Link></QuietActionButton> : null}
            {lead?.contact_id ? <QuietActionButton asChild><Link href={`/admin/contacts/${lead.contact_id}`}>Abrir Contacto 360</Link></QuietActionButton> : null}
            {hasWhatsApp && whatsappHref ? <Button asChild><a href={whatsappHref} rel="noreferrer" target="_blank">Abrir WhatsApp</a></Button> : null}
          </>
        }
      />

      {error ? <ErrorState description="No se pudieron cargar algunos datos del prospecto. Intenta actualizar la vista o revisa los logs autorizados si el problema continúa." title="Carga incompleta" /> : null}

      {!lead ? null : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.95fr)_minmax(280px,1fr)] xl:items-start">
          <div className="space-y-6">
              <SectionCard
               title="Resumen de la oportunidad"
               description="Vista comercial principal con datos de contacto, viaje, presupuesto y contexto operativo actual."
              actions={<StatusBadge tone={leadStatusTone(lead.lead_statuses?.name)}>{lead.lead_statuses?.label_es ?? "Sin estado"}</StatusBadge>}
            >
              <div className="space-y-5">
                 <div className="flex flex-wrap gap-2">
                  {lead.deleted_at ? <StatusBadge tone="warning">Eliminada del CRM</StatusBadge> : null}
                  {lead.is_featured ? <StatusBadge tone="brand">Oportunidad destacada</StatusBadge> : null}
                  <StatusBadge tone="neutral">{formatLeadPriorityLabel(lead.priority)}</StatusBadge>
                  <StatusBadge tone="neutral">{formatLeadSourceLabel(lead.source)}</StatusBadge>
                  <StatusBadge tone="neutral">Actualizado {formatDateTime(lead.updated_at)}</StatusBadge>
                </div>
                {lead.summary ? <p className="text-sm leading-6 text-[color:var(--admin-foreground)]">{lead.summary}</p> : null}
                <DetailList
                  columns={3}
                  items={[
                    { label: "Correo", value: lead.contacts?.email ?? "Sin correo" },
                    { label: "WhatsApp", value: lead.contacts?.phone ?? "Sin WhatsApp" },
                    { label: "Idioma", value: localeLabel(lead.contacts?.preferred_locale) },
                    { label: "Destino", value: lead.destinations?.name_es ?? "Sin destino" },
                    { label: "Servicio", value: lead.services?.name_es ?? "Sin servicio" },
                    { label: "Viaje", value: `${formatDate(lead.travel_start_date)} → ${formatDate(lead.travel_end_date)}` },
                    { label: "Viajeros", value: formatAdminTravelerCount(lead.travelers_count) },
                    { label: "Presupuesto", value: money(lead.budget_mxn, lead.budget_usd) },
                    { label: "Asesor", value: lead.profiles?.full_name ?? "Sin asignar" },
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard title="Contacto 360" description="Resumen canónico del contacto, oportunidades relacionadas, solicitudes y seguimiento comercial visible.">
              <div className="space-y-5">
                <DetailList
                  columns={3}
                  items={[
                    { label: "Oportunidades", value: formatAdminInteger(contact360.opportunityCount) },
                    { label: "Solicitudes del cliente", value: formatAdminInteger(contact360.requestCount) },
                    { label: "Seguimientos vencidos", value: formatAdminInteger(contact360.overdueFollowUps) },
                    { label: "Seguimientos próximos", value: formatAdminInteger(contact360.upcomingFollowUps) },
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  {contact360.opportunityCount > 1 ? <StatusBadge tone="brand">Contacto recurrente</StatusBadge> : null}
                  {contact360.hasDuplicateRisk ? <StatusBadge tone="warning">Revisión de duplicados</StatusBadge> : null}
                  {contact360.hasIdentityReview ? <StatusBadge tone="warning">Identidad ambigua por revisar</StatusBadge> : null}
                </div>
              </div>
            </SectionCard>

            {(contact360.hasDuplicateRisk || contact360.hasIdentityReview) ? (
              <SectionCard title="Riesgo de identidad" description="No se realizan merges automáticos en casos ambiguos o con datos compartidos.">
                <DetailList
                  columns={3}
                  items={[
                    { label: "Coincidencias por correo", value: formatAdminInteger(contact360.duplicateEmailMatches) },
                    { label: "Coincidencias por teléfono", value: formatAdminInteger(contact360.duplicatePhoneMatches) },
                    { label: "Eventos ambiguos", value: formatAdminInteger(contact360.ambiguousIdentityEvents) },
                  ]}
                />
              </SectionCard>
            ) : null}

            {relatedOpportunities.length ? (
              <SectionCard title="Oportunidades relacionadas" description="Otras oportunidades visibles del mismo contacto dentro de tu alcance actual.">
                <div className="space-y-3">
                  {relatedOpportunities.map((item) => (
                    <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={item.id}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <Link className="font-semibold text-[color:var(--admin-accent)] hover:underline" href={item.href}>{item.destinationName}</Link>
                          <p className="mt-1 text-sm text-[color:var(--admin-foreground)]">{item.summary ?? "Sin resumen comercial"}</p>
                          <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{item.advisorName} · Actualizada {formatDateTime(item.updatedAt)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone="neutral">{item.statusLabel}</StatusBadge>
                          <StatusBadge tone="neutral">{formatAdminInteger(item.quoteRequestCount)} solicitud(es)</StatusBadge>
                          {item.followUpOverdue ? <StatusBadge tone="warning">Seguimiento vencido</StatusBadge> : item.nextFollowUpAt ? <StatusBadge tone="neutral">Próximo: {formatDateTime(item.nextFollowUpAt)}</StatusBadge> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard
              title="Cotizaciones comerciales"
              description="Propuestas comerciales de AC Travel dentro de esta oportunidad. Son distintas de las solicitudes del cliente y no eliminan versiones previas."
              actions={
                lead ? <QuoteVersionCreateDialog leadId={lead.id} quoteRequests={quoteRequests.map((request) => ({ id: request.id, createdAt: formatDateTime(request.createdAt), channelLabel: request.channelLabel, statusLabel: request.statusLabel }))} /> : null
              }
            >
              {quoteVersions.length ? (
                <div className="space-y-4" id="cotizaciones-comerciales">
                  {quoteVersions.map((version) => {
                    const balance = quoteVersionBalance(version.totalAmount, version.depositAmount);
                    return (
                      <article className={`rounded-[var(--admin-radius-control)] border p-4 ${quoteVersionCardTone(version.status)}`} key={version.id}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge tone={quoteVersionStatusTone(version.status)}>{version.statusLabel}</StatusBadge>
                              <StatusBadge tone="neutral">Versión {version.versionNumber}</StatusBadge>
                              {version.quoteRequestId ? <StatusBadge tone="neutral">Con solicitud del cliente vinculada</StatusBadge> : null}
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-[color:var(--admin-foreground)]">{version.title}</h3>
                              {version.summary ? <p className="mt-1 text-sm text-[color:var(--admin-foreground)]">{version.summary}</p> : null}
                            </div>
                            <DetailList
                              columns={3}
                              items={[
                                { label: "Total", value: formatQuoteVersionAmount(version.totalAmount, version.currency) },
                                { label: "Anticipo", value: formatQuoteVersionAmount(version.depositAmount, version.currency) },
                                { label: "Saldo", value: balance === null ? "—" : formatQuoteVersionAmount(balance, version.currency) },
                                { label: "Vigencia", value: formatDate(version.validUntil) },
                                { label: "Creada", value: formatDateTime(version.createdAt) },
                                { label: "Registró", value: version.createdByName ?? "Equipo interno" },
                              ]}
                            />
                            <div className="flex flex-wrap gap-2 text-xs text-[color:var(--admin-muted-foreground)]">
                              {version.sentAt ? <span>Enviada: {formatDateTime(version.sentAt)}</span> : <span>Envío pendiente</span>}
                              {version.acceptedAt ? <span>Aceptada: {formatDateTime(version.acceptedAt)}</span> : null}
                              {version.rejectedAt ? <span>Rechazada: {formatDateTime(version.rejectedAt)}</span> : null}
                              {version.expiredAt ? <span>Expirada: {formatDateTime(version.expiredAt)}</span> : null}
                            </div>
                            {version.notes ? <p className="whitespace-pre-wrap text-sm text-[color:var(--admin-foreground)]">{version.notes}</p> : null}
                          </div>

                          <div className="flex w-full max-w-full flex-col gap-2 lg:w-56">
                            {canMarkQuoteVersionSent(version.status) ? (
                              <QuoteVersionActionForm action={markQuoteVersionSentAction} idleLabel="Marcar como enviada" leadId={lead.id} pendingLabel="Actualizando…" quoteVersionId={version.id} />
                            ) : null}
                            {canAcceptQuoteVersion(version.status) ? (
                              <QuoteVersionActionForm action={acceptQuoteVersionAction} confirmMessage="¿Aceptar esta cotización? Las demás alternativas activas quedarán rechazadas." idleLabel="Aceptar" leadId={lead.id} pendingLabel="Aceptando…" quoteVersionId={version.id} variant="default" />
                            ) : null}
                            {canRejectQuoteVersion(version.status) ? (
                              <QuoteVersionActionForm action={rejectQuoteVersionAction} confirmMessage="¿Marcar esta cotización como rechazada?" idleLabel="Rechazar" leadId={lead.id} pendingLabel="Actualizando…" quoteVersionId={version.id} />
                            ) : null}
                            {canExpireQuoteVersion(version.status) ? (
                              <QuoteVersionActionForm action={expireQuoteVersionAction} idleLabel="Marcar expirada" leadId={lead.id} pendingLabel="Actualizando…" quoteVersionId={version.id} />
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[color:var(--admin-muted-foreground)]">Todavía no existe una cotización comercial para esta oportunidad. Usa <strong>Nueva cotización comercial</strong> para capturar la primera alternativa sin tocar el historial de solicitudes del cliente.</p>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Solicitudes del cliente" description="Solicitudes de viaje recibidas del cliente; no representan versiones de una cotización comercial de AC Travel.">
              {quoteRequests.length ? (
                <div className="space-y-3" id="solicitudes-cotizacion">
                  {quoteRequests.map((request) => (
                    <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={request.id}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-[color:var(--admin-foreground)]">{request.channelLabel}</p>
                          <p className="text-xs text-[color:var(--admin-muted-foreground)]">{formatDateTime(request.createdAt)} · {request.locale === "es" ? "Español" : "Inglés"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={quoteRequestStatusTone(request.status)}>{request.statusLabel}</StatusBadge>
                          <QuietActionButton asChild><Link href={request.href}>Abrir oportunidad</Link></QuietActionButton>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[color:var(--admin-muted-foreground)]">Aún no hay solicitudes del cliente visibles para esta oportunidad.</p>
              )}
            </SectionCard>

            {lead.contacts?.notes ? (
              <SectionCard title="Contexto del contacto" description="Notas existentes guardadas directamente en la ficha del contacto.">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--admin-foreground)]">{lead.contacts.notes}</p>
              </SectionCard>
            ) : null}

            {notes.length ? (
              <SectionCard title="Notas internas" description="Registro escrito por el equipo comercial para este prospecto.">
                <div className="space-y-3">
                  {notes.map((note) => (
                    <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={note.id}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <p className="text-sm font-semibold text-[color:var(--admin-foreground)]">{relatedName(note.profiles) ?? "Equipo interno"}</p>
                        <p className="text-xs text-[color:var(--admin-muted-foreground)]">{formatDateTime(note.created_at)}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--admin-foreground)]">{note.body}</p>
                    </article>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Actividad comercial" description="Línea de tiempo con eventos reales del lead, sin mensajes técnicos de proveedores o payloads internos.">
              <ActivityTimeline items={timeline} emptyDescription="Aún no hay eventos comerciales visibles para este prospecto." emptyTitle="Sin actividad comercial" />
            </SectionCard>

            {(payments.length || bookings.length || documents.length) ? (
              <section className="grid gap-4 lg:grid-cols-3">
                {payments.length ? (
                  <SectionCard title="Pagos relacionados" description="Pagos visibles enlazados a este lead.">
                    <div className="space-y-3">
                      {payments.map((payment) => (
                        <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={payment.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[color:var(--admin-foreground)]">{money(payment.currency === "MXN" ? payment.amount : null, payment.currency === "USD" ? payment.amount : null)}</p>
                              <p className="text-xs text-[color:var(--admin-muted-foreground)]">{paymentTypeLabel(payment.payment_type)} · {formatDateTime(payment.created_at)}</p>
                            </div>
                            <StatusBadge tone={payment.status === "pending" ? "warning" : "success"}>{paymentStatusLabel(payment.status)}</StatusBadge>
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}

                {bookings.length ? (
                  <SectionCard title="Reservas relacionadas" description="Reservas visibles ya asociadas a este prospecto.">
                    <div className="space-y-3">
                      {bookings.map((booking) => (
                        <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={booking.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[color:var(--admin-foreground)]">{booking.booking_code ?? "Reserva sin código visible"}</p>
                              <p className="text-xs text-[color:var(--admin-muted-foreground)]">{formatDate(booking.starts_on)} → {formatDate(booking.ends_on)}</p>
                            </div>
                            <StatusBadge tone="brand">{bookingStatusLabel(booking.status)}</StatusBadge>
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}

                {documents.length ? (
                  <SectionCard title="Documentos relacionados" description="Documentos visibles ya cargados para este lead.">
                    <div className="space-y-3">
                      {documents.map((document) => (
                        <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={document.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[color:var(--admin-foreground)]">{document.title}</p>
                              <p className="text-xs text-[color:var(--admin-muted-foreground)]">{documentTypeLabel(document.document_type)} · {formatDateTime(document.created_at)}</p>
                            </div>
                            <StatusBadge tone="neutral">{documentStatusLabel(document.status)}</StatusBadge>
                          </div>
                        </article>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24">
            <SectionCard title="Acciones rápidas" description="Todas las acciones mantienen la misma lógica de servidor, permisos y revalidación actuales.">
              <div className="space-y-5">
                <form action={updateLeadStatusAction} className="space-y-2">
                  <input name="leadId" type="hidden" value={lead.id} />
                  <input name="contactId" type="hidden" value={lead.contact_id} />
                  <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="statusId">Cambiar estado</label>
                  <select className={adminSelectClassName} defaultValue={lead.lead_statuses?.id ?? ""} id="statusId" name="statusId">
                    {statuses.map((status) => <option key={status.id} value={status.id}>{status.label_es}</option>)}
                  </select>
                  <Button className="w-full" type="submit">Guardar estado</Button>
                </form>

                {canAssign ? (
                  <form action={assignLeadAction} className="space-y-2">
                    <input name="leadId" type="hidden" value={lead.id} />
                    <input name="contactId" type="hidden" value={lead.contact_id} />
                    <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="advisorId">Asignar asesor</label>
                    <select className={adminSelectClassName} defaultValue={lead.profiles?.id ?? ""} id="advisorId" name="advisorId">
                      <option value="">Sin asignar</option>
                      {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
                    </select>
                    <Button className="w-full" type="submit" variant="outline">Guardar asignación</Button>
                  </form>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  {hasWhatsApp && whatsappHref ? <Button asChild variant="outline"><a href={whatsappHref} rel="noreferrer" target="_blank">Abrir WhatsApp</a></Button> : null}
                  <Button asChild variant="outline"><Link href="/admin/operations/bookings">Crear reserva</Link></Button>
                  <Button asChild variant="outline"><Link href="/admin/payments">Registrar pago</Link></Button>
                  <Button asChild variant="outline"><Link href="/admin/operations/documents">Agregar documento</Link></Button>
                </div>

                 {hasWhatsApp || lead.contacts?.email ? <LeadTemplateActions
                  contactId={lead.contact_id}
                  email={lead.contacts?.email}
                  leadId={lead.id}
                  locale={lead.contacts?.preferred_locale}
                  phone={lead.contacts?.phone}
                  templates={messageTemplates.templates}
                  variables={templateVariables}
                 /> : null}

                <form action={addLeadNoteAction} className="space-y-2">
                  <input name="leadId" type="hidden" value={lead.id} />
                  <input name="contactId" type="hidden" value={lead.contact_id} />
                  <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="body">Agregar nota</label>
                  <textarea className={`${adminInputClassName} min-h-28 py-3`} id="body" name="body" required />
                  <Button className="w-full" type="submit">Guardar nota</Button>
                </form>

                <form action={registerFollowUpAction} className="space-y-2 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
                  <input name="leadId" type="hidden" value={lead.id} />
                  <input name="contactId" type="hidden" value={lead.contact_id} />
                  <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="followUpBody">Registrar seguimiento</label>
                  <textarea className={`${adminInputClassName} min-h-24 py-3`} id="followUpBody" name="followUpBody" required />
                  <label className="text-sm font-medium text-[color:var(--admin-foreground)]" htmlFor="followUpAt">Próximo contacto (opcional)</label>
                  <input className={adminInputClassName} id="followUpAt" name="followUpAt" type="datetime-local" />
                  <Button className="w-full" type="submit">Guardar seguimiento</Button>
                </form>

                  {canDeleteLead ? <div className="space-y-2 rounded-[var(--admin-radius-control)] border border-amber-200 bg-amber-50 p-4">{lead.deleted_at ? <><p className="text-sm font-semibold text-amber-900">Oportunidad eliminada del CRM</p><p className="text-sm text-amber-900">Restaura la oportunidad para volver a incluirla en el trabajo activo. El historial se conserva.</p><RestoreOpportunityForm action={restoreOpportunityAction} contactId={lead.contact_id} opportunityId={lead.id} /></> : <><p className="text-sm font-semibold text-amber-900">Eliminar del CRM</p><p className="text-sm text-amber-900">Es una eliminación lógica auditada: conserva todo el historial y no es una purga permanente.</p><SoftDeleteOpportunityForm action={softDeleteOpportunityAction} contactId={lead.contact_id} opportunityId={lead.id} /></>}</div> : null}
                 {canDeleteLead && deletionSummary && deletionSummary.isTestData && !deletionSummary.error && !deletionSummary.blocked ? (
                  <div className="space-y-3 rounded-[var(--admin-radius-control)] border border-red-200 bg-red-50 p-4">
                    <div className="space-y-1">
                           <p className="text-sm font-semibold text-red-900">Purga permanente de datos de prueba</p>
                               <p className="text-sm text-red-900">Solo administradores. Esta purga está separada de Eliminar del CRM y solo aparece cuando el preflight confirma que no existe historial material. El contacto canónico se conserva por defecto y solo puede eliminarse de forma opcional si queda totalmente huérfano y sin historial material. No se usa para oportunidades operativas.</p>
                    </div>

                    {deletionSummary?.error ? (
                      <div className="rounded-[var(--admin-radius-control)] border border-red-200 bg-white/70 p-3 text-sm text-red-900">
                        {leadDeletionUnavailableMessage()}
                      </div>
                    ) : deletionSummary?.blocked ? (
                      <div className="space-y-2 rounded-[var(--admin-radius-control)] border border-red-200 bg-white/70 p-3 text-sm text-red-900">
                        <p className="font-medium">Eliminación bloqueada</p>
                        <p>Esta oportunidad conserva historial material y recomendamos preservar o archivar la oportunidad.</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {leadDeletionBlockers.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : deletionSummary ? (
                      <OperationDialog
                        description={deletionSummary.canDeleteOrphanContact
                          ? "Esta acción solo está disponible para administradores. Borra la oportunidad de forma permanente y, si marcas la limpieza segura, también podrá borrar el contacto únicamente cuando quede huérfano y sin historial material."
                          : "Esta acción solo está disponible para administradores y borra la oportunidad de forma permanente sin eliminar el contacto canónico."}
                             title="Purga permanente de datos de prueba"
                        triggerClassName="border border-red-200 bg-white text-red-700 hover:bg-red-50"
                             triggerLabel="Purga permanente de datos de prueba"
                      >
                            <LeadDeleteForm canDeleteOrphanContact={deletionSummary.canDeleteOrphanContact && deletionSummary.contactIsTestData} leadId={lead.id} returnToQuery={buildAdminSearchQueryString(currentSearchParams)} />
                      </OperationDialog>
                    ) : (
                      <div className="rounded-[var(--admin-radius-control)] border border-red-200 bg-white/70 p-3 text-sm text-red-900">
                        {leadDeletionUnavailableMessage()}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Atajos operativos" description="Accesos existentes para continuar el flujo sin duplicar lógica ni permisos.">
              <div className="grid gap-2">
                <QuietActionButton asChild><Link href="/admin/payments">Módulo de pagos</Link></QuietActionButton>
                <QuietActionButton asChild><Link href="/admin/operations/bookings">Módulo de reservas</Link></QuietActionButton>
                <QuietActionButton asChild><Link href="/admin/operations/documents">Módulo de documentos</Link></QuietActionButton>
                <QuietActionButton asChild><Link href="/admin/templates">Plantillas activas</Link></QuietActionButton>
              </div>
            </SectionCard>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}
