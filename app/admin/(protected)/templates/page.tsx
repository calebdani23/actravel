import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getMessageTemplates, type MessageTemplateChannel, type MessageTemplateRow } from "@/lib/admin/templates";
import { renderMessageTemplate, SUPPORTED_LEAD_TEMPLATE_VARIABLES, validateTemplatePlaceholders } from "@/lib/admin/template-renderer";
import { deleteTemplateAction, upsertTemplateAction } from "./actions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const SAMPLE_VARIABLES = {
  name: "María",
  destination: "Riviera Maya",
  startDate: "2026-07-15",
  endDate: "2026-07-20",
  travelers: 2,
  budget: "$45,000 MXN",
  advisor: "AC Travel",
  status: "Cotizando",
};

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function variablesText(template?: MessageTemplateRow) {
  return Array.isArray(template?.variables) ? template.variables.join(", ") : "";
}

function declaredVariables(template?: MessageTemplateRow) {
  return Array.isArray(template?.variables) ? template.variables.filter((item): item is string => typeof item === "string") : [];
}

function categoryLabel(category: string | null | undefined) {
  return category?.trim() || "general";
}

function templateValidation(template?: MessageTemplateRow) {
  if (!template) return null;
  return validateTemplatePlaceholders({
    subject: [template.subject_es, template.subject_en].filter(Boolean).join("\n"),
    body: [template.body_es, template.body_en].join("\n"),
    declaredVariables: declaredVariables(template),
  });
}

function TemplatePreview({ template }: { template?: MessageTemplateRow }) {
  if (!template) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-2">
        Usa la hoja de variables de abajo para armar la plantilla. Las plantillas guardadas muestran vista previa con datos de ejemplo y advertencias.
      </div>
    );
  }

  const validation = templateValidation(template);
  const subjectEs = template.subject_es ? renderMessageTemplate(template.subject_es, SAMPLE_VARIABLES) : null;
  const subjectEn = template.subject_en ? renderMessageTemplate(template.subject_en, SAMPLE_VARIABLES) : null;
  const bodyEs = renderMessageTemplate(template.body_es, SAMPLE_VARIABLES);
  const bodyEn = renderMessageTemplate(template.body_en, SAMPLE_VARIABLES);
  const warnings = [
    validation?.unknownVariables.length ? `Variables no soportadas: ${validation.unknownVariables.join(", ")}` : null,
    validation?.undeclaredVariables.length ? `Usadas pero no declaradas: ${validation.undeclaredVariables.join(", ")}` : null,
    validation?.unusedDeclaredVariables.length ? `Declaradas sin uso: ${validation.unusedDeclaredVariables.join(", ")}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm md:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa con datos de ejemplo</span>
        {validation?.usedVariables.length ? <span className="rounded-full bg-white px-2 py-1 text-xs text-muted-foreground">Usa: {validation.usedVariables.join(", ")}</span> : null}
      </div>
      {warnings.length ? (
        <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}
        </ul>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">ES</p>
          {subjectEs ? <p className="font-medium">{subjectEs}</p> : null}
          <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed">{bodyEs}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">EN</p>
          {subjectEn ? <p className="font-medium">{subjectEn}</p> : null}
          <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed">{bodyEn}</p>
        </div>
      </div>
    </div>
  );
}

function TextInput({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} required={required} />
    </label>
  );
}

function TextArea({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-medium md:col-span-2">
      <span>{label}</span>
      <textarea className="min-h-24 w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} required={required} />
    </label>
  );
}

function TemplateForm({ template }: { template?: MessageTemplateRow }) {
  return (
    <form action={upsertTemplateAction} className="space-y-4 rounded-lg border p-4">
      {template ? <input name="id" type="hidden" value={template.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput defaultValue={template?.name} label="Nombre" name="name" required />
        <label className="space-y-1 text-sm font-medium">
          <span>Canal</span>
          <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={template?.channel ?? "whatsapp"} name="channel">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </label>
        <TextInput defaultValue={template?.category ?? "general"} label="Categoría" name="category" />
        <TextInput defaultValue={String(template?.sort_order ?? 100)} label="Orden" name="sort_order" />
        <TextInput defaultValue={template?.description} label="Descripción" name="description" />
        <TextInput defaultValue={template?.subject_es} label="Asunto ES" name="subject_es" />
        <TextInput defaultValue={template?.subject_en} label="Asunto EN" name="subject_en" />
        <TextArea defaultValue={template?.body_es} label="Cuerpo ES" name="body_es" required />
        <TextArea defaultValue={template?.body_en} label="Cuerpo EN" name="body_en" required />
        <TextInput defaultValue={variablesText(template)} label="Variables (separadas por coma)" name="variables" />
        <label className="flex items-center gap-2 pt-7 text-sm font-medium">
          <input defaultChecked={template?.is_active ?? true} name="is_active" type="checkbox" /> Activa
        </label>
        <TemplatePreview template={template} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{template ? "Guardar cambios" : "Crear plantilla"}</Button>
        {template ? <Button formAction={deleteTemplateAction} type="submit" variant="outline">Eliminar</Button> : null}
      </div>
    </form>
  );
}

function VariableCheatSheet() {
  return (
    <Card>
      <CardHeader><CardTitle>Variables disponibles</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Usa doble llave, por ejemplo <code className="rounded bg-muted px-1">{"{{name}}"}</code>. Los valores faltantes se renderizan vacío para no mostrar placeholders al cliente.</p>
        <div className="grid gap-2 md:grid-cols-4">
          {SUPPORTED_LEAD_TEMPLATE_VARIABLES.map((variable) => (
            <div className="rounded-md border p-2" key={variable}>
              <code>{`{{${variable}}}`}</code>
              <p className="mt-1 text-xs text-muted-foreground">Ejemplo: {String(SAMPLE_VARIABLES[variable])}</p>
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
                const hasWarnings = Boolean(validation && (validation.unknownVariables.length || validation.undeclaredVariables.length || validation.unusedDeclaredVariables.length));
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
