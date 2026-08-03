import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/0060_quote_pdf_creation_cutover.sql", "utf8");
const types = readFileSync("lib/supabase/database.types.ts", "utf8");
const actions = readFileSync("app/admin/(protected)/quotes/actions.ts", "utf8");
const lifecycle = readFileSync("components/admin/quotes/quote-lifecycle-panel.tsx", "utf8");
const detail = readFileSync("app/admin/(protected)/quotes/[id]/page.tsx", "utf8");

test("0060 follows 0059 and independently removes every compatibility writer", () => {
  const migrations = readdirSync("db/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.equal(migrations[migrations.indexOf("0059_quote_registration_intents.sql") + 1], "0060_quote_pdf_creation_cutover.sql");
  for (const signature of [
    "crm_create_quote\\(uuid, text, text, text, numeric, numeric, date, text, uuid, text\\)",
    "crm_link_legacy_quote_document\\(uuid, uuid, text\\)",
    "crm_accept_quote_version\\(uuid, uuid\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated, service_role`, "i"));
    assert.match(migration, new RegExp(`drop function public\\.${signature}`, "i"));
  }
  assert.doesNotMatch(migration, /create or replace function public\.(?:crm_create_quote|crm_link_legacy_quote_document|crm_accept_quote_version)/i);
  assert.doesNotMatch(types, /crm_create_quote:|crm_link_legacy_quote_document:|crm_accept_quote_version:/);
});

test("0060 repeats direct quote version revocation and removes auto-header compatibility", () => {
  assert.match(migration, /drop policy if exists "quote versions insert scoped"/i);
  assert.match(migration, /drop policy if exists "quote versions update scoped"/i);
  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger[\s\S]*from authenticated/i);
  assert.match(migration, /grant select on table public\.quote_versions to authenticated/i);
  assert.match(migration, /alter table public\.quote_versions alter column quote_id drop default/i);
  const integrity = migration.slice(migration.indexOf("create or replace function public.crm_enforce_quote_version_integrity"), migration.indexOf("-- Existing quotes are intentionally untouched"));
  assert.match(integrity, /if new\.quote_id is null then[\s\S]*require an existing quote header/i);
  assert.doesNotMatch(integrity, /insert into public\.quotes|migration-0053-legacy/i);
  assert.match(integrity, /security definer[\s\S]*set search_path = ''/i);
});

test("new quote invariant is deferred, insert-only, and proves the full finalized native V1 object", () => {
  const invariant = migration.slice(migration.indexOf("create or replace function public.crm_enforce_new_quote_registration_complete"), migration.indexOf("-- Retain all prior portfolio issues"));
  assert.match(invariant, /create constraint trigger enforce_new_quote_registration_complete[\s\S]*after insert on public\.quotes[\s\S]*deferrable initially deferred/i);
  for (const proof of [
    "qri.status = 'finalized'",
    "q.status = 'ready'",
    "q.current_version_id = qv.id",
    "qv.version_number = 1",
    "qv.status = 'ready'",
    "qv.finalized_at is not null",
    "d.quote_link_source = 'native'",
    "d.storage_state = 'ready'",
    "d.bucket = 'quote-pdfs'",
    "d.mime_type = 'application/pdf'",
    "d.byte_size = qri.trusted_verified_size_bytes",
    "d.sha256 = qri.trusted_verified_sha256",
    "join storage.objects",
  ]) assert.match(invariant, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.doesNotMatch(migration, /delete from public\.|truncate table public\.|drop table/i);
});

test("legacy candidates become registration recovery issues without mutating historical links", () => {
  assert.doesNotMatch(migration, /legacy_pdf_candidate|legacy-pdf-candidate/i);
  for (const issue of ["registration_intent_expired", "registration_intent_failed", "registration_object_cleanup"]) assert.match(migration, new RegExp(issue));
  assert.doesNotMatch(migration, /update public\.documents|delete from public\.documents/i);
  assert.doesNotMatch(actions, /crm_link_legacy_quote_document|linkLegacyQuoteDocumentAction/);
  assert.doesNotMatch(lifecycle, /Vincular documento legado|quoteLegacyLinkConfirmation|legacyDocuments/);
  assert.doesNotMatch(detail, /getLegacyQuoteDocumentOptions|legacyDocuments/);
  assert.match(detail, /legacy_quote_document_linked: "PDF legado vinculado"/);
});

test("0060 data-quality replacement and private guards keep exact ACL and search path", () => {
  assert.match(migration, /create or replace function public\.crm_quote_data_quality_page[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.crm_quote_data_quality_page\(integer, text, text\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.crm_quote_data_quality_page\(integer, text, text\)[\s\S]*to authenticated/i);
  assert.match(migration, /revoke all on function public\.crm_enforce_new_quote_registration_complete\(\)[\s\S]*from public, anon, authenticated, service_role/i);
});
