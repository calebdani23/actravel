import "server-only"
import { isProxy } from "node:util/types"
import { createClient } from "@/lib/supabase/server"
import { authorizeTaskAutomationHistoricalAdmin, type BootstrapAuthDeps } from "./task-automation-historical-auth"
import type { SnapshotCursor, SnapshotCutoffs, SourceCutoffs } from "./task-automation-historical-contract"
import { isCanonicalHash, isCanonicalTimestamp, isCanonicalUuid } from "./task-automation-historical-contract"

export type HistoricalBoundaryFailureCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH"
  | "CUTOFF_UNAVAILABLE" | "LIMIT_EXCEEDED"
type BoundaryFailure = { [Code in HistoricalBoundaryFailureCode]: { ok: false; error: { code: Code; message: Code } } }[HistoricalBoundaryFailureCode]
export type HistoricalBoundaryResult =
  | HistoricalBoundarySuccess
  | BoundaryFailure
export type HistoricalBoundarySuccess = { ok: true; source_cutoffs: SourceCutoffs; snapshot_cutoffs: SnapshotCutoffs; opportunity_root_count: number; quote_version_root_count: number }

export type HistoricalSourceFailureCode = HistoricalBoundaryFailureCode | "MALFORMED_ROW" | "INCOMPLETE_JOIN" | "QUERY_FAILED"
export type HistoricalOpportunityFact = { opportunity_id: string; created_at: string; assigned_to: string | null; deleted: boolean; archived: boolean; status_id: string; terminal: boolean }
export type HistoricalQuoteFact = { quote_version_id: string; quote_id: string; opportunity_id: string; sent_at: string; owner_id: string | null; quote_deleted: boolean; opportunity_deleted: boolean; opportunity_archived: boolean; version_status: string }
export type HistoricalAssignmentEvidence = { event_id: string; opportunity_id: string; occurred_at: string; event_type: "assigned" | "status_changed"; payload_valid: boolean; assigned_to: string | null; status_id: string | null; status_terminal: boolean }
export type HistoricalQuoteSourceEvidence = { evidence_id: string; occurred_at: string; kind: "quote_sent" | "quote_version_response" | "quote_accepted" | "quote_rejected" | "quote_expired" | "quote_cancelled" | "quote_superseded" | "whatsapp_inbound" | "payment"; quote_version_id: string | null; quote_id: string | null; opportunity_id: string; accepted_quote_version_id: string | null; payment_status: "verified" | null; payload_valid: boolean }
export type HistoricalOwnerFact = { owner_id: string; profile_exists: boolean; is_active: boolean; roles: string[] }
export type HistoricalTaskOccupancy = { id: string; created_at: string; updated_at: string; owner_id: string; lead_id: string | null; quote_id: string | null; description: string; due_at: string; status: "pending" | "in_progress" | "completed" | "canceled"; task_kind: "manual" | "follow_up" | "first_contact" | "quote_follow_up"; idempotency_key: string; automation_origin_key: string | null; legacy_provenance: boolean }
export type HistoricalAutomationOrigin = { origin_key: string; task_kind: "first_contact" | "quote_follow_up"; source_kind: "opportunity_assignment" | "quote_sent"; operation: "generate"; opportunity_id: string | null; quote_version_id: string | null; sent_event_id: string | null; anchor_at: string; due_rule_version: string; task_id: string | null; created_at: string }
export type HistoricalAutomationSourceKind = "opportunity_assignment" | "opportunity_unassigned" | "opportunity_archived" | "opportunity_terminal" | "quote_sent" | "quote_version_response" | "quote_accepted" | "quote_rejected" | "quote_expired" | "quote_cancelled" | "quote_superseded" | "whatsapp_inbound" | "payment_verified"
export type HistoricalAutomationOutcome = { outcome_key: string; source_kind: HistoricalAutomationSourceKind; source_id: string; source_key: string; source_order: number; operation: "generate" | "transfer" | "cancel" | "suppress"; origin_key: string; task_id: string | null; outcome: "applied" | "unresolved"; reason: "owner_unassigned" | "owner_inactive" | "owner_unknown" | "owner_role_invalid" | "source_ambiguous" | "identity_occupied" | null; created_at: string }
export type HistoricalAutomationTombstone = { tombstone_key: string; source_kind: HistoricalAutomationSourceKind; source_id: string; source_key: string; source_order: number; origin_key: string; reason: "pre_cutoff" | "source_invalidated"; created_at: string }
export type HistoricalSourceSuccess = {
  ok: true
  opportunity_facts: HistoricalOpportunityFact[]; quote_facts: HistoricalQuoteFact[]
  assignment_evidence: HistoricalAssignmentEvidence[]; quote_source_evidence: HistoricalQuoteSourceEvidence[]
  owner_facts: HistoricalOwnerFact[]; task_occupancy: HistoricalTaskOccupancy[]
  automation_origins: HistoricalAutomationOrigin[]; automation_outcomes: HistoricalAutomationOutcome[]
  automation_tombstones: HistoricalAutomationTombstone[]
}
export type HistoricalSourceResult = HistoricalSourceSuccess
  | { [Code in HistoricalSourceFailureCode]: { ok: false; error: { code: Code; message: Code } } }[HistoricalSourceFailureCode]

export const HISTORICAL_ROOT_PAGE_SIZE = 200
export const HISTORICAL_ROOT_MAX_PAGES = 10
export const HISTORICAL_ROOT_LIMIT = HISTORICAL_ROOT_PAGE_SIZE * HISTORICAL_ROOT_MAX_PAGES
export type HistoricalRootFamily = "opportunityRoots" | "quoteVersionRoots"
export type HistoricalRootPageRequest = {
  family: HistoricalRootFamily
  cutoff: string
  highWater: SnapshotCursor | null
  after: SnapshotCursor | null
  limit: 200 | 1
}

type RootReadCode = "MALFORMED_ROW" | "INCOMPLETE_JOIN" | "LIMIT_EXCEEDED"
export class HistoricalRootReadFailure extends Error {
  constructor(readonly code: RootReadCode) { super(code) }
}

export const HISTORICAL_JOIN_CHUNK_SIZE = 200
export async function readHistoricalJoinChunks<T>(input: {
  ids: readonly string[]
  maxRows: number
  readChunk: (request: { ids: readonly string[]; limit: number }) => Promise<readonly T[] | null>
  physicalAttempts?: () => number
}) {
  if (!Array.isArray(input.ids) || !Number.isInteger(input.maxRows) || input.maxRows < 0 || input.maxRows > 40_000
    || input.ids.some((id) => !isCanonicalUuid(id) && !isCanonicalHash(id))) throw new HistoricalRootReadFailure("MALFORMED_ROW")
  const ids = [...input.ids].sort(compareText)
  if (new Set(ids).size !== ids.length) throw new HistoricalRootReadFailure("MALFORMED_ROW")
  const rows: T[] = []
  let logicalReads = 0
  for (let start = 0; start < ids.length; start += HISTORICAL_JOIN_CHUNK_SIZE) {
    const values = await input.readChunk({ ids: ids.slice(start, start + HISTORICAL_JOIN_CHUNK_SIZE), limit: input.maxRows - rows.length + 1 })
    logicalReads += 1
    if (!Array.isArray(values)) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
    rows.push(...values)
    if (rows.length > input.maxRows) throw new HistoricalRootReadFailure("LIMIT_EXCEEDED")
  }
  return { rows, logicalReads, physicalAttempts: input.physicalAttempts?.() ?? logicalReads }
}

const SOURCE_KEYS = ["ok", "opportunity_facts", "quote_facts", "assignment_evidence", "quote_source_evidence", "owner_facts",
  "task_occupancy", "automation_origins", "automation_outcomes", "automation_tombstones"] as const
const SOURCE_CODES = new Set<HistoricalSourceFailureCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH",
  "CUTOFF_UNAVAILABLE", "LIMIT_EXCEEDED", "MALFORMED_ROW", "INCOMPLETE_JOIN", "QUERY_FAILED"])
type Validator = (value: unknown) => boolean
const malformed = (): never => { throw new HistoricalRootReadFailure("MALFORMED_ROW") }
const recordData = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || isProxy(value) || Array.isArray(value)) return null
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return null
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors)
  if (keys.some((key) => typeof key !== "string")) return null
  const result: Record<string, unknown> = {}
  for (const key of keys as string[]) {
    const descriptor = descriptors[key]
    if (!descriptor.enumerable || !("value" in descriptor)) return null
    result[key] = descriptor.value
  }
  return result
}
const arrayData = (value: unknown): unknown[] | null => {
  if (isProxy(value) || !Array.isArray(value)) return null
  const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<PropertyKey, PropertyDescriptor>, length = descriptors["length"]?.value
  if (!Number.isSafeInteger(length) || length < 0 || Reflect.ownKeys(descriptors).length !== length + 1) return null
  const result: unknown[] = []
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)]
    if (!descriptor?.enumerable || !("value" in descriptor)) return null
    result.push(descriptor.value)
  }
  return result
}
const exact = <T>(value: unknown, schema: Record<string, Validator>): T => {
  const data = recordData(value), keys = Object.keys(schema)
  if (!data || Object.keys(data).length !== keys.length || keys.some((key) => !Object.hasOwn(data, key) || !schema[key](data[key]))) return malformed()
  return Object.fromEntries(keys.map((key) => [key, data[key]])) as T
}
const uuid: Validator = isCanonicalUuid, hash: Validator = isCanonicalHash, timestamp: Validator = isCanonicalTimestamp
const text: Validator = (value) => typeof value === "string", bool: Validator = (value) => typeof value === "boolean"
const nullable = (validator: Validator): Validator => (value) => value === null || validator(value)
const values = (...allowed: readonly unknown[]): Validator => (value) => allowed.includes(value)
const order: Validator = (value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2_147_483_647
const stringArray: Validator = (value) => { const items = arrayData(value); return !!items && items.every(text) }
const SNAPSHOT_KEYS = ["opportunityRoots", "quoteVersionRoots", "assignmentEvidence", "quoteSourceEvidence", "taskOccupancy", "automationOrigins", "automationOutcomes", "automationTombstones"] as const
const decodeCursor = (value: unknown, identity: Validator): SnapshotCursor | null => {
  if (value === null) return null
  const items = arrayData(value)
  if (!items || items.length !== 2 || !timestamp(items[0]) || !identity(items[1])) return malformed()
  return [items[0] as string, items[1] as string]
}
export function decodeHistoricalBoundaryResult(value: unknown): HistoricalBoundaryResult {
  const data = recordData(value)
  if (!data || typeof data.ok !== "boolean") return malformed()
  if (!data.ok) {
    if (Object.keys(data).length !== 2 || !Object.hasOwn(data, "error")) return malformed()
    const error = recordData(data.error)
    if (!error || Object.keys(error).sort().join() !== "code,message" || typeof error.code !== "string"
      || !new Set<HistoricalBoundaryFailureCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "CUTOFF_UNAVAILABLE", "LIMIT_EXCEEDED"]).has(error.code as HistoricalBoundaryFailureCode)
      || error.message !== error.code) return malformed()
    const code = error.code as HistoricalBoundaryFailureCode
    return { ok: false, error: { code, message: code } } as HistoricalBoundaryResult
  }
  if (Object.keys(data).sort().join() !== ["ok", "source_cutoffs", "snapshot_cutoffs", "opportunity_root_count", "quote_version_root_count"].sort().join()) return malformed()
  const cutoffs = recordData(data.source_cutoffs), snapshots = recordData(data.snapshot_cutoffs)
  if (!cutoffs || Object.keys(cutoffs).sort().join() !== "opportunityAssignment,quoteSent"
    || !timestamp(cutoffs.opportunityAssignment) || !timestamp(cutoffs.quoteSent) || !snapshots
    || Object.keys(snapshots).sort().join() !== [...SNAPSHOT_KEYS].sort().join()) return malformed()
  const opportunityCount = data.opportunity_root_count, quoteCount = data.quote_version_root_count
  if (!Number.isInteger(opportunityCount) || !Number.isInteger(quoteCount) || Number(opportunityCount) < 0 || Number(quoteCount) < 0
    || Number(opportunityCount) > 2_000 || Number(quoteCount) > 2_000 || Number(opportunityCount) + Number(quoteCount) > 4_000) return malformed()
  const snapshotCutoffs = Object.fromEntries(SNAPSHOT_KEYS.map((key) => [key,
    decodeCursor(snapshots[key], key.startsWith("automation") ? hash : uuid)])) as SnapshotCutoffs
  if ((opportunityCount === 0) !== (snapshotCutoffs.opportunityRoots === null)
    || (quoteCount === 0) !== (snapshotCutoffs.quoteVersionRoots === null)) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  return { ok: true, source_cutoffs: { opportunityAssignment: cutoffs.opportunityAssignment as string, quoteSent: cutoffs.quoteSent as string },
    snapshot_cutoffs: snapshotCutoffs, opportunity_root_count: opportunityCount as number, quote_version_root_count: quoteCount as number }
}
const decodeOpportunity = (value: unknown) => exact<HistoricalOpportunityFact>(value, { opportunity_id: uuid, created_at: timestamp, assigned_to: nullable(uuid), deleted: bool, archived: bool, status_id: uuid, terminal: bool })
const decodeQuote = (value: unknown) => exact<HistoricalQuoteFact>(value, { quote_version_id: uuid, quote_id: uuid, opportunity_id: uuid, sent_at: timestamp, owner_id: nullable(uuid), quote_deleted: bool, opportunity_deleted: bool, opportunity_archived: bool, version_status: text })
const decodeAssignment = (value: unknown) => exact<HistoricalAssignmentEvidence>(value, { event_id: uuid, opportunity_id: uuid, occurred_at: timestamp, event_type: values("assigned", "status_changed"), payload_valid: bool, assigned_to: nullable(uuid), status_id: nullable(uuid), status_terminal: bool })
const QUOTE_KINDS = ["quote_sent", "quote_version_response", "quote_accepted", "quote_rejected", "quote_expired", "quote_cancelled", "quote_superseded"] as const
const decodeQuoteEvidence = (value: unknown) => exact<HistoricalQuoteSourceEvidence>(value, { evidence_id: uuid, occurred_at: timestamp, kind: values(...QUOTE_KINDS, "whatsapp_inbound", "payment"), quote_version_id: nullable(uuid), quote_id: nullable(uuid), opportunity_id: uuid, accepted_quote_version_id: nullable(uuid), payment_status: nullable(values("verified")), payload_valid: bool })
const decodeOwner = (value: unknown) => { const row = exact<HistoricalOwnerFact>(value, { owner_id: uuid, profile_exists: bool, is_active: bool, roles: stringArray }); return { ...row, roles: arrayData(row.roles) as string[] } }
const decodeTask = (value: unknown) => exact<HistoricalTaskOccupancy>(value, { id: uuid, created_at: timestamp, updated_at: timestamp, owner_id: uuid, lead_id: nullable(uuid), quote_id: nullable(uuid), description: text, due_at: timestamp, status: values("pending", "in_progress", "completed", "canceled"), task_kind: values("manual", "follow_up", "first_contact", "quote_follow_up"), idempotency_key: hash, automation_origin_key: nullable(hash), legacy_provenance: bool })
const SOURCE_KINDS = ["opportunity_assignment", "opportunity_unassigned", "opportunity_archived", "opportunity_terminal", "quote_sent", "quote_version_response", "quote_accepted", "quote_rejected", "quote_expired", "quote_cancelled", "quote_superseded", "whatsapp_inbound", "payment_verified"] as const
const decodeOrigin = (value: unknown) => exact<HistoricalAutomationOrigin>(value, { origin_key: hash, task_kind: values("first_contact", "quote_follow_up"), source_kind: values("opportunity_assignment", "quote_sent"), operation: values("generate"), opportunity_id: nullable(uuid), quote_version_id: nullable(uuid), sent_event_id: nullable(uuid), anchor_at: timestamp, due_rule_version: text, task_id: nullable(uuid), created_at: timestamp })
const decodeOutcome = (value: unknown) => exact<HistoricalAutomationOutcome>(value, { outcome_key: hash, source_kind: values(...SOURCE_KINDS), source_id: uuid, source_key: hash, source_order: order, operation: values("generate", "transfer", "cancel", "suppress"), origin_key: hash, task_id: nullable(uuid), outcome: values("applied", "unresolved"), reason: nullable(values("owner_unassigned", "owner_inactive", "owner_unknown", "owner_role_invalid", "source_ambiguous", "identity_occupied")), created_at: timestamp })
const decodeTombstone = (value: unknown) => exact<HistoricalAutomationTombstone>(value, { tombstone_key: hash, source_kind: values(...SOURCE_KINDS), source_id: uuid, source_key: hash, source_order: order, origin_key: hash, reason: values("pre_cutoff", "source_invalidated"), created_at: timestamp })
const decodeRows = <T>(value: unknown, decoder: (row: unknown) => T, identity: keyof T): T[] => {
  const source = arrayData(value); if (!source) return malformed()
  const rows = source.map(decoder), ids = rows.map((row) => row[identity])
  if (new Set(ids).size !== ids.length) return malformed()
  return rows
}

export function decodeHistoricalSourceResult(value: unknown, boundary: HistoricalBoundaryResult): HistoricalSourceResult {
  const source = recordData(value)
  if (!source || typeof source.ok !== "boolean") return malformed()
  if (!source.ok) {
    if (Object.keys(source).length !== 2 || !Object.hasOwn(source, "error")) return malformed()
    const error = recordData(source.error)
    if (!error || Object.keys(error).sort().join() !== "code,message" || typeof error.code !== "string"
      || !SOURCE_CODES.has(error.code as HistoricalSourceFailureCode) || error.message !== error.code) return malformed()
    const code = error.code as HistoricalSourceFailureCode
    return { ok: false, error: { code, message: code } } as HistoricalSourceResult
  }
  const boundaryData = recordData(boundary)
  if (!boundaryData) return malformed()
  if (boundaryData.ok !== true || SOURCE_KEYS.some((key) => !Object.hasOwn(source, key))) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  if (!Number.isInteger(boundaryData.opportunity_root_count) || !Number.isInteger(boundaryData.quote_version_root_count)) return malformed()
  if (Object.keys(source).length !== SOURCE_KEYS.length) return malformed()
  const success: HistoricalSourceSuccess = { ok: true,
    opportunity_facts: decodeRows(source.opportunity_facts, decodeOpportunity, "opportunity_id"),
    quote_facts: decodeRows(source.quote_facts, decodeQuote, "quote_version_id"),
    assignment_evidence: decodeRows(source.assignment_evidence, decodeAssignment, "event_id"),
    quote_source_evidence: decodeRows(source.quote_source_evidence, decodeQuoteEvidence, "evidence_id"),
    owner_facts: decodeRows(source.owner_facts, decodeOwner, "owner_id"), task_occupancy: decodeRows(source.task_occupancy, decodeTask, "id"),
    automation_origins: decodeRows(source.automation_origins, decodeOrigin, "origin_key"),
    automation_outcomes: decodeRows(source.automation_outcomes, decodeOutcome, "outcome_key"),
    automation_tombstones: decodeRows(source.automation_tombstones, decodeTombstone, "tombstone_key") }
  if (success.opportunity_facts.length !== boundaryData.opportunity_root_count || success.quote_facts.length !== boundaryData.quote_version_root_count)
    throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  if (success.assignment_evidence.length > 20_000 || success.quote_source_evidence.length > 20_000
    || success.assignment_evidence.length + success.quote_source_evidence.length > 40_000) throw new HistoricalRootReadFailure("LIMIT_EXCEEDED")
  const opportunities = new Set(success.opportunity_facts.map((row) => row.opportunity_id)), versions = new Set(success.quote_facts.map((row) => row.quote_version_id))
  const quoteOpportunities = new Set(success.quote_facts.map((row) => row.opportunity_id)), expectedOwners = new Set<string>()
  const quoteScopes = new Map<string, string>()
  for (const row of success.quote_facts) { const scope = quoteScopes.get(row.quote_id); if (scope && scope !== row.opportunity_id) return malformed(); quoteScopes.set(row.quote_id, row.opportunity_id) }
  for (const row of success.opportunity_facts) if (row.assigned_to) expectedOwners.add(row.assigned_to)
  for (const row of success.quote_facts) if (row.owner_id) expectedOwners.add(row.owner_id)
  const ownerIds = new Set(success.owner_facts.map((row) => row.owner_id))
  if ([...expectedOwners].some((owner) => !ownerIds.has(owner))) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  if ([...ownerIds].some((owner) => !expectedOwners.has(owner)) || success.assignment_evidence.some((row) => !opportunities.has(row.opportunity_id))) return malformed()
  for (const row of success.assignment_evidence) {
    const assigned = row.event_type === "assigned"
    if (assigned ? row.status_id !== null || row.status_terminal || !row.payload_valid && row.assigned_to !== null
      : row.assigned_to !== null || row.payload_valid !== (row.status_id !== null)) return malformed()
  }
  for (const row of success.quote_source_evidence) {
    if (QUOTE_KINDS.includes(row.kind as typeof QUOTE_KINDS[number])) {
      if (row.quote_version_id === null || !versions.has(row.quote_version_id) || row.quote_id === null
        || row.accepted_quote_version_id !== null || row.payment_status !== null || row.kind !== "quote_version_response" && !row.payload_valid) return malformed()
    } else if (row.kind === "whatsapp_inbound") {
      if (row.quote_version_id !== null || row.quote_id !== null || row.accepted_quote_version_id !== null || row.payment_status !== null
        || !row.payload_valid || !quoteOpportunities.has(row.opportunity_id)) return malformed()
    } else if (row.quote_version_id !== null || row.quote_id !== null || row.payment_status !== "verified" || !row.payload_valid
      || !quoteOpportunities.has(row.opportunity_id)) return malformed()
  }
  for (const row of success.owner_facts) if (!row.profile_exists && (row.is_active || row.roles.length > 0)
    || row.roles.some((role, index) => index > 0 && row.roles[index - 1] >= role)) return malformed()
  for (const row of success.task_occupancy) if (row.lead_id !== null && row.quote_id !== null) return malformed()
  for (const row of success.automation_origins) if (row.task_kind === "first_contact"
    ? row.source_kind !== "opportunity_assignment" || row.opportunity_id === null || !opportunities.has(row.opportunity_id) || row.quote_version_id !== null || row.sent_event_id !== null
    : row.source_kind !== "quote_sent" || row.opportunity_id !== null || row.quote_version_id === null || !versions.has(row.quote_version_id) || row.sent_event_id === null) return malformed()
  for (const row of success.automation_outcomes) {
    const generation = row.source_kind === "opportunity_assignment" ? row.operation === "generate" || row.operation === "transfer"
      : row.source_kind === "quote_sent" ? row.operation === "generate" : row.operation === "cancel" || row.operation === "suppress"
    if (!generation || row.outcome === "applied" && row.reason !== null || row.outcome === "unresolved" && row.reason === null) return malformed()
  }
  return success
}

const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
const compareCursor = (left: SnapshotCursor, right: SnapshotCursor) => compareText(left[0], right[0]) || compareText(left[1], right[1])
const validCursor = (value: unknown): value is SnapshotCursor => Array.isArray(value) && value.length === 2
  && isCanonicalTimestamp(value[0]) && isCanonicalUuid(value[1])

export async function readHistoricalRootKeyset<T extends { cursor: SnapshotCursor }>(input: {
  family: HistoricalRootFamily
  cutoff: string
  highWater: SnapshotCursor | null
  census: number
  readPage: (request: HistoricalRootPageRequest) => Promise<readonly T[]>
}): Promise<T[]> {
  if (!isCanonicalTimestamp(input.cutoff) || !Number.isInteger(input.census) || input.census < 0) throw new HistoricalRootReadFailure("MALFORMED_ROW")
  if (input.census > HISTORICAL_ROOT_LIMIT) throw new HistoricalRootReadFailure("LIMIT_EXCEEDED")
  if (input.highWater !== null && !validCursor(input.highWater)) throw new HistoricalRootReadFailure("MALFORMED_ROW")
  if ((input.census === 0) !== (input.highWater === null)) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  const rows: T[] = []
  let after: SnapshotCursor | null = null
  for (let page = 0; rows.length < input.census && page < HISTORICAL_ROOT_MAX_PAGES; page += 1) {
    const values = await input.readPage({ family: input.family, cutoff: input.cutoff, highWater: input.highWater, after, limit: HISTORICAL_ROOT_PAGE_SIZE })
    if (!Array.isArray(values) || values.length === 0 || values.length > HISTORICAL_ROOT_PAGE_SIZE) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
    for (const value of values) {
      if (!value || !validCursor(value.cursor) || value.cursor[0] >= input.cutoff || after && compareCursor(value.cursor, after) <= 0
        || input.highWater && compareCursor(value.cursor, input.highWater) > 0) throw new HistoricalRootReadFailure("MALFORMED_ROW")
      rows.push(value); after = value.cursor
    }
    if (rows.length > input.census) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  }
  if (rows.length !== input.census) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  const sentinel = await input.readPage({ family: input.family, cutoff: input.cutoff, highWater: input.highWater, after, limit: 1 })
  if (!Array.isArray(sentinel) || sentinel.length > 1) throw new HistoricalRootReadFailure("INCOMPLETE_JOIN")
  if (sentinel.length) throw new HistoricalRootReadFailure(input.census === HISTORICAL_ROOT_LIMIT ? "LIMIT_EXCEEDED" : "INCOMPLETE_JOIN")
  return rows
}

export type HistoricalPreviewSourceFailureCode = HistoricalSourceFailureCode | "CLIENT_UNAVAILABLE"
type SourceFailure = { [Code in HistoricalPreviewSourceFailureCode]: { ok: false; error: { code: Code; message: Code } } }[HistoricalPreviewSourceFailureCode]
export type HistoricalPreviewSourceResult =
  | { ok: true; actorId: string; boundary: HistoricalBoundarySuccess; source: HistoricalSourceSuccess }
  | SourceFailure
type RpcResult = { data: unknown; error: unknown }
export type HistoricalPreviewSourceDeps = {
  auth?: BootstrapAuthDeps
  createSourceClient?: () => Promise<unknown>
  invokeBoundary?: (client: unknown, args: { p_expected_actor_id: string }) => Promise<RpcResult>
  invokeSource?: (client: unknown, args: { p_expected_actor_id: string; p_boundaries: HistoricalBoundarySuccess }) => Promise<RpcResult>
}
type ServerClient = Awaited<ReturnType<typeof createClient>>
const sourceFailure = <Code extends HistoricalPreviewSourceFailureCode>(code: Code): SourceFailure =>
  ({ ok: false, error: { code, message: code } }) as SourceFailure

export async function readTaskAutomationHistoricalPreviewSource(deps: HistoricalPreviewSourceDeps = {}): Promise<HistoricalPreviewSourceResult> {
  let auth
  try { auth = await authorizeTaskAutomationHistoricalAdmin("CLIENT_UNAVAILABLE", deps.auth) }
  catch { return sourceFailure("CLIENT_UNAVAILABLE") }
  if (!auth.ok) return auth
  let client: unknown
  try { client = await (deps.createSourceClient ?? createClient)() }
  catch { return sourceFailure("CLIENT_UNAVAILABLE") }
  try {
    const boundaryRpc = await (deps.invokeBoundary ?? ((value, args) =>
      (value as ServerClient).rpc("read_task_automation_historical_boundaries", args) as unknown as Promise<RpcResult>))(client, { p_expected_actor_id: auth.actorId })
    if (!boundaryRpc || boundaryRpc.error !== null) return sourceFailure("QUERY_FAILED")
    const boundary = decodeHistoricalBoundaryResult(boundaryRpc.data)
    if (!boundary.ok) return boundary
    const sourceRpc = await (deps.invokeSource ?? ((value, args) =>
      (value as ServerClient).rpc("read_task_automation_historical_sources", args as never) as unknown as Promise<RpcResult>))
      (client, { p_expected_actor_id: auth.actorId, p_boundaries: boundary })
    if (!sourceRpc || sourceRpc.error !== null) return sourceFailure("QUERY_FAILED")
    const source = decodeHistoricalSourceResult(sourceRpc.data, boundary)
    return source.ok ? { ok: true, actorId: auth.actorId, boundary, source } : source
  } catch (error) {
    return error instanceof HistoricalRootReadFailure ? sourceFailure(error.code) : sourceFailure("QUERY_FAILED")
  }
}
