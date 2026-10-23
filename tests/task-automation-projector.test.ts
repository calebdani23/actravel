import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0079_task_automation_foundation.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = { admin: id(4, 11), manager: id(4, 12), owner: id(4, 13), next: id(4, 14), outsider: id(4, 15), inactive: id(4, 16), invalid: id(4, 17), unknown: id(4, 18) };
const lead = (value: number) => id(5, value + 20);
const task = (value: number) => id(6, value + 20);
const source = (value: number) => id(7, value + 20);
const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const originKey = (opportunityId: string) => hash(["task-automation:v1", "first_contact", opportunityId]);
const sourceKey = (value: number) => hash(["task-automation-source.test", value]);

type Projection = {
  sourceKind: string; sourceId: string; sourceKey: string; sourceOrder: number; operation: string; originKey: string;
  taskKind?: string; ownerId?: string; opportunityId?: string; quoteId?: string; quoteVersionId?: string; sentEventId?: string;
  anchorAt?: string; dueAt?: string; dueRuleVersion?: string;
};
const literal = (value?: string) => value === undefined ? "null" : `'${value}'`;
function projectSql(value: Projection) {
  return `select result.outcome||':'||coalesce(result.reason,'') from public.task_automation_project(
    '${value.sourceKind}','${value.sourceId}','${value.sourceKey}',${value.sourceOrder},'${value.operation}','${value.originKey}',
    ${literal(value.taskKind)},${literal(value.ownerId)},${literal(value.opportunityId)},${literal(value.quoteId)},${literal(value.quoteVersionId)},${literal(value.sentEventId)},
    ${literal(value.anchorAt)},${literal(value.dueAt)},${literal(value.dueRuleVersion)}) result;`;
}
function generation(value: number, opportunityId: string, ownerId?: string): Projection {
  return { sourceKind: "opportunity_assignment", sourceId: source(value), sourceKey: sourceKey(value), sourceOrder: value, operation: "generate", originKey: originKey(opportunityId), taskKind: "first_contact", ownerId, opportunityId, anchorAt: "2026-09-21 15:00:00.123456+00", dueAt: "2026-09-21 15:15:00.123456+00", dueRuleVersion: "mx-calendar.v1" };
}

test("0079 defines the exact immutable outcome matrix and private projector only", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const types = readFileSync("lib/supabase/database.types.ts", "utf8");
  assert.match(sql, /create table public\.task_automation_outcomes/i);
  assert.match(sql, /'task-automation-outcome\.v1'[\s\S]*source_kind[\s\S]*source_id::text[\s\S]*source_key[\s\S]*operation[\s\S]*origin_key/i);
  for (const rule of ["opportunity_assignment.*generate.*transfer", "opportunity_(unassigned|archived|terminal).*cancel.*suppress", "quote_sent.*generate", "quote_version_response.*quote_accepted.*quote_rejected.*quote_expired.*quote_cancelled.*quote_superseded.*whatsapp_inbound.*payment_verified.*cancel.*suppress"]) assert.match(sql, new RegExp(rule, "is"));
  assert.match(sql, /force row level security[\s\S]*prevent_task_automation_outcome_change[\s\S]*revoke all/i);
  assert.match(types, /task_automation_outcomes: \{[\s\S]*outcome_key: string[\s\S]*source_order: number[\s\S]*task_id: string \| null/);
  assert.doesNotMatch(sql, /task_automation_tombstones|create trigger[^;]+task_automation_project/i);
});

test("projector records unresolved facts without adoption and converges atomically", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_projector";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ${Object.entries(actor).filter(([name]) => name !== "unknown").map(([name, value]) => `('${value}','${name}@test')`).join(",")};
      insert into public.profiles(id,full_name,is_active) values ('${actor.admin}','Admin',true),('${actor.manager}','Manager',true),('${actor.owner}','Owner',true),('${actor.next}','Next',true),('${actor.outsider}','Outsider',true),('${actor.inactive}','Inactive',false),('${actor.invalid}','Invalid',true);
      insert into public.roles(name,description) values ('admin','Admin'),('manager','Manager'),('asesor','Advisor'),('operaciones','Operations') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.admin}'::uuid,'admin'),('${actor.manager}'::uuid,'manager'),('${actor.owner}'::uuid,'asesor'),('${actor.next}'::uuid,'asesor'),('${actor.outsider}'::uuid,'asesor'),('${actor.inactive}'::uuid,'asesor'),('${actor.invalid}'::uuid,'operaciones')) value(id,name) join public.roles role on role.name=value.name;
      insert into public.contacts(id,first_name,email) values ('${source(80)}','Projector','projector@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${source(81)}','projector_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to,is_test_data) select value,'${source(80)}','${source(81)}','${actor.owner}',true from unnest(array[${Array.from({ length: 8 }, (_, index) => `'${lead(index + 1)}'::uuid`).join(",")}]) value;
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${source(90)}','${source(80)}','${lead(1)}','Projector quote','${actor.owner}','${actor.owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${source(91)}','${lead(1)}','${source(80)}',1,'Sent version','MXN','sent','${source(90)}','2026-09-21 15:00:00.123456+00');
    `);

    const main = generation(1, lead(1), actor.owner);
    assert.equal(psql(database, projectSql(main)), "applied:");
    assert.equal(psql(database, projectSql(main)), "applied:");
    assert.equal(psql(database, `select count(*) from public.tasks t join public.task_automation_origins o on o.task_id=t.id join public.task_automation_outcomes x on x.task_id=t.id where o.origin_key='${main.originKey}' and t.owner_id='${actor.owner}' and x.outcome_key='${hash(["task-automation-outcome.v1",main.sourceKind,main.sourceId,main.sourceKey,main.operation,main.originKey])}';`), "1");

    const raced = generation(2, lead(2), actor.owner);
    const race = await Promise.allSettled([psqlAsync(database, projectSql(raced)), psqlAsync(database, projectSql(raced))]);
    assert.deepEqual(race.map((result) => result.status), ["fulfilled", "fulfilled"]);
    assert.equal(psql(database, `select (select count(*)::text from public.task_automation_origins where origin_key='${raced.originKey}')||(select count(*)::text from public.task_automation_outcomes where origin_key='${raced.originKey}');`), "11");
    const rolledBack = generation(14, lead(4), actor.owner);
    assert.throws(() => psql(database, `begin; ${projectSql(rolledBack)} select 1/0; commit;`), /division by zero/);
    assert.equal(psql(database, `select (select count(*)::text from public.tasks where automation_origin_key='${rolledBack.originKey}')||(select count(*)::text from public.task_automation_origins where origin_key='${rolledBack.originKey}')||(select count(*)::text from public.task_automation_outcomes where outcome_key='${hash(["task-automation-outcome.v1",rolledBack.sourceKind,rolledBack.sourceId,rolledBack.sourceKey,rolledBack.operation,rolledBack.originKey])}');`), "000");

    const invalidOwners: Array<[number, string | undefined, string]> = [[3,undefined,"owner_unassigned"],[4,actor.unknown,"owner_unknown"],[5,actor.inactive,"owner_inactive"],[6,actor.invalid,"owner_role_invalid"]];
    for (const [value, ownerId, reason] of invalidOwners) assert.equal(psql(database, projectSql(generation(value, lead(value), ownerId))), `unresolved:${reason}`);
    assert.equal(psql(database, projectSql(generation(7, source(99), actor.owner))), "unresolved:source_ambiguous");

    const occupied = generation(8, lead(8), actor.owner);
    psql(database, `insert into public.tasks(id,owner_id,lead_id,description,due_at,idempotency_key) values ('${task(8)}','${actor.owner}','${lead(8)}','Manual occupancy','2026-09-21Z','${occupied.originKey}');`);
    assert.equal(psql(database, projectSql(occupied)), "unresolved:identity_occupied");
    assert.equal(psql(database, `select count(*) from public.tasks where id='${task(8)}' and task_kind='manual' and automation_origin_key is null;`), "1");

    const resolved = generation(9, lead(3), actor.owner);
    assert.equal(psql(database, projectSql(resolved)), "applied:");
    const sentEvent = source(92), quoteOrigin = hash(["task-automation:v1","quote_follow_up",source(91),sentEvent]);
    assert.equal(psql(database, projectSql({ sourceKind: "quote_sent", sourceId: sentEvent, sourceKey: sourceKey(13), sourceOrder: 13, operation: "generate", originKey: quoteOrigin, taskKind: "quote_follow_up", ownerId: actor.owner, quoteId: source(90), quoteVersionId: source(91), sentEventId: sentEvent, anchorAt: "2026-09-21 15:00:00.123456+00", dueAt: "2026-09-23 15:00:00.123456+00", dueRuleVersion: "elapsed-48h.v1" })), "applied:");
    assert.equal(psql(database, `select count(*) from public.tasks where automation_origin_key='${quoteOrigin}' and task_kind='quote_follow_up' and quote_id='${source(90)}';`), "1");
    const transfer = { ...main, sourceId: source(10), sourceKey: sourceKey(10), sourceOrder: 10, operation: "transfer", ownerId: actor.next, taskKind: undefined, opportunityId: undefined, anchorAt: undefined, dueAt: undefined, dueRuleVersion: undefined };
    assert.equal(psql(database, projectSql(transfer)), "applied:");
    const cancel = { ...transfer, sourceKind: "opportunity_archived", sourceId: source(11), sourceKey: sourceKey(11), sourceOrder: 11, operation: "cancel", ownerId: undefined };
    assert.equal(psql(database, projectSql(cancel)), "applied:");
    assert.equal(psql(database, `select (t.owner_id='${actor.next}' and t.status='canceled')::int::text||(select count(*)::text from public.task_action_receipts r where r.task_id=t.id)||(select count(*)::text from public.task_automation_outcomes x where x.task_id=t.id) from public.tasks t where t.automation_origin_key='${main.originKey}';`), "113");
    assert.equal(psql(database, projectSql({ ...cancel, sourceKind: "opportunity_unassigned", sourceId: source(12), sourceKey: sourceKey(12), sourceOrder: 12, operation: "suppress", originKey: originKey(source(12)) })), "applied:");

    assert.throws(() => psql(database, `update public.task_automation_outcomes set source_order=99 where outcome_key='${hash(["task-automation-outcome.v1",main.sourceKind,main.sourceId,main.sourceKey,main.operation,main.originKey])}';`), /TASK_AUTOMATION_OUTCOME_IMMUTABLE/);
    assert.throws(() => psql(database, `delete from public.task_automation_outcomes where origin_key='${main.originKey}';`), /TASK_AUTOMATION_OUTCOME_IMMUTABLE/);
    assert.equal(psql(database, `${actorSession(actor.next)} select count(*) from public.task_automation_outcomes where task_id is not null;`).split(/\r?\n/).at(-1), "3");
    assert.equal(psql(database, `${actorSession(actor.manager)} select count(*) from public.task_automation_outcomes where task_id is not null;`).split(/\r?\n/).at(-1), "6");
    assert.equal(psql(database, `${actorSession(actor.admin)} select count(*) from public.task_automation_outcomes where task_id is null;`).split(/\r?\n/).at(-1), "7");
    assert.equal(psql(database, `${actorSession(actor.outsider)} select count(*) from public.task_automation_outcomes;`).split(/\r?\n/).at(-1), "0");
    assert.throws(() => psql(database, `${actorSession(actor.owner)} insert into public.task_automation_outcomes(outcome_key,source_kind,source_id,source_key,source_order,operation,origin_key,outcome) values (repeat('a',64),'quote_sent','${source(90)}',repeat('b',64),90,'generate',repeat('c',64),'applied');`), /permission denied/i);
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
