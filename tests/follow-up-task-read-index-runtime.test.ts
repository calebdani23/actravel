import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migrationPath = "db/migrations/0073_follow_up_task_active_read_index.sql";
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const ownerId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const statusId = "33333333-3333-4333-8333-333333333333";
const liveLeadId = "44444444-4444-4444-8444-444444444444";
const archivedLeadId = "55555555-5555-4555-8555-555555555555";
const deletedLeadId = "66666666-6666-4666-8666-666666666666";

test("0073 declares only the active follow-up lead/due/id partial index", () => {
  const body = readFileSync(migrationPath, "utf8");
  const executable = body.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");

  assert.match(body, /create index tasks_active_follow_up_read_idx\s+on public\.tasks \(lead_id, due_at, id\)\s+where task_kind = 'follow_up'\s+and status in \('pending', 'in_progress'\)\s+and lead_id is not null;/i);
  assert.equal((executable.match(/\bcreate index\b/gi) ?? []).length, 1);
  assert.doesNotMatch(executable, /\b(insert|update|delete|alter table|create (?:or replace )?function|create policy|drop policy)\b/i);
  assert.match(body, /rollback[^\n]+later additive migration[^\n]+drop only[^\n]+tasks_active_follow_up_read_idx/i);
});

test("active follow-up reads use the index with live leads, exact ordering, and no mutation", { skip: !enabled, timeout: 240_000 }, async () => {
  readFileSync(migrationPath, "utf8");
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", "create database follow_up_read_index template quote_base;");
    for (const migration of migrationNames().filter((name) => {
      const number = Number(name.slice(0, 4));
      return number >= 57 && number <= 73;
    })) applyMigration("follow_up_read_index", migration);

    psql("follow_up_read_index", `
      insert into auth.users(id,email) values ('${ownerId}','owner@test');
      insert into public.profiles(id,full_name,is_active) values ('${ownerId}','Owner',true);
      insert into public.contacts(id,first_name,email) values ('${contactId}','Test','test@example.test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${statusId}','open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to,archived_at,deleted_at) values
        ('${liveLeadId}','${contactId}','${statusId}','${ownerId}',null,null),
        ('${archivedLeadId}','${contactId}','${statusId}','${ownerId}','2026-09-13T00:00:00Z',null),
        ('${deletedLeadId}','${contactId}','${statusId}','${ownerId}',null,'2026-09-13T00:00:00Z');
      alter table public.tasks disable trigger validate_task_representation_insert;
      insert into public.tasks(id,owner_id,lead_id,description,due_at,status,idempotency_key,task_kind) values
        ('10000000-0000-4000-8000-000000000001','${ownerId}','${liveLeadId}','Overdue','2026-09-14T09:00:00Z','pending',repeat('1',64),'follow_up'),
        ('20000000-0000-4000-8000-000000000002','${ownerId}','${liveLeadId}','Boundary','2026-09-14T10:00:00Z','in_progress',repeat('2',64),'follow_up'),
        ('30000000-0000-4000-8000-000000000003','${ownerId}','${liveLeadId}','Tie','2026-09-14T10:00:00Z','pending',repeat('3',64),'follow_up'),
        ('40000000-0000-4000-8000-000000000004','${ownerId}','${liveLeadId}','Future','2026-09-14T11:00:00Z','pending',repeat('4',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000005','${ownerId}','${liveLeadId}','Completed','2026-09-14T07:00:00Z','completed',repeat('5',64),'follow_up'),
        ('60000000-0000-4000-8000-000000000006','${ownerId}','${liveLeadId}','Canceled','2026-09-14T08:00:00Z','canceled',repeat('6',64),'follow_up'),
        ('70000000-0000-4000-8000-000000000007','${ownerId}','${liveLeadId}','Manual','2026-09-14T06:00:00Z','pending',repeat('7',64),'manual'),
        ('80000000-0000-4000-8000-000000000008','${ownerId}','${archivedLeadId}','Archived','2026-09-14T05:00:00Z','pending',repeat('8',64),'follow_up'),
        ('90000000-0000-4000-8000-000000000009','${ownerId}','${deletedLeadId}','Deleted','2026-09-14T04:00:00Z','in_progress',repeat('9',64),'follow_up'),
        ('a0000000-0000-4000-8000-000000000010','${ownerId}',null,'No lead','2026-09-14T03:00:00Z','pending',repeat('a',64),'follow_up');
      alter table public.tasks enable trigger validate_task_representation_insert;
    `);

    const activeRead = `
      select t.id::text || '|' || (t.due_at < '2026-09-14T10:00:00Z'::timestamptz)::text
      from public.tasks t join public.leads l on l.id=t.lead_id
      where t.task_kind='follow_up' and t.status in ('pending','in_progress') and t.lead_id is not null
        and l.deleted_at is null and l.archived_at is null
      order by t.due_at asc,t.id asc`;
    const expected = [
      "10000000-0000-4000-8000-000000000001|true",
      "20000000-0000-4000-8000-000000000002|false",
      "30000000-0000-4000-8000-000000000003|false",
      "40000000-0000-4000-8000-000000000004|false",
    ].join("\n");
    const snapshot = `select md5((select jsonb_agg(to_jsonb(t) order by id)::text from public.tasks t)||(select jsonb_agg(to_jsonb(l) order by id)::text from public.leads l));`;
    const before = psql("follow_up_read_index", snapshot);

    assert.equal(psql("follow_up_read_index", activeRead), expected);
    const plan = psql("follow_up_read_index", `begin; set local enable_seqscan=off; explain (costs off,format json) ${activeRead.replace("where ", `where t.lead_id='${liveLeadId}' and `)}; rollback;`);
    assert.match(plan, /tasks_active_follow_up_read_idx/);
    assert.doesNotMatch(plan, /"Node Type": "Sort"/);
    assert.match(plan, /"Relation Name": "leads"/);
    assert.equal(psql("follow_up_read_index", snapshot), before);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
