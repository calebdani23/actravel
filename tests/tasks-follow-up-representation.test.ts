import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const sql = readFileSync("db/migrations/0064_follow_up_task_representation.sql", "utf8")

test("0064 defines the additive representation and exact bounds", () => {
  for (const column of ["task_kind", "source_event_id", "source_event_type", "source_event_created_at", "source_due_at", "source_payload", "metadata"]) {
    assert.match(sql, new RegExp(`alter table public\\.tasks[\\s\\S]*add column ${column}`, "i"))
  }
  assert.match(sql, /task_kind\s+text\s+not null\s+default\s+'manual'/i)
  assert.match(sql, /octet_length\(convert_to\(metadata::text,\s*'UTF8'\)\) <= 8192/i)
  assert.match(sql, /octet_length\(convert_to\(source_payload::text,\s*'UTF8'\)\) <= 65536/i)
  assert.match(sql, /create unique index\s+tasks_source_event_id_idx[\s\S]*where source_event_id is not null/i)
  assert.doesNotMatch(sql, /source_event_id\s+uuid\s+references/i)
})

test("0064 validates complete manual/follow-up inserts and immutable provenance", () => {
  assert.match(sql, /before insert on public\.tasks/i)
  assert.match(sql, /follow_up_registered/i)
  assert.match(sql, /new\.lead_id is null/i)
  assert.match(sql, /new\.quote_id is not null/i)
  assert.match(sql, /source_due_at\s+is\s+distinct\s+from\s+new\.due_at/i)
  assert.match(sql, /metadata[\s\S]*follow_up_task\.v1/i)
  assert.match(sql, /lower\(new\.source_event_id::text\)/i)
  assert.match(sql, /before update on public\.tasks/i)
  assert.match(sql, /new\.source_event_id\s+is distinct from old\.source_event_id/i)
  assert.match(sql, /new\.metadata\s+is distinct from old\.metadata/i)
})

test("0064 is representation-only and ordered after local prerequisites", () => {
  const migrationFiles = ["0061_manager_capability_foundation.sql", "0062_tasks_foundation.sql", "0063_staff_notifications_foundation.sql", "0064_follow_up_task_representation.sql"]
  assert.deepEqual(migrationFiles, [...migrationFiles].sort())
  assert.doesNotMatch(sql, /insert\s+into\s+public\.tasks/i)
  assert.doesNotMatch(sql, /update\s+public\.tasks/i)
  assert.doesNotMatch(sql, /delete\s+from\s+public\.tasks/i)
  assert.doesNotMatch(sql, /create_task|task_transition|rpc|backfill|classification|ledger/i)
})
