import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migrationPath = "db/migrations/0074_crm_contact_aggregate_follow_up_task_read.sql";
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const admin = "11111111-1111-4111-8111-111111111111";
const advisor = "12121212-1212-4121-8121-121212121212";
const contacts = ["22222222-2222-4222-8222-222222222222", "23232323-2323-4232-8232-232323232323", "24242424-2424-4242-8242-242424242424", "25252525-2525-4252-8252-252525252525"];
const leads = ["33333333-3333-4333-8333-333333333333", "34343434-3434-4343-8343-343434343434", "35353535-3535-4353-8353-353535353535", "36363636-3636-4363-8363-363636363636", "37373737-3737-4373-8373-373737373737"];

function definition(sql: string) {
  const start = sql.indexOf("create or replace function public.crm_contact_aggregate_page(");
  const end = sql.indexOf("$$;", start) + 3;
  return sql.slice(start, end).replace(/\), followup_candidates as \([\s\S]*?\), activity_candidates as \(/, "), FOLLOWUP_BLOCK, activity_candidates as (");
}

test("0074 replaces only the 0049 follow-up projection with the active Task predicate", () => {
  const baseline = readFileSync("db/migrations/0049_crm_contact_aggregate_filters.sql", "utf8");
  const body = readFileSync(migrationPath, "utf8");
  const executable = body.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
  const followUp = body.match(/followup_candidates as \(([\s\S]*?)\), followup_rollup as \(([\s\S]*?)\), activity_candidates as \(/i)?.[0] ?? "";

  assert.equal(definition(body), definition(baseline));
  assert.match(followUp, /from public\.tasks t join public\.leads l on l\.id = t\.lead_id/i);
  assert.match(followUp, /t\.task_kind = 'follow_up'[\s\S]+t\.status in \('pending', 'in_progress'\)[\s\S]+t\.lead_id is not null[\s\S]+l\.deleted_at is null and l\.archived_at is null/i);
  assert.match(followUp, /count\(\*\) filter \(where follow_up_at < now\(\)\)::bigint as overdue[\s\S]+min\(follow_up_at\) as next_at/i);
  assert.doesNotMatch(followUp, /lead_events|payload|row_number/);
  assert.match(body, /language sql stable security invoker set search_path=public/i);
  assert.match(body, /revoke all on function public\.crm_contact_aggregate_page\([^)]+\) from public, anon;[\s\S]+grant execute on function public\.crm_contact_aggregate_page\([^)]+\) to authenticated;/i);
  assert.doesNotMatch(executable, /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|truncate)\b/i);
});

test("contact aggregates use RLS-visible Task items while events remain activity history", { skip: !enabled, timeout: 240_000 }, async () => {
  readFileSync(migrationPath, "utf8");
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", "create database contact_task_read template quote_base;");
    for (const migration of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 73)) applyMigration("contact_task_read", migration);
    const contract = `select jsonb_build_array(pg_get_function_identity_arguments(p.oid),pg_get_function_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.provolatile,p.prosecdef,p.proconfig,p.proacl)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname='crm_contact_aggregate_page';`;
    const contract0049 = psql("contact_task_read", contract);
    psql("contact_task_read", `
      grant select on all tables in schema public to authenticated;
      insert into auth.users(id,email) values ('${admin}','admin@test'),('${advisor}','advisor@test');
      insert into public.profiles(id,full_name) values ('${admin}','Admin'),('${advisor}','Advisor');
      insert into public.roles(name) values ('admin'),('asesor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select actor.id,roles.id from (values ('${admin}'::uuid,'admin'),('${advisor}','asesor')) actor(id,role) join public.roles on roles.name=actor.role;
      insert into public.contacts(id,first_name,email,updated_at) values
        ('${contacts[0]}','Aggregate','aggregate@test','2020-01-01Z'),('${contacts[1]}','Needle','needle@test','2020-01-01Z'),
        ('${contacts[2]}','Terminal','terminal@test','2020-01-01Z'),('${contacts[3]}','Excluded','excluded@test','2020-01-01Z');
      insert into public.contacts(first_name,email,updated_at) select 'Filler '||g,'filler'||g||'@test','2000-01-01Z'::timestamptz+g*interval '1 second' from generate_series(1,105) g;
      insert into public.lead_statuses(id,name,label_es,label_en) values ('44444444-4444-4444-8444-444444444444','open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to,archived_at,deleted_at,updated_at) values
        ('${leads[0]}','${contacts[0]}','44444444-4444-4444-8444-444444444444','${advisor}',null,null,'2021-01-01Z'),
        ('${leads[1]}','${contacts[1]}','44444444-4444-4444-8444-444444444444','${advisor}',null,null,'2021-01-01Z'),
        ('${leads[2]}','${contacts[2]}','44444444-4444-4444-8444-444444444444','${advisor}',null,null,'2021-01-01Z'),
        ('${leads[3]}','${contacts[3]}','44444444-4444-4444-8444-444444444444','${advisor}','2022-01-01Z',null,'2021-01-01Z'),
        ('${leads[4]}','${contacts[3]}','44444444-4444-4444-8444-444444444444','${advisor}',null,'2022-01-01Z','2021-01-01Z');
      insert into public.lead_events(id,lead_id,actor_id,event_type,payload,created_at) values ('45454545-4545-4454-8454-454545454545','${leads[1]}','${advisor}','follow_up_registered','{"followUpAt":"1990-01-01T00:00:00Z"}','2024-01-01Z');
      alter table public.tasks disable trigger validate_task_representation_insert;
      insert into public.tasks(id,owner_id,lead_id,description,due_at,status,idempotency_key,task_kind) values
        ('50000000-0000-4000-8000-000000000001','${advisor}','${leads[0]}','Oldest visible','2001-01-01Z','pending',repeat('1',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000002','${advisor}','${leads[0]}','Second overdue','2002-01-01Z','in_progress',repeat('2',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000003','${advisor}','${leads[0]}','Future','2099-01-01Z','pending',repeat('3',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000004','${admin}','${leads[0]}','Admin only','2000-01-01Z','pending',repeat('4',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000005','${advisor}','${leads[0]}','Terminal','1999-01-01Z','completed',repeat('5',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000006','${advisor}','${leads[0]}','Manual','1998-01-01Z','pending',repeat('6',64),'manual'),
        ('50000000-0000-4000-8000-000000000007','${advisor}','${leads[1]}','Task wins','2098-01-01Z','pending',repeat('7',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000008','${advisor}','${leads[2]}','Terminal only','1997-01-01Z','canceled',repeat('8',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000009','${advisor}','${leads[3]}','Archived','1996-01-01Z','pending',repeat('9',64),'follow_up'),
        ('50000000-0000-4000-8000-000000000010','${advisor}','${leads[4]}','Deleted','1995-01-01Z','pending',repeat('a',64),'follow_up');
      alter table public.tasks enable trigger validate_task_representation_insert;
    `);
    const snapshot = `select md5((select jsonb_agg(to_jsonb(c) order by id)::text from public.contacts c)||(select jsonb_agg(to_jsonb(l) order by id)::text from public.leads l)||(select jsonb_agg(to_jsonb(t) order by id)::text from public.tasks t)||(select jsonb_agg(to_jsonb(e) order by id)::text from public.lead_events e));`;
    const before = psql("contact_task_read", snapshot);
    applyMigration("contact_task_read", "0074_crm_contact_aggregate_follow_up_task_read.sql");
    assert.equal(psql("contact_task_read", contract), contract0049);
    assert.equal(psql("contact_task_read", `select has_function_privilege('authenticated',p.oid,'execute')||'|'||has_function_privilege('anon',p.oid,'execute')||'|'||p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='crm_contact_aggregate_page';`), "true|false|false");
    const runAs = (actor: string, sql: string) => psql("contact_task_read", `${actorSession(actor)} ${sql}`).split("\n").at(-1) ?? "";
    const aggregate = (actor: string) => runAs(actor, `select overdue_count||'|'||to_char(next_follow_up_at at time zone 'UTC','YYYY-MM-DD') from public.crm_contact_aggregate_page(p_contact_id=>'${contacts[0]}');`);
    assert.equal(aggregate(admin), "3|2000-01-01");
    assert.equal(aggregate(advisor), "2|2001-01-01");
    assert.equal(runAs(advisor, `select overdue_count||'|'||to_char(next_follow_up_at at time zone 'UTC','YYYY-MM-DD')||'|'||to_char(last_activity_at at time zone 'UTC','YYYY-MM-DD') from public.crm_contact_aggregate_page(p_contact_id=>'${contacts[1]}');`), "0|2098-01-01|2024-01-01");
    assert.equal(runAs(advisor, `select string_agg(contact_id::text,',' order by contact_id) from public.crm_contact_aggregate_page(p_overdue=>true);`), contacts[0]);
    assert.equal(runAs(advisor, `select string_agg(contact_id::text,',' order by contact_id) from public.crm_contact_aggregate_page(p_quick_view=>'follow_up');`), [contacts[0], contacts[1]].join(","));
    assert.equal(runAs(admin, `select contact_id from public.crm_contact_aggregate_page(p_search=>'Needle');`), contacts[1]);
    assert.equal(runAs(admin, `select count(*)||'|'||min(total_count)||'|'||max(total_count) from public.crm_contact_aggregate_page(p_limit=>500);`), "100|109|109");
    assert.equal(runAs(admin, `select contact_id||'|'||total_count from public.crm_contact_aggregate_page(p_limit=>1,p_offset=>1);`), `${contacts[0]}|109`);
    assert.equal(psql("contact_task_read", snapshot), before);
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
