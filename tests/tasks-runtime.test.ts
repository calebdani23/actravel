import assert from "node:assert/strict"
import test from "node:test"
import {
  TaskBoundaryError,
  mapTaskError,
  normalizeTaskInput,
  taskIdempotencyKey,
} from "../lib/admin/tasks"

const owner = "11111111-1111-4111-8111-111111111111"
const lead = "22222222-2222-4222-8222-222222222222"

test("task input canonicalization is bounded, UTC, and deterministic", () => {
  const value = normalizeTaskInput({
    ownerId: owner.toUpperCase(), leadId: lead.toUpperCase(), quoteId: null,
    description: "  Call traveler  ", dueAt: "2026-09-01T12:34:56.123Z",
  })
  assert.deepEqual(value, {
    ownerId: owner, leadId: lead, quoteId: null, description: "Call traveler",
    dueAt: "2026-09-01T12:34:56.123000Z",
  })
  assert.match(taskIdempotencyKey(value), /^[0-9a-f]{64}$/)
  assert.equal(taskIdempotencyKey(value), taskIdempotencyKey({ ...value, description: "different" }))
})

test("invalid context, dates, and descriptions fail before an RPC", () => {
  for (const input of [
    { ownerId: owner, leadId: null, quoteId: null, description: "x", dueAt: "2026-09-01T00:00:00Z" },
    { ownerId: owner, leadId: lead, quoteId: lead, description: "x", dueAt: "2026-09-01T00:00:00Z" },
    { ownerId: owner, leadId: lead, quoteId: null, description: " ", dueAt: "2026-09-01T00:00:00Z" },
    { ownerId: owner, leadId: lead, quoteId: null, description: "x", dueAt: "not-a-date" },
  ]) assert.throws(() => normalizeTaskInput(input), TaskBoundaryError)
})

test("boundary errors use SQLSTATE only, never database messages", () => {
  assert.equal(mapTaskError({ code: "PT005", message: "arbitrary" }).code, "TASK_IDEMPOTENCY_CONFLICT")
  assert.equal(mapTaskError({ code: "PT006", message: "arbitrary" }).code, "TASK_INVALID_TRANSITION")
  assert.equal(mapTaskError({ code: "XX000", message: "TASK_FORBIDDEN" }).code, "TASK_DATABASE_ERROR")
})
