import { readFileSync } from "node:fs"
import { test } from "node:test"
import { strict as assert } from "node:assert"

const migrationPath = "db/migrations/0062_tasks_foundation.sql"

test("Tasks foundation migration has the exact ledger contract", () => {
  const sql = readFileSync(migrationPath, "utf8")
  assert.match(sql, /create table public\.tasks/i)
  for (const column of ["id", "owner_id", "lead_id", "quote_id", "description", "due_at", "status", "idempotency_key", "created_at", "updated_at"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"))
  }
  assert.doesNotMatch(sql, /\btitle\b/i)
  assert.match(sql, /description\s+text\s+not null/i)
  assert.match(sql, /due_at\s+timestamptz/i)
  assert.match(sql, /status[^\n]*pending[^\n]*$/im)
  for (const status of ["pending", "in_progress", "completed", "canceled"]) assert.match(sql, new RegExp(`['"]${status}['"]`))
  assert.match(sql, /on delete set null/i)
  assert.match(sql, /on delete restrict/i)
  assert.match(sql, /tasks_one_context_check\s+check\s*\(\s*lead_id\s+is\s+null\s+or\s+quote_id\s+is\s+null\s*\)/i)
  assert.match(sql, /if p_owner_id is null[^\n]*\(p_lead_id is null\) = \(p_quote_id is null\)/i)
  assert.match(sql, /create unique index[^;]*\(\s*owner_id\s*,\s*idempotency_key\s*\)/i)
  assert.match(sql, /TASK_UNAUTHENTICATED|PT001/)
  for (const code of ["PT001", "PT002", "PT003", "PT004", "PT005", "PT006"]) assert.match(sql, new RegExp(code))
})

test("Tasks foundation exposes only authenticated human RPCs", () => {
  const sql = readFileSync(migrationPath, "utf8")
  for (const fn of ["task_actor_can_manage", "create_task", "task_transition"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`, "i"))
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}`, "i"))
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[^;]*to authenticated`, "i"))
  }
  assert.match(sql, /security definer/i)
  assert.match(sql, /set search_path\s*=\s*public/i)
  assert.match(sql, /revoke all on table public\.tasks from public, anon, authenticated, service_role/i)
  assert.doesNotMatch(sql, /staff_notifications/i)
})
