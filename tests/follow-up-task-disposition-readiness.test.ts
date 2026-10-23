import assert from "node:assert/strict"
import test from "node:test"
import {
  readFollowUpTaskDispositionReadiness,
  type DispositionReadinessResult,
} from "@/lib/admin/follow-up-task-disposition-readiness"
import type { Database } from "@/lib/supabase/database.types"

const actorId = "11111111-1111-4111-8111-111111111111"
const requestId = "22222222-2222-4222-8222-22222222222a"
const approvalId = "33333333-3333-4333-8333-33333333333b"
const receiptId = "44444444-4444-4444-8444-444444444444"
const eligibleTaskId = "55555555-5555-4555-8555-555555555555"
const convertedTaskId = "66666666-6666-4666-8666-666666666666"
const eventIds = Array.from({ length: 7 }, (_, index) => `${index + 1}0000000-0000-4000-8000-00000000000${index + 1}`)
type ReadinessRpc = Database["public"]["Functions"]["read_follow_up_task_disposition_readiness"]
const rpcArgs = {
  p_request_id_text: requestId,
  p_expected_actor_id: actorId,
} satisfies ReadinessRpc["Args"]

const auth = async () => ({
  user: { id: actorId },
  profile: { id: actorId, full_name: "Admin", is_active: true },
  roles: ["admin"] as ["admin"],
})
const failure = (code: string) => ({ ok: false, error: { code, message: code } })
const success = (): Record<string, unknown> => ({
  ok: true,
  requestId,
  approvalId,
  applyReceiptId: receiptId,
  ready: false,
  counts: {
    eligible: 1,
    invalidDateNoTask: 1,
    manualReviewUnassignedOwner: 1,
    excludedLeadNotOperational: 1,
    excludedNonSelectedHistory: 1,
    alreadyConverted: 1,
    collisionManualReview: 1,
    taskBacked: 2,
    intentionalNoTask: 3,
    unresolvedManualReview: 2,
    total: 7,
  },
  rows: [
    { ordinal: 0, eventId: eventIds[0], disposition: "eligible", outcome: "task_backed", taskId: eligibleTaskId },
    { ordinal: 1, eventId: eventIds[1], disposition: "invalid-date/no-task", outcome: "intentional_no_task", taskId: null },
    { ordinal: 2, eventId: eventIds[2], disposition: "manual-review/unassigned-owner", outcome: "unresolved_manual_review", taskId: null },
    { ordinal: 3, eventId: eventIds[3], disposition: "excluded/lead-not-operational", outcome: "intentional_no_task", taskId: null },
    { ordinal: 4, eventId: eventIds[4], disposition: "excluded/non-selected-history", outcome: "intentional_no_task", taskId: null },
    { ordinal: 5, eventId: eventIds[5], disposition: "already-converted", outcome: "task_backed", taskId: convertedTaskId },
    { ordinal: 6, eventId: eventIds[6], disposition: "collision/manual-review", outcome: "unresolved_manual_review", taskId: null },
  ],
})
const run = (data: unknown, overrides: Record<string, unknown> = {}) => readFollowUpTaskDispositionReadiness(
  { requestId },
  {
    requireAdminRole: auth,
    createClient: async () => ({}) as never,
    invokeRpc: async () => ({ data, error: null }),
    ...overrides,
  } as never,
)

test("authenticates an Admin before client creation", async () => {
  let created = false
  const authError = new Error("auth boundary")
  await assert.rejects(() => readFollowUpTaskDispositionReadiness({ requestId }, {
    requireAdminRole: async () => { throw authError },
    createClient: async () => { created = true; return {} as never },
  }), (error) => error === authError)
  assert.equal(created, false)
})

test("validates only the exact lowercase canonical request after auth and before client creation", async () => {
  const inputs = [{}, { requestId: requestId.toUpperCase() }, { requestId: "bad" }, { requestId, extra: true }, null]
  for (const input of inputs) {
    let created = false
    const result = await readFollowUpTaskDispositionReadiness(input, {
      requireAdminRole: auth,
      createClient: async () => { created = true; return {} as never },
    })
    assert.deepEqual(result, failure("INVALID_REQUEST"))
    assert.equal(created, false)
  }
})

test("calls the exact RPC args and maps the exact ordered public success shape", async () => {
  const calls: string[] = []
  let rpcName: unknown
  let actualArgs: unknown
  const result = await readFollowUpTaskDispositionReadiness({ requestId }, {
    requireAdminRole: async () => { calls.push("auth"); return auth() },
    createClient: async () => {
      calls.push("client")
      return { rpc: async (name: string, args: unknown) => { calls.push("rpc"); rpcName = name; actualArgs = args; return { data: success(), error: null } } } as never
    },
  })
  assert.deepEqual(calls, ["auth", "client", "rpc"])
  assert.equal(rpcName, "read_follow_up_task_disposition_readiness")
  assert.deepEqual(actualArgs, rpcArgs)
  assert.deepEqual(result, success() as DispositionReadinessResult)
  assert.deepEqual(Object.keys(result), ["ok", "requestId", "approvalId", "applyReceiptId", "ready", "counts", "rows"])
  if (!result.ok) assert.fail("expected readiness success")
  assert.deepEqual(Object.keys(result.counts), ["eligible", "invalidDateNoTask", "manualReviewUnassignedOwner", "excludedLeadNotOperational", "excludedNonSelectedHistory", "alreadyConverted", "collisionManualReview", "taskBacked", "intentionalNoTask", "unresolvedManualReview", "total"])
  assert.deepEqual(result.rows.map((row) => row.ordinal), [0, 1, 2, 3, 4, 5, 6])
  assert.ok(result.rows.every((row) => Object.keys(row).join() === "ordinal,eventId,disposition,outcome,taskId"))
})

test("preserves only closed domain failures", async () => {
  const codes = ["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "APPROVAL_NOT_FOUND", "APPLY_RECEIPT_NOT_FOUND", "APPROVAL_INTEGRITY_FAILURE", "APPLY_RECEIPT_INTEGRITY_FAILURE", "TASK_PARITY_FAILURE", "LIMIT_EXCEEDED"]
  for (const code of codes) assert.deepEqual(await run(failure(code)), failure(code))
  for (const data of [failure("PERSISTENCE_FAILURE"), failure("UNKNOWN"), { ok: false, error: { code: "INVALID_REQUEST", message: "provider text" } }, { ...failure("INVALID_REQUEST"), extra: true }]) {
    assert.deepEqual(await run(data), failure("PERSISTENCE_FAILURE"))
  }
})

test("accepts a ready result only when unresolved disposition counts are zero", async () => {
  const value = success()
  value.ready = true
  Object.assign(value.counts as Record<string, unknown>, {
    manualReviewUnassignedOwner: 0,
    collisionManualReview: 0,
    unresolvedManualReview: 0,
    total: 5,
  })
  value.rows = (value.rows as Record<string, unknown>[])
    .filter((row) => row.outcome !== "unresolved_manual_review")
    .map((row, ordinal) => ({ ...row, ordinal }))
  assert.deepEqual(await run(value), value)
})

test("rejects malformed successes, accounting, row types, and row order", async () => {
  const cases: Array<(value: Record<string, unknown>) => void> = [
    (value) => { value.requestId = approvalId },
    (value) => { value.approvalId = approvalId.toUpperCase() },
    (value) => { value.applyReceiptId = null },
    (value) => { value.ready = "false" },
    (value) => { value.extra = true },
    (value) => { delete value.rows },
    (value) => { (value.counts as Record<string, unknown>).eligible = 1.5 },
    (value) => { (value.counts as Record<string, unknown>).total = 2001 },
    (value) => { (value.counts as Record<string, unknown>).taskBacked = 3 },
    (value) => { (value.counts as Record<string, unknown>).extra = 0 },
    (value) => { (value.rows as Record<string, unknown>[])[0].ordinal = 1 },
    (value) => { (value.rows as Record<string, unknown>[])[0].eventId = "bad" },
    (value) => { (value.rows as Record<string, unknown>[])[0].disposition = "unknown" },
    (value) => { (value.rows as Record<string, unknown>[])[0].outcome = "intentional_no_task" },
    (value) => { (value.rows as Record<string, unknown>[])[1].taskId = eligibleTaskId },
    (value) => { (value.rows as Record<string, unknown>[])[0].extra = true },
    (value) => { (value.rows as Record<string, unknown>[]).pop() },
    (value) => { (value.rows as Record<string, unknown>[])[1].eventId = eventIds[0] },
    (value) => { (value.rows as Record<string, unknown>[])[5].taskId = eligibleTaskId },
    (value) => { value.ready = true },
  ]
  for (const mutate of cases) {
    const value = success(); mutate(value)
    assert.deepEqual(await run(value), failure("PERSISTENCE_FAILURE"))
  }
})

test("suppresses transport and provider text behind adapter-only PERSISTENCE_FAILURE", async () => {
  const providerError = await run(success(), { invokeRpc: async () => ({ data: null, error: { code: "XX000", message: "provider secret" } }) })
  const thrown = await run(success(), { invokeRpc: async () => { throw new Error("transport secret") } })
  assert.deepEqual(providerError, failure("PERSISTENCE_FAILURE"))
  assert.deepEqual(thrown, failure("PERSISTENCE_FAILURE"))
  assert.doesNotMatch(JSON.stringify([providerError, thrown]), /provider|transport|secret|XX000/i)
})
