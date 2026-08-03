import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildQuotePdfPath,
  hasPdfMagicSignature,
  QUOTE_PDF_BUCKET,
  QUOTE_PDF_MAX_SIZE_BYTES,
  QUOTE_PDF_MIME_TYPE,
  quotePdfSha256,
  validateQuotePdfFile,
} from "@/lib/admin/quote-pdf";

const migration = readFileSync("db/migrations/0054_quote_pdf_documents_and_uploads.sql", "utf8");
const phaseOne = readFileSync("db/migrations/0053_quotes_header_foundation.sql", "utf8");
const types = readFileSync("lib/supabase/database.types.ts", "utf8");
const cutover = readFileSync("db/migrations/0060_quote_pdf_creation_cutover.sql", "utf8");

const ids = {
  contactId: "11111111-1111-4111-8111-111111111111",
  opportunityId: "22222222-2222-4222-8222-222222222222",
  quoteId: "33333333-3333-4333-8333-333333333333",
  versionId: "44444444-4444-4444-8444-444444444444",
  documentId: "55555555-5555-4555-8555-555555555555",
};

test("quote PDF helpers enforce UUID-only paths without customer PII", () => {
  assert.equal(QUOTE_PDF_BUCKET, "quote-pdfs");
  assert.equal(QUOTE_PDF_MIME_TYPE, "application/pdf");
  assert.equal(QUOTE_PDF_MAX_SIZE_BYTES, 20 * 1024 * 1024);
  assert.equal(
    buildQuotePdfPath(ids),
    "contacts/11111111-1111-4111-8111-111111111111/opportunities/22222222-2222-4222-8222-222222222222/quotes/33333333-3333-4333-8333-333333333333/versions/44444444-4444-4444-8444-444444444444/55555555-5555-4555-8555-555555555555.pdf",
  );
  assert.throws(() => buildQuotePdfPath({ ...ids, contactId: "cliente@example.com" }), /Identificador inválido/);
  assert.doesNotMatch(buildQuotePdfPath(ids), /@|cliente|nombre|cotizacion-/i);
});

test("quote PDF helpers validate MIME, extension, size, magic signature, and SHA-256", async () => {
  const content = new TextEncoder().encode("%PDF-1.7\ncontenido");
  const valid = new File([content], "cotizacion.pdf", { type: "application/pdf" });
  const metadata = await validateQuotePdfFile(valid);

  assert.deepEqual(metadata, {
    byteSize: content.byteLength,
    mimeType: "application/pdf",
    sha256: quotePdfSha256(content),
  });
  assert.equal(hasPdfMagicSignature(content), true);
  assert.equal(quotePdfSha256(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  await assert.rejects(validateQuotePdfFile(new File([content], "cotizacion.txt", { type: "application/pdf" })), /extensión \.pdf/);
  await assert.rejects(validateQuotePdfFile(new File([content], "cotizacion.pdf", { type: "text/plain" })), /application\/pdf/);
  await assert.rejects(validateQuotePdfFile(new File(["not-a-pdf"], "cotizacion.pdf", { type: "application/pdf" })), /firma PDF válida/);
  await assert.rejects(
    validateQuotePdfFile(new File([new Uint8Array(QUOTE_PDF_MAX_SIZE_BYTES + 1)], "grande.pdf", { type: "application/pdf" })),
    /20 MB/,
  );
});

test("documents enforce one canonical quote row per version and exact relational scope", () => {
  assert.match(migration, /add column if not exists quote_version_id uuid/i);
  assert.match(migration, /documents_quote_version_id_fkey[\s\S]*references public\.quote_versions\(id\) on delete restrict/i);
  assert.match(migration, /documents_quote_version_id_key unique \(quote_version_id\)/i);
  assert.match(migration, /\(document_type = 'quote'\) = \(quote_version_id is not null\)/i);
  assert.match(migration, /new\.quote_link_source is not null[\s\S]*new\.quote_linked_at is not null[\s\S]*new\.quote_linked_by is not null/i);
  assert.match(migration, /document_type in \('itinerary', 'voucher', 'invoice', 'identification', 'contract', 'quote', 'other'\)/i);
  assert.match(migration, /new\.contact_id is distinct from version_row\.contact_id[\s\S]*new\.lead_id is distinct from version_row\.lead_id/i);
  assert.match(migration, /Quote PDF documents cannot belong to a booking/);
  assert.match(migration, /Canonical quote documents cannot be hard-deleted/);
});

test("native canonical documents require quote-pdfs PDF metadata while controlled legacy links retain documents objects", () => {
  assert.match(migration, /new\.quote_link_source = 'native'[\s\S]*new\.bucket <> 'quote-pdfs'[\s\S]*new\.path <> expected_path/i);
  assert.match(migration, /new\.mime_type is distinct from 'application\/pdf'/i);
  assert.match(migration, /new\.byte_size < 1 or new\.byte_size > 20971520/i);
  assert.match(migration, /new\.sha256 !~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /Ready native quote PDFs require byte size and SHA-256 metadata/);
  assert.match(migration, /new\.quote_link_source = 'legacy_confirmed'[\s\S]*new\.bucket <> 'documents'/i);
  assert.match(migration, /Legacy quote PDFs must retain their existing documents object/);
});

test("ready and finalized quote artifacts cannot be replaced, unlinked, edited, or generically deleted", () => {
  assert.match(migration, /old\.storage_state = 'ready'[\s\S]*Ready quote PDF artifacts are immutable/i);
  assert.match(migration, /version_row\.finalized_at is not null and not finalizing_object/i);
  assert.match(phaseOne, /when status = 'ready' then finalized_at is not null[\s\S]*when status = 'sent' then finalized_at is not null[\s\S]*when status = 'accepted' then finalized_at is not null/i);
  assert.match(migration, /new\.quote_version_id is distinct from old\.quote_version_id/i);
  assert.match(migration, /new\.bucket is distinct from old\.bucket[\s\S]*new\.path is distinct from old\.path/i);
  assert.match(migration, /create policy "documents generic update"[\s\S]*using \(\s*quote_version_id is null[\s\S]*with check \(\s*quote_version_id is null/i);
  assert.match(migration, /create policy "documents generic delete"[\s\S]*quote_version_id is null/i);
  assert.match(migration, /crm_can_manage_generic_document_object\([\s\S]*not exists \([\s\S]*d\.quote_version_id is not null/i);
  assert.match(migration, /operations delete generic document objects[\s\S]*crm_can_manage_generic_document_object\(bucket_id, name\)/i);
});

test("upload intents bind one version, document, object path, actor, MIME, size, expiry, and lifecycle", () => {
  assert.match(migration, /create table if not exists public\.quote_upload_intents/i);
  assert.match(migration, /quote_upload_intents_quote_version_key unique \(quote_version_id\)/i);
  assert.match(migration, /quote_upload_intents_document_key unique \(document_id\)/i);
  assert.match(migration, /quote_upload_intents_bucket_path_key unique \(bucket, path\)/i);
  assert.match(migration, /status in \('pending', 'uploaded', 'finalized', 'failed', 'abandoned'\)/i);
  assert.match(migration, /expected_mime_type text not null default 'application\/pdf'/i);
  assert.match(migration, /max_size_bytes bigint not null default 20971520/i);
  assert.match(migration, /Quote upload intent path must be the server-owned UUID-only path/);
  assert.match(migration, /qui\.actor_id = auth\.uid\(\)[\s\S]*qui\.status = 'pending'[\s\S]*qui\.expires_at > now\(\)/i);
  assert.match(migration, /new\.actor_id is distinct from auth\.uid\(\)[\s\S]*scope_row\.quote_deleted_at is not null[\s\S]*scope_row\.assigned_to = auth\.uid\(\)/i);
  assert.match(migration, /scope_row\.storage_state <> 'pending'/i);
  assert.match(migration, /Quote upload intents are lifecycle audit records and cannot be deleted/);
});

test("quote-pdfs is private, PDF-only, 20 MB, insert-only, and role-scoped", () => {
  assert.match(migration, /values \('quote-pdfs', 'quote-pdfs', false, 20971520, array\['application\/pdf'\]\)/i);
  const uploadPolicy = migration.slice(migration.indexOf('create policy "quote pdf intent upload"'), migration.indexOf('drop policy if exists "quote pdf scoped read"'));
  assert.match(uploadPolicy, /for insert to authenticated/);
  assert.match(uploadPolicy, /public\.is_admin\(\)[\s\S]*public\.has_role\('asesor'\)[\s\S]*l\.assigned_to = auth\.uid\(\)/i);
  assert.match(uploadPolicy, /q\.deleted_at is null[\s\S]*l\.deleted_at is null[\s\S]*c\.deleted_at is null/i);
  assert.doesNotMatch(uploadPolicy, /operaciones|finanzas|marketing|anon/i);

  const readPolicy = migration.slice(migration.indexOf('create policy "quote pdf scoped read"'), migration.indexOf('drop policy if exists "quote pdf pending delete"'));
  assert.match(readPolicy, /bucket_id in \('quote-pdfs', 'documents'\)/i);
  assert.match(readPolicy, /public\.crm_can_read_quote\(q\.id\)/i);
  assert.match(readPolicy, /d\.storage_state = 'ready'/i);
  assert.match(readPolicy, /q\.deleted_at is null[\s\S]*l\.deleted_at is null[\s\S]*c\.deleted_at is null/i);
  assert.match(migration, /create policy "staff read private storage objects"[\s\S]*crm_can_manage_generic_document_object\(bucket_id, name\)/i);
  assert.doesNotMatch(migration, /create policy "quote pdf[^\"]*"[\s\S]{0,80}for update/i);
  assert.match(phaseOne, /public\.has_role\('operaciones'\) or public\.has_role\('finanzas'\)/i);
  assert.match(phaseOne, /public\.has_role\('asesor'\)[\s\S]*l\.assigned_to = auth\.uid\(\)/i);
  assert.doesNotMatch([migration, phaseOne.slice(phaseOne.indexOf("create or replace function public.crm_can_read_quote"), phaseOne.indexOf("create or replace function public.crm_can_mutate_quote"))].join("\n"), /has_role\('marketing'\)/i);
});

test("storage deletion requires a failed unfinalized draft intent", () => {
  const deletePolicy = migration.slice(migration.indexOf('create policy "quote pdf pending delete"'), migration.indexOf("-- No UPDATE policy"));
  assert.match(deletePolicy, /qui\.status = 'failed'/i);
  assert.match(deletePolicy, /d\.storage_state = 'failed'/i);
  assert.doesNotMatch(deletePolicy, /qui\.status in \('pending', 'uploaded'/i);
  assert.match(deletePolicy, /qv\.finalized_at is null/i);
  assert.match(deletePolicy, /qv\.status = 'draft'/i);
  assert.match(deletePolicy, /public\.crm_can_mutate_quote\(q\.id\)/i);
  assert.doesNotMatch(deletePolicy, /storage_state = 'ready'|status = 'accepted'|status = 'sent'/i);
});

test("historical 0054 legacy linking was explicit and 0060 removes all new linking", () => {
  const rpc = migration.slice(migration.indexOf("create or replace function public.crm_link_legacy_quote_document"), migration.indexOf("-- PostgreSQL cannot change"));
  assert.match(rpc, /actor_id is null or not public\.is_admin\(\)/i);
  assert.match(rpc, /p_confirmation is distinct from 'VINCULAR PDF LEGADO'/i);
  assert.match(rpc, /document_row\.document_type <> 'other'/i);
  assert.match(rpc, /document_row\.status <> 'active'/i);
  assert.match(rpc, /document_row\.contact_id is distinct from version_row\.contact_id/i);
  assert.match(rpc, /document_row\.lead_id is distinct from version_row\.lead_id/i);
  assert.match(rpc, /lower\(document_row\.path\) !~ '\\\.pdf\$'/i);
  assert.match(rpc, /perform 1\s+from storage\.objects so[\s\S]*so\.bucket_id = document_row\.bucket[\s\S]*so\.name = document_row\.path[\s\S]*for update/i);
  assert.match(rpc, /'legacy_quote_document_linked'/);
  assert.match(rpc, /'objectMoved', false/);
  assert.doesNotMatch(rpc, /document_row\.title|ilike|update storage\.objects|insert into storage\.objects|delete from storage\.objects/i);
  assert.match(migration, /revoke all on function public\.crm_link_legacy_quote_document\(uuid, uuid, text\) from public, anon, service_role/i);
  assert.match(cutover, /drop function public\.crm_link_legacy_quote_document\(uuid, uuid, text\)/i);
  assert.doesNotMatch(cutover, /update public\.documents|delete from public\.documents/i);
});

test("quote read contracts retain signatures and expose canonical PDF metadata without signed URLs", () => {
  assert.match(migration, /drop function if exists public\.crm_quote_page\(integer, timestamptz, uuid, text, text, uuid, uuid, uuid, text, text, boolean\)/i);
  assert.match(migration, /current_document_id uuid[\s\S]*current_pdf_state text[\s\S]*accepted_document_id uuid[\s\S]*accepted_pdf_state text/i);
  assert.match(migration, /current_pdf_bucket text[\s\S]*current_pdf_path text[\s\S]*current_pdf_sha256 text/i);
  assert.match(migration, /document_id uuid[\s\S]*pdf_state text[\s\S]*pdf_bucket text[\s\S]*pdf_path text/i);
  assert.match(migration, /left join public\.documents current_document[\s\S]*current_document\.quote_version_id = cv\.id/i);
  assert.match(migration, /left join public\.documents accepted_document[\s\S]*accepted_document\.quote_version_id = av\.id/i);
  assert.doesNotMatch(migration, /createSignedUrl|signed_url|signedUrl/i);
});

test("database types include quote document metadata, upload intents, relationships, and extended RPC rows", () => {
  for (const field of ["quote_version_id", "storage_state", "mime_type", "byte_size", "sha256", "uploaded_at", "quote_link_source"]) assert.match(types, new RegExp(`${field}:`));
  for (const relation of ["documents_quote_version_id_fkey", "quote_upload_intents_document_id_fkey", "quote_upload_intents_quote_version_id_fkey"]) assert.match(types, new RegExp(relation));
  assert.match(types, /quote_upload_intents: \{/);
  assert.doesNotMatch(types, /crm_link_legacy_quote_document: \{/);
  for (const field of ["current_document_id", "current_pdf_state", "accepted_document_id", "accepted_pdf_state", "pdf_bucket", "pdf_sha256"]) assert.match(types, new RegExp(`${field}:`));
});

test("0054 is additive and the unique next migration without automatic legacy mutation", () => {
  assert.doesNotMatch(migration, /\b(delete from public\.documents|truncate table|drop table)\b/i);
  assert.doesNotMatch(migration, /update public\.documents[\s\S]{0,200}(title ilike|path ilike)/i);
  assert.doesNotMatch(migration, /where d\.title|where d\.path/i);

  const migrations = readdirSync("db/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.equal(migrations[migrations.indexOf("0054_quote_pdf_documents_and_uploads.sql") + 1], "0055_quote_transactional_rpc_contracts.sql");
  assert.equal(migrations.filter((name) => name.startsWith("0054_")).length, 1);
});
