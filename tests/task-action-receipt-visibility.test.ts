import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
  waitForPostgres,
} from "./helpers/postgres-runtime";

const migration = "0077_task_action_audit_foundation.sql";
const migrationPath = `db/migrations/${migration}`;
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const ids = {
  admin: "11000000-0000-4000-8000-000000000001",
  manager: "11000000-0000-4000-8000-000000000002",
  owner: "11000000-0000-4000-8000-000000000003",
  adminOwner: "11000000-0000-4000-8000-000000000004",
  outsider: "11000000-0000-4000-8000-000000000005",
  inactive: "11000000-0000-4000-8000-000000000006",
  purgedOwner: "11000000-0000-4000-8000-000000000007",
  unknown: "11000000-0000-4000-8000-000000000008",
  ownerReceipt: "12000000-0000-4000-8000-000000000001",
  adminReceipt: "12000000-0000-4000-8000-000000000002",
  purgedReceipt: "12000000-0000-4000-8000-000000000003",
  source: "13000000-0000-4000-8000-000000000001",
  lead: "13000000-0000-4000-8000-000000000002",
  contact: "13000000-0000-4000-8000-000000000003",
  status: "13000000-0000-4000-8000-000000000004",
};

function visibleReceipts(database: string, actorId: string) {
  const output = psql(database, `${actorSession(actorId)}
    select coalesce(jsonb_agg(id::text order by id),'[]'::jsonb)::text from public.task_action_receipts;`);
  return JSON.parse(output.split(/\r?\n/).at(-1)!) as string[];
}

test("0077 grants authenticated SELECT through the owner-snapshot role matrix only", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(
    sql,
    /grant select on table public\.task_action_receipts to authenticated/i,
  );
  assert.match(
    sql,
    /create policy "task action receipts authenticated read scoped"[\s\S]*for select to authenticated[\s\S]*using \(public\.task_actor_can_manage\(owner_id\)\)/i,
  );
  assert.doesNotMatch(
    sql,
    /grant\s+(insert|update|delete|all)\b[\s\S]*task_action_receipts/i,
  );
  assert.doesNotMatch(
    sql,
    /grant select on table public\.task_action_receipts to (public|anon|service_role)/i,
  );
});

test("receipt RLS follows current roles while retained history uses its immutable owner snapshot", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_action_receipt_visibility";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", `create database ${database} template quote_base;`);
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 77);
    assert.equal(migrations.at(-1), migration);
    for (const name of migrations) applyMigration(database, name);

    psql(database, `
      insert into auth.users(id,email) values
        ('${ids.admin}','admin@test'),('${ids.manager}','manager@test'),('${ids.owner}','owner@test'),
        ('${ids.adminOwner}','admin-owner@test'),('${ids.outsider}','outsider@test'),
        ('${ids.inactive}','inactive@test'),('${ids.purgedOwner}','purged@test'),('${ids.unknown}','unknown@test');
      insert into public.profiles(id,full_name,is_active) values
        ('${ids.admin}','Admin',true),('${ids.manager}','Manager',true),('${ids.owner}','Owner',true),
        ('${ids.adminOwner}','Admin owner',true),('${ids.outsider}','Outsider',true),
        ('${ids.inactive}','Inactive',false),('${ids.purgedOwner}','Purged owner',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id)
        select actor.id,role.id from (values
          ('${ids.admin}'::uuid,'admin'),('${ids.manager}'::uuid,'manager'),('${ids.owner}'::uuid,'asesor'),
          ('${ids.adminOwner}'::uuid,'admin'),('${ids.outsider}'::uuid,'asesor'),
          ('${ids.inactive}'::uuid,'asesor'),('${ids.purgedOwner}'::uuid,'asesor')
        ) actor(id,name) join public.roles role on role.name=actor.name;
      insert into public.contacts(id,first_name,email) values ('${ids.contact}','Receipt','receipt@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${ids.status}','receipt_source','Source','Source');
      insert into public.leads(id,contact_id,status_id) values ('${ids.lead}','${ids.contact}','${ids.status}');
      insert into public.lead_events(id,lead_id,event_type) values ('${ids.source}','${ids.lead}','receipt_source');
      insert into public.task_action_receipts(id,request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,outcome)
        values ('${ids.ownerReceipt}','14000000-0000-4000-8000-000000000001',repeat('1',64),repeat('2',64),'15000000-0000-4000-8000-000000000001','human','${ids.owner}','${ids.owner}','start','pending','in_progress','applied');
      insert into public.task_action_receipts(id,request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,outcome)
        values ('${ids.adminReceipt}','14000000-0000-4000-8000-000000000002',repeat('3',64),repeat('4',64),'15000000-0000-4000-8000-000000000002','human','${ids.adminOwner}','${ids.adminOwner}','start','pending','in_progress','applied');
      insert into public.task_action_receipts(id,request_key,request_fingerprint,task_id,actor_kind,owner_id,action,from_status,target_status,cancel_reason,source_kind,source_id,source_key,source_order,outcome)
        values ('${ids.purgedReceipt}',repeat('5',64),repeat('6',64),'15000000-0000-4000-8000-000000000003','automation','${ids.purgedOwner}','cancel','pending','canceled','source_invalidated','opportunity_unassigned','${ids.source}',repeat('7',64),1,'applied');
    `);

    assert.deepEqual(visibleReceipts(database, ids.owner), [ids.ownerReceipt]);
    assert.deepEqual(
      visibleReceipts(database, ids.admin),
      [ids.ownerReceipt, ids.adminReceipt, ids.purgedReceipt],
    );
    assert.deepEqual(
      visibleReceipts(database, ids.manager),
      [ids.ownerReceipt, ids.purgedReceipt],
    );
    assert.deepEqual(
      visibleReceipts(database, ids.adminOwner),
      [ids.ownerReceipt, ids.adminReceipt, ids.purgedReceipt],
    );
    for (const actor of [ids.outsider, ids.inactive, ids.unknown]) assert.deepEqual(visibleReceipts(database, actor), []);

    psql(database, `delete from public.profile_roles where profile_id='${ids.manager}' and role_id=(select id from public.roles where name='manager');`);
    assert.deepEqual(visibleReceipts(database, ids.manager), []);
    psql(database, `insert into public.profile_roles(profile_id,role_id) select '${ids.manager}',id from public.roles where name='manager';`);

    psql(database, `delete from public.lead_events where id='${ids.source}'; delete from public.profiles where id='${ids.purgedOwner}';`);
    assert.equal(psql(database, `select array[(select count(*)=3 from public.task_action_receipts),(select count(*)=0 from public.lead_events where id='${ids.source}'),(select owner_id='${ids.purgedOwner}' and source_id='${ids.source}' from public.task_action_receipts where id='${ids.purgedReceipt}')]::text;`), "{t,t,t}");
    assert.deepEqual(visibleReceipts(database, ids.admin), [ids.ownerReceipt, ids.adminReceipt, ids.purgedReceipt]);
    assert.deepEqual(visibleReceipts(database, ids.manager), [ids.ownerReceipt]);
    assert.deepEqual(visibleReceipts(database, ids.purgedOwner), []);

    assert.equal(
      psql(database, "select array[has_table_privilege('authenticated','public.task_action_receipts','select'),has_table_privilege('authenticated','public.task_action_receipts','insert'),has_table_privilege('authenticated','public.task_action_receipts','update'),has_table_privilege('authenticated','public.task_action_receipts','delete'),has_table_privilege('anon','public.task_action_receipts','select'),has_table_privilege('service_role','public.task_action_receipts','select')]::text;"),
      "{t,f,f,f,f,f}",
    );
    assert.throws(() => psql(database, "set role anon; select count(*) from public.task_action_receipts;"), /permission denied/i);
    assert.throws(() => psql(database, "set role service_role; select count(*) from public.task_action_receipts;"), /permission denied/i);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
