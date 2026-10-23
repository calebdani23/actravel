import "server-only"

import { buildHistoricalTaskAutomationPlan, type FirstContactAutomationState, type FirstContactOwnerFact,
  type HistoricalClassificationInput, type HistoricalClassificationResult } from "./task-automation-historical-classification"
import { DISPOSITIONS, DISPOSITION_REASONS, canonicalHash, canonicalJson, deterministicTaskUuid, hasExactKeys, isCanonicalHash,
  isCanonicalTimestamp, isCanonicalUuid, isDispositionCounts, type DispositionCounts, type HistoricalPlan,
  type HistoricalPlanRow, type SnapshotCutoffs, type SourceCutoffs } from "./task-automation-historical-contract"
import type { QuoteEvidenceFact } from "./task-automation-historical-contract"
import { readTaskAutomationHistoricalPreviewSource, type HistoricalPreviewSourceDeps, type HistoricalPreviewSourceFailureCode,
  type HistoricalPreviewSourceResult, type HistoricalSourceSuccess } from "./task-automation-historical-preview-source"

export type HistoricalPreviewDiagnostics = { passes: number; logicalReads: number; physicalAttempts: number;
  opportunityRootCount: number; quoteVersionRootCount: number }
export type HistoricalPreviewFailureCode = HistoricalPreviewSourceFailureCode | "SNAPSHOT_NOT_CONVERGED" | "CLASSIFICATION_FAILED" | "CANONICALIZATION_FAILURE"
type Failure<Code extends HistoricalPreviewFailureCode> = Code extends string
  ? { ok: false; error: { code: Code; message: Code }; diagnostics?: HistoricalPreviewDiagnostics } : never
export type HistoricalPreviewResult = {
  ok: true; schema: "task-automation-historical-preview.v1"; ruleVersion: "task-automation-historical.v1"
  sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string; plan: HistoricalPlan; planHash: string
  counts: DispositionCounts; totalCount: number; diagnostics: HistoricalPreviewDiagnostics
} | { [Code in HistoricalPreviewFailureCode]: Failure<Code> }[HistoricalPreviewFailureCode]
export type HistoricalPreviewDeps = {
  source?: HistoricalPreviewSourceDeps
  readSource?: () => Promise<HistoricalPreviewSourceResult>
  classify?: (input: HistoricalClassificationInput) => HistoricalClassificationResult
  physicalAttempts?: () => number
}

const failure = <Code extends HistoricalPreviewFailureCode>(code: Code, diagnostics?: HistoricalPreviewDiagnostics): Failure<Code> =>
  ({ ok: false, error: { code, message: code }, ...(diagnostics ? { diagnostics } : {}) }) as Failure<Code>
const SOURCE_FAILURE_CODES = new Set<HistoricalPreviewSourceFailureCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH",
  "CLIENT_UNAVAILABLE", "CUTOFF_UNAVAILABLE", "LIMIT_EXCEEDED", "MALFORMED_ROW", "INCOMPLETE_JOIN", "QUERY_FAILED"])
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const ordered = <T>(values: readonly T[], at: (value: T) => readonly string[]) => [...values].sort((left, right) => {
  const a = at(left), b = at(right)
  for (let index = 0; index < a.length; index++) { const result = compare(a[index], b[index]); if (result) return result }
  return 0
})

function normalizedSource(source: HistoricalSourceSuccess): HistoricalSourceSuccess {
  return { ok: true,
    opportunity_facts: ordered(source.opportunity_facts, (row) => [row.created_at, row.opportunity_id]),
    quote_facts: ordered(source.quote_facts, (row) => [row.sent_at, row.quote_version_id]),
    assignment_evidence: ordered(source.assignment_evidence, (row) => [row.occurred_at, row.event_id]),
    quote_source_evidence: ordered(source.quote_source_evidence, (row) => [row.occurred_at, row.evidence_id]),
    owner_facts: ordered(source.owner_facts, (row) => [row.owner_id]),
    task_occupancy: ordered(source.task_occupancy, (row) => [row.created_at, row.id]),
    automation_origins: ordered(source.automation_origins, (row) => [row.created_at, row.origin_key]),
    automation_outcomes: ordered(source.automation_outcomes, (row) => [row.created_at, row.outcome_key]),
    automation_tombstones: ordered(source.automation_tombstones, (row) => [row.created_at, row.tombstone_key]) }
}

function ownerFact(ownerId: string | null, source: HistoricalSourceSuccess): FirstContactOwnerFact {
  if (ownerId === null) return { tag: "unassigned" }
  const row = source.owner_facts.find((value) => value.owner_id === ownerId)
  if (!row?.profile_exists) return { tag: "missing-profile", ownerId }
  if (!row.is_active) return { tag: "inactive-profile", ownerId }
  const roles = [...new Set(row.roles)].sort()
  return roles.length > 0 && roles.every((role) => role === "admin" || role === "manager" || role === "asesor")
    ? { tag: "active", ownerId, roles: roles as ("admin" | "manager" | "asesor")[] } : { tag: "invalid-role", ownerId }
}

function automationState(source: HistoricalSourceSuccess, originKey: string | null,
  taskMatch: (task: HistoricalSourceSuccess["task_occupancy"][number]) => boolean,
  originMatch: (origin: HistoricalSourceSuccess["automation_origins"][number]) => boolean): FirstContactAutomationState {
  const tasks = source.task_occupancy.filter((task) => taskMatch(task) || originKey !== null &&
    (task.id === deterministicTaskUuid(originKey) || task.idempotency_key === originKey || task.automation_origin_key === originKey))
  const origins = source.automation_origins.filter((origin) => originMatch(origin) || originKey !== null && origin.origin_key === originKey)
  const outcomes = originKey === null ? [] : source.automation_outcomes.filter((row) => row.origin_key === originKey)
  const tombstones = originKey === null ? [] : source.automation_tombstones.filter((row) => row.origin_key === originKey)
  const orders = [...outcomes.map((row) => row.source_order), ...tombstones.map((row) => row.source_order)].sort((a, b) => a - b)
  const projected = originKey !== null && tasks.length === 1 && origins.length === 1 && outcomes.length === 1 && tombstones.length === 0
    && tasks[0].task_kind === origins[0].task_kind && tasks[0].id === origins[0].task_id && tasks[0].automation_origin_key === originKey
    && tasks[0].idempotency_key === originKey && outcomes[0].operation === "generate" && outcomes[0].outcome === "applied"
    && outcomes[0].task_id === tasks[0].id
  const suppressed = originKey !== null && tasks.length === 0 && origins.length === 0 && outcomes.length === 1 && tombstones.length === 1
    && outcomes[0].operation === "suppress" && outcomes[0].outcome === "applied" && outcomes[0].task_id === null
    && tombstones[0].reason === "source_invalidated" && outcomes[0].source_kind === tombstones[0].source_kind
    && outcomes[0].source_id === tombstones[0].source_id && outcomes[0].source_key === tombstones[0].source_key
    && outcomes[0].source_order === tombstones[0].source_order
  return { task: tasks.length > 0, origin: origins.length > 0, outcome: outcomes.length > 0, tombstone: tombstones.length > 0,
    exact: projected || suppressed, duplicate: tasks.length > 1 || origins.length > 1 || outcomes.length > 1 || tombstones.length > 1,
    matchingSourceOrder: projected || suppressed ? outcomes[0].source_order : null, sourceOrders: orders }
}

function classificationInput(source: HistoricalSourceSuccess, sourceCutoffs: SourceCutoffs, snapshotCutoffs: SnapshotCutoffs,
  snapshotHash: string, opportunityCensus: number, quoteVersionCensus: number): HistoricalClassificationInput {
  const assignments = source.assignment_evidence.filter((row) => row.event_type === "assigned").map((row) => ({
    eventId: row.event_id, opportunityId: row.opportunity_id, occurredAt: row.occurred_at, assignedTo: row.payload_valid ? row.assigned_to : null }))
  const terminalEvidence = source.assignment_evidence.filter((row) => row.event_type === "status_changed" && row.payload_valid && row.status_terminal)
    .map((row) => ({ eventId: row.event_id, opportunityId: row.opportunity_id, occurredAt: row.occurred_at }))
  const quoteEvidence: QuoteEvidenceFact[] = source.quote_source_evidence.filter((row) => row.payload_valid).map((row) => row.kind === "payment"
    ? { kind: "payment" as const, paymentId: row.evidence_id, opportunityId: row.opportunity_id,
      acceptedQuoteVersionId: row.accepted_quote_version_id, status: row.payment_status!, occurredAt: row.occurred_at }
    : row.kind === "whatsapp_inbound" ? { kind: row.kind, eventId: row.evidence_id, opportunityId: row.opportunity_id, occurredAt: row.occurred_at }
      : { kind: row.kind, eventId: row.evidence_id, quoteVersionId: row.quote_version_id!, quoteId: row.quote_id!,
        opportunityId: row.opportunity_id, occurredAt: row.occurred_at })
  const opportunities = source.opportunity_facts.map((row) => { const originKey = canonicalHash(["task-automation:v1", "first_contact", row.opportunity_id]); return {
    opportunityId: row.opportunity_id, createdAt: row.created_at, assignedTo: row.assigned_to, deleted: row.deleted, archived: row.archived,
    terminal: row.terminal, owner: ownerFact(row.assigned_to, source), state: automationState(source, originKey,
      (task) => task.task_kind === "first_contact" && task.lead_id === row.opportunity_id,
      (origin) => origin.task_kind === "first_contact" && origin.opportunity_id === row.opportunity_id) } })
  type SentEvidence = { kind: "quote_sent"; eventId: string; quoteVersionId: string; quoteId: string; opportunityId: string; occurredAt: string }
  const quoteVersions = source.quote_facts.map((row) => { const sent = quoteEvidence.filter((fact): fact is SentEvidence =>
    fact.kind === "quote_sent" && fact.quoteVersionId === row.quote_version_id)
    .sort((a, b) => compare(a.occurredAt, b.occurredAt) || compare(a.eventId, b.eventId))[0]
    const originKey = sent ? canonicalHash(["task-automation:v1", "quote_follow_up", row.quote_version_id, sent.eventId]) : null
    return { quoteVersionId: row.quote_version_id, quoteId: row.quote_id, opportunityId: row.opportunity_id, sentAt: row.sent_at,
      ownerId: row.owner_id, operational: !row.quote_deleted && !row.opportunity_deleted && !row.opportunity_archived,
      terminal: ["accepted", "rejected", "expired", "cancelled", "superseded"].includes(row.version_status), owner: ownerFact(row.owner_id, source),
      state: automationState(source, originKey, (task) => task.task_kind === "quote_follow_up" && task.quote_id === row.quote_id,
        (origin) => origin.task_kind === "quote_follow_up" && origin.quote_version_id === row.quote_version_id) } })
  return { sourceCutoffs, snapshotCutoffs, snapshotHash, opportunityCensus, opportunities, assignmentEvidence: assignments,
    terminalEvidence, quoteVersionCensus, quoteVersions, quoteEvidence }
}

const PLAN_KEYS = ["schema", "ruleVersion", "sourceCutoffs", "snapshotCutoffs", "snapshotHash", "rows", "counts", "totalCount"] as const
const ROW_KEYS = ["ordinal", "sourceKind", "rootId", "anchorAt", "sourceId", "ownerId", "opportunityId", "quoteId", "quoteVersionId",
  "sentEventId", "disposition", "reason", "action", "operationSourceKind", "operationSourceId", "sourceKey", "sourceOrder", "originKey",
  "taskId", "taskKind", "dueRuleVersion", "dueAt", "outcomeKey", "tombstoneKey"] as const
const OPERATION_SOURCE_KINDS = ["opportunity_assignment", "quote_sent", "opportunity_unassigned", "opportunity_archived", "opportunity_terminal",
  "quote_version_response", "quote_accepted", "quote_rejected", "quote_expired", "quote_cancelled", "quote_superseded",
  "whatsapp_inbound", "payment_verified"] as const
const nullable = (value: unknown, valid: (candidate: unknown) => boolean) => value === null || valid(value)
const oneOf = (value: unknown, values: readonly string[]) => typeof value === "string" && values.includes(value)
function decodePlanRow(value: unknown): HistoricalPlanRow | null {
  if (!hasExactKeys(value, ROW_KEYS)) return null
  const row = Object.fromEntries(ROW_KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(value, key)!.value])) as HistoricalPlanRow
  if (!Number.isInteger(row.ordinal) || row.ordinal < 0 || !oneOf(row.sourceKind, ["opportunity_assignment", "quote_sent"])
    || !isCanonicalUuid(row.rootId) || !nullable(row.anchorAt, isCanonicalTimestamp)
    || [row.sourceId, row.ownerId, row.opportunityId, row.quoteId, row.quoteVersionId, row.sentEventId, row.operationSourceId, row.taskId]
      .some((field) => !nullable(field, isCanonicalUuid))
    || !oneOf(row.disposition, DISPOSITIONS) || !DISPOSITION_REASONS[row.disposition].some((reason) => reason === row.reason)
    || !nullable(row.action, (field) => oneOf(field, ["generate", "suppress"]))
    || !nullable(row.operationSourceKind, (field) => oneOf(field, OPERATION_SOURCE_KINDS))
    || row.sourceOrder !== null && (!Number.isInteger(row.sourceOrder) || row.sourceOrder < 1 || row.sourceOrder > 2_147_483_647)
    || [row.sourceKey, row.originKey, row.outcomeKey, row.tombstoneKey].some((field) => !nullable(field, isCanonicalHash))
    || !nullable(row.taskKind, (field) => oneOf(field, ["first_contact", "quote_follow_up"]))
    || !nullable(row.dueRuleVersion, (field) => oneOf(field, ["mx-calendar.v1", "elapsed-48h.v1"]))
    || !nullable(row.dueAt, isCanonicalTimestamp)
    || row.action !== (row.disposition === "apply/generate" ? "generate" : row.disposition === "apply/suppress" ? "suppress" : null)) return null
  return row
}
const nullableOrder = (left: string | null, right: string | null) => left === null ? right === null ? 0 : 1 : right === null ? -1 : compare(left, right)
const planRowOrder = (left: HistoricalPlanRow, right: HistoricalPlanRow) => compare(left.sourceKind, right.sourceKind)
  || nullableOrder(left.anchorAt, right.anchorAt) || nullableOrder(left.sourceId, right.sourceId) || compare(left.rootId, right.rootId)
function validPlan(result: HistoricalClassificationResult, sourceCutoffs: SourceCutoffs, snapshotCutoffs: SnapshotCutoffs,
  snapshotHash: string, expectedTotal: number) {
  try {
    canonicalJson(result)
    if (!hasExactKeys(result, ["plan", "planHash"]) || !isCanonicalHash(result.planHash) || !hasExactKeys(result.plan, PLAN_KEYS)
      || result.plan.schema !== "task-automation-historical-plan.v1" || result.plan.ruleVersion !== "task-automation-historical.v1"
      || canonicalJson(result.plan.sourceCutoffs) !== canonicalJson(sourceCutoffs) || canonicalJson(result.plan.snapshotCutoffs) !== canonicalJson(snapshotCutoffs)
      || result.plan.snapshotHash !== snapshotHash || !Array.isArray(result.plan.rows) || !isDispositionCounts(result.plan.counts)
      || result.plan.totalCount !== expectedTotal || result.plan.rows.length !== expectedTotal || result.planHash !== canonicalHash(result.plan)) return false
    const rows = result.plan.rows.map(decodePlanRow)
    if (rows.some((row) => row === null)) return false
    const decoded = rows as HistoricalPlanRow[], counts = Array(8).fill(0)
    for (let ordinal = 0; ordinal < decoded.length; ordinal++) {
      const row = decoded[ordinal]
      if (row.ordinal !== ordinal || ordinal > 0 && planRowOrder(decoded[ordinal - 1], row) >= 0) return false
      counts[DISPOSITIONS.indexOf(row.disposition)]++
    }
    return counts.every((count, index) => count === result.plan.counts[index])
  } catch { return false }
}

export async function readTaskAutomationHistoricalPreview(deps: HistoricalPreviewDeps = {}): Promise<HistoricalPreviewResult> {
  let passes = 0, logicalReads = 0, opportunityRootCount = 0, quoteVersionRootCount = 0
  const diagnostics = (): HistoricalPreviewDiagnostics => { let physicalAttempts = logicalReads
    try { const count = deps.physicalAttempts?.(); if (Number.isInteger(count) && Number(count) >= logicalReads) physicalAttempts = Number(count) } catch { /* redacted */ }
    return { passes, logicalReads, physicalAttempts, opportunityRootCount, quoteVersionRootCount } }
  const readSource = deps.readSource ?? (() => readTaskAutomationHistoricalPreviewSource(deps.source))
  const snapshots: { bytes: string; hash: string; result: Extract<HistoricalPreviewSourceResult, { ok: true }>; source: HistoricalSourceSuccess }[] = []
  let frozenBoundary: string | null = null, actorId: string | null = null
  for (let index = 0; index < 4; index++) {
    passes++; logicalReads += 2
    let result: HistoricalPreviewSourceResult
    try { result = await readSource() } catch { return failure("QUERY_FAILED", diagnostics()) }
    const failureShape = hasExactKeys(result, ["ok", "error"]), successShape = hasExactKeys(result, ["ok", "actorId", "boundary", "source"])
    if (!failureShape && !successShape) return failure("MALFORMED_ROW", diagnostics())
    const ok = Object.getOwnPropertyDescriptor(result, "ok")?.value
    if (typeof ok !== "boolean" || ok === failureShape) return failure("MALFORMED_ROW", diagnostics())
    if (!ok) {
      const failed = result as Extract<HistoricalPreviewSourceResult, { ok: false }>
      if (!hasExactKeys(failed.error, ["code", "message"]) || !SOURCE_FAILURE_CODES.has(failed.error.code)
        || failed.error.message !== failed.error.code) return failure("MALFORMED_ROW", diagnostics())
      return ["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "CLIENT_UNAVAILABLE"].includes(failed.error.code)
        ? failure(failed.error.code) : failure(failed.error.code, diagnostics())
    }
    const success = result as Extract<HistoricalPreviewSourceResult, { ok: true }>
    if (!isCanonicalUuid(success.actorId)) return failure("MALFORMED_ROW", diagnostics())
    let boundaryBytes: string
    try { boundaryBytes = canonicalJson(success.boundary) }
    catch { return failure("CANONICALIZATION_FAILURE", diagnostics()) }
    if (frozenBoundary !== null && boundaryBytes !== frozenBoundary) return failure("INCOMPLETE_JOIN", diagnostics())
    if (actorId !== null && actorId !== success.actorId) return failure("AUTH_ACTOR_MISMATCH", diagnostics())
    frozenBoundary = boundaryBytes; actorId = success.actorId
    opportunityRootCount = success.boundary.opportunity_root_count; quoteVersionRootCount = success.boundary.quote_version_root_count
    let source: HistoricalSourceSuccess, bytes: string, hash: string
    try { source = normalizedSource(success.source); const preimage = ["task-automation-historical-snapshot.v1", success.boundary.source_cutoffs,
      success.boundary.snapshot_cutoffs, source.opportunity_facts, source.quote_facts, source.assignment_evidence, source.quote_source_evidence,
      source.owner_facts, source.task_occupancy, source.automation_origins, source.automation_outcomes, source.automation_tombstones]
      bytes = canonicalJson(preimage); hash = canonicalHash(preimage) } catch { return failure("CANONICALIZATION_FAILURE", diagnostics()) }
    snapshots.push({ bytes, hash, result: success, source })
    const prior = index === 1 ? snapshots[0] : index === 3 ? snapshots[2] : null
    if (!prior || prior.bytes !== bytes || prior.hash !== hash) continue
    let classified: HistoricalClassificationResult
    try { classified = (deps.classify ?? buildHistoricalTaskAutomationPlan)(classificationInput(source, success.boundary.source_cutoffs,
      success.boundary.snapshot_cutoffs, hash, opportunityRootCount, quoteVersionRootCount)) } catch { return failure("CLASSIFICATION_FAILED", diagnostics()) }
    try {
      if (!validPlan(classified, success.boundary.source_cutoffs, success.boundary.snapshot_cutoffs, hash,
        opportunityRootCount + quoteVersionRootCount)) return failure("CANONICALIZATION_FAILURE", diagnostics())
      return { ok: true, schema: "task-automation-historical-preview.v1", ruleVersion: "task-automation-historical.v1",
        sourceCutoffs: success.boundary.source_cutoffs, snapshotCutoffs: success.boundary.snapshot_cutoffs, snapshotHash: hash,
        plan: classified.plan, planHash: classified.planHash, counts: classified.plan.counts,
        totalCount: classified.plan.totalCount, diagnostics: diagnostics() }
    } catch { return failure("CANONICALIZATION_FAILURE", diagnostics()) }
  }
  return failure("SNAPSHOT_NOT_CONVERGED", diagnostics())
}
