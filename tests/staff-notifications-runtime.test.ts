import { strict as assert } from "node:assert"
import { test } from "node:test"
import {
  mapStaffNotificationError,
  normalizeStaffNotification,
  staffNotificationIdempotencyKey,
  StaffNotificationBoundaryError,
} from "../lib/admin/staff-notifications"

const recipient = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"

test("normalization and canonical SHA-256 key are exact and stable", () => {
  const normalized = normalizeStaffNotification({ recipientId: recipient, kind: "task", title: "  Hello ", body: " Body  " })
  assert.deepEqual(normalized, { recipientId: recipient.toLowerCase(), kind: "task", title: "Hello", body: "Body", quoteId: null, taskId: null })
  assert.equal(staffNotificationIdempotencyKey(normalized), "977ea15ad8464b87f2e4db5d1396c6f800fb25876525ba2ab03c8c9f076ea7c9")
})

test("invalid context/content fails before a client boundary", () => {
  for (const input of [
    { recipientId: recipient, kind: "task" as const, title: "", body: "ok" },
    { recipientId: recipient, kind: "other" as never, title: "ok", body: "ok" },
    { recipientId: recipient, kind: "task" as const, title: "ok", body: "ok", taskId: "bad" },
  ]) assert.throws(() => normalizeStaffNotification(input), StaffNotificationBoundaryError)
})

test("only SQLSTATE codes are mapped and unknown details are not disclosed", () => {
  assert.equal(mapStaffNotificationError({ code: "SN003", message: "secret" }).code, "STAFF_NOTIFICATION_FORBIDDEN")
  assert.equal(mapStaffNotificationError({ code: "P0001", message: "SN003" }).code, "STAFF_NOTIFICATION_UNKNOWN")
})
