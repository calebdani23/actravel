"use server";

import { revalidatePath } from "next/cache";
import { initialLogActionState, type LogActionState } from "@/app/admin/(protected)/logs/action-state";
import { retryNotificationLog } from "@/lib/leads/quote-notification-retry";
import { requireAdminRole } from "@/lib/admin/auth";
import { adminLogsInternals, setNotificationIncidentStatus } from "@/lib/admin/logs";

function logId(formData: FormData) {
  return adminLogsInternals.requiredNotificationLogId(formData);
}

function incidentStatus(formData: FormData) {
  return adminLogsInternals.requiredIncidentStatus(formData);
}

function revalidateAdminOpsViews() {
  revalidatePath("/admin/logs");
  revalidatePath("/admin/dashboard");
}

export async function retryNotificationLogAction(previousState: LogActionState = initialLogActionState, formData: FormData): Promise<LogActionState> {
  void previousState;
  const session = await requireAdminRole(["admin", "marketing"]);

  try {
    await retryNotificationLog(logId(formData), session.user.id);
    revalidateAdminOpsViews();
    return { ok: true, message: "Reintento solicitado." };
  } catch (error) {
    return { ok: false, message: adminLogsInternals.sanitizeLogActionError("retry", error) };
  }
}

export async function setNotificationIncidentStatusAction(previousState: LogActionState = initialLogActionState, formData: FormData): Promise<LogActionState> {
  void previousState;
  const session = await requireAdminRole(["admin", "marketing"]);

  try {
    await setNotificationIncidentStatus(logId(formData), incidentStatus(formData), session.user.id);
    revalidateAdminOpsViews();
    return { ok: true, message: "Incidencia actualizada." };
  } catch (error) {
    return { ok: false, message: adminLogsInternals.sanitizeLogActionError("incident-status", error) };
  }
}
