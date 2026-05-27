import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminRole } from "@/lib/admin/auth";
import { getMessageTemplates, type MessageTemplateRow } from "@/lib/admin/templates";
import { deleteTemplateAction, upsertTemplateAction } from "./actions";

function variablesText(template?: MessageTemplateRow) {
  return Array.isArray(template?.variables) ? template.variables.join(", ") : "";
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
        <TextInput defaultValue={template?.subject_es} label="Asunto ES" name="subject_es" />
        <TextInput defaultValue={template?.subject_en} label="Asunto EN" name="subject_en" />
        <TextArea defaultValue={template?.body_es} label="Cuerpo ES" name="body_es" required />
        <TextArea defaultValue={template?.body_en} label="Cuerpo EN" name="body_en" required />
        <TextInput defaultValue={variablesText(template)} label="Variables (separadas por coma)" name="variables" />
        <label className="flex items-center gap-2 pt-7 text-sm font-medium">
          <input defaultChecked={template?.is_active ?? true} name="is_active" type="checkbox" /> Activa
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{template ? "Guardar cambios" : "Crear plantilla"}</Button>
        {template ? <Button formAction={deleteTemplateAction} type="submit" variant="outline">Eliminar</Button> : null}
      </div>
    </form>
  );
}

export default async function TemplatesPage() {
  await requireAdminRole(["admin", "marketing"]);
  const { templates, error } = await getMessageTemplates();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Mensajería</p>
        <h1 className="mt-2 text-3xl font-bold">Plantillas</h1>
        <p className="mt-2 text-muted-foreground">Listado y edición manual para mensajes WhatsApp/email. Automatización e inbox quedan diferidos.</p>
      </div>

      {error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudieron cargar plantillas: {error}</CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle>Nueva plantilla</CardTitle></CardHeader>
        <CardContent><TemplateForm /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{templates.length} plantillas visibles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {templates.length ? templates.map((template) => (
            <details className="rounded-lg border p-4" key={template.id}>
              <summary className="cursor-pointer font-semibold">
                {template.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{template.channel} · {template.is_active ? "activa" : "inactiva"}</span>
              </summary>
              <div className="mt-4"><TemplateForm template={template} /></div>
            </details>
          )) : <p className="text-sm text-muted-foreground">No hay plantillas visibles para tu rol.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
