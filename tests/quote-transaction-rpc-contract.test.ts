import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { mapQuoteDetail, requireSingleQuoteMutationResult } from "@/lib/admin/quotes";
import {
  acceptQuoteSchema,
  addQuoteVersionSchema,
  beginQuotePdfUploadSchema,
  beginQuoteRegistrationSchema,
  createQuoteIdempotencyKey,
  quoteDeleteConfirmation,
  quotePdfMaxSizeBytes,
  quoteRestoreConfirmation,
  restoreQuoteSchema,
  softDeleteQuoteSchema,
} from "@/lib/admin/quote-validation";

const migration = readFileSync("db/migrations/0055_quote_transactional_rpc_contracts.sql", "utf8");
const databaseTypes = readFileSync("lib/supabase/database.types.ts", "utf8");
const cutover = readFileSync("db/migrations/0060_quote_pdf_creation_cutover.sql", "utf8");

function definition(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = migration.indexOf("$function$;", start);
  assert.ok(end > start, `${name} has no function terminator`);
  return migration.slice(start, end + "$function$;".length);
}

const ids = {
  contact: "11111111-1111-4111-8111-111111111111",
  lead: "22222222-2222-4222-8222-222222222222",
  quote: "33333333-3333-4333-8333-333333333333",
  version: "44444444-4444-4444-8444-444444444444",
  otherQuote: "55555555-5555-4555-8555-555555555555",
  intent: "66666666-6666-4666-8666-666666666666",
};

test("0055 exposes mutations to authenticated callers except trusted PDF finalization", () => {
  const signatures = [
    ["crm_create_quote", "uuid, text, text, text, numeric, numeric, date, text, uuid, text"],
    ["crm_add_quote_version", "uuid, integer, text, text, text, numeric, numeric, date, text, uuid, uuid, text"],
    ["crm_begin_quote_pdf_upload", "uuid, uuid, bigint, text"],
    ["crm_fail_quote_pdf_upload", "uuid, text, text, text"],
    ["crm_mark_quote_ready", "uuid, uuid, integer, text"],
    ["crm_mark_quote_sent", "uuid, uuid, integer, text"],
    ["crm_accept_quote", "uuid, uuid, integer, uuid, text, text"],
    ["crm_reject_quote", "uuid, uuid, integer, text"],
    ["crm_expire_quote", "uuid, uuid, integer, text"],
    ["crm_cancel_quote", "uuid, uuid, integer, text"],
    ["crm_soft_delete_quote", "uuid, integer, text, text, text"],
    ["crm_restore_quote", "uuid, integer, text, text"],
  ] as const;

  for (const [name, signature] of signatures) {
    assert.match(definition(name), /language plpgsql\s+security definer\s+set search_path = ''/i);
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(${signature.replaceAll(" ", "\\s*")}\\)\\s+from public, anon, service_role`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(${signature.replaceAll(" ", "\\s*")}\\)\\s+to authenticated`, "i"));
  }
  assert.match(migration, /revoke all on function public\.crm_finalize_quote_pdf_upload\(uuid, text, text\)\s+from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.crm_finalize_quote_pdf_upload\(uuid, text, text\)\s+to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.crm_finalize_quote_pdf_upload\(uuid, text, text\)\s+to authenticated/i);
});

test("mutation engine locks contact, opportunity, quotes, versions, documents, and intents in deterministic order", () => {
  for (const name of ["crm_transition_quote", "crm_finalize_quote_pdf_upload", "crm_soft_delete_quote"]) {
    const rpc = definition(name);
    const lockPositions = [
      rpc.indexOf("perform 1 from public.contacts c"),
      rpc.indexOf("perform 1 from public.leads l"),
      rpc.indexOf("perform 1 from public.quotes q where q.lead_id"),
      rpc.indexOf("perform 1 from public.quote_versions qv where qv.lead_id"),
      rpc.indexOf("perform 1\n  from public.documents d"),
      rpc.indexOf("perform 1 from public.quote_upload_intents qui"),
    ];
    assert.ok(lockPositions.every((position) => position >= 0), `${name} is missing a lock stage`);
    assert.deepEqual([...lockPositions].sort((a, b) => a - b), lockPositions);
    assert.match(rpc, /order by q\.id for update/i);
    assert.match(rpc, /order by qv\.quote_id, qv\.version_number, qv\.id for update/i);
  }
});

test("create quote derives scope and atomically creates header, V1, provenance, and paired audit", () => {
  const rpc = definition("crm_create_quote");
  assert.match(rpc, /join public\.contacts c on c\.id = l\.contact_id/i);
  assert.match(rpc, /scope_row\.assigned_to = actor_id/i);
  assert.match(rpc, /insert into public\.quotes[\s\S]*next_version_number, idempotency_key[\s\S]*scope_row\.assigned_to, actor_id, 2, p_idempotency_key/i);
  assert.match(rpc, /insert into public\.quote_versions[\s\S]*p_idempotency_key, 1[\s\S]*'draft'/i);
  assert.match(rpc, /insert into public\.quote_request_quote_links[\s\S]*'originating'/i);
  assert.match(rpc, /'quote_created'[\s\S]*'create:' \|\| p_idempotency_key/i);
  assert.doesNotMatch(rpc, /insert into public\.documents/i);
});

test("every mutation rejects non-admin unassigned callers and requires live contact/opportunity scope", () => {
  for (const name of [
    "crm_create_quote",
    "crm_add_quote_version",
    "crm_begin_quote_pdf_upload",
    "crm_fail_quote_pdf_upload",
    "crm_transition_quote",
    "crm_soft_delete_quote",
    "crm_restore_quote",
  ]) {
    const rpc = definition(name);
    assert.match(rpc, /public\.is_admin\(\)/i);
    assert.match(rpc, /public\.has_role\('asesor'\)[\s\S]*assigned_to/i);
    assert.match(rpc, /(lead_deleted_at|lead_row\.deleted_at) is not null/i);
    assert.match(rpc, /(contact_deleted_at|lead_row\.contact_deleted_at) is not null/i);
    assert.doesNotMatch(rpc, /has_role\('(operaciones|finanzas|marketing)'\)|actor_role\s*=\s*'service_role'/i);
  }
});

test("version creation allocates under lock, supports exclusive clone mode, and preserves accepted pointers", () => {
  const rpc = definition("crm_add_quote_version");
  assert.match(rpc, /if existing_version\.id is not null then[\s\S]*quote_row\.lock_version, true/i);
  assert.match(rpc, /scope_row\.lock_version <> p_expected_lock_version/i);
  assert.match(rpc, /Clone mode cannot include explicit commercial content/);
  assert.match(rpc, /greatest\(scope_row\.next_version_number, coalesce\(max\(qv\.version_number\) \+ 1, 1\)\)/i);
  assert.match(rpc, /set next_version_number = allocated_version \+ 1,[\s\S]*lock_version = q\.lock_version \+ 1/i);
  assert.match(rpc, /previous_current\.id is distinct from scope_row\.accepted_version_id[\s\S]*previous_current\.status in \('draft', 'ready'\)/i);
  assert.doesNotMatch(rpc, /accepted_version_id\s*=/i);
});

test("upload begin binds exact size and reopens only durable failed intents", () => {
  const rpc = definition("crm_begin_quote_pdf_upload");
  assert.match(migration, /add column if not exists expected_size_bytes bigint/i);
  assert.match(rpc, /p_expected_size_bytes < 1 or p_expected_size_bytes > 20971520/i);
  assert.match(rpc, /version_row\.status <> 'draft' or version_row\.finalized_at is not null/i);
  assert.match(rpc, /intent_row\.status = 'pending'[\s\S]*intent_row\.idempotency_key = p_idempotency_key/i);
  assert.match(rpc, /intent_row\.status = 'pending' and intent_row\.expires_at <= now\(\)[\s\S]*status = 'failed'/i);
  assert.match(rpc, /set actor_id = upload_actor_id,[\s\S]*status = 'pending'[\s\S]*attempt_count = qui\.attempt_count \+ 1/i);
  assert.match(rpc, /contacts\/%s\/opportunities\/%s\/quotes\/%s\/versions\/%s\/%s\.pdf/i);
});

test("upload finalization validates locked Storage metadata before making document, version, and quote ready", () => {
  const rpc = definition("crm_finalize_quote_pdf_upload");
  assert.match(rpc, /auth\.role\(\) is distinct from 'service_role'/i);
  assert.match(rpc, /actor_id := intent_row\.actor_id/i);
  assert.match(rpc, /profile_roles[\s\S]*p\.is_active[\s\S]*r\.name = 'admin'[\s\S]*r\.name = 'asesor'[\s\S]*scope_row\.assigned_to = actor_id/i);
  assert.match(rpc, /version_row\.quote_id is distinct from intent_row\.quote_id[\s\S]*document_row\.quote_version_id is distinct from intent_row\.quote_version_id/i);
  assert.match(rpc, /from storage\.objects so[\s\S]*for update/i);
  assert.match(rpc, /metadata ->> 'size'[\s\S]*metadata ->> 'contentLength'/i);
  assert.match(rpc, /metadata ->> 'mimetype'[\s\S]*metadata ->> 'contentType'/i);
  assert.match(rpc, /object_size <> intent_row\.expected_size_bytes/i);
  assert.match(rpc, /lower\(storage\.extension\(object_row\.name\)\) <> 'pdf'/i);
  assert.match(rpc, /p_sha256 !~ '\^\[0-9a-f\]\{64\}\$'/i);
  const documentUpdate = rpc.indexOf("update public.documents");
  const versionUpdate = rpc.indexOf("update public.quote_versions");
  const intentFinalization = rpc.indexOf("set status = 'finalized'");
  assert.ok(documentUpdate < versionUpdate && versionUpdate < intentFinalization);
  assert.match(rpc, /intent_row\.status = 'finalized'[\s\S]*document_row\.sha256 <> p_sha256[\s\S]*true/i);
});

test("upload failure is retry-safe and never deletes finalized artifacts", () => {
  const rpc = definition("crm_fail_quote_pdf_upload");
  assert.match(rpc, /intent_row\.status = 'finalized' or document_row\.storage_state = 'ready'[\s\S]*true/i);
  assert.match(rpc, /idempotency_key = 'upload-fail:' \|\| p_idempotency_key/i);
  assert.match(rpc, /update public\.documents set storage_state = 'failed'/i);
  assert.match(rpc, /last_error_code = trim\(p_error_code\)[\s\S]*last_error_message = trim\(p_error_message\)/i);
  assert.doesNotMatch(rpc, /delete from|storage\.objects/i);
});

test("workflow transitions enforce lock versions, finalized PDFs, terminal immutability, and independent pointers", () => {
  const rpc = definition("crm_transition_quote");
  assert.match(rpc, /scope_row\.lock_version <> p_expected_lock_version/i);
  assert.match(rpc, /Ready quote versions require a finalized ready PDF/);
  assert.match(rpc, /target_version\.finalized_at is null[\s\S]*target_document\.storage_state <> 'ready'/i);
  assert.match(rpc, /target_version\.status not in \('ready', 'sent'\)[\s\S]*Only a ready or sent quote version can be accepted/i);
  assert.match(rpc, /target_version\.status not in \('ready', 'sent'\)[\s\S]*Only a ready or sent quote version can expire/i);
  assert.match(rpc, /p_action <> 'accept' and scope_row\.current_version_id is distinct from target_version\.id/i);
  assert.match(rpc, /same_quote_accepted_version[\s\S]*set status = 'superseded'/i);
  assert.doesNotMatch(rpc, /set current_version_id|set accepted_version_id = target_version/i);
});

test("cross-quote acceptance requires explicit expected supersession and records both histories", () => {
  const rpc = definition("crm_transition_quote");
  assert.match(rpc, /p_expected_accepted_quote_id is distinct from other_accepted_quote\.id[\s\S]*nullif\(trim\(p_supersede_reason\), ''\) is null/i);
  assert.match(rpc, /Expected accepted quote changed/);
  assert.match(rpc, /update public\.quote_versions set status = 'superseded'[\s\S]*other_accepted_version\.id/i);
  assert.match(rpc, /update public\.quotes[\s\S]*status = 'cancelled', accepted_version_id = null/i);
  assert.match(rpc, /'quote_superseded'[\s\S]*'supersededByQuoteId'[\s\S]*'supersedeReason'/i);
  assert.match(rpc, /other_accepted_quote\.id, false/i);
});

test("audit helper atomically mirrors compact events and suppresses duplicate lead events", () => {
  const rpc = definition("crm_record_quote_mutation");
  for (const key of ["quoteId", "versionId", "number", "version", "previousStatus", "nextStatus", "actorId"]) {
    assert.match(rpc, new RegExp(`'${key}'`));
  }
  assert.match(rpc, /insert into public\.quote_events[\s\S]*on conflict \(quote_id, idempotency_key\)[\s\S]*returning id into event_id/i);
  assert.match(rpc, /if event_id is not null then[\s\S]*insert into public\.lead_events/i);
  assert.doesNotMatch(rpc, /exception when|best.effort/i);
});

test("soft delete and restore require typed confirmation while preserving all history", () => {
  const remove = definition("crm_soft_delete_quote");
  const restore = definition("crm_restore_quote");
  assert.match(remove, /p_confirmation is distinct from 'ELIMINAR COTIZACION'/i);
  assert.match(remove, /set deleted_at = now\(\), deleted_by = actor_id, deleted_reason = trim\(p_reason\)/i);
  assert.match(restore, /p_confirmation is distinct from 'RESTAURAR COTIZACION'/i);
  assert.match(restore, /set deleted_at = null, deleted_by = null, deleted_reason = null/i);
  assert.match(restore, /Another accepted quote already exists for this opportunity/);
  assert.doesNotMatch(`${remove}\n${restore}`, /delete from|truncate|set status = 'expired'/i);
  assert.doesNotMatch(migration, /create or replace function public\.crm_(hard_)?delete_quote/i);
});

test("0055 legacy acceptance could not silently replace another accepted quote and 0060 removes it", () => {
  const rpc = definition("crm_accept_quote_version");
  assert.match(rpc, /p_lead_id uuid,[\s\S]*p_quote_version_id uuid/i);
  assert.match(rpc, /target_version\.status not in \('draft', 'ready', 'sent', 'accepted'\)/i);
  assert.match(rpc, /Use crm_accept_quote with explicit supersession to replace another accepted quote/);
  assert.match(rpc, /status in \('draft', 'ready', 'sent', 'accepted'\)/i);
  assert.doesNotMatch(rpc, /finalized ready PDF|target_document/i);
  assert.match(migration, /revoke all on function public\.crm_accept_quote_version\(uuid, uuid\)\s+from public, anon, service_role/i);
  assert.match(migration, /grant execute on function public\.crm_accept_quote_version\(uuid, uuid\)\s+to authenticated/i);
  assert.match(migration, /Migration 0057[\s\S]*direct INSERT\/UPDATE grants and policies on quote_versions/i);
  assert.match(cutover, /drop function public\.crm_accept_quote_version\(uuid, uuid\)/i);
});

test("database types expose expected upload size and every typed RPC result", () => {
  assert.match(databaseTypes, /quote_upload_intents: \{[\s\S]*expected_size_bytes: number \| null/i);
  for (const name of [
    "crm_add_quote_version",
    "crm_begin_quote_pdf_upload",
    "crm_finalize_quote_pdf_upload",
    "crm_fail_quote_pdf_upload",
    "crm_mark_quote_ready",
    "crm_mark_quote_sent",
    "crm_accept_quote",
    "crm_reject_quote",
    "crm_expire_quote",
    "crm_cancel_quote",
    "crm_soft_delete_quote",
    "crm_restore_quote",
  ]) assert.match(databaseTypes, new RegExp(`${name}: \\{`));
  assert.doesNotMatch(databaseTypes, /crm_create_quote:|crm_accept_quote_version:|crm_link_legacy_quote_document:/);
  assert.match(databaseTypes, /crm_accept_quote: \{[\s\S]*p_expected_accepted_quote_id: string \| null[\s\S]*superseded_quote_id: string \| null/i);
});

test("quote validation helpers enforce forms, money, dates, locks, PDF size, and typed confirmations", () => {
  const createInput = {
    opportunityId: ids.lead,
    title: "Viaje familiar",
    currency: "MXN",
    totalAmount: "1000",
    depositAmount: "250",
    validUntil: "2026-12-31",
    expectedSizeBytes: 1024,
    advisorySha256: "a".repeat(64),
    idempotencyKey: "create_123",
  };
  const validCreate = beginQuoteRegistrationSchema.safeParse(createInput);
  assert.equal(validCreate.success, true);
  assert.equal(beginQuoteRegistrationSchema.safeParse({ ...createInput, depositAmount: 2000 }).success, false);
  assert.equal(beginQuoteRegistrationSchema.safeParse({ ...createInput, validUntil: "2026-02-30" }).success, false);
  assert.equal(addQuoteVersionSchema.safeParse({
    quoteId: ids.quote,
    expectedLockVersion: 2,
    cloneVersionId: ids.version,
    title: "Not allowed with clone",
    idempotencyKey: "clone_123",
  }).success, false);
  assert.equal(beginQuotePdfUploadSchema.safeParse({
    quoteId: ids.quote,
    quoteVersionId: ids.version,
    expectedSizeBytes: quotePdfMaxSizeBytes + 1,
    idempotencyKey: "upload_123",
  }).success, false);
  assert.equal(acceptQuoteSchema.safeParse({
    quoteId: ids.quote,
    quoteVersionId: ids.version,
    expectedLockVersion: 4,
    expectedAcceptedQuoteId: ids.otherQuote,
    idempotencyKey: "accept_123",
  }).success, false);
  assert.equal(softDeleteQuoteSchema.safeParse({
    quoteId: ids.quote,
    expectedLockVersion: 4,
    confirmation: quoteDeleteConfirmation,
    reason: "Duplicated commercial draft",
    idempotencyKey: "delete_123",
  }).success, true);
  assert.equal(restoreQuoteSchema.safeParse({
    quoteId: ids.quote,
    expectedLockVersion: 5,
    confirmation: quoteRestoreConfirmation,
    idempotencyKey: "restore_123",
  }).success, true);
  assert.match(createQuoteIdempotencyKey("quote create"), /^quote_create_[A-Za-z0-9]+$/);
});

test("quote DTO mapping keeps current and accepted versions independent", () => {
  const dto = mapQuoteDetail({
    quote_id: ids.quote,
    quote_number: "COT-2026-000001",
    title: "Current draft",
    status: "accepted",
    lock_version: 8,
    contact_id: ids.contact,
    contact_name: "Ada Lovelace",
    contact_email: "ada@example.com",
    contact_phone: null,
    opportunity_id: ids.lead,
    opportunity_label: "Europe",
    owner_id: null,
    advisor_name: null,
    current_version_id: ids.version,
    current_version_number: 3,
    current_version_title: "Revision 3",
    current_version_status: "draft",
    current_currency: "MXN",
    current_total_amount: 1000,
    current_deposit_amount: 200,
    current_valid_until: null,
    current_document_id: null,
    current_pdf_state: null,
    current_pdf_bucket: null,
    current_pdf_path: null,
    current_pdf_mime_type: null,
    current_pdf_byte_size: null,
    current_pdf_sha256: null,
    current_pdf_uploaded_at: null,
    accepted_version_id: ids.otherQuote,
    accepted_version_number: 2,
    accepted_version_title: "Accepted revision",
    accepted_version_status: "accepted",
    accepted_currency: "MXN",
    accepted_total_amount: 900,
    accepted_deposit_amount: 200,
    accepted_valid_until: null,
    accepted_document_id: ids.intent,
    accepted_pdf_state: "ready",
    accepted_pdf_bucket: "quote-pdfs",
    accepted_pdf_path: "uuid-only.pdf",
    accepted_pdf_mime_type: "application/pdf",
    accepted_pdf_byte_size: 1200,
    accepted_pdf_sha256: "a".repeat(64),
    accepted_pdf_uploaded_at: "2026-07-30T00:00:00.000Z",
    deleted_at: null,
  } as never);
  assert.equal(dto.currentVersion?.status, "draft");
  assert.equal(dto.currentVersion?.document, null);
  assert.equal(dto.acceptedVersion?.status, "accepted");
  assert.equal(dto.acceptedVersion?.document?.state, "ready");
  assert.equal(requireSingleQuoteMutationResult([{ quoteId: ids.quote }], "create").quoteId, ids.quote);
  assert.throws(() => requireSingleQuoteMutationResult([], "create"), /create_result_invalid/);
});

test("0055 precedes traceability migration and preserves reviewed 0053 bytes", () => {
  const migrations = readdirSync("db/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.equal(migrations[migrations.indexOf("0055_quote_transactional_rpc_contracts.sql") + 1], "0056_quote_operations_traceability.sql");
  assert.equal(migrations.filter((name) => name.startsWith("0055_")).length, 1);
  assert.equal(createHash("sha256").update(readFileSync("db/migrations/0053_quotes_header_foundation.sql")).digest("hex"), "59d9006f76ae1952281d96f24cc2d9a59cb3cb9b0f7f058f524a94494612660f");
  assert.equal(createHash("sha256").update(readFileSync("db/migrations/0054_quote_pdf_documents_and_uploads.sql")).digest("hex"), "485771fdae6c50639461d0019cff393fac8613ca02f8b31c711dbc3a8a75e6fd");
  assert.match(readFileSync("db/migrations/0053_quotes_header_foundation.sql", "utf8"), /new\.content_sha256 := encode\(\s*extensions\.digest\(/i);
  assert.doesNotMatch(migration, /\b(delete from public\.(quotes|quote_versions|documents|quote_events)|truncate table|drop table)\b/i);
});
