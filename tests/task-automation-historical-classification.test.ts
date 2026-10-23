import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { CanonicalizationFailure, canonicalHash, deterministicTaskUuid, IncompleteFacts, InvalidBoundary, type AssignmentEvidenceFact, type QuoteEvidenceFact } from "../lib/admin/task-automation-historical-contract"
import {
  buildHistoricalTaskAutomationPlan,
  classifyHistoricalQuotes,
  classifyHistoricalFirstContact,
  type FirstContactAssignmentProof,
  type FirstContactAutomationState,
  type FirstContactClassificationInput,
  type FirstContactOpportunityFact,
  type HistoricalClassificationInput,
  type QuoteClassificationInput,
  type QuoteVersionFact,
} from "../lib/admin/task-automation-historical-classification"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type S2TypeAssertions = [
  Assert<Equal<FirstContactAssignmentProof, { assignmentAt: string; assignmentEventId: string; anchorAt: string }>>,
  Assert<Equal<FirstContactClassificationInput["assignmentEvidence"][number], AssignmentEvidenceFact>>,
]
const s2TypeAssertions: S2TypeAssertions = [true, true]

const id = (group: number, value: number) => `${group}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const owner = id(3, 1), otherOwner = id(3, 2)
const createdAt = "2026-02-02T10:00:00.000000Z"
const assignedAt = "2026-02-02T10:05:00.123456Z"
const emptyState = (sourceOrders: number[] = []): FirstContactAutomationState => ({
  task: false, origin: false, outcome: false, tombstone: false, exact: false,
  duplicate: false, matchingSourceOrder: null, sourceOrders,
})
const root = (value: number, overrides: Partial<FirstContactOpportunityFact> = {}): FirstContactOpportunityFact => ({
  opportunityId: id(1, value), createdAt, assignedTo: owner, deleted: false, archived: false,
  terminal: false, owner: { tag: "active", ownerId: owner, roles: ["asesor"] }, state: emptyState(),
  ...overrides,
})
const assignment = (value: number, opportunityId: string, assignedTo: string | null, occurredAt = assignedAt) => ({
  eventId: id(2, value), opportunityId, occurredAt, assignedTo,
})

function fixture(): FirstContactClassificationInput {
  const opportunities = [
    root(1, { state: emptyState([1, 2, 4]) }),
    root(2),
    root(3),
    root(4, { assignedTo: null, owner: { tag: "unassigned" } }),
    root(5, { terminal: true }),
    root(6, { terminal: true }),
    root(7, { owner: { tag: "missing-profile", ownerId: owner } }),
    root(8, { owner: { tag: "inactive-profile", ownerId: owner } }),
    root(9, { owner: { tag: "invalid-role", ownerId: owner } }),
    root(10, { assignedTo: null, deleted: true, owner: { tag: "unassigned" } }),
    root(11, { state: { ...emptyState([2]), task: true, origin: true, outcome: true, exact: true, matchingSourceOrder: 2 } }),
    root(12, { assignedTo: null, owner: { tag: "unassigned" }, state: { ...emptyState([3]), outcome: true, tombstone: true, exact: true, matchingSourceOrder: 3 } }),
    root(13, { state: { ...emptyState(), task: true } }),
  ]
  const assignments = [
    assignment(14, id(1, 1), owner, "2026-02-02T10:10:00.123456Z"), assignment(1, id(1, 1), owner),
    assignment(3, id(1, 3), owner), assignment(16, id(1, 3), otherOwner),
    assignment(4, id(1, 4), owner), assignment(17, id(1, 4), null, "2026-02-02T11:00:00.000000Z"),
    assignment(5, id(1, 5), owner), assignment(6, id(1, 6), owner),
    assignment(7, id(1, 7), owner), assignment(8, id(1, 8), owner), assignment(9, id(1, 9), owner),
    assignment(11, id(1, 11), owner), assignment(12, id(1, 12), owner),
    assignment(18, id(1, 12), null, "2026-02-02T12:00:00.000000Z"), assignment(13, id(1, 13), owner),
  ]
  return {
    sourceCutoffs: { opportunityAssignment: "2026-03-01T00:00:00.000000Z", quoteSent: "2026-03-01T00:00:00.000000Z" },
    snapshotCutoffs: {
      opportunityRoots: [createdAt, id(1, 13)], quoteVersionRoots: null,
      assignmentEvidence: ["2026-02-02T15:00:00.000000Z", id(2, 99)], quoteSourceEvidence: null,
      taskOccupancy: null, automationOrigins: null, automationOutcomes: null, automationTombstones: null,
    },
    snapshotHash: "a".repeat(64), opportunityCensus: opportunities.length,
    opportunities, assignmentEvidence: assignments,
    terminalEvidence: [{ eventId: id(2, 50), opportunityId: id(1, 5), occurredAt: "2026-02-02T12:30:00.000000Z" }],
  }
}

test("malformed owner tags and active-role facts are rejected before classification", () => {
  for (const malformed of [
    { tag: "unknown", ownerId: owner },
    { tag: "active", ownerId: owner, roles: null },
    { tag: "active", ownerId: owner, roles: "asesor" },
    { tag: "active", ownerId: owner, roles: Array(1) },
    null,
  ]) {
    const input = fixture();
    input.opportunities[0].owner = malformed as unknown as FirstContactOpportunityFact["owner"];
    assert.throws(() => classifyHistoricalFirstContact(input), /InvalidFact/);
  }
});

test("quote occupancy takes precedence over missing sent proof", () => {
  const cases: [Partial<FirstContactAutomationState>, string][] = [
    [{ duplicate: true }, "DUPLICATE_SOURCE_STATE"],
    [{ sourceOrders: [1, 1] }, "DUPLICATE_SOURCE_STATE"],
    [{ task: true }, "IDENTITY_OCCUPIED"],
    [{ origin: true }, "STATE_MISMATCH"],
  ]
  for (const [state, reason] of cases) {
    const input = quoteFixture(), target = input.quoteVersions[5]
    Object.assign(target.state, state)
    const before = canonicalHash(input)
    const row = classifyHistoricalQuotes(input).plan.rows.find(r => r.rootId === target.quoteVersionId)!
    assert.equal(canonicalHash(input), before)
    assert.deepEqual([row.disposition, row.reason, row.action], ["collision/manual-review", reason, null])
  }
})

test("an exact response cannot bypass established quote-source ambiguity", () => {
  for (const kind of ["whatsapp_inbound", "payment"] as const) {
    const input = quoteFixture(), target = input.quoteVersions[7]
    input.quoteEvidence = input.quoteEvidence.filter(e => e.kind === "quote_sent" || e.kind === kind)
    input.quoteEvidence = [...input.quoteEvidence, { ...sent(90, target, "2026-02-02T16:00:00.000000Z"), kind: "quote_version_response" }]
    const before = canonicalHash(input)
    const row = classifyHistoricalQuotes(input).plan.rows.find(r => r.rootId === target.quoteVersionId)!
    assert.equal(canonicalHash(input), before)
    assert.deepEqual([row.disposition, row.reason, row.action], ["manual-review/context-invalid", "SOURCE_AMBIGUOUS", null])
  }
})

test("both classifier families reject hostile owner facts without executing them", () => {
  let calls = 0
  const touch = () => { calls++; throw Error("executed") }
  const active = () => ({ tag: "active", ownerId: owner, roles: ["asesor"] })
  const proxy = <T extends object>(value: T) => new Proxy(value, {
    get: touch, ownKeys: touch, getPrototypeOf: touch, getOwnPropertyDescriptor: touch,
  })
  const factories = [
    () => ({ tag: "unknown", ownerId: owner }),
    () => Object.defineProperty(active(), "tag", { get: touch }),
    () => Object.defineProperty(active(), "roles", { get: touch }),
    () => ({ ...active(), roles: Object.defineProperty(["asesor"], "0", { get: touch }) }),
    () => proxy(active()),
    () => ({ ...active(), roles: proxy(["asesor"]) }),
  ]
  for (const make of factories) for (const family of ["opportunities", "quoteVersions"] as const) {
    const input = integratedFixture()
    input[family][0].owner = make() as unknown as FirstContactOpportunityFact["owner"]
    calls = 0
    assert.throws(() => buildHistoricalTaskAutomationPlan(input), { name: "InvalidFact", code: "InvalidFact" })
    assert.equal(calls, 0)
  }
})

test("first-contact classification accounts for every frozen root from durable proof only", () => {
  const input = fixture(), before = structuredClone(input)
  const result = classifyHistoricalFirstContact(input)
  assert.deepEqual(input, before)
  assert.deepEqual(result, classifyHistoricalFirstContact(input))
  assert.equal(result.plan.totalCount, 13)
  assert.deepEqual(result.plan.counts, [1, 2, 1, 1, 1, 3, 3, 1])
  assert.equal(result.planHash, canonicalHash(result.plan))
  assert.deepEqual(result.plan.rows.map((row) => row.ordinal), [...Array(13).keys()])

  const byId = new Map(result.plan.rows.map((row) => [row.rootId, row]))
  const generated = byId.get(id(1, 1))!
  const originKey = canonicalHash(["task-automation:v1", "first_contact", id(1, 1)])
  const sourceKey = canonicalHash(["task-automation-source.v1", "opportunity_assignment", id(1, 1), owner, assignedAt])
  assert.deepEqual(
    [generated.disposition, generated.anchorAt, generated.dueAt, generated.sourceOrder, generated.sourceKey, generated.originKey, generated.taskId],
    ["apply/generate", assignedAt, "2026-02-03T15:15:00.000000Z", 5, sourceKey, originKey, deterministicTaskUuid(originKey)],
  )
  assert.deepEqual([byId.get(id(1, 2))!.reason, byId.get(id(1, 2))!.anchorAt, byId.get(id(1, 3))!.reason],
    ["ASSIGNMENT_EVIDENCE_MISSING", null, "ASSIGNMENT_EVIDENCE_CONTRADICTORY"])
  assert.deepEqual([byId.get(id(1, 4))!.disposition, byId.get(id(1, 4))!.operationSourceKind, byId.get(id(1, 5))!.operationSourceKind],
    ["apply/suppress", "opportunity_unassigned", "opportunity_terminal"])
  assert.equal(byId.get(id(1, 6))!.reason, "INVALIDATION_EVIDENCE_MISSING")
  assert.deepEqual([7, 8, 9].map((value) => byId.get(id(1, value))!.reason), ["PROFILE_MISSING", "PROFILE_INACTIVE", "ROLE_INVALID"])
  assert.equal(byId.get(id(1, 10))!.reason, "OPPORTUNITY_NOT_OPERATIONAL")
  assert.deepEqual([byId.get(id(1, 11))!.disposition, byId.get(id(1, 11))!.action], ["already/projected", null])
  assert.deepEqual([byId.get(id(1, 12))!.disposition, byId.get(id(1, 12))!.action], ["already/suppressed", null])
  assert.deepEqual([byId.get(id(1, 13))!.disposition, byId.get(id(1, 13))!.reason, byId.get(id(1, 13))!.taskId],
    ["collision/manual-review", "IDENTITY_OCCUPIED", null])
})

test("first-contact census and immutable pre-cutoff membership fail closed", () => {
  const input = fixture()
  assert.throws(() => classifyHistoricalFirstContact({ ...input, opportunityCensus: input.opportunityCensus + 1 }), IncompleteFacts)
  const opportunities = input.opportunities.map((value, index) => index === 0 ? { ...value, createdAt: input.sourceCutoffs.opportunityAssignment } : value)
  assert.throws(() => classifyHistoricalFirstContact({ ...input, opportunities }), InvalidBoundary)
})

test("first-contact invalidation is strictly after the assignment occurrence tuple", () => {
  const opportunity = root(20, { terminal: true })
  const input: FirstContactClassificationInput = {
    sourceCutoffs: { opportunityAssignment: "2026-03-01T00:00:00.000000Z", quoteSent: "2026-03-01T00:00:00.000000Z" },
    snapshotCutoffs: {
      opportunityRoots: [createdAt, opportunity.opportunityId], quoteVersionRoots: null,
      assignmentEvidence: [assignedAt, id(2, 99)], quoteSourceEvidence: null,
      taskOccupancy: null, automationOrigins: null, automationOutcomes: null, automationTombstones: null,
    },
    snapshotHash: "b".repeat(64), opportunityCensus: 1, opportunities: [opportunity],
    assignmentEvidence: [assignment(20, opportunity.opportunityId, owner)], terminalEvidence: [],
  }
  const classifyWithTerminal = (eventId: string) => classifyHistoricalFirstContact({
    ...input,
    terminalEvidence: [{ eventId, opportunityId: opportunity.opportunityId, occurredAt: assignedAt }],
  }).plan.rows[0]

  assert.deepEqual(
    [classifyWithTerminal(id(2, 19)).disposition, classifyWithTerminal(id(2, 19)).reason],
    ["manual-review/context-invalid", "INVALIDATION_EVIDENCE_MISSING"],
  )
  assert.deepEqual(
    [classifyWithTerminal(id(2, 21)).disposition, classifyWithTerminal(id(2, 21)).reason],
    ["apply/suppress", "SOURCE_INVALIDATED"],
  )
})

test("first-contact next-business-opening due matches protected 0079", () => {
  const result = classifyHistoricalFirstContact(fixture())
  assert.equal(result.plan.rows.find((row) => row.rootId === id(1, 1))!.dueAt, "2026-02-03T15:15:00.000000Z")
  assert.match(
    readFileSync("db/migrations/0079_task_automation_foundation.sql", "utf8"),
    /return \(candidate\+time '15:15'\) at time zone 'UTC';/i,
  )
  assert.deepEqual(s2TypeAssertions, [true, true])
})

test("first-contact classifier source is pure and has no database or operational I/O", () => {
  const source = readFileSync("lib/admin/task-automation-historical-classification.ts", "utf8")
  assert.doesNotMatch(source, /server-only|supabase|createClient|\.rpc\(|fetch\(|readFile|writeFile|process\./i)
})

const sentAt = "2026-02-01T10:00:00.123456Z"
const quoteState = (sourceOrders: number[] = []): FirstContactAutomationState => emptyState(sourceOrders)
const quote = (value: number, overrides: Partial<QuoteVersionFact> = {}): QuoteVersionFact => ({
  quoteVersionId: id(4, value), quoteId: id(5, value), opportunityId: id(6, value), sentAt, ownerId: owner,
  operational: true, terminal: false, owner: { tag: "active", ownerId: owner, roles: ["asesor"] }, state: quoteState(),
  ...overrides,
})
const sent = (value: number, root: QuoteVersionFact, occurredAt = "2026-02-01T09:59:00.000000Z"): Extract<QuoteEvidenceFact, { quoteVersionId: string }> & { kind: "quote_sent" } => ({
  kind: "quote_sent", eventId: id(7, value), quoteVersionId: root.quoteVersionId, quoteId: root.quoteId,
  opportunityId: root.opportunityId, occurredAt,
})

function quoteFixture(): QuoteClassificationInput {
  const sharedOpportunity = id(6, 80)
  const quoteVersions = [
    quote(1, { state: quoteState([1, 4]) }), quote(2), quote(3), quote(4), quote(5), quote(6), quote(7),
    quote(8, { opportunityId: sharedOpportunity }), quote(9, { opportunityId: sharedOpportunity }),
    quote(10, { owner: { tag: "missing-profile", ownerId: owner } }), quote(11, { operational: false }),
    quote(12, { state: { ...quoteState([2]), task: true, origin: true, outcome: true, exact: true, matchingSourceOrder: 2 } }),
    quote(13, { state: { ...quoteState([3]), outcome: true, tombstone: true, exact: true, matchingSourceOrder: 3 } }),
    quote(14, { state: { ...quoteState(), task: true } }), quote(15, { terminal: true }), quote(16),
  ]
  const byNumber = (value: number) => quoteVersions[value - 1]
  const quoteEvidence: QuoteEvidenceFact[] = quoteVersions.flatMap((root, index) => index === 5 ? [] : [sent(index + 1, root)])
  quoteEvidence.push(
    sent(50, byNumber(1), "2026-02-01T10:01:00.000000Z"), sent(7, byNumber(7)),
    { ...sent(22, byNumber(2), "2026-02-02T10:00:00.000000Z"), kind: "quote_version_response" },
    { ...sent(23, byNumber(3), "2026-02-02T11:00:00.000000Z"), kind: "quote_accepted" },
    { kind: "whatsapp_inbound", eventId: id(7, 24), opportunityId: byNumber(4).opportunityId, occurredAt: "2026-02-02T12:00:00.000000Z" },
    { kind: "payment", paymentId: id(7, 25), opportunityId: byNumber(5).opportunityId, acceptedQuoteVersionId: byNumber(5).quoteVersionId, status: "verified", occurredAt: "2026-02-02T13:00:00.000000Z" },
    { kind: "whatsapp_inbound", eventId: id(7, 26), opportunityId: sharedOpportunity, occurredAt: "2026-02-02T14:00:00.000000Z" },
    { kind: "payment", paymentId: id(7, 27), opportunityId: sharedOpportunity, acceptedQuoteVersionId: null, status: "verified", occurredAt: "2026-02-02T15:00:00.000000Z" },
    { ...sent(28, byNumber(13), "2026-02-02T16:00:00.000000Z"), kind: "quote_version_response" },
    { kind: "payment", paymentId: id(7, 29), opportunityId: byNumber(16).opportunityId, acceptedQuoteVersionId: byNumber(16).quoteVersionId, status: "received", occurredAt: "2026-02-02T17:00:00.000000Z" },
  )
  return {
    sourceCutoffs: { opportunityAssignment: "2026-03-01T00:00:00.000000Z", quoteSent: "2026-03-01T00:00:00.000000Z" },
    snapshotCutoffs: {
      opportunityRoots: null, quoteVersionRoots: [sentAt, byNumber(16).quoteVersionId], assignmentEvidence: null,
      quoteSourceEvidence: ["2026-02-02T17:00:00.000000Z", id(7, 99)], taskOccupancy: null,
      automationOrigins: null, automationOutcomes: null, automationTombstones: null,
    },
    snapshotHash: "c".repeat(64), quoteVersionCensus: quoteVersions.length, quoteVersions, quoteEvidence,
  }
}

function integratedFixture(): HistoricalClassificationInput {
  const first = fixture(), quotes = quoteFixture()
  const snapshotCutoffs = {
    ...first.snapshotCutoffs,
    quoteVersionRoots: quotes.snapshotCutoffs.quoteVersionRoots,
    quoteSourceEvidence: quotes.snapshotCutoffs.quoteSourceEvidence,
  }
  return {
    sourceCutoffs: first.sourceCutoffs, snapshotCutoffs, snapshotHash: "d".repeat(64),
    opportunityCensus: first.opportunityCensus, opportunities: first.opportunities,
    assignmentEvidence: first.assignmentEvidence, terminalEvidence: first.terminalEvidence,
    quoteVersionCensus: quotes.quoteVersionCensus, quoteVersions: quotes.quoteVersions,
    quoteEvidence: quotes.quoteEvidence,
  }
}

test("canonical builder integrates both root families with exact accounting, ordering, state precedence, and hash", () => {
  const input = integratedFixture(), before = structuredClone(input)
  input.opportunities = input.opportunities.map((value, index) => index === 10 ? { ...value, deleted: true } : value)
  const result = buildHistoricalTaskAutomationPlan(input)
  assert.deepEqual(input, { ...before, opportunities: input.opportunities })
  assert.deepEqual(result, buildHistoricalTaskAutomationPlan(input))
  assert.deepEqual(Object.keys(result).sort(), ["plan", "planHash"])
  assert.equal(result.plan.totalCount, 29)
  assert.deepEqual(result.plan.counts, [3, 6, 2, 2, 2, 4, 8, 2])
  assert.equal(result.plan.counts.reduce((sum, count) => sum + count, 0), result.plan.rows.length)
  assert.equal(result.planHash, canonicalHash(result.plan))
  assert.notEqual(result.planHash, canonicalHash({ ...result.plan, counts: [2, 6, 2, 2, 2, 4, 8, 3] }))
  assert.deepEqual(result.plan.rows.map((row) => row.ordinal), [...Array(29).keys()])
  assert.deepEqual(result.plan.rows.slice(0, 13).map((row) => row.sourceKind), Array(13).fill("opportunity_assignment"))
  assert.deepEqual(result.plan.rows.slice(13).map((row) => row.sourceKind), Array(16).fill("quote_sent"))
  for (const family of [result.plan.rows.slice(0, 13), result.plan.rows.slice(13)]) {
    const nullAnchor = family.findIndex((row) => row.anchorAt === null)
    if (nullAnchor >= 0) assert.equal(family.slice(nullAnchor).every((row) => row.anchorAt === null), true)
    const nullSource = family.findIndex((row) => row.sourceId === null)
    if (nullSource >= 0) assert.equal(family.slice(nullSource).every((row) => row.sourceId === null), true)
  }
  const byRoot = new Map(result.plan.rows.map((row) => [`${row.sourceKind}:${row.rootId}`, row]))
  assert.deepEqual([byRoot.get(`opportunity_assignment:${id(1, 1)}`)!.sourceOrder,
    byRoot.get(`opportunity_assignment:${id(1, 11)}`)!.disposition], [5, "already/projected"])
  assert.deepEqual([byRoot.get(`opportunity_assignment:${id(1, 13)}`)!.disposition,
    byRoot.get(`opportunity_assignment:${id(1, 13)}`)!.taskId], ["collision/manual-review", null])
})

test("canonical builder applies closed failure precedence and returns no partial plan", () => {
  const incomplete = integratedFixture()
  incomplete.opportunityCensus++
  incomplete.quoteVersions = incomplete.quoteVersions.map((value, index) => index === 0 ? { ...value, ownerId: "invalid" } : value)
  assert.throws(() => buildHistoricalTaskAutomationPlan(incomplete), IncompleteFacts)

  const boundary = integratedFixture()
  boundary.opportunities = boundary.opportunities.map((value, index) => index === 0 ? { ...value, createdAt: boundary.sourceCutoffs.opportunityAssignment } : value)
  boundary.quoteVersions = boundary.quoteVersions.map((value, index) => index === 0 ? { ...value, ownerId: "invalid" } : value)
  assert.throws(() => buildHistoricalTaskAutomationPlan(boundary), InvalidBoundary)

  const overflow = integratedFixture(), template = overflow.quoteVersions[0]
  overflow.quoteVersions = Array.from({ length: 2_001 }, (_, index) => ({ ...template, quoteVersionId: id(4, index + 100) }))
  overflow.quoteVersionCensus = overflow.quoteVersions.length
  overflow.quoteEvidence = []
  overflow.snapshotCutoffs = { ...overflow.snapshotCutoffs, quoteVersionRoots: [template.sentAt, id(4, 2_100)] }
  assert.throws(() => buildHistoricalTaskAutomationPlan(overflow), (error: unknown) => {
    assert.equal(error instanceof CanonicalizationFailure, true)
    assert.equal(error instanceof Error && "plan" in error, false)
    assert.equal(error instanceof Error && "rows" in error, false)
    assert.equal(error instanceof Error && "diagnostics" in error, false)
    return true
  })
})

test("quote classification reconstructs exact first-send generation and invalidation without inference", () => {
  const input = quoteFixture(), before = structuredClone(input), result = classifyHistoricalQuotes(input)
  assert.deepEqual(input, before)
  assert.deepEqual(result, classifyHistoricalQuotes(input))
  assert.deepEqual(result.plan.counts, [2, 4, 1, 1, 1, 1, 5, 1])
  assert.equal(result.plan.totalCount, 16)
  assert.equal(result.planHash, canonicalHash(result.plan))
  const rows = new Map(result.plan.rows.map((row) => [row.rootId, row])), generated = rows.get(id(4, 1))!
  const sentEventId = id(7, 1), originKey = canonicalHash(["task-automation:v1", "quote_follow_up", id(4, 1), sentEventId])
  const sourceKey = canonicalHash(["task-automation-source.v1", "quote_sent", id(4, 1), sentEventId])
  assert.deepEqual(
    [generated.sourceId, generated.sentEventId, generated.anchorAt, generated.dueAt, generated.dueRuleVersion, generated.sourceOrder, generated.sourceKey, generated.originKey, generated.taskId],
    [sentEventId, sentEventId, sentAt, "2026-02-03T10:00:00.123456Z", "elapsed-48h.v1", 5, sourceKey, originKey, deterministicTaskUuid(originKey)],
  )
  assert.deepEqual([2, 3, 4, 5].map((value) => rows.get(id(4, value))!.operationSourceKind),
    ["quote_version_response", "quote_accepted", "whatsapp_inbound", "payment_verified"])
  assert.deepEqual([2, 3, 4, 5].map((value) => rows.get(id(4, value))!.sourceKey), [
    canonicalHash(["task-automation-source.v1", "quote_version_response", id(4, 2), id(7, 22)]),
    canonicalHash(["task-automation-source.v1", "quote_accepted", id(4, 3), "accepted"]),
    canonicalHash(["task-automation-source.v1", "whatsapp_inbound", id(7, 24), id(6, 4), id(4, 4)]),
    canonicalHash(["task-automation-source.v1", "payment_verified", id(7, 25), id(4, 5)]),
  ])
  assert.deepEqual([2, 3, 4, 5].map((value) => rows.get(id(4, value))!.taskId), [null, null, null, null])
  assert.deepEqual([rows.get(id(4, 6))!.reason, rows.get(id(4, 7))!.reason],
    ["FIRST_SENT_EVENT_MISSING", "FIRST_SENT_EVENT_CONTRADICTORY"])
  assert.deepEqual([8, 9].map((value) => rows.get(id(4, value))!.reason), ["SOURCE_AMBIGUOUS", "SOURCE_AMBIGUOUS"])
  assert.deepEqual([rows.get(id(4, 10))!.reason, rows.get(id(4, 11))!.reason], ["PROFILE_MISSING", "QUOTE_NOT_OPERATIONAL"])
  assert.deepEqual([rows.get(id(4, 12))!.disposition, rows.get(id(4, 12))!.action], ["already/projected", null])
  assert.deepEqual([rows.get(id(4, 13))!.disposition, rows.get(id(4, 13))!.action], ["already/suppressed", null])
  assert.deepEqual([rows.get(id(4, 14))!.disposition, rows.get(id(4, 14))!.reason], ["collision/manual-review", "IDENTITY_OCCUPIED"])
  assert.equal(rows.get(id(4, 15))!.reason, "INVALIDATION_EVIDENCE_MISSING")
  assert.equal(rows.get(id(4, 16))!.disposition, "apply/generate")
})

test("quote census and frozen sent-at membership fail closed", () => {
  const input = quoteFixture()
  assert.throws(() => classifyHistoricalQuotes({ ...input, quoteVersionCensus: input.quoteVersionCensus + 1 }), IncompleteFacts)
  const quoteVersions = input.quoteVersions.map((value, index) => index === 0 ? { ...value, sentAt: input.sourceCutoffs.quoteSent } : value)
  assert.throws(() => classifyHistoricalQuotes({ ...input, quoteVersions }), InvalidBoundary)
})

test("quote_sent naming an exact root with wrong scope is contradictory", () => {
  const base = quoteFixture(), target = base.quoteVersions[5]
  const input: QuoteClassificationInput = {
    ...base, quoteEvidence: [...base.quoteEvidence, { ...sent(60, target), opportunityId: base.quoteVersions[0].opportunityId }],
  }

  const row = classifyHistoricalQuotes(input).plan.rows.find((value) => value.rootId === target.quoteVersionId)!
  assert.deepEqual(
    [row.disposition, row.reason, row.action],
    ["manual-review/context-invalid", "FIRST_SENT_EVENT_CONTRADICTORY", null],
  )
})

test("verified payment naming an exact root with wrong opportunity is ambiguous", () => {
  const base = quoteFixture(), target = base.quoteVersions[15]
  const input: QuoteClassificationInput = {
    ...base,
    quoteEvidence: [...base.quoteEvidence, {
      kind: "payment", paymentId: id(7, 61), opportunityId: base.quoteVersions[0].opportunityId,
      acceptedQuoteVersionId: target.quoteVersionId, status: "verified", occurredAt: "2026-02-02T16:30:00.000000Z",
    }],
  }

  const row = classifyHistoricalQuotes(input).plan.rows.find((value) => value.rootId === target.quoteVersionId)!
  assert.deepEqual(
    [row.disposition, row.reason, row.action],
    ["manual-review/context-invalid", "SOURCE_AMBIGUOUS", null],
  )
})
