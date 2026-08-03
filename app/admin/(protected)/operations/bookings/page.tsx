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
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDate, formatAdminDateTime, formatAdminInteger, formatAdminTravelerCount } from "@/lib/admin/format";
import { buildAdminSearchQueryString } from "@/lib/admin/navigation";
import { getBookings, getOperationOptions, type BookingRow } from "@/lib/admin/operations";
import { getAcceptedQuoteHandoffByVersion, type QuoteHandoffDto } from "@/lib/admin/quotes";
import {
  bookingAmountLabel,
  bookingDateRangeLabel,
  bookingDisplayName,
  bookingStatusLabel,
  bookingStatusTone,
  contactDisplayName,
  filterBookings,
  leadDisplayName,
  type BookingFilters,
} from "@/lib/admin/operations-view";
import { deleteBookingAction, upsertBookingAction } from "../actions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Options = Awaited<ReturnType<typeof getOperationOptions>>;

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function latestUpdate(bookings: BookingRow[]) {
  return bookings.reduce<string | null>((latest, booking) => {
    if (!latest || booking.updated_at > latest) return booking.updated_at;
    return latest;
  }, null);
}

function isUpcomingThisMonth(booking: BookingRow) {
  if (!booking.starts_on) return false;
  const now = new Date();
  const start = new Date(`${booking.starts_on}T00:00:00`);
  return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth() && start >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function BookingForm({ booking, handoff, options }: Readonly<{ booking?: BookingRow; handoff?: QuoteHandoffDto | null; options: Options }>) {
  const prefix = booking?.id ?? "new-booking";
  const acceptedVersionId = booking?.accepted_quote_version_id ?? handoff?.acceptedVersion.id ?? "";
  const quoteId = booking?.accepted_quote_version?.quote_id ?? handoff?.quoteId ?? "";
  const totalMxn = handoff?.acceptedVersion.currency === "MXN" ? handoff.acceptedVersion.totalAmount : null;
  const totalUsd = handoff?.acceptedVersion.currency === "USD" ? handoff.acceptedVersion.totalAmount : null;

  return (
    <form action={upsertBookingAction} className="space-y-5">
      {booking ? <input name="id" type="hidden" value={booking.id} /> : null}
      {acceptedVersionId ? <input name="accepted_quote_version_id" type="hidden" value={acceptedVersionId} /> : null}
      {quoteId ? <input name="quote_id" type="hidden" value={quoteId} /> : null}

      {handoff ? <section className="rounded-[var(--admin-radius-card)] border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Origen: {handoff.quoteNumber} · V{handoff.acceptedVersion.number}</p><p>{handoff.acceptedVersion.title} · {handoff.contact.name}</p><p className="mt-1">La reserva se creará únicamente al enviar este formulario.</p></section> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Relación y propiedad</h3>
            <p className={adminFieldHintClassName}>La reserva se mantiene ligada al mismo contacto, prospecto y asesor asignado.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2" htmlFor={`${prefix}-contact`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Contacto</span>
              <select className={adminSelectClassName} defaultValue={booking?.contact_id ?? handoff?.contact.id ?? ""} id={`${prefix}-contact`} name="contact_id" required>
                <option value="">Selecciona</option>
                {handoff && !options.contacts.some((contact) => contact.id === handoff.contact.id) ? <option value={handoff.contact.id}>{handoff.contact.name}</option> : null}
                {options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactDisplayName(contact)}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-lead`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Prospecto</span>
              <select className={adminSelectClassName} defaultValue={booking?.lead_id ?? handoff?.opportunity.id ?? ""} id={`${prefix}-lead`} name="lead_id">
                <option value="">Sin prospecto</option>
                {handoff && !options.leads.some((lead) => lead.id === handoff.opportunity.id) ? <option value={handoff.opportunity.id}>{handoff.opportunity.label}</option> : null}
                {options.leads.map((lead) => <option key={lead.id} value={lead.id}>{leadDisplayName(lead)}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-assigned`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Asesor</span>
              <select className={adminSelectClassName} defaultValue={booking?.assigned_to ?? handoff?.ownerId ?? ""} id={`${prefix}-assigned`} name="assigned_to">
                <option value="">Sin asignar</option>
                {handoff?.ownerId && !options.advisors.some((advisor) => advisor.id === handoff.ownerId) ? <option value={handoff.ownerId}>Asesor de la cotización</option> : null}
                {options.advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Identificación operativa</h3>
            <p className={adminFieldHintClassName}>Se conservan código, estado, destino y servicio exactamente en los mismos campos.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2" htmlFor={`${prefix}-code`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Código</span>
              <input className={adminInputClassName} defaultValue={booking?.booking_code ?? ""} id={`${prefix}-code`} name="booking_code" />
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-status`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={booking?.status ?? "draft"} id={`${prefix}-status`} name="status">
                <option value="draft">Borrador</option>
                <option value="confirmed">Confirmada</option>
                <option value="in_progress">En viaje</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-destination`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Destino</span>
              <select className={adminSelectClassName} defaultValue={booking?.destination_id ?? handoff?.opportunity.destinationId ?? ""} id={`${prefix}-destination`} name="destination_id">
                <option value="">Sin destino</option>
                {handoff?.opportunity.destinationId && !options.destinations.some((destination) => destination.id === handoff.opportunity.destinationId) ? <option value={handoff.opportunity.destinationId}>Destino de la cotización</option> : null}
                {options.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name_es}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-service`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Servicio</span>
              <select className={adminSelectClassName} defaultValue={booking?.service_id ?? handoff?.opportunity.serviceId ?? ""} id={`${prefix}-service`} name="service_id">
                <option value="">Sin servicio</option>
                {handoff?.opportunity.serviceId && !options.services.some((service) => service.id === handoff.opportunity.serviceId) ? <option value={handoff.opportunity.serviceId}>Servicio de la cotización</option> : null}
                {options.services.map((service) => <option key={service.id} value={service.id}>{service.name_es}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Viaje</h3>
            <p className={adminFieldHintClassName}>Fechas y viajeros visibles con el mismo esquema actual.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2" htmlFor={`${prefix}-starts`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Salida</span>
              <input className={adminInputClassName} defaultValue={booking?.starts_on ?? handoff?.opportunity.travelStartDate ?? ""} id={`${prefix}-starts`} name="starts_on" type="date" />
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-ends`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Regreso</span>
              <input className={adminInputClassName} defaultValue={booking?.ends_on ?? handoff?.opportunity.travelEndDate ?? ""} id={`${prefix}-ends`} name="ends_on" type="date" />
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-travelers`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Viajeros</span>
              <input className={adminInputClassName} defaultValue={booking?.travelers_count ?? handoff?.opportunity.travelersCount ?? 1} id={`${prefix}-travelers`} min="1" name="travelers_count" type="number" />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--admin-foreground)]">Monto y notas</h3>
            <p className={adminFieldHintClassName}>Se usan las mismas columnas de moneda y totales ya aprobadas para operaciones.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-2" htmlFor={`${prefix}-currency`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Moneda</span>
              <select className={adminSelectClassName} defaultValue={booking?.currency ?? handoff?.acceptedVersion.currency ?? "MXN"} id={`${prefix}-currency`} name="currency">
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-total-mxn`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Total MXN</span>
              <input className={adminInputClassName} defaultValue={booking?.total_mxn ?? totalMxn ?? ""} id={`${prefix}-total-mxn`} min="0" name="total_mxn" step="0.01" type="number" />
            </label>

            <label className="space-y-2" htmlFor={`${prefix}-total-usd`}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Total USD</span>
              <input className={adminInputClassName} defaultValue={booking?.total_usd ?? totalUsd ?? ""} id={`${prefix}-total-usd`} min="0" name="total_usd" step="0.01" type="number" />
            </label>
          </div>

          <label className="space-y-2" htmlFor={`${prefix}-notes`}>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Notas internas</span>
            <textarea className="min-h-28 w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 py-3 text-sm text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] outline-none transition focus-visible:border-[color:var(--admin-accent)] focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]" defaultValue={booking?.notes ?? ""} id={`${prefix}-notes`} name="notes" />
          </label>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {booking ? <Button formAction={deleteBookingAction} type="submit" variant="outline">Eliminar reserva</Button> : null}
        <Button type="submit">{booking ? "Guardar reserva" : "Registrar reserva"}</Button>
      </div>
    </form>
  );
}

function ActiveFilterChips({ filters, options }: Readonly<{ filters: BookingFilters; options: Options }>) {
  const destinationLabel = options.destinations.find((destination) => destination.id === filters.destination)?.name_es;
  const advisorLabel = filters.advisor === "unassigned" ? "Sin asignar" : options.advisors.find((advisor) => advisor.id === filters.advisor)?.full_name;
  const chips = [
    filters.q ? `Búsqueda: ${filters.q}` : null,
    filters.status ? `Estado: ${bookingStatusLabel(filters.status)}` : null,
    destinationLabel ? `Destino: ${destinationLabel}` : null,
    advisorLabel ? `Asesor: ${advisorLabel}` : null,
    filters.from ? `Desde: ${formatAdminDate(filters.from)}` : null,
    filters.to ? `Hasta: ${formatAdminDate(filters.to)}` : null,
  ].filter(Boolean) as string[];

  if (!chips.length) return null;
  return <div aria-label="Filtros activos" className="flex flex-wrap gap-2">{chips.map((chip) => <StatusBadge className="font-medium" key={chip}>{chip}</StatusBadge>)}</div>;
}

export default async function BookingsPage({ searchParams }: PageProps) {
  await requireAdminRole(["admin", "operaciones"]);
  const [params, { bookings, error }, options] = await Promise.all([searchParams, getBookings(), getOperationOptions()]);
  const acceptedQuoteVersionId = value(params, "acceptedQuoteVersionId");
  const handoffResult = acceptedQuoteVersionId
    ? await getAcceptedQuoteHandoffByVersion(acceptedQuoteVersionId)
    : { handoff: null, issues: [] };
  const handoff = handoffResult.handoff?.operations.canManageBooking ? handoffResult.handoff : null;

  const filters: BookingFilters = {
    q: value(params, "q"),
    status: value(params, "status"),
    advisor: value(params, "advisor"),
    destination: value(params, "destination"),
    from: value(params, "from"),
    to: value(params, "to"),
  };

  if (error) console.error("Bookings view partial load", { error });

  const filteredBookings = filterBookings(bookings, filters);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const updatedAt = latestUpdate(filteredBookings.length ? filteredBookings : bookings);
  const currentQuery = buildAdminSearchQueryString(params);
  const confirmed = filteredBookings.filter((booking) => booking.status === "confirmed");
  const drafts = filteredBookings.filter((booking) => booking.status === "draft");
  const upcoming = filteredBookings.filter(isUpcomingThisMonth);

  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            {updatedAt ? <p className="text-xs text-[color:var(--admin-muted-foreground)]">Actualizado {formatAdminDateTime(updatedAt)}</p> : null}
            <QuietActionButton asChild>
              <Link href={`/admin/operations/bookings${currentQuery}`}><RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />Actualizar</Link>
            </QuietActionButton>
            <OperationDialog description="La captura conserva la validación, la actualización automática y el borrado con limpieza de documentos relacionados." title="Registrar reserva" triggerLabel="Registrar reserva">
              <BookingForm handoff={handoff} options={options} />
            </OperationDialog>
          </>
        }
        breadcrumbs={[{ label: "Operaciones", href: "/admin/dashboard" }, { label: "Reservas" }]}
        description="Vista operativa para ordenar salidas, responsables y montos capturados sin revelar identificadores internos ni mensajes del sistema."
        eyebrow="Operaciones"
        title="Reservas"
      />

      {acceptedQuoteVersionId && !handoff ? <ErrorState description="La versión indicada no es una cotización aceptada visible y apta para crear una reserva." title="Contexto de cotización no disponible" /> : null}
      {handoff ? <SectionCard title={`Crear desde ${handoff.quoteNumber}`} description="El contexto aceptado solo prellena el formulario; no se crea ninguna reserva automáticamente."><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="success">Aceptada V{handoff.acceptedVersion.number}</StatusBadge><span className="text-sm">{handoff.contact.name} · {handoff.opportunity.label}</span><Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${handoff.quoteId}`}>Abrir cotización</Link></Button></div></SectionCard> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Reservas visibles según tu sesión y filtros activos." label="Visibles" tone="brand" value={formatAdminInteger(filteredBookings.length)} />
        <MetricCard detail="Listas para operación o seguimiento previo al viaje." label="Confirmadas" tone={confirmed.length ? "success" : "neutral"} value={formatAdminInteger(confirmed.length)} />
        <MetricCard detail="Salidas del mes actual a partir de la fecha de inicio cargada." label="Próximas este mes" tone={upcoming.length ? "info" : "neutral"} value={formatAdminInteger(upcoming.length)} />
        <MetricCard detail="Reservas aún en construcción o pendientes de completar." label="Borradores" tone={drafts.length ? "warning" : "success"} value={formatAdminInteger(drafts.length)} />
      </section>

      <SectionCard actions={activeFilters ? <QuietActionButton asChild><Link href="/admin/operations/bookings">Limpiar filtros</Link></QuietActionButton> : null} description="El enlace mantiene el mismo contexto de búsqueda por contacto, destino, fechas y asesor." title="Filtros de reservas">
        <form className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))_auto]">
            <label className="space-y-2" htmlFor="bookings-search">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Buscar</span>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--admin-muted-foreground)]" />
                <input className={`${adminInputClassName} pl-9`} defaultValue={filters.q ?? ""} id="bookings-search" name="q" placeholder="Reserva, contacto, destino o asesor" />
              </div>
            </label>

            <label className="space-y-2" htmlFor="bookings-status">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={filters.status ?? ""} id="bookings-status" name="status">
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="confirmed">Confirmada</option>
                <option value="in_progress">En viaje</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </label>

            <label className="space-y-2" htmlFor="bookings-destination">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Destino</span>
              <select className={adminSelectClassName} defaultValue={filters.destination ?? ""} id="bookings-destination" name="destination">
                <option value="">Todos</option>
                {options.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name_es}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor="bookings-advisor">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Asesor</span>
              <select className={adminSelectClassName} defaultValue={filters.advisor ?? ""} id="bookings-advisor" name="advisor">
                <option value="">Todos</option>
                <option value="unassigned">Sin asignar</option>
                {options.advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor="bookings-from">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Desde</span>
              <input className={adminInputClassName} defaultValue={filters.from ?? ""} id="bookings-from" name="from" type="date" />
            </label>

            <div className="flex flex-wrap items-end gap-2 xl:col-start-6">
              <Button type="submit">Aplicar</Button>
              <Button asChild type="button" variant="outline"><Link href="/admin/operations/bookings">Limpiar</Link></Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2" htmlFor="bookings-to">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Hasta</span>
              <input className={adminInputClassName} defaultValue={filters.to ?? ""} id="bookings-to" name="to" type="date" />
            </label>
          </div>

          <ActiveFilterChips filters={filters} options={options} />
          <p className={adminFieldHintClassName}>Se usan únicamente reservas visibles para tu rol operativo y los mismos filtros del enlace.</p>
        </form>
      </SectionCard>

      {error ? <ErrorState description="No se pudieron cargar todas las reservas de esta vista. Intenta actualizar o consulta los registros autorizados si el problema continúa." title="Carga incompleta" /> : null}

      <SectionCard description="La tabla prioriza lectura rápida por contacto, destino, fechas y responsable. Las acciones existentes siguen entrando al formulario real de mantenimiento." title={`${formatAdminInteger(filteredBookings.length)} reservas visibles`}>
        {!filteredBookings.length ? (
          <EmptyState
            action={activeFilters ? <Button asChild variant="outline"><Link href="/admin/operations/bookings">Quitar filtros</Link></Button> : undefined}
            description={activeFilters ? "No hay reservas visibles para los filtros seleccionados." : "Todavía no hay reservas visibles para esta sesión operativa."}
            title={activeFilters ? "Sin resultados" : "Sin reservas registradas"}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {filteredBookings.map((booking) => {
                const rowHref = `/admin/operations/bookings${currentQuery}#booking-edit-${booking.id}`;
                return (
                  <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={booking.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-[color:var(--admin-foreground)]">{bookingDisplayName(booking)}</p>
                        <p className="text-sm text-[color:var(--admin-muted-foreground)]">{contactDisplayName(booking.contacts)} · {booking.destinations?.name_es ?? "Sin destino"}</p>
                      </div>
                      <StatusBadge tone={bookingStatusTone(booking.status)}>{bookingStatusLabel(booking.status)}</StatusBadge>
                    </div>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Viaje</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{bookingDateRangeLabel(booking)}</dd>
                          <dd className="text-xs text-[color:var(--admin-muted-foreground)]">{formatAdminTravelerCount(booking.travelers_count)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Monto</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{bookingAmountLabel(booking)}</dd>
                          <dd className="text-xs text-[color:var(--admin-muted-foreground)]">Saldo no disponible en esta vista</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Asesor</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{booking.profiles?.full_name ?? "Sin asignar"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Prospecto</dt>
                          <dd className="mt-1 text-[color:var(--admin-foreground)]">{leadDisplayName(booking.leads)}</dd>
                        </div>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline"><Link href={rowHref}>Editar</Link></Button>
                       {booking.lead_id ? <Button asChild size="sm" variant="outline"><Link href={`/admin/leads/${booking.lead_id}`}>Abrir prospecto</Link></Button> : null}
                       {booking.accepted_quote_version ? <Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${booking.accepted_quote_version.quote_id}`}>Cotización aceptada</Link></Button> : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)]">
                <table className="w-full table-fixed text-left text-sm">
                  <caption className="sr-only">Tabla de reservas operativas</caption>
                  <thead className="bg-[color:var(--admin-surface-muted)] text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3" scope="col">Reserva y contacto</th>
                      <th className="px-4 py-3" scope="col">Destino</th>
                      <th className="px-4 py-3" scope="col">Viaje</th>
                      <th className="px-4 py-3" scope="col">Estado</th>
                      <th className="px-4 py-3" scope="col">Monto / saldo</th>
                      <th className="px-4 py-3" scope="col">Asesor</th>
                      <th className="px-4 py-3" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => {
                      const rowHref = `/admin/operations/bookings${currentQuery}#booking-edit-${booking.id}`;
                      return (
                        <tr className="border-t border-[color:var(--admin-border-subtle)] align-top" key={booking.id}>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[color:var(--admin-foreground)]">{bookingDisplayName(booking)}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{contactDisplayName(booking.contacts)}</p>
                            <p className="text-xs text-[color:var(--admin-muted-foreground)]">{leadDisplayName(booking.leads)}</p>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{booking.destinations?.name_es ?? "Sin destino"}</td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">
                            <p className="whitespace-nowrap">{bookingDateRangeLabel(booking)}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{formatAdminTravelerCount(booking.travelers_count)}</p>
                          </td>
                          <td className="px-4 py-4"><StatusBadge tone={bookingStatusTone(booking.status)}>{bookingStatusLabel(booking.status)}</StatusBadge></td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">
                            <p>{bookingAmountLabel(booking)}</p>
                            <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">Saldo no disponible en esta vista</p>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{booking.profiles?.full_name ?? "Sin asignar"}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="outline"><Link href={rowHref}>Editar</Link></Button>
                               {booking.lead_id ? <Button asChild size="sm" variant="outline"><Link href={`/admin/leads/${booking.lead_id}`}>Prospecto</Link></Button> : null}
                               {booking.accepted_quote_version ? <Button asChild size="sm" variant="outline"><Link href={`/admin/quotes/${booking.accepted_quote_version.quote_id}`}>Cotización</Link></Button> : null}
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

      {filteredBookings.length ? (
        <SectionCard description="Cada fila conserva sus acciones de actualización y borrado; la información se actualiza automáticamente en dashboard, pagos y documentos." title="Edición y mantenimiento">
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <details className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)]" id={`booking-edit-${booking.id}`} key={booking.id}>
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-[color:var(--admin-foreground)]">{bookingDisplayName(booking)} · {contactDisplayName(booking.contacts)}</p>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{booking.destinations?.name_es ?? "Sin destino"} · {bookingDateRangeLabel(booking)} · {bookingAmountLabel(booking)}</p>
                    </div>
                    <StatusBadge tone={bookingStatusTone(booking.status)}>{bookingStatusLabel(booking.status)}</StatusBadge>
                  </div>
                </summary>
                <div className="border-t border-[color:var(--admin-border-subtle)] p-4 sm:p-6">
                  <BookingForm booking={booking} options={options} />
                </div>
              </details>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </PageContainer>
  );
}
