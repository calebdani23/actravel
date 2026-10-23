import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0080_task_automation_sources.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = { admin: id(4, 41), owner: id(4, 42), next: id(4, 43), inactive: id(4, 44) };
const lead = (value: number) => id(5, value + 40);
const source = (value: number) => id(7, value + 40);
const request = (value: number) => id(8, value + 40);
const parse = (value: string) => JSON.parse(value.split(/\r?\n/).at(-1)!);
const completeSql = (requestId: string, taskId: string, outcome: string | null) => `${actorSession(actor.owner)} select public.task_action('${requestId}','${actor.owner}','${taskId}','completed',null,${outcome ? `'${outcome}'` : "null"},null)::text;`;

test("0080 preserves ordered first-contact transfer, invalidation, and exact audited completion", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const foundation = readFileSync("db/migrations/0079_task_automation_foundation.sql", "utf8");
  assert.match(sql, /create trigger first_contact_invalidation_before_generation[\s\S]*after insert or update of assigned_to,archived_at,status_id on public\.leads/i);
  assert.match(sql, /opportunity_assignment[\s\S]*'transfer'[\s\S]*task_automation_project/i);
  assert.match(sql, /opportunity_unassigned[\s\S]*opportunity_archived[\s\S]*opportunity_terminal/i);
  assert.match(sql, /source_invalidated[\s\S]*task_automation_tombstones[\s\S]*task_automation_project/i);
  assert.match(foundation, /p_operation='cancel'[\s\S]*task_action_automation_cancel/i);
  assert.match(sql, /first_contact[\s\S]*completion_outcome[\s\S]*first_contact_completed/i);
  assert.doesNotMatch(sql, /create trigger[^;]+(quotes|whatsapp_inbound_messages|lead_notes)/i);
});

test("first-contact lifecycle transfers active ownership and resolves only through ordered audited terminals", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_source_first_contact_lifecycle";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 80)) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ${Object.entries(actor).map(([name, value]) => `('${value}','${name}@test')`).join(",")};
      insert into public.profiles(id,full_name,is_active) values ('${actor.admin}','Admin',true),('${actor.owner}','Owner',true),('${actor.next}','Next',true),('${actor.inactive}','Inactive',false);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.admin}'::uuid,'admin'),('${actor.owner}'::uuid,'asesor'),('${actor.next}'::uuid,'asesor'),('${actor.inactive}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;
      insert into public.contacts(id,first_name,email) values ('${source(1)}','Lifecycle','lifecycle@test');
      insert into public.lead_statuses(id,name,label_es,label_en,is_terminal) values ('${source(2)}','lifecycle_open','Open','Open',false),('${source(3)}','lifecycle_terminal','Won','Won',true);
      insert into public.leads(id,contact_id,status_id,assigned_to) values
        ('${lead(1)}','${source(1)}','${source(2)}','${actor.owner}'),('${lead(2)}','${source(1)}','${source(2)}','${actor.owner}'),
        ('${lead(3)}','${source(1)}','${source(2)}','${actor.owner}'),('${lead(4)}','${source(1)}','${source(2)}','${actor.owner}'),
        ('${lead(5)}','${source(1)}','${source(2)}','${actor.inactive}'),('${lead(6)}','${source(1)}','${source(2)}','${actor.owner}');
      insert into public.leads(id,contact_id,status_id,assigned_to,archived_at) values ('${lead(7)}','${source(1)}','${source(2)}','${actor.owner}',statement_timestamp());
    `);
    assert.equal(psql(database, `select reason||':'||source_order||':'||(select count(*) from public.tasks where lead_id='${lead(7)}') from public.task_automation_tombstones where source_id='${lead(7)}';`), "source_invalidated:1:0");

    const before = psql(database, `select t.id||'|'||t.due_at||'|'||o.origin_key from public.tasks t join public.task_automation_origins o on o.task_id=t.id where t.lead_id='${lead(1)}';`);
    psql(database, `update public.leads set assigned_to='${actor.next}' where id='${lead(1)}';`);
    assert.equal(psql(database, `select t.id||'|'||t.due_at||'|'||o.origin_key from public.tasks t join public.task_automation_origins o on o.task_id=t.id where t.lead_id='${lead(1)}';`), before);
    assert.equal(psql(database, `select owner_id::text||'|'||string_agg(operation||':'||source_order,',' order by source_order) from public.tasks t join public.task_automation_outcomes o on o.task_id=t.id where t.lead_id='${lead(1)}' group by owner_id;`), `${actor.next}|generate:1,transfer:2`);
    assert.equal(psql(database, `${actorSession(actor.owner)} select count(*) from public.task_automation_origins where opportunity_id='${lead(1)}';`).split(/\r?\n/).at(-1), "0");
    assert.equal(psql(database, `${actorSession(actor.next)} select count(*) from public.task_automation_origins where opportunity_id='${lead(1)}';`).split(/\r?\n/).at(-1), "1");
    assert.equal(psql(database, `${actorSession(actor.next)} select count(*) from public.task_automation_outcomes where task_id in (select id from public.tasks where lead_id='${lead(1)}');`).split(/\r?\n/).at(-1), "2");
    psql(database, `update public.leads set archived_at=statement_timestamp() where id='${lead(1)}'; update public.leads set assigned_to=null where id='${lead(2)}'; update public.leads set status_id='${source(3)}' where id='${lead(3)}';`);
    assert.equal(psql(database, `select string_agg(source_kind||':'||source_order,',' order by source_kind) from public.task_action_receipts where actor_kind='automation' and task_id in (select id from public.tasks where lead_id in ('${lead(1)}','${lead(2)}','${lead(3)}'));`), "opportunity_archived:3,opportunity_terminal:2,opportunity_unassigned:2");
    assert.equal(psql(database, `select count(*) from public.tasks where lead_id in ('${lead(1)}','${lead(2)}','${lead(3)}') and status='canceled';`), "3");
    assert.equal(psql(database, `${actorSession(actor.next)} select count(*) from public.task_action_receipts where task_id in (select id from public.tasks where lead_id='${lead(1)}');`).split(/\r?\n/).at(-1), "1");

    psql(database, `update public.leads set assigned_to=null where id='${lead(5)}'; update public.leads set assigned_to='${actor.owner}' where id='${lead(5)}';`);
    assert.equal(psql(database, `select reason||':'||source_order from public.task_automation_tombstones where source_id='${lead(5)}';`), "source_invalidated:2");
    assert.equal(psql(database, `select count(*) from public.tasks where lead_id='${lead(5)}';`), "0");

    const completionTask = psql(database, `select id from public.tasks where lead_id='${lead(4)}';`);
    psql(database, `insert into public.lead_notes(lead_id,author_id,body) values ('${lead(4)}','${actor.owner}','Generic note'); insert into public.lead_events(lead_id,actor_id,event_type,payload) values ('${lead(4)}','${actor.owner}','follow_up_registered','{"followUpAt":"2026-09-30T00:00:00Z"}');`);
    assert.equal(psql(database, `select status||':'||(select count(*) from public.task_action_receipts where task_id='${completionTask}') from public.tasks where id='${completionTask}';`), "pending:0");
    assert.throws(() => psql(database, completeSql(request(1), completionTask, null)), /TASK_FIRST_CONTACT_COMPLETION_REQUIRED/);
    assert.throws(() => psql(database, completeSql(request(2), completionTask, "work_completed")), /TASK_FIRST_CONTACT_COMPLETION_REQUIRED/);
    assert.equal(parse(psql(database, completeSql(request(3), completionTask, "first_contact_completed"))).outcome, "applied");
    assert.equal(psql(database, `select status||':'||completion_outcome from public.tasks t join public.task_action_receipts r on r.task_id=t.id where t.id='${completionTask}';`), "completed:first_contact_completed");

    const raceTask = psql(database, `select id from public.tasks where lead_id='${lead(6)}';`);
    const race = await Promise.all([psqlAsync(database, completeSql(request(4), raceTask, "first_contact_completed")), psqlAsync(database, `update public.leads set archived_at=statement_timestamp() where id='${lead(6)}';`)]);
    const human = parse(race[0]);
    const final = psql(database, `select status from public.tasks where id='${raceTask}';`);
    assert.ok(final === "completed" ? human.outcome === "applied" : final === "canceled" && human.error.code === "TASK_INVALID_TRANSITION");
    assert.equal(psql(database, `select count(*) from public.task_action_receipts where task_id='${raceTask}' and outcome in ('applied','not_applicable_terminal');`), final === "completed" ? "2" : "1");
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
