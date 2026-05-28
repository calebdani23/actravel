"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildTrackedWhatsAppUrl, sanitizeWhatsAppPhone } from "@/lib/whatsapp/link";
import { renderMessageTemplate, type TemplateVariables } from "@/lib/admin/template-renderer";

type Template = {
  id: string;
  name: string;
  channel: string;
  category: string;
  description: string | null;
  subject_es: string | null;
  subject_en: string | null;
  body_es: string;
  body_en: string;
};

type Props = {
  templates: Template[];
  variables: TemplateVariables;
  phone?: string | null;
  email?: string | null;
  locale?: string | null;
  leadId: string;
  contactId?: string | null;
};

type Channel = "whatsapp" | "email";

const CHANNEL_LABELS: Record<Channel, string> = { whatsapp: "WhatsApp", email: "Email" };

function groupedByCategory(templates: Template[]) {
  return templates.reduce<Record<string, Template[]>>((groups, template) => {
    const category = template.category || "general";
    groups[category] = [...(groups[category] ?? []), template];
    return groups;
  }, {});
}

function copyLabel(copied: string | null, key: string, fallback: string) {
  return copied === key ? "Copiado" : fallback;
}

export function LeadTemplateActions({ templates, variables, phone, email, locale, leadId, contactId }: Props) {
  const [selectedByChannel, setSelectedByChannel] = useState<Record<Channel, string>>({
    whatsapp: templates.find((template) => template.channel === "whatsapp")?.id ?? "",
    email: templates.find((template) => template.channel === "email")?.id ?? "",
  });
  const [copied, setCopied] = useState<string | null>(null);
  const hasPhone = Boolean(phone?.trim()) && Boolean(sanitizeWhatsAppPhone(phone));
  const hasEmail = Boolean(email?.trim());

  async function copyText(key: string, value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const templatesByChannel = useMemo(() => ({
    whatsapp: templates.filter((template) => template.channel === "whatsapp"),
    email: templates.filter((template) => template.channel === "email"),
  }), [templates]);

  if (!templates.length) return <p className="text-sm text-muted-foreground">No hay plantillas activas para este lead.</p>;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-semibold">Plantillas del lead</p>
        <p className="text-xs text-muted-foreground">Copia mensajes o entrega el texto a WhatsApp/mailto sin envío automático.</p>
      </div>

      {(["whatsapp", "email"] as Channel[]).map((channel) => {
        const channelTemplates = templatesByChannel[channel];
        const selected = channelTemplates.find((template) => template.id === selectedByChannel[channel]) ?? channelTemplates[0];
        const subjectSource = locale === "en" ? selected?.subject_en : selected?.subject_es;
        const bodySource = locale === "en" ? selected?.body_en : selected?.body_es;
        const renderedSubject = renderMessageTemplate(subjectSource ?? "", variables);
        const renderedBody = renderMessageTemplate(bodySource ?? "", variables);
        const disabled = channel === "whatsapp" ? !hasPhone : !hasEmail;
        const disabledMessage = channel === "whatsapp" ? "Este lead no tiene WhatsApp usable." : "Este lead no tiene email usable.";
        const categoryGroups = groupedByCategory(channelTemplates);
        const whatsappHref = buildTrackedWhatsAppUrl({ message: renderedBody, phone, locale, pagePath: "admin-lead-detail-template", leadId, contactId });
        const mailtoHref = `mailto:${encodeURIComponent(email ?? "")}?${new URLSearchParams({ subject: renderedSubject, body: renderedBody }).toString()}`;

        return (
          <section className="space-y-2 rounded-md bg-zinc-50 p-3" key={channel}>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium" htmlFor={`${channel}Template`}>{CHANNEL_LABELS[channel]}</label>
              {disabled ? <span className="text-xs text-amber-700">{disabledMessage}</span> : null}
            </div>

            {channelTemplates.length ? (
              <select
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                id={`${channel}Template`}
                value={selected?.id ?? ""}
                onChange={(event) => setSelectedByChannel((current) => ({ ...current, [channel]: event.target.value }))}
              >
                {Object.entries(categoryGroups).map(([category, categoryTemplates]) => (
                  <optgroup key={category} label={category}>
                    {categoryTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </optgroup>
                ))}
              </select>
            ) : <p className="text-sm text-muted-foreground">No hay plantillas activas de {CHANNEL_LABELS[channel]}.</p>}

            {selected?.description ? <p className="text-xs text-muted-foreground">{selected.description}</p> : null}
            {channel === "email" ? <input className="w-full rounded-md border bg-white px-3 py-2 text-sm" readOnly value={renderedSubject} aria-label="Asunto del email" /> : null}
            {selected ? <textarea className="min-h-32 w-full rounded-md border bg-white px-3 py-2 text-sm" readOnly value={renderedBody} /> : null}

            {selected ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {channel === "email" ? <Button disabled={disabled || !renderedSubject} onClick={() => copyText(`${channel}:subject`, renderedSubject)} type="button" variant="outline">{copyLabel(copied, `${channel}:subject`, "Copiar asunto")}</Button> : null}
                <Button disabled={disabled || !renderedBody} onClick={() => copyText(`${channel}:body`, renderedBody)} type="button" variant="outline">{copyLabel(copied, `${channel}:body`, channel === "email" ? "Copiar cuerpo" : "Copiar mensaje")}</Button>
                {channel === "email" ? <Button disabled={disabled || !renderedBody} onClick={() => copyText(`${channel}:both`, `${renderedSubject}\n\n${renderedBody}`.trim())} type="button" variant="outline">{copyLabel(copied, `${channel}:both`, "Copiar todo")}</Button> : null}
                {disabled ? <Button disabled type="button" variant="outline">Abrir {CHANNEL_LABELS[channel]}</Button> : (
                  <Button asChild variant="outline">
                    <a href={channel === "whatsapp" ? whatsappHref : mailtoHref} rel="noreferrer" target="_blank">Abrir {CHANNEL_LABELS[channel]}</a>
                  </Button>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export const WhatsappTemplateActions = LeadTemplateActions;
