import { readFileSync } from "node:fs"
import { strict as assert } from "node:assert"
import { test } from "node:test"

const migrationPath = "db/migrations/0063_staff_notifications_foundation.sql"

function sql() {
  return readFileSync(migrationPath, "utf8")
}

test("Notifications foundation declares the constrained immutable ledger", () => {
  const source = sql()
  assert.match(source, /create table public\.staff_notifications/i)
  for (const column of [
    "id", "recipient_id", "kind", "title", "body", "quote_id", "task_id",
    "read_at", "idempotency_key", "created_at",
  ]) assert.match(source, new RegExp(`\\b${column}\\b`, "i"))
  assert.match(source, /id uuid primary key default gen_random_uuid\(\)/i)
  assert.match(source, /created_at timestamptz not null default now\(\)/i)
  assert.match(source, /kind text not null check \(kind in \('task', 'quote', 'system'\)\)/i)
  assert.match(source, /char_length\(trim\(title\)\) between 1 and 200/i)
  assert.match(source, /char_length\(trim\(body\)\) between 1 and 2000/i)
  assert.match(source, /idempotency_key ~ '\^\[0-9a-f\]\{64\}\$'/i)
  assert.match(source, /recipient_id uuid not null references public\.profiles\(id\) on delete restrict/i)
  assert.match(source, /quote_id uuid references public\.quotes\(id\) on delete set null/i)
  assert.match(source, /task_id uuid references public\.tasks\(id\) on delete set null/i)
  assert.match(source, /create unique index[^;]+on public\.staff_notifications\(recipient_id, idempotency_key\)/i)
  for (const index of ["recipient_created", "unread", "quote_id", "task_id"])
    assert.match(source, new RegExp(`create (?:unique )?index staff_notifications_${index}_idx`, "i"))
  assert.match(source, /read_at is null/i)
  assert.match(source, /no delete/i)
})

test("Notifications creation and read state are exposed only through authorized RPCs", () => {
  const source = sql()
  assert.match(source, /revoke all on table public\.staff_notifications from public, anon, authenticated, service_role/i)
  assert.match(source, /grant select on table public\.staff_notifications to authenticated/i)
  assert.match(source, /enable row level security/i)
  assert.match(source, /create policy [^\n]+ on public\.staff_notifications\s+for select to authenticated/i)
  assert.match(source, /auth\.uid\(\) = recipient_id/i)
  assert.match(source, /is_active/i)
  for (const fn of ["create_staff_notification", "mark_staff_notification_read"]) {
    assert.match(source, new RegExp(`create or replace function public\\.${fn}`, "i"))
    assert.match(source, new RegExp(`alter function public\\.${fn}[^;]+ owner to postgres`, "i"))
    assert.match(source, new RegExp(`revoke all on function public\\.${fn}[^;]+ from public, anon, authenticated, service_role`, "i"))
    assert.match(source, new RegExp(`security definer[^\n]+set search_path = public`, "i"))
  }
  assert.match(source, /grant execute on function public\.create_staff_notification[^;]+to service_role/i)
  assert.match(source, /grant execute on function public\.mark_staff_notification_read[^;]+to authenticated/i)
  assert.match(source, /auth\.role\(\)\s*(?:=|<>)\s*'service_role'/i)
  assert.match(source, /auth\.role\(\)\s*(?:=|<>)\s*'authenticated'/i)
  for (const code of ["SN001", "SN002", "SN003", "SN004", "SN005"])
    assert.match(source, new RegExp(code))
})

test("Notifications RPCs preserve history and make replay/read operations idempotent", () => {
  const source = sql()
  assert.match(source, /on conflict \(recipient_id, idempotency_key\) do nothing/i)
  assert.match(source, /for update/i)
  assert.match(source, /is distinct from/i)
  assert.match(source, /coalesce\(read_at, now\(\)\)/i)
  assert.match(source, /where .*recipient_id/i)
  assert.match(source, /status <> 'canceled'/i)
  assert.match(source, /deleted_at is null/i)
  assert.doesNotMatch(source, /delete from public\.staff_notifications/i)
})
