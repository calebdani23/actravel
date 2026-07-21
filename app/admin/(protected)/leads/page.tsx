import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { EmptyState, ErrorState, MetricCard, PageContainer, PageHeader, QuietActionButton, SectionCard, StatusBadge, adminFieldHintClassName, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatLeadSourceLabel, getAdvisors, getDestinations, getLeads, getLeadSources, getLeadStatuses, type LeadFilters } from "@/lib/admin/leads";
import { formatAdminCurrency, formatAdminDate, formatAdminDateTime, formatAdminInteger, formatAdminLeadChipStructuredValue, formatAdminTravelerCount } from "@/lib/admin/format";
import { appendAdminSearchParams, buildAdminSearchQueryString } from "@/lib/admin/navigation";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function money(mxn: number | null, usd: number | null) {
  if (mxn !== null) return formatAdminCurrency(mxn, "MXN");
  if (usd !== null) return formatAdminCurrency(usd, "USD");
  return "—";
}

function leadStatusTone(status?: string | null) {
  if (!status) return "neutral" as const;
  if (["won", "booked", "converted", "paid"].includes(status)) return "success" as const;
  if (["new", "contacted", "qualified", "proposal_sent"].includes(status)) return "info" as const;
  if (["lost", "cancelled", "archived"].includes(status)) return "neutral" as const;
  return "brand" as const;
}

function formatDateTime(value: string) {
  return formatAdminDateTime(value);
}

function formatDate(value?: string | null) {
  return formatAdminDate(value);
}

function tripLabel(start?: string | null, end?: string | null, travelersCount?: number) {
  const range = start || end ? `${formatDate(start)} → ${formatDate(end)}` : "Sin fechas de viaje";
  return `${range} · ${formatAdminTravelerCount(travelersCount)}`;
}

function activeFilterLabels(filters: LeadFilters, options: {
  statuses: Array<{ name: string; label_es: string }>;
  destinations: Array<{ id: string; name_es: string }>;
  advisors: Array<{ id: string; full_name: string }>;
}) {
  const statusOptions = options.statuses.map((item) => ({ value: item.name, label: item.label_es }));
  const destinationOptions = options.destinations.map((item) => ({ value: item.id, label: item.name_es }));
  const advisorOptions = options.advisors.map((item) => ({ value: item.id, label: item.full_name }));

  return [
    filters.q ? `Búsqueda: ${filters.q}` : null,
    filters.status ? `Estado: ${formatAdminLeadChipStructuredValue("status", filters.status, statusOptions)}` : null,
    filters.destination ? `Destino: ${formatAdminLeadChipStructuredValue("destination", filters.destination, destinationOptions)}` : null,
    filters.advisor ? `Asesor: ${formatAdminLeadChipStructuredValue("advisor", filters.advisor, advisorOptions)}` : null,
    filters.channel ? `Canal: ${formatLeadSourceLabel(filters.channel)}` : null,
    filters.currency ? `Moneda: ${filters.currency}` : null,
    filters.from ? `Desde: ${formatAdminDate(filters.from)}` : null,
    filters.to ? `Hasta: ${formatAdminDate(filters.to)}` : null,
  ].filter(Boolean) as string[];
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireAdminRole(["admin", "asesor"])]);
  const filters: LeadFilters = {
    q: value(params, "q"),
    status: value(params, "status"),
    destination: value(params, "destination"),
    channel: value(params, "channel"),
    advisor: value(params, "advisor"),
    currency: value(params, "currency"),
    from: value(params, "from"),
    to: value(params, "to"),
  };
  const [{ leads, error }, statuses, advisors, destinations, channels] = await Promise.all([getLeads(filters), getLeadStatuses(), getAdvisors(), getDestinations(), getLeadSources()]);
  const activeFilters = Object.entries(filters).filter(([, filterValue]) => filterValue).length;
  const chips = activeFilterLabels(filters, { statuses, destinations, advisors });
  const currentQuery = buildAdminSearchQueryString(params);
  const crmBaseHref = `/admin/leads${currentQuery}`;

  if (error) console.error("Leads list dashboard-safe error", { filters, error });

  return (
    <PageContainer>
      <PageHeader
        actions={<Button asChild><Link href="/admin/leads/new">Nuevo prospecto</Link></Button>}
        breadcrumbs={[{ label: "Comercial", href: crmBaseHref }, { label: "Prospectos" }]}
        description="Mantiene la misma consulta, filtros y visibilidad actual; la vista solo mejora lectura, priorización y acceso al detalle."
        eyebrow="CRM"
        title="Prospectos"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Resultado actual según tus filtros y permisos." label="Prospectos visibles" tone="brand" value={formatAdminInteger(leads.length)} />
        <MetricCard detail="Se cuentan únicamente los filtros con valor." label="Filtros activos" tone={activeFilters ? "info" : "neutral"} value={formatAdminInteger(activeFilters)} />
        <MetricCard detail="Cargados desde perfiles con capacidad comercial." label="Asesores disponibles" tone="neutral" value={formatAdminInteger(advisors.length)} />
        <MetricCard detail="Catálogo disponible para refinar el CRM." label="Destinos disponibles" tone="neutral" value={formatAdminInteger(destinations.length)} />
      </section>

      <SectionCard title="Filtros del CRM" description="La búsqueda mantiene exactamente los mismos parámetros de consulta actuales." actions={activeFilters ? <QuietActionButton asChild><Link href="/admin/leads">Limpiar filtros</Link></QuietActionButton> : null}>
        <form className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
            <label className="space-y-2 xl:col-span-1" htmlFor="lead-search">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Buscar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--admin-muted-foreground)]" aria-hidden="true" />
                <input className={cn(adminInputClassName, "pl-9")} defaultValue={filters.q ?? ""} id="lead-search" name="q" placeholder="Nombre, correo, WhatsApp o destino" />
              </div>
            </label>

            <label className="space-y-2" htmlFor="lead-status">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</span>
              <select className={adminSelectClassName} defaultValue={filters.status ?? ""} id="lead-status" name="status">
                <option value="">Todos los estados</option>
                {statuses.map((status) => <option key={status.id} value={status.name}>{status.label_es}</option>)}
              </select>
            </label>

            <label className="space-y-2" htmlFor="lead-from">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Desde</span>
              <input className={adminInputClassName} defaultValue={filters.from ?? ""} id="lead-from" name="from" type="date" />
            </label>

            <label className="space-y-2" htmlFor="lead-to">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Hasta</span>
              <input className={adminInputClassName} defaultValue={filters.to ?? ""} id="lead-to" name="to" type="date" />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">Aplicar</Button>
              <Button asChild variant="outline"><Link href="/admin/leads">Limpiar</Link></Button>
            </div>
          </div>

          <details className="group rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--admin-foreground)]">
              <span>Más filtros</span>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2" htmlFor="lead-destination">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Destino</span>
                <select className={adminSelectClassName} defaultValue={filters.destination ?? ""} id="lead-destination" name="destination">
                  <option value="">Todos los destinos</option>
                  {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name_es}</option>)}
                </select>
              </label>
              <label className="space-y-2" htmlFor="lead-advisor">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Asesor</span>
                <select className={adminSelectClassName} defaultValue={filters.advisor ?? ""} id="lead-advisor" name="advisor">
                  <option value="">Todos los asesores</option>
                  <option value="unassigned">Sin asignar</option>
                  {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
                </select>
              </label>
              <label className="space-y-2" htmlFor="lead-currency">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Moneda</span>
                <select className={adminSelectClassName} defaultValue={filters.currency ?? ""} id="lead-currency" name="currency">
                  <option value="">Cualquier moneda</option>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="space-y-2" htmlFor="lead-channel">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Canal</span>
                <input className={adminInputClassName} defaultValue={filters.channel ?? ""} id="lead-channel" name="channel" placeholder="Origen o canal" list="lead-channels" />
              </label>
            </div>
          </details>

          <datalist id="lead-channels">{channels.map((channel) => <option key={channel} value={channel} />)}</datalist>

          {chips.length ? (
            <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
              {chips.map((chip) => <StatusBadge className="font-medium" key={chip} tone="neutral">{chip}</StatusBadge>)}
            </div>
          ) : null}

          <p className={adminFieldHintClassName}>La visibilidad del listado sigue limitada por sesión, rol y RLS.</p>
        </form>
      </SectionCard>

       {error ? <ErrorState description="No se pudo cargar por completo el listado del CRM. Intenta actualizar la vista o revisa los logs autorizados si el problema continúa." title="Carga incompleta" /> : null}

      <SectionCard description="Se preservan los enlaces al detalle, los mismos campos y el comportamiento actual del CRM." title={`${formatAdminInteger(leads.length)} prospectos visibles`}>
        {leads.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:hidden">
              {leads.map((lead) => {
                const contactName = [lead.contacts?.first_name, lead.contacts?.last_name].filter(Boolean).join(" ") || "Contacto";

                return (
                  <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={lead.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link className="font-semibold text-[color:var(--admin-accent)] hover:underline" href={appendAdminSearchParams(`/admin/leads/${lead.id}`, params)}>{contactName}</Link>
                        <p className="text-sm text-[color:var(--admin-muted-foreground)]">{lead.contacts?.email ?? "Sin correo"}</p>
                      </div>
                      <StatusBadge tone={leadStatusTone(lead.lead_statuses?.name)}>{lead.lead_statuses?.label_es ?? "—"}</StatusBadge>
                    </div>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Destino y viaje</dt>
                        <dd className="mt-1 text-[color:var(--admin-foreground)]">{lead.destinations?.name_es ?? "Sin destino"}</dd>
                        <dd className="text-xs text-[color:var(--admin-muted-foreground)]">{tripLabel(lead.travel_start_date, lead.travel_end_date, lead.travelers_count)}</dd>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Asesor</dt><dd className="mt-1 text-[color:var(--admin-foreground)]">{lead.profiles?.full_name ?? "Sin asignar"}</dd></div>
                        <div><dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Canal</dt><dd className="mt-1 text-[color:var(--admin-foreground)]">{formatLeadSourceLabel(lead.source)}</dd></div>
                        <div><dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Presupuesto</dt><dd className="mt-1 text-[color:var(--admin-foreground)]">{money(lead.budget_mxn, lead.budget_usd)}</dd></div>
                        <div><dt className="text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Última actividad</dt><dd className="mt-1 text-[color:var(--admin-foreground)]">{formatDateTime(lead.updated_at)}</dd></div>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                       <Button asChild size="sm" variant="outline"><Link href={appendAdminSearchParams(`/admin/leads/${lead.id}`, params)}>Abrir detalle</Link></Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden lg:block">
              <div className="overflow-x-auto rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)]">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Listado de prospectos del CRM</caption>
                  <thead className="bg-[color:var(--admin-surface-muted)] text-xs uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3" scope="col">Contacto</th>
                      <th className="px-4 py-3" scope="col">Destino y viaje</th>
                      <th className="px-4 py-3" scope="col">Estado</th>
                      <th className="px-4 py-3" scope="col">Asesor</th>
                      <th className="px-4 py-3" scope="col">Canal</th>
                      <th className="px-4 py-3" scope="col">Presupuesto</th>
                      <th className="px-4 py-3" scope="col">Última actividad</th>
                      <th className="px-4 py-3" scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const contactName = [lead.contacts?.first_name, lead.contacts?.last_name].filter(Boolean).join(" ") || "Contacto";

                      return (
                        <tr className="border-t border-[color:var(--admin-border-subtle)] align-top" key={lead.id}>
                          <td className="px-4 py-4">
                            <Link className="font-semibold text-[color:var(--admin-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-ring)]" href={appendAdminSearchParams(`/admin/leads/${lead.id}`, params)}>{contactName}</Link>
                            <div className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{lead.contacts?.email ?? "Sin correo"}</div>
                            <div className="text-xs text-[color:var(--admin-muted-foreground)]">{lead.contacts?.phone ?? "Sin WhatsApp"}</div>
                          </td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">
                            <div>{lead.destinations?.name_es ?? "Sin destino"}</div>
                            <div className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">{tripLabel(lead.travel_start_date, lead.travel_end_date, lead.travelers_count)}</div>
                          </td>
                          <td className="px-4 py-4"><StatusBadge tone={leadStatusTone(lead.lead_statuses?.name)}>{lead.lead_statuses?.label_es ?? "—"}</StatusBadge></td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{lead.profiles?.full_name ?? "Sin asignar"}</td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{formatLeadSourceLabel(lead.source)}</td>
                          <td className="px-4 py-4 text-[color:var(--admin-foreground)]">{money(lead.budget_mxn, lead.budget_usd)}</td>
                           <td className="whitespace-nowrap px-4 py-4 text-[color:var(--admin-foreground)]">{formatDateTime(lead.updated_at)}</td>
                           <td className="px-4 py-4"><QuietActionButton asChild><Link href={appendAdminSearchParams(`/admin/leads/${lead.id}`, params)}>Abrir</Link></QuietActionButton></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState action={<Button asChild variant="outline"><Link href="/admin/leads">Resetear búsqueda</Link></Button>} description="No hay prospectos visibles con estos filtros. La visibilidad sigue limitada por rol y RLS." title="Sin resultados" />
        )}
      </SectionCard>
    </PageContainer>
  );
}
