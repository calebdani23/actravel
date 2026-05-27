"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

function text(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${key} is required`);
  return result || null;
}

function parseVariables(raw: string | null): Json {
  if (!raw) return [];
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export async function upsertTemplateAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const id = text(formData, "id");
  const channel = text(formData, "channel", true);
  if (channel !== "email" && channel !== "whatsapp") throw new Error("Invalid channel");
  const payload = {
    name: text(formData, "name", true),
    channel,
    subject_es: text(formData, "subject_es"),
    subject_en: text(formData, "subject_en"),
    body_es: text(formData, "body_es", true),
    body_en: text(formData, "body_en", true),
    variables: parseVariables(text(formData, "variables")),
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
