import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0076_crm_contact_opportunity_follow_up_task_read.sql";
const migrationPath = `db/migrations/${migration}`;
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const actors = { admin: "11111111-1111-4111-8111-111111111111", advisor: "12121212-1212-4121-8121-121212121212", manager: "13131313-1313-4131-8131-131313131313" };
const contact = "22222222-2222-4222-8222-222222222222";
const leads = ["33333333-3333-4333-8333-333333333333", "34343434-3434-4343-8343-343434343434", "35353535-3535-4353-8353-353535353535", "36363636-3636-4363-8363-363636363636"];

test("0076 replaces only the 0052 opportunity follow-up aliases with Tasks", () => {
  const body = readFileSync(migrationPath, "utf8");
  const executable = body.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
  const taskBlock = body.match(/follow_up_task_ranked as \(([\s\S]*?)\), earliest_follow_up_task as \(/i)?.[1] ?? "";
  const historyBlock = body.match(/follow_up_history_ranked as \(([\s\S]*?)\), latest_follow_up_history as \(/i)?.[1] ?? "";
  assert.match(body, /create or replace function public\.crm_contact_opportunity_page\([\s\S]+p_limit integer default 20[\s\S]+p_after_id uuid default null/i);
  assert.doesNotMatch(body, /crm_contact_360_summary/i);
  assert.match(taskBlock, /from public\.tasks t join page_rows pr on pr\.id\s*=\s*t\.lead_id/i);
  assert.match(taskBlock, /t\.task_kind\s*=\s*'follow_up'[\s\S]+t\.status in \('pending',\s*'in_progress'\)[\s\S]+t\.lead_id is not null[\s\S]+pr\.deleted_at is null[\s\S]+pr\.archived_at is null/i);
  assert.match(taskBlock, /row_number\(\) over \(partition by t\.lead_id order by t\.due_at,\s*t\.id\)[\s\S]+bool_or\(t\.due_at < now\(\)\) over/i);
  assert.match(historyBlock, /row_number\(\) over \(partition by e\.lead_id order by e\.created_at desc,\s*e\.id desc\)/i);
  assert.match(historyBlock, /from public\.lead_events e join page_rows pr on pr\.id\s*=\s*e\.lead_id[\s\S]+e\.event_type\s*=\s*'follow_up_registered'/i);
  assert.doesNotMatch(historyBlock, /payload|followUpAt/);
  assert.match(body, /language plpgsql stable security invoker set search_path\s*=\s*''/i);
  assert.match(body, /revoke all on function public\.crm_contact_opportunity_page\([^)]+\) from public, anon, service_role;[\s\S]+grant execute on function public\.crm_contact_opportunity_page\([^)]+\) to authenticated;/i);
  assert.doesNotMatch(executable, /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|truncate)\b/i);
});

test("opportunity pages use RLS-visible active Tasks while preserving the exact 0052 page contract", { skip: !enabled, timeout: 240_000 }, async () => {
  readFileSync(migrationPath, "utf8");
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", "create database contact_opportunity_task_read template quote_base;");
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 75)) applyMigration("contact_opportunity_task_read", name);
    const contract = `select jsonb_build_array(pg_get_function_identity_arguments(p.oid),pg_get_function_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.provolatile,p.prosecdef,p.proconfig,p.proacl)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname='crm_contact_opportunity_page';`;
    const contract0052 = psql("contact_opportunity_task_read", contract);
    psql("contact_opportunity_task_read", `
      grant select on all tables in schema public to authenticated;
      insert into auth.users(id,email) values ('${actors.admin}','admin@test'),('${actors.advisor}','advisor@test'),('${actors.manager}','manager@test');
      insert into public.profiles(id,full_name) values ('${actors.admin}','Admin'),('${actors.advisor}','Advisor'),('${actors.manager}','Manager');
      insert into public.roles(name) values ('admin'),('asesor'),('manager'),('operaciones') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select actor.id,roles.id from (values ('${actors.admin}'::uuid,'admin'),('${actors.advisor}','asesor'),('${actors.manager}','manager'),('${actors.manager}','operaciones')) actor(id,role) join public.roles on roles.name=actor.role;
      insert into public.contacts(id,first_name,last_name,email) values ('${contact}','Opportunity','Preserved','opportunity@test');
      insert into public.lead_statuses(id,name,label_es,label_en,is_terminal) values ('44444444-4444-4444-8444-444444444444','open','Open','Open',false);
      insert into public.leads(id,contact_id,status_id,assigned_to,summary,priority,budget_mxn,archived_at,deleted_at,created_at,updated_at) values
        ('${leads[0]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}','Task aliases','high',123,null,null,'2020-01-01Z','2025-04-04Z'),
        ('${leads[1]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}','Terminal Tasks','normal',456,null,null,'2020-01-02Z','2025-03-03Z'),
        ('${leads[2]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}','Archived','low',789,'2025-01-01Z',null,'2020-01-03Z','2025-02-02Z'),
        ('${leads[3]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}','Deleted','urgent',999,null,'2025-01-01Z','2020-01-04Z','2025-01-01Z');
      insert into public.lead_events(id,lead_id,actor_id,event_type,payload,created_at) values
        ('45000000-0000-4000-8000-000000000001','${leads[0]}','${actors.advisor}','follow_up_registered','{"followUpAt":"2098-01-01T00:00:00Z"}','2023-01-01Z'),
        ('45000000-0000-4000-8000-000000000002','${leads[0]}','${actors.advisor}','follow_up_registered','{"followUpAt":"1990-01-01T00:00:00Z"}','2024-01-01Z'),
        ('45000000-0000-4000-8000-000000000003','${leads[1]}','${actors.advisor}','follow_up_registered','{"followUpAt":"1991-01-01T00:00:00Z"}','2022-01-01Z'),
        ('45000000-0000-4000-8000-000000000004','${leads[2]}','${actors.advisor}','follow_up_registered','{"followUpAt":"1992-01-01T00:00:00Z"}','2021-01-01Z'),
        ('45000000-0000-4000-8000-000000000005','${leads[3]}','${actors.advisor}','follow_up_registered','{"followUpAt":"1993-01-01T00:00:00Z"}','2020-01-01Z');
      alter table public.tasks disable trigger validate_task_representation_insert;
      insert into public.tasks(id,owner_id,lead_id,description,due_at,status,idempotency_key,task_kind) values
        ('50000000-0000-4000-8000-000000000001','${actors.advisor}','${leads[0]}','Advisor earliest','2098-01-01Z','pending',repeat('1',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000002','${actors.advisor}','${leads[0]}','Advisor future','2099-01-01Z','in_progress',repeat('2',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000003','${actors.admin}','${leads[0]}','Admin earliest','2000-01-01Z','pending',repeat('3',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000004','${actors.advisor}','${leads[0]}','Completed','1999-01-01Z','completed',repeat('4',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000005','${actors.advisor}','${leads[0]}','Canceled','1998-01-01Z','canceled',repeat('5',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000006','${actors.advisor}','${leads[0]}','Manual','1997-01-01Z','pending',repeat('6',64),'manual'),
        ('50000000-0000-4000-8000-000000000007','${actors.advisor}','${leads[1]}','Terminal only','1996-01-01Z','completed',repeat('7',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000008','${actors.advisor}','${leads[2]}','Archived lead','1995-01-01Z','pending',repeat('8',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000009','${actors.advisor}','${leads[3]}','Deleted lead','1994-01-01Z','pending',repeat('9',64),'follow_up');
      alter table public.tasks enable trigger validate_task_representation_insert;
      create function public.capture_opportunity_error(cid uuid,state text,lim integer,after_at timestamptz,after_id uuid) returns text language plpgsql security invoker set search_path='' as $capture$ begin perform * from public.crm_contact_opportunity_page(cid,state,lim,after_at,after_id); return 'ok'; exception when others then return sqlstate||'|'||sqlerrm; end $capture$;
      grant execute on function public.capture_opportunity_error(uuid,text,integer,timestamptz,uuid) to authenticated;
    `);
    const runAs = (actor: string, sql: string) => psql("contact_opportunity_task_read", `${actorSession(actor)} ${sql}`).split("\n").at(-1) ?? "";
    const validation = `select jsonb_build_array(capture_opportunity_error(null,'active',20,null,null),capture_opportunity_error('${contact}',null,20,null,null),capture_opportunity_error('${contact}','wrong',20,null,null),capture_opportunity_error('${contact}','active',null,null,null),capture_opportunity_error('${contact}','active',0,null,null),capture_opportunity_error('${contact}','active',101,null,null),capture_opportunity_error('${contact}','active',20,'2025-01-01Z',null),capture_opportunity_error('${contact}','active',20,null,'${leads[0]}'))::text;`;
    const validation0052 = runAs(actors.admin, validation);
    assert.equal(validation0052, `["22023|p_contact_id is required", "22023|p_state must be active, archived, deleted, or all", "22023|p_state must be active, archived, deleted, or all", "22023|p_limit must be between 1 and 100", "22023|p_limit must be between 1 and 100", "22023|p_limit must be between 1 and 100", "22023|both cursor fields must be provided together", "22023|both cursor fields must be provided together"]`);
    const comparable = (call: string) => runAs(actors.admin, `select coalesce(jsonb_agg(to_jsonb(o)-array['latest_follow_up_at','latest_follow_up_created_at','follow_up_overdue']), '[]'::jsonb)::text from public.${call} o;`);
    const calls = [`crm_contact_opportunity_page('${contact}','active',100,null,null)`, `crm_contact_opportunity_page('${contact}','archived',20,null,null)`, `crm_contact_opportunity_page('${contact}','deleted',20,null,null)`, `crm_contact_opportunity_page('${contact}','all',20,null,null)`, `crm_contact_opportunity_page('${contact}','active',1,null,null)`, `crm_contact_opportunity_page('${contact}','active',1,'2025-04-04Z','${leads[0]}')`];
    const preserved0052 = calls.map(comparable);
    assert.equal(runAs(actors.admin, `select string_agg(opportunity_id::text,',') from public.crm_contact_opportunity_page('${contact}','all');`), leads.join(","));
    assert.equal(runAs(actors.admin, `select count(*)||'|'||bool_and(page_has_more) from public.crm_contact_opportunity_page('${contact}','active',1);`), "1|true");
    const snapshot = `select md5((select jsonb_agg(to_jsonb(c) order by id)::text from public.contacts c)||(select jsonb_agg(to_jsonb(l) order by id)::text from public.leads l)||(select jsonb_agg(to_jsonb(t) order by id)::text from public.tasks t)||(select jsonb_agg(to_jsonb(e) order by id)::text from public.lead_events e));`;
    const before = psql("contact_opportunity_task_read", snapshot);
    applyMigration("contact_opportunity_task_read", migration);
    assert.equal(psql("contact_opportunity_task_read", contract), contract0052);
    assert.equal(psql("contact_opportunity_task_read", `select has_function_privilege('authenticated',p.oid,'execute')||'|'||has_function_privilege('anon',p.oid,'execute')||'|'||has_function_privilege('service_role',p.oid,'execute')||'|'||p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='crm_contact_opportunity_page';`), "true|false|false|false");
    assert.equal(runAs(actors.admin, validation), validation0052);
    assert.deepEqual(calls.map(comparable), preserved0052);
    const aliases = (actor: string, state: string, lead: string) => runAs(actor, `select coalesce(to_char(latest_follow_up_at at time zone 'UTC','YYYY-MM-DD'),'null')||'|'||coalesce(to_char(latest_follow_up_created_at at time zone 'UTC','YYYY-MM-DD'),'null')||'|'||follow_up_overdue from public.crm_contact_opportunity_page('${contact}','${state}') where opportunity_id='${lead}';`);
    assert.equal(aliases(actors.admin, "active", leads[0]), "2000-01-01|2024-01-01|true");
    assert.equal(aliases(actors.advisor, "active", leads[0]), "2098-01-01|2024-01-01|false");
    assert.equal(aliases(actors.manager, "active", leads[0]), "2098-01-01|2024-01-01|false");
    assert.equal(aliases(actors.admin, "active", leads[1]), "null|2022-01-01|false");
    assert.equal(aliases(actors.admin, "archived", leads[2]), "null|2021-01-01|false");
    assert.equal(aliases(actors.admin, "deleted", leads[3]), "null|2020-01-01|false");
    assert.equal(psql("contact_opportunity_task_read", snapshot), before);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
