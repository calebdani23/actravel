import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/database.types"
import { createHash } from "node:crypto"

export type TaskRow = Tables<"tasks">
export type FollowUpTaskMetadata = {
  schema: string
  source_event_id: string
  source_event_type: string
  owner_id: string
  lead_id: string
}
export type FollowUpTaskRepresentation = TaskRow & {
  task_kind: "follow_up"
  source_event_id: string
  source_event_type: "follow_up_registered"
  source_event_created_at: string
  source_due_at: string
  source_payload: NonNullable<TaskRow["source_payload"]>
  metadata: FollowUpTaskMetadata
}
export type TaskStatus = "pending" | "in_progress" | "completed" | "canceled"
export type TaskInput = {
  ownerId: string
  leadId: string | null
  quoteId: string | null
  description: string
  dueAt: string | Date
}
export type NormalizedTaskInput = Omit<TaskInput, "dueAt"> & { dueAt: string }
export type FollowUpTaskProjection = {
  taskId: string
  nextFollowUpAt: string
  followUpOverdue: boolean
}
type FollowUpTaskReadRow = Pick<TaskRow, "id" | "lead_id" | "due_at" | "status" | "task_kind"> & {
  leads: { archived_at: string | null; deleted_at: string | null } | Array<{ archived_at: string | null; deleted_at: string | null }> | null
}
export type TaskErrorCode =
  | "TASK_UNAUTHENTICATED" | "TASK_INVALID_ARGUMENT" | "TASK_FORBIDDEN"
  | "TASK_CONTEXT_INVALID" | "TASK_IDEMPOTENCY_CONFLICT" | "TASK_INVALID_TRANSITION"
  | "TASK_DATABASE_ERROR"

export class TaskBoundaryError extends Error {
  readonly code: TaskErrorCode
  constructor(code: TaskErrorCode, message: string = code) {
    super(message)
    this.name = "TaskBoundaryError"
    this.code = code
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const activeFollowUpStatuses = new Set(["pending", "in_progress"])

function liveLead(row: FollowUpTaskReadRow) {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  return lead?.deleted_at === null && lead.archived_at === null
}

function buildActiveFollowUpTaskIndex(rows: FollowUpTaskReadRow[], reference = new Date()) {
  const projections = new Map<string, FollowUpTaskProjection>()
  const ordered = rows
    .filter((row) => row.lead_id && row.task_kind === "follow_up" && activeFollowUpStatuses.has(row.status) && liveLead(row))
    .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime() || left.id.localeCompare(right.id))

  for (const row of ordered) {
    const leadId = row.lead_id!
    const overdue = new Date(row.due_at).getTime() < reference.getTime()
    const current = projections.get(leadId)
    if (!current) projections.set(leadId, { taskId: row.id, nextFollowUpAt: row.due_at, followUpOverdue: overdue })
    else if (overdue && !current.followUpOverdue) projections.set(leadId, { ...current, followUpOverdue: true })
  }

  return projections
}

export async function readActiveFollowUpTaskIndex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadIds: string[],
  errorLabel: string,
  errors: string[],
  reference = new Date(),
) {
  const rows: FollowUpTaskReadRow[] = []
  const pageSize = 1000
  if (leadIds.length === 0) return buildActiveFollowUpTaskIndex(rows, reference)

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from("tasks")
      .select("id, lead_id, due_at, status, task_kind, leads!inner(deleted_at, archived_at)")
      .in("lead_id", leadIds)
      .eq("task_kind", "follow_up")
      .in("status", ["pending", "in_progress"])
      .not("lead_id", "is", null)
      .is("leads.deleted_at", null)
      .is("leads.archived_at", null)
      .order("due_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1)
    if (error) {
      errors.push(`${errorLabel}: ${error.message}`)
      return buildActiveFollowUpTaskIndex([], reference)
    }
    const page = (data ?? []) as unknown as FollowUpTaskReadRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return buildActiveFollowUpTaskIndex(rows, reference)
}

export const followUpTaskReadInternals = { buildActiveFollowUpTaskIndex }

function normalizeUuid(value: string, field: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new TaskBoundaryError("TASK_INVALID_ARGUMENT", field)
  return value.toLowerCase()
}

function normalizeDueAt(value: string | Date) {
  const raw = value instanceof Date ? value.toISOString() : value
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
    throw new TaskBoundaryError("TASK_INVALID_ARGUMENT", "dueAt")
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw new TaskBoundaryError("TASK_INVALID_ARGUMENT", "dueAt")
  const fraction = (raw.match(/\.(\d+)/)?.[1] ?? "").slice(0, 6).padEnd(6, "0")
  return `${date.toISOString().slice(0, 19)}.${fraction}Z`
}

export function normalizeTaskInput(input: TaskInput): NormalizedTaskInput {
  const ownerId = normalizeUuid(input.ownerId, "ownerId")
  const leadId = input.leadId === null ? null : normalizeUuid(input.leadId, "leadId")
  const quoteId = input.quoteId === null ? null : normalizeUuid(input.quoteId, "quoteId")
  if ((leadId === null) === (quoteId === null)) throw new TaskBoundaryError("TASK_INVALID_ARGUMENT", "context")
  const description = typeof input.description === "string" ? input.description.trim() : ""
  if (description.length === 0 || description.length > 2000) throw new TaskBoundaryError("TASK_INVALID_ARGUMENT", "description")
  return { ownerId, leadId, quoteId, description, dueAt: normalizeDueAt(input.dueAt) }
}

export function taskIdempotencyKey(input: NormalizedTaskInput) {
  const context = input.leadId ? `lead=${input.leadId}` : `quote=${input.quoteId}`
  return createHash("sha256").update(`tasks:v1|owner=${input.ownerId}|${context}`).digest("hex")
}

export function mapTaskError(error: unknown): TaskBoundaryError {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code : undefined
  const mapped: Record<string, TaskErrorCode> = {
    PT001: "TASK_UNAUTHENTICATED", PT002: "TASK_INVALID_ARGUMENT", PT003: "TASK_FORBIDDEN",
    PT004: "TASK_CONTEXT_INVALID", PT005: "TASK_IDEMPOTENCY_CONFLICT", PT006: "TASK_INVALID_TRANSITION",
  }
  return new TaskBoundaryError(mapped[String(code)] ?? "TASK_DATABASE_ERROR")
}

export async function createTask(input: TaskInput): Promise<TaskRow> {
  const normalized = normalizeTaskInput(input)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_task", {
    p_owner_id: normalized.ownerId,
    p_lead_id: normalized.leadId,
    p_quote_id: normalized.quoteId,
    p_description: normalized.description,
    p_due_at: normalized.dueAt,
  })
  if (error) throw mapTaskError(error)
  return data as TaskRow
}

export async function listTasks(): Promise<TaskRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("tasks").select("*").order("due_at", { ascending: true })
  if (error) throw mapTaskError(error)
  return (data ?? []) as TaskRow[]
}
