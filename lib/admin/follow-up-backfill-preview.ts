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
export type FollowUpBackfillInput = {
  ruleVersion: string
  cutoffCreatedAt: string
  cutoffId: string
  events: readonly FollowUpFact[]
}
export type PreviewRow = [string, string, string | null, string, string | null, boolean | null, string | null, Disposition, Reason]
export type PreviewResult = { rows: PreviewRow[]; counts: [number, number, number, number, number, number, number]; totalCount: number }

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
  const days = new Date(Date.UTC(year, month - 1, 1)).getUTCDate() // always 1; used below for calendar check
  const nextMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > nextMonth || days !== 1) throw new InvalidFact("InvalidFact")
  let offset = 0
  if (zone && zone !== "Z") {
    const sign = zone[0] === "+" ? 1 : -1
    const oh = Number(zone.slice(1, 3)), om = Number(zone.slice(4))
    if (oh > 14 || om > 59 || (oh === 14 && om !== 0) || (sign < 0 && oh === 0 && om === 0)) throw new InvalidFact("InvalidFact")
    offset = sign * (oh * 60 + om)
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60000
  const date = new Date(utc)
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
  return [event.eventId, event.leadId, ownerId, event.createdAt, due, event.hasNote, typeof event.followUpAt === "string" ? event.followUpAt : null, disposition, reason]
}

export function classifyFollowUpBackfillPreview(input: FollowUpBackfillInput): PreviewResult {
  if (!input || !Array.isArray(input.events) || typeof input.ruleVersion !== "string" || typeof input.cutoffCreatedAt !== "string" || typeof input.cutoffId !== "string") throw new IncompleteFacts("IncompleteFacts")
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
  const selected = new Set<string>()
  for (const group of new Set(facts.map((f) => f.leadId))) {
    const all = facts.filter((f) => f.leadId === group)
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
  const rows = facts.map((event) => {
    if (!selected.has(event.eventId)) { counts[4]++; return rowFor(event, "excluded/non-selected-history", "NON_SELECTED_HISTORY", null, null, false) }
    if (!event.leadOperational) { counts[3]++; return rowFor(event, "excluded/lead-not-operational", "LEAD_NOT_OPERATIONAL", null, null, true) }
    if (!event.due) { counts[1]++; return rowFor(event, "invalid-date/no-task", "INVALID_DATE_NO_TASK", null, null, true) }
    const owner = event.owner
    if (owner.tag !== "active") {
      const map = { unassigned: "UNASSIGNED_OWNER", "missing-profile": "PROFILE_MISSING", "inactive-profile": "PROFILE_INACTIVE", "invalid-role": "ROLE_INVALID" } as const
      counts[2]++; return rowFor(event, "manual-review/unassigned-owner", map[owner.tag], event.due, owner.tag === "unassigned" ? null : owner.ownerId, true)
    }
    counts[0]++; return rowFor(event, "eligible", "ELIGIBLE", event.due, owner.ownerId, true)
  }).sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]))
  if (rows.length > 2000) throw new CanonicalizationFailure("CanonicalizationFailure")
  return { rows, counts, totalCount: rows.length }
}
