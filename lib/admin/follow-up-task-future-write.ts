import "server-only"
import { requireAdminRole } from "@/lib/admin/auth"
import { createClient } from "@/lib/supabase/server"

export type FollowUpTaskWriteDomainCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_FORBIDDEN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "LIMIT_EXCEEDED" | "IDEMPOTENCY_CONFLICT" | "REPLAY_INTEGRITY_FAILURE" | "LEAD_NOT_OPERATIONAL"
  | "OWNER_CONTEXT_INVALID" | "TASK_OCCUPANCY_CONFLICT"
export type FollowUpTaskWriteErrorCode = FollowUpTaskWriteDomainCode | "PERSISTENCE_FAILURE"
export type FollowUpTaskWriteRpcArgs = {
  p_request_id_text: string
  p_expected_actor_id: string
  p_lead_id_text: string
  p_note_body: string
  p_due_at: string | null
}
export type FollowUpTaskWriteSuccess = {
  ok: true
  outcome: "created" | "rescheduled" | "history_only"
  requestId: string
  noteId: string
  eventId: string
  taskId: string | null
  taskStatus: "pending" | "in_progress" | null
  dueAt: string | null
  replayed: boolean
}
export type FollowUpTaskWriteFailure = { ok: false; error: { code: FollowUpTaskWriteErrorCode; message: FollowUpTaskWriteErrorCode } }
export type FollowUpTaskWriteResult = FollowUpTaskWriteSuccess | FollowUpTaskWriteFailure
export type FollowUpTaskWriteDeps = {
  requireAdminRole?: typeof requireAdminRole
  createClient?: typeof createClient
  invokeRpc?: (client: Awaited<ReturnType<typeof createClient>>, args: FollowUpTaskWriteRpcArgs) => Promise<{ data: unknown; error: null | { code?: string; message?: string } }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/
const FORM_DATE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const SUCCESS_KEYS = ["ok", "outcome", "requestId", "noteId", "eventId", "taskId", "taskStatus", "dueAt", "replayed"] as const
const DOMAIN_CODES = new Set<FollowUpTaskWriteDomainCode>(["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_FORBIDDEN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "LIMIT_EXCEEDED", "IDEMPOTENCY_CONFLICT", "REPLAY_INTEGRITY_FAILURE", "LEAD_NOT_OPERATIONAL", "OWNER_CONTEXT_INVALID", "TASK_OCCUPANCY_CONFLICT"])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
const validUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
const failure = (code: FollowUpTaskWriteErrorCode): FollowUpTaskWriteFailure => ({ ok: false, error: { code, message: code } })

function normalizeDueAt(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const candidate = FORM_DATE.test(value) ? `${value}:00Z` : value
  const match = RFC3339.exec(candidate)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = "", zone] = match
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number)
  const sourceMillis = Date.UTC(year, month - 1, day, hour, minute, second)
  const source = new Date(sourceMillis)
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month - 1 || source.getUTCDate() !== day || source.getUTCHours() !== hour || source.getUTCMinutes() !== minute || source.getUTCSeconds() !== second) return undefined
  let offsetMinutes = 0
  if (zone !== "Z") {
    const zoneHours = Number(zone.slice(1, 3)), zoneMinutes = Number(zone.slice(4, 6))
    if (zone === "-00:00" || zoneHours > 14 || zoneMinutes > 59 || (zoneHours === 14 && zoneMinutes !== 0)) return undefined
    offsetMinutes = (zone[0] === "+" ? 1 : -1) * (zoneHours * 60 + zoneMinutes)
  }
  const utc = new Date(sourceMillis - offsetMinutes * 60_000)
  if (utc.getUTCFullYear() < 1970 || utc.getUTCFullYear() > 9999) return undefined
  return `${utc.toISOString().slice(0, 19)}.${fraction.padEnd(6, "0")}Z`
}

function decode(value: unknown, requestId: string, dueAt: string | null): FollowUpTaskWriteResult {
  if (object(value) && exact(value, ["ok", "error"]) && value.ok === false && object(value.error) && exact(value.error, ["code", "message"]) && value.error.code === value.error.message && typeof value.error.code === "string" && DOMAIN_CODES.has(value.error.code as FollowUpTaskWriteDomainCode)) return failure(value.error.code as FollowUpTaskWriteDomainCode)
  if (!object(value) || !exact(value, SUCCESS_KEYS) || value.ok !== true || !["created", "rescheduled", "history_only"].includes(value.outcome as string) || value.requestId !== requestId || !validUuid(value.requestId) || !validUuid(value.noteId) || value.eventId !== requestId || !validUuid(value.eventId) || typeof value.replayed !== "boolean") return failure("PERSISTENCE_FAILURE")
  const historyOnly = value.outcome === "history_only"
  if (historyOnly ? value.taskId !== null || value.taskStatus !== null || value.dueAt !== null || dueAt !== null : !validUuid(value.taskId) || !["pending", "in_progress"].includes(value.taskStatus as string) || value.dueAt !== dueAt || dueAt === null || (value.outcome === "created" && value.taskStatus !== "pending")) return failure("PERSISTENCE_FAILURE")
  return { ok: true, outcome: value.outcome as FollowUpTaskWriteSuccess["outcome"], requestId: value.requestId, noteId: value.noteId, eventId: value.eventId, taskId: value.taskId as string | null, taskStatus: value.taskStatus as FollowUpTaskWriteSuccess["taskStatus"], dueAt: value.dueAt as string | null, replayed: value.replayed }
}

export async function registerFollowUpTaskWrite(input: unknown, deps: FollowUpTaskWriteDeps = {}): Promise<FollowUpTaskWriteResult> {
  const session = await (deps.requireAdminRole ?? requireAdminRole)(["admin", "asesor"])
  if (!object(input) || !exact(input, ["requestId", "leadId", "noteBody", "dueAt"]) || !validUuid(input.requestId) || !validUuid(input.leadId) || typeof input.noteBody !== "string" || !validUuid(session.user.id)) return failure("INVALID_REQUEST")
  const noteBody = input.noteBody.trim(), dueAt = normalizeDueAt(input.dueAt)
  if (!noteBody || dueAt === undefined) return failure("INVALID_REQUEST")
  if (new TextEncoder().encode(noteBody).byteLength > 4000) return failure("LIMIT_EXCEEDED")
  const args: FollowUpTaskWriteRpcArgs = { p_request_id_text: input.requestId, p_expected_actor_id: session.user.id, p_lead_id_text: input.leadId, p_note_body: noteBody, p_due_at: dueAt }
  try {
    const client = await (deps.createClient ?? createClient)()
    const result = await (deps.invokeRpc ?? ((instance, rpcArgs) => instance.rpc("register_follow_up_action", rpcArgs) as unknown as Promise<{ data: unknown; error: null | { code?: string; message?: string } }>))(client, args)
    return result.error ? failure("PERSISTENCE_FAILURE") : decode(result.data, input.requestId, dueAt)
  } catch {
    return failure("PERSISTENCE_FAILURE")
  }
}
