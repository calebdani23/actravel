import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("quote version acceptance rpc stays locked to authenticated and service-role callers", () => {
  const migrationSource = [
    readFileSync("db/migrations/0034_quote_versions.sql", "utf8"),
    readFileSync("db/migrations/0035_quote_version_integrity.sql", "utf8"),
  ].join("\n");

  assert.match(migrationSource, /security definer/);
  assert.match(migrationSource, /revoke all on function public\.crm_accept_quote_version\(uuid, uuid\) from public;/i);
  assert.match(migrationSource, /revoke all on function public\.crm_accept_quote_version\(uuid, uuid\) from anon;/i);
  assert.match(migrationSource, /grant execute on function public\.crm_accept_quote_version\(uuid, uuid\) to authenticated;/i);
  assert.match(migrationSource, /grant execute on function public\.crm_accept_quote_version\(uuid, uuid\) to service_role;/i);
  assert.match(migrationSource, /if actor_role <> 'service_role'/i);
  assert.match(migrationSource, /public\.is_admin\(\) or public\.is_assigned_lead\(p_lead_id\)/i);
  assert.match(migrationSource, /insert into public\.lead_events \(lead_id, actor_id, event_type, payload\)/i);
  assert.match(migrationSource, /jsonb_build_object\([\s\S]*'statusLabel', 'Aceptada'[\s\S]*'rejectedAlternatives', rejected_count/i);
  assert.match(migrationSource, /accepted_at = null,\s+rejected_at = coalesce\(rejected_at, now\(\)\),\s+expired_at = null/i);
  assert.match(migrationSource, /accepted_at = coalesce\(accepted_at, now\(\)\),\s+rejected_at = null,\s+expired_at = null/i);
});
