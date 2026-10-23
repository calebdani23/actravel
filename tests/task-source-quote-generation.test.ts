import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, psqlAsync, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0080_task_automation_sources.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = { owner: id(4, 51), inactive: id(4, 52) };
const contact = id(5, 51), opportunity = id(6, 51), status = id(7, 51);
const quote = (value: number) => id(7, value + 50);
const version = (value: number) => id(8, value + 50);
const event = (value: number) => id(9, value + 50);
const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const originKey = (versionId: string, eventId: string) => hash(["task-automation:v1", "quote_follow_up", versionId, eventId]);
const sourceKey = (versionId: string, eventId: string) => hash(["task-automation-source.v1", "quote_sent", versionId, eventId]);
const eventSql = (quoteId: string, versionId: string, eventId: string, createdAt = "default") => `insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,created_at) values ('${eventId}','${quoteId}','${versionId}','${contact}','${opportunity}','${actor.owner}','quote_sent',${createdAt});`;

test("0080 preserves first-persisted quote-sent generation with exact occurrence identity", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  assert.match(sql, /task_automation_source_cutoffs[\s\S]*quote_sent/i);
  assert.match(sql, /create trigger generate_quote_follow_up_on_sent[\s\S]*before insert on public\.quote_events/i);
  assert.match(sql, /task-automation:v1'[\s\S]*quote_follow_up'[\s\S]*v_quote_version_id::text[\s\S]*v_first_event_id::text/i);
  assert.match(sql, /task_automation_due_at\('quote_follow_up',v_sent_at,'elapsed-48h\.v1'\)/i);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*task_automation_tombstones[\s\S]*task_automation_project/i);
  assert.doesNotMatch(sql, /create trigger[^;]+(quotes|whatsapp_inbound_messages)/i);
});

test("first quote-sent occurrences generate once while cutoff, invalid owners, occupancy, replay, and races fail closed", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_source_quote_generation";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ('${actor.owner}','owner@test'),('${actor.inactive}','inactive@test');
      insert into public.profiles(id,full_name,is_active) values ('${actor.owner}','Owner',true),('${actor.inactive}','Inactive',false);
      insert into public.roles(name,description) values ('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.owner}'::uuid),('${actor.inactive}'::uuid)) value(id) cross join lateral (select id from public.roles where name='asesor') role;
      insert into public.contacts(id,first_name,email) values ('${contact}','Quote','quote@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','quote_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to) values ('${opportunity}','${contact}','${status}','${actor.owner}');
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote(1)}','${contact}','${opportunity}','Historical','${actor.owner}','${actor.owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${version(1)}','${opportunity}','${contact}',1,'Historical','MXN','sent','${quote(1)}','2026-01-02 12:00:00.123456+00');
      ${eventSql(quote(1), version(1), event(1), "'2026-01-02 12:00:00.123456+00'")}
    `);
    applyMigration(database, migration);
    assert.equal(psql(database, "select count(*) from public.tasks where task_kind='quote_follow_up';"), "0");

    psql(database, eventSql(quote(1), version(1), event(2)));
    assert.equal(psql(database, `select source_id::text||':'||source_key||':'||reason||':'||source_order from public.task_automation_tombstones where origin_key='${originKey(version(1), event(1))}';`), `${event(1)}:${sourceKey(version(1), event(1))}:pre_cutoff:1`);

    psql(database, `
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values
        ('${quote(2)}','${contact}','${opportunity}','Generated','${actor.owner}','${actor.owner}'),('${quote(3)}','${contact}','${opportunity}','Invalid owner','${actor.inactive}','${actor.owner}'),
        ('${quote(4)}','${contact}','${opportunity}','Occupied','${actor.owner}','${actor.owner}'),('${quote(5)}','${contact}','${opportunity}','Race','${actor.owner}','${actor.owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) select value.version_id,'${opportunity}','${contact}',1,value.title,'MXN','sent',value.quote_id,date_trunc('microseconds',statement_timestamp()) from (values
        ('${version(2)}'::uuid,'${quote(2)}'::uuid,'Generated'),('${version(3)}','${quote(3)}','Invalid owner'),('${version(4)}','${quote(4)}','Occupied'),('${version(5)}','${quote(5)}','Race')) value(version_id,quote_id,title);
      insert into public.tasks(owner_id,quote_id,description,due_at,idempotency_key) values ('${actor.owner}','${quote(4)}','Manual occupancy',statement_timestamp()+interval '1 day','${originKey(version(4), event(6))}');
    `);

    psql(database, eventSql(quote(2), version(2), event(3)) + eventSql(quote(2), version(2), event(4)));
    const generated = JSON.parse(psql(database, `select jsonb_build_object('count',count(*),'owner',min(t.owner_id::text),'origin',min(o.origin_key),'event',min(o.sent_event_id::text),'source',min(x.source_key),'due',min(t.due_at),'expected',min(qv.sent_at+interval '48 hours'),'orders',string_agg(x.source_order::text,',' order by x.source_order))::text from public.tasks t join public.task_automation_origins o on o.task_id=t.id join public.task_automation_outcomes x on x.task_id=t.id join public.quote_versions qv on qv.id=o.quote_version_id where t.quote_id='${quote(2)}' and t.task_kind='quote_follow_up';`));
    assert.deepEqual(generated, { count: 1, owner: actor.owner, origin: originKey(version(2), event(3)), event: event(3), source: sourceKey(version(2), event(3)), due: generated.expected, expected: generated.expected, orders: "1" });

    psql(database, eventSql(quote(3), version(3), event(5)));
    assert.equal(psql(database, `select outcome||':'||reason||':'||source_order from public.task_automation_outcomes where origin_key='${originKey(version(3), event(5))}';`), "unresolved:owner_inactive:1");
    psql(database, `update public.quotes set owner_id='${actor.owner}' where id='${quote(3)}'; ${eventSql(quote(3), version(3), event(7))}`);
    assert.equal(psql(database, `select o.sent_event_id::text||':'||string_agg(x.outcome||':'||coalesce(x.reason,'')||':'||x.source_order,',' order by x.source_order) from public.task_automation_origins o join public.task_automation_outcomes x on x.origin_key=o.origin_key where o.quote_version_id='${version(3)}' group by o.sent_event_id;`), `${event(5)}:unresolved:owner_inactive:1,applied::2`);

    psql(database, eventSql(quote(4), version(4), event(6)));
    assert.equal(psql(database, `select outcome||':'||reason from public.task_automation_outcomes where origin_key='${originKey(version(4), event(6))}';`), "unresolved:identity_occupied");
    assert.equal(psql(database, `select count(*) from public.tasks where quote_id='${quote(4)}' and task_kind='manual';`), "1");

    const race = await Promise.allSettled([psqlAsync(database, eventSql(quote(5), version(5), event(8))), psqlAsync(database, eventSql(quote(5), version(5), event(9)))]);
    assert.deepEqual(race.map((result) => result.status), ["fulfilled", "fulfilled"], race.map((result) => result.status === "rejected" ? String(result.reason) : "fulfilled").join("\n"));
    assert.equal(psql(database, `select count(*)::text||(select count(*) from public.task_automation_origins where quote_version_id='${version(5)}')::text from public.tasks where quote_id='${quote(5)}' and task_kind='quote_follow_up';`), "11");
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
