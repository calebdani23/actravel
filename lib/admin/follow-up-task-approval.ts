import "server-only"
import { createHash } from "node:crypto"
import { requireAdminRole } from "@/lib/admin/auth"
import { createClient } from "@/lib/supabase/server"
import { canonicalJson, type FutureFollowUpTask, type PreviewRow } from "@/lib/admin/follow-up-backfill-preview"
import type { ReaderResult } from "@/lib/admin/follow-up-backfill-preview-reader"

export type ApprovalInput = { requestId: string; preview: Extract<ReaderResult, { ok: true }> }
export type ApprovalDomainCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST" | "INVALID_CUTOFF" | "INVALID_PLAN" | "INVALID_PROJECTION" | "LIMIT_EXCEEDED" | "HASH_MISMATCH" | "APPROVAL_IDEMPOTENCY_CONFLICT"
export type ApprovalErrorCode = ApprovalDomainCode | "PERSISTENCE_FAILURE"
export type ApproveRpcArgs = {
  p_request_id_text: string; p_expected_actor_id: string; p_schema_version: string; p_rule_version: string
  p_event_cutoff_created_at: string; p_event_cutoff_id: string; p_task_cutoff_created_at: string | null; p_task_cutoff_id: string | null
  p_reader_snapshot_hash: string; p_canonical_plan_hash: string; p_projection_hash: string; p_request_fingerprint: string
  p_canonical_plan: string; p_eligible_projections: unknown[]
}
export type ApprovalFailure = { ok: false; error: { code: ApprovalErrorCode; message: ApprovalErrorCode } }
export type ApprovalSuccess = {
  ok: true; status: "success"; replayed: boolean; approvalId: string; requestId: string; actorId: string; actorRole: "admin"
  schemaVersion: string; ruleVersion: string; eventCutoffCreatedAt: string; eventCutoffId: string
  taskCutoffCreatedAt: string | null; taskCutoffId: string | null; readerSnapshotHash: string; canonicalPlanHash: string
  requestFingerprint: string; projectionHash: string; canonicalPlan: string; eligibleProjections: unknown[]
  eligibleCount: number; invalidDateNoTaskCount: number; manualReviewUnassignedOwnerCount: number
  excludedLeadNotOperationalCount: number; excludedNonSelectedHistoryCount: number; alreadyConvertedCount: number
  collisionManualReviewCount: number; totalCount: number; rowCount: number; projectionCount: number
  canonicalPlanByteCount: number; projectionByteCount: number; requestByteCount: number; createdAt: string
}
export type ApprovalResult = ApprovalSuccess | ApprovalFailure
type RpcApprovalSuccess = {
  ok: true; status: "approved" | "replayed"
  id: string; request_id: string; actor_id: string; actor_role: "admin"; schema_version: string; rule_version: string
  event_cutoff_created_at: string; event_cutoff_id: string; task_cutoff_created_at: string | null; task_cutoff_id: string | null
  reader_snapshot_hash: string; canonical_plan_hash: string; request_fingerprint: string; approval_fingerprint: string; projection_hash: string
  canonical_plan: string; eligible_projections: unknown[]
  eligible_count: number; invalid_date_no_task_count: number; manual_review_unassigned_owner_count: number
  excluded_lead_not_operational_count: number; excluded_non_selected_history_count: number; already_converted_count: number
  collision_manual_review_count: number; total_count: number; row_count: number; projection_count: number
  canonical_plan_byte_count: number; projection_byte_count: number; request_byte_count: number; created_at: string
}
type RpcApprovalFailure = { ok: false; error: { code: ApprovalErrorCode; message: ApprovalErrorCode } }
type RpcApprovalResult = RpcApprovalSuccess | RpcApprovalFailure
export type ApprovalDeps = {
  requireAdminRole?: typeof requireAdminRole
  createClient?: typeof createClient
  invokeRpc?: (client: Awaited<ReturnType<typeof createClient>>, args: ApproveRpcArgs) => Promise<{ data: unknown; error: null | { code?: string; message?: string } }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const fields = ["id", "request_id", "actor_id", "actor_role", "schema_version", "rule_version", "event_cutoff_created_at", "event_cutoff_id", "task_cutoff_created_at", "task_cutoff_id", "reader_snapshot_hash", "canonical_plan_hash", "request_fingerprint", "approval_fingerprint", "projection_hash", "canonical_plan", "eligible_projections", "eligible_count", "invalid_date_no_task_count", "manual_review_unassigned_owner_count", "excluded_lead_not_operational_count", "excluded_non_selected_history_count", "already_converted_count", "collision_manual_review_count", "total_count", "row_count", "projection_count", "canonical_plan_byte_count", "projection_byte_count", "request_byte_count", "created_at"] as const
const countFields = ["eligible_count", "invalid_date_no_task_count", "manual_review_unassigned_owner_count", "excluded_lead_not_operational_count", "excluded_non_selected_history_count", "already_converted_count", "collision_manual_review_count", "total_count", "row_count", "projection_count", "canonical_plan_byte_count", "projection_byte_count", "request_byte_count"]
const failure = (code: ApprovalErrorCode): ApprovalFailure => ({ ok: false, error: { code, message: code } })
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
const hash = (value: string) => createHash("sha256").update(new TextEncoder().encode(value)).digest("hex")

function projection(rows: PreviewRow[]): FutureFollowUpTask[] {
  return rows.flatMap((row) => {
    if (row[7] !== "eligible" || !row[2] || !row[4] || row[5] === null || !row[6]) return []
    const sourceId = row[0].toLowerCase(), ownerId = row[2], leadId = row[1], due = row[4]
    return [{ owner_id: ownerId, lead_id: leadId, quote_id: null, description: "Follow up with lead", due_at: due, status: "pending", idempotency_key: hash(`follow-up-task:v1|source_event_id=${sourceId}`), task_kind: "follow_up", source_event_id: sourceId, source_event_type: "follow_up_registered", source_event_created_at: row[3], source_due_at: due, source_payload: { followUpAt: row[6], hasNote: row[5] }, metadata: { schema: "follow_up_task.v1", source_event_id: sourceId, source_event_type: "follow_up_registered", owner_id: ownerId.toLowerCase(), lead_id: leadId.toLowerCase() }}]
  })
}

const domainCodes = new Set<ApprovalErrorCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "INVALID_CUTOFF", "INVALID_PLAN", "INVALID_PROJECTION", "LIMIT_EXCEEDED", "HASH_MISMATCH", "APPROVAL_IDEMPOTENCY_CONFLICT", "PERSISTENCE_FAILURE"])
function isRpcSuccess(value: unknown): value is RpcApprovalSuccess {
  if (!object(value) || !exact(value, ["ok", "status", ...fields]) || value.ok !== true || (value.status !== "approved" && value.status !== "replayed")) return false
  if (typeof value.id !== "string" || typeof value.request_id !== "string" || typeof value.actor_id !== "string" || value.actor_role !== "admin" || typeof value.schema_version !== "string" || typeof value.rule_version !== "string" || typeof value.event_cutoff_created_at !== "string" || typeof value.event_cutoff_id !== "string" || typeof value.task_cutoff_created_at !== "string" && value.task_cutoff_created_at !== null || typeof value.task_cutoff_id !== "string" && value.task_cutoff_id !== null || (value.task_cutoff_created_at === null) !== (value.task_cutoff_id === null) || ["reader_snapshot_hash", "canonical_plan_hash", "request_fingerprint", "approval_fingerprint", "projection_hash"].some((key) => typeof value[key] !== "string" || !HASH.test(value[key] as string)) || typeof value.canonical_plan !== "string" || typeof value.created_at !== "string" || !Array.isArray(value.eligible_projections) || countFields.some((key) => typeof value[key] !== "number" || !Number.isInteger(value[key]))) return false
  return true
}
function isRpcFailure(value: unknown): value is RpcApprovalFailure {
  if (!object(value) || !exact(value, ["ok", "error"]) || value.ok !== false || !object(value.error) || !exact(value.error, ["code", "message"]) || value.error.code !== value.error.message || typeof value.error.code !== "string") return false
  return domainCodes.has(value.error.code as ApprovalErrorCode)
}
function decode(data: unknown): ApprovalResult {
  if (isRpcFailure(data)) return failure(data.error.code)
  if (!isRpcSuccess(data)) return failure("PERSISTENCE_FAILURE")
  const prefix = data.status === "replayed"
  const value = data
  return { ok: true, status: "success", replayed: prefix, approvalId: value.id, requestId: value.request_id, actorId: value.actor_id, actorRole: "admin", schemaVersion: value.schema_version, ruleVersion: value.rule_version, eventCutoffCreatedAt: value.event_cutoff_created_at, eventCutoffId: value.event_cutoff_id, taskCutoffCreatedAt: value.task_cutoff_created_at, taskCutoffId: value.task_cutoff_id, readerSnapshotHash: value.reader_snapshot_hash, canonicalPlanHash: value.canonical_plan_hash, requestFingerprint: value.request_fingerprint, projectionHash: value.projection_hash, canonicalPlan: value.canonical_plan, eligibleProjections: value.eligible_projections, eligibleCount: value.eligible_count, invalidDateNoTaskCount: value.invalid_date_no_task_count, manualReviewUnassignedOwnerCount: value.manual_review_unassigned_owner_count, excludedLeadNotOperationalCount: value.excluded_lead_not_operational_count, excludedNonSelectedHistoryCount: value.excluded_non_selected_history_count, alreadyConvertedCount: value.already_converted_count, collisionManualReviewCount: value.collision_manual_review_count, totalCount: value.total_count, rowCount: value.row_count, projectionCount: value.projection_count, canonicalPlanByteCount: value.canonical_plan_byte_count, projectionByteCount: value.projection_byte_count, requestByteCount: value.request_byte_count, createdAt: value.created_at }
}

export async function approveFollowUpTask(input: ApprovalInput, deps: ApprovalDeps = {}): Promise<ApprovalResult> {
  const session = await (deps.requireAdminRole ?? requireAdminRole)(["admin"])
  try {
    if (!object(input) || typeof input.requestId !== "string" || !UUID.test(input.requestId) || !object(input.preview) || input.preview.ok !== true) return failure("INVALID_REQUEST")
    const actorId = session.user.id
    if (typeof actorId !== "string" || !UUID.test(actorId)) return failure("INVALID_REQUEST")
    const preview = input.preview, plan = canonicalJson(preview.plan), projections = projection(preview.plan[3])
    const projectionText = canonicalJson(projections), planHash = hash(plan), projectionHash = hash(projectionText)
    const request = canonicalJson(["follow-up-approval-request.v1", input.requestId, actorId, "follow-up-approval.v1", "follow-up-backfill.v1", [preview.eventCutoff.createdAt, preview.eventCutoff.id], preview.taskCutoff ? [preview.taskCutoff.createdAt, preview.taskCutoff.id] : null, preview.readerSnapshotHash, planHash, projectionHash, preview.plan, projections])
    const args: ApproveRpcArgs = { p_request_id_text: input.requestId, p_expected_actor_id: actorId, p_schema_version: "follow-up-approval.v1", p_rule_version: "follow-up-backfill.v1", p_event_cutoff_created_at: preview.eventCutoff.createdAt, p_event_cutoff_id: preview.eventCutoff.id, p_task_cutoff_created_at: preview.taskCutoff?.createdAt ?? null, p_task_cutoff_id: preview.taskCutoff?.id ?? null, p_reader_snapshot_hash: preview.readerSnapshotHash, p_canonical_plan_hash: planHash, p_projection_hash: projectionHash, p_request_fingerprint: hash(request), p_canonical_plan: plan, p_eligible_projections: projections }
    const client = await (deps.createClient ?? createClient)(), result = await (deps.invokeRpc ?? ((c, a) => c.rpc("approve_follow_up_task_plan", a) as unknown as Promise<{ data: unknown; error: null | { code?: string; message?: string } }>))(client, args)
    return result.error ? failure("PERSISTENCE_FAILURE") : decode(result.data as RpcApprovalResult)
  } catch { return failure("PERSISTENCE_FAILURE") }
}
