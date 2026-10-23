import "server-only"
import { requireAdminRole } from "@/lib/admin/auth"
import { createClient } from "@/lib/supabase/server"

export type TaskActionTargetStatus = "in_progress" | "completed" | "canceled"
export type TaskActionCancelReason = "no_longer_needed" | "duplicate" | "source_invalidated" | "other"
export type TaskActionCompletionOutcome = "first_contact_completed" | "work_completed"
export type TaskActionInput = {
  requestId: string
  taskId: string
  targetStatus: TaskActionTargetStatus
  cancelReason: TaskActionCancelReason | null
  completionOutcome: TaskActionCompletionOutcome | null
  note: string | null
}
export type TaskActionDomainCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "TASK_FORBIDDEN" | "TASK_ACTION_IDEMPOTENCY_CONFLICT" | "TASK_INVALID_TRANSITION"
export type TaskActionErrorCode = TaskActionDomainCode | "PERSISTENCE_FAILURE"
export type TaskActionFailure = { ok: false; error: { code: TaskActionErrorCode; message: TaskActionErrorCode } }
export type TaskActionSuccess = {
  ok: true
  schema: "task-action-result.v1"
  receiptId: string
  requestId: string
  taskId: string
  actorKind: "human"
  actorId: string
  ownerId: string
  action: "start" | "complete" | "cancel"
  fromStatus: "pending" | "in_progress" | "completed" | "canceled"
  targetStatus: TaskActionTargetStatus
  cancelReason: TaskActionCancelReason | null
  completionOutcome: TaskActionCompletionOutcome | null
  note: string | null
  sourceKind: null
  sourceId: null
  sourceKey: null
  sourceOrder: null
  outcome: "applied" | "already_at_target"
  createdAt: string
  replayed: boolean
}
export type TaskActionResult = TaskActionSuccess | TaskActionFailure
export type TaskActionRpcArgs = {
  p_request_id_text: string
  p_expected_actor_id: string
  p_task_id_text: string
  p_target_status: TaskActionTargetStatus
  p_cancel_reason: TaskActionCancelReason | null
  p_completion_outcome: TaskActionCompletionOutcome | null
  p_note: string | null
}
export type TaskActionDeps = {
  requireAdminRole?: typeof requireAdminRole
  createClient?: typeof createClient
  invokeRpc?: (client: Awaited<ReturnType<typeof createClient>>, args: TaskActionRpcArgs) => Promise<{ data: unknown; error: null | { code?: string; message?: string } }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const CREATED_AT = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}Z$/
const INPUT_KEYS = ["requestId", "taskId", "targetStatus", "cancelReason", "completionOutcome", "note"] as const
const SUCCESS_KEYS = ["ok", "schema", "receiptId", "requestId", "taskId", "actorKind", "actorId", "ownerId", "action", "fromStatus", "targetStatus", "cancelReason", "completionOutcome", "note", "sourceKind", "sourceId", "sourceKey", "sourceOrder", "outcome", "createdAt", "replayed"] as const
const DOMAIN_CODES = new Set<TaskActionDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "TASK_FORBIDDEN", "TASK_ACTION_IDEMPOTENCY_CONFLICT", "TASK_INVALID_TRANSITION"])
const TARGETS = new Set<TaskActionTargetStatus>(["in_progress", "completed", "canceled"])
const REASONS = new Set<TaskActionCancelReason>(["no_longer_needed", "duplicate", "source_invalidated", "other"])
const OUTCOMES = new Set<TaskActionCompletionOutcome>(["first_contact_completed", "work_completed"])
const STATUSES = new Set(["pending", "in_progress", "completed", "canceled"])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
const validUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
const failure = (code: TaskActionErrorCode): TaskActionFailure => ({ ok: false, error: { code, message: code } })

function validInput(value: unknown): value is TaskActionInput {
  if (!object(value) || !exact(value, INPUT_KEYS) || !validUuid(value.requestId) || !validUuid(value.taskId) || typeof value.targetStatus !== "string" || !TARGETS.has(value.targetStatus as TaskActionTargetStatus)) return false
  if (value.note !== null && (typeof value.note !== "string" || value.note !== value.note.trim() || new TextEncoder().encode(value.note).byteLength < 1 || new TextEncoder().encode(value.note).byteLength > 2000)) return false
  if (value.targetStatus === "in_progress") return value.cancelReason === null && value.completionOutcome === null && value.note === null
  if (value.targetStatus === "completed") return value.cancelReason === null && (value.completionOutcome === null || typeof value.completionOutcome === "string" && OUTCOMES.has(value.completionOutcome as TaskActionCompletionOutcome))
  return typeof value.cancelReason === "string" && REASONS.has(value.cancelReason as TaskActionCancelReason) && value.completionOutcome === null
}

function decode(value: unknown, input: TaskActionInput, actorId: string): TaskActionResult {
  if (object(value) && exact(value, ["ok", "error"]) && value.ok === false && object(value.error) && exact(value.error, ["code", "message"]) && value.error.code === value.error.message && typeof value.error.code === "string" && DOMAIN_CODES.has(value.error.code as TaskActionDomainCode)) return failure(value.error.code as TaskActionDomainCode)
  const expectedAction = input.targetStatus === "in_progress" ? "start" : input.targetStatus === "completed" ? "complete" : "cancel"
  if (!object(value) || !exact(value, SUCCESS_KEYS) || value.ok !== true || value.schema !== "task-action-result.v1" || !validUuid(value.receiptId) || value.requestId !== input.requestId || value.taskId !== input.taskId || value.actorKind !== "human" || value.actorId !== actorId || !validUuid(value.ownerId) || value.action !== expectedAction || typeof value.fromStatus !== "string" || !STATUSES.has(value.fromStatus) || value.targetStatus !== input.targetStatus || value.cancelReason !== input.cancelReason || value.completionOutcome !== input.completionOutcome || value.note !== input.note || value.sourceKind !== null || value.sourceId !== null || value.sourceKey !== null || value.sourceOrder !== null || (value.outcome !== "applied" && value.outcome !== "already_at_target") || typeof value.createdAt !== "string" || !CREATED_AT.test(value.createdAt) || typeof value.replayed !== "boolean") return failure("PERSISTENCE_FAILURE")
  if (value.outcome === "already_at_target" ? value.fromStatus !== value.targetStatus : !((value.fromStatus === "pending" && TARGETS.has(value.targetStatus as TaskActionTargetStatus)) || (value.fromStatus === "in_progress" && (value.targetStatus === "completed" || value.targetStatus === "canceled")))) return failure("PERSISTENCE_FAILURE")
  return value as TaskActionSuccess
}

export async function performTaskAction(input: unknown, deps: TaskActionDeps = {}): Promise<TaskActionResult> {
  const session = await (deps.requireAdminRole ?? requireAdminRole)()
  if (!validInput(input) || !validUuid(session.user.id)) return failure("INVALID_REQUEST")
  const args: TaskActionRpcArgs = { p_request_id_text: input.requestId, p_expected_actor_id: session.user.id, p_task_id_text: input.taskId, p_target_status: input.targetStatus, p_cancel_reason: input.cancelReason, p_completion_outcome: input.completionOutcome, p_note: input.note }
  try {
    const client = await (deps.createClient ?? createClient)()
    const result = await (deps.invokeRpc ?? ((instance, rpcArgs) => instance.rpc("task_action", rpcArgs) as unknown as Promise<{ data: unknown; error: null | { code?: string; message?: string } }>))(client, args)
    return result.error ? failure("PERSISTENCE_FAILURE") : decode(result.data, input, session.user.id)
  } catch {
    return failure("PERSISTENCE_FAILURE")
  }
}
