import Link from "next/link";
import { TemplateForm } from "@/components/admin/templates/template-form";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageContainer,
  PageHeader,
  SectionCard,
  StatusBadge,
  adminSelectClassName,
} from "@/components/admin/admin-primitives";
import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { isTemplateFeedbackFocus } from "@/lib/admin/template-feedback";
import { getTemplateVariableCatalog, templateChannelLabel, templateVariableSourceLabel } from "@/lib/admin/template-variables";
import { getMessageTemplates, type MessageTemplateChannel, type MessageTemplateRow } from "@/lib/admin/templates";
import { validateTemplatePlaceholders } from "@/lib/admin/template-renderer";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function declaredVariables(template?: MessageTemplateRow) {
  return Array.isArray(template?.variables) ? template.variables.filter((item): item is string => typeof item === "string") : [];
}

function categoryKey(category: string | null | undefined) {
  return category?.trim() || "general";
}

function displayIdentifier(value: string | null | undefined) {
  const cleaned = (value?.trim() || "general").replace(/[_-]+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function templateValidation(template?: MessageTemplateRow) {
  if (!template) return null;
  const channel = template.channel === "email" || template.channel === "whatsapp" ? template.channel : undefined;
  return validateTemplatePlaceholders({
    subject: channel === "email" ? [template.subject_es, template.subject_en].filter(Boolean).join("\n") : null,
    body: [template.body_es, template.body_en].join("\n"),
    declaredVariables: declaredVariables(template),
    channel,
  });
}

function VariableCheatSheet() {
  const catalog = getTemplateVariableCatalog();
  return (
    <SectionCard description="Catálogo de referencia para los placeholders permitidos. La edición detallada vive dentro de cada formulario." title="Variables disponibles">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {catalog.map((variable) => (
          <div className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4" key={variable.key}>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-[color:var(--admin-surface-muted)] px-2 py-1 text-xs">{`{{${variable.key}}}`}</code>
              <StatusBadge tone="neutral">{templateVariableSourceLabel(variable.source)}</StatusBadge>
            </div>
            <p className="mt-3 text-sm font-semibold text-[color:var(--admin-foreground)]">{variable.label}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--admin-muted-foreground)]">{variable.description}</p>
            <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">Ejemplo: {String(variable.example)}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default async function TemplatesPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireAdminRole(["admin", "marketing"])]);
  const channel = value(params, "channel");
  const category = value(params, "category");
  const active = value(params, "active");
  const feedbackStatus = value(params, "status");
  const feedbackMessage = value(params, "message");
  const feedbackFocus = value(params, "focus");
  const highlightFeedback = isTemplateFeedbackFocus(feedbackFocus);
  const selectedChannel: MessageTemplateChannel | undefined = channel === "email" || channel === "whatsapp" ? channel : undefined;
  const filters = {
    channel: selectedChannel,
    category: category || undefined,
    activeOnly: active === "true" ? true : undefined,
  };
  const [{ templates, error }, { templates: allTemplates }] = await Promise.all([
    getMessageTemplates(filters),
    getMessageTemplates(),
  ]);

  const categories = [...new Set(allTemplates.map((template) => categoryKey(template.category)))].sort();
  const activeCount = templates.filter((template) => template.is_active).length;
  const inactiveCount = templates.filter((template) => !template.is_active).length;
  const emailCount = templates.filter((template) => template.channel === "email").length;
  const whatsappCount = templates.filter((template) => template.channel === "whatsapp").length;

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        actions={<OperationDialog description="Crea una nueva plantilla de WhatsApp o email sin salir de esta vista." title="Nueva plantilla" triggerLabel="Nueva plantilla"><TemplateForm /></OperationDialog>}
        breadcrumbs={[{ label: "Panel", href: "/admin/dashboard" }, { label: "Plantillas" }]}
        description="Administra mensajes reutilizables por canal y categoría. Revisa estado, variables y última actualización antes de editar."
        eyebrow="Mensajería"
        title="Plantillas"
      />

      {feedbackMessage ? (
        <div className={`rounded-[var(--admin-radius-card)] border px-4 py-3 text-sm ${feedbackStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"} ${highlightFeedback ? "ring-4 ring-[color:var(--admin-ring)]" : ""}`} id="template-feedback" role="status">
          {feedbackMessage}
        </div>
      ) : null}

      {error ? <ErrorState description="No pudimos cargar las plantillas en este momento. Intenta de nuevo en unos minutos." title="No se pudieron cargar las plantillas" /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Disponibles para operaciones activas." label="Activas" tone="success" value={formatAdminInteger(activeCount)} />
        <MetricCard detail="Siguen guardadas, pero fuera de uso operativo." label="Inactivas" tone="warning" value={formatAdminInteger(inactiveCount)} />
        <MetricCard detail="Plantillas visibles con canal email según filtros." label="Email" tone="neutral" value={formatAdminInteger(emailCount)} />
        <MetricCard detail="Plantillas visibles con canal WhatsApp según filtros." label="WhatsApp" tone="brand" value={formatAdminInteger(whatsappCount)} />
      </section>

      <SectionCard description="Filtra el workspace por canal, categoría o estado para revisar con menos ruido." title="Filtros">
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <select className={adminSelectClassName} defaultValue={filters.channel ?? ""} name="channel">
            <option value="">Todos los canales</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
          <select className={adminSelectClassName} defaultValue={filters.category ?? ""} name="category">
            <option value="">Todas las categorías</option>
            {categories.map((item) => <option key={item} value={item}>{displayIdentifier(item)}</option>)}
          </select>
          <select className={adminSelectClassName} defaultValue={filters.activeOnly ? "true" : ""} name="active">
            <option value="">Activas e inactivas</option>
            <option value="true">Solo activas</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit">Aplicar</Button>
            <Button asChild variant="outline"><Link href="/admin/templates">Limpiar</Link></Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard description="Revisa la lista actual antes de abrir el editor. Cada tarjeta resume canal, categoría, variables y salud básica del contenido." title={`${templates.length} plantilla(s) visibles`}>
        {templates.length ? (
          <div className="grid gap-4">
            {templates.map((template) => {
              const validation = templateValidation(template);
              const hasWarnings = Boolean(validation && (validation.errors.length || validation.warnings.length));
              const variableCount = declaredVariables(template).length;

              return (
                <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 shadow-[var(--admin-shadow-card)]" key={template.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-[color:var(--admin-foreground)]">{template.name}</h2>
                        <StatusBadge tone={template.is_active ? "success" : "warning"}>{template.is_active ? "Activa" : "Inactiva"}</StatusBadge>
                        <StatusBadge tone="neutral">{templateChannelLabel(template.channel)}</StatusBadge>
                        {hasWarnings ? <StatusBadge tone="warning">Revisar variables</StatusBadge> : null}
                      </div>
                      <p className="text-sm text-[color:var(--admin-muted-foreground)]">{template.description || "Sin descripción operativa."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <OperationDialog description={`Edita ${template.name} sin alterar los contratos del servidor ni el formato de variables.`} title={`Editar ${template.name}`} triggerLabel="Editar">
                        <TemplateForm template={template} />
                      </OperationDialog>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Categoría</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{displayIdentifier(template.category)}</p>
                    </div>
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Orden</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">#{template.sort_order ?? 100}</p>
                    </div>
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Variables</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{formatAdminInteger(variableCount)}</p>
                    </div>
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Actualizada</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{template.updated_at ? formatAdminDateTime(template.updated_at) : "Por definir"}</p>
                    </div>
                    <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Variables declaradas</p>
                      <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{declaredVariables(template).join(", ") || "Sin variables declaradas"}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState action={<OperationDialog description="Crea la primera plantilla operativa para este módulo." title="Nueva plantilla" triggerLabel="Nueva plantilla"><TemplateForm /></OperationDialog>} description="No hay plantillas visibles con los filtros actuales. Limpia los filtros o crea una nueva plantilla operativa." title="Sin plantillas para mostrar" />
        )}
      </SectionCard>

      <VariableCheatSheet />
    </PageContainer>
  );
}
