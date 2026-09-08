import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const path = "db/migrations/0065_follow_up_task_approval_ledger.sql"
const sql = () => readFileSync(path, "utf8")
const rpc = () => sql().slice(sql().indexOf("create or replace function public.approve"), sql().indexOf("alter function public.follow_up_canonical_json"))

test("0065 declares the closed one-row schema and repeated equations", () => {
  assert.equal(existsSync(path), true)
  const source = sql()
  const columns = [
    "id uuid not null default gen_random_uuid() primary key", "request_id uuid not null unique", "actor_id uuid not null",
    "actor_role text not null check (actor_role = 'admin')", "schema_version text not null check (schema_version = 'follow-up-approval.v1')",
    "rule_version text not null check (rule_version = 'follow-up-backfill.v1')", "event_cutoff_created_at timestamptz not null",
    "event_cutoff_id uuid not null", "task_cutoff_created_at timestamptz", "task_cutoff_id uuid", "reader_snapshot_hash text not null",
    "canonical_plan_hash text not null", "request_fingerprint text not null", "projection_hash text not null", "canonical_plan text not null",
    "eligible_projections jsonb not null", "eligible_count integer not null", "invalid_date_no_task_count integer not null",
    "manual_review_unassigned_owner_count integer not null", "excluded_lead_not_operational_count integer not null",
    "excluded_non_selected_history_count integer not null", "already_converted_count integer not null", "collision_manual_review_count integer not null",
    "total_count integer not null", "row_count integer not null", "projection_count integer not null", "canonical_plan_byte_count integer not null",
    "projection_byte_count integer not null", "request_byte_count integer not null", "created_at timestamptz not null default now()",
  ]
  let previous = source.indexOf("create table")
  for (const column of columns) {
    const found = source.indexOf(column, previous)
    assert.ok(found > previous, `column order: ${column}`)
    previous = found
  }
  assert.match(source, /\(task_cutoff_created_at is null\)\s*=\s*\(task_cutoff_id is null\)/i)
  assert.match(source, /total_count = row_count[\s\S]*total_count = eligible_count \+ invalid_date_no_task_count[\s\S]*collision_manual_review_count/i)
  assert.match(source, /projection_count = eligible_count/i)
  assert.match(source, /canonical_plan_byte_count = octet_length\(convert_to\(canonical_plan, 'UTF8'\)\)/i)
  assert.match(source, /projection_byte_count = octet_length\(convert_to\(follow_up_canonical_json\(eligible_projections\), 'UTF8'\)\)/i)
  assert.match(source, /canonical_plan_byte_count <= 1048576[\s\S]*projection_byte_count <= 4194304[\s\S]*request_byte_count <= 5242880/i)
})

test("RPC has exact precedence and canonical cutoff/plan validation", () => {
  const source = rpc()
  const required = source.indexOf("p_expected_actor_id is null")
  const mismatch = source.indexOf("auth.uid() <> p_expected_actor_id")
  const cutoff = source.indexOf("v_event_cutoff :=")
  assert.ok(required > 0 && mismatch > required)
  assert.ok(cutoff > mismatch)
  assert.match(source, /p_expected_actor_id is null or p_event_cutoff_created_at is null or p_event_cutoff_id is null[\s\S]*v_code := 'INVALID_REQUEST'[\s\S]*auth\.uid\(\) <> p_expected_actor_id[\s\S]*AUTH_ACTOR_MISMATCH/i)
  assert.match(source, /AUTH_ACTOR_MISMATCH[\s\S]*if p_request_id_text is null or p_schema_version is null[\s\S]*v_code := 'INVALID_REQUEST'/i)
  assert.match(source, /to_char\(v_event_cutoff at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\) <> p_event_cutoff_created_at/i)
  assert.match(source, /p_event_cutoff_id::text <> lower\(p_event_cutoff_id::text\)/i)
  assert.match(source, /v_expected_header := pg_catalog\.jsonb_build_array\(p_rule_version[\s\S]*v_plan->0, v_plan->1, v_plan->2/i)
  assert.match(source, /jsonb_array_length\(v_plan->4\) <> 7/i)
  assert.match(source, /jsonb_array_length\(row\) <> 9/i)
  assert.match(source, /jsonb_typeof\(row\) <> 'array'[\s\S]*row->>0 is null[\s\S]*row->>7 is null[\s\S]*row->>8 is null/i)
  assert.match(source, /octet_length\(convert_to\(public\.follow_up_canonical_json\(row\), 'UTF8'\)\) > 512/i)
  assert.match(source, /UNASSIGNED_OWNER'[\s\S]*PROFILE_MISSING'[\s\S]*ROLE_INVALID/i)
  assert.match(source, /v_total <> v_row_count[\s\S]*sum\(\(v_counts->i\)::integer\)/i)
  assert.match(source, /v_expected_header := pg_catalog\.jsonb_build_array\(p_rule_version, p_event_cutoff_created_at, p_event_cutoff_id::text, '\[\]'::jsonb,[\s\S]*jsonb_build_array\(v_counts->0, v_counts->1, v_counts->2, v_counts->3, v_counts->4, v_counts->5, v_counts->6\), 0, 0, 0, 0, false\)/i)
  assert.match(source, /jsonb_build_array\(v_plan->0, v_plan->1, v_plan->2, '\[\]'::jsonb, v_plan->4, 0, 0, 0, 0, false\) <> v_expected_header/i)
  assert.doesNotMatch(source, /v_plan->[6789]\s*<>\s*(?:0|false)/i)
  assert.match(source, /row->>5 is null[\s\S]*row->>5 is not null/i)
  assert.doesNotMatch(source, /row->5\s+is\s+(?:not\s+)?null/i)
})

test("RPC derives the exact ordered 14-field projection and all limits", () => {
  const source = rpc()
  const projectionFields = ["owner_id", "lead_id", "quote_id", "description", "due_at", "status", "idempotency_key", "task_kind", "source_event_id", "source_event_type", "source_event_created_at", "source_due_at", "source_payload", "metadata"]
  let projectionPrevious = source.indexOf("jsonb_build_object(")
  for (const field of projectionFields) {
    assert.match(source, new RegExp(`'${field}'`))
    const next = source.indexOf(`'${field}'`, projectionPrevious)
    assert.ok(next > projectionPrevious, `projection order: ${field}`)
    projectionPrevious = next
  }
  assert.match(source, /jsonb_agg\(jsonb_build_object\([\s\S]*order by ord\)/i)
  assert.match(source, /(?:public\.)?follow_up_canonical_json\(p_eligible_projections\) <> (?:public\.)?follow_up_canonical_json\(v_expected_projection\)/i)
  const countDispositions = ["eligible", "invalid-date/no-task", "manual-review/unassigned-owner", "excluded/lead-not-operational", "excluded/non-selected-history", "already-converted", "collision/manual-review"]
  countDispositions.forEach((disposition, index) => {
    assert.match(source, new RegExp(`\\(v_counts->${index}\\)::integer \\<>[\\s\\S]*where r->>7 = '${disposition}'`), `count equation: ${disposition}`)
  })
  assert.match(source, /v_row_count > 2000[\s\S]*LIMIT_EXCEEDED/i)
  assert.match(source, /octet_length\(convert_to\(public\.follow_up_canonical_json\(row\), 'UTF8'\)\) > 512[\s\S]*v_row_limit := true/i)
  assert.match(source, /octet_length\(convert_to\(public\.follow_up_canonical_json\(v_expected_header\), 'UTF8'\)\) > 4096[\s\S]*LIMIT_EXCEEDED/i)
  assert.match(source, /octet_length\(convert_to\(p_canonical_plan, 'UTF8'\)\) > 1048576[\s\S]*LIMIT_EXCEEDED/i)
  assert.match(source, /octet_length\(convert_to\(v_projection, 'UTF8'\)\) > 4194304[\s\S]*LIMIT_EXCEEDED/i)
  assert.match(source, /octet_length\(convert_to\(v_request, 'UTF8'\)\) > 5242880[\s\S]*LIMIT_EXCEEDED/i)
  assert.match(source, /> 2048/i)
  assert.match(source, /v_projection_item_limit := true/i)
})

test("replay is exact and immutability covers every mutation", () => {
  const source = sql()
  assert.match(source, /before update on public\.follow_up_task_approvals[\s\S]*prevent_follow_up_task_approval_update/i)
  assert.match(source, /before delete on public\.follow_up_task_approvals[\s\S]*prevent_follow_up_task_approval_delete/i)
  assert.match(source, /raise exception using errcode = 'P0001', message = 'FOLLOW_UP_APPROVAL_IMMUTABLE'/i)
  const body = rpc()
  for (const field of ["actor_id", "schema_version", "rule_version", "event_cutoff_created_at", "event_cutoff_id", "task_cutoff_created_at", "task_cutoff_id", "reader_snapshot_hash", "canonical_plan_hash", "request_fingerprint", "projection_hash", "canonical_plan", "eligible_projections", "eligible_count", "invalid_date_no_task_count", "manual_review_unassigned_owner_count", "excluded_lead_not_operational_count", "excluded_non_selected_history_count", "already_converted_count", "collision_manual_review_count", "total_count", "row_count", "projection_count", "canonical_plan_byte_count", "projection_byte_count", "request_byte_count"]) {
    assert.match(body, new RegExp(`v_existing\\.${field}`), `replay field: ${field}`)
  }
  assert.match(body, /from public\.follow_up_task_approvals where request_id = v_request_id for update/i)
  assert.match(body, /pg_catalog\.pg_advisory_xact_lock\(\(\('x' \|\| pg_catalog\.substr/i)
})

test("0065 is local and contains no Task DML or remote markers", () => {
  const source = sql()
  assert.doesNotMatch(source, /insert\s+into\s+public\.tasks|update\s+public\.tasks|delete\s+from\s+public\.tasks/i)
  assert.doesNotMatch(source, /supabase|docker|remote|http|fetch\(|apply migration/i)
  assert.ok(source.split("\n").length <= 500)
})
