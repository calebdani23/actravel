import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/0056_quote_operations_traceability.sql", "utf8");
const phaseTwoB = readFileSync("db/migrations/0055_quote_transactional_rpc_contracts.sql", "utf8");
const operationsActions = readFileSync("app/admin/(protected)/operations/actions.ts", "utf8");
const opportunityPage = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");
const cutover = readFileSync("db/migrations/0057_quote_rpc_cutover.sql", "utf8");
const creationCutover = readFileSync("db/migrations/0060_quote_pdf_creation_cutover.sql", "utf8");
const databaseTypes = readFileSync("lib/supabase/database.types.ts", "utf8");

function definition(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = migration.indexOf("$function$;", start);
  assert.ok(end > start, `${name} has no terminator`);
  return migration.slice(start, end + "$function$;".length);
}

test("0056 adds nullable indexed RESTRICT accepted quote version links without legacy backfill", () => {
  assert.match(migration, /alter table public\.bookings\s+add column if not exists accepted_quote_version_id uuid/i);
  assert.match(migration, /alter table public\.payments\s+add column if not exists accepted_quote_version_id uuid/i);
  assert.match(migration, /bookings_accepted_quote_version_id_fkey[\s\S]*references public\.quote_versions\(id\)[\s\S]*on delete restrict[\s\S]*not valid/i);
  assert.match(migration, /payments_accepted_quote_version_id_fkey[\s\S]*references public\.quote_versions\(id\)[\s\S]*on delete restrict[\s\S]*not valid/i);
  assert.match(migration, /validate constraint bookings_accepted_quote_version_id_fkey/i);
  assert.match(migration, /validate constraint payments_accepted_quote_version_id_fkey/i);
  assert.match(migration, /bookings_accepted_quote_version_idx[\s\S]*where accepted_quote_version_id is not null/i);
  assert.match(migration, /payments_accepted_quote_version_idx[\s\S]*where accepted_quote_version_id is not null/i);
  assert.doesNotMatch(migration, /update public\.(bookings|payments)[\s\S]*accepted_quote_version_id/i);
});

test("canonical operation scope requires the current accepted finalized PDF-ready version", () => {
  const scope = definition("crm_is_valid_accepted_quote_scope");
  assert.match(scope, /qv\.status = 'accepted'/i);
  assert.match(scope, /qv\.finalized_at is not null/i);
  assert.match(scope, /q\.accepted_version_id = qv\.id[\s\S]*q\.status = 'accepted'/i);
  assert.match(scope, /q\.contact_id = p_contact_id[\s\S]*q\.lead_id = p_lead_id/i);
  assert.match(scope, /qv\.contact_id = p_contact_id[\s\S]*qv\.lead_id = p_lead_id/i);
  assert.match(scope, /d\.storage_state = 'ready'[\s\S]*d\.status = 'active'[\s\S]*d\.mime_type = 'application\/pdf'/i);
  assert.match(scope, /q\.deleted_at is null[\s\S]*c\.deleted_at is null[\s\S]*l\.deleted_at is null/i);
  assert.match(scope, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.crm_is_valid_accepted_quote_scope\(uuid, uuid, uuid\)[\s\S]*authenticated/i);
});

test("booking, payment, and document guards enforce linked operational scope", () => {
  const booking = definition("crm_enforce_booking_quote_traceability");
  const payment = definition("crm_enforce_payment_quote_traceability");
  const document = definition("crm_enforce_document_booking_quote_scope");
  assert.match(booking, /crm_is_valid_accepted_quote_scope\([\s\S]*new\.contact_id[\s\S]*new\.lead_id/i);
  assert.match(booking, /attached payment scope[\s\S]*attached document scope/i);
  assert.match(payment, /new\.contact_id is distinct from booking_row\.contact_id[\s\S]*new\.lead_id is distinct from booking_row\.lead_id/i);
  assert.match(payment, /Payment and booking must reference the same accepted quote version/i);
  assert.match(payment, /crm_is_valid_accepted_quote_scope\(/i);
  assert.match(document, /booking_row\.accepted_quote_version_id is not null[\s\S]*new\.quote_version_id is not null[\s\S]*new\.contact_id is distinct from booking_row\.contact_id/i);
  for (const table of ["bookings", "payments", "documents"]) {
    assert.match(migration, new RegExp(`before insert or update on public\\.${table}`, "i"));
  }
});

test("operation guards preserve established historical links on unrelated edits", () => {
  const booking = definition("crm_enforce_booking_quote_traceability");
  const payment = definition("crm_enforce_payment_quote_traceability");
  assert.match(booking, /new\.accepted_quote_version_id is not distinct from old\.accepted_quote_version_id[\s\S]*new\.contact_id is not distinct from old\.contact_id[\s\S]*new\.lead_id is not distinct from old\.lead_id[\s\S]*return new/i);
  assert.match(payment, /new\.accepted_quote_version_id is not distinct from old\.accepted_quote_version_id[\s\S]*new\.booking_id is not distinct from old\.booking_id[\s\S]*return new/i);
});

test("acceptance never creates operations and linked accepted history cannot be silently superseded", () => {
  const accept = phaseTwoB.slice(
    phaseTwoB.indexOf("create or replace function public.crm_transition_quote"),
    phaseTwoB.indexOf("create or replace function public.crm_mark_quote_ready"),
  );
  assert.doesNotMatch(accept, /insert into public\.(bookings|payments)/i);
  assert.doesNotMatch(migration, /insert into public\.(bookings|payments)/i);
  const protection = definition("crm_protect_accepted_version_operation_links");
  assert.match(protection, /old\.status = 'accepted'[\s\S]*new\.status is distinct from 'accepted'/i);
  assert.match(protection, /public\.bookings[\s\S]*accepted_quote_version_id = old\.id[\s\S]*public\.payments/i);
  assert.match(protection, /cannot be superseded/i);
});

test("accepted quote handoff is read-only, normalized, role-aware, and PDF-gated", () => {
  const handoff = definition("crm_accepted_quote_handoff");
  assert.match(handoff, /stable\s+security definer\s+set search_path = ''/i);
  assert.match(handoff, /public\.crm_can_read_quote\(p_quote_id\)/i);
  assert.match(handoff, /q\.status = 'accepted'[\s\S]*qv\.status = 'accepted'[\s\S]*qv\.finalized_at is not null/i);
  assert.match(handoff, /d\.storage_state = 'ready'[\s\S]*d\.mime_type = 'application\/pdf'/i);
  assert.match(handoff, /public\.is_admin\(\) or public\.has_role\('operaciones'\)/i);
  assert.match(handoff, /public\.is_admin\(\) or public\.has_role\('finanzas'\)/i);
  assert.match(handoff, /linked_booking_count bigint[\s\S]*linked_payment_count bigint/i);
  assert.doesNotMatch(handoff, /\b(insert|update|delete)\s+(into\s+|from\s+)?public\.(bookings|payments)/i);
  assert.match(migration, /revoke all on function public\.crm_accepted_quote_handoff\(uuid\)\s+from public, anon, service_role/i);
  assert.match(migration, /grant execute on function public\.crm_accepted_quote_handoff\(uuid\)\s+to authenticated/i);
});

test("hard-delete and purge boundaries retain quote and linked operation history", () => {
  const hardDelete = definition("crm_protect_quote_traceability_delete");
  const purge = definition("crm_require_test_data_purge");
  assert.match(hardDelete, /tg_table_name in \('quotes', 'quote_versions'\)[\s\S]*cannot be hard-deleted/i);
  assert.match(hardDelete, /tg_table_name in \('bookings', 'payments'\)[\s\S]*to_jsonb\(old\) ->> 'accepted_quote_version_id' is not null/i);
  assert.match(hardDelete, /tg_table_name = 'documents'[\s\S]*b\.accepted_quote_version_id is not null[\s\S]*operation documents cannot be hard-deleted/i);
  for (const table of ["quotes", "quote_versions", "bookings", "payments", "documents"]) {
    assert.match(migration, new RegExp(`before delete on public\\.${table}`, "i"));
  }
  for (const dependency of ["public.quotes", "public.quote_versions", "public.quote_events", "public.quote_upload_intents"]) {
    assert.match(purge, new RegExp(dependency.replace(".", "\\.")));
  }
  assert.match(purge, /public\.bookings b[\s\S]*b\.accepted_quote_version_id/i);
  assert.match(purge, /public\.payments p[\s\S]*p\.accepted_quote_version_id/i);
  assert.match(purge, /Permanent purge requires a dependency-free test opportunity/);
});

test("current data-quality page covers PDF, scope, stale uploads, and registration recovery without mutation", () => {
  const start = creationCutover.indexOf("create or replace function public.crm_quote_data_quality_page");
  const quality = creationCutover.slice(start, creationCutover.indexOf("$function$;", start));
  for (const issue of ["missing_ready_pdf", "scope_mismatch", "stale_upload_intent", "registration_intent_expired", "registration_intent_failed", "registration_object_cleanup"]) {
    assert.match(quality, new RegExp(`'${issue}'`));
  }
  assert.match(quality, /qv\.status in \('sent', 'accepted'\)[\s\S]*qv\.finalized_at is null[\s\S]*d\.storage_state <> 'ready'/i);
  assert.match(quality, /Quote version contact or opportunity does not match/i);
  assert.match(quality, /Quote header current or accepted version pointer is missing or belongs to another quote/i);
  assert.match(quality, /Booking accepted quote linkage is no longer canonical/i);
  assert.match(quality, /Payment accepted quote linkage is no longer canonical/i);
  assert.match(quality, /qui\.status = 'pending' and qui\.expires_at <= now\(\)/i);
  assert.match(quality, /qri\.status = 'pending' and qri\.expires_at <= now\(\)/i);
  assert.match(quality, /qri\.status = 'failed'/i);
  assert.match(quality, /join storage\.objects so on so\.bucket_id = qri\.bucket and so\.name = qri\.path/i);
  assert.doesNotMatch(quality, /legacy_pdf_candidate|update public|delete from|insert into|ilike/i);
});

test("data-quality page is admin-only, bounded, filtered, and cursor-paginated", () => {
  const start = creationCutover.indexOf("create or replace function public.crm_quote_data_quality_page");
  const quality = creationCutover.slice(start, creationCutover.indexOf("$function$;", start));
  assert.match(quality, /auth\.uid\(\) is null or not public\.is_admin\(\)/i);
  assert.match(quality, /p_limit is null or p_limit < 1 or p_limit > 200/i);
  assert.match(quality, /p_after_issue_key is null or issues\.issue_key > p_after_issue_key/i);
  assert.match(quality, /limit p_limit \+ 1/i);
  assert.match(quality, /select count\(\*\) > p_limit as has_more/i);
  assert.match(creationCutover, /revoke all on function public\.crm_quote_data_quality_page\(integer, text, text\)[\s\S]*from public, anon, authenticated, service_role/i);
});

test("0056 does not broaden operation RLS or add mutation RPCs", () => {
  assert.doesNotMatch(migration, /create policy|drop policy|grant (insert|update|delete|all) on (table )?public\.(bookings|payments)/i);
  assert.doesNotMatch(migration, /create or replace function public\.crm_(create|update|link)_(booking|payment)/i);
  assert.match(operationsActions, /requireAdminRole\(\["admin", "finanzas"\]\)/i);
  assert.match(operationsActions, /requireAdminRole\(\["admin", "operaciones"\]\)/i);
});

test("database types expose operation links, relationships, handoff, and quality rows", () => {
  assert.match(databaseTypes, /bookings: \{[\s\S]*accepted_quote_version_id: string \| null/i);
  assert.match(databaseTypes, /payments: \{[\s\S]*accepted_quote_version_id: string \| null/i);
  assert.match(databaseTypes, /bookings_accepted_quote_version_id_fkey/);
  assert.match(databaseTypes, /payments_accepted_quote_version_id_fkey/);
  assert.match(databaseTypes, /crm_accepted_quote_handoff: \{[\s\S]*can_manage_booking: boolean[\s\S]*linked_payment_count: number/i);
  assert.match(databaseTypes, /crm_quote_data_quality_page: \{[\s\S]*issue_key: string[\s\S]*page_has_more: boolean/i);
});

test("0057 cuts over after embedded direct quote writers leave the rendered opportunity page", () => {
  assert.doesNotMatch(opportunityPage, /quote-version-actions|QuoteVersionCreateDialog|QuoteVersionActionForm/i);
  assert.match(migration, /No 0057 cutover is included[\s\S]*embedded opportunity actions[\s\S]*write quote_versions directly/i);
  assert.match(cutover, /drop policy if exists "quote versions insert scoped"/i);
  assert.match(cutover, /revoke insert, update, delete, truncate, references, trigger[\s\S]*quote_versions[\s\S]*from authenticated/i);
  assert.match(cutover, /grant select on table public\.quote_versions to authenticated/i);
  assert.match(cutover, /from public\.crm_accept_quote\(/i);
  const migrations = readdirSync("db/migrations").filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.equal(migrations[migrations.indexOf("0057_quote_rpc_cutover.sql") + 1], "0058_fix_legacy_quote_document_link_ambiguity.sql");
  assert.equal(migrations.filter((name) => name.startsWith("0057_")).length, 1);
});
