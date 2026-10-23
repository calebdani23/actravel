import "server-only"
import { isProxy } from "node:util/types"

import { createClient } from "@/lib/supabase/server"
import { authorizeTaskAutomationHistoricalAdmin, type BootstrapAuthDeps } from "./task-automation-historical-auth"
import { CANONICAL_LIMITS, canonicalBytes, canonicalHash, canonicalJson, hasExactKeys, isCanonicalHash,
  isCanonicalTimestamp, isCanonicalUuid } from "./task-automation-historical-contract"

export type HistoricalApplyInput = { requestId: string }
export type HistoricalApplyRpcArgs = { p_request_id_text: string; p_expected_actor_id: string }
export type HistoricalApplyDomainCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH"
  | "INVALID_REQUEST" | "APPLY_IDEMPOTENCY_CONFLICT" | "APPLY_RECEIPT_INTEGRITY_FAILURE" | "APPROVAL_NOT_FOUND"
  | "APPROVAL_INTEGRITY_FAILURE" | "STALE_PLAN_INTEGRITY" | "STALE_LIVE_CONTEXT" | "STALE_SOURCE_ORDER"
  | "IDENTITY_OCCUPANCY_CONFLICT" | "LIMIT_EXCEEDED"
export type HistoricalApplyCode = HistoricalApplyDomainCode | "PERSISTENCE_FAILURE"
type Failure<Code extends HistoricalApplyCode> = Code extends string ? { ok: false; error: { code: Code; message: Code } } : never
export type HistoricalApplyResultValue = {
  schema: "task-automation-historical-apply-result.v1"; requestId: string; approvalId: string; actorId: string
  planHash: string; projectionHash: string; taskIds: string[]; originKeys: string[]; outcomeKeys: string[]; tombstoneKeys: string[]
  generatedCount: number; suppressedCount: number; projectionCount: number
}
export type HistoricalApplySuccess = {
  ok: true; status: "success"; replayed: boolean; receiptId: string; requestId: string; approvalId: string; actorId: string
  approvalFingerprint: string; planHash: string; projectionHash: string; taskIds: string[]; originKeys: string[]
  outcomeKeys: string[]; tombstoneKeys: string[]; generatedCount: number; suppressedCount: number; projectionCount: number
  result: HistoricalApplyResultValue; resultHash: string; resultByteCount: number; createdAt: string
}
export type HistoricalApplyResult = HistoricalApplySuccess | { [Code in HistoricalApplyCode]: Failure<Code> }[HistoricalApplyCode]
type RpcResult = { data: unknown; error: unknown }
export type HistoricalApplyDeps = {
  auth?: BootstrapAuthDeps
  createPersistenceClient?: () => Promise<unknown>
  invokeRpc?: (client: unknown, args: HistoricalApplyRpcArgs) => Promise<RpcResult>
}

const failure = <Code extends HistoricalApplyCode>(code: Code): Failure<Code> =>
  ({ ok: false, error: { code, message: code } }) as Failure<Code>
const DOMAIN_CODES = new Set<HistoricalApplyDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH",
  "INVALID_REQUEST", "APPLY_IDEMPOTENCY_CONFLICT", "APPLY_RECEIPT_INTEGRITY_FAILURE", "APPROVAL_NOT_FOUND",
  "APPROVAL_INTEGRITY_FAILURE", "STALE_PLAN_INTEGRITY", "STALE_LIVE_CONTEXT", "STALE_SOURCE_ORDER",
  "IDENTITY_OCCUPANCY_CONFLICT", "LIMIT_EXCEEDED"])
const SUCCESS_KEYS = ["ok", "status", "id", "request_id", "approval_id", "actor_id", "approval_fingerprint", "plan_hash",
  "projection_hash", "task_ids", "origin_keys", "outcome_keys", "tombstone_keys", "generated_count", "suppressed_count",
  "projection_count", "result", "result_hash", "result_byte_count", "created_at"] as const
const RESULT_KEYS = ["schema", "requestId", "approvalId", "actorId", "planHash", "projectionHash", "taskIds", "originKeys",
  "outcomeKeys", "tombstoneKeys", "generatedCount", "suppressedCount", "projectionCount"] as const
const integer = (value: unknown, maximum: number = CANONICAL_LIMITS.totalRows): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum
const array = (value: unknown, valid: (candidate: unknown) => boolean): value is string[] =>
  Array.isArray(value) && value.length <= CANONICAL_LIMITS.totalRows && value.every(valid) && new Set(value).size === value.length
const same = (left: unknown, right: unknown) => canonicalJson(left) === canonicalJson(right)
const rpcResult = (value: unknown): RpcResult | null => {
  if (!value || typeof value !== "object" || isProxy(value)) return null
  try {
    const data = Object.getOwnPropertyDescriptor(value, "data"), error = Object.getOwnPropertyDescriptor(value, "error")
    return data && "value" in data && error && "value" in error ? { data: data.value, error: error.value } : null
  } catch { return null }
}

function decode(value: unknown, args: HistoricalApplyRpcArgs): HistoricalApplyResult {
  try { canonicalJson(value) } catch { return failure("PERSISTENCE_FAILURE") }
  if (hasExactKeys(value, ["ok", "error"]) && value.ok === false && hasExactKeys(value.error, ["code", "message"])
    && typeof value.error.code === "string" && value.error.code === value.error.message
    && DOMAIN_CODES.has(value.error.code as HistoricalApplyDomainCode)) return failure(value.error.code as HistoricalApplyDomainCode)
  if (!hasExactKeys(value, SUCCESS_KEYS) || value.ok !== true || value.status !== "applied" && value.status !== "replayed"
    || !isCanonicalUuid(value.id) || value.request_id !== args.p_request_id_text || !isCanonicalUuid(value.approval_id)
    || value.actor_id !== args.p_expected_actor_id || !isCanonicalHash(value.approval_fingerprint) || !isCanonicalHash(value.plan_hash)
    || !isCanonicalHash(value.projection_hash) || !isCanonicalHash(value.result_hash) || !isCanonicalTimestamp(value.created_at)
    || !integer(value.generated_count) || !integer(value.suppressed_count) || !integer(value.projection_count)
    || !integer(value.result_byte_count, CANONICAL_LIMITS.planBytes) || value.result_byte_count < 1
    || !array(value.task_ids, isCanonicalUuid) || !array(value.origin_keys, isCanonicalHash)
    || !array(value.outcome_keys, isCanonicalHash) || !array(value.tombstone_keys, isCanonicalHash)) return failure("PERSISTENCE_FAILURE")
  const result = value.result
  if (!hasExactKeys(result, RESULT_KEYS) || result.schema !== "task-automation-historical-apply-result.v1"
    || result.requestId !== value.request_id || result.approvalId !== value.approval_id || result.actorId !== value.actor_id
    || result.planHash !== value.plan_hash || result.projectionHash !== value.projection_hash
    || !same(result.taskIds, value.task_ids) || !same(result.originKeys, value.origin_keys)
    || !same(result.outcomeKeys, value.outcome_keys) || !same(result.tombstoneKeys, value.tombstone_keys)
    || result.generatedCount !== value.generated_count || result.suppressedCount !== value.suppressed_count
    || result.projectionCount !== value.projection_count || value.generated_count !== value.task_ids.length
    || value.generated_count !== value.origin_keys.length || value.suppressed_count !== value.tombstone_keys.length
    || value.projection_count !== value.generated_count + value.suppressed_count || value.projection_count !== value.outcome_keys.length
    || canonicalHash(result) !== value.result_hash || canonicalBytes(result).byteLength !== value.result_byte_count)
    return failure("PERSISTENCE_FAILURE")
  const publicResult: HistoricalApplyResultValue = { schema: "task-automation-historical-apply-result.v1",
    requestId: result.requestId as string, approvalId: result.approvalId as string, actorId: result.actorId as string,
    planHash: result.planHash as string, projectionHash: result.projectionHash as string, taskIds: value.task_ids,
    originKeys: value.origin_keys, outcomeKeys: value.outcome_keys, tombstoneKeys: value.tombstone_keys,
    generatedCount: value.generated_count, suppressedCount: value.suppressed_count, projectionCount: value.projection_count }
  return { ok: true, status: "success", replayed: value.status === "replayed", receiptId: value.id, requestId: value.request_id,
    approvalId: value.approval_id, actorId: value.actor_id, approvalFingerprint: value.approval_fingerprint,
    planHash: value.plan_hash, projectionHash: value.projection_hash, taskIds: value.task_ids, originKeys: value.origin_keys,
    outcomeKeys: value.outcome_keys, tombstoneKeys: value.tombstone_keys, generatedCount: value.generated_count,
    suppressedCount: value.suppressed_count, projectionCount: value.projection_count, result: publicResult,
    resultHash: value.result_hash, resultByteCount: value.result_byte_count, createdAt: value.created_at }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>
export async function applyTaskAutomationHistoricalPlan(input: unknown, deps: HistoricalApplyDeps = {}): Promise<HistoricalApplyResult> {
  let auth
  try { auth = await authorizeTaskAutomationHistoricalAdmin("PERSISTENCE_FAILURE", deps.auth) }
  catch { return failure("PERSISTENCE_FAILURE") }
  if (!auth.ok) return auth
  if (!hasExactKeys(input, ["requestId"]) || !isCanonicalUuid(input.requestId)) return failure("INVALID_REQUEST")
  const args = { p_request_id_text: input.requestId, p_expected_actor_id: auth.actorId }
  try {
    const client = await (deps.createPersistenceClient ?? createClient)()
    const response = rpcResult(await (deps.invokeRpc ?? ((value, rpcArgs) =>
      (value as ServerClient).rpc("apply_task_automation_historical_plan", rpcArgs) as unknown as Promise<RpcResult>))(client, args))
    return !response || response.error !== null ? failure("PERSISTENCE_FAILURE") : decode(response.data, args)
  } catch { return failure("PERSISTENCE_FAILURE") }
}
