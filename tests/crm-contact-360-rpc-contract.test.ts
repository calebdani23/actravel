import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("db/migrations/0052_crm_contact_360_rpc_contracts.sql");
const contactLayer = read("lib/admin/contacts.ts");
const contactPage = read("app/admin/(protected)/contacts/[id]/page.tsx");
const databaseTypes = read("lib/supabase/database.types.ts");

const SUMMARY_SIGNATURE = String.raw`public\.crm_contact_360_summary\(p_contact_id uuid\)`;
const PAGE_SIGNATURE = String.raw`public\.crm_contact_opportunity_page\(\s*p_contact_id uuid,\s*p_state text default 'active',\s*p_limit integer default 20,\s*p_after_updated_at timestamptz default null,\s*p_after_id uuid default null\s*\)`;

test("Contact 360 RPC signatures are normalized stable invoker contracts with fixed search paths", () => {
  assert.match(migration, new RegExp(`create or replace function ${SUMMARY_SIGNATURE}`, "i"));
  assert.match(migration, new RegExp(`create or replace function ${PAGE_SIGNATURE}`, "i"));
  assert.equal((migration.match(/stable\s+security invoker\s+set search_path = ''/gi) ?? []).length, 2);
  assert.doesNotMatch(migration, /returns\s+json|jsonb_agg|row_to_json/i);

  for (const field of [
    "open_opportunity_count", "active_opportunity_count", "archived_opportunity_count", "deleted_opportunity_count", "total_opportunity_count",
    "request_count", "unassigned_request_count", "quote_version_count", "accepted_quote_count", "booking_count", "payment_count", "document_count",
    "duplicate_email_count", "duplicate_phone_count", "duplicate_risk", "overdue_follow_up_count", "next_follow_up_at", "last_activity_at",
    "pipeline_mxn", "pipeline_usd", "accepted_quote_value_mxn", "accepted_quote_value_usd",
  ]) assert.match(migration, new RegExp(field));
});

test("new read RPC ACLs are authenticated-only and preserve RLS authority", () => {
  for (const signature of [
    "crm_contact_360_summary\\(uuid\\)",
    "crm_contact_opportunity_page\\(uuid, text, integer, timestamptz, uuid\\)",
  ]) {
    for (const role of ["public", "anon", "service_role"]) assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from ${role};`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, "i"));
  }
  assert.match(migration, /from public\.contacts c\s+where c\.id = p_contact_id/i);
  assert.match(migration, /from public\.leads l\s+join public\.contacts c on c\.id = l\.contact_id/i);
  const summaryDefinition = migration.slice(migration.indexOf("create or replace function public.crm_contact_360_summary"), migration.indexOf("create or replace function public.crm_contact_opportunity_page"));
  assert.match(summaryDefinition, /security invoker/);
  assert.doesNotMatch(summaryDefinition, /security definer/);
});

test("opportunity pagination validates state and cursor and uses limit-plus-one keyset semantics", () => {
  assert.match(migration, /p_state not in \('active', 'archived', 'deleted', 'all'\)/);
  assert.match(migration, /p_limit is null or p_limit < 1 or p_limit > 100/);
  assert.match(migration, /\(p_after_updated_at is null\) <> \(p_after_id is null\)/);
  assert.match(migration, /l\.updated_at < p_after_updated_at\s+or \(l\.updated_at = p_after_updated_at and l\.id < p_after_id\)/);
  assert.match(migration, /order by l\.updated_at desc, l\.id desc\s+limit p_limit \+ 1/);
  assert.match(migration, /select count\(\*\) > p_limit as has_more from candidate_rows/);
  assert.match(migration, /order by pr\.updated_at desc, pr\.id desc/);
});

test("requests and commercial quotes aggregate independently without cross-product inflation", () => {
  const requestStart = migration.indexOf("request_ranked as (");
  const quoteStart = migration.indexOf("quote_ranked as (");
  const finalJoinStart = migration.indexOf("left join request_rollup rr", quoteStart);
  assert.ok(requestStart > 0 && quoteStart > requestStart && finalJoinStart > quoteStart);
  assert.match(migration.slice(requestStart, quoteStart), /from public\.quote_requests qr\s+join page_rows pr/);
  assert.doesNotMatch(migration.slice(requestStart, quoteStart), /quote_versions/);
  assert.match(migration.slice(quoteStart, finalJoinStart), /from public\.quote_versions qv\s+join page_rows pr/);
  assert.match(migration, /order by qv\.version_number desc, qv\.id desc/);
  assert.match(migration, /where qr\.status = 'accepted'/);
  assert.match(migration, /left join latest_quote lq[\s\S]*left join accepted_quote aq/);
});

test("advisor quote access and acceptance require assignment plus live opportunity and parent", () => {
  assert.match(migration, /crm_advisor_can_access_live_opportunity\(p_lead_id uuid\)[\s\S]*l\.assigned_to = auth\.uid\(\)[\s\S]*l\.deleted_at is null[\s\S]*c\.deleted_at is null/);
  assert.match(migration, /create policy "lead read scoped"[\s\S]*assigned_to = auth\.uid\(\)[\s\S]*crm_advisor_can_access_live_opportunity\(id\)/);
  for (const policy of ["quote requests staff write", "quote versions insert scoped", "quote versions update scoped"]) assert.match(migration, new RegExp(`create policy "${policy}"[\\s\\S]*crm_advisor_can_access_live_opportunity`, "i"));
  assert.match(migration, /if not actor_admin and not \([\s\S]*public\.has_role\('asesor'\)[\s\S]*lead_row\.assigned_to = actor_id[\s\S]*lead_row\.deleted_at is null[\s\S]*lead_row\.contact_deleted_at is null/);
  assert.match(migration, /if actor_role <> 'service_role'/);
  assert.match(migration, /grant execute on function public\.crm_accept_quote_version\(uuid, uuid\) to service_role/);
});

test("only justified Contact 360 indexes are additive", () => {
  for (const index of [
    "leads_contact_updated_cursor_idx", "quote_requests_lead_created_idx", "quote_versions_contact_lead_version_idx", "lead_events_latest_follow_up_idx",
  ]) assert.match(migration, new RegExp(`create index if not exists ${index}`));
  assert.match(migration, /lead_events\(lead_id, created_at desc, id desc\)\s+where event_type = 'follow_up_registered'/);
});

test("application list and Contact 360 loaders use the approved RPC boundaries", () => {
  const listSource = contactLayer.split("export async function getContact360")[0];
  assert.equal((listSource.match(/\.rpc\("crm_contact_aggregate_page"/g) ?? []).length, 1);
  assert.doesNotMatch(listSource, /\.from\("(leads|quote_requests|contacts)"\)/);
  assert.doesNotMatch(contactLayer, /profiles\(id,full_name\)|profiles\(id, full_name\)/);
  assert.match(contactLayer, /\.rpc\("crm_contact_360_summary"/);
  assert.match(contactLayer, /\.rpc\("crm_contact_opportunity_page"/);
  assert.doesNotMatch(contactLayer, /error:\s*\[[^\]]*\.message/);
  for (const limit of ["payments", "bookings", "documents"]) assert.match(contactLayer, new RegExp(`from\\("${limit}"\\)[\\s\\S]{0,200}\\.limit\\(10\\)`));
});

test("Contact 360 UI separates requests, commercial quotes, currencies, states, and full management links", () => {
  for (const label of ["Solicitud del cliente", "Cotización comercial aceptada", "Última cotización comercial", "Pipeline MXN", "Pipeline USD", "Aceptado MXN", "Aceptado USD", "Abrir gestión completa", "Cargar más oportunidades"]) assert.match(contactPage, new RegExp(label));
  assert.match(contactPage, /isAdmin \? \["active", "archived", "deleted"\] : \["active", "archived"\]/);
  assert.match(contactPage, /formatAdminCurrency\(quote\.amount, quote\.currency\)/);
  assert.match(contactPage, /afterUpdatedAt: detail\.nextCursor\.updatedAt, afterId: detail\.nextCursor\.id/);
  assert.doesNotMatch(contactPage, /Carga incompleta/);
});

test("database types include new RPC rows and live profile relationship metadata", () => {
  for (const fn of ["crm_contact_360_summary", "crm_contact_opportunity_page", "crm_advisor_can_access_live_opportunity"]) assert.match(databaseTypes, new RegExp(`${fn}:`));
  for (const fk of ["contacts_blocked_by_fkey", "contacts_deleted_by_fkey", "leads_assigned_to_fkey", "leads_archived_by_fkey", "leads_deleted_by_fkey"]) assert.match(databaseTypes, new RegExp(fk));
  for (const currencyField of ["pipeline_mxn", "pipeline_usd", "accepted_quote_value_mxn", "accepted_quote_value_usd", "latest_quote_currency", "accepted_quote_currency"]) assert.match(databaseTypes, new RegExp(currencyField));
});
