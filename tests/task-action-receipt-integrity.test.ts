import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0077_task_action_audit_foundation.sql";
const migrationPath = `db/migrations/${migration}`;
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const ids = {
  receipt: "10000000-0000-4000-8000-000000000001",
  request: "10000000-0000-4000-8000-000000000002",
  task: "10000000-0000-4000-8000-000000000003",
  actor: "10000000-0000-4000-8000-000000000004",
  owner: "10000000-0000-4000-8000-000000000005",
  source: "10000000-0000-4000-8000-000000000006",
};

test("0077 defines only the purge-independent receipt integrity boundary", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const table = sql.slice(sql.indexOf("create table"), sql.indexOf("create or replace function"));
  const databaseTypes = readFileSync("lib/supabase/database.types.ts", "utf8");
  const receiptTypes = databaseTypes.slice(databaseTypes.indexOf("task_action_receipts:"), databaseTypes.indexOf("tasks:", databaseTypes.indexOf("task_action_receipts:")));
  assert.match(sql, /create table public\.task_action_receipts\s*\(/i);
  assert.doesNotMatch(table, /references\s+/i);
  for (const field of ["request_key text not null unique", "request_fingerprint text not null", "actor_kind text not null", "owner_id uuid not null", "result jsonb not null", "result_hash text not null", "result_byte_count integer not null"]) assert.ok(table.includes(field), field);
  assert.match(sql, /before insert or update or delete on public\.task_action_receipts/i);
  assert.match(sql, /TASK_ACTION_RECEIPT_IMMUTABLE|TASK_ACTION_RECEIPT_INTEGRITY_FAILURE/i);
  assert.match(table, /isfinite\(created_at\)/i);
  assert.match(sql, /enable row level security[\s\S]*force row level security/i);
  assert.match(sql, /revoke all on table public\.task_action_receipts from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)\b[\s\S]*task_action_receipts/i);
  assert.doesNotMatch(sql, /alter table public\.tasks|insert\s+into\s+public\.tasks|update\s+public\.tasks|delete\s+from\s+public\.tasks/i);
  for (const field of ["request_id: string | null", "actor_id: string | null", "source_order: number | null", "result: Json", "Relationships: []"]) assert.ok(receiptTypes.includes(field), field);
});

test("0077 rebuilds the exact canonical result and rejects invalid or mutable receipts", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", "create database task_action_receipt template quote_base;");
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 77);
    assert.equal(migrations.at(-1), migration);
    for (const name of migrations) applyMigration("task_action_receipt", name);

    const human = psql("task_action_receipt", `insert into public.task_action_receipts(id,request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,cancel_reason,completion_outcome,note,outcome,created_at,result,result_hash,result_byte_count)
      values ('${ids.receipt}','${ids.request}',repeat('a',64),repeat('b',64),'${ids.task}','human','${ids.actor}','${ids.owner}','complete','in_progress','completed',null,'work_completed','Done','applied','2026-09-17T12:34:56.123456Z','{}',repeat('0',64),0)
      returning jsonb_build_object('result',result,'hash',result_hash,'bytes',result_byte_count)::text;`);
    const stored = JSON.parse(human);
    assert.deepEqual(Object.keys(stored.result).sort(), ["action","actorId","actorKind","cancelReason","completionOutcome","createdAt","fromStatus","note","outcome","ownerId","receiptId","requestId","schema","sourceId","sourceKey","sourceKind","sourceOrder","targetStatus","taskId"].sort());
    assert.deepEqual(stored.result, {
      schema: "task-action-result.v1", receiptId: ids.receipt, requestId: ids.request, taskId: ids.task,
      actorKind: "human", actorId: ids.actor, ownerId: ids.owner, action: "complete", fromStatus: "in_progress",
      targetStatus: "completed", cancelReason: null, completionOutcome: "work_completed", note: "Done",
      sourceKind: null, sourceId: null, sourceKey: null, sourceOrder: null, outcome: "applied", createdAt: "2026-09-17T12:34:56.123456Z",
    });
    assert.match(stored.hash, /^[0-9a-f]{64}$/);
    assert.ok(stored.bytes > 0 && stored.bytes <= 16_384);
    assert.equal(psql("task_action_receipt", `select result_hash=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('task-action-result.v1',id::text,request_id::text,task_id::text,actor_kind,actor_id::text,owner_id::text,action,from_status,target_status,cancel_reason,completion_outcome,note,source_kind,source_id::text,source_key,source_order,outcome,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),'UTF8'),'sha256'),'hex')) and result_byte_count=octet_length(convert_to(public.follow_up_canonical_json(jsonb_build_array('task-action-result.v1',id::text,request_id::text,task_id::text,actor_kind,actor_id::text,owner_id::text,action,from_status,target_status,cancel_reason,completion_outcome,note,source_kind,source_id::text,source_key,source_order,outcome,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),'UTF8')) from public.task_action_receipts where id='${ids.receipt}';`), "t");

    psql("task_action_receipt", `insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,cancel_reason,source_kind,source_id,source_key,source_order,outcome) values (null,repeat('c',64),repeat('d',64),'${ids.task}','automation',null,'${ids.owner}','cancel','completed','canceled','source_invalidated','quote_version_response','${ids.source}',repeat('e',64),7,'not_applicable_terminal');`);
    assert.equal(psql("task_action_receipt", "select count(*) from public.task_action_receipts;"), "2");
    for (const [createdAt, requestKey] of [["infinity", "f"], ["-infinity", "0"]]) {
      assert.throws(() => psql("task_action_receipt", `insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,outcome,created_at) values ('${ids.source}',repeat('${requestKey}',64),repeat('1',64),'${ids.task}','human','${ids.actor}','${ids.owner}','start','pending','in_progress','applied','${createdAt}');`), /check constraint/i);
    }
    assert.equal(psql("task_action_receipt", "select count(*) from public.task_action_receipts;"), "2");
    for (const invalid of [
      `insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,outcome,source_kind) values ('${ids.request}',repeat('1',64),repeat('2',64),'${ids.task}','human','${ids.actor}','${ids.owner}','start','in_progress','in_progress','already_at_target','forbidden');`,
      `insert into public.task_action_receipts(request_key,request_fingerprint,task_id,actor_kind,owner_id,action,from_status,target_status,cancel_reason,source_kind,source_id,source_key,outcome) values (repeat('3',64),repeat('4',64),'${ids.task}','automation','${ids.owner}','cancel','completed','canceled','source_invalidated','quote_version_response','${ids.source}',repeat('5',64),'not_applicable_terminal');`,
      `insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,completion_outcome,note,outcome) values ('${ids.source}',repeat('6',64),repeat('7',64),'${ids.task}','human','${ids.actor}','${ids.owner}','complete','in_progress','completed','work_completed',repeat('é',1001),'applied');`,
    ]) assert.throws(() => psql("task_action_receipt", invalid), /check constraint/i);
    assert.throws(() => psql("task_action_receipt", "update public.task_action_receipts set outcome=outcome;"), /TASK_ACTION_RECEIPT_IMMUTABLE/);
    assert.throws(() => psql("task_action_receipt", "delete from public.task_action_receipts;"), /TASK_ACTION_RECEIPT_IMMUTABLE/);
    assert.throws(() => psql("task_action_receipt", `set role authenticated; insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,outcome) values ('${ids.source}',repeat('8',64),repeat('9',64),'${ids.task}','human','${ids.actor}','${ids.owner}','start','in_progress','in_progress','already_at_target');`), /permission denied/i);
    assert.equal(psql("task_action_receipt", "select array[(select count(*)=0 from pg_constraint where conrelid='public.task_action_receipts'::regclass and contype='f'),(select relrowsecurity and relforcerowsecurity from pg_class where oid='public.task_action_receipts'::regclass),(select count(*)=1 from pg_policies where schemaname='public' and tablename='task_action_receipts' and policyname='task action receipts authenticated read scoped')]::text;"), "{t,t,t}");
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
