import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0080_task_automation_sources.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = { admin: id(4, 31), owner: id(4, 32), next: id(4, 33), inactive: id(4, 34) };
const lead = (value: number) => id(5, value + 30);
const source = (value: number) => id(7, value + 30);
const originKey = (opportunityId: string) => createHash("sha256").update(JSON.stringify(["task-automation:v1", "first_contact", opportunityId])).digest("hex");

test("0080 preserves first-contact generation, cutoff, and its dedicated source trigger", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const types = readFileSync("lib/supabase/database.types.ts", "utf8");
  assert.match(sql, /create table public\.task_automation_source_cutoffs[\s\S]*source_kind text primary key[\s\S]*cutoff_at timestamptz/i);
  assert.match(sql, /create table public\.task_automation_tombstones[\s\S]*reason text[\s\S]*pre_cutoff[\s\S]*force row level security/i);
  assert.match(sql, /task-automation-tombstone\.v1[\s\S]*TASK_AUTOMATION_TOMBSTONE_IMMUTABLE/i);
  assert.match(sql, /create trigger generate_first_contact_on_assignment[\s\S]*after insert or update of assigned_to on public\.leads/i);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*task_automation_due_at[\s\S]*task_automation_project/i);
  assert.doesNotMatch(sql, /create trigger[^;]+(quotes|whatsapp_inbound_messages)/i);
  assert.match(types, /task_automation_source_cutoffs: \{[\s\S]*Row: \{[\s\S]*cutoff_at: string[\s\S]*source_kind: string/);
  assert.match(types, /task_automation_tombstones: \{[\s\S]*Row: \{[\s\S]*origin_key: string[\s\S]*reason: string[\s\S]*source_order: number[\s\S]*tombstone_key: string/);
});

test("first valid assignment generates once while cutoff, invalid owners, occupancy, and races fail closed", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_source_first_contact_generation";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ${Object.entries(actor).map(([name, value]) => `('${value}','${name}@test')`).join(",")};
      insert into public.profiles(id,full_name,is_active) values ('${actor.admin}','Admin',true),('${actor.owner}','Owner',true),('${actor.next}','Next',true),('${actor.inactive}','Inactive',false);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.admin}'::uuid,'admin'),('${actor.owner}'::uuid,'asesor'),('${actor.next}'::uuid,'asesor'),('${actor.inactive}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;
      insert into public.contacts(id,first_name,email) values ('${source(1)}','Source','source@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${source(2)}','source_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to) values ('${lead(1)}','${source(1)}','${source(2)}','${actor.owner}'),('${lead(2)}','${source(1)}','${source(2)}',null);
    `);
    applyMigration(database, migration);
    assert.equal(psql(database, "select count(*) from public.tasks where task_kind='first_contact';"), "0");
    assert.equal(psql(database, "select count(*) from public.task_automation_tombstones;"), "0");

    psql(database, `insert into public.leads(id,contact_id,status_id,assigned_to,created_at) values ('${lead(6)}','${source(1)}','${source(2)}','${actor.owner}','2026-01-01Z');`);
    assert.equal(psql(database, `select (o.anchor_at>l.created_at and o.anchor_at>=c.cutoff_at)::text from public.task_automation_origins o join public.leads l on l.id=o.opportunity_id cross join public.task_automation_source_cutoffs c where c.source_kind='opportunity_assignment' and o.opportunity_id='${lead(6)}';`), "true");

    psql(database, `update public.leads set assigned_to='${actor.next}' where id='${lead(1)}';`);
    assert.equal(psql(database, `select count(*) from public.task_automation_tombstones where origin_key='${originKey(lead(1))}' and reason='pre_cutoff';`), "1");
    assert.equal(psql(database, `select count(*) from public.tasks where lead_id='${lead(1)}' and task_kind='first_contact';`), "0");

    psql(database, `update public.leads set assigned_to='${actor.owner}' where id='${lead(2)}';`);
    const generated = JSON.parse(psql(database, `select jsonb_build_object('count',count(*),'owner',min(t.owner_id::text),'origin',min(o.origin_key),'anchor',min(o.anchor_at),'due',min(t.due_at),'expectedDue',min(public.task_automation_due_at('first_contact',o.anchor_at,'mx-calendar.v1')))::text from public.tasks t join public.task_automation_origins o on o.task_id=t.id where t.lead_id='${lead(2)}' and t.task_kind='first_contact';`));
    assert.deepEqual(generated, { count: 1, owner: actor.owner, origin: originKey(lead(2)), anchor: generated.anchor, due: generated.expectedDue, expectedDue: generated.expectedDue });

    psql(database, `insert into public.leads(id,contact_id,status_id,assigned_to) values ('${lead(3)}','${source(1)}','${source(2)}','${actor.inactive}');`);
    assert.equal(psql(database, `select outcome||':'||reason||':'||source_order from public.task_automation_outcomes where origin_key='${originKey(lead(3))}';`), "unresolved:owner_inactive:1");
    psql(database, `update public.leads set assigned_to='${actor.next}' where id='${lead(3)}';`);
    assert.equal(psql(database, `select string_agg(outcome||':'||coalesce(reason,'')||':'||source_order,',' order by source_order) from public.task_automation_outcomes where origin_key='${originKey(lead(3))}';`), "unresolved:owner_inactive:1,applied::2");

    psql(database, `insert into public.leads(id,contact_id,status_id) values ('${lead(4)}','${source(1)}','${source(2)}'); insert into public.tasks(owner_id,description,due_at,idempotency_key) values ('${actor.owner}','Occupied','2026-09-21Z','${originKey(lead(4))}'); update public.leads set assigned_to='${actor.owner}' where id='${lead(4)}';`);
    assert.equal(psql(database, `select outcome||':'||reason from public.task_automation_outcomes where origin_key='${originKey(lead(4))}';`), "unresolved:identity_occupied");

    psql(database, `insert into public.leads(id,contact_id,status_id) values ('${lead(5)}','${source(1)}','${source(2)}');`);
    const race = await Promise.allSettled([psqlAsync(database, `update public.leads set assigned_to='${actor.owner}' where id='${lead(5)}';`), psqlAsync(database, `update public.leads set assigned_to='${actor.next}' where id='${lead(5)}';`)]);
    assert.deepEqual(race.map((result) => result.status), ["fulfilled", "fulfilled"]);
    assert.equal(psql(database, `select count(*) from public.tasks where lead_id='${lead(5)}' and task_kind='first_contact';`), "1");
    assert.equal(psql(database, `${actorSession(actor.owner)} select count(*) from public.task_automation_tombstones;`).split(/\r?\n/).at(-1), "0");
    assert.equal(psql(database, `${actorSession(actor.admin)} select count(*) from public.task_automation_tombstones;`).split(/\r?\n/).at(-1), "1");
    assert.throws(() => psql(database, "update public.task_automation_tombstones set reason='source_invalidated';"), /TASK_AUTOMATION_TOMBSTONE_IMMUTABLE/);
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
