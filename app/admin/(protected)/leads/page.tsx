import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { getAdvisors, getDestinations, getLeads, getLeadStatuses, type LeadFilters } from "@/lib/admin/leads";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function money(mxn: number | null, usd: number | null) {
  if (mxn !== null) return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mxn);
  if (usd !== null) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
  return "—";
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireAdminRole(["admin", "asesor"])]);
  const filters: LeadFilters = {
    status: value(params, "status"),
    destination: value(params, "destination"),
    channel: value(params, "channel"),
    advisor: value(params, "advisor"),
    currency: value(params, "currency"),
    from: value(params, "from"),
    to: value(params, "to"),
  };
  const [{ leads, error }, statuses, advisors, destinations] = await Promise.all([getLeads(filters), getLeadStatuses(), getAdvisors(), getDestinations()]);
  const channels = Array.from(new Set(leads.map((lead) => lead.source))).sort();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">CRM</p>
        <h1 className="mt-2 text-3xl font-bold">Leads</h1>
        <p className="mt-2 text-muted-foreground">Listado protegido por sesión, rol y RLS.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.status ?? ""} name="status">
              <option value="">Todos los estados</option>
              {statuses.map((status) => <option key={status.id} value={status.name}>{status.label_es}</option>)}
            </select>
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.destination ?? ""} name="destination">
              <option value="">Todos los destinos</option>
              {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name_es}</option>)}
            </select>
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.advisor ?? ""} name="advisor">
              <option value="">Todos los asesores</option>
              <option value="unassigned">Sin asignar</option>
              {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}
            </select>
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.currency ?? ""} name="currency">
              <option value="">Cualquier moneda</option>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
            <input className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.from ?? ""} name="from" type="date" />
            <input className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.to ?? ""} name="to" type="date" />
            <input className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.channel ?? ""} name="channel" placeholder="Canal" list="lead-channels" />
            <datalist id="lead-channels">{channels.map((channel) => <option key={channel} value={channel} />)}</datalist>
            <div className="flex gap-2 xl:col-span-6">
              <Button type="submit">Aplicar</Button>
              <Button asChild variant="outline"><Link href="/admin/leads">Limpiar</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudo cargar el listado: {error}</CardContent></Card> : null}

      <Card>
        <CardHeader>
          <CardTitle>{leads.length} leads visibles</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {leads.length ? (
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr><th className="py-3 pr-4">Fecha</th><th className="py-3 pr-4">Contacto</th><th className="py-3 pr-4">WhatsApp</th><th className="py-3 pr-4">Destino</th><th className="py-3 pr-4">Viaje</th><th className="py-3 pr-4">Budget</th><th className="py-3 pr-4">Estado</th><th className="py-3 pr-4">Canal</th><th className="py-3 pr-4">Asesor</th><th className="py-3 pr-4">Actualizado</th></tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4">{new Date(lead.created_at).toLocaleDateString("es-MX")}</td>
                    <td className="py-3 pr-4"><Link className="font-semibold text-[var(--ac-blue)] hover:underline" href={`/admin/leads/${lead.id}`}>{[lead.contacts?.first_name, lead.contacts?.last_name].filter(Boolean).join(" ") || "Contacto"}</Link><div className="text-xs text-muted-foreground">{lead.contacts?.email ?? "Sin email"}</div></td>
                    <td className="py-3 pr-4">{lead.contacts?.phone ?? "—"}</td>
                    <td className="py-3 pr-4">{lead.destinations?.name_es ?? "—"}</td>
                    <td className="py-3 pr-4">{lead.travel_start_date ?? "—"} → {lead.travel_end_date ?? "—"}<div className="text-xs text-muted-foreground">{lead.travelers_count} pax</div></td>
                    <td className="py-3 pr-4">{money(lead.budget_mxn, lead.budget_usd)}</td>
                    <td className="py-3 pr-4">{lead.lead_statuses?.label_es ?? "—"}</td>
                    <td className="py-3 pr-4">{lead.source}</td>
                    <td className="py-3 pr-4">{lead.profiles?.full_name ?? "Sin asignar"}</td>
                    <td className="py-3 pr-4">{new Date(lead.updated_at).toLocaleString("es-MX")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No hay leads visibles con estos filtros.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
