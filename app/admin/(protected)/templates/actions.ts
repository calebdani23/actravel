"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/admin/auth";
import {
  formatTemplateValidationError,
  normalizeTemplateVariableSelection,
  parseSelectedTemplateVariables,
} from "@/lib/admin/template-action-helpers";
import { buildTemplateRedirectTarget } from "@/lib/admin/template-feedback";
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

function templateActionErrorMessage(error: unknown, action: "save" | "delete") {
  const message = error instanceof Error ? error.message : "";

  if (message.includes(" is required")) {
    return action === "save"
      ? "Completa los campos obligatorios antes de guardar la plantilla."
      : "No encontramos la plantilla que intentabas eliminar.";
  }

  if (message === "Invalid channel") {
    return "Selecciona un canal válido para la plantilla.";
  }

  if (message.startsWith("VALIDATION::")) {
    return "La plantilla tiene variables o contenido por revisar. Corrige el panel de validación y vuelve a intentar.";
  }

  return action === "save"
    ? "No se pudo guardar la plantilla. Intenta nuevamente."
    : "No se pudo eliminar la plantilla. Intenta nuevamente.";
}

async function finishTemplateAction(action: "save" | "delete", formData: FormData, callback: () => Promise<{ message: string }>) {
  try {
    const result = await callback();
    redirect(buildTemplateRedirectTarget({ status: "success", message: result.message, focus: true }));
  } catch (error) {
    console.error("[templates] admin action failed", error);
    redirect(buildTemplateRedirectTarget({ status: "error", message: templateActionErrorMessage(error, action), focus: true }));
  }
}

export async function upsertTemplateAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);

  await finishTemplateAction("save", formData, async () => {
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
    if (!validation.isValid) throw new Error(`VALIDATION::${formatTemplateValidationError(validation)}`);

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

    const result = id
      ? await supabase.from("message_templates").update(payload).eq("id", id).select("id, name").maybeSingle()
      : await supabase.from("message_templates").insert(payload).select("id, name").single();

    if (result.error) throw new Error(result.error.message);

    revalidatePath("/admin/templates");

    return {
      message: id ? "Plantilla actualizada correctamente." : "Plantilla creada correctamente.",
    };
  });
}

export async function deleteTemplateAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);

  await finishTemplateAction("delete", formData, async () => {
    const id = text(formData, "id", true);
    const supabase = await createClient();
    const loaded = await supabase.from("message_templates").select("id, name").eq("id", id).maybeSingle();
    if (loaded.error) throw new Error(loaded.error.message);
    if (!loaded.data) throw new Error("id is required");

    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/templates");

    return {
      message: `Plantilla eliminada: ${loaded.data.name}.`,
    };
  });
}
