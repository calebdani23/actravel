import { createHash } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database, Tables } from "@/lib/supabase/database.types"

export type StaffNotificationRow = Tables<"staff_notifications">
export type StaffNotificationKind = "task" | "quote" | "system"
export type StaffNotificationInput = {
  recipientId: string
  kind: StaffNotificationKind
  title: string
  body: string
  quoteId?: string | null
  taskId?: string | null
}
export type StaffNotificationErrorCode =
  | "STAFF_NOTIFICATION_UNAUTHENTICATED"
  | "STAFF_NOTIFICATION_INVALID_ARGUMENT"
  | "STAFF_NOTIFICATION_FORBIDDEN"
  | "STAFF_NOTIFICATION_CONTEXT_INVALID"
  | "STAFF_NOTIFICATION_IDEMPOTENCY_CONFLICT"
  | "STAFF_NOTIFICATION_UNKNOWN"

export class StaffNotificationBoundaryError extends Error {
  readonly code: StaffNotificationErrorCode
  constructor(code: StaffNotificationErrorCode) {
    super(code)
    this.name = "StaffNotificationBoundaryError"
    this.code = code
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const kinds = new Set<StaffNotificationKind>(["task", "quote", "system"])

function uuid(value: string | null | undefined): string | null {
  if (value == null) return null
  if (!uuidPattern.test(value)) throw new StaffNotificationBoundaryError("STAFF_NOTIFICATION_INVALID_ARGUMENT")
  return value.toLowerCase()
}

export function normalizeStaffNotification(input: StaffNotificationInput) {
  const recipientId = uuid(input.recipientId)
  const quoteId = uuid(input.quoteId)
  const taskId = uuid(input.taskId)
  const title = typeof input.title === "string" ? input.title.trim() : ""
  const body = typeof input.body === "string" ? input.body.trim() : ""
  if (!recipientId || !kinds.has(input.kind) || !title || title.length > 200 || !body || body.length > 2000) {
    throw new StaffNotificationBoundaryError("STAFF_NOTIFICATION_INVALID_ARGUMENT")
  }
  return { recipientId, kind: input.kind, title, body, quoteId, taskId }
}

export function staffNotificationIdempotencyKey(input: ReturnType<typeof normalizeStaffNotification>) {
  const canonical = `staff-notification:v1|recipient=${input.recipientId}|kind=${input.kind}|title=${input.title}|body=${input.body}|quote=${input.quoteId ?? "null"}|task=${input.taskId ?? "null"}`
  return createHash("sha256").update(canonical, "utf8").digest("hex")
}

export function mapStaffNotificationError(error: unknown): StaffNotificationBoundaryError {
  const sqlState = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined
  const mapped: Record<string, StaffNotificationErrorCode> = {
    SN001: "STAFF_NOTIFICATION_UNAUTHENTICATED",
    SN002: "STAFF_NOTIFICATION_INVALID_ARGUMENT",
    SN003: "STAFF_NOTIFICATION_FORBIDDEN",
    SN004: "STAFF_NOTIFICATION_CONTEXT_INVALID",
    SN005: "STAFF_NOTIFICATION_IDEMPOTENCY_CONFLICT",
  }
  return new StaffNotificationBoundaryError(mapped[String(sqlState)] ?? "STAFF_NOTIFICATION_UNKNOWN")
}

// Supabase's generated Args currently widens nullable SQL parameters to string.
// Keep the generated file authoritative; this narrow seam supplies the database's
// actual nullable context contract without changing shared factories or generated output.
type CreateArgs = Omit<Database["public"]["Functions"]["create_staff_notification"]["Args"], "p_quote_id" | "p_task_id"> & {
  p_quote_id: string | null
  p_task_id: string | null
}

export async function createStaffNotification(input: StaffNotificationInput): Promise<StaffNotificationRow> {
  const normalized = normalizeStaffNotification(input)
  const args: CreateArgs = {
    p_recipient_id: normalized.recipientId,
    p_kind: normalized.kind,
    p_title: normalized.title,
    p_body: normalized.body,
    p_quote_id: normalized.quoteId,
    p_task_id: normalized.taskId,
    p_idempotency_key: staffNotificationIdempotencyKey(normalized),
  }
  const { data, error } = await createSupabaseAdminClient().rpc("create_staff_notification", args as never)
  if (error) throw mapStaffNotificationError(error)
  return data as StaffNotificationRow
}

export async function listStaffNotifications(): Promise<StaffNotificationRow[]> {
  const { data, error } = await (await createClient()).from("staff_notifications").select("*").order("created_at", { ascending: false })
  if (error) throw mapStaffNotificationError(error)
  return (data ?? []) as StaffNotificationRow[]
}

export async function markStaffNotificationRead(notificationId: string): Promise<StaffNotificationRow> {
  const id = uuid(notificationId)
  if (!id) throw new StaffNotificationBoundaryError("STAFF_NOTIFICATION_INVALID_ARGUMENT")
  const { data, error } = await (await createClient()).rpc("mark_staff_notification_read", { p_notification_id: id })
  if (error) throw mapStaffNotificationError(error)
  return data as StaffNotificationRow
}
