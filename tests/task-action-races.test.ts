import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0078_task_action_rpc.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const actor = {
  owner: "31000000-0000-4000-8000-000000000001",
  outsider: "31000000-0000-4000-8000-000000000002",
};
const request = (value: number) => `32000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const taskId = (value: number) => `33000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const sourceId = (value: number) => `34000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const sourceKey = (value: number) => value.toString(16).padStart(64, "0");
const parseResult = (output: string) => JSON.parse(output.split(/\r?\n/).at(-1)!);

function humanSql(requestId: string, id: string, target: string, reason = "null") {
  return `${actorSession(actor.owner)} select public.task_action('${requestId}','${actor.owner}','${id}','${target}',${reason},null,null)::text;`;
}

function human(database: string, requestId: string, id: string, target: string, reason = "null") {
  return parseResult(psql(database, humanSql(requestId, id, target, reason)));
}

function automationSql(source: number, order: number, id: string) {
  return `select public.task_action_automation_cancel('quote_version_response','${sourceId(source)}','${sourceKey(source)}',${order},'${id}')::text;`;
}

function automation(database: string, source: number, order: number, id: string) {
  return parseResult(psql(database, automationSql(source, order, id)));
}

test("0078 defines request-lock replay and a private exact automation cancellation writer", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const humanStart = sql.indexOf("create or replace function public.task_action(");
  const requestLock = sql.indexOf("pg_advisory_xact_lock", humanStart);
  const receiptLookup = sql.indexOf("from public.task_action_receipts", humanStart);
  assert.ok(humanStart >= 0 && requestLock > humanStart && requestLock < receiptLookup);
  assert.match(sql, /'task-action-request\.v1',v_request_id::text,actor_id::text,v_requested_task_id::text,p_target_status,p_cancel_reason,p_completion_outcome,p_note/i);
  assert.match(sql, /prior_receipt\.request_fingerprint\s*=\s*v_request_fingerprint[\s\S]*'replayed',true/i);
  assert.match(sql, /task_action_automation_cancel\(p_source_kind text, p_source_id uuid, p_source_key text, p_source_order bigint, p_task_id uuid\)/i);
  assert.match(sql, /'task-action-automation-key\.v1',p_source_kind,p_source_id::text,p_source_key,p_source_order,p_task_id::text/i);
  assert.match(sql, /'task-action-automation\.v1',p_source_kind,p_source_id::text,p_source_key,p_source_order,p_task_id::text,'canceled','source_invalidated'/i);
  assert.match(sql, /revoke all on function public\.task_action_automation_cancel\(text,uuid,text,bigint,uuid\) from public,anon,authenticated,service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.task_action_automation_cancel/i);
  assert.match(sql, /revoke all on function public\.task_transition\(uuid,text\) from authenticated/i);
});

test("replay, conflicts, races, and automated cancellation preserve first terminal state", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_action_races";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", `create database ${database} template quote_base;`);
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 78);
    assert.equal(migrations.at(-1), migration);
    for (const name of migrations) applyMigration(database, name);

    psql(database, `
      insert into auth.users(id,email) values ('${actor.owner}','owner@test'),('${actor.outsider}','outsider@test');
      insert into public.profiles(id,full_name,is_active) values ('${actor.owner}','Owner',true),('${actor.outsider}','Outsider',true);
      insert into public.roles(name,description) values ('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.owner}'::uuid),('${actor.outsider}'::uuid)) value(id) join public.roles role on role.name='asesor';
      insert into public.tasks(id,owner_id,description,due_at,status,idempotency_key,created_at,updated_at) values
        ('${taskId(1)}','${actor.owner}','Replay','2026-09-20Z','pending',repeat('1',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(2)}','${actor.owner}','Automation replay','2026-09-20Z','pending',repeat('2',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(3)}','${actor.owner}','Identical race','2026-09-20Z','pending',repeat('3',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(4)}','${actor.owner}','Same target race','2026-09-20Z','pending',repeat('4',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(5)}','${actor.owner}','Terminal race','2026-09-20Z','pending',repeat('5',64),'2026-09-18Z','2026-09-18Z');
      create function public.slow_task_action_race() returns trigger language plpgsql as $$begin
        if new.id in ('${taskId(3)}','${taskId(4)}','${taskId(5)}') then perform pg_sleep(0.25); end if;
        return new;
      end$$;
      create trigger slow_task_action_race before update on public.tasks for each row execute function public.slow_task_action_race();
    `);

    const started = human(database, request(1), taskId(1), "in_progress");
    assert.equal(human(database, request(2), taskId(1), "completed").outcome, "applied");
    const delayedReplay = human(database, request(1), taskId(1), "in_progress");
    assert.equal(`${delayedReplay.receiptId}:${delayedReplay.outcome}:${delayedReplay.replayed}`, `${started.receiptId}:applied:true`);
    assert.equal(human(database, request(1), taskId(1), "completed").error.code, "TASK_ACTION_IDEMPOTENCY_CONFLICT");
    psql(database, `update public.tasks set owner_id='${actor.outsider}' where id='${taskId(1)}';`);
    assert.equal(human(database, request(1), taskId(1), "in_progress").error.code, "TASK_FORBIDDEN");
    assert.equal(automation(database, 4, 10, taskId(1)).outcome, "not_applicable_terminal");

    const automated = automation(database, 1, 7, taskId(2));
    const automatedReplay = automation(database, 1, 7, taskId(2));
    assert.equal(`${automatedReplay.receiptId}:${automatedReplay.outcome}:${automatedReplay.replayed}`, `${automated.receiptId}:applied:true`);
    assert.equal(`${automated.sourceKey}:${automated.sourceOrder}`, `${sourceKey(1)}:7`);
    assert.equal(automation(database, 2, 8, taskId(2)).outcome, "already_at_target");
    assert.equal(`${human(database, request(7), taskId(2), "completed").error.code}:${psql(database, `select count(*) from public.task_action_receipts where task_id='${taskId(2)}';`)}`, "TASK_INVALID_TRANSITION:2");
    assert.equal(psql(database, `select request_key=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('task-action-automation-key.v1',source_kind,source_id::text,source_key,source_order,task_id::text)),'UTF8'),'sha256'),'hex')) and request_fingerprint=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('task-action-automation.v1',source_kind,source_id::text,source_key,source_order,task_id::text,'canceled','source_invalidated')),'UTF8'),'sha256'),'hex')) from public.task_action_receipts where id='${automated.receiptId}';`), "t");
    assert.throws(() => psql(database, `update public.task_action_receipts set source_order=9 where id='${automated.receiptId}';`), /TASK_ACTION_RECEIPT_IMMUTABLE/);

    const identical = (await Promise.all([
      psqlAsync(database, humanSql(request(3), taskId(3), "in_progress")),
      psqlAsync(database, humanSql(request(3), taskId(3), "in_progress")),
    ])).map(parseResult);
    assert.deepEqual(identical.map((value) => value.replayed).sort(), [false, true]);
    assert.equal(new Set(identical.map((value) => value.receiptId)).size, 1);

    const sameTarget = (await Promise.all([
      psqlAsync(database, humanSql(request(4), taskId(4), "completed")),
      psqlAsync(database, humanSql(request(5), taskId(4), "completed")),
    ])).map(parseResult);
    assert.deepEqual(sameTarget.map((value) => value.outcome).sort(), ["already_at_target", "applied"]);

    const terminal = (await Promise.all([
      psqlAsync(database, humanSql(request(6), taskId(5), "completed")),
      psqlAsync(database, automationSql(3, 9, taskId(5))),
    ])).map(parseResult);
    const finalStatus = psql(database, `select status from public.tasks where id='${taskId(5)}';`);
    if (finalStatus === "completed") {
      assert.equal(terminal[0].outcome, "applied");
      assert.equal(terminal[1].outcome, "not_applicable_terminal");
    } else {
      assert.equal(finalStatus, "canceled");
      assert.equal(terminal[0].error.code, "TASK_INVALID_TRANSITION");
      assert.equal(terminal[1].outcome, "applied");
    }
    assert.equal(psql(database, `select count(*) from public.task_action_receipts where task_id='${taskId(5)}';`), finalStatus === "completed" ? "2" : "1");
    assert.equal(psql(database, "select has_function_privilege('authenticated','public.task_action_automation_cancel(text,uuid,text,bigint,uuid)','execute') or has_function_privilege('service_role','public.task_action_automation_cancel(text,uuid,text,bigint,uuid)','execute');"), "f");
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
