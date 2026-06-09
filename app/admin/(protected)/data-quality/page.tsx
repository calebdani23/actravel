import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getDuplicateAuditReport, type DuplicateGroupPlan } from "@/lib/admin/data-quality";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-MX");
}

function metricCard(label: string, value: number, detail: string) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function tableImpactSummary(group: DuplicateGroupPlan) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border bg-slate-50 p-3">Leads: <span className="font-semibold">{group.impactSummary.leads}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Quote requests: <span className="font-semibold">{group.impactSummary.quote_requests}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Bookings: <span className="font-semibold">{group.impactSummary.bookings}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Payments: <span className="font-semibold">{group.impactSummary.payments}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Documents: <span className="font-semibold">{group.impactSummary.documents}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Notifications: <span className="font-semibold">{group.impactSummary.notifications}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">WhatsApp clicks: <span className="font-semibold">{group.impactSummary.whatsapp_clicks}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Impacto total: <span className="font-semibold">{group.impactSummary.total}</span></div>
    </div>
  );
}

function duplicateGroupCard(group: DuplicateGroupPlan) {
  return (
    <Card key={`${group.kind}-${group.normalizedValue}`}>
      <CardHeader>
        <CardTitle className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <span>{group.kind === "email" ? "Email" : "Teléfono"} duplicado: <span className="font-mono text-sm">{group.normalizedValue}</span></span>
          <span className="text-sm font-medium text-muted-foreground">{group.contacts.length} contactos · canónico sugerido {group.canonicalContactId.slice(0, 8)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tableImpactSummary(group)}

        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Contacto</th>
                <th className="px-3 py-2 font-medium">Identidad</th>
                <th className="px-3 py-2 font-medium">Dependencias</th>
                <th className="px-3 py-2 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {group.contacts.map((contact) => (
                <tr className="border-t align-top" key={contact.id}>
                  <td className="px-3 py-3">
                    <p className="font-medium">{contact.displayName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{contact.id}</p>
                    {contact.id === group.canonicalContactId ? <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Recomendado</span> : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    <p>{contact.email || "Sin email"}</p>
                    <p>{contact.phone || "Sin teléfono"}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{contact.totalDependencies} refs directas</p>
                    <p>L {contact.dependencyCounts.leads} · Q {contact.dependencyCounts.quote_requests} · B {contact.dependencyCounts.bookings}</p>
                    <p>P {contact.dependencyCounts.payments} · D {contact.dependencyCounts.documents} · N {contact.dependencyCounts.notifications} · W {contact.dependencyCounts.whatsapp_clicks}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(contact.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Plan de merge manual</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {group.manualMergeGuidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminDataQualityPage() {
  await requireAdminRole(["admin"]);
  const report = await getDuplicateAuditReport();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">P2.3 · Calidad de datos</p>
        <h1 className="mt-2 text-3xl font-bold">Auditoría de duplicados y planificación de merge</h1>
        <p className="mt-2 text-muted-foreground">Vista exacta server-side para revisar identidad, dependencias por contacto y condiciones previas antes de endurecer constraints o consolidar contactos.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCard("Total contactos", report.totalContacts, "Base exacta actual")}
        {metricCard("Grupos por email", report.duplicateEmailGroups.length, "Normalizados en servidor")}
        {metricCard("Grupos por teléfono", report.duplicatePhoneGroups.length, "Normalizados en servidor")}
        {metricCard("Eventos ambiguos", report.ambiguousIdentityEvents, "lead_events tipo contact_identity_ambiguous")}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Estrategia de constraints y merges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{report.strategy.deferredReason}</p>
            <div>
              <p className="font-semibold text-foreground">Condiciones antes de agregar unicidad dura</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {report.strategy.readinessChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Casos ambiguos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {report.ambiguousIdentityCases.length ? (
              <ul className="space-y-3 text-sm">
                {report.ambiguousIdentityCases.map((item) => (
                  <li className="rounded-md border p-3" key={item.id}>
                    <p className="font-medium">Lead {item.leadId.slice(0, 8)} · {item.reason || "sin razón"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Contactos involucrados: {item.matchedContactIds.length ? item.matchedContactIds.join(", ") : "no disponible"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay eventos ambiguos registrados.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Grupos duplicados por email</h2>
            <p className="text-sm text-muted-foreground">Revisión recomendada cuando varias filas comparten email normalizado.</p>
          </div>
          <Link className="text-sm font-semibold text-[var(--ac-blue)] hover:underline" href="/admin/leads">Cruzar con leads →</Link>
        </div>
        {report.duplicateEmailGroups.length ? report.duplicateEmailGroups.map(duplicateGroupCard) : <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sin grupos duplicados por email.</CardContent></Card>}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Grupos duplicados por teléfono</h2>
          <p className="text-sm text-muted-foreground">Útil para detectar variantes del mismo número o teléfonos compartidos que requieren criterio humano.</p>
        </div>
        {report.duplicatePhoneGroups.length ? report.duplicatePhoneGroups.map(duplicateGroupCard) : <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sin grupos duplicados por teléfono.</CardContent></Card>}
      </section>
    </main>
  );
}
