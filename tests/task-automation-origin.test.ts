import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0079_task_automation_foundation.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = { admin: id(4, 1), manager: id(4, 2), owner: id(4, 3), outsider: id(4, 4) };
const lead = (value: number) => id(5, value);
const task = (value: number) => id(6, value);
const source = (value: number) => id(7, value);
const originKey = (...parts: string[]) => createHash("sha256").update(JSON.stringify(["task-automation:v1", ...parts])).digest("hex");

function pairSql(taskId: string, ownerId: string, kind: "first_contact" | "quote_follow_up", contextId: string, occurrenceId: string) {
  const key = kind === "first_contact" ? originKey(kind, contextId) : originKey(kind, contextId, occurrenceId);
  const first = kind === "first_contact";
  return `begin; set constraints all deferred;
    insert into public.tasks(id,owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,automation_origin_key)
    values ('${taskId}','${ownerId}',${first ? `'${contextId}'` : "null"},${first ? "null" : `'${source(90)}'`},'${first ? "Complete first contact" : "Follow up on quote version"}','2026-09-21 15:15:00.123456+00','pending','${key}','${kind}','${key}');
    insert into public.task_automation_origins(origin_key,task_kind,source_kind,operation,opportunity_id,quote_version_id,sent_event_id,anchor_at,due_rule_version,task_id)
    values ('${key}','${kind}','${first ? "opportunity_assignment" : "quote_sent"}','generate',${first ? `'${contextId}'` : "null"},${first ? "null" : `'${contextId}'`},${first ? "null" : `'${occurrenceId}'`},'2026-09-21 15:00:00.123456+00','${first ? "mx-calendar.v1" : "elapsed-48h.v1"}','${taskId}'); commit;`;
}

test("0079 defines only exact native Task representation and immutable origin types", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const original = readFileSync("db/migrations/0064_follow_up_task_representation.sql", "utf8");
  const types = readFileSync("lib/supabase/database.types.ts", "utf8");
  assert.match(sql, /task_kind in \('manual', 'follow_up', 'first_contact', 'quote_follow_up'\)/i);
  assert.match(sql, /'task-automation:v1'[\s\S]*task_automation_origins/i);
  assert.match(sql, /create constraint trigger[\s\S]*deferrable initially deferred/gi);
  assert.match(sql, /force row level security[\s\S]*task_actor_can_manage/i);
  assert.doesNotMatch(sql, /task_automation_tombstones|0080_task_automation_sources/i);
  for (const predicate of ["new.source_event_type <> 'follow_up_registered'", "new.metadata->>'schema' <> 'follow_up_task.v1'", "new.metadata->>'lead_id' <> lower(new.lead_id::text)"]) {
    assert.ok(original.includes(predicate) && sql.includes(predicate), predicate);
  }
  assert.match(types, /task_automation_origins: \{[\s\S]*origin_key: string[\s\S]*task_id: string \| null/);
  assert.match(types, /tasks: \{[\s\S]*automation_origin_key: string \| null/);
});

test("native origins converge without adoption and remain immutable, purge-independent, and RLS-scoped", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_origin";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79);
    assert.equal(migrations.at(-1), migration);
    for (const name of migrations) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ${Object.entries(actor).map(([name, value]) => `('${value}','${name}@test')`).join(",")};
      insert into public.profiles(id,full_name,is_active) values ('${actor.admin}','Admin',true),('${actor.manager}','Manager',true),('${actor.owner}','Owner',true),('${actor.outsider}','Outsider',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.admin}'::uuid,'admin'),('${actor.manager}'::uuid,'manager'),('${actor.owner}'::uuid,'asesor'),('${actor.outsider}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;
      insert into public.contacts(id,first_name,email) values ('${source(80)}','Origin','origin@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${source(81)}','origin_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to,is_test_data) values ('${lead(1)}','${source(80)}','${source(81)}','${actor.owner}',true),('${lead(2)}','${source(80)}','${source(81)}','${actor.owner}',false);
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${source(90)}','${source(80)}','${lead(2)}','Origin quote','${actor.owner}','${actor.owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.tasks(id,owner_id,description,due_at,idempotency_key) values ('${task(90)}','${actor.owner}','Manual','2026-09-21Z',repeat('9',64));
      insert into public.tasks(id,owner_id,lead_id,description,due_at,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata)
      values ('${task(91)}','${actor.owner}','${lead(2)}','Follow up with lead','2026-09-21Z',repeat('8',64),'follow_up','${source(91)}','follow_up_registered','2026-09-20Z','2026-09-21Z','{"followUpAt":"2026-09-21T00:00:00Z","hasNote":true}',jsonb_build_object('schema','follow_up_task.v1','source_event_id','${source(91)}','source_event_type','follow_up_registered','owner_id','${actor.owner}','lead_id','${lead(2)}'));
    `);
    psql(database, pairSql(task(1), actor.owner, "first_contact", lead(1), source(1)));
    psql(database, pairSql(task(2), actor.owner, "quote_follow_up", source(2), source(3)));
    assert.equal(psql(database, `select count(*) from public.tasks t join public.task_automation_origins o on o.origin_key=t.automation_origin_key and o.task_id=t.id where t.id in ('${task(1)}','${task(2)}') and t.idempotency_key=o.origin_key and t.status='pending' and t.source_event_id is null and t.metadata is null and date_trunc('microseconds',t.due_at)=t.due_at and ((t.task_kind='first_contact' and t.lead_id is not null and t.quote_id is null and t.description='Complete first contact') or (t.task_kind='quote_follow_up' and t.lead_id is null and t.quote_id is not null and t.description='Follow up on quote version'));`), "2");
    assert.throws(() => psql(database, `insert into public.tasks(owner_id,lead_id,description,due_at,idempotency_key,task_kind) values ('${actor.owner}','${lead(1)}','Wrong','2026-09-21Z',repeat('1',64),'first_contact');`), /TASK_INVALID_ARGUMENT/);
    assert.throws(() => psql(database, `insert into public.tasks(owner_id,lead_id,description,due_at,idempotency_key,task_kind) values ('${actor.owner}','${lead(1)}','Follow up with lead','2026-09-21Z',repeat('7',64),'follow_up');`), /TASK_INVALID_ARGUMENT/);
    for (const [opportunityId, occupiedTask] of [[source(11),task(90)],[source(12),task(91)]]) {
      const adoptionKey = originKey("first_contact", opportunityId);
      assert.throws(() => psql(database, `begin; insert into public.task_automation_origins(origin_key,task_kind,source_kind,operation,opportunity_id,anchor_at,due_rule_version,task_id) values ('${adoptionKey}','first_contact','opportunity_assignment','generate','${opportunityId}','2026-09-21Z','mx-calendar.v1','${occupiedTask}'); commit;`), /TASK_AUTOMATION_PARITY_INVALID/);
    }

    const raceKey = originKey("first_contact", lead(2));
    const race = await Promise.allSettled([psqlAsync(database, pairSql(task(3), actor.owner, "first_contact", lead(2), source(4))), psqlAsync(database, pairSql(task(4), actor.owner, "first_contact", lead(2), source(4)))]);
    assert.deepEqual(race.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
    assert.equal(psql(database, `select count(*) from public.task_automation_origins where origin_key='${raceKey}' and task_id is not null;`), "1");
    assert.throws(() => psql(database, `update public.task_automation_origins set due_rule_version='v2' where origin_key='${raceKey}';`), /TASK_AUTOMATION_ORIGIN_IMMUTABLE/);
    assert.throws(() => psql(database, `delete from public.task_automation_origins where origin_key='${raceKey}';`), /TASK_AUTOMATION_ORIGIN_IMMUTABLE/);

    assert.equal(psql(database, `${actorSession(actor.owner)} select count(*) from public.task_automation_origins;`).split(/\r?\n/).at(-1), "3");
    assert.equal(psql(database, `${actorSession(actor.manager)} select count(*) from public.task_automation_origins;`).split(/\r?\n/).at(-1), "3");
    assert.equal(psql(database, `${actorSession(actor.admin)} select count(*) from public.task_automation_origins;`).split(/\r?\n/).at(-1), "3");
    assert.equal(psql(database, `${actorSession(actor.outsider)} select count(*) from public.task_automation_origins;`).split(/\r?\n/).at(-1), "0");
    assert.throws(() => psql(database, `${actorSession(actor.owner)} insert into public.task_automation_origins(origin_key,task_kind,source_kind,operation,opportunity_id,anchor_at,due_rule_version) values (repeat('a',64),'first_contact','opportunity_assignment','generate','${lead(1)}',now(),'v1');`), /permission denied/i);
    psql(database, `delete from public.leads where id='${lead(1)}';`);
    assert.equal(psql(database, `select (select lead_id is null from public.tasks where id='${task(1)}') and (select opportunity_id='${lead(1)}' from public.task_automation_origins where task_id='${task(1)}');`), "t");
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
