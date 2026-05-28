import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type MessageTemplateRow = Tables<"message_templates">;
export type MessageTemplateChannel = "email" | "whatsapp";

export async function getMessageTemplates(options: { channel?: MessageTemplateChannel; category?: string; activeOnly?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase.from("message_templates").select("*");
  if (options.channel) query = query.eq("channel", options.channel);
  if (options.category) query = query.eq("category", options.category);
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query
    .order("channel", { ascending: true })
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(100);
  return { templates: (data ?? []) as MessageTemplateRow[], error: error?.message ?? null };
}

export async function getActiveMessageTemplates(options: { channel?: MessageTemplateChannel; category?: string } = {}) {
  return getMessageTemplates({ ...options, activeOnly: true });
}

export async function getActiveWhatsappTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, name, category, description, sort_order, body_es, body_en, variables")
    .eq("channel", "whatsapp")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(50);
  return { templates: data ?? [], error: error?.message ?? null };
}
