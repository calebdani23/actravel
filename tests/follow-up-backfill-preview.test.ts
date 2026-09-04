import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyFollowUpBackfillPreview,
  canonicalJson,
  type ExistingTaskFact,
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
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [existing] }).rows[0][7], "already-converted")
  assert.equal(classifyFollowUpBackfillPreview({ ...input([event]), existingTasks: [{ ...existing, description: "changed" } as unknown as ExistingTaskFact] }).rows[0][8], "SOURCE_MISMATCH")
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
