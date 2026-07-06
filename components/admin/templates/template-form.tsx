"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { deleteTemplateAction, upsertTemplateAction } from "@/app/admin/(protected)/templates/actions";
import { Button } from "@/components/ui/button";
import { getTemplateVariableExamples, type MessageTemplateChannel, type TemplateVariableDefinition } from "@/lib/admin/template-variables";
import { renderMessageTemplate, validateTemplatePlaceholders } from "@/lib/admin/template-renderer";

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

function sortSelectedVariables(keys: string[], catalog: readonly TemplateVariableDefinition[]) {
  const order = new Map(catalog.map((item, index) => [item.key, index]));
  return [...new Set(keys)].sort((left, right) => {
    const leftOrder = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder === rightOrder ? left.localeCompare(right) : leftOrder - rightOrder;
  });
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
    <label className={`space-y-1 text-sm font-medium ${textarea ? "md:col-span-2" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
          name={field}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => onFocus(field)}
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          required={required}
          value={value}
        />
      ) : (
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
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

export function TemplateForm({ catalog, template }: { catalog: readonly TemplateVariableDefinition[]; template?: TemplateFormTemplate }) {
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
    <form action={upsertTemplateAction} className="space-y-4 rounded-lg border p-4">
      {template ? <input name="id" type="hidden" value={template.id} /> : null}
      {selectedVariables.map((variable) => <input key={variable} name="variables" type="hidden" value={variable} />)}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          <span>Nombre</span>
          <input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={template?.name ?? ""} name="name" required />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Canal</span>
          <select className="w-full rounded-md border px-3 py-2 text-sm" name="channel" onChange={(event) => setChannel(event.target.value as MessageTemplateChannel)} value={channel}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Categoría</span>
          <input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={template?.category ?? "general"} name="category" />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>Orden</span>
          <input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={String(template?.sort_order ?? 100)} name="sort_order" />
        </label>
        <label className="space-y-1 text-sm font-medium md:col-span-2">
          <span>Descripción</span>
          <input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={template?.description ?? ""} name="description" />
        </label>

        {channel === "email" ? (
          <>
            <FieldInput field="subject_es" inputRef={subjectEsRef} label="Asunto ES" onChange={setSubjectEs} onFocus={setActiveField} value={subjectEs} />
            <FieldInput field="subject_en" inputRef={subjectEnRef} label="Asunto EN" onChange={setSubjectEn} onFocus={setActiveField} value={subjectEn} />
          </>
        ) : null}

        <FieldInput field="body_es" inputRef={bodyEsRef} label="Cuerpo ES" onChange={setBodyEs} onFocus={setActiveField} required textarea value={bodyEs} />
        <FieldInput field="body_en" inputRef={bodyEnRef} label="Cuerpo EN" onChange={setBodyEn} onFocus={setActiveField} required textarea value={bodyEn} />

        <div className="space-y-3 rounded-lg border bg-muted/20 p-3 md:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Variables seleccionadas</span>
            {selectedVariables.length ? selectedVariables.map((variable) => (
              <button
                className="rounded-full border px-2 py-1 text-xs"
                key={variable}
                onClick={() => toggleVariable(variable)}
                type="button"
              >
                {`{{${variable}}}`} ×
              </button>
            )) : <span className="text-xs text-muted-foreground">Sin variables seleccionadas aún.</span>}
          </div>

          {validation.errors.length ? (
            <ul className="space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {validation.errors.map((message) => <li key={message}>• {message}</li>)}
            </ul>
          ) : null}
          {validation.warnings.length ? (
            <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {validation.warnings.map((message) => <li key={message}>• {message}</li>)}
            </ul>
          ) : null}

          {validation.undeclaredVariables.length ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-red-800">
              <span>Agregar usadas sin seleccionar:</span>
              {validation.undeclaredVariables.map((variable) => (
                <Button key={variable} onClick={() => toggleVariable(variable)} size="sm" type="button" variant="outline">{`Seleccionar {{${variable}}}`}</Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
          <div>
            <p className="text-sm font-semibold">Catálogo global de variables</p>
            <p className="text-xs text-muted-foreground">Selecciona variables válidas por canal e insértalas con el formato canónico <code className="rounded bg-muted px-1">{"{{key}}"}</code>.</p>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {channelCatalog.map((item) => {
              const isUsed = validation.usedVariables.includes(item.key);
              const isSelected = selectedSet.has(item.key);
              const status = isUsed && isSelected ? "Usada y seleccionada" : isUsed ? "Usada sin seleccionar" : isSelected ? "Seleccionada sin uso" : "Disponible";
              return (
                <div className="space-y-2 rounded-md border p-3" key={item.key}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input checked={isSelected} onChange={() => toggleVariable(item.key)} type="checkbox" />
                      <span>
                        <span className="font-semibold">{item.label}</span>
                        <span className="ml-2 rounded bg-muted px-1 py-0.5 font-mono text-xs">{`{{${item.key}}}`}</span>
                      </span>
                    </label>
                    <span className={`rounded-full px-2 py-1 text-[11px] ${isUsed && !isSelected ? "bg-red-100 text-red-800" : isSelected && !isUsed ? "bg-amber-100 text-amber-900" : isSelected ? "bg-emerald-100 text-emerald-900" : "bg-muted text-muted-foreground"}`}>{status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-1">Source: {item.source}</span>
                    <span className="rounded bg-muted px-2 py-1">Example: {String(item.example)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => insertVariable(item.key)} size="sm" type="button" variant="outline">Insertar</Button>
                    {!isSelected ? <Button onClick={() => toggleVariable(item.key)} size="sm" type="button" variant="ghost">Seleccionar</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input defaultChecked={template?.is_active ?? true} name="is_active" type="checkbox" /> Activa
        </label>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm md:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa con datos de ejemplo</span>
            {validation.usedVariables.length ? <span className="rounded-full bg-white px-2 py-1 text-xs text-muted-foreground">Usa: {validation.usedVariables.join(", ")}</span> : null}
            <span className="rounded-full bg-white px-2 py-1 text-xs text-muted-foreground">Campo activo: {FIELD_LABELS[activeField]}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">ES</p>
              {renderedSubjectEs ? <p className="font-medium">{renderedSubjectEs}</p> : null}
              <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed">{renderedBodyEs}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">EN</p>
              {renderedSubjectEn ? <p className="font-medium">{renderedSubjectEn}</p> : null}
              <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed">{renderedBodyEn}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!validation.isValid} type="submit">{template ? "Guardar cambios" : "Crear plantilla"}</Button>
        {template ? <Button formAction={deleteTemplateAction} type="submit" variant="outline">Eliminar</Button> : null}
      </div>
    </form>
  );
}
