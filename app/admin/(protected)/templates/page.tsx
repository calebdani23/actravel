import Link from "next/link";
import { TemplateForm } from "@/components/admin/templates/template-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getTemplateVariableCatalog } from "@/lib/admin/template-variables";
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

function categoryLabel(category: string | null | undefined) {
  return category?.trim() || "general";
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
    <Card>
      <CardHeader><CardTitle>Variables disponibles</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">La edición detallada ahora vive dentro de cada formulario. Todas las rutas usan el mismo catálogo, validación y ejemplos de preview.</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {catalog.map((variable) => (
            <div className="rounded-md border p-3" key={variable.key}>
              <div className="flex flex-wrap items-center gap-2">
                <code>{`{{${variable.key}}}`}</code>
                <span className="rounded bg-muted px-2 py-0.5 text-[11px] uppercase text-muted-foreground">{variable.source}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{variable.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{variable.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">Ejemplo: {String(variable.example)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function groupTemplates(templates: MessageTemplateRow[]) {
  const groups = new Map<string, MessageTemplateRow[]>();
  for (const template of templates) {
    const key = `${template.channel}::${categoryLabel(template.category)}`;
    groups.set(key, [...(groups.get(key) ?? []), template]);
  }
  return [...groups.entries()].map(([key, groupTemplates]) => {
    const [channel, category] = key.split("::");
    return { channel, category, templates: groupTemplates };
  });
}

export default async function TemplatesPage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireAdminRole(["admin", "marketing"])]);
  const channel = value(params, "channel");
  const category = value(params, "category");
  const active = value(params, "active");
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
  const groups = groupTemplates(templates);
  const categories = [...new Set(allTemplates.map((template) => categoryLabel(template.category)))].sort();
  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Mensajería</p>
        <h1 className="mt-2 text-3xl font-bold">Plantillas</h1>
        <p className="mt-2 text-muted-foreground">Listado y edición manual para mensajes WhatsApp/email. Automatización e inbox quedan diferidos.</p>
      </div>

      {error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudieron cargar plantillas: {error}</CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle>Filtros y agrupación</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.channel ?? ""} name="channel">
              <option value="">Todos los canales</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.category ?? ""} name="category">
              <option value="">Todas las categorías</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="rounded-md border px-3 py-2 text-sm" defaultValue={filters.activeOnly ? "true" : ""} name="active">
              <option value="">Activas e inactivas</option>
              <option value="true">Solo activas</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Aplicar</Button>
              <Button asChild variant="outline"><Link href="/admin/templates">Limpiar</Link></Button>
            </div>
            {activeFilters ? <p className="text-xs text-muted-foreground md:col-span-4">{activeFilters} filtro(s) activo(s). La lista se agrupa por canal y categoría.</p> : null}
          </form>
        </CardContent>
      </Card>

      <VariableCheatSheet />

      <Card>
        <CardHeader><CardTitle>Nueva plantilla</CardTitle></CardHeader>
        <CardContent><TemplateForm /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{templates.length} plantillas visibles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {groups.length ? groups.map((group) => (
            <section className="space-y-3 rounded-xl border p-4" key={`${group.channel}-${group.category}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold capitalize">{group.channel} · {group.category}</h2>
                <span className="text-xs text-muted-foreground">{group.templates.length} plantilla(s)</span>
              </div>
              {group.templates.map((template) => {
                const validation = templateValidation(template);
                const hasWarnings = Boolean(validation && (validation.errors.length || validation.warnings.length));
                return (
                  <details className="rounded-lg border p-4" key={template.id}>
                    <summary className="cursor-pointer font-semibold">
                      {template.name} <span className="ml-2 text-xs font-normal text-muted-foreground">#{template.sort_order} · {template.is_active ? "activa" : "inactiva"}</span>
                      {hasWarnings ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">revisar variables</span> : null}
                    </summary>
                    {template.description ? <p className="mt-2 text-sm text-muted-foreground">{template.description}</p> : null}
                    <div className="mt-4"><TemplateForm template={template} /></div>
                  </details>
                );
              })}
            </section>
          )) : <p className="text-sm text-muted-foreground">No hay plantillas visibles para tu rol o filtros.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
