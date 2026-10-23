import assert from "node:assert/strict"
import test from "node:test"
import { registerFollowUpTaskWrite, type FollowUpTaskWriteResult } from "@/lib/admin/follow-up-task-future-write"
import type { Database } from "@/lib/supabase/database.types"

const actorId = "11111111-1111-4111-8111-111111111111"
const requestId = "22222222-2222-4222-8222-22222222222a"
const leadId = "33333333-3333-4333-8333-33333333333b"
const noteId = "44444444-4444-4444-8444-444444444444"
const taskId = "55555555-5555-4555-8555-555555555555"
type WriteRpc = Database["public"]["Functions"]["register_follow_up_action"]
const auth = async () => ({ user: { id: actorId }, profile: { id: actorId, full_name: "Advisor", is_active: true }, roles: ["asesor"] as ["asesor"] })
const failure = (code: string) => ({ ok: false, error: { code, message: code } })
const success = (overrides: Record<string, unknown> = {}) => ({
  ok: true, outcome: "created", requestId, noteId, eventId: requestId, taskId,
  taskStatus: "pending", dueAt: "2026-09-14T10:30:15.120000Z", replayed: false, ...overrides,
})
const run = (data: unknown, input: unknown = { requestId, leadId, noteBody: "Reminder", dueAt: "2026-09-14T10:30:15.120000Z" }, overrides: Record<string, unknown> = {}) => registerFollowUpTaskWrite(input, {
  requireAdminRole: auth,
  createClient: async () => ({}) as never,
  invokeRpc: async () => ({ data, error: null }),
  ...overrides,
} as never)

test("authenticates an Admin or Asesor before input handling and client creation", async () => {
  let created = false
  const authError = new Error("auth boundary")
  await assert.rejects(() => registerFollowUpTaskWrite(null, {
    requireAdminRole: async () => { throw authError },
    createClient: async () => { created = true; return {} as never },
  }), (error) => error === authError)
  assert.equal(created, false)
})

test("normalizes exact input and calls the 0071 RPC with no provider fields", async () => {
  let rpcName: unknown
  let actualArgs: unknown
  const result = await registerFollowUpTaskWrite(
    { requestId, leadId, noteBody: "  Reminder 🛫  ", dueAt: "2026-09-14T12:30:15.12+02:00" },
    { requireAdminRole: auth, createClient: async () => ({ rpc: async (name: string, args: unknown) => { rpcName = name; actualArgs = args; return { data: success(), error: null } } }) as never },
  )
  const expectedArgs = { p_request_id_text: requestId, p_expected_actor_id: actorId, p_lead_id_text: leadId, p_note_body: "Reminder 🛫", p_due_at: "2026-09-14T10:30:15.120000Z" } satisfies WriteRpc["Args"]
  assert.equal(rpcName, "register_follow_up_action")
  assert.deepEqual(actualArgs, expectedArgs)
  assert.deepEqual(result, success() as FollowUpTaskWriteResult)
  assert.deepEqual(Object.keys(result), ["ok", "outcome", "requestId", "noteId", "eventId", "taskId", "taskStatus", "dueAt", "replayed"])
})

test("preserves the datetime-local form UX and maps an empty date to history-only", async () => {
  let localArgs: unknown
  const local = await registerFollowUpTaskWrite({ requestId, leadId, noteBody: "Local", dueAt: "2026-09-14T12:30" }, {
    requireAdminRole: auth,
    createClient: async () => ({}) as never,
    invokeRpc: async (_client, args) => { localArgs = args; return { data: success({ dueAt: "2026-09-14T12:30:00.000000Z" }), error: null } },
  })
  assert.deepEqual((localArgs as WriteRpc["Args"]).p_due_at, "2026-09-14T12:30:00.000000Z")
  assert.equal(local.ok && local.dueAt, "2026-09-14T12:30:00.000000Z")

  const history = success({ outcome: "history_only", taskId: null, taskStatus: null, dueAt: null })
  assert.deepEqual(await run(history, { requestId, leadId, noteBody: "History", dueAt: null }), history)
  const rescheduled = success({ outcome: "rescheduled", taskStatus: "in_progress", replayed: true })
  assert.deepEqual(await run(rescheduled), rescheduled)
})

test("rejects non-exact, noncanonical, invalid, and over-limit input before client creation", async () => {
  const inputs = [
    {}, { requestId: requestId.toUpperCase(), leadId, noteBody: "Note", dueAt: null },
    { requestId, leadId: leadId.toUpperCase(), noteBody: "Note", dueAt: null },
    { requestId, leadId, noteBody: " ", dueAt: null }, { requestId, leadId, noteBody: "é".repeat(2001), dueAt: null },
    { requestId, leadId, noteBody: "Note", dueAt: "2026-02-30T12:00:00Z" },
    { requestId, leadId, noteBody: "Note", dueAt: null, extra: true },
  ]
  for (const input of inputs) {
    let created = false
    assert.deepEqual(await registerFollowUpTaskWrite(input, { requireAdminRole: auth, createClient: async () => { created = true; return {} as never } }), failure(input === inputs[4] ? "LIMIT_EXCEEDED" : "INVALID_REQUEST"))
    assert.equal(created, false)
  }
})

test("preserves closed RPC failures and suppresses malformed results and provider text", async () => {
  const codes = ["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_FORBIDDEN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "LIMIT_EXCEEDED", "IDEMPOTENCY_CONFLICT", "REPLAY_INTEGRITY_FAILURE", "LEAD_NOT_OPERATIONAL", "OWNER_CONTEXT_INVALID", "TASK_OCCUPANCY_CONFLICT"]
  for (const code of codes) assert.deepEqual(await run(failure(code)), failure(code))
  for (const data of [failure("UNKNOWN"), { ...success(), extra: true }, success({ eventId: leadId }), success({ dueAt: null }), success({ outcome: "history_only" })]) {
    assert.deepEqual(await run(data), failure("PERSISTENCE_FAILURE"))
  }
  const provider = await run(null, undefined, { invokeRpc: async () => ({ data: null, error: { code: "XX000", message: "provider secret" } }) })
  const thrown = await run(null, undefined, { invokeRpc: async () => { throw new Error("transport secret") } })
  assert.deepEqual(provider, failure("PERSISTENCE_FAILURE"))
  assert.deepEqual(thrown, failure("PERSISTENCE_FAILURE"))
  assert.doesNotMatch(JSON.stringify([provider, thrown]), /provider|transport|secret|XX000/i)
})
