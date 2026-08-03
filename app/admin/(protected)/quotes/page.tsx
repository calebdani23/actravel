import Link from "next/link";
import { FileWarning, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, MetricCard, PageContainer, PageHeader, SectionCard, StatusBadge, adminInputClassName, adminSelectClassName } from "@/components/admin/admin-primitives";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminCurrency, formatAdminDate, formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { getQuotePortfolio, type QuotePortfolioFilters, type QuotePortfolioItemDto } from "@/lib/admin/quotes";
import { getAdvisorCapableStaff } from "@/lib/admin/staff";

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<SearchParams> };

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function validUuid(input?: string) {
  return input && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input) ? input : null;
}

function quoteStatusLabel(status: string) {
  const labels: Record<string, string> = { draft: "Borrador", ready: "Lista", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada", expired: "Expirada", cancelled: "Cancelada" };
  return labels[status] ?? "Estado no identificado";
}

function quoteStatusTone(status: string) {
  if (status === "accepted") return "success" as const;
  if (status === "sent" || status === "ready") return "info" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function amount(quote: QuotePortfolioItemDto, pointer: "current" | "accepted") {
  const version = pointer === "current" ? quote.currentVersion : quote.acceptedVersion;
  if (!version) return "Sin versión";
  return version.totalAmount === null ? `${version.currency} por definir` : formatAdminCurrency(version.totalAmount, version.currency);
}

function pdfLabel(quote: QuotePortfolioItemDto) {
  const document = quote.currentVersion?.document;
  if (!document) return "Sin PDF";
  if (document.state === "ready") return "PDF listo";
  if (document.state === "failed") return "PDF con error";
  return "PDF pendiente";
}

function isExpiring(quote: QuotePortfolioItemDto) {
  const validUntil = quote.currentVersion?.validUntil;
  if (!validUntil || !["ready", "sent"].includes(quote.status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 14);
  const expiry = new Date(`${validUntil}T00:00:00`);
  return expiry >= today && expiry <= horizon;
}

function filterHref(params: SearchParams, changes: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, raw]) => {
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (item && !["afterUpdatedAt", "afterId"].includes(key)) next.set(key, item);
  });
  Object.entries(changes).forEach(([key, item]) => item ? next.set(key, item) : next.delete(key));
  const query = next.toString();
  return `/admin/quotes${query ? `?${query}` : ""}`;
}

export default async function QuotesPage({ searchParams }: PageProps) {
  const [params, session, advisors] = await Promise.all([
    searchParams,
    requireAdminRole(["admin", "asesor", "operaciones", "finanzas"]),
    getAdvisorCapableStaff(),
  ]);
  const canMutate = session.roles.includes("admin") || session.roles.includes("asesor");
  const canOpenCrm = canMutate;
  const status = value(params, "status");
  const currency = value(params, "currency");
  const validity = value(params, "validity");
  const pdf = value(params, "pdf");
  const view = value(params, "view");
  const afterUpdatedAt = value(params, "afterUpdatedAt");
  const afterId = validUuid(value(params, "afterId"));
  const filters: QuotePortfolioFilters = {
    search: value(params, "q"),
    status: ["draft", "ready", "sent", "accepted", "rejected", "expired", "cancelled"].includes(status ?? "") ? status : null,
    ownerId: validUuid(value(params, "advisor")),
    contactId: validUuid(value(params, "contactId")),
    opportunityId: validUuid(value(params, "opportunityId")),
    currency: ["MXN", "USD"].includes(currency ?? "") ? currency : null,
    validity: ["all", "valid", "expired", "no_expiry"].includes(validity ?? "") ? validity as QuotePortfolioFilters["validity"] : "all",
    pdf: ["ready", "missing"].includes(pdf ?? "") ? pdf as QuotePortfolioFilters["pdf"] : undefined,
    view: ["drafts", "ready", "sent", "accepted", "expiring", "missing_pdf"].includes(view ?? "") ? view as QuotePortfolioFilters["view"] : undefined,
    afterUpdatedAt: afterUpdatedAt && !Number.isNaN(new Date(afterUpdatedAt).getTime()) && afterId ? afterUpdatedAt : null,
    afterId: afterUpdatedAt && afterId ? afterId : null,
  };
  const result = await getQuotePortfolio(filters);
  const quotes = result.quotes;
  const totals = quotes.reduce((acc, quote) => {
    const version = quote.currentVersion;
    if (version?.totalAmount !== null && version?.totalAmount !== undefined) acc[version.currency] = (acc[version.currency] ?? 0) + version.totalAmount;
    return acc;
  }, {} as Record<string, number>);
  const missingPdf = quotes.filter((quote) => quote.currentVersion?.document?.state !== "ready").length;
  const quickViews = [
    ["drafts", "Borradores"],
    ["ready", "Listas"],
    ["sent", "Enviadas"],
    ["accepted", "Aceptadas"],
    ["expiring", "Por vencer"],
    ["missing_pdf", "Sin PDF"],
  ] as const;
  const nextHref = result.nextCursor ? filterHref(params, { afterUpdatedAt: result.nextCursor.updatedAt, afterId: result.nextCursor.id }) : null;

  return (
    <PageContainer>
      <PageHeader
        actions={canMutate ? <Button asChild><Link href="/admin/quotes/new">Nueva cotización</Link></Button> : undefined}
        breadcrumbs={[{ label: "Comercial" }, { label: "Cotizaciones" }]}
        description="Portafolio de propuestas comerciales de AC Travel. Una cotización comercial es distinta de la Solicitud del cliente que originó la oportunidad."
        eyebrow="Comercial"
        title="Cotizaciones comerciales"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard label="Visibles en esta página" value={formatAdminInteger(quotes.length)} tone="brand" />
        <MetricCard label="Borradores" value={formatAdminInteger(quotes.filter((quote) => quote.status === "draft").length)} tone="warning" />
        <MetricCard label="Listas" value={formatAdminInteger(quotes.filter((quote) => quote.status === "ready").length)} tone="info" />
        <MetricCard label="Enviadas" value={formatAdminInteger(quotes.filter((quote) => quote.status === "sent").length)} tone="info" />
        <MetricCard label="Aceptadas" value={formatAdminInteger(quotes.filter((quote) => quote.status === "accepted").length)} tone="success" />
        <MetricCard label="Por vencer en 14 días" value={formatAdminInteger(quotes.filter(isExpiring).length)} tone="warning" />
        <MetricCard label="Sin PDF canónico" value={formatAdminInteger(missingPdf)} tone={missingPdf ? "warning" : "success"} />
        <MetricCard detail="Valor actual, sin convertir USD" label="Valor MXN" value={formatAdminCurrency(totals.MXN ?? 0, "MXN")} />
        <MetricCard detail="Valor actual, sin convertir MXN" label="Valor USD" value={formatAdminCurrency(totals.USD ?? 0, "USD")} />
      </section>

      <SectionCard actions={<Button asChild variant="outline"><Link href="/admin/quotes">Limpiar</Link></Button>} description="Búsqueda y filtros aplicados en servidor sobre cotizaciones visibles para tu rol." title="Filtros">
        <form className="space-y-4">
          {filters.contactId ? <input name="contactId" type="hidden" value={filters.contactId} /> : null}
          {filters.opportunityId ? <input name="opportunityId" type="hidden" value={filters.opportunityId} /> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-2" htmlFor="quotes-search"><span className="text-xs font-semibold uppercase tracking-[0.14em]">Buscar</span><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input className={`${adminInputClassName} pl-9`} defaultValue={filters.search ?? ""} id="quotes-search" name="q" placeholder="Folio, título, contacto, oportunidad o asesor" /></div></label>
            <label className="space-y-2" htmlFor="quotes-status"><span className="text-xs font-semibold uppercase tracking-[0.14em]">Estado</span><select className={adminSelectClassName} defaultValue={filters.status ?? ""} id="quotes-status" name="status"><option value="">Todos</option>{["draft", "ready", "sent", "accepted", "rejected", "expired", "cancelled"].map((item) => <option key={item} value={item}>{quoteStatusLabel(item)}</option>)}</select></label>
            <label className="space-y-2" htmlFor="quotes-advisor"><span className="text-xs font-semibold uppercase tracking-[0.14em]">Asesor</span><select className={adminSelectClassName} defaultValue={filters.ownerId ?? ""} id="quotes-advisor" name="advisor"><option value="">Todos</option>{advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}</select></label>
            <label className="space-y-2" htmlFor="quotes-currency"><span className="text-xs font-semibold uppercase tracking-[0.14em]">Moneda</span><select className={adminSelectClassName} defaultValue={filters.currency ?? ""} id="quotes-currency" name="currency"><option value="">Todas</option><option value="MXN">MXN</option><option value="USD">USD</option></select></label>
            <label className="space-y-2" htmlFor="quotes-validity"><span className="text-xs font-semibold uppercase tracking-[0.14em]">Vigencia</span><select className={adminSelectClassName} defaultValue={filters.validity ?? "all"} id="quotes-validity" name="validity"><option value="all">Todas</option><option value="valid">Vigentes</option><option value="expired">Vencidas por fecha</option><option value="no_expiry">Sin fecha</option></select></label>
            <label className="space-y-2" htmlFor="quotes-pdf"><span className="text-xs font-semibold uppercase tracking-[0.14em]">PDF</span><select className={adminSelectClassName} defaultValue={filters.pdf ?? ""} id="quotes-pdf" name="pdf"><option value="">Cualquiera</option><option value="ready">Canónico listo</option><option value="missing">Pendiente o ausente</option></select></label>
            <div className="flex items-end"><Button type="submit">Aplicar filtros</Button></div>
          </div>
        </form>
        <nav aria-label="Vistas rápidas de cotizaciones" className="mt-4 flex flex-wrap gap-2">
          {quickViews.map(([key, label]) => <Button asChild key={key} size="sm" variant={filters.view === key ? "default" : "outline"}><Link href={filterHref(params, { view: filters.view === key ? undefined : key, status: undefined, pdf: undefined })}>{label}</Link></Button>)}
        </nav>
        {filters.contactId || filters.opportunityId ? <div className="mt-4 flex flex-wrap gap-2"><StatusBadge tone="brand">Contexto CRM aplicado</StatusBadge>{filters.contactId ? <Button asChild size="sm" variant="outline"><Link href={filterHref(params, { contactId: undefined })}>Quitar contacto</Link></Button> : null}{filters.opportunityId ? <Button asChild size="sm" variant="outline"><Link href={filterHref(params, { opportunityId: undefined })}>Quitar oportunidad</Link></Button> : null}</div> : null}
      </SectionCard>

      {result.issues.map((issue) => <ErrorState description={issue.message} key={`${issue.section}-${issue.code}`} title="Carga parcial" />)}

      <SectionCard description="La versión actual y la versión aceptada se muestran por separado; el historial no se reemplaza." title={`${formatAdminInteger(quotes.length)} cotizaciones visibles`}>
        {!quotes.length ? <EmptyState action={canMutate ? <Button asChild><Link href="/admin/quotes/new">Crear cotización</Link></Button> : undefined} description="No hay cotizaciones visibles con estos filtros y este alcance de rol." title="Sin resultados" /> : (
          <>
            <div className="grid gap-4 lg:hidden">
              {quotes.map((quote) => <article className="rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] p-4" key={quote.id}><div className="flex items-start justify-between gap-3"><div><Link className="font-semibold text-[color:var(--admin-accent)] hover:underline" href={`/admin/quotes/${quote.id}`}>{quote.number}</Link><p className="text-sm">{quote.title}</p></div><StatusBadge tone={quoteStatusTone(quote.status)}>{quoteStatusLabel(quote.status)}</StatusBadge></div><p className="mt-3 text-sm font-medium">{quote.contact.name}</p><p className="text-xs text-[color:var(--admin-muted-foreground)]">{quote.opportunity.label}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white p-3 text-xs"><span className="font-semibold">Actual</span><p>V{quote.currentVersion?.number ?? "—"} · {amount(quote, "current")}</p><p>{pdfLabel(quote)}</p></div><div className="rounded-lg bg-white p-3 text-xs"><span className="font-semibold">Aceptada</span><p>{quote.acceptedVersion ? `V${quote.acceptedVersion.number} · ${amount(quote, "accepted")}` : "Ninguna"}</p></div></div><p className="mt-3 text-xs">Solicitudes del cliente: {quote.requestCount} · Versiones: {quote.versionCount} · Actualizada {formatAdminDateTime(quote.updatedAt)}</p></article>)}
            </div>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Cotizaciones comerciales visibles según filtros, rol y alcance RLS</caption><thead className="text-xs uppercase tracking-[0.12em]"><tr>{["Folio", "Contacto y oportunidad", "Estado", "Versión actual", "Versión aceptada", "PDF", "Solicitud del cliente", "Actualizada"].map((label) => <th className="px-3 py-3" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{quotes.map((quote) => <tr className="border-t border-[color:var(--admin-border-subtle)] align-top" key={quote.id}><td className="px-3 py-4"><Link className="font-semibold text-[color:var(--admin-accent)] hover:underline" href={`/admin/quotes/${quote.id}`}>{quote.number}</Link><p className="mt-1 text-xs">{quote.title}</p></td><td className="px-3 py-4"><p className="font-medium">{canOpenCrm ? <Link className="hover:underline" href={`/admin/contacts/${quote.contact.id}`}>{quote.contact.name}</Link> : quote.contact.name}</p><p className="mt-1 text-xs">{canOpenCrm ? <Link className="hover:underline" href={`/admin/leads/${quote.opportunity.id}`}>{quote.opportunity.label}</Link> : quote.opportunity.label}</p></td><td className="px-3 py-4"><StatusBadge tone={quoteStatusTone(quote.status)}>{quoteStatusLabel(quote.status)}</StatusBadge></td><td className="px-3 py-4"><p>V{quote.currentVersion?.number ?? "—"} · {quote.currentVersion ? quoteStatusLabel(quote.currentVersion.status) : "Sin versión"}</p><p className="mt-1 text-xs">{amount(quote, "current")} · {quote.currentVersion?.validUntil ? `Vence ${formatAdminDate(quote.currentVersion.validUntil)}` : "Sin vigencia"}</p></td><td className="px-3 py-4">{quote.acceptedVersion ? <><p>V{quote.acceptedVersion.number} · {amount(quote, "accepted")}</p><p className="mt-1 text-xs">Aceptada independiente de la actual</p></> : "Ninguna"}</td><td className="px-3 py-4"><span className="inline-flex items-center gap-1"><FileWarning aria-hidden="true" className="h-4 w-4" />{pdfLabel(quote)}</span></td><td className="px-3 py-4">{quote.requestCount}</td><td className="px-3 py-4 whitespace-nowrap">{formatAdminDateTime(quote.updatedAt)}</td></tr>)}</tbody></table></div>
          </>
        )}
      </SectionCard>

      {nextHref ? <nav aria-label="Paginación de cotizaciones" className="flex justify-end"><Button asChild variant="outline"><Link href={nextHref}>Siguiente página</Link></Button></nav> : null}
    </PageContainer>
  );
}
