import { strict as assert } from "node:assert"
import { test } from "node:test"
import type { Database } from "../lib/supabase/database.types"
import type { StaffNotificationInput } from "../lib/admin/staff-notifications"

type Notification = Database["public"]["Tables"]["staff_notifications"]["Row"]
type CreateArgs = Database["public"]["Functions"]["create_staff_notification"]["Args"]
type CreateReturn = Database["public"]["Functions"]["create_staff_notification"]["Returns"]
type MarkArgs = Database["public"]["Functions"]["mark_staff_notification_read"]["Args"]
type MarkReturn = Database["public"]["Functions"]["mark_staff_notification_read"]["Returns"]

const row: Notification = {
  id: "00000000-0000-0000-0000-000000000000",
  recipient_id: "00000000-0000-0000-0000-000000000001",
  kind: "task",
  title: "Title",
  body: "Body",
  quote_id: null,
  task_id: null,
  read_at: null,
  idempotency_key: "a".repeat(64),
  created_at: new Date().toISOString(),
}

const createArgs: CreateArgs = {
  p_recipient_id: row.recipient_id,
  p_kind: row.kind,
  p_title: row.title,
  p_body: row.body,
  p_quote_id: "00000000-0000-0000-0000-000000000002",
  p_task_id: "00000000-0000-0000-0000-000000000003",
  p_idempotency_key: row.idempotency_key,
}
const markArgs: MarkArgs = { p_notification_id: row.id }
const createReturn: CreateReturn = row
const markReturn: MarkReturn = row
const adapterInput: StaffNotificationInput = {
  recipientId: row.recipient_id,
  kind: "system",
  title: row.title,
  body: row.body,
  quoteId: null,
  taskId: null,
}

test("notification generated types expose exact table and RPC contracts", () => {
  assert.equal(createArgs.p_recipient_id, row.recipient_id)
  assert.equal(markArgs.p_notification_id, row.id)
  assert.equal(createReturn.id, markReturn.id)
  assert.equal(adapterInput.quoteId, null)
})
