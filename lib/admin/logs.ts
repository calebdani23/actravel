import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type WhatsappClickRow = Tables<"whatsapp_clicks"> & { contacts: { first_name: string; last_name: string | null; phone: string | null } | null };
export type NotificationLogRow = Tables<"notification_logs"> & { contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null };
export type SheetSyncLogRow = Tables<"sheet_sync_logs">;

export async function getAdminLogs() {
  const supabase = await createClient();
  const [whatsapp, notifications, sheets] = await Promise.all([
    supabase.from("whatsapp_clicks").select("*, contacts(first_name, last_name, phone)").order("created_at", { ascending: false }).limit(50),
    supabase.from("notification_logs").select("*, contacts(first_name, last_name, email, phone)").order("created_at", { ascending: false }).limit(50),
    supabase.from("sheet_sync_logs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    whatsapp: (whatsapp.data ?? []) as unknown as WhatsappClickRow[],
    notifications: (notifications.data ?? []) as unknown as NotificationLogRow[],
    sheets: (sheets.data ?? []) as SheetSyncLogRow[],
    errors: [whatsapp.error?.message, notifications.error?.message, sheets.error?.message].filter(Boolean),
  };
}
