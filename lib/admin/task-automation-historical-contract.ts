import { createHash } from "node:crypto"
import { types as utilTypes } from "node:util"

export const DISPOSITIONS = [
  "apply/generate", "apply/suppress", "already/projected", "already/suppressed",
  "excluded/not-actionable", "manual-review/owner-invalid",
  "manual-review/context-invalid", "collision/manual-review",
] as const
export type HistoricalDisposition = typeof DISPOSITIONS[number]

export type HistoricalReason =
  | "ELIGIBLE_GENERATE" | "SOURCE_INVALIDATED" | "ALREADY_PROJECTED" | "ALREADY_SUPPRESSED"
  | "OPPORTUNITY_NOT_OPERATIONAL" | "QUOTE_NOT_OPERATIONAL"
  | "OWNER_UNASSIGNED" | "PROFILE_MISSING" | "PROFILE_INACTIVE" | "ROLE_INVALID"
  | "ASSIGNMENT_EVIDENCE_MISSING" | "ASSIGNMENT_EVIDENCE_CONTRADICTORY"
  | "FIRST_SENT_EVENT_MISSING" | "FIRST_SENT_EVENT_CONTRADICTORY" | "SOURCE_AMBIGUOUS"
  | "INVALIDATION_EVIDENCE_MISSING" | "DUE_UNSUPPORTED"
  | "IDENTITY_OCCUPIED" | "STATE_MISMATCH" | "DUPLICATE_SOURCE_STATE" | "SOURCE_ORDER_EXHAUSTED"

export const DISPOSITION_REASONS = Object.freeze({
  "apply/generate": Object.freeze(["ELIGIBLE_GENERATE"] as const),
  "apply/suppress": Object.freeze(["SOURCE_INVALIDATED"] as const),
  "already/projected": Object.freeze(["ALREADY_PROJECTED"] as const),
  "already/suppressed": Object.freeze(["ALREADY_SUPPRESSED"] as const),
  "excluded/not-actionable": Object.freeze(["OPPORTUNITY_NOT_OPERATIONAL", "QUOTE_NOT_OPERATIONAL"] as const),
  "manual-review/owner-invalid": Object.freeze(["OWNER_UNASSIGNED", "PROFILE_MISSING", "PROFILE_INACTIVE", "ROLE_INVALID"] as const),
  "manual-review/context-invalid": Object.freeze(["ASSIGNMENT_EVIDENCE_MISSING", "ASSIGNMENT_EVIDENCE_CONTRADICTORY", "FIRST_SENT_EVENT_MISSING", "FIRST_SENT_EVENT_CONTRADICTORY", "SOURCE_AMBIGUOUS", "INVALIDATION_EVIDENCE_MISSING", "DUE_UNSUPPORTED"] as const),
  "collision/manual-review": Object.freeze(["IDENTITY_OCCUPIED", "STATE_MISMATCH", "DUPLICATE_SOURCE_STATE", "SOURCE_ORDER_EXHAUSTED"] as const),
})

export type SourceCutoffs = { opportunityAssignment: string; quoteSent: string }
export type SnapshotCursor = readonly [createdAt: string, identity: string]
export type SnapshotCutoffs = {
  opportunityRoots: SnapshotCursor | null
  quoteVersionRoots: SnapshotCursor | null
  assignmentEvidence: SnapshotCursor | null
  quoteSourceEvidence: SnapshotCursor | null
  taskOccupancy: SnapshotCursor | null
  automationOrigins: SnapshotCursor | null
  automationOutcomes: SnapshotCursor | null
  automationTombstones: SnapshotCursor | null
}
export type DispositionCounts = readonly [number, number, number, number, number, number, number, number]
export type HistoricalSourceKind = "opportunity_assignment" | "quote_sent"
export type OperationSourceKind = HistoricalSourceKind
  | "opportunity_unassigned" | "opportunity_archived" | "opportunity_terminal"
  | "quote_version_response" | "quote_accepted" | "quote_rejected" | "quote_expired"
  | "quote_cancelled" | "quote_superseded" | "whatsapp_inbound" | "payment_verified"
export type HistoricalAction = "generate" | "suppress"
export type TaskKind = "first_contact" | "quote_follow_up"
export type DueRuleVersion = "mx-calendar.v1" | "elapsed-48h.v1"

export type HistoricalPlanRow = {
  ordinal: number
  sourceKind: HistoricalSourceKind
  rootId: string
  anchorAt: string | null
  sourceId: string | null
  ownerId: string | null
  opportunityId: string | null
  quoteId: string | null
  quoteVersionId: string | null
  sentEventId: string | null
  disposition: HistoricalDisposition
  reason: HistoricalReason
  action: HistoricalAction | null
  operationSourceKind: OperationSourceKind | null
  operationSourceId: string | null
  sourceKey: string | null
  sourceOrder: number | null
  originKey: string | null
  taskId: string | null
  taskKind: TaskKind | null
  dueRuleVersion: DueRuleVersion | null
  dueAt: string | null
  outcomeKey: string | null
  tombstoneKey: string | null
}

export type HistoricalPlan = {
  schema: "task-automation-historical-plan.v1"
  ruleVersion: "task-automation-historical.v1"
  sourceCutoffs: SourceCutoffs
  snapshotCutoffs: SnapshotCutoffs
  snapshotHash: string
  rows: HistoricalPlanRow[]
  counts: DispositionCounts
  totalCount: number
}

export type AssignmentEvidenceFact = {
  eventId: string
  opportunityId: string
  occurredAt: string
  assignedTo: string | null
}

export type QuoteEvidenceFact =
  | {
    kind: "quote_sent" | "quote_version_response" | "quote_accepted" | "quote_rejected" | "quote_expired" | "quote_cancelled" | "quote_superseded"
    eventId: string; quoteVersionId: string; quoteId: string; opportunityId: string; occurredAt: string
  }
  | { kind: "whatsapp_inbound"; eventId: string; opportunityId: string; occurredAt: string }
  | {
    kind: "payment"; paymentId: string; opportunityId: string; acceptedQuoteVersionId: string | null
    status: "received" | "verified"; occurredAt: string
  }

export const CANONICAL_LIMITS = Object.freeze({
  rootsPerFamily: 2_000,
  totalRows: 4_000,
  evidencePerFamily: 20_000,
  totalEvidence: 40_000,
  rowBytes: 4_096,
  emptyPlanBytes: 65_536,
  planBytes: 16_777_216,
  snapshotBytes: 33_554_432,
})

class ClassificationError<TCode extends string> extends Error {
  constructor(readonly code: TCode) { super(code); this.name = code }
}
export class IncompleteFacts extends ClassificationError<"IncompleteFacts"> { constructor() { super("IncompleteFacts") } }
export class InvalidBoundary extends ClassificationError<"InvalidBoundary"> { constructor() { super("InvalidBoundary") } }
export class InvalidFact extends ClassificationError<"InvalidFact"> { constructor() { super("InvalidFact") } }
export class InvariantViolation extends ClassificationError<"InvariantViolation"> { constructor() { super("InvariantViolation") } }
export class CanonicalizationFailure extends ClassificationError<"CanonicalizationFailure"> { constructor() { super("CanonicalizationFailure") } }
export const CLASSIFICATION_FAILURE_PRECEDENCE = [
  "IncompleteFacts", "InvalidBoundary", "InvalidFact", "InvariantViolation", "CanonicalizationFailure",
] as const

const encoder = new TextEncoder()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const HASH = /^[0-9a-f]{64}$/
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/

function fail(): never { throw new CanonicalizationFailure() }
function byteCompare(left: string, right: string) {
  const a = encoder.encode(left), b = encoder.encode(right), length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index++) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}

function serialize(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail()
    return String(value)
  }
  if (typeof value !== "object" || utilTypes.isProxy(value)) fail()
  if (ancestors.has(value)) fail()
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value)
      const expected = new Set(["length", ...Array.from({ length: value.length }, (_, index) => String(index))])
      if (keys.length !== expected.size || keys.some((key) => typeof key !== "string" || !expected.has(key))) fail()
      const items: string[] = []
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail()
        items.push(serialize(descriptor.value, ancestors))
      }
      return `[${items.join(",")}]`
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) fail()
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== "string")) fail()
    const entries = (keys as string[]).sort(byteCompare).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail()
      return `${JSON.stringify(key)}:${serialize(descriptor.value, ancestors)}`
    })
    return `{${entries.join(",")}}`
  } catch (error) {
    if (error instanceof CanonicalizationFailure) throw error
    return fail()
  } finally {
    ancestors.delete(value)
  }
}

export function canonicalJson(value: unknown) { return serialize(value, new WeakSet()) }
export function canonicalBytes(value: unknown) { return encoder.encode(canonicalJson(value)) }
export function canonicalHash(value: unknown) { return createHash("sha256").update(canonicalBytes(value)).digest("hex") }
export function assertCanonicalByteLimit(value: unknown, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 0) fail()
  const length = canonicalBytes(value).byteLength
  if (length > limit) fail()
  return length
}
export function isCanonicalUuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value) }
export function isCanonicalHash(value: unknown): value is string { return typeof value === "string" && HASH.test(value) }

export function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = TIMESTAMP.exec(value)
  if (!match) return false
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month - 1]
}

export function isDispositionCounts(value: unknown): value is DispositionCounts {
  if (!value || typeof value !== "object" || utilTypes.isProxy(value)) return false
  try {
    if (!Array.isArray(value)) return false
    const expectedKeys = new Set(["length", ...DISPOSITIONS.map((_, index) => String(index))])
    const keys = Reflect.ownKeys(value)
    if (keys.length !== expectedKeys.size || keys.some((key) => typeof key !== "string" || !expectedKeys.has(key))) return false
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
    if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== DISPOSITIONS.length) return false
    let total = 0
    for (let index = 0; index < DISPOSITIONS.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return false
      const count = descriptor.value
      if (!Number.isInteger(count) || count < 0 || count > CANONICAL_LIMITS.totalRows) return false
      total += count
    }
    return total <= CANONICAL_LIMITS.totalRows
  } catch { return false }
}

export function hasExactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || utilTypes.isProxy(value)) return false
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false
    const keys = Reflect.ownKeys(value)
    if (keys.length !== expected.length || keys.some((key) => typeof key !== "string" || !expected.includes(key))) return false
    return keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return !!descriptor && "value" in descriptor && descriptor.enumerable
    })
  } catch { return false }
}

export function deterministicTaskUuid(originKey: string) {
  if (!isCanonicalHash(originKey)) throw new InvalidFact()
  const bytes = createHash("sha256").update(canonicalBytes(["task-automation-historical-task-id.v1", originKey])).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
