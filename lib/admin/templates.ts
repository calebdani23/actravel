import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type MessageTemplateRow = Tables<"message_templates">;

export async function getMessageTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("message_templates").select("*").order("updated_at", { ascending: false }).limit(100);
  return { templates: (data ?? []) as MessageTemplateRow[], error: error?.message ?? null };
}
