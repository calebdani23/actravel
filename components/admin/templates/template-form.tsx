"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import { deleteTemplateAction, upsertTemplateAction } from "@/app/admin/(protected)/templates/actions";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  adminFieldHintClassName,
  adminInputClassName,
  adminSelectClassName,
} from "@/components/admin/admin-primitives";
import { LocalizedEditorTabs } from "@/components/admin/localized-editor-tabs";
import { getTemplateVariableCatalog, getTemplateVariableExamples, templateChannelLabel, templateVariableSourceLabel, type MessageTemplateChannel } from "@/lib/admin/template-variables";
import { renderMessageTemplate, validateTemplatePlaceholders } from "@/lib/admin/template-renderer";
import { translateTemplateValidationMessage } from "@/lib/admin/template-action-helpers";
import { getPendingSafeCancelState } from "@/lib/admin/pending-safe-navigation";

type TemplateFormTemplate = {
  id: string;
  name: string;
  channel: string;
  category: string | null;
  description: string | null;
  sort_order: number | null;
  subject_es: string | null;
  subject_en: string | null;
  body_es: string;
  body_en: string;
  variables: unknown;
  is_active: boolean | null;
};

type FieldName = "subject_es" | "subject_en" | "body_es" | "body_en";

const FIELD_LABELS: Record<FieldName, string> = {
  subject_es: "Asunto ES",
  subject_en: "Asunto EN",
  body_es: "Cuerpo ES",
  body_en: "Cuerpo EN",
};

function selectedTemplateVariables(template?: TemplateFormTemplate) {
  return Array.isArray(template?.variables) ? template.variables.filter((item): item is string => typeof item === "string") : [];
}

function sortSelectedVariables(keys: string[], catalog: ReturnType<typeof getTemplateVariableCatalog>) {
  const order = new Map<string, number>(catalog.map((item, index) => [item.key, index]));
  return [...new Set(keys)].sort((left, right) => {
    const leftOrder = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder === rightOrder ? left.localeCompare(right) : leftOrder - rightOrder;
  });
}

function completeness(value: string, secondValue?: string) {
  return Boolean(value.trim() && (secondValue === undefined || secondValue.trim()));
}

function FieldInput({
  field,
  label,
  value,
  onChange,
  onFocus,
  inputRef,
  required = false,
  textarea = false,
}: {
  field: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: (field: FieldName) => void;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className={`space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)] ${textarea ? "lg:col-span-2" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          className="min-h-36 w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 py-2.5 text-sm text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--admin-placeholder)] hover:border-[color:var(--admin-accent-soft)] focus-visible:border-[color:var(--admin-accent)] focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]"
          name={field}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => onFocus(field)}
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          required={required}
          value={value}
        />
      ) : (
        <input
          className={adminInputClassName}
          name={field}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => onFocus(field)}
          ref={inputRef as RefObject<HTMLInputElement>}
          required={required}
          value={value}
        />
      )}
    </label>
  );
}

function TemplateSection({ title, description, children, defaultOpen = true }: Readonly<{ title: string; description?: string; children: ReactNode; defaultOpen?: boolean }>) {
  return (
    <details className="overflow-hidden rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)]" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3.5 marker:hidden">
        <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[color:var(--admin-foreground)]">
          <span>{title}</span>
          <span className="text-xs font-medium text-[color:var(--admin-muted-foreground)]">Abrir / cerrar</span>
        </span>
        {description ? <span className="mt-1 block pr-8 text-xs leading-5 text-[color:var(--admin-muted-foreground)]">{description}</span> : null}
      </summary>
      <div className="border-t border-[color:var(--admin-border-subtle)] px-4 py-4">{children}</div>
    </details>
  );
}

function CopyPreviewButton({ label, value }: Readonly<{ label: string; value: string }>) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {copied ? `${label} copiado` : label}
    </Button>
  );
}

function TemplateSubmitBar({ isEditing, disableSave }: Readonly<{ isEditing: boolean; disableSave: boolean }>) {
  const { pending } = useFormStatus();
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const cancelState = getPendingSafeCancelState("/admin/templates", pending);

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface)]/95 px-1 pb-1 pt-4 backdrop-blur">
      <Button disabled={disableSave || pending} onClick={() => setSubmittedAction("save")} type="submit">
        {pending && submittedAction === "save" ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear plantilla"}
      </Button>
      {isEditing ? (
        <Button disabled={pending} formAction={deleteTemplateAction} onClick={() => setSubmittedAction("delete")} type="submit" variant="outline">
          {pending && submittedAction === "delete" ? "Eliminando..." : "Eliminar"}
        </Button>
      ) : null}
      {cancelState.kind === "disabled" ? (
        <Button aria-disabled={cancelState.ariaDisabled} disabled type="button" variant="ghost">
          Cancelar
        </Button>
      ) : (
        <Button asChild type="button" variant="ghost">
          <Link href={cancelState.href}>Cancelar</Link>
        </Button>
      )}
    </div>
  );
}

export function TemplateForm({ template }: { template?: TemplateFormTemplate }) {
  const catalog = useMemo(() => getTemplateVariableCatalog(), []);
  const [channel, setChannel] = useState<MessageTemplateChannel>(template?.channel === "email" || template?.channel === "whatsapp" ? template.channel : "whatsapp");
  const [subjectEs, setSubjectEs] = useState(template?.subject_es ?? "");
  const [subjectEn, setSubjectEn] = useState(template?.subject_en ?? "");
  const [bodyEs, setBodyEs] = useState(template?.body_es ?? "");
  const [bodyEn, setBodyEn] = useState(template?.body_en ?? "");
  const [selectedVariables, setSelectedVariables] = useState(() => sortSelectedVariables(selectedTemplateVariables(template), catalog));
  const [activeField, setActiveField] = useState<FieldName>("body_es");

  const subjectEsRef = useRef<HTMLInputElement>(null);
  const subjectEnRef = useRef<HTMLInputElement>(null);
  const bodyEsRef = useRef<HTMLTextAreaElement>(null);
  const bodyEnRef = useRef<HTMLTextAreaElement>(null);

  const refs: Record<FieldName, RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
    subject_es: subjectEsRef,
    subject_en: subjectEnRef,
    body_es: bodyEsRef,
    body_en: bodyEnRef,
  };

  const channelCatalog = useMemo(() => catalog.filter((item) => item.channels.includes(channel)), [catalog, channel]);
  const previewVariables = useMemo(() => getTemplateVariableExamples(channel), [channel]);
  const validation = useMemo(() => validateTemplatePlaceholders({
    subject: channel === "email" ? [subjectEs, subjectEn].filter(Boolean).join("\n") : null,
    body: [bodyEs, bodyEn].join("\n"),
    declaredVariables: selectedVariables,
    channel,
  }), [bodyEn, bodyEs, channel, selectedVariables, subjectEn, subjectEs]);

  const selectedSet = useMemo(() => new Set(selectedVariables), [selectedVariables]);
  const availableFieldTargets: FieldName[] = channel === "email"
    ? ["subject_es", "subject_en", "body_es", "body_en"]
    : ["body_es", "body_en"];

  function updateField(field: FieldName, value: string) {
    if (field === "subject_es") setSubjectEs(value);
    if (field === "subject_en") setSubjectEn(value);
    if (field === "body_es") setBodyEs(value);
    if (field === "body_en") setBodyEn(value);
  }

  function toggleVariable(key: string) {
    setSelectedVariables((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : sortSelectedVariables([...current, key], catalog));
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const targetField = availableFieldTargets.includes(activeField) ? activeField : "body_es";
    const element = refs[targetField].current;
    const currentValue = targetField === "subject_es" ? subjectEs : targetField === "subject_en" ? subjectEn : targetField === "body_es" ? bodyEs : bodyEn;
    const start = element?.selectionStart ?? currentValue.length;
    const end = element?.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
    updateField(targetField, nextValue);
    setSelectedVariables((current) => current.includes(key) ? current : sortSelectedVariables([...current, key], catalog));
    setActiveField(targetField);
    queueMicrotask(() => {
      const nextCursor = start + token.length;
      element?.focus();
      element?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const renderedSubjectEs = channel === "email" && subjectEs ? renderMessageTemplate(subjectEs, previewVariables) : null;
  const renderedSubjectEn = channel === "email" && subjectEn ? renderMessageTemplate(subjectEn, previewVariables) : null;
  const renderedBodyEs = renderMessageTemplate(bodyEs, previewVariables);
  const renderedBodyEn = renderMessageTemplate(bodyEn, previewVariables);

  return (
    <form action={upsertTemplateAction} className="space-y-4">
      {template ? <input name="id" type="hidden" value={template.id} /> : null}
      {selectedVariables.map((variable) => <input key={variable} name="variables" type="hidden" value={variable} />)}

      <TemplateSection description="Nombre visible, canal operativo y metadatos internos de organización." title="1. Configuración básica">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
            <span>Nombre visible</span>
            <input className={adminInputClassName} defaultValue={template?.name ?? ""} name="name" required />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
            <span>Canal</span>
            <select className={adminSelectClassName} name="channel" onChange={(event) => setChannel(event.target.value as MessageTemplateChannel)} value={channel}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
            <span>Categoría</span>
            <input className={adminInputClassName} defaultValue={template?.category ?? "general"} name="category" />
            <p className={adminFieldHintClassName}>Se conserva el identificador exacto enviado al servidor.</p>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
            <span>Orden</span>
            <input className={adminInputClassName} defaultValue={String(template?.sort_order ?? 100)} name="sort_order" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)] lg:col-span-2">
            <span>Descripción operativa</span>
            <input className={adminInputClassName} defaultValue={template?.description ?? ""} name="description" />
          </label>
        </div>
      </TemplateSection>

      <TemplateSection description="Edita el contenido por idioma y revisa rápidamente si cada versión está lista." title="2. Contenido bilingüe">
        <LocalizedEditorTabs
          defaultTab="es"
          tabs={[
            {
              key: "es",
              label: "Versión ES",
              complete: completeness(bodyEs, channel === "email" ? subjectEs : undefined),
              description: "Versión principal en español para el canal seleccionado.",
              content: (
                <div className="grid gap-4 lg:grid-cols-2">
                  {channel === "email" ? <FieldInput field="subject_es" inputRef={subjectEsRef} label="Asunto en español" onChange={setSubjectEs} onFocus={setActiveField} value={subjectEs} /> : null}
                  <FieldInput field="body_es" inputRef={bodyEsRef} label="Cuerpo en español" onChange={setBodyEs} onFocus={setActiveField} required textarea value={bodyEs} />
                </div>
              ),
            },
            {
              key: "en",
              label: "Versión EN",
              complete: completeness(bodyEn, channel === "email" ? subjectEn : undefined),
              description: "Versión equivalente en inglés para el sitio y la operación bilingüe.",
              content: (
                <div className="grid gap-4 lg:grid-cols-2">
                  {channel === "email" ? <FieldInput field="subject_en" inputRef={subjectEnRef} label="Asunto en inglés" onChange={setSubjectEn} onFocus={setActiveField} value={subjectEn} /> : null}
                  <FieldInput field="body_en" inputRef={bodyEnRef} label="Cuerpo en inglés" onChange={setBodyEn} onFocus={setActiveField} required textarea value={bodyEn} />
                </div>
              ),
            },
          ]}
        />
      </TemplateSection>

      <TemplateSection description="Declara solo variables válidas para el canal y añádelas al cursor activo con el formato permitido." title="3. Variables y validación">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">Canal: {templateChannelLabel(channel)}</StatusBadge>
            <StatusBadge tone={validation.isValid ? "success" : "warning"}>{validation.isValid ? "Validación lista" : "Requiere corrección"}</StatusBadge>
            <StatusBadge tone="brand">Campo activo: {FIELD_LABELS[activeField]}</StatusBadge>
            <StatusBadge tone="neutral">Variables declaradas: {selectedVariables.length}</StatusBadge>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedVariables.length ? selectedVariables.map((variable) => (
              <button
                className="rounded-full border border-[color:var(--admin-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--admin-foreground)]"
                key={variable}
                onClick={() => toggleVariable(variable)}
                type="button"
              >
                {`{{${variable}}}`} ×
              </button>
            )) : <p className="text-sm text-[color:var(--admin-muted-foreground)]">Todavía no hay variables seleccionadas.</p>}
          </div>

          {validation.errors.length ? (
            <ul className="space-y-1 rounded-[var(--admin-radius-card)] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {validation.errors.map((message) => <li key={message}>• {translateTemplateValidationMessage(message)}</li>)}
            </ul>
          ) : null}
          {validation.warnings.length ? (
            <ul className="space-y-1 rounded-[var(--admin-radius-card)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {validation.warnings.map((message) => <li key={message}>• {translateTemplateValidationMessage(message)}</li>)}
            </ul>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {channelCatalog.map((item) => {
              const isUsed = validation.usedVariables.includes(item.key);
              const isSelected = selectedSet.has(item.key);
              const status = isUsed && isSelected ? "Usada y seleccionada" : isUsed ? "Usada sin seleccionar" : isSelected ? "Seleccionada sin uso" : "Disponible";

              return (
                <div className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4" key={item.key}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2 text-sm text-[color:var(--admin-foreground)]">
                      <input checked={isSelected} onChange={() => toggleVariable(item.key)} type="checkbox" />
                      <span>
                        <span className="font-semibold">{item.label}</span>
                        <span className="ml-2 rounded bg-[color:var(--admin-surface-muted)] px-1.5 py-0.5 font-mono text-xs">{`{{${item.key}}}`}</span>
                      </span>
                    </label>
                    <StatusBadge tone={isUsed && !isSelected ? "error" : isSelected && !isUsed ? "warning" : isSelected ? "success" : "neutral"}>{status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--admin-muted-foreground)]">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--admin-muted-foreground)]">
                    <span className="rounded bg-[color:var(--admin-surface-muted)] px-2 py-1">Origen: {templateVariableSourceLabel(item.source)}</span>
                    <span className="rounded bg-[color:var(--admin-surface-muted)] px-2 py-1">Ejemplo: {String(item.example)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => insertVariable(item.key)} size="sm" type="button" variant="outline">Insertar</Button>
                    {!isSelected ? <Button onClick={() => toggleVariable(item.key)} size="sm" type="button" variant="ghost">Seleccionar</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </TemplateSection>

      <TemplateSection description="Controla si la plantilla queda disponible y revisa el resultado con datos de ejemplo antes de guardar." title="4. Estado y vista previa" defaultOpen={false}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 text-sm font-medium text-[color:var(--admin-foreground)]">
            <input className="h-4 w-4" defaultChecked={template?.is_active ?? true} name="is_active" type="checkbox" />
            <span>
              <span className="block">Plantilla activa</span>
              <span className="mt-1 block text-xs font-normal text-[color:var(--admin-muted-foreground)]">Si la desactivas, se conserva para edición pero sale de la operación activa.</span>
            </span>
          </label>

          <div className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-muted-foreground)]">Vista previa con datos de ejemplo</span>
              {validation.usedVariables.length ? <StatusBadge tone="neutral">Usa: {validation.usedVariables.join(", ")}</StatusBadge> : null}
              <CopyPreviewButton label="Copiar ES" value={`${renderedSubjectEs ? `${renderedSubjectEs}\n` : ""}${renderedBodyEs}`} />
              <CopyPreviewButton label="Copiar EN" value={`${renderedSubjectEn ? `${renderedSubjectEn}\n` : ""}${renderedBodyEn}`} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">ES</p>
                {renderedSubjectEs ? <p className="font-medium text-[color:var(--admin-foreground)]">{renderedSubjectEs}</p> : null}
                <p className="whitespace-pre-wrap rounded-[var(--admin-radius-control)] bg-[color:var(--admin-surface-muted)] p-3 text-sm leading-relaxed text-[color:var(--admin-foreground)]">{renderedBodyEs}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">EN</p>
                {renderedSubjectEn ? <p className="font-medium text-[color:var(--admin-foreground)]">{renderedSubjectEn}</p> : null}
                <p className="whitespace-pre-wrap rounded-[var(--admin-radius-control)] bg-[color:var(--admin-surface-muted)] p-3 text-sm leading-relaxed text-[color:var(--admin-foreground)]">{renderedBodyEn}</p>
              </div>
            </div>
          </div>
        </div>
      </TemplateSection>

      <TemplateSubmitBar disableSave={!validation.isValid} isEditing={Boolean(template)} />
    </form>
  );
}
