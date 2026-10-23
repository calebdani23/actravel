import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0078_task_action_rpc.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const actor = {
  admin: "21000000-0000-4000-8000-000000000001",
  manager: "21000000-0000-4000-8000-000000000002",
  owner: "21000000-0000-4000-8000-000000000003",
  outsider: "21000000-0000-4000-8000-000000000004",
  inactive: "21000000-0000-4000-8000-000000000005",
  adminOwner: "21000000-0000-4000-8000-000000000006",
};
const request = (value: number) => `22000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const taskId = (value: number) => `23000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const sqlValue = (value: string | null) => value === null ? "null" : `'${value}'`;

function action(database: string, actorId: string, requestId: string, id: string, target: string, reason: string | null = null, outcome: string | null = null, note: string | null = null, expectedActor = actorId) {
  const output = psql(database, `${actorSession(actorId)} select public.task_action('${requestId}','${expectedActor}','${id}','${target}',${sqlValue(reason)},${sqlValue(outcome)},${sqlValue(note)})::text;`);
  return JSON.parse(output.split(/\r?\n/).at(-1)!);
}

function failure(code: string) {
  return { ok: false, error: { code, message: code } };
}

test("0078 preserves the sequential authenticated human action RPC and exact replacement types", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const types = readFileSync("lib/supabase/database.types.ts", "utf8");
  const rpc = types.slice(types.indexOf("task_action:"), types.indexOf("task_actor_can_manage:", types.indexOf("task_action:")));
  assert.match(sql, /task_action\(p_request_id_text text, p_expected_actor_id uuid, p_task_id_text text, p_target_status text, p_cancel_reason text, p_completion_outcome text, p_note text\)/i);
  assert.match(sql, /grant execute on function public\.task_action\(text,uuid,text,text,text,text,text\) to authenticated/i);
  assert.doesNotMatch(sql, /grant execute on function [^\n]+ to (public|anon|service_role)/i);
  assert.match(sql, /revoke all on function public\.task_transition\(uuid,text\) from authenticated/i);
  for (const field of ["p_request_id_text: string", "p_expected_actor_id: string", "p_task_id_text: string", "p_target_status: \"in_progress\" | \"completed\" | \"canceled\"", "p_note: string | null", "Returns: Json"]) assert.ok(rpc.includes(field), field);
});

test("sequential actions validate, authorize, mutate atomically, and audit same-target no-ops", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_action_lifecycle";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", `create database ${database} template quote_base;`);
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 78);
    assert.equal(migrations.at(-1), migration);
    for (const name of migrations) applyMigration(database, name);

    psql(database, `
      insert into auth.users(id,email) values ${Object.entries(actor).map(([name, id]) => `('${id}','${name}@test')`).join(",")};
      insert into public.profiles(id,full_name,is_active) values
        ('${actor.admin}','Admin',true),('${actor.manager}','Manager',true),('${actor.owner}','Owner',true),
        ('${actor.outsider}','Outsider',true),('${actor.inactive}','Inactive',false),('${actor.adminOwner}','Admin owner',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id)
        select value.id,role.id from (values ('${actor.admin}'::uuid,'admin'),('${actor.manager}'::uuid,'manager'),('${actor.owner}'::uuid,'asesor'),('${actor.outsider}'::uuid,'asesor'),('${actor.inactive}'::uuid,'asesor'),('${actor.adminOwner}'::uuid,'admin')) value(id,name)
        join public.roles role on role.name=value.name;
      insert into public.tasks(id,owner_id,description,due_at,status,idempotency_key,created_at,updated_at) values
        ('${taskId(1)}','${actor.owner}','Start','2026-09-20Z','pending',repeat('1',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(2)}','${actor.owner}','Complete pending','2026-09-20Z','pending',repeat('2',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(3)}','${actor.owner}','Cancel pending','2026-09-20Z','pending',repeat('3',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(4)}','${actor.owner}','Complete active','2026-09-20Z','in_progress',repeat('4',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(5)}','${actor.owner}','Cancel active','2026-09-20Z','in_progress',repeat('5',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(6)}','${actor.owner}','No-op active','2026-09-20Z','in_progress',repeat('6',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(7)}','${actor.outsider}','Decoy','2026-09-20Z','pending',repeat('7',64),'2026-09-18Z','2026-09-18Z'),
        ('${taskId(8)}','${actor.adminOwner}','Admin owned','2026-09-20Z','pending',repeat('8',64),'2026-09-18Z','2026-09-18Z');
      insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,outcome)
        values ('${request(90)}',lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('task-action-request-key.v1','${request(90)}')),'UTF8'),'sha256'),'hex')),repeat('a',64),'${taskId(1)}','human','${actor.owner}','${actor.owner}','start','pending','in_progress','applied');
    `);

    const before = psql(database, `select public.follow_up_canonical_json(jsonb_build_array((select status from public.tasks where id='${taskId(1)}'),(select count(*) from public.task_action_receipts)));`);
    assert.deepEqual(action(database, actor.outsider, request(90), taskId(7), "in_progress"), failure("TASK_FORBIDDEN"));
    assert.deepEqual(action(database, actor.owner, request(90), taskId(1), "in_progress"), failure("TASK_ACTION_IDEMPOTENCY_CONFLICT"));
    assert.equal(psql(database, `select public.follow_up_canonical_json(jsonb_build_array((select status from public.tasks where id='${taskId(1)}'),(select count(*) from public.task_action_receipts)));`), before);

    const unauthenticated = psql(database, `set role authenticated; select public.task_action('${request(91)}','${actor.owner}','${taskId(1)}','in_progress',null,null,null)::text;`);
    assert.deepEqual(JSON.parse(unauthenticated), failure("AUTH_REQUIRED"));
    assert.deepEqual(action(database, actor.inactive, request(92), taskId(1), "in_progress"), failure("AUTH_INACTIVE"));
    assert.deepEqual(action(database, actor.owner, request(93), taskId(1), "in_progress", null, null, null, actor.admin), failure("AUTH_ACTOR_MISMATCH"));
    for (const [index, target, reason, outcome, note] of [[94,"pending",null,null,null],[95,"in_progress",null,null,"note"],[96,"canceled",null,null,null],[97,"completed",null,"unknown",null],[98,"completed",null,null," padded "]] as const) {
      assert.deepEqual(action(database, actor.owner, request(index), taskId(1), target, reason, outcome, note), failure("INVALID_REQUEST"));
    }
    assert.equal(psql(database, `${actorSession(actor.admin)} select public.task_actor_can_manage('${actor.owner}');`).split(/\r?\n/).at(-1), "t");

    const applied = [
      action(database, actor.owner, request(1), taskId(1), "in_progress"),
      action(database, actor.admin, request(2), taskId(2), "completed", null, "work_completed", "Done"),
      action(database, actor.manager, request(3), taskId(3), "canceled", "duplicate"),
      action(database, actor.owner, request(4), taskId(4), "completed"),
      action(database, actor.owner, request(5), taskId(5), "canceled", "other", null, "Stopped"),
    ];
    applied.forEach((result, index) => assert.equal(`${result.ok}:${result.outcome}:${result.replayed}`, "true:applied:false", `${index}:${JSON.stringify(result)}`));
    const noOp = action(database, actor.owner, request(6), taskId(6), "in_progress");
    assert.equal(`${noOp.ok}:${noOp.outcome}:${noOp.replayed}`, "true:already_at_target:false");
    assert.equal(action(database, actor.owner, request(10), taskId(2), "completed").outcome, "already_at_target");
    assert.deepEqual(action(database, actor.manager, request(7), taskId(8), "in_progress"), failure("TASK_FORBIDDEN"));
    assert.deepEqual(action(database, actor.owner, request(11), taskId(99), "in_progress"), failure("TASK_FORBIDDEN"));
    assert.deepEqual(action(database, actor.owner, request(8), taskId(2), "canceled", "other"), failure("TASK_INVALID_TRANSITION"));
    assert.equal(psql(database, `select array[(select string_agg(status,',' order by id)='in_progress,completed,canceled,completed,canceled,in_progress,pending,pending' from public.tasks),(select count(*)=8 from public.task_action_receipts),(select updated_at='2026-09-18Z' from public.tasks where id='${taskId(6)}'),(select count(*)=2 from public.task_action_receipts where outcome='already_at_target')]::text;`), "{t,t,t,t}");
    assert.equal(psql(database, "select array[has_function_privilege('authenticated','public.task_action(text,uuid,text,text,text,text,text)','execute'),has_function_privilege('anon','public.task_action(text,uuid,text,text,text,text,text)','execute'),has_function_privilege('service_role','public.task_action(text,uuid,text,text,text,text,text)','execute'),has_function_privilege('authenticated','public.task_transition(uuid,text)','execute')]::text;"), "{t,f,f,f}");
    assert.throws(() => psql(database, `${actorSession(actor.owner, "anon")} select public.task_action('${request(9)}','${actor.owner}','${taskId(1)}','in_progress',null,null,null);`), /permission denied/i);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
