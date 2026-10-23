import "server-only"
import { requireAdminRole } from "@/lib/admin/auth"
import { createClient } from "@/lib/supabase/server"

export type DispositionReadinessDomainCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "APPROVAL_NOT_FOUND" | "APPLY_RECEIPT_NOT_FOUND" | "APPROVAL_INTEGRITY_FAILURE"
  | "APPLY_RECEIPT_INTEGRITY_FAILURE" | "TASK_PARITY_FAILURE" | "LIMIT_EXCEEDED"
export type DispositionReadinessErrorCode = DispositionReadinessDomainCode | "PERSISTENCE_FAILURE"
export type DispositionReadinessCounts = {
  eligible: number
  invalidDateNoTask: number
  manualReviewUnassignedOwner: number
  excludedLeadNotOperational: number
  excludedNonSelectedHistory: number
  alreadyConverted: number
  collisionManualReview: number
  taskBacked: number
  intentionalNoTask: number
  unresolvedManualReview: number
  total: number
}
export type DispositionReadinessRow = {
  ordinal: number
  eventId: string
  disposition: "eligible" | "invalid-date/no-task" | "manual-review/unassigned-owner" | "excluded/lead-not-operational" | "excluded/non-selected-history" | "already-converted" | "collision/manual-review"
  outcome: "task_backed" | "intentional_no_task" | "unresolved_manual_review"
  taskId: string | null
}
export type DispositionReadinessSuccess = {
  ok: true
  requestId: string
  approvalId: string
  applyReceiptId: string
  ready: boolean
  counts: DispositionReadinessCounts
  rows: DispositionReadinessRow[]
}
export type DispositionReadinessFailure = { ok: false; error: { code: DispositionReadinessErrorCode; message: DispositionReadinessErrorCode } }
export type DispositionReadinessResult = DispositionReadinessSuccess | DispositionReadinessFailure
export type DispositionReadinessRpcArgs = { p_request_id_text: string; p_expected_actor_id: string }
export type DispositionReadinessDeps = {
  requireAdminRole?: typeof requireAdminRole
  createClient?: typeof createClient
  invokeRpc?: (client: Awaited<ReturnType<typeof createClient>>, args: DispositionReadinessRpcArgs) => Promise<{ data: unknown; error: null | { code?: string; message?: string } }>
}

type RpcSuccess = DispositionReadinessSuccess
type RpcFailure = { ok: false; error: { code: DispositionReadinessDomainCode; message: DispositionReadinessDomainCode } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const RESULT_KEYS = ["ok", "requestId", "approvalId", "applyReceiptId", "ready", "counts", "rows"] as const
const COUNT_KEYS = ["eligible", "invalidDateNoTask", "manualReviewUnassignedOwner", "excludedLeadNotOperational", "excludedNonSelectedHistory", "alreadyConverted", "collisionManualReview", "taskBacked", "intentionalNoTask", "unresolvedManualReview", "total"] as const
const ROW_KEYS = ["ordinal", "eventId", "disposition", "outcome", "taskId"] as const
const DISPOSITIONS = ["eligible", "invalid-date/no-task", "manual-review/unassigned-owner", "excluded/lead-not-operational", "excluded/non-selected-history", "already-converted", "collision/manual-review"] as const
const DOMAIN_CODES = new Set<DispositionReadinessDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "APPROVAL_NOT_FOUND", "APPLY_RECEIPT_NOT_FOUND", "APPROVAL_INTEGRITY_FAILURE", "APPLY_RECEIPT_INTEGRITY_FAILURE", "TASK_PARITY_FAILURE", "LIMIT_EXCEEDED"])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
const validUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
const validCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2000
const failure = (code: DispositionReadinessErrorCode): DispositionReadinessFailure => ({ ok: false, error: { code, message: code } })

function decode(value: unknown, expectedRequestId: string): DispositionReadinessResult {
  if (object(value) && exact(value, ["ok", "error"]) && value.ok === false && object(value.error) && exact(value.error, ["code", "message"]) && value.error.code === value.error.message && typeof value.error.code === "string" && DOMAIN_CODES.has(value.error.code as DispositionReadinessDomainCode)) return failure(value.error.code as DispositionReadinessDomainCode)
  if (!object(value) || !exact(value, RESULT_KEYS) || value.ok !== true || value.requestId !== expectedRequestId || !validUuid(value.requestId) || !validUuid(value.approvalId) || !validUuid(value.applyReceiptId) || typeof value.ready !== "boolean" || !object(value.counts) || !exact(value.counts, COUNT_KEYS) || !Array.isArray(value.rows) || value.rows.length > 2000) return failure("PERSISTENCE_FAILURE")
  const rawCounts = value.counts
  if (COUNT_KEYS.some((key) => !validCount(rawCounts[key]))) return failure("PERSISTENCE_FAILURE")
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, rawCounts[key]])) as DispositionReadinessCounts
  const dispositionCounts = Object.fromEntries(DISPOSITIONS.map((disposition) => [disposition, 0])) as Record<(typeof DISPOSITIONS)[number], number>
  const eventIds = new Set<string>(), taskIds = new Set<string>(), rows: DispositionReadinessRow[] = []
  for (const [index, raw] of value.rows.entries()) {
    if (!object(raw) || !exact(raw, ROW_KEYS) || raw.ordinal !== index || !validUuid(raw.eventId) || typeof raw.disposition !== "string" || !DISPOSITIONS.includes(raw.disposition as DispositionReadinessRow["disposition"]) || eventIds.has(raw.eventId)) return failure("PERSISTENCE_FAILURE")
    const disposition = raw.disposition as DispositionReadinessRow["disposition"]
    const outcome = disposition === "eligible" || disposition === "already-converted" ? "task_backed" : disposition === "manual-review/unassigned-owner" || disposition === "collision/manual-review" ? "unresolved_manual_review" : "intentional_no_task"
    if (raw.outcome !== outcome || (outcome === "task_backed" ? !validUuid(raw.taskId) || taskIds.has(raw.taskId) : raw.taskId !== null)) return failure("PERSISTENCE_FAILURE")
    eventIds.add(raw.eventId)
    if (raw.taskId) taskIds.add(raw.taskId as string)
    dispositionCounts[disposition]++
    rows.push({ ordinal: index, eventId: raw.eventId, disposition, outcome, taskId: raw.taskId as string | null })
  }
  const categories = [counts.eligible, counts.invalidDateNoTask, counts.manualReviewUnassignedOwner, counts.excludedLeadNotOperational, counts.excludedNonSelectedHistory, counts.alreadyConverted, counts.collisionManualReview]
  if (DISPOSITIONS.some((disposition, index) => dispositionCounts[disposition] !== categories[index]) || counts.taskBacked !== counts.eligible + counts.alreadyConverted || counts.intentionalNoTask !== counts.invalidDateNoTask + counts.excludedLeadNotOperational + counts.excludedNonSelectedHistory || counts.unresolvedManualReview !== counts.manualReviewUnassignedOwner + counts.collisionManualReview || counts.total !== categories.reduce((sum, count) => sum + count, 0) || rows.length !== counts.total || value.ready !== (counts.unresolvedManualReview === 0)) return failure("PERSISTENCE_FAILURE")
  return { ok: true, requestId: value.requestId, approvalId: value.approvalId, applyReceiptId: value.applyReceiptId, ready: value.ready, counts, rows }
}

export async function readFollowUpTaskDispositionReadiness(input: unknown, deps: DispositionReadinessDeps = {}): Promise<DispositionReadinessResult> {
  const session = await (deps.requireAdminRole ?? requireAdminRole)(["admin"])
  if (!object(input) || !exact(input, ["requestId"]) || !validUuid(input.requestId) || !validUuid(session.user.id)) return failure("INVALID_REQUEST")
  const args: DispositionReadinessRpcArgs = { p_request_id_text: input.requestId, p_expected_actor_id: session.user.id }
  try {
    const client = await (deps.createClient ?? createClient)()
    const result = await (deps.invokeRpc ?? ((instance, rpcArgs) => instance.rpc("read_follow_up_task_disposition_readiness", rpcArgs) as unknown as Promise<{ data: unknown; error: null | { code?: string; message?: string } }>))(client, args)
    return result.error ? failure("PERSISTENCE_FAILURE") : decode(result.data as RpcSuccess | RpcFailure, input.requestId)
  } catch {
    return failure("PERSISTENCE_FAILURE")
  }
}
