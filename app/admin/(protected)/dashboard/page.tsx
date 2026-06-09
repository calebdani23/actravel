import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/admin/dashboard";

const metricCards = [
  { key: "leadsToday", label: "Leads hoy" },
  { key: "failedEmails", label: "Emails fallidos" },
  { key: "failedSheetSyncs", label: "Syncs Sheets fallidos" },
  { key: "whatsappClicks", label: "Clicks WhatsApp" },
] as const;

function alertClasses(level: "healthy" | "warning" | "critical") {
  if (level === "critical") return "border-red-200 bg-red-50 text-red-900";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Panel interno</p>
        <h1 className="mt-2 text-3xl font-bold">Dashboard operativo</h1>
        <p className="mt-2 text-muted-foreground">Visibilidad rápida de captación, incidentes y actividad comercial reciente.</p>
      </div>

      {metrics.alerts.map((alert) => (
        <Card className={alertClasses(alert.level)} key={`${alert.level}-${alert.title}`}>
          <CardContent className="pt-6">
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-1 text-sm">{alert.detail}</p>
          </CardContent>
        </Card>
      ))}

      {metrics.errors.length ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            Algunas métricas no pudieron cargarse por permisos o datos no disponibles: {metrics.errors.join("; ")}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ key, label }) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.counts[key]}</p>
              <p className="mt-2 text-xs text-muted-foreground">{metrics.windows[key]}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Errores e incidentes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentIncidents.length ? (
              <ul className="space-y-3 text-sm">
                {metrics.recentIncidents.map((incident) => (
                  <li className="rounded-md border p-3" key={`${incident.source}-${incident.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{incident.source === "email" ? "Email" : "Sheets"} · {incident.title}</p>
                        <p className="text-muted-foreground">{incident.detail}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${incident.incidentStatus === "open" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {incident.incidentStatus === "open" ? "Abierto" : "Resuelto"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{incident.status} · {new Date(incident.createdAt).toLocaleString("es-MX")}</p>
                    {incident.errorMessage ? <p className="mt-2 text-xs text-red-700">{incident.errorMessage}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin incidentes recientes visibles.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads por canal (7 días)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.leadsByChannel.length ? (
              <ul className="space-y-2 text-sm">
                {metrics.leadsByChannel.map((channel) => (
                  <li className="flex justify-between border-b pb-2 last:border-b-0" key={channel.source}>
                    <span>{channel.source}</span>
                    <span className="font-semibold">{channel.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin leads visibles todavía.</p>
            )}

            <div className="rounded-md border bg-slate-50 p-3 text-sm text-muted-foreground">
              <p>Revisa incidentes abiertos antes de cerrar el día operativo.</p>
              <div className="mt-3 flex gap-4">
                <Link className="font-semibold text-[var(--ac-blue)] hover:underline" href="/admin/logs">
                  Abrir logs →
                </Link>
                <Link className="font-semibold text-[var(--ac-blue)] hover:underline" href="/admin/leads">
                  Abrir leads →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
