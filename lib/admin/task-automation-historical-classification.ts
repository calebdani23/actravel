import {
  CANONICAL_LIMITS, CLASSIFICATION_FAILURE_PRECEDENCE, DISPOSITIONS, DISPOSITION_REASONS,
  CanonicalizationFailure, IncompleteFacts, InvalidBoundary, InvalidFact, InvariantViolation,
  assertCanonicalByteLimit, canonicalHash, deterministicTaskUuid, hasExactKeys,
  isCanonicalHash, isCanonicalTimestamp, isCanonicalUuid,
  type AssignmentEvidenceFact, type HistoricalAction, type HistoricalPlan, type HistoricalPlanRow,
  type HistoricalReason, type OperationSourceKind, type QuoteEvidenceFact, type SnapshotCutoffs, type SourceCutoffs,
} from "./task-automation-historical-contract"

export type FirstContactOwnerFact =
  | { tag: "active"; ownerId: string; roles: readonly ("admin" | "manager" | "asesor")[] }
  | { tag: "unassigned" }
  | { tag: "missing-profile" | "inactive-profile" | "invalid-role"; ownerId: string }
export type FirstContactAutomationState = {
  task: boolean; origin: boolean; outcome: boolean; tombstone: boolean; exact: boolean; duplicate: boolean
  matchingSourceOrder: number | null; sourceOrders: readonly number[]
}
export type FirstContactOpportunityFact = {
  opportunityId: string; createdAt: string; assignedTo: string | null
  deleted: boolean; archived: boolean; terminal: boolean
  owner: FirstContactOwnerFact; state: FirstContactAutomationState
}
export type FirstContactTerminalEvidenceFact = { eventId: string; opportunityId: string; occurredAt: string }
export type FirstContactClassificationInput = {
  sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string
  opportunityCensus: number; opportunities: readonly FirstContactOpportunityFact[]
  assignmentEvidence: readonly AssignmentEvidenceFact[]; terminalEvidence: readonly FirstContactTerminalEvidenceFact[]
}
export type FirstContactClassificationResult = { plan: HistoricalPlan; planHash: string }
export type QuoteVersionFact = {
  quoteVersionId: string; quoteId: string; opportunityId: string; sentAt: string; ownerId: string | null
  operational: boolean; terminal: boolean; owner: FirstContactOwnerFact; state: FirstContactAutomationState
}
export type QuoteClassificationInput = {
  sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string
  quoteVersionCensus: number; quoteVersions: readonly QuoteVersionFact[]; quoteEvidence: readonly QuoteEvidenceFact[]
}
export type QuoteClassificationResult = { plan: HistoricalPlan; planHash: string }
export type HistoricalClassificationInput = {
  sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string
  opportunityCensus: number; opportunities: readonly FirstContactOpportunityFact[]
  assignmentEvidence: readonly AssignmentEvidenceFact[]; terminalEvidence: readonly FirstContactTerminalEvidenceFact[]
  quoteVersionCensus: number; quoteVersions: readonly QuoteVersionFact[]; quoteEvidence: readonly QuoteEvidenceFact[]
}
export type HistoricalClassificationResult = { plan: HistoricalPlan; planHash: string }

const INPUT_KEYS = ["sourceCutoffs", "snapshotCutoffs", "snapshotHash", "opportunityCensus", "opportunities", "assignmentEvidence", "terminalEvidence"] as const
const ROOT_KEYS = ["opportunityId", "createdAt", "assignedTo", "deleted", "archived", "terminal", "owner", "state"] as const
const STATE_KEYS = ["task", "origin", "outcome", "tombstone", "exact", "duplicate", "matchingSourceOrder", "sourceOrders"] as const
const SNAPSHOT_KEYS = ["opportunityRoots", "quoteVersionRoots", "assignmentEvidence", "quoteSourceEvidence", "taskOccupancy", "automationOrigins", "automationOutcomes", "automationTombstones"] as const
const MAX_ORDER = 2_147_483_647
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const after = (at: string, identity: string, cursor: readonly [string, string]) => at > cursor[0] || at === cursor[0] && identity > cursor[1]
const nullableCompare = (left: string | null, right: string | null) => left === null ? right === null ? 0 : 1 : right === null ? -1 : compare(left, right)

function validateBoundary(source: SourceCutoffs, snapshot: SnapshotCutoffs, hash: string) {
  if (!hasExactKeys(source, ["opportunityAssignment", "quoteSent"]) || !isCanonicalTimestamp(source.opportunityAssignment)
    || !isCanonicalTimestamp(source.quoteSent) || !hasExactKeys(snapshot, SNAPSHOT_KEYS) || !isCanonicalHash(hash)) throw new InvalidBoundary()
  for (const cursor of Object.values(snapshot)) {
    if (cursor === null) continue
    if (!Array.isArray(cursor) || cursor.length !== 2 || !isCanonicalTimestamp(cursor[0])
      || !(isCanonicalUuid(cursor[1]) || isCanonicalHash(cursor[1]))) throw new InvalidBoundary()
  }
}

function validateOwner(owner: FirstContactOwnerFact, assignedTo: string | null) {
  if (!(hasExactKeys(owner, ["tag"]) || hasExactKeys(owner, ["tag", "ownerId"])
    || hasExactKeys(owner, ["tag", "ownerId", "roles"]))
    || !["unassigned", "active", "missing-profile", "inactive-profile", "invalid-role"].includes(owner.tag)) throw new InvalidFact()
  try { assertCanonicalByteLimit(owner, CANONICAL_LIMITS.rowBytes) } catch { throw new InvalidFact() }
  if (owner.tag === "unassigned") {
    if (!hasExactKeys(owner, ["tag"]) || assignedTo !== null) throw new InvalidFact()
    return
  }
  if (!hasExactKeys(owner, owner.tag === "active" ? ["tag", "ownerId", "roles"] : ["tag", "ownerId"])
    || !isCanonicalUuid(owner.ownerId) || owner.ownerId !== assignedTo) throw new InvalidFact()
  if (owner.tag === "active" && (!Array.isArray(owner.roles) || owner.roles.length === 0 || owner.roles.some((role, index) =>
    !["admin", "manager", "asesor"].includes(role) || index > 0 && owner.roles[index - 1] >= role))) throw new InvalidFact()
}

function validateState(state: FirstContactAutomationState) {
  if (!hasExactKeys(state, STATE_KEYS) || [state.task, state.origin, state.outcome, state.tombstone, state.exact, state.duplicate].some((value) => typeof value !== "boolean")
    || !Array.isArray(state.sourceOrders) || state.sourceOrders.some((value) => !Number.isInteger(value) || value < 1 || value > MAX_ORDER)
    || state.matchingSourceOrder !== null && (!Number.isInteger(state.matchingSourceOrder) || !state.sourceOrders.includes(state.matchingSourceOrder))) throw new InvalidFact()
}

function finishPlan(sourceCutoffs: SourceCutoffs, snapshotCutoffs: SnapshotCutoffs, snapshotHash: string,
  rows: HistoricalPlanRow[], expectedTotal: number): HistoricalClassificationResult {
  if (rows.length !== expectedTotal || new Set(rows.map((row) => `${row.sourceKind}:${row.rootId}`)).size !== rows.length) throw new InvariantViolation()
  if (rows.length > CANONICAL_LIMITS.totalRows) throw new CanonicalizationFailure()
  rows.sort((a, b) => compare(a.sourceKind, b.sourceKind) || nullableCompare(a.anchorAt, b.anchorAt)
    || nullableCompare(a.sourceId, b.sourceId) || compare(a.rootId, b.rootId))
  const ordered = rows.map((row, ordinal) => ({ ...row, ordinal }))
  const counts = Array(8).fill(0) as [number, number, number, number, number, number, number, number]
  for (const row of ordered) {
    if (!DISPOSITION_REASONS[row.disposition].some((reason) => reason === row.reason)) throw new InvariantViolation()
    counts[DISPOSITIONS.indexOf(row.disposition)]++
  }
  if (counts.reduce((sum, count) => sum + count, 0) !== expectedTotal) throw new InvariantViolation()
  for (const row of ordered) assertCanonicalByteLimit(row, CANONICAL_LIMITS.rowBytes)
  const plan: HistoricalPlan = { schema: "task-automation-historical-plan.v1", ruleVersion: "task-automation-historical.v1",
    sourceCutoffs, snapshotCutoffs, snapshotHash, rows: ordered, counts, totalCount: expectedTotal }
  assertCanonicalByteLimit({ ...plan, rows: [] }, CANONICAL_LIMITS.emptyPlanBytes)
  assertCanonicalByteLimit(plan, CANONICAL_LIMITS.planBytes)
  return { plan, planHash: canonicalHash(plan) }
}

function holiday(date: Date) {
  const month = date.getUTCMonth() + 1, day = date.getUTCDate(), weekday = date.getUTCDay() || 7, year = date.getUTCFullYear()
  return ["01-01", "05-01", "09-16", "12-25"].includes(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    || month === 2 && weekday === 1 && day <= 7 || month === 3 && weekday === 1 && day >= 15 && day <= 21
    || month === 6 && weekday === 7 && day <= 7 && year % 6 === 2 || month === 10 && day === 1 && year % 6 === 2
    || month === 11 && weekday === 1 && day >= 15 && day <= 21
}

function firstContactDue(anchor: string) {
  const local = new Date(Date.parse(anchor) - 6 * 60 * 60_000), year = local.getUTCFullYear()
  if (year < 2026 || year > 2031) return null
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes(), workday = (local.getUTCDay() || 7) <= 5 && !holiday(local)
  if (workday && minutes >= 540 && minutes < 1080) {
    const due = new Date(Date.parse(anchor) + 15 * 60_000).toISOString()
    return `${due.slice(0, 19)}.${anchor.slice(20, 26)}Z`
  }
  const candidate = new Date(Date.UTC(year, local.getUTCMonth(), local.getUTCDate() + (minutes >= 1080 ? 1 : 0)))
  while ((candidate.getUTCDay() || 7) > 5 || holiday(candidate)) candidate.setUTCDate(candidate.getUTCDate() + 1)
  if (candidate.getUTCFullYear() > 2031) return null
  return `${candidate.toISOString().slice(0, 10)}T15:15:00.000000Z`
}

export type FirstContactAssignmentProof = { assignmentAt: string; assignmentEventId: string; anchorAt: string }
type Proof = FirstContactAssignmentProof | { reason: "ASSIGNMENT_EVIDENCE_MISSING" | "ASSIGNMENT_EVIDENCE_CONTRADICTORY" }
type Invalidation = { eventId: string; occurredAt: string; kind: "opportunity_unassigned" | "opportunity_terminal" }

function emptyRow(root: FirstContactOpportunityFact, anchorAt: string | null): HistoricalPlanRow {
  return {
    ordinal: 0, sourceKind: "opportunity_assignment", rootId: root.opportunityId, anchorAt, sourceId: root.opportunityId,
    ownerId: root.assignedTo, opportunityId: root.opportunityId, quoteId: null, quoteVersionId: null, sentEventId: null,
    disposition: "manual-review/context-invalid", reason: "ASSIGNMENT_EVIDENCE_MISSING", action: null,
    operationSourceKind: null, operationSourceId: null, sourceKey: null, sourceOrder: null, originKey: null,
    taskId: null, taskKind: null, dueRuleVersion: null, dueAt: null, outcomeKey: null, tombstoneKey: null,
  }
}

function projectedRow(root: FirstContactOpportunityFact, proof: Extract<Proof, { assignmentAt: string }>, invalidation: Invalidation | null,
  order: number, action: HistoricalAction, disposition: HistoricalPlanRow["disposition"], reason: HistoricalReason) {
  const row = emptyRow(root, proof.anchorAt), kind: OperationSourceKind = action === "generate" ? "opportunity_assignment" : invalidation!.kind
  const occurredAt = action === "generate" ? proof.assignmentAt : invalidation!.occurredAt
  const sourceKey = canonicalHash(["task-automation-source.v1", kind, root.opportunityId,
    ...(action === "generate" ? [root.assignedTo, occurredAt] : [occurredAt])])
  const originKey = canonicalHash(["task-automation:v1", "first_contact", root.opportunityId])
  const outcomeKey = canonicalHash(["task-automation-outcome.v1", kind, root.opportunityId, sourceKey, action, originKey])
  const dueAt = action === "generate" ? firstContactDue(proof.anchorAt) : null
  return Object.assign(row, {
    disposition, reason, action: disposition.startsWith("apply/") ? action : null, operationSourceKind: kind,
    operationSourceId: root.opportunityId, sourceKey, sourceOrder: order, originKey,
    ownerId: action === "generate" ? root.assignedTo : null,
    taskId: action === "generate" ? deterministicTaskUuid(originKey) : null,
    taskKind: action === "generate" ? "first_contact" as const : null,
    dueRuleVersion: action === "generate" ? "mx-calendar.v1" as const : null, dueAt, outcomeKey,
    tombstoneKey: action === "suppress" ? canonicalHash(["task-automation-tombstone.v1", kind, root.opportunityId, sourceKey, order, originKey, "source_invalidated"]) : null,
  })
}

export function classifyHistoricalFirstContact(input: FirstContactClassificationInput): FirstContactClassificationResult {
  if (!hasExactKeys(input, INPUT_KEYS) || !Array.isArray(input.opportunities) || !Array.isArray(input.assignmentEvidence)
    || !Array.isArray(input.terminalEvidence) || !Number.isInteger(input.opportunityCensus)) throw new IncompleteFacts()
  validateBoundary(input.sourceCutoffs, input.snapshotCutoffs, input.snapshotHash)
  if (input.opportunityCensus !== input.opportunities.length) throw new IncompleteFacts()
  const roots = new Map<string, FirstContactOpportunityFact>()
  for (const root of input.opportunities) {
    if (!hasExactKeys(root, ROOT_KEYS) || !isCanonicalUuid(root.opportunityId) || !isCanonicalTimestamp(root.createdAt)
      || root.assignedTo !== null && !isCanonicalUuid(root.assignedTo) || [root.deleted, root.archived, root.terminal].some((value) => typeof value !== "boolean")) throw new InvalidFact()
    if (roots.has(root.opportunityId)) throw new IncompleteFacts()
    if (root.createdAt >= input.sourceCutoffs.opportunityAssignment || !input.snapshotCutoffs.opportunityRoots
      || after(root.createdAt, root.opportunityId, input.snapshotCutoffs.opportunityRoots)) throw new InvalidBoundary()
    validateOwner(root.owner as FirstContactOwnerFact, root.assignedTo as string | null)
    validateState(root.state as FirstContactAutomationState); roots.set(root.opportunityId, root as FirstContactOpportunityFact)
  }
  const assignments = new Map<string, AssignmentEvidenceFact[]>(), contradictory = new Set<string>(), eventOwners = new Map<string, string>()
  for (const fact of input.assignmentEvidence) {
    if (!hasExactKeys(fact, ["eventId", "opportunityId", "occurredAt", "assignedTo"]) || !isCanonicalUuid(fact.eventId)
      || !isCanonicalUuid(fact.opportunityId) || !isCanonicalTimestamp(fact.occurredAt) || fact.assignedTo !== null && !isCanonicalUuid(fact.assignedTo)
      || !roots.has(fact.opportunityId)) throw new InvalidFact()
    if (!input.snapshotCutoffs.assignmentEvidence || after(fact.occurredAt, fact.eventId, input.snapshotCutoffs.assignmentEvidence)) throw new InvalidBoundary()
    const prior = eventOwners.get(fact.eventId); if (prior) { contradictory.add(prior); contradictory.add(fact.opportunityId) } else eventOwners.set(fact.eventId, fact.opportunityId)
    assignments.set(fact.opportunityId, [...assignments.get(fact.opportunityId) ?? [], fact as AssignmentEvidenceFact])
  }
  const terminals = new Map<string, FirstContactTerminalEvidenceFact[]>(), terminalIds = new Set<string>()
  for (const fact of input.terminalEvidence) {
    if (!hasExactKeys(fact, ["eventId", "opportunityId", "occurredAt"]) || !isCanonicalUuid(fact.eventId) || terminalIds.has(fact.eventId)
      || !isCanonicalUuid(fact.opportunityId) || !isCanonicalTimestamp(fact.occurredAt) || !roots.has(fact.opportunityId)) throw new InvalidFact()
    if (!input.snapshotCutoffs.assignmentEvidence || after(fact.occurredAt, fact.eventId, input.snapshotCutoffs.assignmentEvidence)) throw new InvalidBoundary()
    terminalIds.add(fact.eventId); terminals.set(fact.opportunityId, [...terminals.get(fact.opportunityId) ?? [], fact as FirstContactTerminalEvidenceFact])
  }
  if (input.opportunities.length > CANONICAL_LIMITS.rootsPerFamily || input.assignmentEvidence.length + input.terminalEvidence.length > CANONICAL_LIMITS.evidencePerFamily) throw new CanonicalizationFailure()

  const rows = input.opportunities.map((root) => {
    const events = [...assignments.get(root.opportunityId) ?? []].sort((a, b) => compare(a.occurredAt, b.occurredAt) || compare(a.eventId, b.eventId))
    if (events.some((event) => event.occurredAt < root.createdAt)) contradictory.add(root.opportunityId)
    for (let index = 1; index < events.length; index++) if (events[index - 1].occurredAt === events[index].occurredAt && events[index - 1].assignedTo !== events[index].assignedTo) contradictory.add(root.opportunityId)
    const first = events.find((event) => event.assignedTo !== null)
    const proof: Proof = contradictory.has(root.opportunityId) || events.length > 0 && events.at(-1)!.assignedTo !== root.assignedTo
      ? { reason: "ASSIGNMENT_EVIDENCE_CONTRADICTORY" } : !first ? { reason: "ASSIGNMENT_EVIDENCE_MISSING" }
        : { assignmentAt: first.occurredAt, assignmentEventId: first.eventId, anchorAt: first.occurredAt > root.createdAt ? first.occurredAt : root.createdAt }
    const invalidations: Invalidation[] = "assignmentAt" in proof ? [
      ...events.filter((event) => event.assignedTo === null && after(event.occurredAt, event.eventId, [proof.assignmentAt, proof.assignmentEventId])).map((event) => ({ eventId: event.eventId, occurredAt: event.occurredAt, kind: "opportunity_unassigned" as const })),
      ...(terminals.get(root.opportunityId) ?? []).filter((event) => after(event.occurredAt, event.eventId, [proof.assignmentAt, proof.assignmentEventId])).map((event) => ({ ...event, kind: "opportunity_terminal" as const })),
    ].sort((a, b) => compare(a.occurredAt, b.occurredAt) || compare(a.kind, b.kind) || compare(a.eventId, b.eventId)) : []
    const invalidation = invalidations[0] ?? null, state = root.state
    const duplicateState = state.duplicate || new Set(state.sourceOrders).size !== state.sourceOrders.length
    const projected = state.exact && state.task && state.origin && state.outcome && !state.tombstone && state.matchingSourceOrder !== null
    const suppressed = state.exact && !state.task && !state.origin && state.outcome && state.tombstone && state.matchingSourceOrder !== null
    if (duplicateState) return Object.assign(emptyRow(root, "assignmentAt" in proof ? proof.anchorAt : null), { disposition: "collision/manual-review" as const, reason: "DUPLICATE_SOURCE_STATE" as const })
    if (projected && "assignmentAt" in proof && firstContactDue(proof.anchorAt)) return projectedRow(root, proof, null, state.matchingSourceOrder!, "generate", "already/projected", "ALREADY_PROJECTED")
    if (suppressed && "assignmentAt" in proof && invalidation) return projectedRow(root, proof, invalidation, state.matchingSourceOrder!, "suppress", "already/suppressed", "ALREADY_SUPPRESSED")
    if (state.task || state.origin || state.outcome || state.tombstone || state.exact || state.matchingSourceOrder !== null) return Object.assign(emptyRow(root, "assignmentAt" in proof ? proof.anchorAt : null), { disposition: "collision/manual-review" as const, reason: state.task ? "IDENTITY_OCCUPIED" as const : "STATE_MISMATCH" as const })
    if (root.deleted || root.archived) return Object.assign(emptyRow(root, "assignmentAt" in proof ? proof.anchorAt : null), { disposition: "excluded/not-actionable" as const, reason: "OPPORTUNITY_NOT_OPERATIONAL" as const })
    if (!("assignmentAt" in proof)) return Object.assign(emptyRow(root, null), { reason: proof.reason })
    if (invalidation) {
      const order = Math.max(0, ...state.sourceOrders) + 1
      if (order > MAX_ORDER) return Object.assign(emptyRow(root, proof.anchorAt), { disposition: "collision/manual-review" as const, reason: "SOURCE_ORDER_EXHAUSTED" as const })
      return projectedRow(root, proof, invalidation, order, "suppress", "apply/suppress", "SOURCE_INVALIDATED")
    }
    if (root.terminal) return Object.assign(emptyRow(root, proof.anchorAt), { reason: "INVALIDATION_EVIDENCE_MISSING" as const })
    const ownerReason = root.owner.tag === "missing-profile" ? "PROFILE_MISSING" : root.owner.tag === "inactive-profile" ? "PROFILE_INACTIVE" : root.owner.tag === "invalid-role" ? "ROLE_INVALID" : root.owner.tag === "unassigned" ? "OWNER_UNASSIGNED" : null
    if (ownerReason) return Object.assign(emptyRow(root, proof.anchorAt), { disposition: "manual-review/owner-invalid" as const, reason: ownerReason })
    if (!firstContactDue(proof.anchorAt)) return Object.assign(emptyRow(root, proof.anchorAt), { reason: "DUE_UNSUPPORTED" as const })
    const order = Math.max(0, ...state.sourceOrders) + 1
    if (order > MAX_ORDER) return Object.assign(emptyRow(root, proof.anchorAt), { disposition: "collision/manual-review" as const, reason: "SOURCE_ORDER_EXHAUSTED" as const })
    return projectedRow(root, proof, null, order, "generate", "apply/generate", "ELIGIBLE_GENERATE")
  })
  return finishPlan(input.sourceCutoffs, input.snapshotCutoffs, input.snapshotHash, rows, input.opportunityCensus)
}

const QUOTE_INPUT_KEYS = ["sourceCutoffs", "snapshotCutoffs", "snapshotHash", "quoteVersionCensus", "quoteVersions", "quoteEvidence"] as const
const QUOTE_ROOT_KEYS = ["quoteVersionId", "quoteId", "opportunityId", "sentAt", "ownerId", "operational", "terminal", "owner", "state"] as const
const QUOTE_EVENT_KEYS = ["kind", "eventId", "quoteVersionId", "quoteId", "opportunityId", "occurredAt"] as const
const TERMINAL_KINDS: ReadonlySet<string> = new Set(["quote_accepted", "quote_rejected", "quote_expired", "quote_cancelled", "quote_superseded"])
type QuoteProof = { sentEventId: string; sentOccurredAt: string } | { reason: "FIRST_SENT_EVENT_MISSING" | "FIRST_SENT_EVENT_CONTRADICTORY" }
type QuoteInvalidation = { kind: Exclude<OperationSourceKind, "opportunity_assignment" | "opportunity_unassigned" | "opportunity_archived" | "opportunity_terminal" | "quote_sent">; operationId: string; evidenceId: string; occurredAt: string }
type QuoteEventFact = Extract<QuoteEvidenceFact, { quoteVersionId: string }>
type QuoteSentFact = QuoteEventFact & { kind: "quote_sent" }

function quoteDue(sentAt: string) {
  const value = Date.parse(sentAt)
  if (!Number.isFinite(value)) return null
  const iso = new Date(value + 48 * 60 * 60_000).toISOString()
  const due = `${iso.slice(0, 19)}.${sentAt.slice(20, 26)}Z`
  return isCanonicalTimestamp(due) ? due : null
}

function emptyQuoteRow(root: QuoteVersionFact, proof: QuoteProof): HistoricalPlanRow {
  const sentEventId = "sentEventId" in proof ? proof.sentEventId : null
  return {
    ordinal: 0, sourceKind: "quote_sent", rootId: root.quoteVersionId, anchorAt: root.sentAt, sourceId: sentEventId,
    ownerId: root.ownerId, opportunityId: null, quoteId: root.quoteId, quoteVersionId: root.quoteVersionId, sentEventId,
    disposition: "manual-review/context-invalid", reason: "FIRST_SENT_EVENT_MISSING", action: null,
    operationSourceKind: null, operationSourceId: null, sourceKey: null, sourceOrder: null, originKey: null,
    taskId: null, taskKind: null, dueRuleVersion: null, dueAt: null, outcomeKey: null, tombstoneKey: null,
  }
}

function quoteProjectedRow(root: QuoteVersionFact, proof: Extract<QuoteProof, { sentEventId: string }>, invalidation: QuoteInvalidation | null,
  order: number, action: HistoricalAction, disposition: HistoricalPlanRow["disposition"], reason: HistoricalReason) {
  const row = emptyQuoteRow(root, proof), kind: OperationSourceKind = action === "generate" ? "quote_sent" : invalidation!.kind
  const operationId = action === "generate" ? proof.sentEventId : invalidation!.operationId
  const status = kind.startsWith("quote_") && kind !== "quote_version_response" ? kind.slice(6) : null
  const sourceKey = action === "generate"
    ? canonicalHash(["task-automation-source.v1", "quote_sent", root.quoteVersionId, proof.sentEventId])
    : kind === "quote_version_response" ? canonicalHash(["task-automation-source.v1", kind, root.quoteVersionId, operationId])
      : status ? canonicalHash(["task-automation-source.v1", kind, root.quoteVersionId, status])
        : kind === "whatsapp_inbound" ? canonicalHash(["task-automation-source.v1", kind, operationId, root.opportunityId, root.quoteVersionId])
          : canonicalHash(["task-automation-source.v1", kind, operationId, root.quoteVersionId])
  const originKey = canonicalHash(["task-automation:v1", "quote_follow_up", root.quoteVersionId, proof.sentEventId])
  const outcomeKey = canonicalHash(["task-automation-outcome.v1", kind, operationId, sourceKey, action, originKey])
  return Object.assign(row, {
    disposition, reason, action: disposition.startsWith("apply/") ? action : null, operationSourceKind: kind,
    operationSourceId: operationId, sourceKey, sourceOrder: order, originKey, ownerId: action === "generate" ? root.ownerId : null,
    taskId: action === "generate" ? deterministicTaskUuid(originKey) : null, taskKind: action === "generate" ? "quote_follow_up" as const : null,
    dueRuleVersion: action === "generate" ? "elapsed-48h.v1" as const : null, dueAt: action === "generate" ? quoteDue(root.sentAt) : null,
    outcomeKey, tombstoneKey: action === "suppress" ? canonicalHash(["task-automation-tombstone.v1", kind, operationId, sourceKey, order, originKey, "source_invalidated"]) : null,
  })
}

export function classifyHistoricalQuotes(input: QuoteClassificationInput): QuoteClassificationResult {
  if (!hasExactKeys(input, QUOTE_INPUT_KEYS) || !Array.isArray(input.quoteVersions) || !Array.isArray(input.quoteEvidence)
    || !Number.isInteger(input.quoteVersionCensus)) throw new IncompleteFacts()
  validateBoundary(input.sourceCutoffs, input.snapshotCutoffs, input.snapshotHash)
  if (input.quoteVersionCensus !== input.quoteVersions.length) throw new IncompleteFacts()
  const roots = new Map<string, QuoteVersionFact>()
  for (const root of input.quoteVersions) {
    if (!hasExactKeys(root, QUOTE_ROOT_KEYS) || !isCanonicalUuid(root.quoteVersionId) || !isCanonicalUuid(root.quoteId)
      || !isCanonicalUuid(root.opportunityId) || !isCanonicalTimestamp(root.sentAt) || root.ownerId !== null && !isCanonicalUuid(root.ownerId)
      || typeof root.operational !== "boolean" || typeof root.terminal !== "boolean") throw new InvalidFact()
    if (roots.has(root.quoteVersionId)) throw new IncompleteFacts()
    if (root.sentAt >= input.sourceCutoffs.quoteSent || !input.snapshotCutoffs.quoteVersionRoots
      || after(root.sentAt, root.quoteVersionId, input.snapshotCutoffs.quoteVersionRoots)) throw new InvalidBoundary()
    const validRoot = root as QuoteVersionFact
    validateOwner(validRoot.owner, validRoot.ownerId); validateState(validRoot.state); roots.set(validRoot.quoteVersionId, validRoot)
  }
  const sentEvents = new Map<string, QuoteSentFact[]>(), sentIds = new Map<string, string>()
  const contradictory = new Set<string>(), ambiguous = new Set<string>(), invalidations = new Map<string, QuoteInvalidation[]>()
  const whatsapp: Extract<QuoteEvidenceFact, { kind: "whatsapp_inbound" }>[] = []
  const addInvalidation = (rootId: string, value: QuoteInvalidation) => invalidations.set(rootId, [...invalidations.get(rootId) ?? [], value])
  const markOpportunity = (opportunityId: string) => { for (const root of roots.values()) if (root.opportunityId === opportunityId) ambiguous.add(root.quoteVersionId) }
  for (const fact of input.quoteEvidence) {
    if (!fact || typeof fact !== "object" || !isCanonicalTimestamp(fact.occurredAt)) throw new InvalidFact()
    const identity = fact.kind === "payment" ? fact.paymentId : fact.eventId
    if (!isCanonicalUuid(identity)) throw new InvalidFact()
    if (!input.snapshotCutoffs.quoteSourceEvidence || after(fact.occurredAt, identity, input.snapshotCutoffs.quoteSourceEvidence)) throw new InvalidBoundary()
    if (fact.kind === "payment") {
      if (!hasExactKeys(fact, ["kind", "paymentId", "opportunityId", "acceptedQuoteVersionId", "status", "occurredAt"])
        || !isCanonicalUuid(fact.opportunityId) || fact.acceptedQuoteVersionId !== null && !isCanonicalUuid(fact.acceptedQuoteVersionId)
        || fact.status !== "received" && fact.status !== "verified") throw new InvalidFact()
      const payment = fact as Extract<QuoteEvidenceFact, { kind: "payment" }>
      if (payment.status === "received") continue
      const root = payment.acceptedQuoteVersionId ? roots.get(payment.acceptedQuoteVersionId) : undefined
      if (!root) markOpportunity(payment.opportunityId)
      else if (root.opportunityId !== payment.opportunityId) ambiguous.add(root.quoteVersionId)
      else addInvalidation(root.quoteVersionId, { kind: "payment_verified", operationId: payment.paymentId, evidenceId: payment.paymentId, occurredAt: payment.occurredAt })
      continue
    }
    if (fact.kind === "whatsapp_inbound") {
      if (!hasExactKeys(fact, ["kind", "eventId", "opportunityId", "occurredAt"]) || !isCanonicalUuid(fact.opportunityId)) throw new InvalidFact()
      whatsapp.push(fact as Extract<QuoteEvidenceFact, { kind: "whatsapp_inbound" }>); continue
    }
    if (!hasExactKeys(fact, QUOTE_EVENT_KEYS) || !isCanonicalUuid(fact.quoteVersionId) || !isCanonicalUuid(fact.quoteId) || !isCanonicalUuid(fact.opportunityId)) throw new InvalidFact()
    const event = fact as QuoteEventFact, root = roots.get(event.quoteVersionId)
    if (!root) throw new InvalidFact()
    if (root.quoteId !== event.quoteId || root.opportunityId !== event.opportunityId) {
      if (event.kind === "quote_sent") contradictory.add(root.quoteVersionId)
      else ambiguous.add(root.quoteVersionId)
      continue
    }
    if (event.kind === "quote_sent") {
      const prior = sentIds.get(event.eventId); if (prior) { contradictory.add(prior); contradictory.add(root.quoteVersionId) } else sentIds.set(event.eventId, root.quoteVersionId)
      sentEvents.set(root.quoteVersionId, [...sentEvents.get(root.quoteVersionId) ?? [], event as QuoteSentFact]); continue
    }
    if (event.kind === "quote_version_response") addInvalidation(root.quoteVersionId, { kind: event.kind, operationId: event.eventId, evidenceId: event.eventId, occurredAt: event.occurredAt })
    else if (TERMINAL_KINDS.has(event.kind)) addInvalidation(root.quoteVersionId, { kind: event.kind as QuoteInvalidation["kind"], operationId: root.quoteVersionId, evidenceId: event.eventId, occurredAt: event.occurredAt })
    else throw new InvalidFact()
  }
  if (input.quoteVersions.length > CANONICAL_LIMITS.rootsPerFamily || input.quoteEvidence.length > CANONICAL_LIMITS.evidencePerFamily) throw new CanonicalizationFailure()
  const proofs = new Map<string, QuoteProof>()
  for (const root of roots.values()) {
    const events = [...sentEvents.get(root.quoteVersionId) ?? []].sort((a, b) => compare(a.occurredAt, b.occurredAt) || compare(a.eventId, b.eventId))
    proofs.set(root.quoteVersionId, contradictory.has(root.quoteVersionId) ? { reason: "FIRST_SENT_EVENT_CONTRADICTORY" }
      : events[0] ? { sentEventId: events[0].eventId, sentOccurredAt: events[0].occurredAt } : { reason: "FIRST_SENT_EVENT_MISSING" })
  }
  for (const event of whatsapp) {
    const candidates = [...roots.values()].filter((root) => {
      const proof = proofs.get(root.quoteVersionId)!
      if (root.opportunityId !== event.opportunityId || !("sentEventId" in proof) || proof.sentOccurredAt > event.occurredAt) return false
      return !(invalidations.get(root.quoteVersionId) ?? []).some((value) => TERMINAL_KINDS.has(value.kind as never) && value.occurredAt < event.occurredAt)
    })
    if (candidates.length === 1) addInvalidation(candidates[0].quoteVersionId, { kind: "whatsapp_inbound", operationId: event.eventId, evidenceId: event.eventId, occurredAt: event.occurredAt })
    else if (candidates.length > 1) for (const root of candidates) ambiguous.add(root.quoteVersionId)
  }
  const rows = input.quoteVersions.map((root) => {
    const proof = proofs.get(root.quoteVersionId)!, state = root.state
    const duplicateState = state.duplicate || new Set(state.sourceOrders).size !== state.sourceOrders.length
    if (duplicateState) return Object.assign(emptyQuoteRow(root, proof), { disposition: "collision/manual-review" as const, reason: "DUPLICATE_SOURCE_STATE" as const })
    if (!("sentEventId" in proof)) {
      if (state.task || state.origin || state.outcome || state.tombstone || state.exact || state.matchingSourceOrder !== null)
        return Object.assign(emptyQuoteRow(root, proof), { disposition: "collision/manual-review" as const, reason: state.task ? "IDENTITY_OCCUPIED" as const : "STATE_MISMATCH" as const })
      return Object.assign(emptyQuoteRow(root, proof), { reason: proof.reason })
    }
    const options = [...invalidations.get(root.quoteVersionId) ?? []].sort((a, b) => compare(a.occurredAt, b.occurredAt) || compare(a.kind, b.kind) || compare(a.evidenceId, b.evidenceId))
    const invalidation = options[0] ?? null
    const projected = state.exact && state.task && state.origin && state.outcome && !state.tombstone && state.matchingSourceOrder !== null
    const suppressed = state.exact && !state.task && !state.origin && state.outcome && state.tombstone && state.matchingSourceOrder !== null
    if (projected && quoteDue(root.sentAt)) return quoteProjectedRow(root, proof, null, state.matchingSourceOrder!, "generate", "already/projected", "ALREADY_PROJECTED")
    if (suppressed && invalidation) return quoteProjectedRow(root, proof, invalidation, state.matchingSourceOrder!, "suppress", "already/suppressed", "ALREADY_SUPPRESSED")
    if (state.task || state.origin || state.outcome || state.tombstone || state.exact || state.matchingSourceOrder !== null) return Object.assign(emptyQuoteRow(root, proof), { disposition: "collision/manual-review" as const, reason: state.task ? "IDENTITY_OCCUPIED" as const : "STATE_MISMATCH" as const })
    if (!root.operational) return Object.assign(emptyQuoteRow(root, proof), { disposition: "excluded/not-actionable" as const, reason: "QUOTE_NOT_OPERATIONAL" as const })
    if (ambiguous.has(root.quoteVersionId)) return Object.assign(emptyQuoteRow(root, proof), { reason: "SOURCE_AMBIGUOUS" as const })
    if (invalidation) {
      const order = Math.max(0, ...state.sourceOrders) + 1
      if (order > MAX_ORDER) return Object.assign(emptyQuoteRow(root, proof), { disposition: "collision/manual-review" as const, reason: "SOURCE_ORDER_EXHAUSTED" as const })
      return quoteProjectedRow(root, proof, invalidation, order, "suppress", "apply/suppress", "SOURCE_INVALIDATED")
    }
    if (root.terminal) return Object.assign(emptyQuoteRow(root, proof), { reason: "INVALIDATION_EVIDENCE_MISSING" as const })
    const ownerReason = root.owner.tag === "missing-profile" ? "PROFILE_MISSING" : root.owner.tag === "inactive-profile" ? "PROFILE_INACTIVE" : root.owner.tag === "invalid-role" ? "ROLE_INVALID" : root.owner.tag === "unassigned" ? "OWNER_UNASSIGNED" : null
    if (ownerReason) return Object.assign(emptyQuoteRow(root, proof), { disposition: "manual-review/owner-invalid" as const, reason: ownerReason })
    if (!quoteDue(root.sentAt)) return Object.assign(emptyQuoteRow(root, proof), { reason: "DUE_UNSUPPORTED" as const })
    const order = Math.max(0, ...state.sourceOrders) + 1
    if (order > MAX_ORDER) return Object.assign(emptyQuoteRow(root, proof), { disposition: "collision/manual-review" as const, reason: "SOURCE_ORDER_EXHAUSTED" as const })
    return quoteProjectedRow(root, proof, null, order, "generate", "apply/generate", "ELIGIBLE_GENERATE")
  })
  return finishPlan(input.sourceCutoffs, input.snapshotCutoffs, input.snapshotHash, rows, input.quoteVersionCensus)
}

const HISTORICAL_INPUT_KEYS = ["sourceCutoffs", "snapshotCutoffs", "snapshotHash", "opportunityCensus", "opportunities",
  "assignmentEvidence", "terminalEvidence", "quoteVersionCensus", "quoteVersions", "quoteEvidence"] as const
type ClassificationFailure = IncompleteFacts | InvalidBoundary | InvalidFact | InvariantViolation | CanonicalizationFailure
const closedFailure = (error: unknown): ClassificationFailure => error instanceof IncompleteFacts || error instanceof InvalidBoundary
  || error instanceof InvalidFact || error instanceof InvariantViolation || error instanceof CanonicalizationFailure
  ? error : new CanonicalizationFailure()
const duplicateIds = (values: readonly unknown[], key: string) => {
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || typeof value !== "object") continue
    const identity = (value as Record<string, unknown>)[key]
    if (typeof identity === "string" && seen.has(identity)) return true
    if (typeof identity === "string") seen.add(identity)
  }
  return false
}

export function buildHistoricalTaskAutomationPlan(input: HistoricalClassificationInput): HistoricalClassificationResult {
  try {
    if (!hasExactKeys(input, HISTORICAL_INPUT_KEYS) || !Array.isArray(input.opportunities) || !Array.isArray(input.assignmentEvidence)
      || !Array.isArray(input.terminalEvidence) || !Array.isArray(input.quoteVersions) || !Array.isArray(input.quoteEvidence)
      || !Number.isInteger(input.opportunityCensus) || !Number.isInteger(input.quoteVersionCensus)
      || input.opportunityCensus !== input.opportunities.length || input.quoteVersionCensus !== input.quoteVersions.length
      || duplicateIds(input.opportunities, "opportunityId") || duplicateIds(input.quoteVersions, "quoteVersionId")) throw new IncompleteFacts()
    validateBoundary(input.sourceCutoffs, input.snapshotCutoffs, input.snapshotHash)
    const failures: ClassificationFailure[] = []
    let first: FirstContactClassificationResult | undefined, quotes: QuoteClassificationResult | undefined
    try {
      first = classifyHistoricalFirstContact({ sourceCutoffs: input.sourceCutoffs, snapshotCutoffs: input.snapshotCutoffs,
        snapshotHash: input.snapshotHash, opportunityCensus: input.opportunityCensus, opportunities: input.opportunities,
        assignmentEvidence: input.assignmentEvidence, terminalEvidence: input.terminalEvidence })
    } catch (error) { failures.push(closedFailure(error)) }
    try {
      quotes = classifyHistoricalQuotes({ sourceCutoffs: input.sourceCutoffs, snapshotCutoffs: input.snapshotCutoffs,
        snapshotHash: input.snapshotHash, quoteVersionCensus: input.quoteVersionCensus,
        quoteVersions: input.quoteVersions, quoteEvidence: input.quoteEvidence })
    } catch (error) { failures.push(closedFailure(error)) }
    if (failures.length) throw failures.sort((a, b) => CLASSIFICATION_FAILURE_PRECEDENCE.indexOf(a.code) - CLASSIFICATION_FAILURE_PRECEDENCE.indexOf(b.code))[0]
    if (!first || !quotes) throw new InvariantViolation()
    if (input.assignmentEvidence.length + input.terminalEvidence.length + input.quoteEvidence.length > CANONICAL_LIMITS.totalEvidence) throw new CanonicalizationFailure()
    assertCanonicalByteLimit(input, CANONICAL_LIMITS.snapshotBytes)
    return finishPlan(input.sourceCutoffs, input.snapshotCutoffs, input.snapshotHash,
      [...first.plan.rows, ...quotes.plan.rows], input.opportunityCensus + input.quoteVersionCensus)
  } catch (error) { throw closedFailure(error) }
}
