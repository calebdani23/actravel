import assert from "node:assert/strict"
import test from "node:test"
import { applyApprovedFollowUpTaskPlan, type ApplyResult } from "@/lib/admin/follow-up-task-approved-plan-apply"

const actorId = "11111111-1111-4111-8111-111111111111"
const requestId = "22222222-2222-4222-8222-222222222222"
const approvalId = "33333333-3333-4333-8333-333333333333"
const taskId = "44444444-4444-4444-8444-444444444444"
const success = (): Record<string, unknown> => ({
  ok: true, status: "applied", id: "55555555-5555-4555-8555-555555555555", request_id: requestId,
  approval_id: approvalId, actor_id: actorId, approval_fingerprint: "a".repeat(64), request_fingerprint: "b".repeat(64),
  canonical_plan_hash: "c".repeat(64), projection_hash: "d".repeat(64), task_ids: [taskId], task_count: 1,
  result: { schema: "follow-up-task-apply-result.v1", requestId, approvalId, actorId, taskIds: [taskId], taskCount: 1 },
  result_hash: "e".repeat(64), result_byte_count: 123, created_at: "2026-09-09T20:00:00.000Z",
})
const auth = async () => ({ user: { id: actorId }, profile: { id: actorId, full_name: "Admin", is_active: true }, roles: ["admin"] as const })
const run = (data: unknown, overrides: Record<string, unknown> = {}) => applyApprovedFollowUpTaskPlan(
  { requestId }, { requireAdminRole: auth, createClient: async () => ({}) as never, invokeRpc: async () => ({ data, error: null }), ...overrides } as never,
)

test("auth runs before client creation and auth throws are unchanged", async () => {
  let created = false
  const error = new Error("auth boundary")
  await assert.rejects(() => applyApprovedFollowUpTaskPlan({ requestId }, {
    requireAdminRole: async () => { throw error },
    createClient: async () => { created = true; return {} as never },
  }), (actual) => actual === error)
  assert.equal(created, false)
})

test("maps an exact applied receipt to the public camel-case contract", async () => {
  const result = await run(success())
  assert.deepEqual(result, {
    ok: true, status: "success", replayed: false, receiptId: "55555555-5555-4555-8555-555555555555", requestId,
    approvalId, actorId, approvalFingerprint: "a".repeat(64), requestFingerprint: "b".repeat(64),
    canonicalPlanHash: "c".repeat(64), projectionHash: "d".repeat(64), taskIds: [taskId], taskCount: 1,
    result: { schema: "follow-up-task-apply-result.v1", requestId, approvalId, actorId, taskIds: [taskId], taskCount: 1 },
    resultHash: "e".repeat(64), resultByteCount: 123, createdAt: "2026-09-09T20:00:00.000Z",
  } satisfies ApplyResult)
})

test("preserves closed RPC errors and never exposes provider failures", async () => {
  const codes = ["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "APPLY_IDEMPOTENCY_CONFLICT", "APPROVAL_NOT_FOUND", "APPROVAL_INTEGRITY_FAILURE", "STALE_LIVE_CONTEXT", "TASK_OCCUPANCY_CONFLICT", "LIMIT_EXCEEDED"]
  for (const code of codes) assert.deepEqual(await run({ ok: false, error: { code, message: code } }), { ok: false, error: { code, message: code } })
  assert.deepEqual(await run(null), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  assert.deepEqual(await run(success(), { invokeRpc: async () => { throw new Error("provider secret") } }), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
})

test("rejects malformed success, nested result, identity, order, duplicate, count, and cardinality data", async () => {
  const cases: Array<(value: Record<string, unknown>) => void> = [
    (v) => { v.id = "bad" }, (v) => { v.request_id = null }, (v) => { v.approval_id = "bad" }, (v) => { v.actor_id = "bad" },
    (v) => { v.task_ids = ["bad"] }, (v) => { v.approval_fingerprint = "A".repeat(64) }, (v) => { v.task_count = "1" },
    (v) => { v.result = null }, (v) => { (v.result as Record<string, unknown>).schema = "wrong" },
    (v) => { (v.result as Record<string, unknown>).requestId = approvalId }, (v) => { (v.result as Record<string, unknown>).taskIds = [approvalId] },
    (v) => { (v.result as Record<string, unknown>).taskIds = [taskId, taskId] }, (v) => { v.task_ids = [taskId, approvalId] },
    (v) => { (v.result as Record<string, unknown>).taskCount = 2 }, (v) => { delete v.result_hash }, (v) => { v.extra = true },
    (v) => { delete (v.result as Record<string, unknown>).actorId }, (v) => { (v.result as Record<string, unknown>).extra = true },
  ]
  for (const mutate of cases) {
    const value = success(); mutate(value)
    const result = await run(value)
    assert.deepEqual(result, { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  }
})

test("requires the exact request shape", async () => {
  assert.deepEqual(await applyApprovedFollowUpTaskPlan({ requestId, extra: true } as never, { requireAdminRole: auth } as never), { ok: false, error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" } })
  assert.deepEqual(await applyApprovedFollowUpTaskPlan({ requestId: "BAD" }, { requireAdminRole: auth } as never), { ok: false, error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" } })
})
