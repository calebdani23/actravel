import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyMigration, cleanupPostgres, containerName, docker, postgresImage, prepareBaseDatabase, psql, psqlAsync, sqlLiteral, waitForPostgres } from "./helpers/postgres-runtime";

const migrationPath = "db/migrations/0067_follow_up_task_apply_rpc.sql";
const sql = () => readFileSync(migrationPath, "utf8");
const enabled = process.env.RUN_FOLLOW_UP_APPROVAL_DB_TESTS === "1";
const admin = "11111111-1111-4111-8111-111111111111";
const owner = "88888888-8888-4888-8888-888888888888";
const lead = "77777777-7777-4777-8777-777777777777";
const source = "66666666-6666-4666-8666-666666666666";
const request = "55555555-5555-4555-8555-555555555555";

test("0067 declares the atomic apply contract and one total lock order", () => {
  const body = sql();
  for (const fragment of [
    /create or replace function public\.apply_approved_follow_up_task_plan\(p_request_id_text text, p_expected_actor_id uuid\)/i,
    /security definer/i, /AUTH_REQUIRED/, /APPROVAL_NOT_FOUND/, /STALE_LIVE_CONTEXT/,
    /TASK_OCCUPANCY_CONFLICT/, /LIMIT_EXCEEDED/, /follow-up-apply:receipt-request:v1\|/,
    /follow-up-apply:source:v1\|/, /follow-up-apply:owner-idempotency:v1\|/,
     /follow-up-apply:owner-lead:v1\|/, /collate\s+"C"/i, /for update/i,
     /follow-up-task-apply-request\.v1/, /expected_request_fingerprint/i,
     /follow_up_canonical_json\(row\)[\s\S]*>\s*512/i,
     /follow_up_canonical_json\(item\)[\s\S]*>\s*2048/i,
     /follow_up_canonical_json\(expected_header\)[\s\S]*>\s*4096/i,
     /canonical_plan_byte_count\s*>\s*1048576/i,
     /projection_byte_count\s*>\s*4194304/i,
      /request_byte_count\s*>\s*5242880/i,
      /row->>0 is null or row->>1 is null or row->>3 is null\s+or row->>7 is null or row->>8 is null\s+or row->>0 !~/i,
     /expected_approval_fingerprint\s*<>\s*approval\.approval_fingerprint/i,
    /profile_roles[\s\S]*order by role_id for update/i,
    /roles[\s\S]*order by pr\.role_id loop/i,
    /order by t\.id for update/i,
    /insert into public\.tasks\s*\(/i, /insert into public\.follow_up_task_apply_receipts/i,
    /source_event_id/, /source_due_at/, /source_payload/, /metadata/,
    /revoke all on function public\.apply_approved_follow_up_task_plan\(text,uuid\)/i,
    /drop function public\.apply_approved_follow_up_task_plan\(text,uuid\)/i,
  ]) assert.match(body, fragment);
   assert.ok(body.indexOf("TASK_OCCUPANCY_CONFLICT") < body.indexOf("v_projection_count > 2000"));
   assert.doesNotMatch(body, /exists \(select 1 from public\.follow_up_task_approvals a where a\.request_id = request_uuid/);
  assert.doesNotMatch(body, /approve_follow_up_task_plan\s*\(/i);
  assert.doesNotMatch(body, /0061|0062|0063|0064|0065/);
});

function session(actor = admin) {
  return `set statement_timeout='10000'; select set_config('request.jwt.claim.sub','${actor}',false); select set_config('request.jwt.claim.role','authenticated',false); set role authenticated;`;
}

const installApprovalTamperHelper = `
  create function public.test_replace_follow_up_approval(p_request_id uuid, p_plan jsonb, p_projection jsonb)
  returns void language plpgsql security definer set search_path = '' as $$
  declare
    a public.follow_up_task_approvals;
    plan_text text := public.follow_up_canonical_json(p_plan);
    projection_text text := public.follow_up_canonical_json(p_projection);
    v_plan_hash text;
    v_projection_hash text;
    request_text text;
  begin
    select * into a from public.follow_up_task_approvals where request_id = p_request_id;
    v_plan_hash := lower(encode(extensions.digest(convert_to(plan_text,'UTF8'),'sha256'),'hex'));
    v_projection_hash := lower(encode(extensions.digest(convert_to(projection_text,'UTF8'),'sha256'),'hex'));
    request_text := public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1',a.request_id::text,a.actor_id::text,a.schema_version,a.rule_version,
      jsonb_build_array(to_char(a.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.event_cutoff_id::text),
      case when a.task_cutoff_id is null then null else jsonb_build_array(to_char(a.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.task_cutoff_id::text) end,
      a.reader_snapshot_hash,v_plan_hash,v_projection_hash,p_plan,p_projection));
    update public.follow_up_task_approvals set canonical_plan=plan_text,eligible_projections=p_projection,
      eligible_count=(p_plan->4->>0)::integer,invalid_date_no_task_count=(p_plan->4->>1)::integer,
      manual_review_unassigned_owner_count=(p_plan->4->>2)::integer,excluded_lead_not_operational_count=(p_plan->4->>3)::integer,
      excluded_non_selected_history_count=(p_plan->4->>4)::integer,already_converted_count=(p_plan->4->>5)::integer,
      collision_manual_review_count=(p_plan->4->>6)::integer,total_count=(p_plan->>5)::integer,row_count=(p_plan->>5)::integer,
      projection_count=jsonb_array_length(p_projection),canonical_plan_hash=v_plan_hash,projection_hash=v_projection_hash,
      request_fingerprint=lower(encode(extensions.digest(convert_to(request_text,'UTF8'),'sha256'),'hex')),
      canonical_plan_byte_count=octet_length(convert_to(plan_text,'UTF8')),projection_byte_count=octet_length(convert_to(projection_text,'UTF8')),
      request_byte_count=octet_length(convert_to(request_text,'UTF8')) where request_id=p_request_id;
  end $$;`;

function prepare() {
  psql("postgres", "create database follow_up_apply template quote_base;");
  for (const migration of ["0057_quote_rpc_cutover.sql", "0058_fix_legacy_quote_document_link_ambiguity.sql", "0059_quote_registration_intents.sql", "0060_quote_pdf_creation_cutover.sql", "0061_manager_capability_foundation.sql", "0062_tasks_foundation.sql", "0063_staff_notifications_foundation.sql", "0064_follow_up_task_representation.sql", "0065_follow_up_task_approval_ledger.sql", "0066_follow_up_task_apply_receipt_foundation.sql", "0067_follow_up_task_apply_rpc.sql"]) applyMigration("follow_up_apply", migration);
  psql("follow_up_apply", `grant usage on schema public, auth, extensions to anon, authenticated, service_role;
    insert into auth.users(id,email) values ('${admin}','admin@test'),('${owner}','owner@test');
    insert into public.profiles(id,full_name,is_active) values ('${admin}','Admin',true),('${owner}','Owner',true);
    insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
    insert into public.profile_roles(profile_id,role_id) select '${admin}',id from public.roles where name='admin';
    insert into public.profile_roles(profile_id,role_id) select '${owner}',id from public.roles where name='asesor';
    insert into public.contacts(id,first_name,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test','test@example.test');
    insert into public.lead_statuses(id,name,label_es,label_en) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','open','Open','Open');
    insert into public.leads(id,contact_id,status_id,assigned_to) values ('${lead}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${owner}');
    grant select on public.profile_roles,public.roles to authenticated;
    ${installApprovalTamperHelper}`);
}

type PlanRow = [string, string, string | null, string, string | null, boolean | null, string | null, string, string];

function sqlJson(value: unknown) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function jsonResult(value: string) {
  return JSON.parse(value.split("\n").filter(Boolean).at(-1)!);
}

function approvalRows(requestId: string, rows: PlanRow[], sourceId = source) {
  const counts = ["eligible", "invalid-date/no-task", "manual-review/unassigned-owner", "excluded/lead-not-operational", "excluded/non-selected-history", "already-converted", "collision/manual-review"]
    .map((disposition) => rows.filter((row) => row[7] === disposition).length);
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
  const projections = rows.filter((row) => row[7] === "eligible").map((row) => ({
    owner_id: row[2], lead_id: row[1], quote_id: null, description: "Follow up with lead", due_at: row[4], status: "pending",
    idempotency_key: digest(`follow-up-task:v1|source_event_id=${row[0]}`), task_kind: "follow_up", source_event_id: row[0], source_event_type: "follow_up_registered",
    source_event_created_at: row[3], source_due_at: row[4], source_payload: { followUpAt: row[6], hasNote: row[5] },
    metadata: { schema: "follow_up_task.v1", source_event_id: row[0], source_event_type: "follow_up_registered", owner_id: row[2], lead_id: row[1] },
  }));
  return `${session()} set role postgres;
    with plan_data as (select public.follow_up_canonical_json(${sqlJson(["follow-up-backfill.v1", "2026-09-01T12:00:00.000Z", sourceId, rows, counts, rows.length, 0, 0, 0, false])}) plan),
    projection_data as (select public.follow_up_canonical_json(${sqlJson(projections)}::jsonb) projection),
    request_data as (select public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1','${requestId}','${admin}','follow-up-approval.v1','follow-up-backfill.v1',jsonb_build_array('2026-09-01T12:00:00.000Z','${sourceId}'),null,'${"a".repeat(64)}',lower(encode(extensions.digest(convert_to((select plan from plan_data),'UTF8'),'sha256'),'hex')),lower(encode(extensions.digest(convert_to((select projection from projection_data),'UTF8'),'sha256'),'hex')),(select plan::jsonb from plan_data),(select projection::jsonb from projection_data))) canonical)
    select public.approve_follow_up_task_plan('${requestId}','${admin}','follow-up-approval.v1','follow-up-backfill.v1','2026-09-01T12:00:00.000Z','${sourceId}',null,null,'${"a".repeat(64)}',lower(encode(extensions.digest(convert_to((select plan from plan_data),'UTF8'),'sha256'),'hex')),lower(encode(extensions.digest(convert_to((select projection from projection_data),'UTF8'),'sha256'),'hex')),lower(encode(extensions.digest(convert_to((select canonical from request_data),'UTF8'),'sha256'),'hex')),(select plan from plan_data),(select projection::jsonb from projection_data));`;
}

function startDatabase() {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  return waitForPostgres().then(() => { prepareBaseDatabase(); prepare(); });
}

async function disposable(run: () => Promise<void>) {
  try { await startDatabase(); await run(); } finally { cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), ""); }
}

const extraSource = "66666666-6666-4666-8666-666666666667";
const concurrentRequest = "55555555-5555-4555-8555-555555555557";
const mixedRequest = "55555555-5555-4555-8555-555555555558";
const rollbackRequest = "55555555-5555-4555-8555-555555555559";

test("auth failures, approval tampering, and receipt identity mismatches are exact and DML-free", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  const before = psql("follow_up_apply", "select (select count(*)::text from public.tasks)||(select count(*)::text from public.follow_up_task_apply_receipts)||(select count(*)::text from public.follow_up_task_approvals);");
  const call = (actor: string, expected: string | null, requestId = request) => psql("follow_up_apply", `${session(actor)} select public.apply_approved_follow_up_task_plan('${requestId}',${expected === null ? "null" : `'${expected}'`});`);
  assert.match(psql("follow_up_apply", "select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claim.role','authenticated',false); set role authenticated; select public.apply_approved_follow_up_task_plan('" + request + "','" + admin + "');"), /AUTH_REQUIRED/);
  assert.match(call("00000000-0000-4000-8000-000000000000", admin), /AUTH_INACTIVE/);
  assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}',null);`), /AUTH_ACTOR_MISMATCH/);
  assert.match(psql("follow_up_apply", `${session(owner)} select public.apply_approved_follow_up_task_plan('${request}','${owner}');`), /AUTH_NOT_ADMIN/);
  assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${owner}');`), /AUTH_ACTOR_MISMATCH/);
  assert.throws(() => psql("follow_up_apply", "select set_config('request.jwt.claim.role','service_role',false); set role service_role; select public.apply_approved_follow_up_task_plan('" + request + "','" + admin + "');"), /permission denied/);
  assert.equal(psql("follow_up_apply", "select (select count(*)::text from public.tasks)||(select count(*)::text from public.follow_up_task_apply_receipts)||(select count(*)::text from public.follow_up_task_approvals);"), before);

  psql("follow_up_apply", approval());
  psql("follow_up_apply", "set role postgres; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update; update public.follow_up_task_approvals set reader_snapshot_hash=repeat('b',64) where request_id='" + request + "'; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;");
  assert.match(call(admin, admin), /APPROVAL_INTEGRITY_FAILURE/);
  assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "0");
}));

test("receipt replay rejects every mismatched identity field", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  psql("follow_up_apply", approval());
  assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`), /applied/);
  const original = psql("follow_up_apply", "select approval_id::text||'|'||result_hash from public.follow_up_task_apply_receipts;").split("|");
   for (const mutation of [
    "actor_id='88888888-8888-4888-8888-888888888888'",
    "approval_id='99999999-9999-4999-8999-999999999999'",
     "result_hash=repeat('e',64)",
  ]) {
    psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set ${mutation}; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`), /APPLY_IDEMPOTENCY_CONFLICT/);
      psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set actor_id='${admin}',approval_id='${original[0]}',request_fingerprint=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('follow-up-task-apply-request.v1','${request}','${admin}')),'UTF8'),'sha256'),'hex')),result_hash='${original[1]}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
   }
   psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update; alter table public.follow_up_task_approvals disable trigger set_follow_up_task_approval_fingerprint; update public.follow_up_task_approvals set request_fingerprint=repeat('c',64) where request_id='${request}'; alter table public.follow_up_task_approvals enable trigger set_follow_up_task_approval_fingerprint; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
   assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`), /replayed/);
   assert.equal(psql("follow_up_apply", `select request_fingerprint = lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('follow-up-task-apply-request.v1','${request}','${admin}')),'UTF8'),'sha256'),'hex')) from public.follow_up_task_apply_receipts where request_id='${request}';`), "t");
   assert.equal(psql("follow_up_apply", `select request_fingerprint <> (select request_fingerprint from public.follow_up_task_approvals where request_id='${request}') from public.follow_up_task_apply_receipts where request_id='${request}';`), "t");
   psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set request_fingerprint=(select request_fingerprint from public.follow_up_task_approvals where request_id='${request}') where request_id='${request}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
   assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`), /APPLY_IDEMPOTENCY_CONFLICT/);
    psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set request_fingerprint=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('follow-up-task-apply-request.v1','${request}','${admin}')),'UTF8'),'sha256'),'hex')) where request_id='${request}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
  }));

function approval(requestId = request, sourceId = source) {
  return `${session()} set role postgres;
    with row_data as (select public.follow_up_canonical_json(jsonb_build_array('${sourceId}','${lead}','${owner}','2026-09-01T12:00:00.000Z','2026-09-02T12:00:00.000Z',true,'2026-09-02T12:00:00.000Z','eligible','ELIGIBLE')) row_json),
    plan_data as (select public.follow_up_canonical_json(jsonb_build_array('follow-up-backfill.v1','2026-09-01T12:00:00.000Z','${sourceId}',jsonb_build_array((select row_json::jsonb from row_data)),jsonb_build_array(1,0,0,0,0,0,0),1,0,0,0,false)) plan),
    projection_data as (select public.follow_up_canonical_json(jsonb_build_array(jsonb_build_object('owner_id','${owner}','lead_id','${lead}','quote_id',null,'description','Follow up with lead','due_at','2026-09-02T12:00:00.000Z','status','pending','idempotency_key',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${sourceId}','UTF8'),'sha256'),'hex')),'task_kind','follow_up','source_event_id','${sourceId}','source_event_type','follow_up_registered','source_event_created_at','2026-09-01T12:00:00.000Z','source_due_at','2026-09-02T12:00:00.000Z','source_payload',jsonb_build_object('followUpAt','2026-09-02T12:00:00.000Z','hasNote',true),'metadata',jsonb_build_object('schema','follow_up_task.v1','source_event_id','${sourceId}','source_event_type','follow_up_registered','owner_id','${owner}','lead_id','${lead}'))))),
    request_data as (select public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1','${requestId}','${admin}','follow-up-approval.v1','follow-up-backfill.v1',jsonb_build_array('2026-09-01T12:00:00.000Z','${sourceId}'),null,'${"a".repeat(64)}',lower(encode(extensions.digest(convert_to((select plan from plan_data),'UTF8'),'sha256'),'hex')),lower(encode(extensions.digest(convert_to((select follow_up_canonical_json from projection_data),'UTF8'),'sha256'),'hex')),(select plan::jsonb from plan_data),(select follow_up_canonical_json::jsonb from projection_data))) canonical)
    select public.approve_follow_up_task_plan('${requestId}','${admin}','follow-up-approval.v1','follow-up-backfill.v1','2026-09-01T12:00:00.000Z','${sourceId}',null,null,'${"a".repeat(64)}',lower(encode(extensions.digest(convert_to((select plan from plan_data),'UTF8'),'sha256'),'hex')),lower(encode(extensions.digest(convert_to((select follow_up_canonical_json from projection_data),'UTF8'),'sha256'),'hex')),lower(encode(extensions.digest(convert_to((select canonical from request_data),'UTF8'),'sha256'),'hex')),(select plan from plan_data),(select follow_up_canonical_json::jsonb from projection_data));`;
}

const stateHashSql = `select lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_object(
  'tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.tasks t),'receipts',(select jsonb_agg(to_jsonb(r) order by id) from public.follow_up_task_apply_receipts r),
  'approvals',(select jsonb_agg(to_jsonb(a) order by id) from public.follow_up_task_approvals a),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
  'leads',(select jsonb_agg(to_jsonb(l) order by id) from public.leads l),'contacts',(select jsonb_agg(to_jsonb(c) order by id) from public.contacts c),
  'quotes',(select jsonb_agg(to_jsonb(q) order by id) from public.quotes q),'roles',(select jsonb_agg(to_jsonb(r) order by id) from public.roles r),
  'profile_roles',(select jsonb_agg(to_jsonb(pr) order by profile_id,role_id) from public.profile_roles pr),'lead_events',(select jsonb_agg(to_jsonb(e) order by id) from public.lead_events e))),
  'UTF8'),'sha256'),'hex'));`;

const dmlCountsSql = `select jsonb_build_object(
  'tasks',(select count(*) from public.tasks),'receipts',(select count(*) from public.follow_up_task_apply_receipts),
  'approvals',(select count(*) from public.follow_up_task_approvals),'profiles',(select count(*) from public.profiles),
  'leads',(select count(*) from public.leads),'contacts',(select count(*) from public.contacts),
  'quotes',(select count(*) from public.quotes),'roles',(select count(*) from public.roles),
  'profile_roles',(select count(*) from public.profile_roles),'lead_events',(select count(*) from public.lead_events))::text;`;

test("JSON null in every required canonical field fails integrity for eligible and retained noneligible rows without DML", { skip: !enabled, timeout: 300_000 }, async () => disposable(async () => {
  const requiredFields = ["eventId", "leadId", "eventCreatedAt", "disposition", "reason"] as const;
  const fieldIndexes = [0, 1, 3, 7, 8] as const;
  const rowKinds = [
    { name: "eligible", row: (sourceId: string): PlanRow => [sourceId, lead, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"] },
    { name: "retained noneligible", row: (sourceId: string): PlanRow => [sourceId, lead, null, "2026-09-01T12:00:00.000Z", null, null, null, "excluded/non-selected-history", "NON_SELECTED_HISTORY"] },
  ] as const;
  const observed = [];
  let caseIndex = 0;
  for (const rowKind of rowKinds) {
    for (const [fieldOffset, field] of requiredFields.entries()) {
      const requestId = `55555555-5555-4555-8555-5555555557${String(caseIndex).padStart(2, "0")}`;
      const sourceId = `66666666-6666-4666-8666-6666666667${String(caseIndex).padStart(2, "0")}`;
      psql("follow_up_apply", approvalRows(requestId, [rowKind.row(sourceId)], sourceId));
      psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update;
        select public.test_replace_follow_up_approval('${requestId}',jsonb_set(a.canonical_plan::jsonb,'{3,0,${fieldIndexes[fieldOffset]}}','null'::jsonb),a.eligible_projections)
        from public.follow_up_task_approvals a where request_id='${requestId}';
        alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
      const beforeHash = psql("follow_up_apply", stateHashSql);
      const beforeCounts = psql("follow_up_apply", dmlCountsSql);
      const result = jsonResult(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${requestId}','${admin}');`));
      observed.push({ row: rowKind.name, field, result: result.error?.code ?? result.status, stateUnchanged: psql("follow_up_apply", stateHashSql) === beforeHash, countsUnchanged: psql("follow_up_apply", dmlCountsSql) === beforeCounts });
      psql("follow_up_apply", "set role postgres; delete from public.tasks; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; delete from public.follow_up_task_apply_receipts; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;");
      caseIndex += 1;
    }
  }
  assert.deepEqual(observed, rowKinds.flatMap((rowKind) => requiredFields.map((field) => ({ row: rowKind.name, field, result: "APPROVAL_INTEGRITY_FAILURE", stateUnchanged: true, countsUnchanged: true }))));
}));

test("self-consistent approval tampering and oversized UTF-8 content fail integrity without DML", { skip: !enabled, timeout: 300_000 }, async () => disposable(async () => {
  psql("follow_up_apply", "set role postgres; alter table public.follow_up_task_approvals drop constraint follow_up_task_approvals_counts_check; alter table public.follow_up_task_approvals drop constraint follow_up_task_approvals_size_check;");
  const base = "a.canonical_plan::jsonb";
  const cases = [
    { name: "noneligible row", plan: `jsonb_set(${base},'{3}',(${base}->3)||jsonb_build_array(jsonb_set(${base}->3->0,'{7}',to_jsonb('excluded/non-selected-history'::text))))` },
    { name: "top-level cardinality", plan: `${base}||jsonb_build_array('extra')` },
    { name: "row cardinality", plan: `jsonb_set(${base},'{3,0}',(${base}->3->0)||jsonb_build_array('extra'))` },
    { name: "static header", plan: `jsonb_set(${base},'{6}','1'::jsonb)` },
    { name: "disposition reason", plan: `jsonb_set(${base},'{3,0,8}',to_jsonb('INVALID_DATE_NO_TASK'::text))` },
    ...Array.from({ length: 7 }, (_, index) => ({ name: `count equation ${index}`, plan: `jsonb_set(${base},'{4,${index}}',to_jsonb(((${base}->4->>${index})::integer)+1))` })),
    { name: "512-byte row", plan: `jsonb_set(${base},'{3,0,8}',to_jsonb(repeat('é',257)))` },
    { name: "4096-byte static header", plan: `jsonb_set(${base},'{0}',to_jsonb(repeat('é',2049)))` },
    { name: "1MiB plan", plan: `${base}||jsonb_build_array(repeat('é',524289))` },
    { name: "2048-byte item, 4MiB projection, and 5MiB request", plan: `jsonb_set(${base},'{3,0,6}',to_jsonb(repeat('é',2100000)))`, projection: `jsonb_set(a.eligible_projections,'{0,source_payload,followUpAt}',to_jsonb(repeat('é',2100000)))` },
  ];
  const observed = [];
  for (const [index, mutation] of cases.entries()) {
    const requestId = `55555555-5555-4555-8555-5555555556${String(index).padStart(2, "0")}`;
    const sourceId = `66666666-6666-4666-8666-6666666666${String(index).padStart(2, "0")}`;
    psql("follow_up_apply", approvalRows(requestId, [[sourceId, lead, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"]], sourceId));
    psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update;
      select public.test_replace_follow_up_approval('${requestId}',${mutation.plan},${mutation.projection ?? "a.eligible_projections"}) from public.follow_up_task_approvals a where request_id='${requestId}';
      alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
    const before = psql("follow_up_apply", stateHashSql);
    const result = jsonResult(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${requestId}','${admin}');`));
    observed.push({ name: mutation.name, result: result.error?.code ?? result.status, dmlFree: psql("follow_up_apply", stateHashSql) === before });
    psql("follow_up_apply", "set role postgres; delete from public.tasks; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; delete from public.follow_up_task_apply_receipts; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;");
  }
  assert.deepEqual(observed, cases.map(({ name }) => ({ name, result: "APPROVAL_INTEGRITY_FAILURE", dmlFree: true })));
}));

test("0057-0067 applies one eligible projection, replays, and leaves non-task DML unchanged", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); prepare();
    const approvalResult = psql("follow_up_apply", approval());
    assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_approvals;"), "1", approvalResult);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('not-a-uuid','${admin}');`), /INVALID_REQUEST/);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('55555555-5555-4555-8555-555555555556','11111111-1111-4111-8111-111111111111');`), /APPROVAL_NOT_FOUND/);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${owner}');`), /AUTH_ACTOR_MISMATCH/);
    assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "0");
    psql("follow_up_apply", `set role postgres; update public.profiles set is_active=false where id='${owner}';`);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`), /STALE_LIVE_CONTEXT/);
    psql("follow_up_apply", `set role postgres; update public.profiles set is_active=true where id='${owner}'; insert into public.tasks(owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata) values ('${owner}','${lead}',null,'Follow up with lead','2026-09-02T12:00:00Z','pending',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${source}','UTF8'),'sha256'),'hex')),'follow_up','${source}','follow_up_registered','2026-09-01T12:00:00Z','2026-09-02T12:00:00Z','{"followUpAt":"2026-09-02T12:00:00.000Z","hasNote":true}'::jsonb,'{"schema":"follow_up_task.v1","source_event_id":"${source}","source_event_type":"follow_up_registered","owner_id":"${owner}","lead_id":"${lead}"}'::jsonb);`);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`), /TASK_OCCUPANCY_CONFLICT/);
    psql("follow_up_apply", `set role postgres; delete from public.tasks where source_event_id='${source}';`);
    const first = psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`);
    assert.match(first, /applied/);
   assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "1");
   assert.equal(psql("follow_up_apply", "select (select array_agg(id order by id)::text from public.tasks) = (select task_ids::text from public.follow_up_task_apply_receipts);"), "t");
    assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "1");
    assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_approvals;"), "1");
    assert.equal(psql("follow_up_apply", "select count(*) from public.tasks t where t.quote_id is null and t.description='Follow up with lead' and t.status='pending' and t.task_kind='follow_up' and t.source_event_type='follow_up_registered' and (select count(*) from jsonb_object_keys(t.metadata))=5 and (select count(*) from jsonb_object_keys(t.source_payload))=2;"), "1");
    assert.equal(psql("follow_up_apply", "select count(*) from public.tasks t where (select count(*) from jsonb_object_keys(to_jsonb(t))) >= 14;"), "1");
    const replay = psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}');`);
    assert.match(replay, /replayed/);
    assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "1");
    assert.match(psql("follow_up_apply", `set role postgres; delete from public.lead_events; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_delete; delete from public.follow_up_task_approvals where request_id='${request}'; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_delete; ${session()} select public.apply_approved_follow_up_task_plan('${request}','${admin}')->>'status';`), /replayed$/);
    assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "1");
    assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts r where r.request_id='55555555-5555-4555-8555-555555555555' and r.task_count=cardinality(r.task_ids) and r.result->'taskIds'=to_jsonb(r.task_ids) and r.result->>'requestId'=r.request_id::text;"), "1");
  } finally { cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), ""); }
});

test("concurrent receipt-request calls converge to one receipt and one Task", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  psql("follow_up_apply", approvalRows(concurrentRequest, [[extraSource, lead, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"]], extraSource));
  const results = await Promise.all([
    psqlAsync("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${concurrentRequest}','${admin}');`),
    psqlAsync("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${concurrentRequest}','${admin}');`),
  ]);
  assert.deepEqual(results.map((value) => jsonResult(value).status).sort(), ["applied", "replayed"]);
  assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "1");
  assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "1");
}));

test("mixed dispositions create only eligible ordinal projections with exact receipt cardinality", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  const rows: PlanRow[] = [
    [source, lead, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"],
    ["66666666-6666-4666-8666-666666666668", lead, null, "2026-09-01T12:00:01.000Z", null, null, null, "invalid-date/no-task", "INVALID_DATE_NO_TASK"],
    ["66666666-6666-4666-8666-666666666669", lead, null, "2026-09-01T12:00:02.000Z", null, null, null, "excluded/non-selected-history", "NON_SELECTED_HISTORY"],
    ["66666666-6666-4666-8666-666666666670", lead, owner, "2026-09-01T12:00:03.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "already-converted", "ALREADY_CONVERTED"],
    ["66666666-6666-4666-8666-666666666671", "99999999-9999-4999-8999-999999999999", null, "2026-09-01T12:00:04.000Z", null, null, null, "excluded/lead-not-operational", "LEAD_NOT_OPERATIONAL"],
    ["66666666-6666-4666-8666-666666666672", lead, null, "2026-09-01T12:00:05.000Z", null, null, null, "manual-review/unassigned-owner", "UNASSIGNED_OWNER"],
  ];
   const mixedApproval = psql("follow_up_apply", approvalRows(mixedRequest, rows));
   assert.equal(psql("follow_up_apply", `select count(*) from public.follow_up_task_approvals where request_id='${mixedRequest}';`), "1", mixedApproval);
  const result = jsonResult(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${mixedRequest}','${admin}');`));
   assert.equal(result.status, "applied", JSON.stringify(result));
  assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "1");
  assert.equal(psql("follow_up_apply", "select task_count || ',' || cardinality(task_ids) || ',' || (result->>'taskCount') from public.follow_up_task_apply_receipts;"), "1,1,1");
  assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_approvals where (canonical_plan::jsonb->3->1->>7)='invalid-date/no-task' and (canonical_plan::jsonb->3->2->>7)='excluded/non-selected-history';"), "1");
   assert.deepEqual(JSON.parse(psql("follow_up_apply", `select jsonb_build_object('owner_id',owner_id,'lead_id',lead_id,'quote_id',quote_id,'description',description,'due_at',due_at,'status',status,'idempotency_key',idempotency_key,'task_kind',task_kind,'source_event_id',source_event_id,'source_event_type',source_event_type,'source_event_created_at',source_event_created_at,'source_due_at',source_due_at,'source_payload',source_payload,'metadata',metadata)::text from public.tasks;`)), { owner_id: owner, lead_id: lead, quote_id: null, description: "Follow up with lead", due_at: "2026-09-02T12:00:00+00:00", status: "pending", idempotency_key: createHash("sha256").update(`follow-up-task:v1|source_event_id=${source}`).digest("hex"), task_kind: "follow_up", source_event_id: source, source_event_type: "follow_up_registered", source_event_created_at: "2026-09-01T12:00:00+00:00", source_due_at: "2026-09-02T12:00:00+00:00", source_payload: { followUpAt: "2026-09-02T12:00:00.000Z", hasNote: true }, metadata: { schema: "follow_up_task.v1", source_event_id: source, source_event_type: "follow_up_registered", owner_id: owner, lead_id: lead } });
}));

test("a deterministic second-row insert failure rolls back Tasks and receipt", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  const second = "66666666-6666-4666-8666-666666666671";
  const rows: PlanRow[] = [
    [source, lead, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"],
    [second, lead, owner, "2026-09-01T12:00:01.000Z", "2026-09-02T12:00:01.000Z", true, "2026-09-02T12:00:01.000Z", "eligible", "ELIGIBLE"],
  ];
  psql("follow_up_apply", approvalRows(rollbackRequest, rows));
  psql("follow_up_apply", `set role postgres; create function fail_second_task_insert() returns trigger language plpgsql as $$ begin if (select count(*) from public.tasks) >= 1 then raise exception 'SECOND_ROW_FAILURE'; end if; return new; end $$; create trigger fail_second_task_insert before insert on public.tasks for each row execute function fail_second_task_insert();`);
  assert.throws(() => psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${rollbackRequest}','${admin}');`), /SECOND_ROW_FAILURE/);
  assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "0");
  assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "0");
}));

test("source, owner-key, and owner-lead occupancy are independent and stale wins first", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  const sourceConflict = "66666666-6666-4666-8666-666666666672";
  const keyConflict = "66666666-6666-4666-8666-666666666673";
  const leadConflict = "66666666-6666-4666-8666-666666666674";
   const isolatedLead = "77777777-7777-4777-8777-777777777778";
   psql("follow_up_apply", `set role postgres; insert into public.leads(id,contact_id,status_id,assigned_to) values ('${isolatedLead}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${owner}');`);
   const insertTask = (eventId: string, keyEvent: string, leadId: string) => psql("follow_up_apply", `set role postgres; insert into public.tasks(owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata) values ('${owner}','${leadId}',null,'Follow up with lead','2026-09-02T12:00:00Z','pending',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${keyEvent}','UTF8'),'sha256'),'hex')),'follow_up','${eventId}','follow_up_registered','2026-09-01T12:00:00Z','2026-09-02T12:00:00Z','{"followUpAt":"2026-09-02T12:00:00.000Z","hasNote":true}'::jsonb,'{"schema":"follow_up_task.v1","source_event_id":"${eventId}","source_event_type":"follow_up_registered","owner_id":"${owner}","lead_id":"${leadId}"}'::jsonb);`);
   const applyOne = (requestId: string, eventId: string, leadId = lead) => {
     psql("follow_up_apply", approvalRows(requestId, [[eventId, leadId, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"]], eventId));
     return psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${requestId}','${admin}');`);
   };
    insertTask(sourceConflict, "66666666-6666-4666-8666-666666666677", isolatedLead);
    assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where source_event_id='${sourceConflict}';`), "1");
    assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where owner_id='${owner}' and idempotency_key=lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${sourceConflict}','UTF8'),'sha256'),'hex'));`), "0");
    assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where owner_id='${owner}' and lead_id='${lead}';`), "0"); assert.match(applyOne("55555555-5555-4555-8555-555555555560", sourceConflict), /TASK_OCCUPANCY_CONFLICT/); assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "1"); assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "0");
    insertTask("66666666-6666-4666-8666-666666666675", keyConflict, isolatedLead);
    assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where source_event_id <> '${keyConflict}' and idempotency_key=lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${keyConflict}','UTF8'),'sha256'),'hex')) and owner_id='${owner}';`), "1");
    assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where owner_id='${owner}' and lead_id='${lead}';`), "0"); assert.match(applyOne("55555555-5555-4555-8555-555555555561", keyConflict), /TASK_OCCUPANCY_CONFLICT/); assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "2"); assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "0");
    insertTask("66666666-6666-4666-8666-666666666676", "66666666-6666-4666-8666-666666666678", lead); assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where source_event_id='${leadConflict}';`), "0"); assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where source_event_id <> '${leadConflict}' and idempotency_key=lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${leadConflict}','UTF8'),'sha256'),'hex')) and owner_id='${owner}';`), "0"); assert.equal(psql("follow_up_apply", `select count(*) from public.tasks where owner_id='${owner}' and lead_id='${lead}';`), "1"); assert.match(applyOne("55555555-5555-4555-8555-555555555562", leadConflict), /TASK_OCCUPANCY_CONFLICT/); assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "3"); assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "0");
  psql("follow_up_apply", `set role postgres; update public.profiles set is_active=false where id='${owner}';`);
  assert.match(applyOne("55555555-5555-4555-8555-555555555563", sourceConflict), /STALE_LIVE_CONTEXT/);
  assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "0");
}));

test("zero is the lower bound and final upper-limit precedence leaves no DML", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  const zeroRequest = "55555555-5555-4555-8555-555555555564";
  psql("follow_up_apply", approvalRows(zeroRequest, [], source));
  assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${zeroRequest}','${admin}');`), /"taskCount": 0/);
  assert.equal(psql("follow_up_apply", "select task_count || ',' || cardinality(task_ids) from public.follow_up_task_apply_receipts;"), "0,0");
   psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_approvals drop constraint follow_up_task_approvals_counts_check; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update; alter table public.follow_up_task_approvals disable trigger set_follow_up_task_approval_fingerprint; update public.follow_up_task_approvals set total_count=2001,row_count=2001,approval_fingerprint=(select approval_fingerprint from public.follow_up_task_apply_receipts where request_id='${zeroRequest}'); alter table public.follow_up_task_approvals enable trigger set_follow_up_task_approval_fingerprint; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
  assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${zeroRequest}','${admin}');`), /replayed/);
    const upperRequest = "55555555-5555-4555-8555-555555555565";
    psql("follow_up_apply", approvalRows(upperRequest, [[extraSource, lead, owner, "2026-09-01T12:00:00.000Z", "2026-09-02T12:00:00.000Z", true, "2026-09-02T12:00:00.000Z", "eligible", "ELIGIBLE"]], extraSource));
    psql("follow_up_apply", `set role postgres; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update;
      select public.test_replace_follow_up_approval('${upperRequest}',
        jsonb_set(jsonb_set(jsonb_set(a.canonical_plan::jsonb,'{3}',jsonb_build_array(a.canonical_plan::jsonb->3->0)||(select jsonb_agg(jsonb_build_array(a.canonical_plan::jsonb->3->0->0,a.canonical_plan::jsonb->3->0->1,null,a.canonical_plan::jsonb->3->0->3,null,null,null,'invalid-date/no-task','INVALID_DATE_NO_TASK') order by i) from generate_series(1,2000) i)),'{4}',jsonb_build_array(1,2000,0,0,0,0,0)),'{5}','2001'::jsonb),
        a.eligible_projections)
      from public.follow_up_task_approvals a where request_id='${upperRequest}';
      alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
   psql("follow_up_apply", `set role postgres; insert into public.tasks(owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata) values ('${owner}','${lead}',null,'Follow up with lead','2026-09-02T12:00:00Z','pending',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${extraSource}','UTF8'),'sha256'),'hex')),'follow_up','${extraSource}','follow_up_registered','2026-09-01T12:00:00Z','2026-09-02T12:00:00Z','{"followUpAt":"2026-09-02T12:00:00.000Z","hasNote":true}'::jsonb,'{"schema":"follow_up_task.v1","source_event_id":"${extraSource}","source_event_type":"follow_up_registered","owner_id":"${owner}","lead_id":"${lead}"}'::jsonb);`);
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${upperRequest}','${admin}');`), /TASK_OCCUPANCY_CONFLICT/);
    psql("follow_up_apply", `set role postgres; delete from public.tasks where source_event_id='${extraSource}';`);
    const snapshot = psql("follow_up_apply", "select jsonb_build_object('tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.tasks t),'receipts',(select jsonb_agg(to_jsonb(r) order by id) from public.follow_up_task_apply_receipts r),'approvals',(select jsonb_agg(to_jsonb(a) order by id) from public.follow_up_task_approvals a),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),'leads',(select jsonb_agg(to_jsonb(l) order by id) from public.leads l),'contacts',(select jsonb_agg(to_jsonb(c) order by id) from public.contacts c),'quotes',(select jsonb_agg(to_jsonb(q) order by id) from public.quotes q),'roles',(select jsonb_agg(to_jsonb(r) order by id) from public.roles r),'profile_roles',(select jsonb_agg(to_jsonb(pr) order by profile_id,role_id) from public.profile_roles pr),'lead_events',(select jsonb_agg(to_jsonb(e) order by id) from public.lead_events e))::text;");
    assert.match(psql("follow_up_apply", `${session()} select public.apply_approved_follow_up_task_plan('${upperRequest}','${admin}');`), /LIMIT_EXCEEDED/);
     assert.equal(psql("follow_up_apply", "select count(*) from public.tasks;"), "0");
   assert.equal(psql("follow_up_apply", "select count(*) from public.follow_up_task_apply_receipts;"), "1");
   assert.equal(psql("follow_up_apply", "select jsonb_build_object('tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.tasks t),'receipts',(select jsonb_agg(to_jsonb(r) order by id) from public.follow_up_task_apply_receipts r),'approvals',(select jsonb_agg(to_jsonb(a) order by id) from public.follow_up_task_approvals a),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),'leads',(select jsonb_agg(to_jsonb(l) order by id) from public.leads l),'contacts',(select jsonb_agg(to_jsonb(c) order by id) from public.contacts c),'quotes',(select jsonb_agg(to_jsonb(q) order by id) from public.quotes q),'roles',(select jsonb_agg(to_jsonb(r) order by id) from public.roles r),'profile_roles',(select jsonb_agg(to_jsonb(pr) order by profile_id,role_id) from public.profile_roles pr),'lead_events',(select jsonb_agg(to_jsonb(e) order by id) from public.lead_events e))::text;"), snapshot);
 }));

test("0067 rollback removes only its objects and leaves the 0066 boundary", { skip: !enabled, timeout: 240_000 }, async () => disposable(async () => {
  psql("follow_up_apply", `set role postgres;
    revoke all on function public.apply_approved_follow_up_task_plan(text,uuid) from public,anon,authenticated,service_role;
    drop function public.apply_approved_follow_up_task_plan(text,uuid);
    alter table public.follow_up_task_approvals drop constraint follow_up_task_approvals_approval_fingerprint_check;
    drop trigger set_follow_up_task_approval_fingerprint on public.follow_up_task_approvals;
    drop function public.set_follow_up_task_approval_fingerprint();
    alter table public.follow_up_task_approvals drop column approval_fingerprint;`);
  assert.equal(psql("follow_up_apply", "select to_regclass('public.follow_up_task_apply_receipts') is not null and to_regprocedure('public.validate_follow_up_task_apply_result(jsonb,text,text,text,uuid[],integer,text,integer)') is not null and to_regprocedure('public.reject_follow_up_task_apply_receipt_mutation()') is not null and not exists (select 1 from information_schema.columns where table_name='follow_up_task_approvals' and column_name='approval_fingerprint');"), "t");
  assert.equal(psql("follow_up_apply", "select to_regprocedure('public.apply_approved_follow_up_task_plan(text,uuid)') is null;"), "t");
}));
