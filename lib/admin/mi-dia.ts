import "server-only"

import { isProxy } from "node:util/types"
import { createClient } from "@/lib/supabase/server"
import { recognizedMiDiaRoles, resolveMiDiaScope, type MiDiaScope } from "./mi-dia-scope"
import type { RoleName } from "@/lib/supabase/roles"

export { resolveMiDiaScope }
export type { MiDiaScope }
export type MiDiaBucket = "overdue" | "today" | "upcoming"
export type MiDiaKind = "follow_up" | "first_contact" | "quote_follow_up"
export type MiDiaStatus = "pending" | "in_progress"
export type MiDiaCursor = { referenceTime: string; afterDueAt: string; afterId: string }
export type MiDiaPageRequest = { cursor: MiDiaCursor | null }
export type MiDiaCounts = { overdue: number; today: number; upcoming: number; total: number }
export type MiDiaItem = { taskId: string; ownerId: string; ownerLabel: string; kind: MiDiaKind; status: MiDiaStatus; description: string; dueAt: string; bucket: MiDiaBucket; leadId: string | null; quoteId: string | null; navigationHref: string | null }
export type MiDiaSuccess = { ok: true; referenceTime: string; todayStart: string; tomorrowStart: string; scope: MiDiaScope; counts: MiDiaCounts; items: MiDiaItem[]; pageInfo: { hasMore: boolean; nextCursor: MiDiaCursor | null } }
export type MiDiaFailureCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_ROLE_UNSUPPORTED" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST" | "PERSISTENCE_FAILURE"
export type MiDiaFailure = { ok: false; error: { code: MiDiaFailureCode; message: MiDiaFailureCode } }
export type MiDiaResult = MiDiaSuccess | MiDiaFailure
type Pair = { data: unknown; error: unknown }
type RpcArgs = { p_reference_time_text: string; p_expected_actor_id: string; p_limit: number; p_after_due_at_text: string | null; p_after_id_text: string | null }
export type MiDiaDeps = {
  createAuthClient?: () => Promise<unknown>; getUser?: (client: unknown) => Promise<unknown>
  readProfile?: (client: unknown, actorId: string) => Promise<unknown>; readRoles?: (client: unknown, actorId: string) => Promise<unknown>
  createReadClient?: () => Promise<unknown>; invokeRpc?: (client: unknown, args: RpcArgs) => Promise<unknown>; now?: () => Date
}
export type MiDiaActorResult = { ok: true; actorId: string; profile: { id: string; isActive: true }; rawRoleNames: string[]; roles: RoleName[]; scope: MiDiaScope } | MiDiaFailure
export type MiDiaActionContext = { ok: true; taskId: string; ownerId: string; kind: MiDiaKind; status: "pending" | "in_progress" | "completed" | "canceled"; leadId: string | null; quoteId: string | null; navigationHref: string | null }
export type MiDiaActionContextResult = MiDiaActionContext | { ok: false; error: { code: "TASK_FORBIDDEN" | "PERSISTENCE_FAILURE"; message: "TASK_FORBIDDEN" | "PERSISTENCE_FAILURE" } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/
const FAILURE_CODES = new Set<MiDiaFailureCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_ROLE_UNSUPPORTED", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "PERSISTENCE_FAILURE"])
const SUCCESS_KEYS = ["ok", "referenceTime", "todayStart", "tomorrowStart", "scope", "counts", "items", "pageInfo"] as const
const ITEM_KEYS = ["taskId", "ownerId", "ownerLabel", "kind", "status", "description", "dueAt", "bucket", "leadId", "quoteId", "navigationHref"] as const
const failure = (code: MiDiaFailureCode): MiDiaFailure => ({ ok: false, error: { code, message: code } })
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
const timestamp = (value: unknown): value is string => {
  if (typeof value !== "string" || !UTC.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19)
}
function record(value: unknown): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || isProxy(value) || Array.isArray(value)) return null
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors)
    if (keys.some((key) => typeof key !== "string")) return null
    const output: Record<string, unknown> = Object.create(null)
    for (const key of keys as string[]) { const descriptor = descriptors[key]; if (!descriptor.enumerable || !("value" in descriptor)) return null; output[key] = descriptor.value }
    return output
  } catch { return null }
}
function exact(value: unknown, keys: readonly string[]) {
  const data = record(value)
  return data && Object.keys(data).length === keys.length && keys.every((key) => Object.hasOwn(data, key)) ? data : null
}
function array(value: unknown): unknown[] | null {
  try {
    if (isProxy(value) || !Array.isArray(value)) return null
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors)
    if (keys.length !== value.length + 1 || keys.some((key) => typeof key !== "string" || key !== "length" && !/^\d+$/.test(key))) return null
    const output: unknown[] = []
    for (let index = 0; index < value.length; index++) { const descriptor = descriptors[String(index)]; if (!descriptor?.enumerable || !("value" in descriptor)) return null; output.push(descriptor.value) }
    return output
  } catch { return null }
}
function pair(value: unknown): Pair | null {
  const data = record(value)
  return data && Object.hasOwn(data, "data") && Object.hasOwn(data, "error") ? { data: data.data, error: data.error } : null
}
type ServerClient = Awaited<ReturnType<typeof createClient>>
export async function authorizeMiDiaActor(deps: MiDiaDeps = {}): Promise<MiDiaActorResult> {
  try {
    const client = await (deps.createAuthClient ?? createClient)()
    const userResult = pair(await (deps.getUser ?? ((value) => (value as ServerClient).auth.getUser()))(client))
    const userData = userResult?.error === null ? exact(userResult.data, ["user"]) : null
    if (!userData) return failure("PERSISTENCE_FAILURE")
    if (userData.user === null) return failure("AUTH_REQUIRED")
    const user = record(userData.user), actorId = user?.id
    if (!uuid(actorId)) return failure("PERSISTENCE_FAILURE")
    const profileResult = pair(await (deps.readProfile ?? ((value, id) => (value as ServerClient).from("profiles").select("id,is_active").eq("id", id).maybeSingle()))(client, actorId))
    if (!profileResult || profileResult.error !== null) return failure("PERSISTENCE_FAILURE")
    if (profileResult.data === null) return failure("AUTH_INACTIVE")
    const profile = exact(profileResult.data, ["id", "is_active"])
    if (!profile || profile.id !== actorId || typeof profile.is_active !== "boolean") return failure("PERSISTENCE_FAILURE")
    if (!profile.is_active) return failure("AUTH_INACTIVE")
    const rolesResult = pair(await (deps.readRoles ?? ((value, id) => (value as ServerClient).from("profile_roles").select("roles(name)").eq("profile_id", id)))(client, actorId))
    const rows = rolesResult?.error === null ? array(rolesResult.data) : null
    if (!rows) return failure("PERSISTENCE_FAILURE")
    const rawRoleNames: string[] = []
    for (const row of rows) { const outer = exact(row, ["roles"]), role = outer && exact(outer.roles, ["name"]); if (!role || typeof role.name !== "string") return failure("PERSISTENCE_FAILURE"); rawRoleNames.push(role.name) }
    const scope = resolveMiDiaScope(rawRoleNames)
    if (!scope) return failure("AUTH_ROLE_UNSUPPORTED")
    return { ok: true, actorId, profile: { id: actorId, isActive: true }, rawRoleNames, roles: recognizedMiDiaRoles(rawRoleNames), scope }
  } catch { return failure("PERSISTENCE_FAILURE") }
}
export async function readMiDiaActionContext(actor: Extract<MiDiaActorResult, { ok: true }>, taskId: string, deps: { createClient?: () => Promise<unknown>; readTask?: (client: unknown, taskId: string) => Promise<unknown>; canReadLead?: (client: unknown, leadId: string) => Promise<unknown>; canReadQuote?: (client: unknown, quoteId: string) => Promise<unknown> } = {}): Promise<MiDiaActionContextResult> {
  const failed = (code: "TASK_FORBIDDEN" | "PERSISTENCE_FAILURE") => ({ ok: false as const, error: { code, message: code } })
  try {
    const client = await (deps.createClient ?? createClient)()
    const result = pair(await (deps.readTask ?? ((value, id) => (value as ServerClient).from("tasks").select("id,owner_id,task_kind,status,lead_id,quote_id").eq("id", id).maybeSingle()))(client, taskId))
    if (!result || result.error !== null) return failed("PERSISTENCE_FAILURE")
    if (result.data === null) return failed("TASK_FORBIDDEN")
    const row = exact(result.data, ["id", "owner_id", "task_kind", "status", "lead_id", "quote_id"])
    if (!row || row.id !== taskId || !uuid(row.id) || !uuid(row.owner_id) || !["follow_up", "first_contact", "quote_follow_up"].includes(row.task_kind as string) || !["pending", "in_progress", "completed", "canceled"].includes(row.status as string) || row.lead_id !== null && !uuid(row.lead_id) || row.quote_id !== null && !uuid(row.quote_id) || (row.task_kind === "quote_follow_up" ? row.lead_id !== null : row.quote_id !== null)) return failed("PERSISTENCE_FAILURE")
    const kind = row.task_kind as MiDiaKind, contextId = kind === "quote_follow_up" ? row.quote_id as string | null : row.lead_id as string | null
    let navigationHref: string | null = actor.roles.includes("admin") && contextId ? `/admin/${kind === "quote_follow_up" ? "quotes" : "leads"}/${contextId}` : null
    if (!navigationHref && contextId && actor.roles.includes("asesor") && row.owner_id === actor.actorId) {
      const helper = pair(await Promise.resolve(kind === "quote_follow_up" ? (deps.canReadQuote ?? ((value, id) => (value as ServerClient).rpc("crm_can_read_quote", { p_quote_id: id })))(client, contextId) : (deps.canReadLead ?? ((value, id) => (value as ServerClient).rpc("crm_advisor_can_access_live_opportunity", { p_lead_id: id })))(client, contextId)).catch(() => null))
      if (helper?.error === null && helper.data === true) navigationHref = `/admin/${kind === "quote_follow_up" ? "quotes" : "leads"}/${contextId}`
    }
    return { ok: true, taskId, ownerId: row.owner_id as string, kind, status: row.status as MiDiaActionContext["status"], leadId: row.lead_id as string | null, quoteId: row.quote_id as string | null, navigationHref }
  } catch { return failed("PERSISTENCE_FAILURE") }
}
function request(value: unknown): MiDiaPageRequest | null {
  const input = exact(value, ["cursor"])
  if (!input) return null
  if (input.cursor === null) return { cursor: null }
  const cursor = exact(input.cursor, ["referenceTime", "afterDueAt", "afterId"])
  return cursor && timestamp(cursor.referenceTime) && timestamp(cursor.afterDueAt) && uuid(cursor.afterId)
    ? { cursor: { referenceTime: cursor.referenceTime, afterDueAt: cursor.afterDueAt, afterId: cursor.afterId } } : null
}
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
function zoneFields(value: Date) { const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value])); return [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second].map(Number) }
function localMidnight(year: number, month: number, day: number) {
  const target = Date.UTC(year, month - 1, day); let candidate = target
  for (let iteration = 0; iteration < 4; iteration++) { const [y, m, d, h, minute, second] = zoneFields(new Date(candidate)); candidate += target - Date.UTC(y, m - 1, d, h, minute, second) }
  const [y, m, d, h, minute, second] = zoneFields(new Date(candidate))
  if (y !== year || m !== month || d !== day || h !== 0 || minute !== 0 || second !== 0) throw new Error("Invalid timezone boundary")
  return new Date(candidate).toISOString().replace(".000Z", ".000000Z")
}
function boundaries(referenceTime: string) {
  const [year, month, day] = zoneFields(new Date(referenceTime)), next = new Date(Date.UTC(year, month - 1, day + 1))
  return { todayStart: localMidnight(year, month, day), tomorrowStart: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()) }
}
const keyAfter = (dueAt: string, id: string, cursor: MiDiaCursor) => dueAt > cursor.afterDueAt || dueAt === cursor.afterDueAt && id > cursor.afterId
function navigation(item: MiDiaItem, actor: Extract<MiDiaActorResult, { ok: true }>) {
  if (item.navigationHref === null) return true
  const context = item.kind === "quote_follow_up" ? item.quoteId : item.leadId
  const expected = context && `/admin/${item.kind === "quote_follow_up" ? "quotes" : "leads"}/${context}`
  return item.navigationHref === expected && (actor.roles.includes("admin") || actor.roles.includes("asesor") && item.ownerId === actor.actorId)
}
function decodeItem(value: unknown, referenceTime: string, tomorrowStart: string, actor: Extract<MiDiaActorResult, { ok: true }>): MiDiaItem | null {
  const row = exact(value, ITEM_KEYS)
  if (!row || !uuid(row.taskId) || !uuid(row.ownerId) || typeof row.ownerLabel !== "string" || !row.ownerLabel || row.ownerLabel.trim() !== row.ownerLabel || typeof row.description !== "string" || !timestamp(row.dueAt)) return null
  if (!(["follow_up", "first_contact", "quote_follow_up"] as unknown[]).includes(row.kind) || !(["pending", "in_progress"] as unknown[]).includes(row.status) || !(["overdue", "today", "upcoming"] as unknown[]).includes(row.bucket)) return null
  if (row.leadId !== null && !uuid(row.leadId) || row.quoteId !== null && !uuid(row.quoteId) || row.navigationHref !== null && typeof row.navigationHref !== "string") return null
  if (row.kind === "quote_follow_up" ? row.leadId !== null : row.quoteId !== null) return null
  const bucket = row.dueAt < referenceTime ? "overdue" : row.dueAt < tomorrowStart ? "today" : "upcoming"
  const item = { ...row } as MiDiaItem
  return row.bucket === bucket && navigation(item, actor) ? item : null
}
function decode(value: unknown, sent: { request: MiDiaPageRequest; referenceTime: string }, actor: Extract<MiDiaActorResult, { ok: true }>): MiDiaResult {
  const failed = exact(value, ["ok", "error"]), error = failed?.ok === false && exact(failed.error, ["code", "message"])
  if (error && typeof error.code === "string" && error.code === error.message && FAILURE_CODES.has(error.code as MiDiaFailureCode)) return failure(error.code as MiDiaFailureCode)
  const data = exact(value, SUCCESS_KEYS), counts = data && exact(data.counts, ["overdue", "today", "upcoming", "total"]), pageInfo = data && exact(data.pageInfo, ["hasMore", "nextCursor"]), values = data && array(data.items)
  if (!data || data.ok !== true || data.referenceTime !== sent.referenceTime || data.scope !== actor.scope || !timestamp(data.todayStart) || !timestamp(data.tomorrowStart) || !counts || !pageInfo || !values || values.length > 20) return failure("PERSISTENCE_FAILURE")
  const expected = boundaries(sent.referenceTime)
  if (data.todayStart !== expected.todayStart || data.tomorrowStart !== expected.tomorrowStart || typeof pageInfo.hasMore !== "boolean") return failure("PERSISTENCE_FAILURE")
  const numbers = [counts.overdue, counts.today, counts.upcoming, counts.total]
  if (numbers.some((number) => !Number.isSafeInteger(number) || (number as number) < 0) || counts.total !== (counts.overdue as number) + (counts.today as number) + (counts.upcoming as number)) return failure("PERSISTENCE_FAILURE")
  const items: MiDiaItem[] = []
  for (const value of values) { const item = decodeItem(value, sent.referenceTime, expected.tomorrowStart, actor); if (!item) return failure("PERSISTENCE_FAILURE"); items.push(item) }
  if (new Set(items.map((item) => item.taskId)).size !== items.length) return failure("PERSISTENCE_FAILURE")
  for (let index = 0; index < items.length; index++) { const current = items[index], prior = items[index - 1]; if (prior && (current.dueAt < prior.dueAt || current.dueAt === prior.dueAt && current.taskId <= prior.taskId) || sent.request.cursor && !keyAfter(current.dueAt, current.taskId, sent.request.cursor)) return failure("PERSISTENCE_FAILURE") }
  for (const bucket of ["overdue", "today", "upcoming"] as const) if (items.filter((item) => item.bucket === bucket).length > (counts[bucket] as number)) return failure("PERSISTENCE_FAILURE")
  if (items.length > (counts.total as number)) return failure("PERSISTENCE_FAILURE")
  let nextCursor: MiDiaCursor | null = null
  if (pageInfo.hasMore) {
    const cursor = exact(pageInfo.nextCursor, ["referenceTime", "afterDueAt", "afterId"]), last = items.at(-1)
    if (items.length !== 20 || !cursor || cursor.referenceTime !== sent.referenceTime || !last || cursor.afterDueAt !== last.dueAt || cursor.afterId !== last.taskId) return failure("PERSISTENCE_FAILURE")
    nextCursor = { referenceTime: sent.referenceTime, afterDueAt: last.dueAt, afterId: last.taskId }
  } else if (pageInfo.nextCursor !== null) return failure("PERSISTENCE_FAILURE")
  const safeCounts = { overdue: counts.overdue as number, today: counts.today as number, upcoming: counts.upcoming as number, total: counts.total as number }
  return { ok: true, referenceTime: sent.referenceTime, todayStart: expected.todayStart, tomorrowStart: expected.tomorrowStart, scope: actor.scope, counts: safeCounts, items, pageInfo: { hasMore: pageInfo.hasMore, nextCursor } }
}
export async function readMiDiaPage(input: unknown, deps: MiDiaDeps = {}): Promise<MiDiaResult> {
  const actor = await authorizeMiDiaActor(deps)
  if (!actor.ok) return actor
  const parsed = request(input)
  if (!parsed) return failure("INVALID_REQUEST")
  let referenceTime: string
  try { referenceTime = parsed.cursor?.referenceTime ?? Date.prototype.toISOString.call((deps.now ?? (() => new Date()))()).replace("Z", "000Z") }
  catch { return failure("PERSISTENCE_FAILURE") }
  const args: RpcArgs = { p_reference_time_text: referenceTime, p_expected_actor_id: actor.actorId, p_limit: 20, p_after_due_at_text: parsed.cursor?.afterDueAt ?? null, p_after_id_text: parsed.cursor?.afterId ?? null }
  try {
    const client = await (deps.createReadClient ?? createClient)()
    const result = pair(await (deps.invokeRpc ?? ((value, rpcArgs) => (value as ServerClient).rpc("read_mi_dia_page", rpcArgs as never)))(client, args))
    return !result || result.error !== null ? failure("PERSISTENCE_FAILURE") : decode(result.data, { request: parsed, referenceTime }, actor)
  } catch { return failure("PERSISTENCE_FAILURE") }
}
