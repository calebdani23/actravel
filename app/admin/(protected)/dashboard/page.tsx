import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/admin/dashboard";

const metricLabels: Record<string, string> = {
  newLeads: "Leads nuevos",
  followUpLeads: "Pendientes de contacto",
  activeQuotes: "Cotizaciones en proceso/enviadas",
  pendingPayments: "Pagos por validar",
  upcomingBookings: "Reservas próximas",
  activePromotions: "Promociones activas",
  whatsappClicks: "Clics WhatsApp (30 días)",
};

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Panel interno</p>
        <h1 className="mt-2 text-3xl font-bold">Dashboard operativo</h1>
        <p className="mt-2 text-muted-foreground">Métricas RLS-aware según el alcance del usuario autenticado.</p>
      </div>

      {metrics.errors.length ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            Algunas métricas no pudieron cargarse por permisos o datos no disponibles: {metrics.errors.join("; ")}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(metricLabels).map(([key, label]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics.counts[key as keyof typeof metrics.counts]}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads por canal</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.leadsByChannel.length ? (
              <ul className="space-y-2 text-sm">
                {metrics.leadsByChannel.map((channel) => (
                  <li key={channel.source} className="flex justify-between border-b pb-2 last:border-b-0">
                    <span>{channel.source}</span>
                    <span className="font-semibold">{channel.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin leads visibles todavía.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trabajo inmediato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Revisa leads nuevos o pendientes y registra el siguiente seguimiento manual.</p>
            <Link className="font-semibold text-[var(--ac-blue)] hover:underline" href="/admin/leads">
              Abrir leads →
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
