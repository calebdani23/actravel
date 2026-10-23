import "server-only"
import { requireAdminRole } from "@/lib/admin/auth"
import { createClient } from "@/lib/supabase/server"

export type ApplyDomainCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "APPLY_IDEMPOTENCY_CONFLICT" | "APPROVAL_NOT_FOUND" | "APPROVAL_INTEGRITY_FAILURE" | "STALE_LIVE_CONTEXT"
  | "TASK_OCCUPANCY_CONFLICT" | "LIMIT_EXCEEDED"
export type ApplyErrorCode = ApplyDomainCode | "PERSISTENCE_FAILURE"
export type ApplyRpcArgs = { p_request_id_text: string; p_expected_actor_id: string }
type ApplyTaskId = string
type ApplyNestedResult = {
  schema: "follow-up-task-apply-result.v1"; requestId: string; approvalId: string; actorId: string
  taskIds: ApplyTaskId[]; taskCount: number
}
type RpcSuccess = {
  ok: true; status: "applied" | "replayed"; id: string; request_id: string; approval_id: string; actor_id: string
  approval_fingerprint: string; request_fingerprint: string; canonical_plan_hash: string; projection_hash: string
  task_ids: ApplyTaskId[]; task_count: number; result: ApplyNestedResult; result_hash: string
  result_byte_count: number; created_at: string
}
type RpcFailure = { ok: false; error: { code: ApplyDomainCode; message: ApplyDomainCode } }
type RpcResult = RpcSuccess | RpcFailure
export type ApplyFailure = { ok: false; error: { code: ApplyErrorCode; message: ApplyErrorCode } }
export type ApplySuccess = {
  ok: true; status: "success"; replayed: boolean; receiptId: string; requestId: string; approvalId: string; actorId: string
  approvalFingerprint: string; requestFingerprint: string; canonicalPlanHash: string; projectionHash: string
  taskIds: ApplyTaskId[]; taskCount: number; result: ApplyNestedResult; resultHash: string; resultByteCount: number; createdAt: string
}
export type ApplyResult = ApplySuccess | ApplyFailure
export type ApplyDeps = {
  requireAdminRole?: typeof requireAdminRole
  createClient?: typeof createClient
  invokeRpc?: (client: Awaited<ReturnType<typeof createClient>>, args: ApplyRpcArgs) => Promise<{ data: unknown; error: null | { code?: string; message?: string } }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const RPC_KEYS = ["ok", "status", "id", "request_id", "approval_id", "actor_id", "approval_fingerprint", "request_fingerprint", "canonical_plan_hash", "projection_hash", "task_ids", "task_count", "result", "result_hash", "result_byte_count", "created_at"] as const
const RESULT_KEYS = ["schema", "requestId", "approvalId", "actorId", "taskIds", "taskCount"] as const
const DOMAIN_CODES = new Set<ApplyDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "APPLY_IDEMPOTENCY_CONFLICT", "APPROVAL_NOT_FOUND", "APPROVAL_INTEGRITY_FAILURE", "STALE_LIVE_CONTEXT", "TASK_OCCUPANCY_CONFLICT", "LIMIT_EXCEEDED"])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
const validUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
const validHash = (value: unknown): value is string => typeof value === "string" && HASH.test(value)
const validCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0
const failure = (code: ApplyErrorCode): ApplyFailure => ({ ok: false, error: { code, message: code } })

function decodeNested(value: unknown, requestId: string, approvalId: string, actorId: string, taskIds: string[], taskCount: number): value is ApplyNestedResult {
  if (!object(value) || !exact(value, RESULT_KEYS) || value.schema !== "follow-up-task-apply-result.v1" || !validUuid(value.requestId) || !validUuid(value.approvalId) || !validUuid(value.actorId) || !Array.isArray(value.taskIds) || !validCount(value.taskCount)) return false
  if (value.requestId !== requestId || value.approvalId !== approvalId || value.actorId !== actorId || value.taskCount !== taskCount || value.taskIds.length !== taskCount || taskIds.length !== taskCount) return false
  if (value.taskIds.some((id) => !validUuid(id)) || new Set(value.taskIds).size !== value.taskIds.length || new Set(taskIds).size !== taskIds.length) return false
  return value.taskIds.every((id, index) => id === taskIds[index])
}

function decode(value: unknown): ApplyResult {
  if (object(value) && exact(value, ["ok", "error"]) && value.ok === false && object(value.error) && exact(value.error, ["code", "message"]) && value.error.code === value.error.message && typeof value.error.code === "string" && DOMAIN_CODES.has(value.error.code as ApplyDomainCode)) return failure(value.error.code as ApplyDomainCode)
  if (!object(value) || !exact(value, RPC_KEYS) || value.ok !== true || (value.status !== "applied" && value.status !== "replayed") || !validUuid(value.id) || !validUuid(value.request_id) || !validUuid(value.approval_id) || !validUuid(value.actor_id) || !validHash(value.approval_fingerprint) || !validHash(value.request_fingerprint) || !validHash(value.canonical_plan_hash) || !validHash(value.projection_hash) || !Array.isArray(value.task_ids) || !validCount(value.task_count) || !validHash(value.result_hash) || !validCount(value.result_byte_count) || typeof value.created_at !== "string") return failure("PERSISTENCE_FAILURE")
  const taskIds = value.task_ids
  if (taskIds.some((id) => !validUuid(id)) || new Set(taskIds).size !== taskIds.length || taskIds.length !== value.task_count || !decodeNested(value.result, value.request_id, value.approval_id, value.actor_id, taskIds, value.task_count)) return failure("PERSISTENCE_FAILURE")
  return { ok: true, status: "success", replayed: value.status === "replayed", receiptId: value.id, requestId: value.request_id, approvalId: value.approval_id, actorId: value.actor_id, approvalFingerprint: value.approval_fingerprint, requestFingerprint: value.request_fingerprint, canonicalPlanHash: value.canonical_plan_hash, projectionHash: value.projection_hash, taskIds, taskCount: value.task_count, result: value.result, resultHash: value.result_hash, resultByteCount: value.result_byte_count, createdAt: value.created_at }
}

export async function applyApprovedFollowUpTaskPlan(input: unknown, deps: ApplyDeps = {}): Promise<ApplyResult> {
  const session = await (deps.requireAdminRole ?? requireAdminRole)(["admin"])
  if (!object(input) || !exact(input, ["requestId"]) || !validUuid(input.requestId)) return failure("INVALID_REQUEST")
  if (!validUuid(session.user.id)) return failure("INVALID_REQUEST")
  const args: ApplyRpcArgs = { p_request_id_text: input.requestId, p_expected_actor_id: session.user.id }
  try {
    const client = await (deps.createClient ?? createClient)()
    const result = await (deps.invokeRpc ?? ((c, a) => c.rpc("apply_approved_follow_up_task_plan", a) as unknown as Promise<{ data: unknown; error: null | { code?: string; message?: string } }>))(client, args)
    return result.error ? failure("PERSISTENCE_FAILURE") : decode(result.data as RpcResult)
  } catch { return failure("PERSISTENCE_FAILURE") }
}
