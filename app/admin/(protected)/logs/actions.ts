"use server";

import { revalidatePath } from "next/cache";
import { retrySheetSyncLog } from "@/lib/google-sheets/quote-sheet-retry";
import { retryNotificationLog } from "@/lib/leads/quote-notification-retry";
import { requireAdminRole } from "@/lib/admin/auth";

function logId(formData: FormData) {
  const value = formData.get("logId");
  if (typeof value !== "string" || !value.trim()) throw new Error("logId is required");
  return value.trim();
}

export async function retryNotificationLogAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "marketing", "asesor"]);
  await retryNotificationLog(logId(formData), session.user.id);
  revalidatePath("/admin/logs");
}

export async function retrySheetSyncLogAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "marketing", "asesor"]);
  await retrySheetSyncLog(logId(formData), session.user.id);
  revalidatePath("/admin/logs");
}
