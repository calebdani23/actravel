import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("db/migrations/0053_quotes_header_foundation.sql");
const databaseTypes = read("lib/supabase/database.types.ts");

test("0053 creates first-class quote headers with safe numbering and lifecycle governance", () => {
  assert.match(migration, /create sequence if not exists public\.quote_number_sequence/i);
  assert.match(migration, /nextval\('public\.quote_number_sequence'::regclass\)/i);
  assert.match(migration, /'COT-' \|\| to_char\(current_date, 'YYYY'\) \|\| '-' \|\|\s+lpad/i);
  assert.match(migration, /create table if not exists public\.quotes/i);
  assert.match(migration, /contact_id uuid not null references public\.contacts\(id\) on delete restrict/i);
  assert.match(migration, /lead_id uuid not null references public\.leads\(id\) on delete restrict/i);
  assert.match(migration, /status in \('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'\)/i);
  assert.match(migration, /owner_id uuid references public\.profiles\(id\) on delete set null/i);
  assert.match(migration, /created_by uuid references public\.profiles\(id\) on delete set null/i);
  assert.match(migration, /next_version_number integer not null default 1 check \(next_version_number >= 1\)/i);
  assert.match(migration, /lock_version integer not null default 0 check \(lock_version >= 0\)/i);
  assert.match(migration, /quotes_one_live_accepted_per_lead_idx[\s\S]*where status = 'accepted' and deleted_at is null/i);
  assert.match(migration, /current_version_id uuid[\s\S]*accepted_version_id uuid/i);
  assert.match(migration, /Current quote version must belong to the same quote/);
  assert.match(migration, /Accepted quote version must be accepted and belong to the same quote/);
  assert.match(migration, /Quote contact must match the opportunity contact/);
  assert.match(migration, /new\.next_version_number < old\.next_version_number[\s\S]*new\.lock_version < old\.lock_version/i);
});

test("legacy versions backfill exactly one deterministic header per opportunity without trusting version contact drift", () => {
  const backfill = migration.slice(
    migration.indexOf("with version_rollup as ("),
    migration.indexOf("alter table public.quote_versions disable trigger"),
  );

  assert.match(backfill, /from public\.quote_versions qv\s+group by qv\.lead_id/i);
  assert.match(backfill, /join public\.leads l on l\.id = vr\.lead_id/i);
  assert.match(backfill, /select\s+l\.contact_id,\s+l\.id,/i);
  assert.doesNotMatch(backfill, /select\s+qv\.contact_id/i);
  assert.match(backfill, /order by qv\.lead_id, qv\.version_number desc, qv\.updated_at desc, qv\.id desc/i);
  assert.match(backfill, /where qv\.status = 'accepted'/i);
  assert.match(backfill, /'migration-0053-legacy:' \|\| l\.id::text/i);
  assert.match(backfill, /max\(qv\.version_number\) \+ 1 as next_version_number/i);
  assert.match(migration, /update public\.quote_versions qv\s+set quote_id = q\.id/i);
  assert.match(migration, /validate constraint quote_versions_quote_id_fkey/i);
  assert.match(migration, /alter column quote_id set not null/i);
  assert.match(migration, /current_version_id = cv\.id,\s+accepted_version_id = av\.id/i);
  assert.match(migration, /q\.current_version_id is distinct from cv\.id[\s\S]*q\.accepted_version_id is distinct from av\.id/i);
});

test("quote versions gain quote-scoped identity and immutable finalized commercial content", () => {
  assert.match(migration, /add column if not exists quote_id uuid/i);
  assert.match(migration, /quote_versions_quote_id_fkey[\s\S]*references public\.quotes\(id\) on delete restrict/i);
  assert.match(migration, /quote_versions_unique_per_lead_version unique \(quote_id, version_number\)/i);
  assert.match(migration, /quote_versions_quote_idempotency_key_idx[\s\S]*\(quote_id, idempotency_key\)/i);
  assert.match(migration, /quote_versions_lead_idempotency_key_idx/);
  assert.match(migration, /status in \('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled', 'superseded'\)/i);
  assert.match(migration, /finalized_at timestamptz/);
  assert.match(migration, /finalized_by uuid references public\.profiles\(id\) on delete set null/i);
  assert.match(migration, /content_sha256 text/);
  assert.match(migration, /content_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /old\.finalized_at is not null[\s\S]*new\.status = 'draft'/i);
  for (const field of ["version_number", "title", "summary", "currency", "total_amount", "deposit_amount", "notes", "valid_until", "idempotency_key"]) {
    assert.match(migration, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  }
  assert.match(migration, /Finalized quote version commercial content is immutable/);
  assert.match(migration, /new\.id is distinct from old\.id[\s\S]*new\.created_by is distinct from old\.created_by[\s\S]*new\.created_at is distinct from old\.created_at/i);
  assert.match(migration, /Quote version must belong to the same quote, opportunity, and contact/);
  assert.match(migration, /Quote version intake request must belong to the same opportunity and contact/);
});

test("the legacy writer remains compatible without making new quote tables directly writable", () => {
  assert.match(migration, /alter column quote_id set default null/i);
  assert.match(migration, /before insert or update on public\.quote_versions[\s\S]*crm_enforce_quote_version_integrity/i);
  assert.match(migration, /if new\.quote_id is null then[\s\S]*'migration-0053-legacy:' \|\| new\.lead_id::text/i);
  assert.match(migration, /on conflict \(lead_id, idempotency_key\) where idempotency_key is not null do nothing/i);
  assert.match(migration, /crm_can_mutate_quote\(p_quote_id uuid\)[\s\S]*language sql\s+volatile\s+security definer/i);
  assert.match(migration, /create policy "quote versions insert scoped"[\s\S]*crm_can_mutate_quote\(quote_id\)/i);
  assert.match(migration, /create policy "quote versions update scoped"[\s\S]*crm_can_mutate_quote\(quote_id\)/i);

  const newTablePolicies = migration.slice(
    migration.indexOf('drop policy if exists "quotes read scoped"'),
    migration.indexOf("-- Existing direct version writes"),
  );
  assert.match(newTablePolicies, /create policy "quotes read scoped"[\s\S]*for select/i);
  assert.match(newTablePolicies, /create policy "quote request links read scoped"[\s\S]*for select/i);
  assert.match(newTablePolicies, /create policy "quote events read scoped"[\s\S]*for select/i);
  assert.doesNotMatch(newTablePolicies, /for (insert|update|delete|all)/i);
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger[\s\S]*from authenticated/i);
});

test("request provenance and quote audit are scoped, explicit, append-only, and rerun-idempotent", () => {
  const provenance = migration.slice(
    migration.indexOf("-- Explicit request provenance"),
    migration.indexOf("-- Narrow role helpers"),
  );

  assert.match(migration, /create table if not exists public\.quote_request_quote_links/i);
  assert.match(migration, /relation text not null check \(relation in \('originating', 'related'\)\)/i);
  assert.match(migration, /Quote request link must stay within the same contact and opportunity/);
  assert.match(migration, /where qv\.quote_request_id is not null\s+group by qv\.quote_id, qv\.quote_request_id/i);
  assert.match(migration, /case when rl\.relation_rank = 1 then 'originating' else 'related' end/i);
  assert.doesNotMatch(provenance, /public\.documents|document_type|bucket|path ilike/i);

  assert.match(migration, /create table if not exists public\.quote_events/i);
  for (const field of ["quote_id", "quote_version_id", "contact_id", "lead_id", "actor_id", "event_type", "payload", "idempotency_key", "created_at"]) {
    assert.match(migration, new RegExp(`${field} `));
  }
  assert.match(migration, /before update or delete on public\.quote_events/i);
  assert.match(migration, /Quote events are append-only/);
  assert.match(migration, /'quote_header_backfilled'/);
  assert.match(migration, /'migration-0053-header:' \|\| q\.id::text/i);
  assert.match(migration, /on conflict \(quote_id, idempotency_key\) where idempotency_key is not null do nothing/i);
});

test("quote RLS gives scoped reads to staff and no access to marketing or anonymous callers", () => {
  for (const table of ["quotes", "quote_request_quote_links", "quote_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /public\.has_role\('operaciones'\) or public\.has_role\('finanzas'\)/i);
  assert.match(migration, /public\.has_role\('asesor'\)[\s\S]*l\.assigned_to = auth\.uid\(\)[\s\S]*q\.deleted_at is null[\s\S]*l\.deleted_at is null[\s\S]*c\.deleted_at is null/i);
  assert.doesNotMatch(migration, /has_role\('marketing'\)/i);
  assert.match(migration, /crm_quote_profile_label\([\s\S]*crm_can_read_quote\(p_quote_id\)[\s\S]*q\.owner_id[\s\S]*qv\.finalized_by[\s\S]*qe\.actor_id/i);
  assert.match(migration, /revoke all on function public\.crm_quote_profile_label\(uuid, uuid\) from public, anon, service_role/i);
  assert.match(migration, /revoke all on table public\.quotes, public\.quote_request_quote_links, public\.quote_events from public, anon, service_role/i);
  assert.match(migration, /grant select on table public\.quotes, public\.quote_request_quote_links, public\.quote_events to authenticated/i);
});

test("quote read RPCs are normalized stable invoker contracts with authenticated-only ACLs", () => {
  for (const fn of ["crm_quote_page", "crm_quote_detail", "crm_quote_version_page", "crm_quote_request_link_page", "crm_quote_event_page"]) {
    const start = migration.indexOf(`create or replace function public.${fn}`);
    assert.ok(start > 0, `${fn} is missing`);
    const definition = migration.slice(start, migration.indexOf("$function$;", start) + "$function$;".length);
    assert.match(definition, /stable\s+security invoker\s+set search_path = ''/i);
    assert.doesNotMatch(definition, /security definer|jsonb_agg|json_agg|row_to_json/i);
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([^)]+\\) from public, anon, service_role;`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([^)]+\\) to authenticated;`, "i"));
  }
});

test("quote page filters and paginates one header while keeping current and accepted versions independent", () => {
  const page = migration.slice(
    migration.indexOf("create or replace function public.crm_quote_page"),
    migration.indexOf("create or replace function public.crm_quote_detail"),
  );

  for (const filter of ["p_search", "p_status", "p_owner_id", "p_contact_id", "p_opportunity_id", "p_currency", "p_validity", "p_include_deleted"]) {
    assert.match(page, new RegExp(filter));
  }
  assert.match(page, /q\.updated_at < p_after_updated_at\s+or \(q\.updated_at = p_after_updated_at and q\.id < p_after_id\)/i);
  assert.match(page, /order by q\.updated_at desc, q\.id desc\s+limit p_limit \+ 1/i);
  assert.match(page, /select count\(\*\) > p_limit as has_more from candidate_rows/i);
  assert.match(page, /from public\.quotes q/);
  assert.match(page, /crm_quote_profile_label\(pr\.id, pr\.owner_id\)/i);
  assert.match(page, /left join public\.quote_versions cv on cv\.id = pr\.current_version_id/i);
  assert.match(page, /left join public\.quote_versions av on av\.id = pr\.accepted_version_id/i);
  assert.match(page, /cv\.currency[\s\S]*av\.currency/i);
  assert.match(page, /version_rollup as \([\s\S]*request_rollup as \(/i);
  assert.match(page, /coalesce\(vr\.version_count, 0\)[\s\S]*coalesce\(rr\.request_count, 0\)/i);
});

test("quote detail uses bounded normalized child pages instead of unbounded aggregate JSON", () => {
  assert.match(migration, /crm_quote_detail\(p_quote_id uuid\)[\s\S]*version_count bigint,[\s\S]*request_count bigint,[\s\S]*event_count bigint/i);
  assert.match(migration, /originating_request_id uuid[\s\S]*latest_event_type text[\s\S]*latest_event_at timestamptz/i);
  assert.match(migration, /crm_quote_version_page\([\s\S]*p_limit integer default 20[\s\S]*limit p_limit \+ 1/i);
  assert.match(migration, /crm_quote_request_link_page\([\s\S]*p_limit integer default 20[\s\S]*limit p_limit \+ 1/i);
  assert.match(migration, /crm_quote_event_page\([\s\S]*p_limit integer default 50[\s\S]*limit p_limit \+ 1/i);
  assert.doesNotMatch(migration, /jsonb_agg|json_agg|array_agg\(json/i);
});

test("database types expose quote tables, relationships, compatibility fields, and read RPC rows", () => {
  for (const table of ["quotes", "quote_versions", "quote_request_quote_links", "quote_events"]) {
    assert.match(databaseTypes, new RegExp(`${table}: \\{`));
  }
  for (const fk of [
    "quotes_current_version_id_fkey",
    "quotes_accepted_version_id_fkey",
    "quote_versions_quote_id_fkey",
    "quote_request_quote_links_quote_id_fkey",
    "quote_events_quote_version_id_fkey",
  ]) assert.match(databaseTypes, new RegExp(fk));
  for (const field of ["quote_id?: string", "finalized_at", "finalized_by", "content_sha256"]) assert.match(databaseTypes, new RegExp(field.replace("?", "\\?")));
  for (const fn of ["crm_quote_page", "crm_quote_detail", "crm_quote_version_page", "crm_quote_request_link_page", "crm_quote_event_page"]) assert.match(databaseTypes, new RegExp(`${fn}:`));
  assert.match(databaseTypes, /current_currency: string \| null[\s\S]*accepted_currency: string \| null/);
});

test("0053 is additive, preserves customer rows, and is the next migration number", () => {
  assert.doesNotMatch(migration, /\b(delete from|truncate table|drop table)\b/i);
  assert.doesNotMatch(migration, /(insert into|update|delete from) public\.documents/i);
  assert.doesNotMatch(migration, /(from|join) public\.documents/i);

  const numbered = readdirSync("db/migrations")
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const phaseOneIndex = numbered.indexOf("0053_quotes_header_foundation.sql");
  assert.ok(phaseOneIndex >= 0);
  assert.equal(numbered[phaseOneIndex + 1], "0054_quote_pdf_documents_and_uploads.sql");
  assert.equal(numbered.filter((name) => name.startsWith("0053_")).length, 1);
});
