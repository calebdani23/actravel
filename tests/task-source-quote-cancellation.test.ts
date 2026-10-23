import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const owner = id(1, 81), contact = id(2, 81), status = id(3, 81);
const lead = (n: number) => id(4, 80 + n), quote = (n: number) => id(5, 80 + n), version = (n: number) => id(6, 80 + n);
const event = (n: number) => id(7, 80 + n), payment = (n: number) => id(8, 80 + n), request = (n: number) => id(9, 80 + n);
const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const waKey = (eventId: string, leadId: string, versionId: string | null) => hash(["task-automation-source.v1", "whatsapp_inbound", eventId, leadId, versionId]);
const paymentKey = (paymentId: string, versionId: string) => hash(["task-automation-source.v1", "payment_verified", paymentId, versionId]);
const sent = (n: number) => `insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type) values ('${event(n)}','${quote(n)}','${version(n)}','${contact}','${lead(n === 2 ? 1 : n === 6 ? 4 : n)}','${owner}','quote_sent');`;
const document = (n: number) => `insert into public.documents(id,lead_id,contact_id,uploaded_by,document_type,title,bucket,path,status,quote_version_id,storage_state,mime_type,byte_size,sha256,uploaded_at) values ('${request(n)}','${lead(n)}','${contact}','${owner}','quote','PDF','quote-pdfs','contacts/${contact}/opportunities/${lead(n)}/quotes/${quote(n)}/versions/${version(n)}/${request(n)}.pdf','active','${version(n)}','ready','application/pdf',1,repeat('a',64),statement_timestamp());`;

test("0080 binds private WhatsApp and verified-payment hooks to exact source identities", () => {
  const sql = readFileSync("db/migrations/0080_task_automation_sources.sql", "utf8");
  assert.match(sql, /create trigger cancel_quote_follow_up_on_whatsapp[\s\S]*after insert on public\.lead_events/i);
  assert.match(sql, /create trigger cancel_quote_follow_up_on_payment[\s\S]*after insert or update of status,accepted_quote_version_id on public\.payments/i);
  assert.match(sql, /task-automation-source\.v1'[\s\S]*whatsapp_inbound[\s\S]*new\.id::text[\s\S]*new\.lead_id::text[\s\S]*v_quote_version_id::text/i);
  assert.match(sql, /task-automation-source\.v1'[\s\S]*payment_verified[\s\S]*new\.id::text[\s\S]*new\.accepted_quote_version_id::text/i);
  assert.match(sql, /task-automation-source-lock\.v1'[\s\S]*pg_advisory_xact_lock[\s\S]*from public\.contacts[\s\S]*from public\.leads[\s\S]*from public\.quotes[\s\S]*from public\.quote_versions[\s\S]*task_automation_cancel_quote_follow_up/i);
  assert.match(sql, /task_automation_outcomes[\s\S]*source_ambiguous/i);
  assert.match(sql, /revoke all on function[\s\S]*task_automation_cancel_quote_whatsapp\(\)[\s\S]*task_automation_cancel_quote_payment\(\)[\s\S]*from public,anon,authenticated,service_role/i);
  assert.doesNotMatch(sql, /create trigger[^;]+whatsapp_inbound_messages/i);
});

test("exact cancellations suppress ambiguity and preserve replay, tombstones, and first terminal wins", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_source_quote_cancellation";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ('${owner}','owner@test'); insert into public.profiles(id,full_name,is_active) values ('${owner}','Owner',true);
      insert into public.roles(name,description) values ('asesor','Advisor') on conflict(name) do nothing; insert into public.profile_roles(profile_id,role_id) select '${owner}',id from public.roles where name='asesor';
      insert into public.contacts(id,first_name,email) values ('${contact}','Cancellation','cancel@test'); insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','cancel_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to) select value,'${contact}','${status}','${owner}' from unnest(array['${lead(1)}'::uuid,'${lead(2)}','${lead(3)}','${lead(4)}','${lead(5)}']) value;
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote(5)}','${contact}','${lead(5)}','Historical','${owner}','${owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${version(5)}','${lead(5)}','${contact}',1,'Historical','MXN','sent','${quote(5)}','2026-09-20Z'); ${sent(5)} ${document(5)} update public.quote_versions set status='accepted' where id='${version(5)}';
    `);
    applyMigration(database, "0080_task_automation_sources.sql");
    psql(database, `
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) select ('${quote(1).slice(0, -1)}'||n)::uuid,'${contact}',case when n=2 then '${lead(1)}'::uuid else ('${lead(1).slice(0, -1)}'||n)::uuid end,'Quote '||n,'${owner}','${owner}' from generate_series(1,4) n;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote(6)}','${contact}','${lead(4)}','Quote 6','${owner}','${owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) select ('${version(1).slice(0, -1)}'||n)::uuid,case when n=2 then '${lead(1)}'::uuid else ('${lead(1).slice(0, -1)}'||n)::uuid end, '${contact}',case when n=2 then 2 else 1 end,'Version '||n,'MXN','sent',('${quote(1).slice(0, -1)}'||n)::uuid,statement_timestamp() from generate_series(1,4) n;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${version(6)}','${lead(4)}','${contact}',2,'Version 6','MXN','sent','${quote(6)}',statement_timestamp());
      ${sent(1)} ${sent(2)} ${sent(3)} ${sent(4)} ${sent(6)}
      insert into public.lead_events(id,lead_id,actor_id,event_type) values ('${event(10)}','${lead(1)}','${owner}','whatsapp_inbound_received');
    `);
    assert.equal(psql(database, `select count(*)||':'||(select count(*) from public.tasks where quote_id in ('${quote(1)}','${quote(2)}') and status='canceled') from public.task_automation_outcomes where source_id='${event(10)}' and outcome='unresolved' and reason='source_ambiguous';`), "1:0");
    psql(database, `update public.quote_versions set status='superseded' where id='${version(2)}'; insert into public.lead_events(id,lead_id,actor_id,event_type) values ('${event(11)}','${lead(1)}','${owner}','whatsapp_inbound_received');`);
    assert.equal(psql(database, `select source_key||':'||source_order||':'||(select status from public.tasks where quote_id='${quote(1)}') from public.task_action_receipts where source_id='${event(11)}';`), `${waKey(event(11), lead(1), version(1))}:2:canceled`);

    const raceTask = psql(database, `select task_id from public.task_automation_origins where quote_version_id='${version(3)}';`);
    const race = await Promise.allSettled([psqlAsync(database, `${actorSession(owner)} select public.task_action('${request(20)}','${owner}','${raceTask}','completed',null,'work_completed',null);`), psqlAsync(database, `insert into public.lead_events(id,lead_id,actor_id,event_type) values ('${event(12)}','${lead(3)}','${owner}','whatsapp_inbound_received');`)]);
    assert.deepEqual(race.map((result) => result.status), ["fulfilled", "fulfilled"]);
    const final = psql(database, `select status from public.tasks where id='${raceTask}';`);
    assert.ok(final === "completed" || final === "canceled");
    psql(database, `select public.task_automation_cancel_quote_follow_up('whatsapp_inbound','${event(12)}','${waKey(event(12), lead(3), version(3))}','${version(3)}');`);
    assert.equal(psql(database, `select count(*) from public.task_action_receipts where task_id='${raceTask}' and source_kind='whatsapp_inbound';`), "1");
    assert.throws(() => psql(database, `${actorSession(owner)} select public.task_automation_cancel_quote_follow_up('whatsapp_inbound','${event(12)}','${waKey(event(12), lead(3), version(3))}','${version(3)}');`), /permission denied/);

    psql(database, `${document(4)} update public.quote_versions set status='accepted' where id='${version(4)}';
      insert into public.payments(id,lead_id,contact_id,amount,status,accepted_quote_version_id,verified_by,verified_at) values ('${payment(4)}','${lead(4)}','${contact}',100,'verified','${version(4)}','${owner}',statement_timestamp()),('${payment(5)}','${lead(5)}','${contact}',100,'verified','${version(5)}','${owner}',statement_timestamp()),('${payment(6)}','${lead(3)}','${contact}',100,'received',null,null,null);`);
    assert.equal(psql(database, `select source_key||':'||source_order||':'||outcome||':'||(select status from public.tasks where quote_id='${quote(6)}') from public.task_action_receipts where source_id='${payment(4)}';`), `${paymentKey(payment(4), version(4))}:3:already_at_target:pending`);
    assert.equal(psql(database, `select operation||':'||outcome||':'||(task_id is null)::int from public.task_automation_outcomes where source_id='${payment(5)}';`), "suppress:applied:1");
    assert.equal(psql(database, `select source_kind||':'||reason from public.task_automation_tombstones where source_id='${payment(5)}';`), "payment_verified:source_invalidated");
    assert.equal(psql(database, `select count(*) from public.task_automation_outcomes where source_id='${payment(6)}';`), "0");
  } finally { cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), ""); }
});
