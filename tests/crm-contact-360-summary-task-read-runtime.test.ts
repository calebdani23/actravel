import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0075_crm_contact_360_summary_follow_up_task_read.sql";
const migrationPath = `db/migrations/${migration}`;
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const actors = { admin: "11111111-1111-4111-8111-111111111111", advisor: "12121212-1212-4121-8121-121212121212", manager: "13131313-1313-4131-8131-131313131313" };
const contact = "22222222-2222-4222-8222-222222222222";
const leads = ["33333333-3333-4333-8333-333333333333", "34343434-3434-4343-8343-343434343434", "35353535-3535-4353-8353-353535353535"];

test("0075 replaces only the 0052 summary follow-up projection with Tasks", () => {
  const body = readFileSync(migrationPath, "utf8");
  const executable = body.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
  assert.match(body, /create or replace function public\.crm_contact_360_summary\(p_contact_id uuid\)/i);
  assert.doesNotMatch(body, /crm_contact_opportunity_page/i);
  assert.match(body, /from public\.tasks t join public\.leads l on l\.id\s*=\s*t\.lead_id/i);
  assert.match(body, /t\.task_kind\s*=\s*'follow_up'[\s\S]+t\.status in \('pending',\s*'in_progress'\)[\s\S]+t\.lead_id is not null[\s\S]+l\.deleted_at is null[\s\S]+l\.archived_at is null/i);
  assert.match(body, /count\(\*\) filter \(where t\.due_at < now\(\)\)::bigint[\s\S]+min\(t\.due_at\)/i);
  assert.match(body, /from public\.lead_events e[\s\S]+max\(ac\.activity_at\)/i);
  assert.match(body, /language sql[\s\S]+stable[\s\S]+security invoker[\s\S]+set search_path\s*=\s*''/i);
  assert.doesNotMatch(executable, /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|truncate)\b/i);
});

test("summary counts only RLS-visible active follow-up Tasks and preserves history", { skip: !enabled, timeout: 240_000 }, async () => {
  readFileSync(migrationPath, "utf8");
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", "create database contact_360_task_read template quote_base;");
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 74)) applyMigration("contact_360_task_read", name);
    const contract = `select jsonb_build_array(pg_get_function_identity_arguments(p.oid),pg_get_function_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.provolatile,p.prosecdef,p.proconfig,p.proacl)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname='crm_contact_360_summary';`;
    const contract0052 = psql("contact_360_task_read", contract);
    const nullBehavior0052 = psql("contact_360_task_read", "select count(*) from public.crm_contact_360_summary(null);");
    psql("contact_360_task_read", `
      grant select on all tables in schema public to authenticated;
      insert into auth.users(id,email) values ('${actors.admin}','admin@test'),('${actors.advisor}','advisor@test'),('${actors.manager}','manager@test');
      insert into public.profiles(id,full_name) values ('${actors.admin}','Admin'),('${actors.advisor}','Advisor'),('${actors.manager}','Manager');
      insert into public.roles(name) values ('admin'),('asesor'),('manager'),('operaciones') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select actor.id,roles.id from (values ('${actors.admin}'::uuid,'admin'),('${actors.advisor}','asesor'),('${actors.manager}','manager'),('${actors.manager}','operaciones')) actor(id,role) join public.roles on roles.name=actor.role;
      insert into public.contacts(id,first_name,last_name,email,updated_at) values ('${contact}','Summary','Preserved','summary@test','2020-01-01Z');
      insert into public.lead_statuses(id,name,label_es,label_en,is_terminal) values ('44444444-4444-4444-8444-444444444444','open','Open','Open',false);
      insert into public.leads(id,contact_id,status_id,assigned_to,budget_mxn,archived_at,deleted_at,updated_at) values
        ('${leads[0]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}',123,null,null,'2021-01-01Z'),
        ('${leads[1]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}',456,'2022-01-01Z',null,'2021-01-01Z'),
        ('${leads[2]}','${contact}','44444444-4444-4444-8444-444444444444','${actors.advisor}',789,null,'2022-01-01Z','2021-01-01Z');
      insert into public.lead_events(id,lead_id,actor_id,event_type,payload,created_at) values ('45454545-4545-4454-8454-454545454545','${leads[0]}','${actors.advisor}','follow_up_registered','{"followUpAt":"1990-01-01T00:00:00Z"}','2024-01-01Z');
      alter table public.tasks disable trigger validate_task_representation_insert;
      insert into public.tasks(id,owner_id,lead_id,description,due_at,status,idempotency_key,task_kind) values
        ('50000000-0000-4000-8000-000000000001','${actors.advisor}','${leads[0]}','Owner overdue','2001-01-01Z','pending',repeat('1',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000002','${actors.advisor}','${leads[0]}','Owner future','2099-01-01Z','in_progress',repeat('2',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000003','${actors.admin}','${leads[0]}','Admin overdue','2000-01-01Z','pending',repeat('3',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000004','${actors.advisor}','${leads[0]}','Completed','1999-01-01Z','completed',repeat('4',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000005','${actors.advisor}','${leads[0]}','Manual','1998-01-01Z','pending',repeat('5',64),'manual'),
        ('50000000-0000-4000-8000-000000000006','${actors.advisor}','${leads[1]}','Archived lead','1997-01-01Z','pending',repeat('6',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000007','${actors.advisor}','${leads[2]}','Deleted lead','1996-01-01Z','pending',repeat('7',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000008','${actors.advisor}','${leads[0]}','Canceled','1995-01-01Z','canceled',repeat('8',64),'follow_up');
      alter table public.tasks enable trigger validate_task_representation_insert;
    `);
    const snapshot = `select md5((select jsonb_agg(to_jsonb(c) order by id)::text from public.contacts c)||(select jsonb_agg(to_jsonb(l) order by id)::text from public.leads l)||(select jsonb_agg(to_jsonb(t) order by id)::text from public.tasks t)||(select jsonb_agg(to_jsonb(e) order by id)::text from public.lead_events e));`;
    const before = psql("contact_360_task_read", snapshot);
    const nonFollow = `select (to_jsonb(s)-array['overdue_follow_up_count','next_follow_up_at'])::text from public.crm_contact_360_summary('${contact}') s;`;
    const nonFollow0052 = psql("contact_360_task_read", `${actorSession(actors.admin)} ${nonFollow}`).split("\n").at(-1) ?? "";
    applyMigration("contact_360_task_read", migration);
    assert.equal(psql("contact_360_task_read", contract), contract0052);
    assert.equal(psql("contact_360_task_read", "select count(*) from public.crm_contact_360_summary(null);"), nullBehavior0052);
    assert.equal(psql("contact_360_task_read", `${actorSession(actors.admin)} ${nonFollow}`).split("\n").at(-1) ?? "", nonFollow0052);
    assert.equal(psql("contact_360_task_read", `select has_function_privilege('authenticated',p.oid,'execute')||'|'||has_function_privilege('anon',p.oid,'execute')||'|'||has_function_privilege('service_role',p.oid,'execute')||'|'||p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='crm_contact_360_summary';`), "true|false|false|false");
    const summary = (actor: string) => psql("contact_360_task_read", `${actorSession(actor)} select first_name||'|'||last_name||'|'||open_opportunity_count||'|'||active_opportunity_count||'|'||archived_opportunity_count||'|'||deleted_opportunity_count||'|'||total_opportunity_count||'|'||overdue_follow_up_count||'|'||to_char(next_follow_up_at at time zone 'UTC','YYYY-MM-DD')||'|'||to_char(last_activity_at at time zone 'UTC','YYYY-MM-DD')||'|'||pipeline_mxn from public.crm_contact_360_summary('${contact}');`).split("\n").at(-1) ?? "";
    assert.equal(summary(actors.admin), "Summary|Preserved|1|1|1|1|3|2|2000-01-01|2024-01-01|123.00");
    assert.equal(summary(actors.advisor), "Summary|Preserved|1|1|1|0|2|1|2001-01-01|2024-01-01|123.00");
    assert.equal(summary(actors.manager), "Summary|Preserved|1|1|1|0|2|1|2001-01-01|2024-01-01|123.00");
    assert.equal(psql("contact_360_task_read", snapshot), before);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
