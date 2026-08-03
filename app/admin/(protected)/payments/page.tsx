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
import { getOperationOptions, getPayments, type PaymentRow } from "@/lib/admin/operations";
import { getAcceptedQuoteHandoffByVersion, type QuoteHandoffDto } from "@/lib/admin/quotes";
import {
  bookingDisplayName,
  contactDisplayName,
  filterPayments,
  formatAmountBreakdown,
  leadDisplayName,
  matchesDateRange,
  metricCountDetail,
  bookingStatusLabel,
  paymentRecordedAt,
  paymentRelationLabel,
  paymentStatusLabel,
  paymentStatusTone,
  paymentTypeLabel,
  type PaymentFilters,
} from "@/lib/admin/operations-view";
import { STORAGE_UPLOAD_ACCEPT, STORAGE_UPLOAD_CONFIG } from "@/lib/admin/storage-uploads";
import { deletePaymentAction, upsertPaymentAction } from "../operations/actions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Options = Awaited<ReturnType<typeof getOperationOptions>>;

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = new Date(year, month, 1).toISOString().slice(0, 10);
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function paymentMetric(rows: PaymentRow[]) {
  return {
    count: rows.length,
    detail: metricCountDetail(rows.length, rows.map((row) => ({ amount: row.amount, currency: row.currency })), "Sin movimientos"),
  };
}

function latestUpdate(payments: PaymentRow[]) {
  return payments.reduce<string | null>((latest, payment) => {
    if (!latest || payment.updated_at > latest) return payment.updated_at;
    return latest;
  }, null);
}

function ProofLinks({ payment }: Readonly<{ payment: PaymentRow }>) {
  if (!payment.proof_preview_url && !payment.proof_download_url) return <span className="text-sm text-[color:var(--admin-muted-foreground)]">Sin comprobante adjunto</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {payment.proof_preview_url ? <Button asChild size="sm" variant="outline"><a href={payment.proof_preview_url} rel="noreferrer" target="_blank">Vista previa</a></Button> : null}
      {payment.proof_download_url ? <Button asChild size="sm" variant="outline"><a download href={payment.proof_download_url}>Descargar</a></Button> : null}
    </div>
  );
}

function PaymentForm({ handoff, options, payment }: Readonly<{ handoff?: QuoteHandoffDto | null; options: Options; payment?: PaymentRow }>) {
  const prefix = payment?.id ?? "new-payment";
  const acceptedVersionId = payment?.accepted_quote_version_id ?? handoff?.acceptedVersion.id ?? "";
  const quoteId = payment?.accepted_quote_version?.quote_id ?? handoff?.quoteId ?? "";

  return (
    <form action={upsertPaymentAction} className="space-y-5">
      {payment ? <input name="id" type="hidden" value={payment.id} /> : null}
      {acceptedVersionId ? <input name="accepted_quote_version_id" type="hidden" value={acceptedVersionId} /> : null}
      {quoteId ? <input name="quote_id" type="hidden" value={quoteId} /> : null}

      {handoff ? <section className="rounded-[var(--admin-radius-card)] border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Origen: {handoff.quoteNumber} · V{handoff.acceptedVersion.number}</p><p>{handoff.acceptedVersion.title} · {handoff.contact.name}</p><p className="mt-1">El pago se registrará únicamente al enviar este formulario.</p></section> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Relación operativa</h3>
            <p className={adminFieldHintClassName}>Conserva exactamente los mismos vínculos con contacto, prospecto o reserva.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2" htmlFor={`${prefix}-contact`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Contacto</span>
              <select className={adminSelectClassName} defaultValue={payment?.contact_id ?? handoff?.contact.id ?? ""} id={`${prefix}-contact`} name="contact_id">
                <option value="">Sin contacto</option>
                {handoff && !options.contacts.some((contact) => contact.id === handoff.contact.id) ? <option value={handoff.contact.id}>{handoff.contact.name}</option> : null}
                {options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactDisplayName(contact)}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-lead`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Prospecto</span>
              <select className={adminSelectClassName} defaultValue={payment?.lead_id ?? handoff?.opportunity.id ?? ""} id={`${prefix}-lead`} name="lead_id">
                <option value="">Sin prospecto</option>
                {handoff && !options.leads.some((lead) => lead.id === handoff.opportunity.id) ? <option value={handoff.opportunity.id}>{handoff.opportunity.label}</option> : null}
                {options.leads.map((lead) => <option key={lead.id} value={lead.id}>{leadDisplayName(lead)}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-booking`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Reserva</span>
              <select className={adminSelectClassName} defaultValue={payment?.booking_id ?? ""} id={`${prefix}-booking`} name="booking_id">
                <option value="">Sin reserva</option>
                {options.bookings.map((booking) => <option key={booking.id} value={booking.id}>{bookingDisplayName(booking)} · {bookingStatusLabel(booking.status)}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Información financiera</h3>
            <p className={adminFieldHintClassName}>Mantén monto, moneda, tipo y método sin cambiar nombres de campos ni validaciones actuales.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2" htmlFor={`${prefix}-amount`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Monto</span>
              <input className={adminInputClassName} defaultValue={payment?.amount ?? handoff?.acceptedVersion.depositAmount ?? ""} id={`${prefix}-amount`} min="0" name="amount" required step="0.01" type="number" />
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-currency`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Moneda</span>
              <select className={adminSelectClassName} defaultValue={payment?.currency ?? handoff?.acceptedVersion.currency ?? "MXN"} id={`${prefix}-currency`} name="currency">
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-type`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Tipo</span>
              <select className={adminSelectClassName} defaultValue={payment?.payment_type ?? "deposit"} id={`${prefix}-type`} name="payment_type">
                <option value="deposit">Anticipo</option>
                <option value="partial">Parcial</option>
                <option value="balance">Liquidación</option>
                <option value="full">Pago total</option>
                <option value="refund">Reembolso</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-method`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Método</span>
              <select className={adminSelectClassName} defaultValue={payment?.method_id ?? ""} id={`${prefix}-method`} name="method_id">
                <option value="">Sin método</option>
                {options.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label_es}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Estado y fecha</h3>
            <p className={adminFieldHintClassName}>La verificación automática y el registro interno se mantienen al guardar.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2" htmlFor={`${prefix}-status`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={payment?.status ?? "pending"} id={`${prefix}-status`} name="status">
                <option value="pending">Pendiente</option>
                <option value="received">Recibido</option>
                <option value="verified">Verificado</option>
                <option value="rejected">Rechazado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-paid-at`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Fecha de pago</span>
              <input className={adminInputClassName} defaultValue={payment?.paid_at?.slice(0, 16) ?? ""} id={`${prefix}-paid-at`} name="paid_at" type="datetime-local" />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Comprobante y notas</h3>
            <p className={adminFieldHintClassName}>El archivo permanece privado y los enlaces temporales se generan automáticamente cuando hacen falta.</p>
          </div>

          <PrivateFileInput
            accept={STORAGE_UPLOAD_ACCEPT}
            helpText={STORAGE_UPLOAD_CONFIG["payment-proofs"].helpText}
            label="Comprobante (opcional)"
            maxSizeBytes={STORAGE_UPLOAD_CONFIG["payment-proofs"].maxSizeBytes}
            name="proof_file"
            replacementHelpText={payment ? "Si seleccionas uno nuevo, el comprobante anterior se limpia automáticamente al guardar." : undefined}
          />

          <label className="space-y-2" htmlFor={`${prefix}-notes`}>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Notas internas</span>
            <textarea className="min-h-28 w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 py-3 text-sm text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] outline-none transition focus-visible:border-[color:var(--admin-accent)] focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]" defaultValue={payment?.notes ?? ""} id={`${prefix}-notes`} name="notes" />
          </label>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {payment ? <Button formAction={deletePaymentAction} type="submit" variant="outline">Eliminar pago</Button> : null}
        <Button type="submit">{payment ? "Guardar pago" : "Registrar pago"}</Button>
      </div>
    </form>
  );
}

function ActiveFilterChips({ filters, options }: Readonly<{ filters: PaymentFilters; options: Options }>) {
  const relationLabel = filters.relation === "contact" ? "Contacto" : filters.relation === "lead" ? "Prospecto" : filters.relation === "booking" ? "Reserva" : null;
  const reconciliationLabel = filters.reconciliation === "pending" ? "Pendiente de conciliación" : filters.reconciliation === "done" ? "Conciliado" : null;
  const methodLabel = options.paymentMethods.find((method) => method.id === filters.method)?.label_es;

  const chips = [
    filters.q ? `Búsqueda: ${filters.q}` : null,
    relationLabel ? `Relación: ${relationLabel}` : null,
    filters.status ? `Estado: ${paymentStatusLabel(filters.status)}` : null,
    methodLabel ? `Método: ${methodLabel}` : null,
    filters.type ? `Tipo: ${paymentTypeLabel(filters.type)}` : null,
    filters.currency ? `Moneda: ${filters.currency}` : null,
    filters.from ? `Desde: ${formatAdminDate(filters.from)}` : null,
    filters.to ? `Hasta: ${formatAdminDate(filters.to)}` : null,
    reconciliationLabel ? `Conciliación: ${reconciliationLabel}` : null,
  ].filter(Boolean) as string[];

  if (!chips.length) return null;

  return <div aria-label="Filtros activos" className="flex flex-wrap gap-2">{chips.map((chip) => <StatusBadge className="font-medium" key={chip}>{chip}</StatusBadge>)}</div>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  await requireAdminRole(["admin", "finanzas"]);
  const [params, { payments, error }, options] = await Promise.all([searchParams, getPayments(), getOperationOptions()]);
  const acceptedQuoteVersionId = value(params, "acceptedQuoteVersionId");
  const handoffResult = acceptedQuoteVersionId
    ? await getAcceptedQuoteHandoffByVersion(acceptedQuoteVersionId)
    : { handoff: null, issues: [] };
  const handoff = handoffResult.handoff?.operations.canManagePayment ? handoffResult.handoff : null;

  const filters: PaymentFilters = {
    q: value(params, "q"),
    relation: value(params, "relation"),
    status: value(params, "status"),
    method: value(params, "method"),
    type: value(params, "type"),
    currency: value(params, "currency"),
    from: value(params, "from"),
    to: value(params, "to"),
    reconciliation: value(params, "reconciliation"),
  };

  if (error) console.error("Payments view partial load", { error });

  const filteredPayments = filterPayments(payments, filters);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const { from: monthFrom, to: monthTo } = currentMonthRange();
  const receivedThisMonth = filteredPayments.filter((payment) => ["received", "verified"].includes(payment.status) && matchesDateRange(paymentRecordedAt(payment), monthFrom, monthTo));
  const pendingPayments = filteredPayments.filter((payment) => payment.status === "pending");
  const advances = filteredPayments.filter((payment) => payment.payment_type === "deposit");
  const balances = filteredPayments.filter((payment) => payment.payment_type === "balance");
  const unreconciled = filteredPayments.filter((payment) => payment.status === "received");
  const currentQuery = buildAdminSearchQueryString(params);
  const updatedAt = latestUpdate(filteredPayments.length ? filteredPayments : payments);

  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            {updatedAt ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">Actualizado {formatAdminDateTime(updatedAt)}</p> : null}
            <QuietActionButton asChild>
              <Link href={`/admin/payments${currentQuery}`}><RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />Actualizar</Link>
            </QuietActionButton>
            <OperationDialog description="El flujo conserva la validación, la carga privada y el resguardo seguro de comprobantes." title="Registrar pago" triggerLabel="Registrar pago">
              <PaymentForm handoff={handoff} options={options} />
            </OperationDialog>
          </>
        }
        breadcrumbs={[{ label: "Operaciones", href: "/admin/dashboard" }, { label: "Pagos" }]}
        description="Consolida registro, conciliación visual y comprobantes privados sin exponer rutas internas ni detalles técnicos del sistema."
        eyebrow="Operaciones"
        title="Pagos"
      />

      {acceptedQuoteVersionId && !handoff ? <ErrorState description="La versión indicada no es una cotización aceptada visible y apta para registrar un pago." title="Contexto de cotización no disponible" /> : null}
      {handoff ? <SectionCard title={`Registrar desde ${handoff.quoteNumber}`} description="El contexto aceptado solo prellena el formulario; no se crea ningún pago automáticamente."><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="success">Aceptada V{handoff.acceptedVersion.number}</StatusBadge><span className="text-sm">{handoff.contact.name} · {handoff.opportunity.label}</span><Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${handoff.quoteId}`}>Abrir cotización</Link></Button></div></SectionCard> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard detail={paymentMetric(receivedThisMonth).detail} label="Recibidos este mes" tone={receivedThisMonth.length ? "success" : "neutral"} value={formatAdminInteger(receivedThisMonth.length)} />
        <MetricCard detail={paymentMetric(pendingPayments).detail} label="Pendientes" tone={pendingPayments.length ? "warning" : "success"} value={formatAdminInteger(pendingPayments.length)} />
        <MetricCard detail={paymentMetric(advances).detail} label="Anticipos" tone={advances.length ? "brand" : "neutral"} value={formatAdminInteger(advances.length)} />
        <MetricCard detail={paymentMetric(balances).detail} label="Liquidaciones" tone={balances.length ? "info" : "neutral"} value={formatAdminInteger(balances.length)} />
        <MetricCard detail={paymentMetric(unreconciled).detail} label="Sin conciliar" tone={unreconciled.length ? "warning" : "success"} value={formatAdminInteger(unreconciled.length)} />
      </section>

      <SectionCard
        actions={activeFilters ? <QuietActionButton asChild><Link href="/admin/payments">Limpiar filtros</Link></QuietActionButton> : null}
        description="Tus filtros se conservan en el enlace para recargar, compartir la vista interna o volver al mismo contexto operativo."
        title="Filtros de pagos"
      >
        <form className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))_auto]">
            <label className="space-y-2" htmlFor="payments-search">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Buscar</span>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--admin-muted-foreground)]" />
                <input className={`${adminInputClassName} pl-9`} defaultValue={filters.q ?? ""} id="payments-search" name="q" placeholder="Contacto, prospecto, reserva o método" />
              </div>
            </label>

            <label className="space-y-2" htmlFor="payments-status">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={filters.status ?? ""} id="payments-status" name="status">
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="received">Recibido</option>
                <option value="verified">Verificado</option>
                <option value="rejected">Rechazado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="payments-method">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Método</span>
              <select className={adminSelectClassName} defaultValue={filters.method ?? ""} id="payments-method" name="method">
                <option value="">Todos</option>
                {options.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label_es}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor="payments-type">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Tipo</span>
              <select className={adminSelectClassName} defaultValue={filters.type ?? ""} id="payments-type" name="type">
                <option value="">Todos</option>
                <option value="deposit">Anticipo</option>
                <option value="partial">Parcial</option>
                <option value="balance">Liquidación</option>
                <option value="full">Pago total</option>
                <option value="refund">Reembolso</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="payments-currency">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Moneda</span>
              <select className={adminSelectClassName} defaultValue={filters.currency ?? ""} id="payments-currency" name="currency">
                <option value="">Todas</option>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">Aplicar</Button>
              <Button asChild type="button" variant="outline"><Link href="/admin/payments">Limpiar</Link></Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2" htmlFor="payments-relation">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Relación</span>
              <select className={adminSelectClassName} defaultValue={filters.relation ?? ""} id="payments-relation" name="relation">
                <option value="">Cualquiera</option>
                <option value="contact">Contacto</option>
                <option value="lead">Prospecto</option>
                <option value="booking">Reserva</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="payments-from">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Desde</span>
              <input className={adminInputClassName} defaultValue={filters.from ?? ""} id="payments-from" name="from" type="date" />
            </label>

            <label className="space-y-2" htmlFor="payments-to">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Hasta</span>
              <input className={adminInputClassName} defaultValue={filters.to ?? ""} id="payments-to" name="to" type="date" />
            </label>

            <label className="space-y-2" htmlFor="payments-reconciliation">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Conciliación</span>
              <select className={adminSelectClassName} defaultValue={filters.reconciliation ?? ""} id="payments-reconciliation" name="reconciliation">
                <option value="">Cualquiera</option>
                <option value="pending">Pendiente de conciliación</option>
                <option value="done">Conciliado</option>
              </select>
            </label>
          </div>

          <ActiveFilterChips filters={filters} options={options} />
          <p className={adminFieldHintClassName}>La tabla mantiene únicamente pagos visibles para tu sesión y rol financiero.</p>
        </form>
      </SectionCard>

      {error ? <ErrorState description="No se pudieron cargar todos los pagos de esta vista. Puedes actualizar la página o revisar los registros autorizados si el problema persiste." title="Carga incompleta" /> : null}

      <SectionCard
        description="Vista compacta para revisión diaria. Las acciones llevan al comprobante temporal o al formulario de edición sin mostrar rutas privadas."
        title={`${formatAdminInteger(filteredPayments.length)} pagos visibles`}
      >
        {!filteredPayments.length ? (
          <EmptyState
            action={activeFilters ? <Button asChild variant="outline"><Link href="/admin/payments">Quitar filtros</Link></Button> : undefined}
            description={activeFilters ? "No hay pagos visibles que coincidan con los filtros actuales." : "Todavía no hay pagos visibles para tu sesión financiera."}
            title={activeFilters ? "Sin resultados" : "Sin pagos registrados"}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {filteredPayments.map((payment) => {
                const rowHref = `/admin/payments${currentQuery}#payment-edit-${payment.id}`;
                return (
                  <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={payment.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-[color:var(--admin-foreground)]">{contactDisplayName(payment.contacts)}</p>
                        <p className="text-sm text-[color:var(--admin-muted-foreground)]">{leadDisplayName(payment.leads)} · {bookingDisplayName(payment.bookings)}</p>
                      </div>
                      <StatusBadge tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusBadge>
                    </div>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Monto</dt>
                          <dd className="mt-1 font-medium text-[color:var(--admin-foreground)]">{formatAmountBreakdown([{ amount: payment.amount, currency: payment.currency }])}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Tipo y método</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{paymentTypeLabel(payment.payment_type)} · {payment.payment_methods?.label_es ?? "Sin método"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Fecha</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{formatAdminDateTime(paymentRecordedAt(payment))}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Comprobante</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{payment.proof_preview_url || payment.proof_download_url ? "Disponible" : "Pendiente"}</dd>
                        </div>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline"><Link href={rowHref}>Editar</Link></Button>
                       {payment.proof_preview_url ? <Button asChild size="sm" variant="outline"><a href={payment.proof_preview_url} rel="noreferrer" target="_blank">Ver comprobante</a></Button> : null}
                       {payment.accepted_quote_version ? <Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${payment.accepted_quote_version.quote_id}`}>Cotización aceptada</Link></Button> : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)]">
                <table className="w-full table-fixed text-left text-sm">
                  <caption className="sr-only">Tabla de pagos operativos</caption>
                  <thead className="bg-[color:var(--admin-surface-muted)] text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3" scope="col">Contacto</th>
                      <th className="px-4 py-3" scope="col">Contexto</th>
                      <th className="px-4 py-3" scope="col">Monto</th>
                      <th className="px-4 py-3" scope="col">Método</th>
                      <th className="px-4 py-3" scope="col">Fecha</th>
                      <th className="px-4 py-3" scope="col">Estado</th>
                      <th className="px-4 py-3" scope="col">Comprobante</th>
                      <th className="px-4 py-3" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => {
                      const rowHref = `/admin/payments${currentQuery}#payment-edit-${payment.id}`;
                      return (
                        <tr className="border-t border-[color:var(--admin-border-subtle)] align-top" key={payment.id}>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[color:var(--admin-foreground)]">{contactDisplayName(payment.contacts)}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{payment.contacts?.email ?? payment.contacts?.phone ?? "Sin correo o teléfono"}</p>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">
                            <p>{paymentRelationLabel(payment)} · {paymentTypeLabel(payment.payment_type)}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{leadDisplayName(payment.leads)} · {bookingDisplayName(payment.bookings)}</p>
                          </td>
                          <td className="px-4 py-4 font-medium text-[color:var(--admin-foreground)]">{formatAmountBreakdown([{ amount: payment.amount, currency: payment.currency }])}</td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">
                            <p>{payment.payment_methods?.label_es ?? "Sin método"}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{payment.currency}</p>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]"><span className="whitespace-nowrap">{formatAdminDateTime(paymentRecordedAt(payment))}</span></td>
                          <td className="px-4 py-4"><StatusBadge tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusBadge></td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{payment.proof_preview_url || payment.proof_download_url ? "Disponible" : "Pendiente"}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="outline"><Link href={rowHref}>Editar</Link></Button>
                               {payment.proof_preview_url ? <Button asChild size="sm" variant="outline"><a href={payment.proof_preview_url} rel="noreferrer" target="_blank">Vista previa</a></Button> : null}
                               {payment.accepted_quote_version ? <Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${payment.accepted_quote_version.quote_id}`}>Cotización</Link></Button> : null}
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

      {filteredPayments.length ? (
        <SectionCard description="Los formularios mantienen los mismos campos ocultos, validaciones y acciones de guardado para editar o eliminar registros existentes." title="Edición y mantenimiento">
          <div className="space-y-4">
            {filteredPayments.map((payment) => (
              <details className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)]" id={`payment-edit-${payment.id}`} key={payment.id}>
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-[color:var(--admin-foreground)]">{contactDisplayName(payment.contacts)} · {formatAmountBreakdown([{ amount: payment.amount, currency: payment.currency }])}</p>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{paymentTypeLabel(payment.payment_type)} · {payment.payment_methods?.label_es ?? "Sin método"} · {formatAdminDateTime(paymentRecordedAt(payment))}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusBadge>
                      <span className="text-xs text-[color:var(--admin-muted-foreground)]">{payment.proof_preview_url || payment.proof_download_url ? "Con comprobante" : "Sin comprobante"}</span>
                    </div>
                  </div>
                </summary>
                <div className="border-t border-[color:var(--admin-border-subtle)] p-4 sm:p-6">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <ProofLinks payment={payment} />
                  </div>
                  <PaymentForm options={options} payment={payment} />
                </div>
              </details>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </PageContainer>
  );
}
