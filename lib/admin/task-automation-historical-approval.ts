import "server-only"

import { createClient } from "@/lib/supabase/server"
import { authorizeTaskAutomationHistoricalAdmin, type BootstrapAuthDeps } from "./task-automation-historical-auth"
import { CANONICAL_LIMITS, DISPOSITIONS, DISPOSITION_REASONS, canonicalBytes, canonicalHash, canonicalJson, hasExactKeys,
  isCanonicalHash, isCanonicalTimestamp, isCanonicalUuid, isDispositionCounts, type DispositionCounts, type HistoricalAction,
  type HistoricalPlan, type HistoricalPlanRow, type OperationSourceKind, type SnapshotCutoffs, type SourceCutoffs } from "./task-automation-historical-contract"
import type { HistoricalPreviewResult } from "./task-automation-historical-preview"
import type { Json } from "../supabase/database.types"

export type HistoricalApprovalInput = { requestId: string; preview: Extract<HistoricalPreviewResult, { ok: true }> }
export type HistoricalApprovalProjection = {
  ordinal: number; action: HistoricalAction; operationSourceKind: OperationSourceKind; operationSourceId: string; sourceKey: string
  sourceOrder: number; originKey: string; taskId: string | null; taskKind: "first_contact" | "quote_follow_up" | null
  ownerId: string | null; opportunityId: string | null; quoteId: string | null; quoteVersionId: string | null
  sentEventId: string | null; anchorAt: string | null; dueRuleVersion: "mx-calendar.v1" | "elapsed-48h.v1" | null
  dueAt: string | null; outcomeKey: string; tombstoneKey: string | null
}
export type HistoricalApprovalDomainCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH"
  | "INVALID_REQUEST" | "INVALID_PREVIEW" | "INVALID_PLAN" | "INVALID_PROJECTION" | "LIMIT_EXCEEDED" | "HASH_MISMATCH"
  | "APPROVAL_IDEMPOTENCY_CONFLICT"
export type HistoricalApprovalCode = HistoricalApprovalDomainCode | "PERSISTENCE_FAILURE"
type Failure<Code extends HistoricalApprovalCode> = Code extends string ? { ok: false; error: { code: Code; message: Code } } : never
export type HistoricalApprovalSuccess = {
  ok: true; status: "success"; replayed: boolean; approvalId: string; requestId: string; actorId: string; actorRole: "admin"
  schema: "task-automation-historical-approval.v1"; previewSchema: "task-automation-historical-preview.v1"
  ruleVersion: "task-automation-historical.v1"; sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string
  plan: HistoricalPlan; planHash: string; projections: HistoricalApprovalProjection[]; projectionHash: string; requestFingerprint: string
  counts: DispositionCounts; totalCount: number; rowCount: number; generateCount: number; suppressCount: number; projectionCount: number
  planByteCount: number; projectionByteCount: number; requestByteCount: number; createdAt: string
}
export type HistoricalApprovalResult = HistoricalApprovalSuccess
  | { [Code in HistoricalApprovalCode]: Failure<Code> }[HistoricalApprovalCode]
export type HistoricalApprovalRpcArgs = {
  p_request_id_text: string; p_expected_actor_id: string; p_preview_schema: string; p_rule_version: string
  p_source_cutoffs: Json; p_snapshot_cutoffs: Json; p_snapshot_hash: string; p_plan_hash: string
  p_projection_hash: string; p_request_fingerprint: string; p_plan: Json; p_projections: Json
}
type RpcResult = { data: unknown; error: unknown }
export type HistoricalApprovalDeps = {
  auth?: BootstrapAuthDeps
  createPersistenceClient?: () => Promise<unknown>
  invokeRpc?: (client: unknown, args: HistoricalApprovalRpcArgs) => Promise<RpcResult>
}

const failure = <Code extends HistoricalApprovalCode>(code: Code): Failure<Code> =>
  ({ ok: false, error: { code, message: code } }) as Failure<Code>
const DOMAIN_CODES = new Set<HistoricalApprovalDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH",
  "INVALID_REQUEST", "INVALID_PREVIEW", "INVALID_PLAN", "INVALID_PROJECTION", "LIMIT_EXCEEDED", "HASH_MISMATCH", "APPROVAL_IDEMPOTENCY_CONFLICT"])
const ROW_KEYS = ["ordinal", "sourceKind", "rootId", "anchorAt", "sourceId", "ownerId", "opportunityId", "quoteId", "quoteVersionId",
  "sentEventId", "disposition", "reason", "action", "operationSourceKind", "operationSourceId", "sourceKey", "sourceOrder", "originKey",
  "taskId", "taskKind", "dueRuleVersion", "dueAt", "outcomeKey", "tombstoneKey"] as const
const PROJECTION_KEYS = ["ordinal", "action", "operationSourceKind", "operationSourceId", "sourceKey", "sourceOrder", "originKey",
  "taskId", "taskKind", "ownerId", "opportunityId", "quoteId", "quoteVersionId", "sentEventId", "anchorAt", "dueRuleVersion",
  "dueAt", "outcomeKey", "tombstoneKey"] as const
const SNAPSHOT_KEYS = ["opportunityRoots", "quoteVersionRoots", "assignmentEvidence", "quoteSourceEvidence", "taskOccupancy",
  "automationOrigins", "automationOutcomes", "automationTombstones"] as const
const SNAPSHOT_IDENTITY_VALIDATORS: Record<(typeof SNAPSHOT_KEYS)[number], (value: unknown) => boolean> = {
  opportunityRoots: isCanonicalUuid,
  quoteVersionRoots: isCanonicalUuid,
  assignmentEvidence: isCanonicalUuid,
  quoteSourceEvidence: isCanonicalUuid,
  taskOccupancy: isCanonicalUuid,
  automationOrigins: isCanonicalHash,
  automationOutcomes: isCanonicalHash,
  automationTombstones: isCanonicalHash,
}
const OPERATION_KINDS = new Set(["opportunity_assignment", "quote_sent", "opportunity_unassigned", "opportunity_archived",
  "opportunity_terminal", "quote_version_response", "quote_accepted", "quote_rejected", "quote_expired", "quote_cancelled",
  "quote_superseded", "whatsapp_inbound", "payment_verified"])
const nullable = (value: unknown, valid: (candidate: unknown) => boolean) => value === null || valid(value)
const integer = (value: unknown, maximum: number = CANONICAL_LIMITS.totalRows): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum
const same = (left: unknown, right: unknown) => canonicalJson(left) === canonicalJson(right)
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const nullableOrder = (left: string | null, right: string | null) => left === null ? right === null ? 0 : 1 : right === null ? -1 : compare(left, right)
const rowOrder = (left: HistoricalPlanRow, right: HistoricalPlanRow) => compare(left.sourceKind, right.sourceKind)
  || nullableOrder(left.anchorAt, right.anchorAt) || nullableOrder(left.sourceId, right.sourceId) || compare(left.rootId, right.rootId)

function validCutoffs(source: unknown, snapshot: unknown) {
  if (!hasExactKeys(source, ["opportunityAssignment", "quoteSent"]) || !isCanonicalTimestamp(source.opportunityAssignment)
    || !isCanonicalTimestamp(source.quoteSent) || !hasExactKeys(snapshot, SNAPSHOT_KEYS)) return false
  return SNAPSHOT_KEYS.every((key) => {
    const cursor = snapshot[key]
    if (cursor === null) return true
    if (!Array.isArray(cursor)) return false
    try { canonicalJson(cursor) } catch { return false }
    return cursor.length === 2 && isCanonicalTimestamp(cursor[0]) && SNAPSHOT_IDENTITY_VALIDATORS[key](cursor[1])
  })
}
function validRow(row: unknown): row is HistoricalPlanRow {
  if (!hasExactKeys(row, ROW_KEYS) || !integer(row.ordinal) || !["opportunity_assignment", "quote_sent"].includes(String(row.sourceKind))
    || !isCanonicalUuid(row.rootId) || !nullable(row.anchorAt, isCanonicalTimestamp)
    || [row.sourceId, row.ownerId, row.opportunityId, row.quoteId, row.quoteVersionId, row.sentEventId, row.operationSourceId, row.taskId]
      .some((value) => !nullable(value, isCanonicalUuid))
    || !DISPOSITIONS.includes(row.disposition as never) || !DISPOSITION_REASONS[row.disposition as keyof typeof DISPOSITION_REASONS]?.includes(row.reason as never)
    || !nullable(row.action, (value) => value === "generate" || value === "suppress")
    || !nullable(row.operationSourceKind, (value) => typeof value === "string" && OPERATION_KINDS.has(value))
    || row.sourceOrder !== null && (!Number.isInteger(row.sourceOrder) || Number(row.sourceOrder) < 1 || Number(row.sourceOrder) > 2_147_483_647)
    || [row.sourceKey, row.originKey, row.outcomeKey, row.tombstoneKey].some((value) => !nullable(value, isCanonicalHash))
    || !nullable(row.taskKind, (value) => value === "first_contact" || value === "quote_follow_up")
    || !nullable(row.dueRuleVersion, (value) => value === "mx-calendar.v1" || value === "elapsed-48h.v1") || !nullable(row.dueAt, isCanonicalTimestamp)) return false
  const action = row.disposition === "apply/generate" ? "generate" : row.disposition === "apply/suppress" ? "suppress" : null
  if (row.action !== action) return false
  const kind = row.disposition === "apply/generate" || row.disposition === "already/projected" ? "generate"
    : row.disposition === "apply/suppress" || row.disposition === "already/suppressed" ? "suppress" : null
  if (kind === null) return [row.operationSourceKind, row.operationSourceId, row.sourceKey, row.sourceOrder, row.originKey, row.taskId,
    row.taskKind, row.dueRuleVersion, row.dueAt, row.outcomeKey, row.tombstoneKey].every((value) => value === null)
  if (!row.operationSourceKind || !row.operationSourceId || !row.sourceKey || !row.sourceOrder || !row.originKey || !row.outcomeKey) return false
  return kind === "generate" ? !!row.taskId && !!row.taskKind && !!row.ownerId && !!row.anchorAt && !!row.dueRuleVersion && !!row.dueAt && row.tombstoneKey === null
    : row.taskId === null && row.taskKind === null && row.dueRuleVersion === null && row.dueAt === null && !!row.tombstoneKey
}
function normalize(input: unknown, actorId: string): Failure<HistoricalApprovalCode> | { args: HistoricalApprovalRpcArgs; counts: DispositionCounts;
  projections: HistoricalApprovalProjection[]; planByteCount: number; projectionByteCount: number; requestByteCount: number } {
  if (!hasExactKeys(input, ["requestId", "preview"]) || !isCanonicalUuid(input.requestId)) return failure("INVALID_REQUEST")
  const preview = input.preview
  try { canonicalJson(preview) } catch { return failure("INVALID_PREVIEW") }
  if (!hasExactKeys(preview, ["ok", "schema", "ruleVersion", "sourceCutoffs", "snapshotCutoffs", "snapshotHash", "plan", "planHash",
    "counts", "totalCount", "diagnostics"]) || preview.ok !== true || preview.schema !== "task-automation-historical-preview.v1"
    || preview.ruleVersion !== "task-automation-historical.v1" || !validCutoffs(preview.sourceCutoffs, preview.snapshotCutoffs)
    || !isCanonicalHash(preview.snapshotHash) || !isCanonicalHash(preview.planHash) || !isDispositionCounts(preview.counts)
    || !integer(preview.totalCount) || !hasExactKeys(preview.diagnostics, ["passes", "logicalReads", "physicalAttempts", "opportunityRootCount", "quoteVersionRootCount"])
    || !integer(preview.diagnostics.passes, 4) || !integer(preview.diagnostics.logicalReads, 8) || !integer(preview.diagnostics.physicalAttempts, Number.MAX_SAFE_INTEGER)
    || preview.diagnostics.physicalAttempts < preview.diagnostics.logicalReads || !integer(preview.diagnostics.opportunityRootCount, CANONICAL_LIMITS.rootsPerFamily)
    || !integer(preview.diagnostics.quoteVersionRootCount, CANONICAL_LIMITS.rootsPerFamily)
    || preview.diagnostics.opportunityRootCount + preview.diagnostics.quoteVersionRootCount !== preview.totalCount) return failure("INVALID_PREVIEW")
  const sourceCutoffs = preview.sourceCutoffs as SourceCutoffs, snapshotCutoffs = preview.snapshotCutoffs as SnapshotCutoffs
  const counts = preview.counts as DispositionCounts
  const plan = preview.plan
  if (!hasExactKeys(plan, ["schema", "ruleVersion", "sourceCutoffs", "snapshotCutoffs", "snapshotHash", "rows", "counts", "totalCount"])
    || plan.schema !== "task-automation-historical-plan.v1" || plan.ruleVersion !== preview.ruleVersion || !Array.isArray(plan.rows)
    || !same(plan.sourceCutoffs, preview.sourceCutoffs) || !same(plan.snapshotCutoffs, preview.snapshotCutoffs) || plan.snapshotHash !== preview.snapshotHash
    || !isDispositionCounts(plan.counts) || !same(plan.counts, counts) || plan.totalCount !== preview.totalCount || plan.rows.length !== preview.totalCount) return failure("INVALID_PLAN")
  const tallies = Array(8).fill(0), families = [0, 0], rows: HistoricalPlanRow[] = []
  for (let index = 0; index < plan.rows.length; index++) {
    const row = plan.rows[index]
    if (!validRow(row) || row.ordinal !== index || index > 0 && rowOrder(rows[index - 1], row) >= 0) return failure("INVALID_PLAN")
    rows.push(row); tallies[DISPOSITIONS.indexOf(row.disposition)]++; families[row.sourceKind === "opportunity_assignment" ? 0 : 1]++
  }
  if (!tallies.every((count, index) => count === counts[index]) || families[0] !== preview.diagnostics.opportunityRootCount
    || families[1] !== preview.diagnostics.quoteVersionRootCount) return failure("INVALID_PLAN")
  const projections = rows.filter((row) => row.action !== null).map((row) =>
    Object.fromEntries(PROJECTION_KEYS.map((key) => [key, row[key]])) as HistoricalApprovalProjection)
  try {
    const emptyPlan = { ...plan, rows: [] }, planByteCount = canonicalBytes(plan).byteLength
    if (rows.some((row) => canonicalBytes(row).byteLength > CANONICAL_LIMITS.rowBytes)
      || canonicalBytes(emptyPlan).byteLength > CANONICAL_LIMITS.emptyPlanBytes || planByteCount > CANONICAL_LIMITS.planBytes
      || projections.some((projection) => canonicalBytes(projection).byteLength > CANONICAL_LIMITS.rowBytes)) return failure("LIMIT_EXCEEDED")
    const projectionByteCount = canonicalBytes(projections).byteLength
    if (projectionByteCount > CANONICAL_LIMITS.planBytes) return failure("LIMIT_EXCEEDED")
    const projectionHash = canonicalHash(projections)
    if (preview.planHash !== canonicalHash(plan)) return failure("HASH_MISMATCH")
    const requestPreimage = ["task-automation-historical-approval-request.v1", input.requestId, actorId, "admin", preview.schema,
      preview.ruleVersion, sourceCutoffs, snapshotCutoffs, preview.snapshotHash, preview.planHash, projectionHash, plan, projections]
    const requestByteCount = canonicalBytes(requestPreimage).byteLength
    if (requestByteCount > CANONICAL_LIMITS.snapshotBytes) return failure("LIMIT_EXCEEDED")
    return { args: { p_request_id_text: input.requestId, p_expected_actor_id: actorId, p_preview_schema: preview.schema,
      p_rule_version: preview.ruleVersion, p_source_cutoffs: sourceCutoffs as unknown as Json, p_snapshot_cutoffs: snapshotCutoffs as unknown as Json,
      p_snapshot_hash: preview.snapshotHash, p_plan_hash: preview.planHash, p_projection_hash: projectionHash,
      p_request_fingerprint: canonicalHash(requestPreimage), p_plan: plan as unknown as Json, p_projections: projections as unknown as Json }, counts,
      projections, planByteCount, projectionByteCount, requestByteCount }
  } catch { return failure("INVALID_PLAN") }
}

const SUCCESS_KEYS = ["ok", "status", "id", "request_id", "actor_id", "actor_role", "schema_version", "preview_schema", "rule_version",
  "source_cutoffs", "snapshot_cutoffs", "snapshot_hash", "plan", "plan_hash", "projections", "projection_hash", "request_fingerprint",
  "approval_fingerprint", "apply_generate_count", "apply_suppress_count", "already_projected_count", "already_suppressed_count",
  "excluded_not_actionable_count", "manual_review_owner_invalid_count", "manual_review_context_invalid_count", "collision_manual_review_count",
  "total_count", "row_count", "generate_count", "suppress_count", "projection_count", "plan_byte_count", "projection_byte_count",
  "request_byte_count", "created_at"] as const
function decode(value: unknown, normalized: Exclude<ReturnType<typeof normalize>, { ok: false }>): HistoricalApprovalResult {
  if (hasExactKeys(value, ["ok", "error"]) && value.ok === false && hasExactKeys(value.error, ["code", "message"])
    && typeof value.error.code === "string" && value.error.code === value.error.message && DOMAIN_CODES.has(value.error.code as HistoricalApprovalDomainCode))
    return failure(value.error.code as HistoricalApprovalDomainCode)
  if (!hasExactKeys(value, SUCCESS_KEYS) || value.ok !== true || value.status !== "approved" && value.status !== "replayed"
    || !isCanonicalUuid(value.id) || value.request_id !== normalized.args.p_request_id_text || value.actor_id !== normalized.args.p_expected_actor_id
    || value.actor_role !== "admin" || value.schema_version !== "task-automation-historical-approval.v1"
    || value.preview_schema !== normalized.args.p_preview_schema || value.rule_version !== normalized.args.p_rule_version
    || !isCanonicalHash(value.snapshot_hash) || !isCanonicalHash(value.plan_hash) || !isCanonicalHash(value.projection_hash)
    || !isCanonicalHash(value.request_fingerprint) || !isCanonicalHash(value.approval_fingerprint) || !isCanonicalTimestamp(value.created_at)) return failure("PERSISTENCE_FAILURE")
  const counts = [value.apply_generate_count, value.apply_suppress_count, value.already_projected_count, value.already_suppressed_count,
    value.excluded_not_actionable_count, value.manual_review_owner_invalid_count, value.manual_review_context_invalid_count,
    value.collision_manual_review_count] as DispositionCounts
  if (!isDispositionCounts(counts) || !same(counts, normalized.counts) || !same(value.source_cutoffs, normalized.args.p_source_cutoffs)
    || !same(value.snapshot_cutoffs, normalized.args.p_snapshot_cutoffs) || value.snapshot_hash !== normalized.args.p_snapshot_hash
    || !same(value.plan, normalized.args.p_plan) || value.plan_hash !== normalized.args.p_plan_hash
    || !same(value.projections, normalized.projections) || value.projection_hash !== normalized.args.p_projection_hash
    || value.request_fingerprint !== normalized.args.p_request_fingerprint || value.total_count !== (normalized.args.p_plan as unknown as HistoricalPlan).totalCount
    || value.row_count !== (normalized.args.p_plan as unknown as HistoricalPlan).rows.length || value.generate_count !== normalized.counts[0]
    || value.suppress_count !== normalized.counts[1] || value.projection_count !== normalized.projections.length
    || value.plan_byte_count !== normalized.planByteCount || value.projection_byte_count !== normalized.projectionByteCount
    || value.request_byte_count !== normalized.requestByteCount) return failure("PERSISTENCE_FAILURE")
  const fingerprint = canonicalHash(["task-automation-historical-approval-fingerprint.v1", value.id, value.request_id, value.actor_id,
    value.actor_role, value.schema_version, value.preview_schema, value.rule_version, value.source_cutoffs, value.snapshot_cutoffs,
    value.snapshot_hash, value.plan_hash, value.projection_hash, value.request_fingerprint, value.plan, value.projections, counts,
    value.total_count, value.row_count, value.generate_count, value.suppress_count, value.projection_count, value.plan_byte_count,
    value.projection_byte_count, value.request_byte_count, value.created_at])
  if (fingerprint !== value.approval_fingerprint) return failure("PERSISTENCE_FAILURE")
  return { ok: true, status: "success", replayed: value.status === "replayed", approvalId: value.id, requestId: value.request_id,
    actorId: value.actor_id, actorRole: "admin", schema: "task-automation-historical-approval.v1", previewSchema: "task-automation-historical-preview.v1",
    ruleVersion: "task-automation-historical.v1", sourceCutoffs: value.source_cutoffs as SourceCutoffs, snapshotCutoffs: value.snapshot_cutoffs as SnapshotCutoffs,
    snapshotHash: value.snapshot_hash, plan: value.plan as HistoricalPlan, planHash: value.plan_hash,
    projections: value.projections as HistoricalApprovalProjection[], projectionHash: value.projection_hash,
    requestFingerprint: value.request_fingerprint, counts, totalCount: value.total_count as number, rowCount: value.row_count as number,
    generateCount: value.generate_count as number, suppressCount: value.suppress_count as number, projectionCount: value.projection_count as number,
    planByteCount: value.plan_byte_count as number, projectionByteCount: value.projection_byte_count as number,
    requestByteCount: value.request_byte_count as number, createdAt: value.created_at }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>
export async function approveTaskAutomationHistoricalPlan(input: unknown, deps: HistoricalApprovalDeps = {}): Promise<HistoricalApprovalResult> {
  let auth
  try { auth = await authorizeTaskAutomationHistoricalAdmin("PERSISTENCE_FAILURE", deps.auth) }
  catch { return failure("PERSISTENCE_FAILURE") }
  if (!auth.ok) return auth
  const normalized = normalize(input, auth.actorId)
  if ("error" in normalized) return normalized
  try {
    const client = await (deps.createPersistenceClient ?? createClient)()
    const result = await (deps.invokeRpc ?? ((value, args) =>
      (value as ServerClient).rpc("approve_task_automation_historical_plan", args) as unknown as Promise<RpcResult>))(client, normalized.args)
    return !result || result.error !== null ? failure("PERSISTENCE_FAILURE") : decode(result.data, normalized)
  } catch { return failure("PERSISTENCE_FAILURE") }
}
