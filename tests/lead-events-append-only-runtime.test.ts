import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migrationPath = "db/migrations/0072_lead_events_append_only.sql";
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const admin = "11111111-1111-4111-8111-111111111111";
const advisor = "22222222-2222-4222-8222-222222222222";
const operations = "33333333-3333-4333-8333-333333333333";
const marketing = "44444444-4444-4444-8444-444444444444";
const lead = "55555555-5555-4555-8555-555555555555";
const otherLead = "66666666-6666-4666-8666-666666666666";
const purgeLead = "77777777-7777-4777-8777-777777777777";
const event = "88888888-8888-4888-8888-888888888888";
const advisorEvent = "99999999-9999-4999-8999-999999999999";

function runAs(actor: string, sql: string) {
  return psql("lead_events_append_only", `${actorSession(actor)} ${sql}`).split("\n").at(-1) ?? "";
}

test("0072 replaces only the ordinary lead-event write policy with exact INSERT authorization", () => {
  const body = readFileSync(migrationPath, "utf8");
  const executable = body.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
  assert.match(body, /drop policy if exists "lead events write scoped" on public\.lead_events/i);
  assert.match(body, /create policy "lead events insert scoped" on public\.lead_events\s+for insert to authenticated\s+with check \(public\.is_admin\(\) or public\.is_assigned_lead\(lead_id\)\)/i);
  assert.doesNotMatch(executable, /create policy[\s\S]+for (?:all|update|delete)/i);
  assert.doesNotMatch(executable, /drop policy[^;]+"lead events read scoped"|alter table public\.lead_events/i);
  assert.match(body, /rollback[^\n]+later additive migration/i);
});

test("ordinary staff can select and append but not rewrite history, while privileged test purge survives", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    psql("postgres", "create database lead_events_append_only template quote_base;");
    for (const migration of [
      "0057_quote_rpc_cutover.sql", "0058_fix_legacy_quote_document_link_ambiguity.sql", "0059_quote_registration_intents.sql",
      "0060_quote_pdf_creation_cutover.sql", "0061_manager_capability_foundation.sql", "0062_tasks_foundation.sql",
      "0063_staff_notifications_foundation.sql", "0064_follow_up_task_representation.sql", "0065_follow_up_task_approval_ledger.sql",
      "0066_follow_up_task_apply_receipt_foundation.sql", "0067_follow_up_task_apply_rpc.sql", "0068_follow_up_task_readiness_helpers.sql",
      "0069_follow_up_task_disposition_readiness_rpc.sql", "0070_follow_up_task_future_write_helpers.sql", "0071_follow_up_task_future_write_rpc.sql",
    ]) applyMigration("lead_events_append_only", migration);
    psql("lead_events_append_only", `
      grant usage on schema public,auth to authenticated;
      grant select,insert,update,delete on public.lead_events to authenticated;
      grant select on public.leads to authenticated;
      insert into auth.users(id,email) values ('${admin}','admin@test'),('${advisor}','advisor@test'),('${operations}','operations@test'),('${marketing}','marketing@test');
      insert into public.profiles(id,full_name) values ('${admin}','Admin'),('${advisor}','Advisor'),('${operations}','Operations'),('${marketing}','Marketing');
      insert into public.roles(name) values ('admin'),('asesor'),('operaciones'),('marketing') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select actor.id,roles.id from (values ('${admin}'::uuid,'admin'),('${advisor}','asesor'),('${operations}','operaciones'),('${marketing}','marketing')) actor(id,role) join public.roles on roles.name=actor.role;
      insert into public.contacts(id,first_name,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test','test@example.test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to,is_test_data) values
        ('${lead}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${advisor}',false),
        ('${otherLead}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${admin}',false),
        ('${purgeLead}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${advisor}',true);
      insert into public.lead_events(id,lead_id,actor_id,event_type,payload) values
        ('${event}','${lead}','${advisor}','seed',jsonb_build_object('immutable',true)),
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','${otherLead}','${admin}','seed','{}'),
        ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${purgeLead}','${admin}','manual_lead_created','{}');
    `);
    const unrelatedPolicies = `select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]')::text from pg_policies p where not (schemaname='public' and tablename='lead_events' and policyname in ('lead events write scoped','lead events insert scoped'));`;
    const policiesBefore = psql("lead_events_append_only", unrelatedPolicies);
    applyMigration("lead_events_append_only", "0072_lead_events_append_only.sql");

    assert.equal(psql("lead_events_append_only", unrelatedPolicies), policiesBefore);
    assert.equal(psql("lead_events_append_only", "select count(*) filter(where cmd='SELECT'),count(*) filter(where cmd='INSERT'),count(*) filter(where cmd in ('ALL','UPDATE','DELETE')) from pg_policies where schemaname='public' and tablename='lead_events';"), "1|1|0");
    assert.equal(runAs(admin, "select count(*) from public.lead_events;"), "3");
    assert.equal(runAs(advisor, "select count(*) from public.lead_events;"), "2");
    assert.equal(runAs(operations, "select count(*) from public.lead_events;"), "3");
    assert.equal(runAs(marketing, "select count(*) from public.lead_events;"), "0");

    runAs(advisor, `insert into public.lead_events(id,lead_id,actor_id,event_type) values ('${advisorEvent}','${lead}','${advisor}','advisor_append');`);
    runAs(admin, `insert into public.lead_events(lead_id,actor_id,event_type) values ('${otherLead}','${admin}','admin_append');`);
    for (const actor of [operations, marketing]) assert.throws(() => runAs(actor, `insert into public.lead_events(lead_id,actor_id,event_type) values ('${lead}','${actor}','forbidden');`), /row-level security policy/i);
    assert.equal(runAs(admin, `with changed as (update public.lead_events set payload='{}' where id='${event}' returning 1) select count(*) from changed;`), "0");
    assert.equal(runAs(advisor, `with removed as (delete from public.lead_events where id='${advisorEvent}' returning 1) select count(*) from removed;`), "0");
    assert.equal(psql("lead_events_append_only", `select payload=jsonb_build_object('immutable',true) from public.lead_events where id='${event}';`), "t");

    assert.equal(psql("lead_events_append_only", `set role postgres; with purged as (delete from public.lead_events where lead_id='${purgeLead}' returning id) select count(*) from purged;`), "1");
    assert.equal(psql("lead_events_append_only", `select exists(select 1 from public.leads where id='${purgeLead}' and is_test_data) and not exists(select 1 from public.lead_events where lead_id='${purgeLead}');`), "t");
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
