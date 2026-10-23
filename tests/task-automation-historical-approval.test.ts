import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { approveTaskAutomationHistoricalPlan, type HistoricalApprovalRpcArgs } from "../lib/admin/task-automation-historical-approval"
import { canonicalHash, canonicalJson, type HistoricalPlanRow, type SnapshotCutoffs, type SourceCutoffs } from "../lib/admin/task-automation-historical-contract"

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const actorId = id(1), requestId = id(2), approvalId = id(3), at = "2026-01-02T12:00:00.000000Z"
const sourceCutoffs: SourceCutoffs = { opportunityAssignment: "2026-09-01T00:00:00.000000Z", quoteSent: "2026-09-01T00:00:00.000000Z" }
const snapshotCutoffs: SnapshotCutoffs = { opportunityRoots: [at, id(30)], quoteVersionRoots: null, assignmentEvidence: [at, id(31)],
  quoteSourceEvidence: null, taskOccupancy: null, automationOrigins: null, automationOutcomes: null, automationTombstones: null }
const emptyRow = (ordinal: number): HistoricalPlanRow => ({ ordinal, sourceKind: "opportunity_assignment", rootId: id(10 + ordinal),
  anchorAt: null, sourceId: null, ownerId: null, opportunityId: id(10 + ordinal), quoteId: null, quoteVersionId: null,
  sentEventId: null, disposition: "excluded/not-actionable", reason: "OPPORTUNITY_NOT_OPERATIONAL", action: null,
  operationSourceKind: null, operationSourceId: null, sourceKey: null, sourceOrder: null, originKey: null, taskId: null,
  taskKind: null, dueRuleVersion: null, dueAt: null, outcomeKey: null, tombstoneKey: null })
const rows: HistoricalPlanRow[] = [
  { ...emptyRow(0), anchorAt: at, sourceId: id(10), ownerId: id(20), disposition: "apply/generate", reason: "ELIGIBLE_GENERATE",
    action: "generate", operationSourceKind: "opportunity_assignment", operationSourceId: id(10), sourceKey: "a".repeat(64),
    sourceOrder: 1, originKey: "b".repeat(64), taskId: id(40), taskKind: "first_contact", dueRuleVersion: "mx-calendar.v1",
    dueAt: "2026-01-02T12:15:00.000000Z", outcomeKey: "c".repeat(64) },
  { ...emptyRow(1), anchorAt: "2026-01-02T13:00:00.000000Z", sourceId: id(11), disposition: "apply/suppress", reason: "SOURCE_INVALIDATED",
    action: "suppress", operationSourceKind: "opportunity_unassigned", operationSourceId: id(41), sourceKey: "d".repeat(64),
    sourceOrder: 2, originKey: "e".repeat(64), outcomeKey: "f".repeat(64), tombstoneKey: "9".repeat(64) },
  emptyRow(2),
]
const counts = [1, 1, 0, 0, 1, 0, 0, 0] as const
const plan = { schema: "task-automation-historical-plan.v1" as const, ruleVersion: "task-automation-historical.v1" as const,
  sourceCutoffs, snapshotCutoffs, snapshotHash: "8".repeat(64), rows, counts, totalCount: 3 }
const preview = { ok: true as const, schema: "task-automation-historical-preview.v1" as const, ruleVersion: "task-automation-historical.v1" as const,
  sourceCutoffs, snapshotCutoffs, snapshotHash: plan.snapshotHash, plan, planHash: canonicalHash(plan), counts, totalCount: 3,
  diagnostics: { passes: 2, logicalReads: 4, physicalAttempts: 4, opportunityRootCount: 3, quoteVersionRootCount: 0 } }
const cursor = (identity: string): readonly [string, string] => [at, identity]
const exactSnapshotCutoffs: SnapshotCutoffs = { opportunityRoots: cursor(id(30)), quoteVersionRoots: cursor(id(31)),
  assignmentEvidence: cursor(id(32)), quoteSourceEvidence: cursor(id(33)), taskOccupancy: cursor(id(34)),
  automationOrigins: cursor("1".repeat(64)), automationOutcomes: cursor("2".repeat(64)),
  automationTombstones: cursor("3".repeat(64)) }
const previewWithSnapshotCutoffs = (value: SnapshotCutoffs) => {
  const updatedPlan = { ...plan, snapshotCutoffs: value }
  return { ...preview, snapshotCutoffs: value, plan: updatedPlan, planHash: canonicalHash(updatedPlan) }
}
const projectionKeys = ["ordinal", "action", "operationSourceKind", "operationSourceId", "sourceKey", "sourceOrder", "originKey",
  "taskId", "taskKind", "ownerId", "opportunityId", "quoteId", "quoteVersionId", "sentEventId", "anchorAt", "dueRuleVersion",
  "dueAt", "outcomeKey", "tombstoneKey"] as const
const projections = rows.slice(0, 2).map((row) => Object.fromEntries(projectionKeys.map((key) => [key, row[key]])))
const bytes = (value: unknown) => Buffer.byteLength(canonicalJson(value), "utf8")
const auth = (events?: string[]) => ({ createAuthClient: async () => { events?.push("auth"); return {} },
  getUser: async () => ({ data: { user: { id: actorId } }, error: null }),
  readProfile: async () => ({ data: { id: actorId, is_active: true }, error: null }),
  readRoles: async () => ({ data: [{ roles: { name: "admin" } }], error: null }) })
function rpcSuccess(args: HistoricalApprovalRpcArgs, status: "approved" | "replayed" = "approved") {
  const created_at = "2026-09-26T12:00:00.000000Z"
  const base = { ok: true as const, status, id: approvalId, request_id: requestId, actor_id: actorId, actor_role: "admin" as const,
    schema_version: "task-automation-historical-approval.v1", preview_schema: preview.schema, rule_version: preview.ruleVersion,
    source_cutoffs: sourceCutoffs, snapshot_cutoffs: snapshotCutoffs, snapshot_hash: preview.snapshotHash, plan, plan_hash: args.p_plan_hash,
    projections, projection_hash: args.p_projection_hash, request_fingerprint: args.p_request_fingerprint, approval_fingerprint: "",
    apply_generate_count: 1, apply_suppress_count: 1, already_projected_count: 0, already_suppressed_count: 0,
    excluded_not_actionable_count: 1, manual_review_owner_invalid_count: 0, manual_review_context_invalid_count: 0,
    collision_manual_review_count: 0, total_count: 3, row_count: 3, generate_count: 1, suppress_count: 1, projection_count: 2,
    plan_byte_count: bytes(plan), projection_byte_count: bytes(projections), request_byte_count: bytes(["task-automation-historical-approval-request.v1",
      requestId, actorId, "admin", preview.schema, preview.ruleVersion, sourceCutoffs, snapshotCutoffs, preview.snapshotHash,
      args.p_plan_hash, args.p_projection_hash, plan, projections]), created_at }
  base.approval_fingerprint = canonicalHash(["task-automation-historical-approval-fingerprint.v1", base.id, base.request_id,
    base.actor_id, base.actor_role, base.schema_version, base.preview_schema, base.rule_version, base.source_cutoffs,
    base.snapshot_cutoffs, base.snapshot_hash, base.plan_hash, base.projection_hash, base.request_fingerprint, base.plan,
    base.projections, counts, base.total_count, base.row_count, base.generate_count, base.suppress_count, base.projection_count,
    base.plan_byte_count, base.projection_byte_count, base.request_byte_count, base.created_at])
  return base
}

test("0083 exposes only the exact authenticated approval RPC", () => {
  const path = "db/migrations/0083_task_automation_historical_approval_rpc.sql"
  assert.equal(existsSync(path), true)
  const source = readFileSync(path, "utf8")
  assert.match(source, /approve_task_automation_historical_plan\(p_request_id_text text,p_expected_actor_id uuid,p_preview_schema text,p_rule_version text,p_source_cutoffs jsonb,p_snapshot_cutoffs jsonb,p_snapshot_hash text,p_plan_hash text,p_projection_hash text,p_request_fingerprint text,p_plan jsonb,p_projections jsonb\) returns jsonb/i)
  assert.match(source, /security definer set search_path\s*=\s*''/i)
  assert.match(source, /revoke all on function public\.approve_task_automation_historical_plan\(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb\) from public,anon,authenticated,service_role/i)
  assert.match(source, /grant execute on function public\.approve_task_automation_historical_plan\(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb\) to authenticated/i)
  assert.doesNotMatch(source, /\b(leads|lead_events|quotes|quote_versions|quote_events|tasks|task_automation_origins|task_automation_outcomes|task_automation_tombstones)\b/i)
})

test("approval adapter authenticates first and sends exact derived projections and equations", async () => {
  const events: string[] = []; let seen: HistoricalApprovalRpcArgs | undefined
  const result = await approveTaskAutomationHistoricalPlan({ requestId, preview }, { auth: auth(events),
    createPersistenceClient: async () => { events.push("persistence"); return {} },
    invokeRpc: async (_client, args) => { events.push("rpc"); seen = args; return { data: rpcSuccess(args), error: null } } })
  assert.deepEqual(events, ["auth", "persistence", "rpc"])
  const requestPreimage = ["task-automation-historical-approval-request.v1", requestId, actorId, "admin", preview.schema,
    preview.ruleVersion, sourceCutoffs, snapshotCutoffs, preview.snapshotHash, preview.planHash, canonicalHash(projections), plan, projections]
  assert.deepEqual(seen, { p_request_id_text: requestId, p_expected_actor_id: actorId, p_preview_schema: preview.schema,
    p_rule_version: preview.ruleVersion, p_source_cutoffs: sourceCutoffs, p_snapshot_cutoffs: snapshotCutoffs,
    p_snapshot_hash: preview.snapshotHash, p_plan_hash: preview.planHash, p_projection_hash: canonicalHash(projections),
    p_request_fingerprint: canonicalHash(requestPreimage), p_plan: plan, p_projections: projections })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(Object.keys(result), ["ok", "status", "replayed", "approvalId", "requestId", "actorId", "actorRole", "schema",
    "previewSchema", "ruleVersion", "sourceCutoffs", "snapshotCutoffs", "snapshotHash", "plan", "planHash", "projections",
    "projectionHash", "requestFingerprint", "counts", "totalCount", "rowCount", "generateCount", "suppressCount", "projectionCount",
    "planByteCount", "projectionByteCount", "requestByteCount", "createdAt"])
  assert.deepEqual(result.projections, projections); assert.equal(result.replayed, false)
  assert.equal("approvalFingerprint" in result, false)
})

test("approval adapter accepts exact UUID/hash cutoff families and reaches the exact 0083 RPC", async () => {
  let persistenceCalls = 0, rpcCalls = 0
  const result = await approveTaskAutomationHistoricalPlan({ requestId, preview: previewWithSnapshotCutoffs(exactSnapshotCutoffs) }, {
    auth: auth(),
    createPersistenceClient: async () => {
      persistenceCalls++
      return { rpc: async (name: string, args: HistoricalApprovalRpcArgs) => {
        rpcCalls++
        assert.equal(name, "approve_task_automation_historical_plan")
        assert.deepEqual(args.p_snapshot_cutoffs, exactSnapshotCutoffs)
        return { data: { ok: false, error: { code: "INVALID_PLAN", message: "INVALID_PLAN" } }, error: null }
      } }
    },
  })
  assert.equal(persistenceCalls, 1)
  assert.equal(rpcCalls, 1)
  assert.deepEqual(result, { ok: false, error: { code: "INVALID_PLAN", message: "INVALID_PLAN" } })
})

test("approval adapter rejects UUID/hash cross-family snapshot cursors before persistence", async () => {
  const uuidFamilies = ["opportunityRoots", "quoteVersionRoots", "assignmentEvidence", "quoteSourceEvidence", "taskOccupancy"] as const
  const hashFamilies = ["automationOrigins", "automationOutcomes", "automationTombstones"] as const
  let persistenceCalls = 0
  for (const family of uuidFamilies) {
    const cutoffs: SnapshotCutoffs = { ...snapshotCutoffs, [family]: cursor("a".repeat(64)) }
    assert.deepEqual(await approveTaskAutomationHistoricalPlan({ requestId, preview: previewWithSnapshotCutoffs(cutoffs) }, {
      auth: auth(), createPersistenceClient: async () => { persistenceCalls++; return {} },
    }), { ok: false, error: { code: "INVALID_PREVIEW", message: "INVALID_PREVIEW" } }, family)
  }
  for (const family of hashFamilies) {
    const cutoffs: SnapshotCutoffs = { ...snapshotCutoffs, [family]: cursor(id(90)) }
    assert.deepEqual(await approveTaskAutomationHistoricalPlan({ requestId, preview: previewWithSnapshotCutoffs(cutoffs) }, {
      auth: auth(), createPersistenceClient: async () => { persistenceCalls++; return {} },
    }), { ok: false, error: { code: "INVALID_PREVIEW", message: "INVALID_PREVIEW" } }, family)
  }
  assert.equal(persistenceCalls, 0)
})

test("approval adapter gives auth precedence and rejects non-exact input before persistence", async () => {
  let persistenceCalls = 0
  const noUser = { createAuthClient: async () => ({}), getUser: async () => ({ data: { user: null }, error: null }) }
  assert.deepEqual(await approveTaskAutomationHistoricalPlan({ requestId: "bad", preview, extra: true } as never, {
    auth: noUser, createPersistenceClient: async () => { persistenceCalls++; return {} } }),
  { ok: false, error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } })
  assert.deepEqual(await approveTaskAutomationHistoricalPlan({ requestId, preview, extra: true } as never, {
    auth: auth(), createPersistenceClient: async () => { persistenceCalls++; return {} } }),
  { ok: false, error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" } })
  assert.equal(persistenceCalls, 0)
})

test("approval adapter closes domain, provider, malformed, reordered, and private-fingerprint results", async () => {
  const invoke = async (data: unknown, error: unknown = null) => approveTaskAutomationHistoricalPlan({ requestId, preview }, {
    auth: auth(), createPersistenceClient: async () => ({}), invokeRpc: async () => ({ data, error }) })
  assert.deepEqual(await invoke({ ok: false, error: { code: "INVALID_PROJECTION", message: "INVALID_PROJECTION" } }),
    { ok: false, error: { code: "INVALID_PROJECTION", message: "INVALID_PROJECTION" } })
  assert.deepEqual(await invoke(null, { message: "provider secret" }),
    { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  const args = {} as HistoricalApprovalRpcArgs, valid = rpcSuccess({ ...args, p_plan_hash: preview.planHash,
    p_projection_hash: canonicalHash(projections), p_request_fingerprint: canonicalHash(["unused"]) })
  for (const malformed of [{ ...valid, extra: true }, { ...valid, projections: [...projections].reverse() },
    { ...valid, approval_fingerprint: "0".repeat(64) }, { ok: false, error: { code: "INVALID_PLAN", message: "provider detail" } }]) {
    assert.deepEqual(await invoke(malformed), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  }
})
