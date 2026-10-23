import { revalidatePath } from "next/cache"
import { initialMiDiaActionState, type MiDiaActionCode, type MiDiaActionState } from "./action-state"
import { authorizeMiDiaActor, readMiDiaActionContext, type MiDiaActorResult, type MiDiaKind } from "@/lib/admin/mi-dia"
import { performTaskAction, type TaskActionInput, type TaskActionResult } from "@/lib/admin/task-actions"

type Actor = Extract<MiDiaActorResult, { ok: true }>
type Request = { requestId: string; taskId: string; intent: "start" | "complete" | "cancel"; taskKind: MiDiaKind; cancelReason: "no_longer_needed" | "duplicate" | "source_invalidated" | "other" | null }
export type MiDiaActionDeps = {
  authorizeActor?: () => Promise<MiDiaActorResult>
  readContext?: typeof readMiDiaActionContext
  performAction?: (input: TaskActionInput, actor: Actor) => Promise<TaskActionResult>
  revalidate?: (path: string) => void
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const FORM_KEYS = ["requestId", "taskId", "intent", "taskKind", "cancelReason"] as const
const KINDS = new Set<MiDiaKind>(["follow_up", "first_contact", "quote_follow_up"])
const REASONS = new Set<Request["cancelReason"]>(["no_longer_needed", "duplicate", "source_invalidated", "other"])
const COPY: Record<MiDiaActionCode, string> = {
  AUTH_REQUIRED: "Tu sesión ya no permite actualizar esta tarea.", AUTH_INACTIVE: "Tu sesión ya no permite actualizar esta tarea.", AUTH_ROLE_UNSUPPORTED: "Tu sesión ya no permite actualizar esta tarea.", AUTH_ACTOR_MISMATCH: "Tu sesión ya no permite actualizar esta tarea.", TASK_FORBIDDEN: "Tu sesión ya no permite actualizar esta tarea.",
  INVALID_REQUEST: "La solicitud no es válida.", TASK_ACTION_IDEMPOTENCY_CONFLICT: "La solicitud ya se usó para otra acción.", TASK_INVALID_TRANSITION: "La tarea cambió y esta acción ya no está disponible.", PERSISTENCE_FAILURE: "No pudimos actualizar la tarea. Intenta de nuevo.",
}
const failure = (code: MiDiaActionCode, feedbackSequence: number, requestId: string | null = null): MiDiaActionState => ({ status: "failure", code, message: COPY[code], requestId, feedbackSequence })

function parse(formData: FormData): Request | null {
  const entries = [...formData.entries()]
  if (entries.length !== FORM_KEYS.length || new Set(entries.map(([key]) => key)).size !== FORM_KEYS.length || FORM_KEYS.some((key) => !formData.has(key))) return null
  const values = Object.fromEntries(entries)
  if (FORM_KEYS.some((key) => typeof values[key] !== "string")) return null
  const { requestId, taskId, intent, taskKind, cancelReason } = values as Record<(typeof FORM_KEYS)[number], string>
  if (!UUID.test(requestId) || !UUID.test(taskId) || !["start", "complete", "cancel"].includes(intent) || !KINDS.has(taskKind as MiDiaKind)) return null
  if (intent === "cancel") return REASONS.has(cancelReason as Request["cancelReason"]) ? { requestId, taskId, intent, taskKind: taskKind as MiDiaKind, cancelReason: cancelReason as Request["cancelReason"] } : null
  return cancelReason === "" ? { requestId, taskId, intent: intent as "start" | "complete", taskKind: taskKind as MiDiaKind, cancelReason: null } : null
}

function input(request: Request): TaskActionInput {
  if (request.intent === "start") return { requestId: request.requestId, taskId: request.taskId, targetStatus: "in_progress", cancelReason: null, completionOutcome: null, note: null }
  if (request.intent === "cancel") return { requestId: request.requestId, taskId: request.taskId, targetStatus: "canceled", cancelReason: request.cancelReason, completionOutcome: null, note: null }
  return { requestId: request.requestId, taskId: request.taskId, targetStatus: "completed", cancelReason: null, completionOutcome: request.taskKind === "first_contact" ? "first_contact_completed" : "work_completed", note: null }
}

export async function runMiDiaTaskAction(previousState: MiDiaActionState = initialMiDiaActionState, formData: FormData, deps: MiDiaActionDeps = {}): Promise<MiDiaActionState> {
  const feedbackSequence = previousState.feedbackSequence + 1
  const actor = await (deps.authorizeActor ?? authorizeMiDiaActor)()
  if (!actor.ok) return failure(actor.error.code, feedbackSequence)
  const request = parse(formData)
  if (!request) return failure("INVALID_REQUEST", feedbackSequence)
  const context = await (deps.readContext ?? readMiDiaActionContext)(actor, request.taskId)
  if (!context.ok) return failure(context.error.code, feedbackSequence, request.requestId)
  if (context.kind !== request.taskKind) return failure("INVALID_REQUEST", feedbackSequence, request.requestId)
  const result = await (deps.performAction ?? ((value, current) => performTaskAction(value, { requireAdminRole: async () => ({ user: { id: current.actorId } }) as never })))(input(request), actor)
  if (!result.ok) return failure(result.error.code, feedbackSequence, request.requestId)
  const revalidate = deps.revalidate ?? revalidatePath
  revalidate("/admin/dashboard")
  if (context.navigationHref) revalidate(context.navigationHref)
  const message = result.outcome === "already_at_target" ? "La tarea ya estaba actualizada." : request.intent === "start" ? "Tarea iniciada." : request.intent === "complete" ? "Tarea completada." : "Tarea cancelada."
  return { status: "success", code: null, message, requestId: request.requestId, feedbackSequence }
}

export async function miDiaTaskAction(previousState: MiDiaActionState, formData: FormData) {
  "use server"
  return runMiDiaTaskAction(previousState, formData)
}
