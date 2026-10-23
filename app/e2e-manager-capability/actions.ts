"use server";

import type { MiDiaActionState } from "@/app/admin/(protected)/dashboard/action-state";

export async function fixtureMiDiaAction(state: MiDiaActionState, formData: FormData): Promise<MiDiaActionState> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const requestId = formData.get("requestId");
  const feedbackSequence = state.feedbackSequence + 1;
  if (formData.get("intent") === "start") {
    return { status: "failure", code: "PERSISTENCE_FAILURE", message: "No pudimos actualizar la tarea. Intenta de nuevo.", requestId: typeof requestId === "string" ? requestId : null, feedbackSequence };
  }
  return { status: "success", code: null, message: "Tarea completada.", requestId: typeof requestId === "string" ? requestId : "", feedbackSequence };
}
