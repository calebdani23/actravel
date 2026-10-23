import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  actorSession,
  applyMigration,
  cleanupPostgres,
  containerName,
  docker,
  postgresImage,
  prepareBaseDatabase,
  psql,
  sqlLiteral,
  waitForPostgres,
} from "./helpers/postgres-runtime";

const helperMigrationPath = "db/migrations/0068_follow_up_task_readiness_helpers.sql";
const rpcMigrationPath = "db/migrations/0069_follow_up_task_disposition_readiness_rpc.sql";
const migrationSql = (path: string) => readFileSync(path, "utf8");
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const adminId = "11111111-1111-4111-8111-111111111111";
const inactiveAdminId = "22222222-2222-4222-8222-222222222222";
const ownerId = "88888888-8888-4888-8888-888888888888";
const requestId = "55555555-5555-4555-8555-555555555555";
const readyRequestId = "44444444-4444-4444-8444-444444444444";
const eventIds = Array.from({ length: 8 }, (_, index) => `66666666-6666-4666-8666-66666666666${index + 1}`);
const leadIds = Array.from({ length: 4 }, (_, index) => `77777777-7777-4777-8777-77777777777${index + 1}`);
const eventAt = "2026-09-01T12:00:00.000Z";
const dueAt = "2026-09-02T12:00:00.000Z";

test("0068 declares only bounded read-only readiness helpers", () => {
  const body = migrationSql(helperMigrationPath);
  for (const signature of [
    /function public\.follow_up_task_readiness_validate_approval\(p_request_id uuid\)\s+returns boolean/i,
    /function public\.follow_up_task_readiness_validate_receipt\(p_request_id uuid\)\s+returns boolean/i,
    /function public\.follow_up_task_readiness_rows\(p_request_id uuid\)/i,
  ]) assert.match(body, signature);
  assert.match(body, /ordinal integer, event_id uuid, lead_id uuid, owner_id uuid,[\s\S]*receipt_task_id uuid/i);
  assert.match(body, /limit 2000/i);
  assert.doesNotMatch(body, /\b(insert|update|delete)\b/i);
  assert.doesNotMatch(body, /read_follow_up_task_disposition_readiness/i);
  assert.equal((body.match(/revoke all on function public\.follow_up_task_readiness_/gi) ?? []).length, 3);
});

test("0069 declares one authenticated Admin read-only readiness RPC", () => {
  const body = migrationSql(rpcMigrationPath);
  assert.match(body, /function public\.read_follow_up_task_disposition_readiness\(p_request_id_text text, p_expected_actor_id uuid\)\s+returns jsonb language plpgsql stable security definer set search_path = ''/i);
  assert.match(body, /alter function public\.read_follow_up_task_disposition_readiness\(text,uuid\) owner to postgres/i);
  assert.match(body, /grant execute on function public\.read_follow_up_task_disposition_readiness\(text,uuid\) to authenticated/i);
  assert.match(body, /revoke all on function public\.read_follow_up_task_disposition_readiness\(text,uuid\) from public,anon,service_role/i);
  assert.doesNotMatch(body, /\b(insert|update|delete|alter table|create policy|drop policy|sqlerrm)\b/i);
});

type PlanRow = [string, string, string | null, string, string | null, boolean | null, string | null, string, string];
const rows: PlanRow[] = [
  [eventIds[0], leadIds[0], null, eventAt, null, null, null, "invalid-date/no-task", "INVALID_DATE_NO_TASK"],
  [eventIds[1], leadIds[0], ownerId, eventAt, dueAt, true, dueAt, "eligible", "ELIGIBLE"],
  [eventIds[2], leadIds[1], null, eventAt, null, null, null, "manual-review/unassigned-owner", "UNASSIGNED_OWNER"],
  [eventIds[3], leadIds[2], ownerId, eventAt, dueAt, false, dueAt, "already-converted", "ALREADY_CONVERTED"],
  [eventIds[4], leadIds[3], null, eventAt, null, null, null, "excluded/lead-not-operational", "LEAD_NOT_OPERATIONAL"],
  [eventIds[5], leadIds[1], ownerId, eventAt, dueAt, false, dueAt, "eligible", "ELIGIBLE"],
  [eventIds[6], leadIds[2], null, eventAt, null, null, null, "excluded/non-selected-history", "NON_SELECTED_HISTORY"],
  [eventIds[7], leadIds[3], ownerId, eventAt, dueAt, true, dueAt, "collision/manual-review", "DUPLICATE_SOURCE"],
];

function createApprovalSql(planRows = rows, approvalRequestId = requestId) {
  const projections = planRows.filter((row) => row[7] === "eligible").map((row) => ({
    owner_id: row[2], lead_id: row[1], quote_id: null, description: "Follow up with lead", due_at: row[4], status: "pending",
    idempotency_key: "placeholder", task_kind: "follow_up", source_event_id: row[0], source_event_type: "follow_up_registered",
    source_event_created_at: row[3], source_due_at: row[4], source_payload: { followUpAt: row[6], hasNote: row[5] },
    metadata: { schema: "follow_up_task.v1", source_event_id: row[0], source_event_type: "follow_up_registered", owner_id: row[2], lead_id: row[1] },
  }));
  const dispositions = ["eligible", "invalid-date/no-task", "manual-review/unassigned-owner", "excluded/lead-not-operational", "excluded/non-selected-history", "already-converted", "collision/manual-review"];
  const counts = dispositions.map((disposition) => planRows.filter((row) => row[7] === disposition).length);
  const cutoffEventId = planRows[planRows.length - 1][0];
  return `${actorSession(adminId)} set role postgres;
    with input as (select ${sqlLiteral(JSON.stringify(planRows))}::jsonb rows, ${sqlLiteral(JSON.stringify(projections))}::jsonb projections),
    fixed as (select rows, coalesce((select jsonb_agg(jsonb_set(item,'{idempotency_key}',to_jsonb(lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id='||(item->>'source_event_id'),'UTF8'),'sha256'),'hex')))) order by ord) from jsonb_array_elements(projections) with ordinality e(item,ord)),'[]'::jsonb) projections from input),
    payload as (select public.follow_up_canonical_json(jsonb_build_array('follow-up-backfill.v1','${eventAt}','${cutoffEventId}',rows,${sqlLiteral(JSON.stringify(counts))}::jsonb,${planRows.length},0,0,0,false)) plan, public.follow_up_canonical_json(projections) projection from fixed),
    hashes as (select *,lower(encode(extensions.digest(convert_to(plan,'UTF8'),'sha256'),'hex')) plan_hash,lower(encode(extensions.digest(convert_to(projection,'UTF8'),'sha256'),'hex')) projection_hash from payload),
    request as (select *,public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1','${approvalRequestId}','${adminId}','follow-up-approval.v1','follow-up-backfill.v1',jsonb_build_array('${eventAt}','${cutoffEventId}'),null,'${"a".repeat(64)}',plan_hash,projection_hash,plan::jsonb,projection::jsonb)) canonical from hashes)
    select public.approve_follow_up_task_plan('${approvalRequestId}','${adminId}','follow-up-approval.v1','follow-up-backfill.v1','${eventAt}','${cutoffEventId}',null,null,'${"a".repeat(64)}',plan_hash,projection_hash,lower(encode(extensions.digest(convert_to(canonical,'UTF8'),'sha256'),'hex')),plan,projection::jsonb) from request;`;
}

function createAlreadyConvertedTaskSql() {
  const row = rows.find((candidate) => candidate[7] === "already-converted")!;
  return `insert into public.tasks(owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata)
    values ('${row[2]}','${row[1]}',null,'Follow up with lead','${row[4]}','pending',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${row[0]}','UTF8'),'sha256'),'hex')),'follow_up','${row[0]}','follow_up_registered','${row[3]}','${row[4]}',${sqlLiteral(JSON.stringify({ followUpAt: row[6], hasNote: row[5] }))}::jsonb,${sqlLiteral(JSON.stringify({ schema: "follow_up_task.v1", source_event_id: row[0], source_event_type: "follow_up_registered", owner_id: row[2], lead_id: row[1] }))}::jsonb);`;
}

function tamperCanonicalHeaderSql() {
  return `alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update;
    with changed as (select id,public.follow_up_canonical_json(jsonb_set(jsonb_set(jsonb_set(jsonb_set(canonical_plan::jsonb,'{6}','1'::jsonb),'{7}','2'::jsonb),'{8}','3'::jsonb),'{9}','true'::jsonb)) value from public.follow_up_task_approvals where request_id='${requestId}')
    update public.follow_up_task_approvals a set canonical_plan=changed.value,canonical_plan_hash=lower(encode(extensions.digest(convert_to(changed.value,'UTF8'),'sha256'),'hex')),canonical_plan_byte_count=octet_length(convert_to(changed.value,'UTF8')) from changed where a.id=changed.id;
    with request as (select a.id,public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1',a.request_id::text,a.actor_id::text,a.schema_version,a.rule_version,jsonb_build_array(to_char(a.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.event_cutoff_id::text),case when a.task_cutoff_id is null then null else jsonb_build_array(to_char(a.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.task_cutoff_id::text) end,a.reader_snapshot_hash,a.canonical_plan_hash,a.projection_hash,a.canonical_plan::jsonb,a.eligible_projections)) value from public.follow_up_task_approvals a where a.request_id='${requestId}')
    update public.follow_up_task_approvals a set request_fingerprint=lower(encode(extensions.digest(convert_to(request.value,'UTF8'),'sha256'),'hex')),request_byte_count=octet_length(convert_to(request.value,'UTF8')) from request where a.id=request.id;
    alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;
    alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable;
    update public.follow_up_task_apply_receipts r set approval_fingerprint=a.approval_fingerprint,canonical_plan_hash=a.canonical_plan_hash from public.follow_up_task_approvals a where r.request_id=a.request_id and a.request_id='${requestId}';
    alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;
    select a.canonical_plan::jsonb->>6,a.canonical_plan::jsonb->>7,a.canonical_plan::jsonb->>8,a.canonical_plan::jsonb->>9,
      a.canonical_plan_hash=lower(encode(extensions.digest(convert_to(a.canonical_plan,'UTF8'),'sha256'),'hex')),
      a.approval_fingerprint=r.approval_fingerprint,a.canonical_plan_hash=r.canonical_plan_hash
    from public.follow_up_task_approvals a join public.follow_up_task_apply_receipts r on r.request_id=a.request_id where a.request_id='${requestId}';`;
}

function prepareDatabase() {
  psql("postgres", "create database readiness template quote_base;");
  for (const migration of ["0057_quote_rpc_cutover.sql", "0058_fix_legacy_quote_document_link_ambiguity.sql", "0059_quote_registration_intents.sql", "0060_quote_pdf_creation_cutover.sql", "0061_manager_capability_foundation.sql", "0062_tasks_foundation.sql", "0063_staff_notifications_foundation.sql", "0064_follow_up_task_representation.sql", "0065_follow_up_task_approval_ledger.sql", "0066_follow_up_task_apply_receipt_foundation.sql", "0067_follow_up_task_apply_rpc.sql", "0068_follow_up_task_readiness_helpers.sql", "0069_follow_up_task_disposition_readiness_rpc.sql"]) applyMigration("readiness", migration);
  psql("readiness", `grant usage on schema public,auth,extensions to authenticated;
    insert into auth.users(id,email) values ('${adminId}','admin@test'),('${inactiveAdminId}','inactive@test'),('${ownerId}','owner@test');
    insert into public.profiles(id,full_name,is_active) values ('${adminId}','Provider secret',true),('${inactiveAdminId}','Inactive',false),('${ownerId}','Owner',true);
    insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
    insert into public.profile_roles(profile_id,role_id) select '${adminId}',id from public.roles where name='admin';
    insert into public.profile_roles(profile_id,role_id) select '${inactiveAdminId}',id from public.roles where name='admin';
    insert into public.profile_roles(profile_id,role_id) select '${ownerId}',id from public.roles where name='asesor';
    insert into public.contacts(id,first_name,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test','test@example.test');
    insert into public.lead_statuses(id,name,label_es,label_en) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','open','Open','Open');
    insert into public.leads(id,contact_id,status_id,assigned_to) select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${ownerId}' from unnest(array[${leadIds.map((id) => `'${id}'::uuid`).join(",")}]) id;
    grant select on public.profile_roles,public.roles to authenticated;`);
  assert.match(psql("readiness", createApprovalSql()), /"status": "approved"/);
  psql("readiness", createAlreadyConvertedTaskSql());
  assert.match(psql("readiness", createApprovalSql([rows[0]], readyRequestId)), /"status": "approved"/);
  assert.match(psql("readiness", `${actorSession(adminId)} select public.apply_approved_follow_up_task_plan('${readyRequestId}','${adminId}');`), /"status": "applied"/);
  psql("postgres", "create database readiness_no_receipt template readiness;");
  assert.match(psql("readiness", `${actorSession(adminId)} select public.apply_approved_follow_up_task_plan('${requestId}','${adminId}');`), /"status": "applied"/);
}

const snapshotSql = `select lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_object('approvals',(select jsonb_agg(to_jsonb(a) order by id) from public.follow_up_task_approvals a),'receipts',(select jsonb_agg(to_jsonb(r) order by id) from public.follow_up_task_apply_receipts r),'tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.tasks t))),'UTF8'),'sha256'),'hex'));`;
const helperRowsSql = `select coalesce(jsonb_agg(jsonb_build_object('ordinal',ordinal,'eventId',event_id,'disposition',disposition,'taskId',receipt_task_id) order by ordinal),'[]'::jsonb)::text from public.follow_up_task_readiness_rows('${requestId}');`;

function readinessResult(database: string, request = requestId, expectedActor = adminId, session = actorSession(adminId)) {
  const output = psql(database, `${session} select public.read_follow_up_task_disposition_readiness(${sqlLiteral(request)},'${expectedActor}')::text;`);
  return JSON.parse(output.split("\n").at(-1)!);
}

function expectFailure(result: unknown, code: string) {
  assert.deepEqual(result, { ok: false, error: { code, message: code } });
}

function readOnlyReadiness(database: string, request = requestId, expectedActor = adminId, session = actorSession(adminId)) {
  const before = psql(database, snapshotSql);
  const result = readinessResult(database, request, expectedActor, session);
  assert.equal(psql(database, snapshotSql), before);
  return result;
}

test("readiness helpers validate immutable records and map canonical ordinals without DML", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    prepareDatabase();
    assert.equal(psql("readiness", `select bool_and(provolatile='s' and not prosecdef) from pg_proc where oid in ('public.follow_up_task_readiness_validate_approval(uuid)'::regprocedure,'public.follow_up_task_readiness_validate_receipt(uuid)'::regprocedure,'public.follow_up_task_readiness_rows(uuid)'::regprocedure);`), "t");
    assert.equal(psql("readiness", `select has_function_privilege('authenticated','public.follow_up_task_readiness_validate_approval(uuid)','execute'),has_function_privilege('authenticated','public.follow_up_task_readiness_validate_receipt(uuid)','execute'),has_function_privilege('authenticated','public.follow_up_task_readiness_rows(uuid)','execute');`), "f|f|f");
    assert.equal(psql("readiness", `select public.follow_up_task_readiness_validate_approval('99999999-9999-4999-8999-999999999999'),public.follow_up_task_readiness_validate_receipt('99999999-9999-4999-8999-999999999999'),(select count(*) from public.follow_up_task_readiness_rows('99999999-9999-4999-8999-999999999999'));`), "f|f|0");
    const before = psql("readiness", snapshotSql);
    assert.equal(psql("readiness", `select public.follow_up_task_readiness_validate_approval('${requestId}'),public.follow_up_task_readiness_validate_receipt('${requestId}');`), "t|t");
    const first = JSON.parse(psql("readiness", helperRowsSql));
    assert.deepEqual(first.map(({ ordinal, eventId, disposition }: Record<string, unknown>) => ({ ordinal, eventId, disposition })), rows.map((row, ordinal) => ({ ordinal, eventId: row[0], disposition: row[7] })));
    const taskIds = JSON.parse(psql("readiness", `select to_jsonb(task_ids)::text from public.follow_up_task_apply_receipts where request_id='${requestId}';`));
    let eligibleOrdinal = 0;
    assert.deepEqual(first.map((row: { taskId: string | null }, ordinal: number) => rows[ordinal][7] === "eligible" ? taskIds[eligibleOrdinal++] : row.taskId), [null, taskIds[0], null, null, null, taskIds[1], null, null]);
    assert.deepEqual(JSON.parse(psql("readiness", helperRowsSql)), first);
    assert.equal(psql("readiness", snapshotSql), before);

    assert.equal(psql("readiness", `select provolatile='s',prosecdef,pg_get_userbyid(proowner) from pg_proc where oid='public.read_follow_up_task_disposition_readiness(text,uuid)'::regprocedure;`), "t|t|postgres");
    assert.equal(psql("readiness", `select has_function_privilege('anon','public.read_follow_up_task_disposition_readiness(text,uuid)','execute'),has_function_privilege('authenticated','public.read_follow_up_task_disposition_readiness(text,uuid)','execute'),has_function_privilege('service_role','public.read_follow_up_task_disposition_readiness(text,uuid)','execute');`), "f|t|f");
    const receipt = JSON.parse(psql("readiness", `select jsonb_build_object('approvalId',approval_id,'applyReceiptId',id,'taskIds',task_ids)::text from public.follow_up_task_apply_receipts where request_id='${requestId}';`));
    const alreadyTaskId = psql("readiness", `select id from public.tasks where source_event_id='${eventIds[3]}';`);
    eligibleOrdinal = 0;
    const expectedRows = rows.map((row, ordinal) => ({
      ordinal,
      eventId: row[0],
      disposition: row[7],
      outcome: ["eligible", "already-converted"].includes(row[7]) ? "task_backed" : ["manual-review/unassigned-owner", "collision/manual-review"].includes(row[7]) ? "unresolved_manual_review" : "intentional_no_task",
      taskId: row[7] === "eligible" ? receipt.taskIds[eligibleOrdinal++] : row[7] === "already-converted" ? alreadyTaskId : null,
    }));
    const expectedResult = {
      ok: true,
      requestId,
      approvalId: receipt.approvalId,
      applyReceiptId: receipt.applyReceiptId,
      ready: false,
      counts: { eligible: 2, invalidDateNoTask: 1, manualReviewUnassignedOwner: 1, excludedLeadNotOperational: 1, excludedNonSelectedHistory: 1, alreadyConverted: 1, collisionManualReview: 1, taskBacked: 3, intentionalNoTask: 3, unresolvedManualReview: 2, total: 8 },
      rows: expectedRows,
    };
    const readiness = readOnlyReadiness("readiness");
    assert.deepEqual(readiness, expectedResult);
    assert.deepEqual(readOnlyReadiness("readiness"), readiness);
    const readyReceipt = JSON.parse(psql("readiness", `select jsonb_build_object('approvalId',approval_id,'applyReceiptId',id)::text from public.follow_up_task_apply_receipts where request_id='${readyRequestId}';`));
    assert.deepEqual(readOnlyReadiness("readiness", readyRequestId), {
      ok: true, requestId: readyRequestId, approvalId: readyReceipt.approvalId, applyReceiptId: readyReceipt.applyReceiptId, ready: true,
      counts: { eligible: 0, invalidDateNoTask: 1, manualReviewUnassignedOwner: 0, excludedLeadNotOperational: 0, excludedNonSelectedHistory: 0, alreadyConverted: 0, collisionManualReview: 0, taskBacked: 0, intentionalNoTask: 1, unresolvedManualReview: 0, total: 1 },
      rows: [{ ordinal: 0, eventId: eventIds[0], disposition: "invalid-date/no-task", outcome: "intentional_no_task", taskId: null }],
    });
    assert.deepEqual(Object.keys(readiness).sort(), ["approvalId", "applyReceiptId", "counts", "ok", "ready", "requestId", "rows"].sort());
    assert.deepEqual(Object.keys(readiness.counts).sort(), ["alreadyConverted", "collisionManualReview", "eligible", "excludedLeadNotOperational", "excludedNonSelectedHistory", "intentionalNoTask", "invalidDateNoTask", "manualReviewUnassignedOwner", "taskBacked", "total", "unresolvedManualReview"].sort());
    assert.ok(readiness.rows.every((row: Record<string, unknown>) => Object.keys(row).sort().join() === "disposition,eventId,ordinal,outcome,taskId"));
    assert.doesNotMatch(JSON.stringify(readiness), /Provider secret|admin@test|test@example\.test/);

    const missingAuth = `reset role; select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claim.role','',false);`;
    expectFailure(readOnlyReadiness("readiness", "INVALID", adminId, missingAuth), "AUTH_REQUIRED");
    expectFailure(readOnlyReadiness("readiness", "INVALID", inactiveAdminId, actorSession(inactiveAdminId)), "AUTH_INACTIVE");
    expectFailure(readOnlyReadiness("readiness", "INVALID", ownerId, actorSession(ownerId)), "AUTH_NOT_ADMIN");
    expectFailure(readOnlyReadiness("readiness", "INVALID", ownerId), "AUTH_ACTOR_MISMATCH");
    expectFailure(readOnlyReadiness("readiness", "INVALID"), "INVALID_REQUEST");
    expectFailure(readOnlyReadiness("readiness", "99999999-9999-4999-8999-999999999999"), "APPROVAL_NOT_FOUND");
    expectFailure(readOnlyReadiness("readiness_no_receipt"), "APPLY_RECEIPT_NOT_FOUND");

    psql("postgres", "create database readiness_bad_approval template readiness_no_receipt; create database readiness_bad_receipt template readiness; create database readiness_limit template readiness; create database readiness_reordered template readiness; create database readiness_eligible_drift template readiness; create database readiness_already_drift template readiness;");
    psql("readiness_bad_approval", `alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update; update public.follow_up_task_approvals set reader_snapshot_hash=repeat('b',64) where request_id='${requestId}'; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
    expectFailure(readOnlyReadiness("readiness_bad_approval"), "APPROVAL_INTEGRITY_FAILURE");
    psql("readiness_bad_receipt", `alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set result_hash=repeat('e',64) where request_id='${requestId}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable; update public.tasks set description='Parity drift' where source_event_id='${eventIds[1]}';`);
    expectFailure(readOnlyReadiness("readiness_bad_receipt"), "APPLY_RECEIPT_INTEGRITY_FAILURE");
    psql("readiness_limit", `alter table public.follow_up_task_approvals drop constraint follow_up_task_approvals_counts_check; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update; update public.follow_up_task_approvals set eligible_count=2001,total_count=2007,row_count=2007,projection_count=2001 where request_id='${requestId}'; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update; alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts r set approval_fingerprint=a.approval_fingerprint from public.follow_up_task_approvals a where r.request_id=a.request_id and r.request_id='${requestId}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
    expectFailure(readOnlyReadiness("readiness_limit"), "LIMIT_EXCEEDED");
    psql("readiness_reordered", `alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable;
      with swapped as (select r.*,array[r.task_ids[2],r.task_ids[1]] ids from public.follow_up_task_apply_receipts r where request_id='${requestId}'), formed as (select *,jsonb_build_object('schema','follow-up-task-apply-result.v1','requestId',request_id::text,'approvalId',approval_id::text,'actorId',actor_id::text,'taskIds',to_jsonb(ids),'taskCount',cardinality(ids)) value,public.follow_up_canonical_json(jsonb_build_array('follow-up-task-apply-result.v1',request_id::text,approval_id::text,actor_id::text,to_jsonb(ids),cardinality(ids))) canonical from swapped)
      update public.follow_up_task_apply_receipts r set task_ids=f.ids,result=f.value,result_hash=lower(encode(extensions.digest(convert_to(f.canonical,'UTF8'),'sha256'),'hex')),result_byte_count=octet_length(convert_to(f.canonical,'UTF8')) from formed f where r.id=f.id;
      alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
    assert.equal(psql("readiness_reordered", `select public.follow_up_task_readiness_validate_receipt('${requestId}');`), "t");
    expectFailure(readOnlyReadiness("readiness_reordered"), "TASK_PARITY_FAILURE");
    psql("readiness_eligible_drift", `update public.tasks set description='Wrong eligible representation' where source_event_id='${eventIds[1]}';`);
    expectFailure(readOnlyReadiness("readiness_eligible_drift"), "TASK_PARITY_FAILURE");
    psql("readiness_already_drift", `update public.tasks set description='Wrong converted representation' where source_event_id='${eventIds[3]}';`);
    expectFailure(readOnlyReadiness("readiness_already_drift"), "TASK_PARITY_FAILURE");

    psql("postgres", "create database readiness_header template readiness;");
    assert.equal(psql("readiness_header", tamperCanonicalHeaderSql()), "1|2|3|true|t|t|t");
    const coherentHeaderTamper = psql("readiness_header", snapshotSql);
    assert.equal(psql("readiness_header", `select public.follow_up_task_readiness_validate_approval('${requestId}'),public.follow_up_task_readiness_validate_receipt('${requestId}'),(select count(*) from public.follow_up_task_readiness_rows('${requestId}'));`), "f|f|0");
    assert.equal(psql("readiness_header", snapshotSql), coherentHeaderTamper);

    const originalHash = psql("readiness", `select result_hash from public.follow_up_task_apply_receipts where request_id='${requestId}';`);
    psql("readiness", `alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set result_hash=repeat('e',64) where request_id='${requestId}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable;`);
    const corruptReceipt = psql("readiness", snapshotSql);
    assert.equal(psql("readiness", `select public.follow_up_task_readiness_validate_receipt('${requestId}');`), "f");
    assert.equal(psql("readiness", helperRowsSql), "[]");
    assert.equal(psql("readiness", snapshotSql), corruptReceipt);
    psql("readiness", `alter table public.follow_up_task_apply_receipts disable trigger follow_up_task_apply_receipts_immutable; update public.follow_up_task_apply_receipts set result_hash='${originalHash}' where request_id='${requestId}'; alter table public.follow_up_task_apply_receipts enable trigger follow_up_task_apply_receipts_immutable; alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update; alter table public.follow_up_task_approvals disable trigger set_follow_up_task_approval_fingerprint; update public.follow_up_task_approvals set reader_snapshot_hash=repeat('b',64) where request_id='${requestId}'; alter table public.follow_up_task_approvals enable trigger set_follow_up_task_approval_fingerprint; alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;`);
    const corruptApproval = psql("readiness", snapshotSql);
    assert.equal(psql("readiness", `select public.follow_up_task_readiness_validate_approval('${requestId}'),public.follow_up_task_readiness_validate_receipt('${requestId}');`), "f|f");
    assert.equal(psql("readiness", helperRowsSql), "[]");
    assert.equal(psql("readiness", snapshotSql), corruptApproval);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
