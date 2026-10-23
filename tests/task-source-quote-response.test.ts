import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Database, Json } from "../lib/supabase/database.types";
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime";

const migration = "0080_task_automation_sources.sql";
const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1";
const id = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const actor = { owner: id(1, 61), outsider: id(1, 62), inactive: id(1, 63) };
const contact = id(2, 61), opportunity = id(3, 61), status = id(4, 61);
const quote = (value: number) => id(5, value + 60), version = (value: number) => id(6, value + 60), event = (value: number) => id(7, value + 60), request = (value: number) => id(8, value + 60);
const parse = (value: string) => JSON.parse(value.split(/\r?\n/).at(-1)!);
const responseSql = (actorId: string, requestId: string, quoteId: string, versionId: string, channel = "phone") => `${actorSession(actorId)} select public.crm_record_quote_version_response('${requestId}','${actorId}','${quoteId}','${versionId}','${channel}')::text;`;
const response = (actorId: string, requestId: string, quoteId: string, versionId: string, channel = "phone") => parse(psql("task_source_quote_response", responseSql(actorId, requestId, quoteId, versionId, channel)));
const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ResponseRpc = Database["public"]["Functions"]["crm_record_quote_version_response"];
type _ArgsExact = Assert<Equal<ResponseRpc["Args"], { p_request_id_text: string; p_expected_actor_id: string; p_quote_id: string; p_quote_version_id: string; p_channel: "phone" | "email" | "whatsapp" | "portal" | "other" }>>;
type _ReturnsJson = Assert<Equal<ResponseRpc["Returns"], Json>>;
const typeContracts: [_ArgsExact, _ReturnsJson] = [true, true];

test("0080 defines the exact authenticated response RPC and audited terminal hooks", () => {
  const sql = readFileSync(`db/migrations/${migration}`, "utf8");
  const foundation = readFileSync("db/migrations/0079_task_automation_foundation.sql", "utf8");
  assert.deepEqual(typeContracts, [true, true]);
  assert.match(sql, /crm_record_quote_version_response\(p_request_id_text text, p_expected_actor_id uuid, p_quote_id uuid, p_quote_version_id uuid, p_channel text\)/i);
  assert.match(sql, /phone'[^;]+email'[^;]+whatsapp'[^;]+portal'[^;]+other/i);
  assert.match(sql, /quote-version-response\.v1'[^;]+requestId'[^;]+quoteId'[^;]+quoteVersionId'[^;]+channel'[^;]+actorId/i);
  assert.match(sql, /task_automation_cancel_quote_follow_up[\s\S]+task_automation_project/i);
  assert.match(sql, /task_automation_cancel_quote_follow_up[\s\S]+pg_advisory_xact_lock[\s\S]+p_source_key[\s\S]+pg_advisory_xact_lock[\s\S]+v_origin_key[\s\S]+max\(value\.source_order\)[\s\S]+task_automation_project/i);
  assert.match(sql, /quote_accepted[^;]+quote_rejected[^;]+quote_expired[^;]+quote_cancelled[^;]+quote_superseded[\s\S]+task_automation_cancel_quote_follow_up/i);
  assert.match(foundation, /p_operation='cancel' then perform public\.task_action_automation_cancel/i);
  assert.match(sql, /grant execute on function public\.crm_record_quote_version_response\(text,uuid,uuid,uuid,text\) to authenticated/i);
  assert.doesNotMatch(sql, /create trigger[^;]+whatsapp_inbound_messages/i);
});

test("exact responses and version terminals cancel once while replay, suppression, and first-terminal state remain closed", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_source_quote_response";
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`);
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name);
    psql(database, `
      insert into auth.users(id,email) values ('${actor.owner}','owner@test'),('${actor.outsider}','outsider@test'),('${actor.inactive}','inactive@test');
      insert into public.profiles(id,full_name,is_active) values ('${actor.owner}','Owner',true),('${actor.outsider}','Outsider',true),('${actor.inactive}','Inactive',false);
      insert into public.roles(name,description) values ('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${actor.owner}'::uuid),('${actor.outsider}'::uuid),('${actor.inactive}'::uuid)) value(id) cross join lateral (select id from public.roles where name='asesor') role;
      insert into public.contacts(id,first_name,email) values ('${contact}','Response','response@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','response_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,assigned_to) values ('${opportunity}','${contact}','${status}','${actor.owner}');
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote(7)}','${contact}','${opportunity}','Historical','${actor.owner}','${actor.owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) values ('${version(7)}','${opportunity}','${contact}',1,'Historical','MXN','sent','${quote(7)}','2026-01-02 12:00:00+00');
      insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,created_at) values ('${event(7)}','${quote(7)}','${version(7)}','${contact}','${opportunity}','${actor.owner}','quote_sent','2026-01-02 12:00:00+00');
    `);
    applyMigration(database, migration);
    psql(database, `
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) select ('${quote(1).slice(0,-1)}'||value.n::text)::uuid,'${contact}','${opportunity}','Response '||value.n,'${actor.owner}','${actor.owner}' from generate_series(1,6) value(n);
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;
      insert into public.quote_versions(id,lead_id,contact_id,version_number,title,currency,status,quote_id,sent_at) select ('${version(1).slice(0,-1)}'||value.n::text)::uuid,'${opportunity}','${contact}',1,'Response '||value.n,'MXN','sent',('${quote(1).slice(0,-1)}'||value.n::text)::uuid,'2026-09-23 12:00:00+00' from generate_series(1,6) value(n);
      insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type) select ('${event(1).slice(0,-1)}'||value.n::text)::uuid,('${quote(1).slice(0,-1)}'||value.n::text)::uuid,('${version(1).slice(0,-1)}'||value.n::text)::uuid,'${contact}','${opportunity}','${actor.owner}','quote_sent' from generate_series(1,6) value(n);
    `);

    assert.equal(parse(psql(database, `set role authenticated; select public.crm_record_quote_version_response('${request(20)}','${actor.owner}','${quote(1)}','${version(1)}','phone')::text;`)).error.code, "AUTH_REQUIRED");
    assert.equal(response(actor.inactive, request(21), quote(1), version(1)).error.code, "AUTH_INACTIVE");
    assert.equal(parse(psql(database, `${actorSession(actor.owner)} select public.crm_record_quote_version_response('${request(22)}','${actor.outsider}','${quote(1)}','${version(1)}','phone')::text;`)).error.code, "AUTH_ACTOR_MISMATCH");
    assert.equal(parse(psql(database, `${actorSession(actor.owner)} select public.crm_record_quote_version_response('not-a-uuid','${actor.owner}','${quote(1)}','${version(1)}','phone')::text;`)).error.code, "INVALID_REQUEST");
    assert.equal(parse(psql(database, `${actorSession(actor.owner)} select public.crm_record_quote_version_response('${request(27)}','${actor.owner}','${quote(1)}','${version(1)}',null)::text;`)).error.code, "INVALID_REQUEST");
    assert.equal(response(actor.owner, request(23), quote(1), version(1), "sms").error.code, "INVALID_REQUEST");
    assert.equal(response(actor.outsider, request(24), quote(1), version(1)).error.code, "QUOTE_VERSION_FORBIDDEN");
    assert.equal(response(actor.owner, request(25), quote(1), version(2)).error.code, "QUOTE_VERSION_FORBIDDEN");
    assert.throws(() => psql(database, `insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,payload,idempotency_key) values ('${request(26)}','${quote(1)}','${version(1)}','${contact}','${opportunity}','${actor.owner}','quote_version_response','{}','quote-version-response:${request(26)}');`), /TASK_QUOTE_RESPONSE_INVALID_PAYLOAD/);
    assert.throws(() => psql(database, `insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,payload,idempotency_key) values ('${request(28)}','${quote(1)}','${version(1)}','${contact}','${opportunity}','${actor.owner}','quote_version_response',jsonb_build_object('schema','quote-version-response.v1','requestId','${request(28)}','quoteId','${quote(1)}','quoteVersionId','${version(1)}','channel',null,'actorId','${actor.owner}'),'quote-version-response:${request(28)}');`), /TASK_QUOTE_RESPONSE_INVALID_PAYLOAD/);

    const recorded = response(actor.owner, request(1), quote(1), version(1), "email");
    assert.deepEqual(recorded, { ok: true, schema: "quote-version-response-result.v1", eventId: request(1), requestId: request(1), quoteId: quote(1), quoteVersionId: version(1), channel: "email", actorId: actor.owner, replayed: false });
    assert.equal(response(actor.owner, request(1), quote(1), version(1), "email").replayed, true);
    assert.equal(response(actor.owner, request(1), quote(1), version(1), "phone").error.code, "QUOTE_RESPONSE_IDEMPOTENCY_CONFLICT");
    assert.deepEqual(JSON.parse(psql(database, `select payload::text from public.quote_events where id='${request(1)}';`)), { schema: "quote-version-response.v1", requestId: request(1), quoteId: quote(1), quoteVersionId: version(1), channel: "email", actorId: actor.owner });

    psql(database, `update public.quote_versions set status='accepted' where id='${version(1)}'; update public.quote_versions set status='rejected' where id='${version(2)}'; update public.quote_versions set status='expired' where id='${version(3)}'; update public.quote_versions set status='cancelled' where id='${version(4)}'; update public.quote_versions set status='superseded' where id='${version(5)}';`);
    assert.equal(response(actor.owner, request(9), quote(1), version(1)).error.code, "QUOTE_VERSION_NOT_ACTIONABLE");
    const completedTask = psql(database, `select task_id from public.task_automation_origins where quote_version_id='${version(6)}';`);
    parse(psql(database, `${actorSession(actor.owner)} select public.task_action('${request(6)}','${actor.owner}','${completedTask}','completed',null,'work_completed',null)::text;`));
    assert.equal(response(actor.owner, request(7), quote(6), version(6), "portal").ok, true);
    assert.equal(psql(database, `select string_agg(qv.status||':'||t.status,',' order by qv.id) from public.quote_versions qv join public.task_automation_origins o on o.quote_version_id=qv.id join public.tasks t on t.id=o.task_id where qv.id in ('${version(1)}','${version(2)}','${version(3)}','${version(4)}','${version(5)}','${version(6)}');`), "accepted:canceled,rejected:canceled,expired:canceled,cancelled:canceled,superseded:canceled,sent:completed");
    assert.equal(psql(database, `select string_agg(source_kind||':'||source_order||':'||outcome,',' order by source_kind,source_order,outcome) from public.task_action_receipts where actor_kind='automation' and task_id in (select task_id from public.task_automation_origins where quote_version_id in ('${version(1)}','${version(2)}','${version(3)}','${version(4)}','${version(5)}','${version(6)}'));`), "quote_accepted:3:already_at_target,quote_cancelled:2:applied,quote_expired:2:applied,quote_rejected:2:applied,quote_superseded:2:applied,quote_version_response:2:applied,quote_version_response:2:not_applicable_terminal");

    assert.equal(response(actor.owner, request(8), quote(7), version(7), "other").ok, true);
    const suppressed = parse(psql(database, `select jsonb_build_object('reason',t.reason,'sourceKind',t.source_kind,'sourceKey',t.source_key,'sourceOrder',t.source_order,'operation',o.operation,'outcome',o.outcome,'taskId',o.task_id)::text from public.task_automation_tombstones t join public.task_automation_outcomes o on o.origin_key=t.origin_key where t.source_id='${request(8)}';`));
    assert.deepEqual(suppressed, { reason: "source_invalidated", sourceKind: "quote_version_response", sourceKey: hash(["task-automation-source.v1", "quote_version_response", version(7), request(8)]), sourceOrder: 1, operation: "suppress", outcome: "applied", taskId: null });
    assert.equal(psql(database, `select count(*) from public.tasks where quote_id='${quote(7)}';`), "0");
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
