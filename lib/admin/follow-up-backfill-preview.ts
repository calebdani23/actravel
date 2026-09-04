export type OwnerRole = "admin" | "manager" | "asesor"
export type OwnerFact =
  | { tag: "active"; ownerId: string; roles: OwnerRole[] }
  | { tag: "unassigned" }
  | { tag: "missing-profile"; ownerId: string }
  | { tag: "inactive-profile"; ownerId: string }
  | { tag: "invalid-role"; ownerId: string }

export type Disposition =
  | "eligible" | "invalid-date/no-task" | "manual-review/unassigned-owner"
  | "excluded/lead-not-operational" | "excluded/non-selected-history"
  | "already-converted" | "collision/manual-review"
export type Reason =
  | "ELIGIBLE" | "INVALID_DATE_NO_TASK" | "UNASSIGNED_OWNER" | "PROFILE_MISSING"
  | "PROFILE_INACTIVE" | "ROLE_INVALID" | "LEAD_NOT_OPERATIONAL"
  | "NON_SELECTED_HISTORY" | "ALREADY_CONVERTED" | "DUPLICATE_SOURCE"
  | "SOURCE_MISMATCH" | "IDEMPOTENCY_COLLISION" | "OWNER_LEAD_COLLISION"

export type FollowUpFact = {
  eventId: string
  leadId: string
  createdAt: string
  followUpAt: unknown
  hasNote: boolean
  owner: OwnerFact
  leadOperational: boolean
}
export type FutureFollowUpTask = {
  status: "pending"; task_kind: "follow_up"; owner_id: string; lead_id: string; quote_id: null
  description: "Follow up with lead"; due_at: string; source_due_at: string; source_event_id: string
  source_event_type: "follow_up_registered"; source_event_created_at: string
  source_payload: { followUpAt: string; hasNote: boolean }
  metadata: { schema: "follow_up_task.v1"; source_event_id: string; source_event_type: "follow_up_registered"; owner_id: string; lead_id: string }
  idempotency_key: string
}
export type ExistingTaskFact = {
  id: string; status: string; task_kind: string; owner_id: string; lead_id: string; quote_id: string | null
  description: string; due_at: string; source_due_at: string; source_event_id: string; source_event_type: string
  source_event_created_at: string; source_payload: { followUpAt: unknown; hasNote: unknown }
  metadata: Record<string, unknown>; idempotency_key: string; created_at?: string; updated_at?: string
}
export type TaskOccupancyFact = {
  id: string
  owner_id: string
  lead_id: string | null
  idempotency_key: string
}
export type FollowUpBackfillInput = {
  ruleVersion: string
  cutoffCreatedAt: string
  cutoffId: string
  events: readonly FollowUpFact[]
  taskOccupancies: readonly TaskOccupancyFact[]
  existingTasks?: readonly ExistingTaskFact[]
}
export type PreviewRow = [string, string, string | null, string, string | null, boolean | null, string | null, Disposition, Reason]
export type CanonicalPlan = [string, string, string, PreviewRow[], [number, number, number, number, number, number, number], number, 0, 0, 0, false]
export type PreviewResult = { rows: PreviewRow[]; counts: [number, number, number, number, number, number, number]; totalCount: number; tasks: FutureFollowUpTask[]; canonicalPlan: CanonicalPlan; canonicalBytes: Uint8Array; canonicalHash: string }

export class IncompleteFacts extends Error { readonly code = "IncompleteFacts" }
export class InvalidBoundary extends Error { readonly code = "InvalidBoundary" }
export class InvalidFact extends Error { readonly code = "InvalidFact" }
export class InvariantViolation extends Error { readonly code = "InvariantViolation" }
export class CanonicalizationFailure extends Error { readonly code = "CanonicalizationFailure" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2}))?$/

/** Parse the intentionally narrow date grammar and return canonical UTC microseconds. */
export function parseUtcDate(value: unknown): string {
  if (typeof value !== "string") throw new InvalidFact("InvalidFact")
  const match = DATE.exec(value)
  if (!match) throw new InvalidFact("InvalidFact")
  const [, ys, ms, ds, hs, mins, secs, fraction = "", zone] = match
  const year = Number(ys), month = Number(ms), day = Number(ds)
  const hour = hs === undefined ? 0 : Number(hs), minute = mins === undefined ? 0 : Number(mins), second = secs === undefined ? 0 : Number(secs)
  if (year < 1970 || year > 9999 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) throw new InvalidFact("InvalidFact")
  const nextMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > nextMonth) throw new InvalidFact("InvalidFact")
  let offset = 0
  if (zone && zone !== "Z") {
    const sign = zone[0] === "+" ? 1 : -1
    const oh = Number(zone.slice(1, 3)), om = Number(zone.slice(4))
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0) || (sign < 0 && oh === 0 && om === 0)) throw new InvalidFact("InvalidFact")
    offset = sign * (oh * 60 + om)
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60000
  const date = new Date(utc)
  if (date.getUTCFullYear() < 1970 || date.getUTCFullYear() > 9999) throw new InvalidFact("InvalidFact")
  const normalized = `${date.getUTCFullYear().toString().padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}.${(fraction + "000000").slice(0, 6)}Z`
  return normalized
}

function invalid(condition: boolean, message = "InvalidFact"): asserts condition {
  if (!condition) throw new InvalidFact(message)
}
function validateOwner(owner: unknown): asserts owner is OwnerFact {
  invalid(!!owner && typeof owner === "object")
  const value = owner as Record<string, unknown>
  if (value.tag === "unassigned") { invalid(Object.keys(value).length === 1); return }
  invalid(typeof value.ownerId === "string" && UUID.test(value.ownerId))
  if (value.tag === "active") {
    invalid(Object.keys(value).length === 3)
    invalid(Array.isArray(value.roles) && value.roles.length > 0)
    const roles = value.roles as unknown[]
    invalid(roles.every((r) => r === "admin" || r === "manager" || r === "asesor"))
    invalid(roles.every((r, i) => i === 0 || String(roles[i - 1]) < String(r)))
    return
  }
  invalid(value.tag === "missing-profile" || value.tag === "inactive-profile" || value.tag === "invalid-role")
  invalid(Object.keys(value).length === 2)
}

function rowFor(event: FollowUpFact, disposition: Disposition, reason: Reason, due: string | null, ownerId: string | null, selected: boolean): PreviewRow {
  if (!selected) return [event.eventId, event.leadId, null, event.createdAt, null, null, null, "excluded/non-selected-history", "NON_SELECTED_HISTORY"]
  if (disposition === "invalid-date/no-task" || disposition === "excluded/lead-not-operational") return [event.eventId, event.leadId, null, event.createdAt, null, null, null, disposition, reason]
  if (disposition === "manual-review/unassigned-owner") return [event.eventId, event.leadId, ownerId, event.createdAt, null, null, null, disposition, reason]
  return [event.eventId, event.leadId, ownerId, event.createdAt, due, event.hasNote, typeof event.followUpAt === "string" ? event.followUpAt : null, disposition, reason]
}

/** RFC-independent canonical JSON: ASCII key order, ordered arrays, exact primitives. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object") {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`
  }
  throw new CanonicalizationFailure("CanonicalizationFailure")
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function taskFor(event: FollowUpFact & { created: string; due: string }, ownerId: string): FutureFollowUpTask {
  const sourceId = event.eventId.toLowerCase()
  const task: FutureFollowUpTask = {
    status: "pending", task_kind: "follow_up", owner_id: ownerId, lead_id: event.leadId, quote_id: null,
    description: "Follow up with lead", due_at: event.due, source_due_at: event.due, source_event_id: sourceId,
    source_event_type: "follow_up_registered", source_event_created_at: event.created,
    source_payload: { followUpAt: event.followUpAt as string, hasNote: event.hasNote },
    metadata: { schema: "follow_up_task.v1", source_event_id: sourceId, source_event_type: "follow_up_registered", owner_id: ownerId, lead_id: event.leadId },
    idempotency_key: "",
  }
  const preimage = new TextEncoder().encode(`follow-up-task:v1|source_event_id=${sourceId}`)
  task.idempotency_key = sha256(preimage)
  return task
}

const GENERATED = new Set(["id", "created_at", "updated_at"])
function taskEqual(a: FutureFollowUpTask, b: ExistingTaskFact): boolean {
  const strip = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([key]) => !GENERATED.has(key)))
  return canonicalJson(strip(a as unknown as Record<string, unknown>)) === canonicalJson(strip(b as unknown as Record<string, unknown>))
}

function validateExistingTask(task: unknown): asserts task is ExistingTaskFact {
  invalid(!!task && typeof task === "object")
  const value = task as Record<string, unknown>
  invalid(typeof value.id === "string" && UUID.test(value.id) && value.id === value.id.toLowerCase())
  invalid(value.status === "pending" && value.task_kind === "follow_up" && value.quote_id === null)
  invalid(typeof value.owner_id === "string" && UUID.test(value.owner_id) && value.owner_id === value.owner_id.toLowerCase())
  invalid(typeof value.lead_id === "string" && UUID.test(value.lead_id) && value.lead_id === value.lead_id.toLowerCase())
  invalid(typeof value.description === "string" && typeof value.source_event_type === "string")
  invalid(typeof value.source_event_id === "string" && UUID.test(value.source_event_id) && value.source_event_id === value.source_event_id.toLowerCase())
  for (const key of ["due_at", "source_due_at", "source_event_created_at"]) {
    invalid(typeof value[key] === "string")
    try { invalid(parseUtcDate(value[key]) === value[key]) } catch { throw new InvalidFact("InvalidFact") }
  }
  invalid(typeof value.idempotency_key === "string" && /^[0-9a-f]{64}$/.test(value.idempotency_key))
  const payload = value.source_payload as Record<string, unknown>
  invalid(!!value.source_payload && typeof value.source_payload === "object" && Object.keys(payload).sort().join(",") === "followUpAt,hasNote" && typeof payload.followUpAt === "string" && typeof payload.hasNote === "boolean")
  const metadata = value.metadata as Record<string, unknown>
  invalid(!!value.metadata && typeof value.metadata === "object" && Object.keys(metadata).sort().join(",") === "lead_id,owner_id,schema,source_event_id,source_event_type")
  invalid(typeof metadata.schema === "string" && typeof metadata.source_event_id === "string" && typeof metadata.source_event_type === "string" && typeof metadata.owner_id === "string" && typeof metadata.lead_id === "string")
}

function validateTaskOccupancy(task: unknown): asserts task is TaskOccupancyFact {
  invalid(!!task && typeof task === "object")
  const value = task as Record<string, unknown>
  invalid(Object.keys(value).length === 4)
  invalid(typeof value.id === "string" && UUID.test(value.id) && value.id === value.id.toLowerCase())
  invalid(typeof value.owner_id === "string" && UUID.test(value.owner_id) && value.owner_id === value.owner_id.toLowerCase())
  invalid(value.lead_id === null || (typeof value.lead_id === "string" && UUID.test(value.lead_id) && value.lead_id === value.lead_id.toLowerCase()))
  invalid(typeof value.idempotency_key === "string" && /^[0-9a-f]{64}$/.test(value.idempotency_key))
}

export function classifyFollowUpBackfillPreview(input: FollowUpBackfillInput): PreviewResult {
  if (!input || !Array.isArray(input.events) || !Array.isArray(input.taskOccupancies) || typeof input.ruleVersion !== "string" || typeof input.cutoffCreatedAt !== "string" || typeof input.cutoffId !== "string") throw new IncompleteFacts("IncompleteFacts")
  if (input.events.length > 2000) throw new CanonicalizationFailure("CanonicalizationFailure")
  if (input.taskOccupancies.length > 2000) throw new CanonicalizationFailure("CanonicalizationFailure")
  const existing = input.existingTasks ?? []
  if (existing.length > 2000) throw new CanonicalizationFailure("CanonicalizationFailure")
  let cutoff: string
  try { cutoff = parseUtcDate(input.cutoffCreatedAt) } catch { throw new InvalidBoundary("InvalidBoundary") }
  if (cutoff !== input.cutoffCreatedAt || !UUID.test(input.cutoffId) || input.cutoffId !== input.cutoffId.toLowerCase()) throw new InvalidBoundary("InvalidBoundary")
  const seen = new Set<string>(), facts: (FollowUpFact & { created: string; due: string | null })[] = []
  for (const raw of input.events) {
    if (!raw || typeof raw !== "object" || typeof raw.eventId !== "string" || typeof raw.leadId !== "string" || typeof raw.createdAt !== "string" || typeof raw.hasNote !== "boolean" || typeof raw.leadOperational !== "boolean" || !("followUpAt" in raw) || !("owner" in raw)) throw new IncompleteFacts("IncompleteFacts")
    invalid(UUID.test(raw.eventId) && raw.eventId === raw.eventId.toLowerCase() && UUID.test(raw.leadId) && raw.leadId === raw.leadId.toLowerCase())
    invalid(!seen.has(raw.eventId)); seen.add(raw.eventId)
    let created: string
    try { created = parseUtcDate(raw.createdAt) } catch { throw new InvalidFact("InvalidFact") }
    invalid(created === raw.createdAt)
    if (created > cutoff || (created === cutoff && raw.eventId > input.cutoffId)) throw new InvalidFact("InvalidFact")
    validateOwner(raw.owner)
    let due: string | null = null
    if (raw.followUpAt !== null && raw.followUpAt !== undefined) {
      try { due = parseUtcDate(raw.followUpAt) } catch { due = null }
    }
    facts.push({ ...raw, created, due })
  }
  const selected = new Set<string>(), groups = new Map<string, typeof facts>()
  for (const fact of facts) {
    const group = groups.get(fact.leadId)
    if (group) group.push(fact)
    else groups.set(fact.leadId, [fact])
  }
  for (const all of groups.values()) {
    const latest = [...all].sort((a, b) => b.created.localeCompare(a.created) || b.eventId.localeCompare(a.eventId))[0]
    if (!latest.leadOperational) { selected.add(latest.eventId); continue }
    const candidates = all.filter((f) => f.leadOperational)
    const valid = candidates.filter((f) => f.due !== null)
    const pool = valid.length ? valid : candidates
    pool.sort((a, b) => b.created.localeCompare(a.created) || b.eventId.localeCompare(a.eventId))
    if (pool[0]) selected.add(pool[0].eventId)
    if (!candidates.length) selected.add(latest.eventId)
  }
  const counts = [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number]
  const occupancyIds = new Set<string>(), ownerIdempotency = new Set<string>(), ownerLead = new Set<string>()
  for (const task of input.taskOccupancies) {
    validateTaskOccupancy(task)
    if (occupancyIds.has(task.id)) throw new InvalidFact("InvalidFact")
    occupancyIds.add(task.id)
    ownerIdempotency.add(`${task.owner_id}|${task.idempotency_key}`)
    if (task.lead_id !== null) ownerLead.add(`${task.owner_id}|${task.lead_id}`)
  }
  const existingIds = new Set<string>()
  const sourceMatches = new Map<string, ExistingTaskFact[]>()
  const occupancyById = new Map<string, TaskOccupancyFact>()
  for (const occupancy of input.taskOccupancies) occupancyById.set(occupancy.id, occupancy)
  for (const task of existing) {
    validateExistingTask(task)
    if (existingIds.has(task.id)) throw new InvalidFact("InvalidFact")
    existingIds.add(task.id)
    const bySource = sourceMatches.get(task.source_event_id) ?? []
    bySource.push(task)
    sourceMatches.set(task.source_event_id, bySource)
    const occupancy = occupancyById.get(task.id)
    if (!occupancy || occupancy.owner_id !== task.owner_id || occupancy.lead_id !== task.lead_id || occupancy.idempotency_key !== task.idempotency_key) throw new InvariantViolation("InvariantViolation")
  }
  const tasks: FutureFollowUpTask[] = []
  const rows = facts.map((event) => {
    if (!selected.has(event.eventId)) { counts[4]++; return rowFor(event, "excluded/non-selected-history", "NON_SELECTED_HISTORY", null, null, false) }
    if (!event.leadOperational) { counts[3]++; return rowFor(event, "excluded/lead-not-operational", "LEAD_NOT_OPERATIONAL", null, null, true) }
    if (!event.due) { counts[1]++; return rowFor(event, "invalid-date/no-task", "INVALID_DATE_NO_TASK", null, null, true) }
    const owner = event.owner
    if (owner.tag !== "active") {
      const map = { unassigned: "UNASSIGNED_OWNER", "missing-profile": "PROFILE_MISSING", "inactive-profile": "PROFILE_INACTIVE", "invalid-role": "ROLE_INVALID" } as const
      counts[2]++; return rowFor(event, "manual-review/unassigned-owner", map[owner.tag], event.due, owner.tag === "unassigned" ? null : owner.ownerId, true)
    }
    const task = taskFor(event as FollowUpFact & { created: string; due: string }, owner.ownerId)
    const matches = sourceMatches.get(task.source_event_id) ?? []
    if (matches.length > 1) { counts[6]++; return rowFor(event, "collision/manual-review", "DUPLICATE_SOURCE", event.due, owner.ownerId, true) }
    if (matches.length === 1) {
      const match = matches[0]
      if (taskEqual(task, match)) { counts[5]++; return rowFor(event, "already-converted", "ALREADY_CONVERTED", event.due, owner.ownerId, true) }
      counts[6]++; return rowFor(event, "collision/manual-review", "SOURCE_MISMATCH", event.due, owner.ownerId, true)
    }
    if (ownerIdempotency.has(`${task.owner_id}|${task.idempotency_key}`)) { counts[6]++; return rowFor(event, "collision/manual-review", "IDEMPOTENCY_COLLISION", event.due, owner.ownerId, true) }
    if (ownerLead.has(`${task.owner_id}|${task.lead_id}`)) { counts[6]++; return rowFor(event, "collision/manual-review", "OWNER_LEAD_COLLISION", event.due, owner.ownerId, true) }
    tasks.push(task)
    counts[0]++; return rowFor(event, "eligible", "ELIGIBLE", event.due, owner.ownerId, true)
  }).sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]))
  tasks.sort((a, b) => a.source_event_created_at.localeCompare(b.source_event_created_at) || a.source_event_id.localeCompare(b.source_event_id))
  for (const row of rows) if (new TextEncoder().encode(JSON.stringify(row)).length > 512) throw new CanonicalizationFailure("CanonicalizationFailure")
  const totalCount = rows.length
  const plan: CanonicalPlan = [input.ruleVersion, input.cutoffCreatedAt, input.cutoffId, rows, counts, totalCount, 0, 0, 0, false]
  const bytes = new TextEncoder().encode(canonicalJson(plan))
  const staticHeader = new TextEncoder().encode(canonicalJson([input.ruleVersion, input.cutoffCreatedAt, input.cutoffId, [], counts, 0, 0, 0, 0, false])).length
  if (staticHeader > 4096 || bytes.length > 1024 * 1024) throw new CanonicalizationFailure("CanonicalizationFailure")
  return { rows, counts, totalCount, tasks, canonicalPlan: plan, canonicalBytes: bytes, canonicalHash: sha256(bytes) }
}
import { createHash } from "node:crypto"
