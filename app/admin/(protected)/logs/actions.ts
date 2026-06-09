"use server";

import { revalidatePath } from "next/cache";
import { retrySheetSyncLog } from "@/lib/google-sheets/quote-sheet-retry";
import { retryNotificationLog } from "@/lib/leads/quote-notification-retry";
import { requireAdminRole } from "@/lib/admin/auth";
import { setNotificationIncidentStatus, setSheetIncidentStatus, type IncidentStatus } from "@/lib/admin/logs";

function logId(formData: FormData) {
  const value = formData.get("logId");
  if (typeof value !== "string" || !value.trim()) throw new Error("logId is required");
  return value.trim();
}

function incidentStatus(formData: FormData) {
  const value = formData.get("incidentStatus");
  if (value !== "open" && value !== "resolved") throw new Error("incidentStatus is invalid");
  return value as IncidentStatus;
}

function revalidateAdminOpsViews() {
  revalidatePath("/admin/logs");
  revalidatePath("/admin/dashboard");
}

export async function retryNotificationLogAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "marketing"]);
  await retryNotificationLog(logId(formData), session.user.id);
  revalidateAdminOpsViews();
}

export async function retrySheetSyncLogAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "marketing"]);
  await retrySheetSyncLog(logId(formData), session.user.id);
  revalidateAdminOpsViews();
}

export async function setNotificationIncidentStatusAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "marketing"]);
  await setNotificationIncidentStatus(logId(formData), incidentStatus(formData), session.user.id);
  revalidateAdminOpsViews();
}

export async function setSheetIncidentStatusAction(formData: FormData) {
  const session = await requireAdminRole(["admin", "marketing"]);
  await setSheetIncidentStatus(logId(formData), incidentStatus(formData), session.user.id);
  revalidateAdminOpsViews();
}
