import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/0059_quote_registration_intents.sql", "utf8");
const types = readFileSync("lib/supabase/database.types.ts", "utf8");

function definition(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = migration.indexOf("$function$;", start);
  assert.ok(end > start, `${name} has no function terminator`);
  return migration.slice(start, end + "$function$;".length);
}

test("0059 adds durable quote registration reservations without mutating existing quote rows", () => {
  assert.match(migration, /create table if not exists public\.quote_registration_intents/i);
  for (const field of [
    "actor_id", "contact_id", "opportunity_id", "originating_request_id",
    "idempotency_key", "target_quote_id", "target_quote_version_id",
    "target_document_id", "title", "summary", "currency", "total_amount",
    "deposit_amount", "valid_until", "notes", "bucket", "path",
    "expected_mime_type", "expected_size_bytes", "advisory_sha256",
    "trusted_verified_size_bytes", "trusted_verified_sha256", "status",
    "attempt_count", "attempt_started_at", "expires_at", "recovery_deadline",
    "last_error_code", "last_error_message", "finalized_at", "failed_at",
    "abandoned_at", "created_at", "updated_at",
  ]) assert.match(migration, new RegExp(`${field} `));
  assert.match(migration, /unique \(actor_id, idempotency_key\)/i);
  assert.match(migration, /unique \(target_quote_id\)/i);
  assert.match(migration, /unique \(target_quote_version_id\)/i);
  assert.match(migration, /unique \(target_document_id\)/i);
  assert.match(migration, /status in \('pending', 'finalized', 'failed', 'abandoned'\)/i);
  assert.match(migration, /expected_size_bytes between 1 and 20971520/i);
  assert.match(migration, /recovery_deadline <= created_at \+ interval '24 hours'/i);
  assert.match(migration, /add column if not exists registration_intent_id uuid/i);
  assert.match(migration, /quotes_registration_intent_id_fkey[\s\S]*references public\.quote_registration_intents\(id\)[\s\S]*on delete restrict/i);
  assert.match(migration, /quotes_registration_intent_id_key unique \(registration_intent_id\)/i);
  assert.doesNotMatch(migration, /update public\.quotes[\s\S]{0,120}registration_intent_id|registration_intent_id\s*=\s*coalesce/i);
  assert.doesNotMatch(migration, /insert into public\.quote_registration_intents\s*\([^;]+\)\s*select/i);
});

test("registration identity, payload, and canonical path are immutable with one controlled retry transition", () => {
  const guard = definition("crm_enforce_quote_registration_intent_integrity");
  assert.match(guard, /tg_op = 'DELETE'[\s\S]*durable audit records and cannot be deleted/i);
  assert.match(guard, /contacts\/%s\/opportunities\/%s\/quotes\/%s\/versions\/%s\/%s\.pdf/i);
  assert.match(guard, /new\.path !~ '\^contacts\//i);
  for (const field of [
    "actor_id", "contact_id", "opportunity_id", "originating_request_id",
    "idempotency_key", "target_quote_id", "target_quote_version_id",
    "target_document_id", "title", "summary", "currency", "total_amount",
    "deposit_amount", "valid_until", "notes", "bucket", "path",
    "expected_mime_type", "expected_size_bytes", "advisory_sha256",
    "recovery_deadline", "created_at",
  ]) assert.match(guard, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  assert.match(guard, /retrying := old\.status = 'failed' and new\.status = 'pending'/i);
  assert.match(guard, /new\.attempt_count <> old\.attempt_count \+ 1/i);
  assert.match(guard, /old\.status = 'pending' and new\.status in \('pending', 'finalized', 'failed', 'abandoned'\)/i);
  assert.match(guard, /old\.status = 'failed' and new\.status in \('failed', 'pending', 'abandoned'\)/i);
  assert.match(guard, /Pending quote registration intents cannot have materialized targets/i);
  assert.match(guard, /Finalized quote registration intent requires one canonical ready target set/i);
  assert.match(definition("crm_enforce_quote_registration_link"), /Quote registration provenance is immutable/i);
});

test("begin derives live scope, validates request and commercial input, and reserves IDs without creating quote records", () => {
  const begin = definition("crm_begin_quote_registration");
  assert.match(begin, /perform public\.crm_validate_quote_commercial_input/i);
  assert.match(begin, /p_expected_size_bytes < 1 or p_expected_size_bytes > 20971520/i);
  assert.match(begin, /p_advisory_sha256 !~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(begin, /join public\.contacts c on c\.id = l\.contact_id/i);
  assert.match(begin, /public\.is_admin\(\)[\s\S]*public\.has_role\('asesor'\)[\s\S]*scope_row\.assigned_to = registration_actor_id/i);
  assert.match(begin, /qr\.lead_id = scope_row\.opportunity_id[\s\S]*qr\.contact_id = scope_row\.contact_id/i);
  assert.match(begin, /Idempotent quote registration replay changed immutable input/i);
  assert.match(begin, /new_quote_id uuid := gen_random_uuid\(\)/i);
  assert.match(begin, /new_version_id uuid := gen_random_uuid\(\)/i);
  assert.match(begin, /new_document_id uuid := gen_random_uuid\(\)/i);
  assert.match(begin, /insert into public\.quote_registration_intents/i);
  assert.doesNotMatch(begin, /insert into public\.(quotes|quote_versions|documents|quote_events|lead_events)/i);
  assert.doesNotMatch(begin, /update public\.(quotes|quote_versions|documents)/i);
  assert.match(begin, /intent_row\.status = 'failed'[\s\S]*set status = 'pending'[\s\S]*attempt_count = qri\.attempt_count \+ 1/i);
});

test("begin and finalization use the established relational lock order before registration and Storage locks", () => {
  for (const name of ["crm_begin_quote_registration", "crm_register_quote_with_pdf", "crm_fail_quote_registration"]) {
    const rpc = definition(name);
    const positions = [
      rpc.indexOf("perform 1 from public.contacts c"),
      rpc.indexOf("perform 1 from public.leads l"),
      rpc.indexOf("perform 1 from public.quotes q where q.lead_id"),
      rpc.indexOf("perform 1 from public.quote_versions qv where qv.lead_id"),
      rpc.indexOf("perform 1\n  from public.documents d"),
      rpc.indexOf("perform 1 from public.quote_upload_intents qui"),
      rpc.indexOf("perform 1 from public.quote_registration_intents qri"),
    ];
    assert.ok(positions.every((position) => position >= 0), `${name} is missing a lock stage`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  }
  const register = definition("crm_register_quote_with_pdf");
  assert.ok(register.indexOf("public.quote_registration_intents qri") < register.indexOf("from storage.objects so"));
});

test("service-only finalization verifies trusted bytes and atomically creates exactly the canonical ready model", () => {
  const register = definition("crm_register_quote_with_pdf");
  assert.match(register, /auth\.role\(\) is distinct from 'service_role'/i);
  assert.match(register, /registration_actor_id := intent_row\.actor_id/i);
  assert.match(register, /profile_roles[\s\S]*p\.is_active[\s\S]*r\.name = 'admin'[\s\S]*r\.name = 'asesor'[\s\S]*scope_row\.assigned_to = registration_actor_id/i);
  assert.match(register, /originating_request_id[\s\S]*qr\.lead_id = intent_row\.opportunity_id[\s\S]*qr\.contact_id = intent_row\.contact_id/i);
  assert.match(register, /from storage\.objects so[\s\S]*for update/i);
  assert.match(register, /metadata ->> 'size'[\s\S]*metadata ->> 'contentLength'/i);
  assert.match(register, /metadata ->> 'mimetype'[\s\S]*metadata ->> 'contentType'/i);
  assert.match(register, /object_row\.created_at < intent_row\.attempt_started_at[\s\S]*object_row\.updated_at[\s\S]*intent_row\.expires_at/i);
  assert.match(register, /p_verified_size_bytes is distinct from intent_row\.expected_size_bytes/i);
  assert.match(register, /p_verified_sha256 is distinct from intent_row\.advisory_sha256/i);
  assert.match(register, /byte_size, sha256[\s\S]*p_verified_size_bytes,[\s\S]*p_verified_sha256/i);

  const quoteInsert = register.indexOf("insert into public.quotes");
  const versionInsert = register.indexOf("insert into public.quote_versions");
  const linkInsert = register.indexOf("insert into public.quote_request_quote_links");
  const documentInsert = register.indexOf("insert into public.documents");
  const versionReady = register.indexOf("update public.quote_versions");
  const audit = register.indexOf("public.crm_record_quote_mutation");
  const intentFinal = register.indexOf("update public.quote_registration_intents");
  assert.ok(quoteInsert < versionInsert && versionInsert < linkInsert && linkInsert < documentInsert);
  assert.ok(documentInsert < versionReady && versionReady < audit && audit < intentFinal);
  assert.match(register, /'quote_registered_with_pdf'[\s\S]*'mandatoryInitialPdf', true/i);
  assert.match(register, /set status = 'finalized',[\s\S]*trusted_verified_size_bytes = p_verified_size_bytes[\s\S]*trusted_verified_sha256 = p_verified_sha256/i);
  assert.match(register, /intent_row\.status = 'finalized'[\s\S]*created_quote\.lock_version, true/i);
});

test("failure and bounded recovery are actor/admin-only, expose no hashes or commercial payload, and create no quote", () => {
  const fail = definition("crm_fail_quote_registration");
  const read = definition("crm_quote_registration_intent");
  assert.match(fail, /intent_row\.actor_id = caller_id or public\.is_admin\(\)/i);
  assert.match(fail, /intent_row\.status = 'finalized'[\s\S]*true/i);
  assert.match(fail, /intent_row\.status in \('failed', 'abandoned'\)[\s\S]*true/i);
  assert.match(fail, /set status = 'failed',[\s\S]*last_error_code = trim\(p_error_code\)[\s\S]*failed_at = now\(\)/i);
  assert.doesNotMatch(fail, /insert into public\.(quotes|quote_versions|documents)|delete from/i);
  assert.match(read, /qri\.actor_id = caller_id or public\.is_admin\(\)/i);
  assert.match(read, /where qri\.id = p_intent_id/i);
  assert.match(read, /retry_allowed boolean[\s\S]*cleanup_allowed boolean/i);
  assert.doesNotMatch(read, /advisory_sha256|trusted_verified_sha256|title|summary|currency|total_amount|deposit_amount|notes/i);
});

test("Storage registration policy is exact insert-only and cleanup is failed-or-abandoned only", () => {
  const uploadHelper = definition("crm_can_upload_quote_registration_object");
  const deleteHelper = definition("crm_can_delete_quote_registration_object");
  assert.match(uploadHelper, /qri\.bucket = p_bucket[\s\S]*qri\.path = p_path/i);
  assert.match(uploadHelper, /qri\.actor_id = auth\.uid\(\)[\s\S]*qri\.status = 'pending'[\s\S]*qri\.expires_at > now\(\)/i);
  assert.match(uploadHelper, /public\.is_admin\(\)[\s\S]*public\.has_role\('asesor'\)[\s\S]*l\.assigned_to = auth\.uid\(\)/i);
  assert.match(deleteHelper, /qri\.status in \('failed', 'abandoned'\)/i);
  assert.match(deleteHelper, /not exists \([\s\S]*q\.registration_intent_id = qri\.id/i);
  assert.match(migration, /create policy "quote registration intent upload"[\s\S]*for insert to authenticated[\s\S]*crm_can_upload_quote_registration_object\(bucket_id, name\)/i);
  assert.match(migration, /create policy "quote registration object cleanup read"[\s\S]*for select to authenticated[\s\S]*crm_can_delete_quote_registration_object\(bucket_id, name\)/i);
  assert.match(migration, /create policy "quote registration object cleanup"[\s\S]*for delete to authenticated[\s\S]*crm_can_delete_quote_registration_object\(bucket_id, name\)/i);
  assert.doesNotMatch(migration, /create policy "quote registration[^"]*"[\s\S]{0,100}for update/i);
  assert.doesNotMatch(migration, /drop policy if exists "quote pdf (intent upload|scoped read|pending delete)"/i);
});

test("RPC ACLs keep registration finalization service-only and all definitions use fixed empty search paths", () => {
  for (const name of [
    "crm_begin_quote_registration",
    "crm_register_quote_with_pdf",
    "crm_fail_quote_registration",
    "crm_quote_registration_intent",
  ]) assert.match(definition(name), /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.crm_register_quote_with_pdf\(uuid, bigint, text\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.crm_register_quote_with_pdf\(uuid, bigint, text\)[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.crm_register_quote_with_pdf\(uuid, bigint, text\)\s+to authenticated;/i);
  assert.match(migration, /grant execute on function public\.crm_begin_quote_registration\([\s\S]*\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.crm_fail_quote_registration\(uuid, text, text\)[\s\S]*to authenticated/i);
  assert.match(migration, /grant execute on function public\.crm_quote_registration_intent\(uuid\)[\s\S]*to authenticated/i);
  assert.match(migration, /revoke all on table public\.quote_registration_intents[\s\S]*from public, anon, authenticated, service_role/i);
});

test("database types expose registration rows, quote provenance, trusted RPC inputs, and service-only result", () => {
  assert.match(types, /quote_registration_intents: \{[\s\S]*advisory_sha256: string[\s\S]*trusted_verified_sha256: string \| null/i);
  assert.match(types, /quotes: \{[\s\S]*registration_intent_id: string \| null/i);
  assert.match(types, /quotes_registration_intent_id_fkey[\s\S]*referencedRelation: "quote_registration_intents"/i);
  for (const name of [
    "crm_begin_quote_registration",
    "crm_register_quote_with_pdf",
    "crm_fail_quote_registration",
    "crm_quote_registration_intent",
  ]) assert.match(types, new RegExp(`${name}: \\{`));
  assert.match(types, /crm_register_quote_with_pdf: \{[\s\S]*p_verified_sha256: string[\s\S]*p_verified_size_bytes: number/i);
  assert.match(types, /checksum and size must come from trusted downloaded bytes/i);
});

test("0059 follows 0058, does not depend on deferred 0057, and preserves legacy APIs", () => {
  const migrations = readdirSync("db/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.equal(migrations[migrations.indexOf("0058_fix_legacy_quote_document_link_ambiguity.sql") + 1], "0059_quote_registration_intents.sql");
  assert.equal(migrations.filter((name) => name.startsWith("0059_")).length, 1);
  assert.doesNotMatch(migration, /0057_quote_rpc_cutover|drop function[^;]*crm_create_quote|drop function[^;]*crm_link_legacy_quote_document/i);
  assert.doesNotMatch(migration, /create or replace function public\.crm_create_quote|create or replace function public\.crm_link_legacy_quote_document/i);
  assert.doesNotMatch(migration, /\b(delete from public\.(quotes|quote_versions|documents)|truncate table|drop table)\b/i);
});
