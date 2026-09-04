import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyFollowUpBackfillPreview,
  canonicalJson,
  type ExistingTaskFact,
  type TaskOccupancyFact,
  parseUtcDate,
  type FollowUpBackfillInput,
  type OwnerFact,
} from "../lib/admin/follow-up-backfill-preview"

const active: OwnerFact = { tag: "active", ownerId: "33333333-3333-4333-8333-333333333333", roles: ["asesor"] }
const base = (id: string, createdAt: string, followUpAt: unknown, owner: OwnerFact = active) => ({
  eventId: id,
  leadId: "22222222-2222-4222-8222-222222222222",
  createdAt,
  followUpAt,
  hasNote: true,
  owner,
  leadOperational: true,
})
const input = (events: FollowUpBackfillInput["events"]): FollowUpBackfillInput => ({
  ruleVersion: "follow-up-backfill.v1",
  cutoffCreatedAt: "2026-01-31T23:59:59.123456Z",
  cutoffId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  events,
  taskOccupancies: [],
})

const occupancy = (overrides: Partial<TaskOccupancyFact> = {}): TaskOccupancyFact => ({
  id: "99999999-9999-4999-8999-999999999999",
  owner_id: active.ownerId,
  lead_id: "22222222-2222-4222-8222-222222222222",
  idempotency_key: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ...overrides,
})

test("strictly parses and normalizes supported UTC dates", () => {
  assert.equal(parseUtcDate("2026-01-20"), "2026-01-20T00:00:00.000000Z")
  assert.equal(parseUtcDate("2026-01-20T10:20:30.1-02:30"), "2026-01-20T12:50:30.100000Z")
  for (const value of [" 2026-01-20", "2026-01-20T24:00:00Z", "2026-01-20T10:20:60Z", "1969-12-31", "2026-01-20T10:00:00+14:01", "2026-01-20T10:00:00-00:00"]) {
    assert.throws(() => parseUtcDate(value))
  }
})

test("selects latest valid event, keeps history, sorts rows and accounts", () => {
  const lead = "22222222-2222-4222-8222-222222222222"
  const rows = classifyFollowUpBackfillPreview(input([
    base("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-01-02T00:00:00.000000Z", "2026-01-03"),
    base("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-01-01T00:00:00.000000Z", null),
  ])).rows
  assert.equal(rows.length, 2)
  assert.equal(rows[0][0], "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
  assert.equal(rows[0][7], "excluded/non-selected-history")
  assert.equal(rows[1][1], lead)
  assert.equal(rows[1][3], "2026-01-02T00:00:00.000000Z")
  assert.deepEqual(classifyFollowUpBackfillPreview(input([
    base("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-01-02T00:00:00.000000Z", "2026-01-03"),
  ])).counts, [1, 0, 0, 0, 0, 0, 0])
})

test("classifies lifecycle and owner states with closed reasons", () => {
  const missing: OwnerFact = { tag: "missing-profile", ownerId: active.ownerId }
  const result = classifyFollowUpBackfillPreview(input([
    base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02", { tag: "unassigned" }),
    { ...base("22222222-2222-4222-8222-222222222222", "2026-01-02T00:00:00.000000Z", "2026-01-03", missing), leadId: "44444444-4444-4444-8444-444444444444", leadOperational: false },
  ]))
  assert.equal(result.rows[0][8], "UNASSIGNED_OWNER")
  assert.equal(result.rows[1][7], "excluded/lead-not-operational")
})

test("uses typed precedence errors and rejects duplicates/out-of-cutoff facts", () => {
  assert.throws(() => classifyFollowUpBackfillPreview(undefined as unknown as FollowUpBackfillInput), /IncompleteFacts/)
  assert.throws(() => classifyFollowUpBackfillPreview(input([base("11111111-1111-4111-8111-111111111111", "2027-01-01T00:00:00.000000Z", "2027-01-02")])), /InvalidFact/)
  assert.throws(() => classifyFollowUpBackfillPreview(input([
    base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02"),
    base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02"),
  ])), /InvalidFact/)
})

test("projects the exact future Task and applies collision precedence", () => {
  const event = base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02")
  const result = classifyFollowUpBackfillPreview(input([event]))
  assert.deepEqual(result.tasks[0], {
    status: "pending", task_kind: "follow_up", owner_id: active.ownerId, lead_id: event.leadId,
    quote_id: null, description: "Follow up with lead", due_at: "2026-01-02T00:00:00.000000Z",
    source_due_at: "2026-01-02T00:00:00.000000Z", source_event_id: event.eventId,
    source_event_type: "follow_up_registered", source_event_created_at: event.createdAt,
    source_payload: { followUpAt: "2026-01-02", hasNote: true },
    metadata: { schema: "follow_up_task.v1", source_event_id: event.eventId, source_event_type: "follow_up_registered", owner_id: active.ownerId, lead_id: event.leadId },
    idempotency_key: "f44b1020cf8c806af9763f16caa79037358a472a866519467e246c1f59d8e3f5",
  })
  const existing = { id: "99999999-9999-4999-8999-999999999999", ...result.tasks[0] } as ExistingTaskFact
  const matchingOccupancy = occupancy({ id: existing.id, owner_id: existing.owner_id, lead_id: existing.lead_id, idempotency_key: existing.idempotency_key })
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [existing], taskOccupancies: [matchingOccupancy] }).rows[0][7], "already-converted")
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [{ ...existing, description: "changed" } as unknown as ExistingTaskFact], taskOccupancies: [matchingOccupancy] }).rows[0][8], "SOURCE_MISMATCH")
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [existing], taskOccupancies: [matchingOccupancy] }).tasks.length, 0)
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [{ ...existing, description: "changed" } as unknown as ExistingTaskFact], taskOccupancies: [matchingOccupancy] }).tasks.length, 0)
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [{ ...existing, created_at: "2026-02-01T00:00:00.000000Z", updated_at: "2026-02-02T00:00:00.000000Z" }], taskOccupancies: [matchingOccupancy] }).rows[0][7], "already-converted")
})

test("returns tasks deterministically and bounds existing task input", () => {
  const first = base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02")
  const second = { ...base("22222222-2222-4222-8222-222222222222", "2026-01-02T00:00:00.000000Z", "2026-01-03"), leadId: "44444444-4444-4444-8444-444444444444" }
  const forward = classifyFollowUpBackfillPreview(input([first, second]))
  const reverse = classifyFollowUpBackfillPreview(input([second, first]))
  assert.deepEqual(forward.tasks, reverse.tasks)
  assert.throws(() => classifyFollowUpBackfillPreview({ ...input([]), existingTasks: Array.from({ length: 2001 }, () => ({}) as ExistingTaskFact) }), /CanonicalizationFailure/)
  const boundedExisting = Array.from({ length: 2000 }, (_, i) => ({ id: `${String(i + 1).padStart(8, "0")}-9999-4999-8999-999999999999`, ...forward.tasks[0] })) as ExistingTaskFact[]
  const bounded = classifyFollowUpBackfillPreview({ ...input([first]), existingTasks: boundedExisting, taskOccupancies: boundedExisting.map(({ id, owner_id, lead_id, idempotency_key }) => ({ id, owner_id, lead_id, idempotency_key })) })
  assert.equal(bounded.tasks.length, 0)
})

test("canonical JSON is recursive, sorted, and preserves array order", () => {
  assert.equal(canonicalJson({ z: 1, a: { b: true, a: [2, 1] } }), '{"a":{"a":[2,1],"b":true},"z":1}')
  assert.notEqual(canonicalJson({ a: [1, 2] }), canonicalJson({ a: [2, 1] }))
})

test("retains the verified vectors and rejects oversized plans", () => {
  const event = base("11111111-1111-4111-8111-111111111111", "2026-01-15T10:20:30.123456Z", "2026-01-20T00:00:00.000000Z")
  const result = classifyFollowUpBackfillPreview(input([event]))
  assert.equal(result.canonicalBytes.length, 362)
  assert.equal(result.canonicalHash, "57826a371b4e8db51258ac6aec3098518a0a8f0255f6d0d2ebcb28ccb93870af")
  assert.throws(() => classifyFollowUpBackfillPreview(input(Array.from({ length: 2001 }, (_, i) => base(`${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`, "2026-01-01T00:00:00.000000Z", "2026-01-02")))), /CanonicalizationFailure/)
})

test("enforces exact owner shape, normalized year bounds, and purity", () => {
  const event = base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02")
  assert.throws(() => classifyFollowUpBackfillPreview(input([{ ...event, owner: { ...active, extra: true } as OwnerFact }])), /InvalidFact/)
  assert.throws(() => parseUtcDate("1970-01-01T00:00:00+01:00"))
  const frozen = JSON.stringify(event)
  classifyFollowUpBackfillPreview(input([event]))
  assert.equal(JSON.stringify(event), frozen)
})

test("accounts every Task occupancy and derives both collision branches", () => {
  const event = base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02")
  const idempotencyCollision = occupancy({ id: "88888888-8888-4888-8888-888888888888", lead_id: "44444444-4444-4444-8444-444444444444", idempotency_key: "f44b1020cf8c806af9763f16caa79037358a472a866519467e246c1f59d8e3f5" })
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), taskOccupancies: [idempotencyCollision] }).rows[0][8], "IDEMPOTENCY_COLLISION")
  const leadCollision = occupancy({ id: "77777777-7777-4777-8777-777777777777" })
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), taskOccupancies: [leadCollision] }).rows[0][8], "OWNER_LEAD_COLLISION")
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), taskOccupancies: [occupancy({ lead_id: null })] }).rows[0][7], "eligible")
})

test("validates occupancy IDs, fields, cardinality, and exact existing matches", () => {
  const event = base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02")
  const invalid = occupancy({ id: "BAD" })
  assert.throws(() => classifyFollowUpBackfillPreview({ ...input([event]), taskOccupancies: [invalid] }), /InvalidFact/)
  assert.throws(() => classifyFollowUpBackfillPreview({ ...input([event]), taskOccupancies: Array.from({ length: 2001 }, () => occupancy()) }), /CanonicalizationFailure/)
  assert.throws(() => classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [{ ...classifyFollowUpBackfillPreview(input([event])).tasks[0], id: "99999999-9999-4999-8999-999999999999" } as ExistingTaskFact], taskOccupancies: [] }), /InvariantViolation/)
})

test("uses an ID map for exact existing occupancy matching", () => {
  const event = base("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000000Z", "2026-01-02")
  const result = classifyFollowUpBackfillPreview(input([event]))
  const existing = { id: "99999999-9999-4999-8999-999999999999", ...result.tasks[0] } as ExistingTaskFact
  const occupancyFact = occupancy({ id: existing.id, owner_id: existing.owner_id, lead_id: existing.lead_id, idempotency_key: existing.idempotency_key })
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [existing], taskOccupancies: [occupancyFact] }).rows[0][7], "already-converted")
})
