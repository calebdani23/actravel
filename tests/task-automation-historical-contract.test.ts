import assert from "node:assert/strict"
import test from "node:test"
import type {
  AssignmentEvidenceFact,
  DispositionCounts,
  DueRuleVersion,
  HistoricalAction,
  HistoricalDisposition,
  HistoricalPlan,
  HistoricalPlanRow,
  HistoricalReason,
  HistoricalSourceKind,
  OperationSourceKind,
  SnapshotCursor,
  SnapshotCutoffs,
  SourceCutoffs,
  TaskKind,
} from "../lib/admin/task-automation-historical-contract"
import {
  CANONICAL_LIMITS,
  CLASSIFICATION_FAILURE_PRECEDENCE,
  CanonicalizationFailure,
  DISPOSITIONS,
  DISPOSITION_REASONS,
  assertCanonicalByteLimit,
  canonicalHash,
  canonicalJson,
  deterministicTaskUuid,
  hasExactKeys,
  isCanonicalHash,
  isCanonicalTimestamp,
  isCanonicalUuid,
  isDispositionCounts,
} from "../lib/admin/task-automation-historical-contract"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type ExpectedDisposition =
  | "apply/generate" | "apply/suppress" | "already/projected" | "already/suppressed"
  | "excluded/not-actionable" | "manual-review/owner-invalid"
  | "manual-review/context-invalid" | "collision/manual-review"
type ExpectedReason =
  | "ELIGIBLE_GENERATE" | "SOURCE_INVALIDATED" | "ALREADY_PROJECTED" | "ALREADY_SUPPRESSED"
  | "OPPORTUNITY_NOT_OPERATIONAL" | "QUOTE_NOT_OPERATIONAL"
  | "OWNER_UNASSIGNED" | "PROFILE_MISSING" | "PROFILE_INACTIVE" | "ROLE_INVALID"
  | "ASSIGNMENT_EVIDENCE_MISSING" | "ASSIGNMENT_EVIDENCE_CONTRADICTORY"
  | "FIRST_SENT_EVENT_MISSING" | "FIRST_SENT_EVENT_CONTRADICTORY" | "SOURCE_AMBIGUOUS"
  | "INVALIDATION_EVIDENCE_MISSING" | "DUE_UNSUPPORTED"
  | "IDENTITY_OCCUPIED" | "STATE_MISMATCH" | "DUPLICATE_SOURCE_STATE" | "SOURCE_ORDER_EXHAUSTED"
type ExpectedSourceKind = "opportunity_assignment" | "quote_sent"
type ExpectedOperationSourceKind = ExpectedSourceKind
  | "opportunity_unassigned" | "opportunity_archived" | "opportunity_terminal"
  | "quote_version_response" | "quote_accepted" | "quote_rejected" | "quote_expired"
  | "quote_cancelled" | "quote_superseded" | "whatsapp_inbound" | "payment_verified"
type ExpectedSourceCutoffs = { opportunityAssignment: string; quoteSent: string }
type ExpectedSnapshotCursor = readonly [createdAt: string, identity: string]
type ExpectedSnapshotCutoffs = {
  opportunityRoots: ExpectedSnapshotCursor | null
  quoteVersionRoots: ExpectedSnapshotCursor | null
  assignmentEvidence: ExpectedSnapshotCursor | null
  quoteSourceEvidence: ExpectedSnapshotCursor | null
  taskOccupancy: ExpectedSnapshotCursor | null
  automationOrigins: ExpectedSnapshotCursor | null
  automationOutcomes: ExpectedSnapshotCursor | null
  automationTombstones: ExpectedSnapshotCursor | null
}
type ExpectedDispositionCounts = readonly [number, number, number, number, number, number, number, number]
type ExpectedPlanRow = {
  ordinal: number
  sourceKind: ExpectedSourceKind
  rootId: string
  anchorAt: string | null
  sourceId: string | null
  ownerId: string | null
  opportunityId: string | null
  quoteId: string | null
  quoteVersionId: string | null
  sentEventId: string | null
  disposition: ExpectedDisposition
  reason: ExpectedReason
  action: "generate" | "suppress" | null
  operationSourceKind: ExpectedOperationSourceKind | null
  operationSourceId: string | null
  sourceKey: string | null
  sourceOrder: number | null
  originKey: string | null
  taskId: string | null
  taskKind: "first_contact" | "quote_follow_up" | null
  dueRuleVersion: "mx-calendar.v1" | "elapsed-48h.v1" | null
  dueAt: string | null
  outcomeKey: string | null
  tombstoneKey: string | null
}
type ExpectedPlan = {
  schema: "task-automation-historical-plan.v1"
  ruleVersion: "task-automation-historical.v1"
  sourceCutoffs: ExpectedSourceCutoffs
  snapshotCutoffs: ExpectedSnapshotCutoffs
  snapshotHash: string
  rows: ExpectedPlanRow[]
  counts: ExpectedDispositionCounts
  totalCount: number
}
type ContractTypeAssertions = [
  Assert<Equal<HistoricalDisposition, ExpectedDisposition>>,
  Assert<Equal<HistoricalReason, ExpectedReason>>,
  Assert<Equal<SourceCutoffs, ExpectedSourceCutoffs>>,
  Assert<Equal<SnapshotCursor, ExpectedSnapshotCursor>>,
  Assert<Equal<SnapshotCutoffs, ExpectedSnapshotCutoffs>>,
  Assert<Equal<DispositionCounts, ExpectedDispositionCounts>>,
  Assert<Equal<HistoricalSourceKind, ExpectedSourceKind>>,
  Assert<Equal<OperationSourceKind, ExpectedOperationSourceKind>>,
  Assert<Equal<HistoricalAction, "generate" | "suppress">>,
  Assert<Equal<TaskKind, "first_contact" | "quote_follow_up">>,
  Assert<Equal<DueRuleVersion, "mx-calendar.v1" | "elapsed-48h.v1">>,
  Assert<Equal<HistoricalPlanRow, ExpectedPlanRow>>,
  Assert<Equal<HistoricalPlan, ExpectedPlan>>,
  Assert<Equal<AssignmentEvidenceFact, { eventId: string; opportunityId: string; occurredAt: string; assignedTo: string | null }>>,
]
const contractTypeAssertions: ContractTypeAssertions = [
  true, true, true, true, true, true, true, true, true, true, true, true, true, true,
]

test("historical classification primitives are canonical and byte-stable", () => {
  const value = { z: 2, a: [true, null, "é"], nested: { b: 1, a: 0 } }
  assert.equal(canonicalJson(value), '{"a":[true,null,"é"],"nested":{"a":0,"b":1},"z":2}')
  assert.equal(canonicalHash(value), "45e8bd21fee817d03f6d2a03e878addd6aba2eefd7fe92f2beb564f55317ff80")
  assert.equal(deterministicTaskUuid("0".repeat(64)), "0d51288c-8994-5a85-b9d0-18826b6ec18b")
  assert.deepEqual(DISPOSITIONS, [
    "apply/generate", "apply/suppress", "already/projected", "already/suppressed",
    "excluded/not-actionable", "manual-review/owner-invalid",
    "manual-review/context-invalid", "collision/manual-review",
  ])
})

test("historical dispositions, reasons, and failure precedence are closed", () => {
  assert.deepEqual(DISPOSITION_REASONS, {
    "apply/generate": ["ELIGIBLE_GENERATE"],
    "apply/suppress": ["SOURCE_INVALIDATED"],
    "already/projected": ["ALREADY_PROJECTED"],
    "already/suppressed": ["ALREADY_SUPPRESSED"],
    "excluded/not-actionable": ["OPPORTUNITY_NOT_OPERATIONAL", "QUOTE_NOT_OPERATIONAL"],
    "manual-review/owner-invalid": ["OWNER_UNASSIGNED", "PROFILE_MISSING", "PROFILE_INACTIVE", "ROLE_INVALID"],
    "manual-review/context-invalid": ["ASSIGNMENT_EVIDENCE_MISSING", "ASSIGNMENT_EVIDENCE_CONTRADICTORY", "FIRST_SENT_EVENT_MISSING", "FIRST_SENT_EVENT_CONTRADICTORY", "SOURCE_AMBIGUOUS", "INVALIDATION_EVIDENCE_MISSING", "DUE_UNSUPPORTED"],
    "collision/manual-review": ["IDENTITY_OCCUPIED", "STATE_MISMATCH", "DUPLICATE_SOURCE_STATE", "SOURCE_ORDER_EXHAUSTED"],
  })
  assert.deepEqual(CLASSIFICATION_FAILURE_PRECEDENCE, [
    "IncompleteFacts", "InvalidBoundary", "InvalidFact", "InvariantViolation", "CanonicalizationFailure",
  ])
  assert.equal(Object.isFrozen(DISPOSITION_REASONS), true)
  for (const reasons of Object.values(DISPOSITION_REASONS)) assert.equal(Object.isFrozen(reasons), true)
})

test("canonical JSON rejects unsupported values without invoking accessors", () => {
  const unsupported: unknown[] = [undefined, Function("return 1n")(), Symbol("x"), () => undefined, NaN, Infinity, -0, 1.5, new Date(0)]
  const sparse = Array(1)
  unsupported.push(sparse, new Proxy({}, {}))
  for (const value of unsupported) assert.throws(() => canonicalJson(value), CanonicalizationFailure)

  let accessed = false
  const accessor = Object.defineProperty({}, "secret", { enumerable: true, get: () => { accessed = true; return "PII" } })
  assert.throws(() => canonicalJson(accessor), CanonicalizationFailure)
  assert.equal(accessed, false)
})

test("closed validators reject malformed identities, timestamps, counts, limits, and extra keys", () => {
  assert.equal(isCanonicalUuid("1a000000-0000-4000-8000-000000000001"), true)
  assert.equal(isCanonicalUuid("1A000000-0000-4000-8000-000000000001"), false)
  assert.equal(isCanonicalHash("a".repeat(64)), true)
  assert.equal(isCanonicalHash("A".repeat(64)), false)
  assert.equal(isCanonicalTimestamp("2028-02-29T23:59:59.123456Z"), true)
  assert.equal(isCanonicalTimestamp("2027-02-29T23:59:59.123456Z"), false)
  assert.equal(isCanonicalTimestamp("2028-02-29T23:59:59Z"), false)
  assert.equal(isDispositionCounts([1, 2, 3, 4, 5, 6, 7, 8]), true)
  assert.equal(isDispositionCounts([0, 0, 0, 0, 0, 0, 0, 4001]), false)
  assert.equal(hasExactKeys({ rootId: "x", sourceKind: "quote_sent" }, ["rootId", "sourceKind"]), true)
  assert.equal(hasExactKeys({ rootId: "x", sourceKind: "quote_sent", adopt: true }, ["rootId", "sourceKind"]), false)
  assert.equal(assertCanonicalByteLimit("é", 4), 4)
  assert.throws(() => assertCanonicalByteLimit("é", 3), CanonicalizationFailure)
  assert.throws(() => assertCanonicalByteLimit(null, -1), CanonicalizationFailure)
  assert.deepEqual(CANONICAL_LIMITS, {
    rootsPerFamily: 2_000, totalRows: 4_000, evidencePerFamily: 20_000,
    totalEvidence: 40_000, rowBytes: 4_096, emptyPlanBytes: 65_536,
    planBytes: 16_777_216, snapshotBytes: 33_554_432,
  })
})

test("disposition counts require exactly eight own data elements without reading accessors or proxies", () => {
  const counts = [1, 2, 3, 4, 5, 6, 7, 8]
  assert.equal(isDispositionCounts(counts), true)
  assert.equal(isDispositionCounts(counts.slice(0, 7)), false)
  assert.equal(isDispositionCounts([...counts, 0]), false)

  const sparse = counts.slice()
  delete sparse[3]
  assert.equal(isDispositionCounts(sparse), false)

  const extraStringKey = counts.slice() as number[] & { extra?: number }
  extraStringKey.extra = 0
  assert.equal(isDispositionCounts(extraStringKey), false)

  const extraSymbolKey = counts.slice()
  Object.defineProperty(extraSymbolKey, Symbol("extra"), { value: 0 })
  assert.equal(isDispositionCounts(extraSymbolKey), false)

  const nonEnumerableElement = counts.slice()
  Object.defineProperty(nonEnumerableElement, "3", { value: 4, enumerable: false })
  assert.equal(isDispositionCounts(nonEnumerableElement), false)

  let getterReads = 0
  const accessorElement = counts.slice()
  Object.defineProperty(accessorElement, "3", {
    enumerable: true,
    get: () => { getterReads++; return 4 },
  })
  assert.equal(isDispositionCounts(accessorElement), false)
  assert.equal(getterReads, 0)

  let proxyReads = 0
  const proxy = new Proxy(counts.slice(), {
    get: () => { proxyReads++; throw new Error("proxy get") },
    ownKeys: () => { proxyReads++; throw new Error("proxy ownKeys") },
    getOwnPropertyDescriptor: () => { proxyReads++; throw new Error("proxy descriptor") },
  })
  assert.equal(isDispositionCounts(proxy), false)
  assert.equal(proxyReads, 0)

  const revoked = Proxy.revocable(counts.slice(), {})
  revoked.revoke()
  assert.doesNotThrow(() => assert.equal(isDispositionCounts(revoked.proxy), false))
})

test("S1 DTO exports retain exact closed type equality", () => {
  assert.deepEqual(contractTypeAssertions, [
    true, true, true, true, true, true, true, true, true, true, true, true, true, true,
  ])
})
