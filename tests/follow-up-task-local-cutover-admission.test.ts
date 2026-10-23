import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import test from "node:test";
import {
  assertLocalAdmission,
  localAdmissionPath,
  removeLocalAdmission,
  writeLocalAdmission,
} from "./helpers/follow-up-task-cutover-admission";
import {
  actorSession,
  applyMigration,
  cleanupPostgres,
  containerName,
  docker,
  migrationNames,
  postgresImage,
  prepareBaseDatabase,
  psql,
  sqlLiteral,
  waitForPostgres,
} from "./helpers/postgres-runtime";

const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const selectedRequestId = "03c07000-0000-4000-8000-000000000001";
const adminId = "11111111-1111-4111-8111-111111111111";
const ownerId = "88888888-8888-4888-8888-888888888888";
const leadId = "77777777-7777-4777-8777-777777777777";
const sourceId = "66666666-6666-4666-8666-666666666666";
const approvalId = "03c07000-0000-4000-8000-000000000002";
const applyReceiptId = "03c07000-0000-4000-8000-000000000003";
const taskId = "03c07000-0000-4000-8000-000000000004";
const eventAt = "2026-09-01T12:00:00.000Z";
const dueAt = "2026-09-02T12:00:00.000Z";
const prerequisites = { futureWrite: true, activeReadIndex: true, contactAggregate: true, contact360Summary: true, contactOpportunityPage: true };

removeLocalAdmission();

function parseLastJson(output: string) {
  return JSON.parse(output.split("\n").filter(Boolean).at(-1)!);
}

function approvalSql() {
  const row = [sourceId, leadId, ownerId, eventAt, dueAt, true, dueAt, "eligible", "ELIGIBLE"];
  const projection = {
    owner_id: ownerId, lead_id: leadId, quote_id: null, description: "Follow up with lead", due_at: dueAt, status: "pending",
    idempotency_key: "placeholder", task_kind: "follow_up", source_event_id: sourceId, source_event_type: "follow_up_registered",
    source_event_created_at: eventAt, source_due_at: dueAt, source_payload: { followUpAt: dueAt, hasNote: true },
    metadata: { schema: "follow_up_task.v1", source_event_id: sourceId, source_event_type: "follow_up_registered", owner_id: ownerId, lead_id: leadId },
  };
  return `${actorSession(adminId)} set role postgres;
    with fixed as (select jsonb_set(${sqlLiteral(JSON.stringify(projection))}::jsonb,'{idempotency_key}',to_jsonb(lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${sourceId}','UTF8'),'sha256'),'hex')))) projection),
    payload as (select public.follow_up_canonical_json(${sqlLiteral(JSON.stringify(["follow-up-backfill.v1", eventAt, sourceId, [row], [1, 0, 0, 0, 0, 0, 0], 1, 0, 0, 0, false]))}::jsonb) plan,public.follow_up_canonical_json(jsonb_build_array(projection)) projection from fixed),
    hashes as (select *,lower(encode(extensions.digest(convert_to(plan,'UTF8'),'sha256'),'hex')) plan_hash,lower(encode(extensions.digest(convert_to(projection,'UTF8'),'sha256'),'hex')) projection_hash from payload),
    request as (select *,public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1','${selectedRequestId}','${adminId}','follow-up-approval.v1','follow-up-backfill.v1',jsonb_build_array('${eventAt}','${sourceId}'),null,'${"a".repeat(64)}',plan_hash,projection_hash,plan::jsonb,projection::jsonb)) canonical from hashes)
    select public.approve_follow_up_task_plan('${selectedRequestId}','${adminId}','follow-up-approval.v1','follow-up-backfill.v1','${eventAt}','${sourceId}',null,null,'${"a".repeat(64)}',plan_hash,projection_hash,lower(encode(extensions.digest(convert_to(canonical,'UTF8'),'sha256'),'hex')),plan,projection::jsonb) from request;`;
}

function prepareAdmissionDatabase() {
  psql("postgres", "create database cutover_admission template quote_base;");
  const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) > 56 && Number(name.slice(0, 4)) <= 76);
  assert.equal(migrations.at(-1), "0076_crm_contact_opportunity_follow_up_task_read.sql");
  for (const migration of migrations) applyMigration("cutover_admission", migration);
  psql("cutover_admission", `alter table public.follow_up_task_approvals alter column id set default '${approvalId}'::uuid;
    alter table public.follow_up_task_apply_receipts alter column id set default '${applyReceiptId}'::uuid;
    alter table public.tasks alter column id set default '${taskId}'::uuid;
    grant usage on schema public,auth,extensions to authenticated;
    insert into auth.users(id,email) values ('${adminId}','admin@test'),('${ownerId}','owner@test');
    insert into public.profiles(id,full_name,is_active) values ('${adminId}','Admin',true),('${ownerId}','Owner',true);
    insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
    insert into public.profile_roles(profile_id,role_id) select '${adminId}',id from public.roles where name='admin';
    insert into public.profile_roles(profile_id,role_id) select '${ownerId}',id from public.roles where name='asesor';
    insert into public.contacts(id,first_name,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Admission','admission@example.test');
    insert into public.lead_statuses(id,name,label_es,label_en) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','open','Open','Open');
    insert into public.leads(id,contact_id,status_id,assigned_to) values ('${leadId}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${ownerId}');
    grant select on public.profile_roles,public.roles to authenticated;`);
}

test("local admission rejects every invalid case before one deterministic final publication", { skip: !enabled, timeout: 240_000 }, async () => {
  mkdirSync("tmp/week-03-followups-to-tasks-cutover", { recursive: true });
  const readinessFixture = {
    ok: true, requestId: selectedRequestId, approvalId, applyReceiptId, ready: true,
    counts: { eligible: 1, invalidDateNoTask: 0, manualReviewUnassignedOwner: 0, excludedLeadNotOperational: 0, excludedNonSelectedHistory: 0, alreadyConverted: 0, collisionManualReview: 0, taskBacked: 1, intentionalNoTask: 0, unresolvedManualReview: 0, total: 1 },
    rows: [{ ordinal: 0, eventId: sourceId, disposition: "eligible", outcome: "task_backed", taskId }],
  };
  const mismatchedEvidence = {
    schema: "follow-up-task-local-admission.v1",
    selectedRequestId: "99999999-9999-4999-8999-999999999999",
    database: "disposable-postgres",
    readinessRpc: "read_follow_up_task_disposition_readiness",
    readinessResult: readinessFixture,
    prerequisites,
  };
  for (const invalidEvidence of ["{", JSON.stringify(mismatchedEvidence)]) {
    writeFileSync(localAdmissionPath, invalidEvidence);
    assert.throws(() => assertLocalAdmission(), /invalid/i);
    assert.equal(existsSync(localAdmissionPath), false);
  }
  for (const [result, available] of [[{ ...readinessFixture, ready: false }, prerequisites], [{ ok: false }, prerequisites], [readinessFixture, { ...prerequisites, futureWrite: false }]]) {
    writeFileSync(localAdmissionPath, "stale");
    assert.throws(() => writeLocalAdmission(result, available), /invalid/i);
    assert.equal(existsSync(localAdmissionPath), false);
  }

  let readiness: unknown;
  let runtimePrerequisites: unknown;
  let started = false;
  try {
    assert.equal(process.env.FOLLOW_UP_TASK_CUTOVER_REQUEST_ID, selectedRequestId);
    docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
    started = true;
    await waitForPostgres();
    prepareBaseDatabase();
    prepareAdmissionDatabase();
    assert.equal(parseLastJson(psql("cutover_admission", approvalSql())).status, "approved");
    const applied = parseLastJson(psql("cutover_admission", `${actorSession(adminId)} select public.apply_approved_follow_up_task_plan('${selectedRequestId}','${adminId}')::text;`));
    assert.deepEqual({ status: applied.status, requestId: applied.result.requestId, taskCount: applied.result.taskCount }, { status: "applied", requestId: selectedRequestId, taskCount: 1 });
    readiness = parseLastJson(psql("cutover_admission", `${actorSession(adminId)} select public.read_follow_up_task_disposition_readiness('${selectedRequestId}','${adminId}')::text;`));
    runtimePrerequisites = parseLastJson(psql("cutover_admission", `select jsonb_build_object(
      'futureWrite',to_regprocedure('public.register_follow_up_action(text,uuid,text,text,text)') is not null,
      'activeReadIndex',to_regclass('public.tasks_active_follow_up_read_idx') is not null,
      'contactAggregate',to_regprocedure('public.crm_contact_aggregate_page(integer,integer,boolean,boolean,text,text,boolean,uuid,boolean,boolean,boolean,boolean,uuid,uuid,text,text,boolean,uuid)') is not null,
      'contact360Summary',to_regprocedure('public.crm_contact_360_summary(uuid)') is not null,
      'contactOpportunityPage',to_regprocedure('public.crm_contact_opportunity_page(uuid,text,integer,timestamptz,uuid)') is not null)::text;`));
  } finally {
    removeLocalAdmission();
    cleanupPostgres();
    if (started) assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }

  let published = false;
  try {
    const written = writeLocalAdmission(readiness, runtimePrerequisites);
    assert.deepEqual(written.readinessResult, readinessFixture);
    assert.deepEqual(written.prerequisites, prerequisites);
    assert.deepEqual(assertLocalAdmission(), written);
    assert.equal(readFileSync(localAdmissionPath, "utf8"), `${JSON.stringify(written, null, 2)}\n`);
    assert.equal(statSync(localAdmissionPath).mode & 0o777, 0o600);
    assert.deepEqual(Object.keys(written), ["schema", "selectedRequestId", "database", "readinessRpc", "readinessResult", "prerequisites"]);
    published = true;
  } finally {
    if (!published) removeLocalAdmission();
  }
});
