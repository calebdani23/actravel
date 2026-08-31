import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/database.types"
import { createHash } from "node:crypto"

export type TaskRow = Tables<"tasks">
export type TaskStatus = "pending" | "in_progress" | "completed" | "canceled"
export type TaskInput = {
  ownerId: string
  leadId: string | null
  quoteId: string | null
  description: string
  dueAt: string | Date
}
export type NormalizedTaskInput = Omit<TaskInput, "dueAt"> & { dueAt: string }
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
const statusSet = new Set<TaskStatus>(["pending", "in_progress", "completed", "canceled"])

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

export async function transitionTask(taskId: string, targetStatus: TaskStatus): Promise<TaskRow> {
  const id = normalizeUuid(taskId, "taskId")
  if (!statusSet.has(targetStatus)) throw new TaskBoundaryError("TASK_INVALID_ARGUMENT", "status")
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("task_transition", { p_task_id: id, p_target_status: targetStatus })
  if (error) throw mapTaskError(error)
  return data as TaskRow
}

export async function listTasks(): Promise<TaskRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("tasks").select("*").order("due_at", { ascending: true })
  if (error) throw mapTaskError(error)
  return (data ?? []) as TaskRow[]
}
