import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = id(1, 91), contact = id(2, 91), lead = id(3, 91), status = id(4, 91), quote = id(5, 91), version = id(6, 91), sent = id(7, 91), whatsapp = id(8, 91), request = (n: number) => id(9, 90 + n);

test("S13 preserves the exact cutover and task/action foundation bytes", () => {
  const files = ["0064_follow_up_task_representation.sql", "0068_follow_up_task_readiness_helpers.sql", "0069_follow_up_task_disposition_readiness_rpc.sql", "0070_follow_up_task_future_write_helpers.sql", "0071_follow_up_task_future_write_rpc.sql", "0072_lead_events_append_only.sql", "0073_follow_up_task_active_read_index.sql", "0074_crm_contact_aggregate_follow_up_task_read.sql", "0075_crm_contact_360_summary_follow_up_task_read.sql", "0076_crm_contact_opportunity_follow_up_task_read.sql", "0077_task_action_audit_foundation.sql", "0078_task_action_rpc.sql", "0079_task_automation_foundation.sql"];
  const digest = createHash("sha256"); for (const file of files) digest.update(readFileSync(`db/migrations/${file}`));
  assert.equal(digest.digest("hex"), "d8c04d2131747b8ba710a88690a6f0b87528640f4cd918e27b3666c81b4a820b");
  assert.match(readFileSync("db/migrations/0080_task_automation_sources.sql", "utf8"), /whatsapp_inbound_received[\s\S]*task_automation_cancel_quote_follow_up/);
});

test("quote cancellation leaves canonical follow-up status, due time, reads, and history intact", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_cutover_preservation";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);
    psql(database, `insert into auth.users(id,email) values ('${actor}','owner@test'); insert into public.profiles(id,full_name,is_active) values ('${actor}','Owner',true); insert into public.roles(name,description) values ('asesor','Advisor') on conflict(name) do nothing; insert into public.profile_roles(profile_id,role_id) select '${actor}',id from public.roles where name='asesor'; insert into public.contacts(id,first_name,email) values ('${contact}','Preservation','preserve@test'); insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','preserve_open','Open','Open'); insert into public.leads(id,contact_id,status_id,assigned_to) values ('${lead}','${contact}','${status}','${actor}');`);
    applyMigration(database, "0080_task_automation_sources.sql");
    const action = (requestId: string, note: string, dueSql: string | null) => `${actorSession(actor)} select public.register_follow_up_action('${requestId}','${actor}','${lead}','${note}',${dueSql ?? "null"})::text;`;
    assert.equal(JSON.parse(psql(database, action(request(1), "History only", null)).split(/\r?\n/).at(-1)!).outcome, "history_only");
    const created = JSON.parse(psql(database, action(request(2), "Create", "to_char(statement_timestamp() + interval '1 day', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")).split(/\r?\n/).at(-1)!);
    assert.equal(psql(database, `select due_at between statement_timestamp() + interval '23 hours' and statement_timestamp() + interval '25 hours' from public.tasks where id='${created.taskId}';`), "t");
    psql(database, `${actorSession(actor)} select public.task_action('${request(3)}','${actor}','${created.taskId}','in_progress',null,null,null);`);
    assert.equal(JSON.parse(psql(database, action(request(4), "Reschedule", "to_char(statement_timestamp() + interval '2 days', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")).split(/\r?\n/).at(-1)!).taskStatus, "in_progress");
    psql(database, `alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete; insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote}','${contact}','${lead}','Preserved','${actor}','${actor}'); alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete; insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${version}','${lead}','${contact}',1,'Preserved','MXN','sent','${quote}',statement_timestamp()); insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type) values ('${sent}','${quote}','${version}','${contact}','${lead}','${actor}','quote_sent'); insert into public.lead_events(id,lead_id,actor_id,event_type,payload) values ('${whatsapp}','${lead}','${actor}','whatsapp_inbound_received','{"kept":true}');`);
    assert.equal(psql(database, `select t.status||':'||(t.due_at=p.latest_follow_up_at)::text||':'||(t.due_at >= statement_timestamp())::text||':'||(t.due_at between statement_timestamp() + interval '47 hours' and statement_timestamp() + interval '49 hours')::text||':'||(not p.follow_up_overdue)::text from public.tasks t cross join public.crm_contact_opportunity_page('${contact}') p where t.lead_id='${lead}' and t.task_kind='follow_up';`), "in_progress:true:true:true:true");
    assert.equal(psql(database, `select status from public.tasks where quote_id='${quote}' and task_kind='quote_follow_up';`), "canceled");
    assert.equal(psql(database, `select latest_follow_up_created_at is not null from public.crm_contact_opportunity_page('${contact}');`), "t");
    assert.equal(psql(database, `select count(*)||':'||(select payload->>'kept' from public.lead_events where id='${whatsapp}') from public.lead_events where lead_id='${lead}' and event_type='follow_up_registered';`), "3:true");
  } finally { cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), ""); }
});
