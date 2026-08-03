import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync("db/migrations/0053_quotes_header_foundation.sql", "utf8");
const freshMigration = readFileSync("db/migrations/0054_quote_pdf_documents_and_uploads.sql", "utf8");
const hotfixMigration = readFileSync("db/migrations/0058_fix_legacy_quote_document_link_ambiguity.sql", "utf8");

function definition(source: string) {
  const start = source.indexOf("create or replace function public.crm_link_legacy_quote_document");
  assert.ok(start >= 0, "crm_link_legacy_quote_document is missing");
  const end = source.indexOf("$function$;", start);
  assert.ok(end > start, "crm_link_legacy_quote_document has no terminator");
  return source.slice(start, end + "$function$;".length);
}

const freshFunction = definition(freshMigration);
const hotfixFunction = definition(hotfixMigration);

test("fresh and hotfix definitions avoid output-variable conflict inference", () => {
  for (const rpc of [freshFunction, hotfixFunction]) {
    assert.match(rpc, /insert into public\.quote_events[\s\S]*on conflict do nothing;/i);
    assert.doesNotMatch(rpc, /on conflict\s*\(/i);
    assert.doesNotMatch(rpc, /#variable_conflict|plpgsql\.variable_conflict/i);
    assert.match(rpc, /update public\.documents as d[\s\S]*uploaded_at = coalesce\(d\.uploaded_at, d\.created_at\)[\s\S]*where d\.id = p_document_id/i);
    assert.match(rpc, /select d\.id, version_row\.quote_id, d\.quote_version_id, d\.bucket, d\.path, d\.storage_state/i);
  }
});

test("bare conflict handling remains constrained by the per-quote event idempotency index", () => {
  assert.match(foundation, /create unique index if not exists quote_events_quote_idempotency_key_idx\s+on public\.quote_events\(quote_id, idempotency_key\)\s+where idempotency_key is not null;/i);
  for (const rpc of [freshFunction, hotfixFunction]) {
    assert.match(rpc, /'legacy-document:' \|\| p_document_id::text[\s\S]*on conflict do nothing;/i);
    assert.equal((rpc.match(/insert into public\.quote_events/gi) ?? []).length, 1);
    assert.equal((rpc.match(/insert into public\.lead_events/gi) ?? []).length, 1);
    assert.ok(rpc.indexOf("update public.documents as d") < rpc.indexOf("insert into public.quote_events"));
    assert.ok(rpc.indexOf("insert into public.quote_events") < rpc.indexOf("insert into public.lead_events"));
  }
});

test("hotfix preserves the public result shape, validations, no-move behavior, and ACL", () => {
  assert.match(hotfixFunction, /returns table\(\s*document_id uuid,\s*quote_id uuid,\s*quote_version_id uuid,\s*bucket text,\s*path text,\s*storage_state text\s*\)/i);
  assert.match(hotfixFunction, /language plpgsql\s+security definer\s+set search_path = ''/i);
  assert.match(hotfixFunction, /actor_id is null or not public\.is_admin\(\)/i);
  assert.match(hotfixFunction, /p_confirmation is distinct from 'VINCULAR PDF LEGADO'/i);
  assert.match(hotfixFunction, /version_row\.quote_deleted_at is not null[\s\S]*version_row\.lead_deleted_at is not null[\s\S]*version_row\.contact_deleted_at is not null/i);
  assert.match(hotfixFunction, /document_row\.contact_id is distinct from version_row\.contact_id[\s\S]*document_row\.lead_id is distinct from version_row\.lead_id/i);
  assert.match(hotfixFunction, /document_row\.bucket <> 'documents'[\s\S]*lower\(document_row\.path\) !~ '\\\.pdf\$'/i);
  assert.match(hotfixFunction, /from storage\.objects so[\s\S]*so\.bucket_id = document_row\.bucket[\s\S]*so\.name = document_row\.path[\s\S]*for update/i);
  assert.match(hotfixFunction, /'objectMoved', false/i);
  assert.doesNotMatch(hotfixFunction, /update storage\.objects|insert into storage\.objects|delete from storage\.objects/i);
  assert.match(hotfixMigration, /revoke all on function public\.crm_link_legacy_quote_document\(uuid, uuid, text\)\s+from public, anon, authenticated, service_role;/i);
  assert.match(hotfixMigration, /grant execute on function public\.crm_link_legacy_quote_document\(uuid, uuid, text\)\s+to authenticated;/i);
});

test("0058 is independently applicable after 0056 and does not depend on the 0057 cutover", () => {
  assert.doesNotMatch(hotfixMigration, /crm_accept_quote|quote versions insert scoped|quote versions update scoped/i);
  assert.doesNotMatch(hotfixMigration, /alter table|create table|create index|drop function/i);
  assert.equal(hotfixFunction, freshFunction);
});
