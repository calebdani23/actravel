"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  formatTemplateValidationError,
  normalizeTemplateVariableSelection,
  parseSelectedTemplateVariables,
} from "@/lib/admin/template-action-helpers";
import { validateTemplatePlaceholders } from "@/lib/admin/template-renderer";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { MessageTemplateChannel } from "@/lib/admin/template-variables";

function text(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${key} is required`);
  return result || null;
}

function integer(formData: FormData, key: string, fallback: number) {
  const value = formData.get(key);
  const parsed = typeof value === "string" && value.trim() ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function upsertTemplateAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const id = text(formData, "id");
  const channel = text(formData, "channel", true);
  if (channel !== "email" && channel !== "whatsapp") throw new Error("Invalid channel");
  const variables = parseSelectedTemplateVariables(formData);
  const bodyEs = text(formData, "body_es", true) ?? "";
  const bodyEn = text(formData, "body_en", true) ?? "";
  const subjectEs = text(formData, "subject_es");
  const subjectEn = text(formData, "subject_en");
  const validation = validateTemplatePlaceholders({
    subject: channel === "email" ? [subjectEs, subjectEn].filter(Boolean).join("\n") : null,
    body: [bodyEs, bodyEn].join("\n"),
    declaredVariables: variables,
    channel: channel as MessageTemplateChannel,
  });
  if (!validation.isValid) throw new Error(formatTemplateValidationError(validation));
  const payload = {
    name: text(formData, "name", true),
    channel,
    category: text(formData, "category") ?? "general",
    description: text(formData, "description"),
    sort_order: integer(formData, "sort_order", 100),
    subject_es: subjectEs,
    subject_en: subjectEn,
    body_es: bodyEs,
    body_en: bodyEn,
    variables: normalizeTemplateVariableSelection(variables) as Json,
    is_active: formData.get("is_active") === "on",
  };
  const { error } = id ? await supabase.from("message_templates").update(payload).eq("id", id) : await supabase.from("message_templates").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
}

export async function deleteTemplateAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const id = text(formData, "id", true);
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/templates");
}
