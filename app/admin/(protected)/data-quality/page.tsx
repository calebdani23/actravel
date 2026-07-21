import Link from "next/link";
import { EmptyState, MetricCard, PageContainer, PageHeader, SectionCard, StatusBadge, adminSelectClassName } from "@/components/admin/admin-primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { buildDataQualityIssues, getDuplicateAuditReport, type DataQualityIssue, type DuplicateGroupPlan } from "@/lib/admin/data-quality";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function issueTypeLabel(type: DataQualityIssue["type"]) {
  return {
    duplicate_email: "Email duplicado",
    duplicate_phone: "Teléfono duplicado",
    ambiguous_identity: "Identidad ambigua",
  }[type] ?? "No identificado";
}

function issueSeverityLabel(severity: DataQualityIssue["severity"]) {
  return severity === "high" ? "Alta" : "Media";
}

function issueStatusLabel(status: DataQualityIssue["status"]) {
  return status === "pending" ? "Pendiente" : "Revisión manual";
}

function issueModuleLabel(module: DataQualityIssue["module"]) {
  return module === "contacts" ? "Contactos" : "Prospectos";
}

function issueTone(issue: DataQualityIssue) {
  if (issue.severity === "high") return "warning" as const;
  return "neutral" as const;
}

function dateMatch(dateFilter: string | undefined, value: string) {
  if (!dateFilter) return true;
  const now = Date.now();
  const diff = now - new Date(value).getTime();
  if (dateFilter === "7d") return diff <= 7 * 24 * 60 * 60 * 1000;
  if (dateFilter === "30d") return diff <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

function tableImpactSummary(group: DuplicateGroupPlan) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border bg-slate-50 p-3">Prospectos: <span className="font-semibold">{group.impactSummary.leads}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Cotizaciones: <span className="font-semibold">{group.impactSummary.quote_requests}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Reservas: <span className="font-semibold">{group.impactSummary.bookings}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Pagos: <span className="font-semibold">{group.impactSummary.payments}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Documentos: <span className="font-semibold">{group.impactSummary.documents}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">Notificaciones: <span className="font-semibold">{group.impactSummary.notifications}</span></div>
      <div className="rounded-md border bg-slate-50 p-3">WhatsApp: <span className="font-semibold">{group.impactSummary.whatsapp_clicks}</span></div>
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
          <span className="text-sm font-medium text-muted-foreground">{group.contacts.length} contactos · selección canónica sugerida</span>
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
                   <td className="px-3 py-3 text-xs text-muted-foreground">{formatAdminDateTime(contact.createdAt)}</td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Plan de revisión manual</p>
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

function ActiveFilterChips({ filters }: Readonly<{ filters: Record<string, string | undefined> }>) {
  const chips = [
    filters.type ? `Tipo: ${issueTypeLabel(filters.type as DataQualityIssue["type"])}` : null,
    filters.severity ? `Severidad: ${issueSeverityLabel(filters.severity as DataQualityIssue["severity"])}` : null,
    filters.status ? `Estado: ${issueStatusLabel(filters.status as DataQualityIssue["status"])}` : null,
    filters.module ? `Módulo: ${issueModuleLabel(filters.module as DataQualityIssue["module"])}` : null,
    filters.date ? `Periodo: ${filters.date === "7d" ? "Últimos 7 días" : filters.date === "30d" ? "Últimos 30 días" : "Todos"}` : null,
  ].filter(Boolean) as string[];

  if (!chips.length) return null;
  return <div aria-label="Filtros activos" className="flex flex-wrap gap-2">{chips.map((chip) => <StatusBadge key={chip}>{chip}</StatusBadge>)}</div>;
}

export default async function AdminDataQualityPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireAdminRole(["admin"])]);
  const report = await getDuplicateAuditReport();
  const filters = {
    type: value(params, "type"),
    severity: value(params, "severity"),
    status: value(params, "status"),
    module: value(params, "module"),
    date: value(params, "date"),
  };
  const allIssues = buildDataQualityIssues(report);
  const filteredIssues = allIssues.filter((issue) => {
    if (filters.type && issue.type !== filters.type) return false;
    if (filters.severity && issue.severity !== filters.severity) return false;
    if (filters.status && issue.status !== filters.status) return false;
    if (filters.module && issue.module !== filters.module) return false;
    if (!dateMatch(filters.date, issue.detectedAt)) return false;
    return true;
  });
  const highSeverity = allIssues.filter((issue) => issue.severity === "high").length;

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        breadcrumbs={[{ label: "Panel", href: "/admin/dashboard" }, { label: "Calidad de datos" }]}
        description="Centro de auditoría para revisar duplicados, casos ambiguos y preparación previa a remediaciones manuales. Esta vista sigue siendo solo de lectura."
        eyebrow="Calidad de datos"
        title="Centro de auditoría y control"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Incidencias computables en la corrida actual." label="Incidencias" tone={allIssues.length ? "warning" : "success"} value={formatAdminInteger(allIssues.length)} />
        <MetricCard detail="Incidencias de severidad alta visibles." label="Alta severidad" tone={highSeverity ? "warning" : "success"} value={formatAdminInteger(highSeverity)} />
        <MetricCard detail="Grupos duplicados detectados por correo." label="Emails duplicados" tone="neutral" value={formatAdminInteger(report.duplicateEmailGroups.length)} />
        <MetricCard detail="Eventos de identidad ambigua registrados." label="Identidad ambigua" tone="brand" value={formatAdminInteger(report.ambiguousIdentityEvents)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <SectionCard description="La preparación sigue diferida hasta cerrar backlog, validar re-pointing y confirmar estabilidad operativa." title="Estrategia y criterios previos">
          <div className="space-y-4 text-sm text-[color:var(--admin-muted-foreground)]">
            <p>{report.strategy.deferredReason}</p>
            <div>
              <p className="font-semibold text-[color:var(--admin-foreground)]">Condiciones antes de endurecer unicidad</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {report.strategy.readinessChecklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard description="Aplica filtros por tipo, severidad, estado, módulo o periodo." title="Filtros">
          <form className="space-y-3">
            <select className={adminSelectClassName} defaultValue={filters.type ?? ""} name="type">
              <option value="">Todos los tipos</option>
              <option value="duplicate_email">Email duplicado</option>
              <option value="duplicate_phone">Teléfono duplicado</option>
              <option value="ambiguous_identity">Identidad ambigua</option>
            </select>
            <select className={adminSelectClassName} defaultValue={filters.severity ?? ""} name="severity">
              <option value="">Toda severidad</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
            </select>
            <select className={adminSelectClassName} defaultValue={filters.status ?? ""} name="status">
              <option value="">Todo estado</option>
              <option value="pending">Pendiente</option>
              <option value="review">Revisión manual</option>
            </select>
            <select className={adminSelectClassName} defaultValue={filters.module ?? ""} name="module">
              <option value="">Todos los módulos</option>
              <option value="contacts">Contactos</option>
              <option value="leads">Prospectos</option>
            </select>
            <select className={adminSelectClassName} defaultValue={filters.date ?? ""} name="date">
              <option value="">Todo periodo</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Aplicar</Button>
              <Button asChild variant="outline"><Link href="/admin/data-quality">Limpiar</Link></Button>
            </div>
          </form>
        </SectionCard>
      </section>

      <SectionCard description="Listado operativo agrupado para revisión manual y navegación segura hacia el CRM." title={`Incidencias visibles ${formatAdminInteger(filteredIssues.length)}`}>
        <div className="space-y-4">
          <ActiveFilterChips filters={filters} />
          {filteredIssues.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredIssues.map((issue) => (
                <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 shadow-[var(--admin-shadow-card)]" key={issue.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={issueTone(issue)}>{issueSeverityLabel(issue.severity)}</StatusBadge>
                        <StatusBadge>{issueStatusLabel(issue.status)}</StatusBadge>
                        <StatusBadge tone="brand">{issueTypeLabel(issue.type)}</StatusBadge>
                      </div>
                      <h2 className="text-base font-semibold text-[color:var(--admin-foreground)]">{issue.title}</h2>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{issue.summary}</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href={issue.href}>Ir al CRM</Link></Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Módulo</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{issueModuleLabel(issue.module)}</p>
                    </div>
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Detectado</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{formatAdminDateTime(issue.detectedAt)}</p>
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[color:var(--admin-muted-foreground)]">
                    {issue.context.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="No encontramos incidencias para los filtros actuales. Limpia el contexto o espera una nueva corrida de auditoría." title="Sin incidencias visibles" />
          )}
        </div>
      </SectionCard>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard description="Detalle de grupos por correo para revisiones manuales más finas." title="Grupos duplicados por email">
          {report.duplicateEmailGroups.length ? report.duplicateEmailGroups.map(duplicateGroupCard) : <EmptyState description="No hay grupos duplicados por correo en la corrida actual." title="Sin duplicados por email" />}
        </SectionCard>
        <SectionCard description="Detalle de grupos por teléfono para revisar variaciones y números compartidos." title="Grupos duplicados por teléfono">
          {report.duplicatePhoneGroups.length ? report.duplicatePhoneGroups.map(duplicateGroupCard) : <EmptyState description="No hay grupos duplicados por teléfono en la corrida actual." title="Sin duplicados por teléfono" />}
        </SectionCard>
      </section>
    </PageContainer>
  );
}
