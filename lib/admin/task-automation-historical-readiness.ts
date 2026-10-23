import "server-only"
import { isProxy } from "node:util/types"

import { createClient } from "@/lib/supabase/server"
import { authorizeTaskAutomationHistoricalAdmin, type BootstrapAuthDeps } from "./task-automation-historical-auth"
import { CANONICAL_LIMITS, canonicalJson, hasExactKeys, isCanonicalHash, isCanonicalUuid } from "./task-automation-historical-contract"

export type HistoricalReadinessInput = { requestId: string }
export type HistoricalReadinessRpcArgs = { p_request_id_text: string; p_expected_actor_id: string }
export type HistoricalReadinessDomainCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH"
  | "INVALID_REQUEST" | "APPROVAL_NOT_FOUND" | "APPLY_RECEIPT_NOT_FOUND" | "APPROVAL_INTEGRITY_FAILURE"
  | "APPLY_RECEIPT_INTEGRITY_FAILURE" | "ROOT_ACCOUNTING_FAILURE" | "WRITE_PARITY_FAILURE" | "LIMIT_EXCEEDED"
export type HistoricalReadinessCode = HistoricalReadinessDomainCode | "PERSISTENCE_FAILURE"
type Failure<Code extends HistoricalReadinessCode> = Code extends string ? { ok: false; error: { code: Code; message: Code } } : never
export type HistoricalReadinessCounts = {
  applyGenerate: number; applySuppress: number; alreadyProjected: number; alreadySuppressed: number
  excludedNotActionable: number; manualReviewOwnerInvalid: number; manualReviewContextInvalid: number
  collisionManualReview: number; receiptGenerated: number; receiptSuppressed: number; plannedWrites: number
  receiptWrites: number; taskBacked: number; suppressed: number; intentionalNoWrite: number
  unresolvedManualReview: number; total: number
}
export type HistoricalReadinessDisposition = "apply/generate" | "apply/suppress" | "already/projected"
  | "already/suppressed" | "excluded/not-actionable" | "manual-review/owner-invalid"
  | "manual-review/context-invalid" | "collision/manual-review"
export type HistoricalReadinessOutcome = "generated" | "suppressed" | "already_projected" | "already_suppressed"
  | "excluded_not_actionable" | "manual_review_owner_invalid" | "manual_review_context_invalid" | "collision_manual_review"
export type HistoricalReadinessRow = {
  ordinal: number; sourceKind: "opportunity_assignment" | "quote_sent"; rootId: string
  disposition: HistoricalReadinessDisposition; outcome: HistoricalReadinessOutcome
  taskId: string | null; originKey: string | null; outcomeKey: string | null; tombstoneKey: string | null
}
export type HistoricalReadinessSuccess = {
  ok: true; requestId: string; approvalId: string; applyReceiptId: string; ready: boolean
  counts: HistoricalReadinessCounts; rows: HistoricalReadinessRow[]
}
export type HistoricalReadinessResult = HistoricalReadinessSuccess
  | { [Code in HistoricalReadinessCode]: Failure<Code> }[HistoricalReadinessCode]
type RpcResult = { data: unknown; error: unknown }
export type HistoricalReadinessDeps = {
  auth?: BootstrapAuthDeps
  createPersistenceClient?: () => Promise<unknown>
  invokeRpc?: (client: unknown, args: HistoricalReadinessRpcArgs) => Promise<RpcResult>
}

const failure = <Code extends HistoricalReadinessCode>(code: Code): Failure<Code> =>
  ({ ok: false, error: { code, message: code } }) as Failure<Code>
const DOMAIN_CODES = new Set<HistoricalReadinessDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN",
  "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "APPROVAL_NOT_FOUND", "APPLY_RECEIPT_NOT_FOUND",
  "APPROVAL_INTEGRITY_FAILURE", "APPLY_RECEIPT_INTEGRITY_FAILURE", "ROOT_ACCOUNTING_FAILURE",
  "WRITE_PARITY_FAILURE", "LIMIT_EXCEEDED"])
const SUCCESS_KEYS = ["ok", "request_id", "approval_id", "apply_receipt_id", "ready", "counts", "rows"] as const
const COUNT_KEYS = ["applyGenerate", "applySuppress", "alreadyProjected", "alreadySuppressed", "excludedNotActionable",
  "manualReviewOwnerInvalid", "manualReviewContextInvalid", "collisionManualReview", "receiptGenerated", "receiptSuppressed",
  "plannedWrites", "receiptWrites", "taskBacked", "suppressed", "intentionalNoWrite", "unresolvedManualReview", "total"] as const
const ROW_KEYS = ["ordinal", "sourceKind", "rootId", "disposition", "outcome", "taskId", "originKey", "outcomeKey", "tombstoneKey"] as const
const OUTCOME = { "apply/generate": "generated", "apply/suppress": "suppressed", "already/projected": "already_projected",
  "already/suppressed": "already_suppressed", "excluded/not-actionable": "excluded_not_actionable",
  "manual-review/owner-invalid": "manual_review_owner_invalid", "manual-review/context-invalid": "manual_review_context_invalid",
  "collision/manual-review": "collision_manual_review" } as const
const COUNT = { "apply/generate": "applyGenerate", "apply/suppress": "applySuppress", "already/projected": "alreadyProjected",
  "already/suppressed": "alreadySuppressed", "excluded/not-actionable": "excludedNotActionable",
  "manual-review/owner-invalid": "manualReviewOwnerInvalid", "manual-review/context-invalid": "manualReviewContextInvalid",
  "collision/manual-review": "collisionManualReview" } as const
const integer = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= CANONICAL_LIMITS.totalRows
const rpcResult = (value: unknown): RpcResult | null => {
  if (!value || typeof value !== "object" || isProxy(value)) return null
  try {
    const data = Object.getOwnPropertyDescriptor(value, "data"), error = Object.getOwnPropertyDescriptor(value, "error")
    return data && "value" in data && error && "value" in error ? { data: data.value, error: error.value } : null
  } catch { return null }
}

function decode(value: unknown, args: HistoricalReadinessRpcArgs): HistoricalReadinessResult {
  try { canonicalJson(value) } catch { return failure("PERSISTENCE_FAILURE") }
  if (hasExactKeys(value, ["ok", "error"]) && value.ok === false && hasExactKeys(value.error, ["code", "message"])
    && typeof value.error.code === "string" && value.error.code === value.error.message
    && DOMAIN_CODES.has(value.error.code as HistoricalReadinessDomainCode)) return failure(value.error.code as HistoricalReadinessDomainCode)
  if (!hasExactKeys(value, SUCCESS_KEYS) || value.ok !== true || value.request_id !== args.p_request_id_text
    || !isCanonicalUuid(value.approval_id) || !isCanonicalUuid(value.apply_receipt_id) || typeof value.ready !== "boolean"
    || !Array.isArray(value.rows) || value.rows.length > CANONICAL_LIMITS.totalRows) return failure("PERSISTENCE_FAILURE")
  const rawCounts = value.counts
  if (!hasExactKeys(rawCounts, COUNT_KEYS) || !COUNT_KEYS.every((key) => integer(rawCounts[key]))) return failure("PERSISTENCE_FAILURE")
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, rawCounts[key]])) as HistoricalReadinessCounts
  const rows: HistoricalReadinessRow[] = [], roots = new Set<string>()
  const observed: Record<keyof typeof OUTCOME, number> = Object.fromEntries(Object.keys(OUTCOME).map((key) => [key, 0])) as Record<keyof typeof OUTCOME, number>
  for (const [index, candidate] of value.rows.entries()) {
    if (!hasExactKeys(candidate, ROW_KEYS) || candidate.ordinal !== index
      || candidate.sourceKind !== "opportunity_assignment" && candidate.sourceKind !== "quote_sent"
      || !isCanonicalUuid(candidate.rootId) || typeof candidate.disposition !== "string" || !(candidate.disposition in OUTCOME)
      || candidate.outcome !== OUTCOME[candidate.disposition as keyof typeof OUTCOME]) return failure("PERSISTENCE_FAILURE")
    const disposition = candidate.disposition as keyof typeof OUTCOME, root = `${candidate.sourceKind}:${candidate.rootId}`
    if (roots.has(root)) return failure("PERSISTENCE_FAILURE"); roots.add(root); observed[disposition]++
    const taskBacked = disposition === "apply/generate" || disposition === "already/projected"
    const suppressed = disposition === "apply/suppress" || disposition === "already/suppressed"
    if (taskBacked ? !isCanonicalUuid(candidate.taskId) || !isCanonicalHash(candidate.originKey)
      || !isCanonicalHash(candidate.outcomeKey) || candidate.tombstoneKey !== null
      : suppressed ? candidate.taskId !== null || !isCanonicalHash(candidate.originKey)
        || !isCanonicalHash(candidate.outcomeKey) || !isCanonicalHash(candidate.tombstoneKey)
        : candidate.taskId !== null || candidate.originKey !== null || candidate.outcomeKey !== null || candidate.tombstoneKey !== null)
      return failure("PERSISTENCE_FAILURE")
    rows.push({ ordinal: index, sourceKind: candidate.sourceKind, rootId: candidate.rootId, disposition,
      outcome: OUTCOME[disposition], taskId: candidate.taskId as string | null, originKey: candidate.originKey as string | null,
      outcomeKey: candidate.outcomeKey as string | null, tombstoneKey: candidate.tombstoneKey as string | null })
  }
  if (Object.entries(COUNT).some(([disposition, key]) => observed[disposition as keyof typeof OUTCOME] !== counts[key])
    || counts.plannedWrites !== counts.applyGenerate + counts.applySuppress
    || counts.receiptGenerated !== counts.applyGenerate || counts.receiptSuppressed !== counts.applySuppress
    || counts.receiptWrites !== counts.receiptGenerated + counts.receiptSuppressed || counts.receiptWrites !== counts.plannedWrites
    || counts.taskBacked !== counts.applyGenerate + counts.alreadyProjected
    || counts.suppressed !== counts.applySuppress + counts.alreadySuppressed
    || counts.intentionalNoWrite !== counts.excludedNotActionable
    || counts.unresolvedManualReview !== counts.manualReviewOwnerInvalid + counts.manualReviewContextInvalid + counts.collisionManualReview
    || counts.total !== counts.taskBacked + counts.suppressed + counts.intentionalNoWrite + counts.unresolvedManualReview
    || counts.total !== rows.length || value.ready !== (counts.unresolvedManualReview === 0)) return failure("PERSISTENCE_FAILURE")
  return { ok: true, requestId: value.request_id, approvalId: value.approval_id, applyReceiptId: value.apply_receipt_id,
    ready: value.ready, counts, rows }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>
export async function readTaskAutomationHistoricalReadiness(input: unknown, deps: HistoricalReadinessDeps = {}): Promise<HistoricalReadinessResult> {
  let auth
  try { auth = await authorizeTaskAutomationHistoricalAdmin("PERSISTENCE_FAILURE", deps.auth) }
  catch { return failure("PERSISTENCE_FAILURE") }
  if (!auth.ok) return auth
  if (!hasExactKeys(input, ["requestId"]) || !isCanonicalUuid(input.requestId)) return failure("INVALID_REQUEST")
  const args = { p_request_id_text: input.requestId, p_expected_actor_id: auth.actorId }
  try {
    const client = await (deps.createPersistenceClient ?? createClient)()
    const response = rpcResult(await (deps.invokeRpc ?? ((value, rpcArgs) =>
      (value as ServerClient).rpc("read_task_automation_historical_readiness", rpcArgs) as unknown as Promise<RpcResult>))(client, args))
    return !response || response.error !== null ? failure("PERSISTENCE_FAILURE") : decode(response.data, args)
  } catch { return failure("PERSISTENCE_FAILURE") }
}
