import { readFileSync } from "node:fs"
import { test } from "node:test"
import { strict as assert } from "node:assert"

test("Tasks RLS is read-only and encodes the ownership matrix", () => {
  const sql = readFileSync("db/migrations/0062_tasks_foundation.sql", "utf8")
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /for select to authenticated/i)
  assert.doesNotMatch(sql, /create policy[^\n]*for (insert|update|delete|all)/i)
  assert.match(sql, /is_admin\(\)/i)
  assert.match(sql, /has_role\(['"]manager['"]\)/i)
  assert.match(sql, /owner_id\s*=\s*auth\.uid\(\)/i)
  assert.match(sql, /owner_id\s*=\s*auth\.uid\(\)/i)
  assert.match(sql, /public\.is_admin\(\)/i)
  assert.doesNotMatch(sql, /staff_notifications/i)
})
