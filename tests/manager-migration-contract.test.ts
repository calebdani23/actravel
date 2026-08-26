import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrationPath = "db/migrations/0061_manager_capability_foundation.sql";
const migration = readFileSync(migrationPath, "utf8");
const identity = readFileSync("db/migrations/0002_identity.sql", "utf8");
const rls = readFileSync("db/migrations/0008_rls.sql", "utf8");
const types = readFileSync("lib/supabase/database.types.ts", "utf8");

test("0061 is the verified next migration and is atomic", () => {
  const migrations = readdirSync("db/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.equal(migrations[migrations.indexOf("0060_quote_pdf_creation_cutover.sql") + 1], "0061_manager_capability_foundation.sql");
  assert.match(migration, /^\s*--[\s\S]*?\bbegin;[\s\S]*\bcommit;\s*$/i);
  assert.doesNotMatch(migration, /delete\s+from|truncate\s+table|drop\s+table|drop\s+schema|rename\s+table/i);
});

test("0061 expands the role constraint and persists Manager idempotently", () => {
  assert.match(migration, /drop constraint if exists roles_name_check/i);
  assert.match(migration, /add constraint roles_name_check check/i);
  assert.match(migration, /'manager'/i);
  assert.match(migration, /insert into public\.roles\s*\(name, description\)[\s\S]*values\s*\('manager', 'Management staff for approvals and operational visibility'\)[\s\S]*on conflict \(name\) do update/i);
  assert.match(migration, /set description = excluded\.description/i);
});

test("Manager can read the role catalog while governance writes stay Admin-only", () => {
  assert.match(migration, /create policy "roles staff read" on public\.roles[\s\S]*public\.has_role\('manager'\)/i);
  assert.match(rls, /create policy "roles admin write" on public\.roles for all to authenticated using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i);
  assert.match(rls, /create policy "profile_roles admin write" on public\.profile_roles for all to authenticated using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i);
  assert.doesNotMatch(migration, /profile_roles.*for (?:insert|update|delete|all)/i);
});

test("0061 preserves the active-profile helper and existing protected table policies", () => {
  assert.match(rls, /public\.has_role\(role_name text\)[\s\S]*stable[\s\S]*security definer[\s\S]*p\.is_active[\s\S]*r\.name = role_name/i);
  assert.match(rls, /create policy "lead read scoped" on public\.leads for select/i);
  assert.match(rls, /create policy "crm contact read" on public\.contacts for select/i);
  assert.match(rls, /create policy "quote requests staff read" on public\.quote_requests for select/i);
  assert.match(rls, /create policy "payments finance read" on public\.payments for select/i);
  assert.match(rls, /create policy "notification logs staff read" on public\.notification_logs for select/i);
  assert.doesNotMatch(migration, /public\.(?:leads|contacts|quote_requests|payments|notification_logs|lead_events)\s+(?:drop|alter|create)/i);
});

test("generated roles.name remains a broad string and migration is fix-forward safe", () => {
  const rolesSection = types.slice(types.indexOf("      roles: {"), types.indexOf("      roles: {") + 1000);
  assert.match(rolesSection, /name: string/);
  assert.doesNotMatch(rolesSection, /name: "manager"/);
  assert.match(migration, /drop policy if exists "roles staff read"/i);
  assert.match(migration, /create policy "roles staff read"/i);
});

test("Manager migration does not introduce generic capability or audit schema", () => {
  assert.doesNotMatch(migration, /create table|create function|capabilit|rpc|audit/i);
  assert.match(identity, /create table public\.roles/i);
});
