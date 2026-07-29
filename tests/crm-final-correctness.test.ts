import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("final aggregate RPC is filter-aware, paginated, and returns authoritative UI aggregates", () => {
  const sql = read("db/migrations/0049_crm_contact_aggregate_filters.sql");
  for (const filter of ["p_search", "p_lifecycle", "p_blocked", "p_advisor", "p_open_only", "p_overdue", "p_duplicate", "p_destination", "p_service", "p_source", "p_quick_view", "p_deleted_only"]) assert.match(sql, new RegExp(filter));
  for (const value of ["open_opportunity_count", "deleted_opportunity_count", "featured_opportunity_count", "request_count", "quote_count", "last_activity_at", "next_follow_up_at", "duplicate_risk", "pipeline_mxn", "pipeline_usd"]) assert.match(sql, new RegExp(value));
  assert.match(sql, /count\(\*\) over\(\)/);
  assert.match(sql, /limit greatest/);
});

test("contact loader consumes the aggregate page and preserves deleted-opportunity and activity coverage", () => {
  const source = read("lib/admin/contacts.ts");
  const sql = read("db/migrations/0049_crm_contact_aggregate_filters.sql");
  assert.match(source, /p_limit: 50/);
  assert.match(source, /p_deleted_opportunity_only/);
  assert.doesNotMatch(source.split("export async function getContact360")[0], /from\("contacts"\)\.select\("\*"\)/);
  assert.doesNotMatch(source, /p_limit: 500|p_limit: 1000|\.limit\((500|1000)\)/);
  for (const table of ["lead_events", "quote_requests", "quote_versions", "payments", "bookings", "documents", "notification_logs", "whatsapp_clicks"]) assert.match(sql, new RegExp(table));
  assert.match(sql, /p_unassigned/);
  assert.match(sql, /deleted_count,0\)>0/);
  assert.match(source, /p_contact_id: id/);
});

test("purge requires explicit test-data markers at the database boundary", () => {
  const sql = read("db/migrations/0048_crm_test_purge_and_blocked_outbound.sql");
  const actions = read("app/admin/(protected)/leads/[id]/actions.ts");
  const types = read("lib/supabase/database.types.ts");
  assert.match(sql, /is_test_data boolean not null default false/);
  assert.match(sql, /crm_require_test_data_purge/);
  assert.match(sql, /old\.is_test_data is not true/);
  assert.match(sql, /before delete on public\.leads/);
  assert.match(sql, /before delete on public\.contacts/);
  assert.match(sql, /p_confirmation text/);
  assert.match(sql, /p_confirmation is distinct from 'PURGAR DATOS DE PRUEBA'/);
  assert.match(sql, /auth\.uid\(\) is null or not public\.is_admin\(\)/);
  assert.match(sql, /revoke all on function public\.crm_delete_lead_guarded\(uuid, boolean, text\) from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function public\.crm_delete_lead_guarded\(uuid, boolean, text\) to authenticated/);
  assert.match(actions, /p_confirmation: TEST_DATA_PURGE_CONFIRMATION/);
  assert.match(types, /p_confirmation: string/);
});

test("contact aggregate active opportunity semantics exclude archived and deleted records", () => {
  const sql = read("db/migrations/0049_crm_contact_aggregate_filters.sql");
  assert.match(sql, /drop function if exists public\.crm_contact_aggregate_page\(integer,integer,boolean,text\)/);
  assert.match(sql, /l\.deleted_at is null and l\.archived_at is null and not l\.terminal/);
  assert.match(sql, /l\.deleted_at is null and l\.archived_at is null and l\.is_featured/);
  assert.match(sql, /sum\(l\.budget_mxn\) filter \(where l\.deleted_at is null and l\.archived_at is null\)/);
  assert.match(sql, /sum\(l\.budget_usd\) filter \(where l\.deleted_at is null and l\.archived_at is null\)/);
  assert.match(sql, /e\.event_type = 'follow_up_registered' and l\.deleted_at is null and l\.archived_at is null/);
  assert.doesNotMatch(sql, /drop function if exists public\.crm_contact_aggregate_page\(integer,integer,boolean,boolean,text,text,boolean,uuid,boolean,boolean,boolean,uuid,uuid,text,text,uuid\)/);
});

test("blocked public quote intake records review and skips outbound boundaries", () => {
  const source = read("lib/leads/quote-request-service.ts");
  assert.match(source, /const outboundSuppressed = identityResolution\.blocked/);
  assert.match(source, /blocked_contact_review/);
  assert.match(source, /if \(!outboundSuppressed\)/);
  assert.match(source, /status: "skipped"/);
  assert.match(source, /sendMetaLeadEvent/);
  assert.match(source, /processQuoteNotifications/);
});

test("bulk selection is deduplicated and rejects over-limit selections without truncation", () => {
  const source = read("app/admin/(protected)/contacts/actions.ts");
  assert.match(source, /Array\.from\(new Set/);
  assert.match(source, /MAX_BULK_IDS = 500/);
  assert.match(source, /La selección no fue modificada/);
  assert.doesNotMatch(source, /slice\(0, 100\)/);
});
