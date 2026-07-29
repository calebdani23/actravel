import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = (name: string) => readFileSync(`db/migrations/${name}`, "utf8");

test("CRM governance fields and advisor visibility are additive and scoped", () => {
  const source = migration("0042_crm_governance_fields_and_advisor_rls.sql");
  assert.match(source, /lifecycle_status[\s\S]*active[\s\S]*follow_up[\s\S]*customer[\s\S]*inactive[\s\S]*blocked[\s\S]*deleted/);
  for (const field of ["blocked_at", "blocked_by", "blocked_reason", "deleted_at", "deleted_by", "deleted_reason"]) assert.match(source, new RegExp(field));
  assert.match(source, /assigned_to = auth\.uid\(\)/);
  assert.match(source, /l\.deleted_at is null/);
  assert.match(source, /crm_guard_governance_fields/);
});

test("bulk CRM RPCs are admin-audited, fixed-search-path, typed-confirmed, and non-destructive", () => {
  const schema = migration("0043_crm_bulk_mutation_jobs.sql");
  const rpcs = migration("0044_crm_bulk_mutation_rpcs.sql");
  assert.match(schema, /entity_id uuid not null/);
  assert.match(schema, /admin read/);
  for (const name of ["crm_bulk_block_contacts", "crm_bulk_unblock_contacts", "crm_bulk_update_contact_lifecycle", "crm_bulk_delete_restore_contacts", "crm_bulk_feature_opportunities", "crm_bulk_update_opportunity_status", "crm_bulk_delete_restore_opportunities"]) assert.match(rpcs, new RegExp(`create or replace function public\\.${name}`));
  assert.match(rpcs, /security definer set search_path = public/);
  assert.match(rpcs, /revoke all on function public\.%s from public, anon/);
  assert.match(rpcs, /Typed confirmation required/);
  assert.doesNotMatch(rpcs, /delete\s+from\s+public\.(contacts|leads)/i);
  assert.match(rpcs, /for update/);
  assert.match(rpcs, /crm_bulk_mutation_items/);
});

test("resolver excludes tombstones and records blocked-contact review", () => {
  const source = migration("0045_crm_resolver_soft_delete_review.sql");
  assert.match(source, /c\.deleted_at is null/);
  assert.match(source, /l\.deleted_at is null/);
  assert.match(source, /blocked_contact/);
  const intake = readFileSync("lib/leads/lead-intake-core.ts", "utf8");
  assert.match(intake, /blocked_contact_review_required/);
  assert.match(intake, /filter\(\(candidate\) => !candidate\.deleted_at\)/);
});
