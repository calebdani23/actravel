import "server-only"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash } from "node:crypto"
import { requireAdminRole } from "@/lib/admin/auth"
import { classifyFollowUpBackfillPreview, canonicalJson, parseUtcDate, type ExistingTaskFact, type FollowUpFact, type OwnerFact, type TaskOccupancyFact, type PreviewResult } from "@/lib/admin/follow-up-backfill-preview"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type CutoffRow = { created_at: string; id: string }
type PublicCutoff = { createdAt: string; id: string }
type ReadRows = (cutoff: string, cursor?: string, limit?: number) => Promise<unknown[]>
export type PreviewReadDataSource = {
  eventCutoff: () => Promise<unknown[]>
  taskCutoff: () => Promise<unknown[]>
  events: ReadRows
  tasks: ReadRows
  leads: (ids: string[]) => Promise<unknown[]>
  profiles: (ids: string[]) => Promise<unknown[]>
  profileRoles: (ids: string[]) => Promise<unknown[]>
  roles: (ids: string[]) => Promise<unknown[]>
  /** Optional transport counter for injected/provider fetch wrappers. */
  physicalAttempts?: () => number
}
export type ReaderErrorCode = "Unauthorized" | "ClientUnavailable" | "QueryFailed" | "CutoffUnavailable" | "MalformedRow" | "IncompleteJoin" | "LimitExceeded" | "SnapshotNotConverged" | "ClassifierFailed"
export type ReaderDiagnostics = { physicalAttempts: number; logicalReads: number }
export type ReaderResult =
  | { ok: true; plan: PreviewResult["canonicalPlan"]; readerSnapshotHash: string; eventCutoff: PublicCutoff; taskCutoff: PublicCutoff | null; diagnostics: ReaderDiagnostics }
  | { ok: false; error: { code: ReaderErrorCode; message: ReaderErrorCode }; diagnostics?: ReaderDiagnostics }
export type ReaderDeps = {
  requireAdminRole?: (allowed: readonly ["admin"]) => Promise<unknown>
  createReadDataSource?: () => Promise<PreviewReadDataSource>
  classify?: typeof classifyFollowUpBackfillPreview
  digest?: (snapshot: unknown) => string
  fetch?: typeof fetch
}

const EVENT_COLUMNS = "id,lead_id,created_at,event_type,follow_up_at:payload->>followUpAt,has_note:payload->hasNote"
const TASK_COLUMNS = "id,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata,status,owner_id,lead_id,quote_id,description,due_at,idempotency_key,created_at"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)
const fail = (code: ReaderErrorCode): never => { throw new Error(code) }
const exact = (row: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!isObject(row) || Object.keys(row).sort().join("\0") !== [...keys].sort().join("\0")) fail("MalformedRow")
  return row as Record<string, unknown>
}
const validId = (value: unknown): value is string => typeof value === "string" && UUID.test(value) && value === value.toLowerCase()
const canonicalCutoff = (row: unknown): CutoffRow => {
  const value = exact(row, ["created_at", "id"])
  if (typeof value.created_at !== "string" || !validId(value.id)) fail("MalformedRow")
  try {
    if (parseUtcDate(value.created_at) !== value.created_at) fail("MalformedRow")
  } catch {
    fail("MalformedRow")
  }
  return { created_at: value.created_at as string, id: value.id as string }
}
const rawCutoff = (at: CutoffRow) => `created_at.lt.${at.created_at},and(created_at.eq.${at.created_at},id.lte.${at.id})`
const rawCursor = (at: string, id: string) => {
  try { if (parseUtcDate(at) !== at || !validId(id)) fail("MalformedRow") } catch { fail("MalformedRow") }
  return `created_at.gt.${at},and(created_at.eq.${at},id.gt.${id})`
}
const digestDefault = (snapshot: unknown) => createHash("sha256").update(new TextEncoder().encode(canonicalJson(snapshot))).digest("hex")

export function createPreviewReadDataSource(fetchImpl: typeof fetch = globalThis.fetch): PreviewReadDataSource {
  let physicalAttempts = 0
  const trackedFetch: typeof fetch = async (...args) => {
    let lastError: unknown
    for (let attempt = 0; attempt < 4; attempt++) {
      physicalAttempts++
      try {
        const response = await fetchImpl(...args)
        if (response.status >= 500 && attempt < 3) continue
        return response
      } catch (error) {
        lastError = error
        if (attempt === 3) throw error
      }
    }
    throw lastError ?? new Error("QueryFailed")
  }
  const db = createSupabaseAdminClient({ global: { fetch: trackedFetch } }) as any
  const run = async (query: any) => { const result = await query; if (result.error) fail("QueryFailed"); return result.data ?? [] }
  const page = (table: string, columns: string, filter: (q: any) => any): ReadRows => async (cut, cursor, limit = 200) => {
    const [at, id] = cut.split("|")
    let q = filter(db.from(table).select(columns)).or(rawCutoff({ created_at: at, id }))
    if (cursor) { const [cursorAt, cursorId] = cursor.split("|"); q = q.or(rawCursor(cursorAt, cursorId)) }
    return run(q.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(limit))
  }
  return {
    eventCutoff: () => run(db.from("lead_events").select("created_at,id").eq("event_type", "follow_up_registered").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1)),
    taskCutoff: () => run(db.from("tasks").select("created_at,id").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1)),
    events: page("lead_events", EVENT_COLUMNS, (q) => q.eq("event_type", "follow_up_registered")),
    tasks: page("tasks", TASK_COLUMNS, (q) => q),
    leads: (ids) => run(db.from("leads").select("id,assigned_to,deleted_at,archived_at").in("id", ids).order("id", { ascending: true })),
    profiles: (ids) => run(db.from("profiles").select("id,is_active").in("id", ids).order("id", { ascending: true })),
    profileRoles: (ids) => run(db.from("profile_roles").select("profile_id,role_id").in("profile_id", ids).order("profile_id", { ascending: true }).order("role_id", { ascending: true })),
    roles: (ids) => run(db.from("roles").select("id,name").in("id", ids).order("id", { ascending: true })),
    physicalAttempts: () => physicalAttempts,
  }
}

function sourceFactory(fetchImpl?: typeof fetch): PreviewReadDataSource {
  return createPreviewReadDataSource(fetchImpl)
}

async function allPages(read: ReadRows, at: CutoffRow | null, count: () => void): Promise<Record<string, unknown>[]> {
  if (!at) return []
  const rows: Record<string, unknown>[] = []; let cursor: string | undefined
  for (let page = 0; page < 10; page++) {
    count(); const batch = await read(`${at.created_at}|${at.id}`, cursor, 200)
    if (batch.length > 200) fail("MalformedRow")
    const decoded = batch.map((row) => {
      if (!isObject(row) || typeof row.created_at !== "string" || typeof row.id !== "string") fail("MalformedRow")
      const value = row as Record<string, unknown>
      try {
        if (parseUtcDate(value.created_at) !== value.created_at) fail("MalformedRow")
      } catch { fail("MalformedRow") }
      const createdAt = value.created_at as string, id = value.id as string
      if (!validId(id) || createdAt > at.created_at || (createdAt === at.created_at && id > at.id)) fail("MalformedRow")
      return value
    })
    for (let i = 1; i < decoded.length; i++) if (`${decoded[i - 1].created_at}|${decoded[i - 1].id}` >= `${decoded[i].created_at}|${decoded[i].id}`) fail("MalformedRow")
    rows.push(...decoded)
    if (batch.length < 200) return rows
    const last = decoded[decoded.length - 1]; cursor = `${last.created_at as string}|${last.id as string}`
  }
  count(); const sentinel = await read(`${at.created_at}|${at.id}`, cursor, 1)
  if (sentinel.length) fail("LimitExceeded")
  return rows
}

function chunks(ids: string[]): string[][] { const sorted = [...new Set(ids)].sort(); const out: string[][] = []; for (let i = 0; i < sorted.length; i += 200) out.push(sorted.slice(i, i + 200)); return out }
async function joined(read: (ids: string[]) => Promise<unknown[]>, ids: string[], count: () => void): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  for (const chunk of chunks(ids)) {
    count(); const result = await read(chunk)
    for (const row of result) { if (!isObject(row)) fail("MalformedRow"); all.push(row as Record<string, unknown>) }
  }
  return all
}

function validateTaskDto(task: Record<string, unknown>): void {
  if (!validId(task.id) || (task.task_kind !== "manual" && task.task_kind !== "follow_up") || typeof task.status !== "string" ||
    !validId(task.owner_id) || (task.lead_id !== null && !validId(task.lead_id)) || (task.quote_id !== null && !validId(task.quote_id)) ||
    typeof task.description !== "string" || typeof task.idempotency_key !== "string" || !/^[0-9a-f]{64}$/.test(task.idempotency_key) ||
    typeof task.created_at !== "string") fail("MalformedRow")
  try { if (parseUtcDate(task.created_at) !== task.created_at) fail("MalformedRow") } catch { fail("MalformedRow") }
  for (const key of ["source_event_created_at", "source_due_at", "due_at"]) {
    if (task[key] !== null) {
      try { if (typeof task[key] !== "string" || parseUtcDate(task[key]) !== task[key]) fail("MalformedRow") } catch { fail("MalformedRow") }
    }
  }
  if (task.task_kind === "manual") {
    if (["source_event_id", "source_event_type", "source_event_created_at", "source_due_at", "source_payload", "metadata"].some((key) => task[key] !== null)) fail("MalformedRow")
    return
  }
  if (task.source_event_type !== "follow_up_registered" || !validId(task.source_event_id) ||
    typeof task.source_event_created_at !== "string" || typeof task.source_due_at !== "string" || task.source_payload === null || task.metadata === null ||
    task.lead_id === null || task.quote_id !== null || task.source_due_at !== task.due_at) fail("MalformedRow")
  if (!isObject(task.source_payload) || Object.keys(task.source_payload).sort().join(",") !== "followUpAt,hasNote" ||
    typeof task.source_payload.followUpAt !== "string" || typeof task.source_payload.hasNote !== "boolean") fail("MalformedRow")
  if (!isObject(task.metadata) || Object.keys(task.metadata).sort().join(",") !== "lead_id,owner_id,schema,source_event_id,source_event_type" ||
    task.metadata.schema !== "follow_up_task.v1" || task.metadata.source_event_id !== task.source_event_id ||
    task.metadata.source_event_type !== task.source_event_type || task.metadata.owner_id !== task.owner_id || task.metadata.lead_id !== task.lead_id ||
    Object.values(task.metadata).some((value) => typeof value !== "string")) fail("MalformedRow")
}

function ownerFacts(leadRows: Record<string, unknown>[], profileRows: Record<string, unknown>[], mappings: Record<string, unknown>[], roleRows: Record<string, unknown>[]): Map<string, OwnerFact> {
  const leads = new Map<string, Record<string, unknown>>(), profiles = new Map<string, Record<string, unknown>>(), roles = new Map<string, string>(), byProfile = new Map<string, string[]>()
  for (const row of leadRows) { exact(row, ["id", "assigned_to", "deleted_at", "archived_at"]); const id = row.id as string, assigned = row.assigned_to; if (!validId(id) || (assigned !== null && !validId(assigned))) fail("MalformedRow"); if (leads.has(id)) fail("MalformedRow"); leads.set(id, row) }
  for (const row of profileRows) { exact(row, ["id", "is_active"]); const id = row.id as string; if (!validId(id) || typeof row.is_active !== "boolean" || profiles.has(id)) fail("MalformedRow"); profiles.set(id, row) }
  for (const row of roleRows) { exact(row, ["id", "name"]); const id = row.id as string; if (!validId(id) || typeof row.name !== "string" || roles.has(id)) fail("MalformedRow"); roles.set(id, row.name as string) }
  for (const row of mappings) { exact(row, ["profile_id", "role_id"]); const profileId = row.profile_id as string, roleId = row.role_id as string; if (!validId(profileId) || !validId(roleId)) fail("MalformedRow"); const list = byProfile.get(profileId) ?? []; if (!list.includes(roleId)) list.push(roleId); byProfile.set(profileId, list) }
  // Validate the complete requested role join before applying profile precedence.
  for (const roleId of byProfile.values()) for (const id of roleId) if (!roles.has(id)) fail("IncompleteJoin")
  const out = new Map<string, OwnerFact>()
  for (const [leadId, lead] of leads) {
    if (lead.assigned_to === null) { out.set(leadId, { tag: "unassigned" }); continue }
    const ownerId = lead.assigned_to as string, profile = profiles.get(ownerId)
    if (!profile) { out.set(leadId, { tag: "missing-profile", ownerId }); continue }
    if (!profile.is_active) { out.set(leadId, { tag: "inactive-profile", ownerId }); continue }
    const names = (byProfile.get(ownerId) ?? []).map((id) => roles.get(id) as string).sort()
    if (names.some((name) => name !== "admin" && name !== "manager" && name !== "asesor")) { out.set(leadId, { tag: "invalid-role", ownerId }); continue }
    const valid = [...new Set(names)] as ("admin" | "manager" | "asesor")[]
    out.set(leadId, valid.length ? { tag: "active", ownerId, roles: valid } : { tag: "invalid-role", ownerId })
  }
  return out
}

async function pass(source: PreviewReadDataSource, eventAt: CutoffRow, taskAt: CutoffRow | null, count: () => void) {
  const [eventRows, taskRows] = await Promise.all([allPages(source.events, eventAt, count), allPages(source.tasks, taskAt, count)])
  const events = eventRows.map((r) => exact(r, ["id", "lead_id", "created_at", "event_type", "follow_up_at", "has_note"]))
  const tasks = taskRows.map((r) => exact(r, ["id", "task_kind", "source_event_id", "source_event_type", "source_event_created_at", "source_due_at", "source_payload", "metadata", "status", "owner_id", "lead_id", "quote_id", "description", "due_at", "idempotency_key", "created_at"]))
  for (const task of tasks) validateTaskDto(task)
  if (events.some((e) => e.event_type !== "follow_up_registered" || !validId(e.id) || !validId(e.lead_id) || typeof e.has_note !== "boolean")) fail("MalformedRow")
  const leadIds = [...new Set([...events.map((e) => e.lead_id), ...tasks.map((t) => t.lead_id)].filter(validId))].sort()
  const leadRows = await joined(source.leads, leadIds, count)
  if (leadRows.some((r) => !validId(r.id) || !leadIds.includes(r.id))) fail("MalformedRow")
  if (new Set(leadRows.map((r) => r.id)).size !== leadIds.length) fail("IncompleteJoin")
  const ownerIds = [...new Set(leadRows.map((r) => r.assigned_to).filter(validId))]
  const profileRows = await joined(source.profiles, ownerIds, count), mappingRows = await joined(source.profileRoles, ownerIds, count)
  if (profileRows.some((r) => !isObject(r) || (typeof r.id === "string" && !ownerIds.includes(r.id)))) fail("MalformedRow")
  const roleIds = [...new Set(mappingRows.map((r) => r.role_id).filter(validId))]
  const roleRows = await joined(source.roles, roleIds, count)
  if (mappingRows.some((r) => !isObject(r) || (typeof r.profile_id === "string" && !ownerIds.includes(r.profile_id)))) fail("MalformedRow")
  if (roleRows.some((r) => !isObject(r) || (typeof r.id === "string" && !roleIds.includes(r.id)))) fail("MalformedRow")
  const facts = ownerFacts(leadRows, profileRows, mappingRows, roleRows)
  const followUps: FollowUpFact[] = events.map((e) => ({ eventId: e.id as string, leadId: e.lead_id as string, createdAt: e.created_at as string, followUpAt: e.follow_up_at, hasNote: e.has_note as boolean, owner: facts.get(e.lead_id as string) ?? fail("IncompleteJoin"), leadOperational: leadRows.some((l) => l.id === e.lead_id && l.deleted_at === null && l.archived_at === null) }))
  const occupancies: TaskOccupancyFact[] = tasks.map((t) => { if (!validId(t.id) || !validId(t.owner_id) || (t.lead_id !== null && !validId(t.lead_id)) || typeof t.idempotency_key !== "string") fail("MalformedRow"); return { id: t.id, owner_id: t.owner_id, lead_id: t.lead_id, idempotency_key: t.idempotency_key } as TaskOccupancyFact })
  const existing: ExistingTaskFact[] = []
  for (const task of tasks) {
    if (task.task_kind === "follow_up" || task.source_event_type === "follow_up_registered") {
      // Validate the complete 0064 representation before exposing an ExistingTaskFact.
      try {
        if (task.task_kind !== "follow_up" || task.source_event_type !== "follow_up_registered") fail("MalformedRow")
        if (task.source_event_id === null || task.source_event_created_at === null || task.source_due_at === null || task.source_payload === null || task.metadata === null) fail("MalformedRow")
        const candidate = task as unknown as ExistingTaskFact
        existing.push(candidate)
      } catch { fail("MalformedRow") }
    }
  }
  existing.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id))
  occupancies.sort((a, b) => a.id.localeCompare(b.id))
  const input = { ruleVersion: "follow-up-backfill.v1", cutoffCreatedAt: eventAt.created_at, cutoffId: eventAt.id, events: followUps, taskOccupancies: occupancies, existingTasks: existing }
  return { input, snapshot: ["preview-reader-snapshot.v1", eventAt, taskAt, followUps, existing, occupancies] }
}

export async function readFollowUpBackfillPreview(deps: ReaderDeps = {}): Promise<ReaderResult> {
  const diagnostics: ReaderDiagnostics = { physicalAttempts: 0, logicalReads: 0 }
  try { await (deps.requireAdminRole ?? ((allowed) => requireAdminRole(allowed)))(["admin"]) } catch { return { ok: false, error: { code: "Unauthorized", message: "Unauthorized" } } }
  let source: PreviewReadDataSource
  try { source = await (deps.createReadDataSource ?? (async () => sourceFactory(deps.fetch)))() } catch { return { ok: false, error: { code: "ClientUnavailable", message: "ClientUnavailable" }, diagnostics } }
  const count = () => { diagnostics.logicalReads++ }
  const finishError = (code: ReaderErrorCode): ReaderResult => ({ ok: false, error: { code, message: code }, diagnostics: { physicalAttempts: source.physicalAttempts?.() ?? diagnostics.logicalReads, logicalReads: diagnostics.logicalReads } })
  try {
    count(); const eventCutoffRows = await source.eventCutoff(); count(); const taskCutoffRows = await source.taskCutoff()
    if (!eventCutoffRows.length) return finishError("CutoffUnavailable")
    if (eventCutoffRows.length !== 1 || taskCutoffRows.length > 1) fail("MalformedRow")
    const eventAt = canonicalCutoff(eventCutoffRows[0]), taskAt = taskCutoffRows.length ? canonicalCutoff(taskCutoffRows[0]) : null
    const digest = deps.digest ?? digestDefault, passes: { hash: string; input: any }[] = []
    for (let i = 0; i < 4; i++) {
      const current = await pass(source, eventAt, taskAt, count); let hash: string
      try { hash = digest(current.snapshot) } catch { return finishError("QueryFailed") }
      passes.push({ hash, input: current.input })
      if ((i === 1 && passes[0].hash === hash) || (i === 3 && passes[2].hash === hash)) {
        try { const result = (deps.classify ?? classifyFollowUpBackfillPreview)(current.input); return { ok: true, plan: result.canonicalPlan, readerSnapshotHash: hash, eventCutoff: { createdAt: eventAt.created_at, id: eventAt.id }, taskCutoff: taskAt ? { createdAt: taskAt.created_at, id: taskAt.id } : null, diagnostics: { physicalAttempts: source.physicalAttempts?.() ?? diagnostics.logicalReads, logicalReads: diagnostics.logicalReads } } } catch { return finishError("ClassifierFailed") }
      }
    }
    return finishError("SnapshotNotConverged")
  } catch (error) {
    const code = error instanceof Error && ["MalformedRow", "IncompleteJoin", "LimitExceeded"].includes(error.message) ? error.message as ReaderErrorCode : "QueryFailed"
    return finishError(code)
  }
}
