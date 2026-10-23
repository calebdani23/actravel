import assert from "node:assert/strict"
import test from "node:test"
import {
  TaskBoundaryError,
  mapTaskError,
  normalizeTaskInput,
  taskIdempotencyKey,
  type FollowUpTaskMetadata,
  type FollowUpTaskRepresentation,
  type TaskRow,
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

test("task adapter types expose additive representation without changing writes", () => {
  const metadata: FollowUpTaskMetadata = {
    schema: "follow_up_task.v1",
    source_event_id: lead,
    source_event_type: "follow_up_registered",
    owner_id: owner,
    lead_id: lead,
  }
  const row = {
    id: lead, owner_id: owner, lead_id: lead, quote_id: null,
    description: "Call traveler", due_at: "2026-09-01T00:00:00.000000Z",
    status: "pending", idempotency_key: "a".repeat(64), automation_origin_key: null,
    created_at: "2026-09-01T00:00:00.000000Z", updated_at: "2026-09-01T00:00:00.000000Z",
    task_kind: "follow_up" as const, source_event_id: lead,
    source_event_type: "follow_up_registered" as const,
    source_event_created_at: "2026-08-31T00:00:00.000000Z",
    source_due_at: "2026-09-01T00:00:00.000000Z", source_payload: { followUpAt: "2026-09-01" }, metadata,
  } satisfies FollowUpTaskRepresentation
  const manual: TaskRow = { ...row, task_kind: "manual", source_event_id: null, source_event_type: null, source_event_created_at: null, source_due_at: null, source_payload: null, metadata: null }
  assert.equal(manual.source_event_id, null)
  assert.equal(row.metadata.schema, "follow_up_task.v1")
})
