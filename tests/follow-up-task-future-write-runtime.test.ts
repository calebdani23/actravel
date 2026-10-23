import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyMigration,
  cleanupPostgres,
  containerName,
  docker,
  postgresImage,
  prepareBaseDatabase,
  psql,
  psqlAsync,
  sqlLiteral,
  waitForPostgres,
} from "./helpers/postgres-runtime";

const migrationPath = "db/migrations/0070_follow_up_task_future_write_helpers.sql";
const rpcMigrationPath = "db/migrations/0071_follow_up_task_future_write_rpc.sql";
const enabled = process.env.RUN_FOLLOW_UP_CUTOVER_DB_TESTS === "1";
const actorId = "22222222-2222-4222-8222-222222222222";
const advisorId = "12121212-1212-4212-8212-121212121212";
const outsiderId = "13131313-1313-4313-8313-131313131313";
const leadId = "33333333-3333-4333-8333-333333333333";
const concurrentLeadId = "14141414-1414-4414-8414-141414141414";
const occupiedLeadId = "15151515-1515-4515-8515-151515151515";
const invalidOwnerLeadId = "16161616-1616-4616-8616-161616161616";
const deletedLeadId = "17171717-1717-4717-8717-171717171717";
const rollbackLeadId = "18181818-1818-4818-8818-181818181818";
const createdRequestId = "11111111-1111-4111-8111-111111111111";
const rescheduledRequestId = "44444444-4444-4444-8444-444444444444";
const historyRequestId = "55555555-5555-4555-8555-555555555555";
const corruptRequestId = "66666666-6666-4666-8666-666666666666";
const sourceEventId = "77777777-7777-4777-8777-777777777777";
const createdNoteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const createdTaskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const rescheduledNoteId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const rescheduledTaskId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const historyNoteId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const corruptNoteId = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const createdDueAt = "2026-09-20T12:50:30.100000Z";
const rescheduledDueAt = "2026-09-21T09:15:00.000000Z";
const sourceDueAt = "2026-09-19T08:00:00.000000Z";
const createdNote = "Call “Ana”\nmañana";
const rescheduledNote = "Confirm the revised itinerary";

function fingerprint(requestId: string, noteBody: string, dueAt: string | null) {
  return createHash("sha256").update(JSON.stringify([
    "follow-up-write-request.v1", requestId, actorId, leadId, noteBody, dueAt,
  ]), "utf8").digest("hex");
}

function payload(requestId: string, noteId: string, taskId: string | null, outcome: string, dueAt: string | null, noteBody: string) {
  return { schema: "follow-up-write.v1", requestId, requestFingerprint: fingerprint(requestId, noteBody, dueAt), noteId, taskId, outcome, followUpAt: dueAt, hasNote: true };
}

function replay(requestId: string, noteBody: string, dueAt: string | null) {
  const due = dueAt === null ? "null" : sqlLiteral(dueAt);
  const result = psql("future_write", `select public.read_follow_up_write_replay('${requestId}','${actorId}','${leadId}',${sqlLiteral(noteBody)},${due})::text;`);
  return result ? JSON.parse(result) : null;
}

function session(actor: string) {
  return `select set_config('request.jwt.claim.sub','${actor}',false); select set_config('request.jwt.claim.role','authenticated',false); set role authenticated;`;
}

function writeSql(requestId: string, lead: string, noteBody: string, dueAt: string | null, actor = actorId, expectedActor = actor) {
  return `${session(actor)} select public.register_follow_up_action('${requestId}','${expectedActor}',${sqlLiteral(lead)},${sqlLiteral(noteBody)},${dueAt === null ? "null" : sqlLiteral(dueAt)})::text;`;
}

function parseLastJson(output: string) {
  return JSON.parse(output.split("\n").at(-1) ?? "null");
}

function write(requestId: string, lead: string, noteBody: string, dueAt: string | null, actor = actorId, expectedActor = actor) {
  return parseLastJson(psql("future_write", writeSql(requestId, lead, noteBody, dueAt, actor, expectedActor)));
}

function prepareDatabase() {
  psql("postgres", "create database future_write template quote_base;");
  for (const migration of [
    "0057_quote_rpc_cutover.sql", "0058_fix_legacy_quote_document_link_ambiguity.sql", "0059_quote_registration_intents.sql",
    "0060_quote_pdf_creation_cutover.sql", "0061_manager_capability_foundation.sql", "0062_tasks_foundation.sql",
    "0063_staff_notifications_foundation.sql", "0064_follow_up_task_representation.sql", "0065_follow_up_task_approval_ledger.sql",
    "0066_follow_up_task_apply_receipt_foundation.sql", "0067_follow_up_task_apply_rpc.sql", "0068_follow_up_task_readiness_helpers.sql",
    "0069_follow_up_task_disposition_readiness_rpc.sql", "0070_follow_up_task_future_write_helpers.sql",
  ]) applyMigration("future_write", migration);

  const createdPayload = payload(createdRequestId, createdNoteId, createdTaskId, "created", createdDueAt, createdNote);
  const rescheduledPayload = payload(rescheduledRequestId, rescheduledNoteId, rescheduledTaskId, "rescheduled", rescheduledDueAt, rescheduledNote);
  const historyPayload = payload(historyRequestId, historyNoteId, null, "history_only", null, "History only");
  const corruptPayload = payload(corruptRequestId, corruptNoteId, null, "history_only", null, "Expected body");
  const sourcePayload = { followUpAt: sourceDueAt, hasNote: true };
  psql("future_write", `
    insert into auth.users(id,email) values ('${actorId}','actor@test'),('${advisorId}','advisor@test'),('${outsiderId}','outsider@test');
    insert into public.profiles(id,full_name,is_active) values ('${actorId}','Actor',true),('${advisorId}','Advisor',true),('${outsiderId}','Outsider',true);
    insert into public.roles(id,name) values ('20202020-2020-4020-8020-202020202020','admin'),('21212121-2121-4121-8121-212121212121','asesor'),('23232323-2323-4323-8323-232323232323','operaciones');
    insert into public.profile_roles(profile_id,role_id) values ('${actorId}','20202020-2020-4020-8020-202020202020'),('${advisorId}','21212121-2121-4121-8121-212121212121'),('${outsiderId}','23232323-2323-4323-8323-232323232323');
    insert into public.contacts(id,first_name,email) values ('88888888-8888-4888-8888-888888888888','Test','test@example.test');
    insert into public.lead_statuses(id,name,label_es,label_en) values ('99999999-9999-4999-8999-999999999999','open','Open','Open');
    insert into public.leads(id,contact_id,status_id,assigned_to) values
      ('${leadId}','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999','${actorId}'),
      ('${concurrentLeadId}','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999','${actorId}'),
      ('${occupiedLeadId}','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999','${advisorId}'),
      ('${invalidOwnerLeadId}','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999','${outsiderId}'),
      ('${deletedLeadId}','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999','${actorId}'),
      ('${rollbackLeadId}','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999','${actorId}');
    update public.leads set deleted_at=now() where id='${deletedLeadId}';
    insert into public.lead_notes(id,lead_id,author_id,body) values
      ('${createdNoteId}','${leadId}','${actorId}',${sqlLiteral(createdNote)}),
      ('${rescheduledNoteId}','${leadId}','${actorId}',${sqlLiteral(rescheduledNote)}),
      ('${historyNoteId}','${leadId}','${actorId}','History only'),
      ('${corruptNoteId}','${leadId}','${actorId}','Drifted body');
    insert into public.lead_events(id,lead_id,actor_id,event_type,payload,created_at) values
      ('${createdRequestId}','${leadId}','${actorId}','follow_up_registered',${sqlLiteral(JSON.stringify(createdPayload))}::jsonb,'2026-09-14 10:00:00.123456+00'),
      ('${sourceEventId}','${leadId}','${actorId}','follow_up_registered',${sqlLiteral(JSON.stringify(sourcePayload))}::jsonb,'2026-09-14 10:01:00.123456+00'),
      ('${rescheduledRequestId}','${leadId}','${actorId}','follow_up_registered',${sqlLiteral(JSON.stringify(rescheduledPayload))}::jsonb,'2026-09-14 10:02:00.123456+00'),
      ('${historyRequestId}','${leadId}','${actorId}','follow_up_registered',${sqlLiteral(JSON.stringify(historyPayload))}::jsonb,'2026-09-14 10:03:00.123456+00'),
      ('${corruptRequestId}','${leadId}','${actorId}','follow_up_registered',${sqlLiteral(JSON.stringify(corruptPayload))}::jsonb,'2026-09-14 10:04:00.123456+00');
    insert into public.tasks(id,owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata) values
      ('${createdTaskId}','${actorId}','${leadId}',null,'Follow up with lead','${createdDueAt}','pending',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${createdRequestId}','UTF8'),'sha256'),'hex')),'follow_up','${createdRequestId}','follow_up_registered','2026-09-14 10:00:00.123456+00','${createdDueAt}',${sqlLiteral(JSON.stringify(createdPayload))}::jsonb,jsonb_build_object('schema','follow_up_task.v1','source_event_id','${createdRequestId}','source_event_type','follow_up_registered','owner_id','${actorId}','lead_id','${leadId}')),
      ('${rescheduledTaskId}','${actorId}','${leadId}',null,'Follow up with lead','${sourceDueAt}','pending',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${sourceEventId}','UTF8'),'sha256'),'hex')),'follow_up','${sourceEventId}','follow_up_registered','2026-09-14 10:01:00.123456+00','${sourceDueAt}',${sqlLiteral(JSON.stringify(sourcePayload))}::jsonb,jsonb_build_object('schema','follow_up_task.v1','source_event_id','${sourceEventId}','source_event_type','follow_up_registered','owner_id','${actorId}','lead_id','${leadId}'));
    update public.tasks set due_at='2026-10-01T00:00:00Z',status='completed' where id='${createdTaskId}';
    update public.tasks set due_at='2026-10-02T00:00:00Z',status='in_progress' where id='${rescheduledTaskId}';
  `);
}

const snapshotSql = `select lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_object('notes',coalesce((select jsonb_agg(to_jsonb(n) order by id) from public.lead_notes n),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by id) from public.lead_events e),'[]'::jsonb),'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by id) from public.tasks t),'[]'::jsonb))),'UTF8'),'sha256'),'hex'));`;

test("0070 declares only the three bounded nonmutating helpers", () => {
  const body = readFileSync(migrationPath, "utf8");
  assert.match(body, /function public\.normalize_follow_up_write_due_at\(p_due_at text\)\s+returns text language plpgsql immutable security invoker/i);
  assert.match(body, /function public\.follow_up_write_request_fingerprint\(p_request_id uuid, p_actor_id uuid, p_lead_id uuid, p_note_body text, p_due_at text\)\s+returns text language sql immutable security invoker/i);
  assert.match(body, /function public\.read_follow_up_write_replay\(p_request_id uuid, p_actor_id uuid, p_lead_id uuid, p_note_body text, p_due_at text\)\s+returns jsonb language plpgsql stable security invoker/i);
  assert.doesNotMatch(body, /\b(insert|update|delete|alter table|create policy|drop policy)\b/i);
  assert.equal((body.match(/revoke all on function public\.(?:normalize_follow_up_write_due_at|follow_up_write_request_fingerprint|read_follow_up_write_replay)/gi) ?? []).length, 3);
});

test("0071 declares the narrow authenticated transactional boundary", () => {
  const body = readFileSync(rpcMigrationPath, "utf8");
  assert.match(body, /function public\.register_follow_up_action\(p_request_id_text text, p_expected_actor_id uuid, p_lead_id_text text, p_note_body text, p_due_at text\)\s+returns jsonb language plpgsql volatile security definer/i);
  assert.match(body, /revoke all on function public\.register_follow_up_action\(text,uuid,text,text,text\) from public,anon,authenticated,service_role/i);
  assert.match(body, /grant execute on function public\.register_follow_up_action\(text,uuid,text,text,text\) to authenticated/i);
  assert.doesNotMatch(body, /grant execute[^;]+(?:anon|service_role)/i);
});

test("future-write helpers normalize, fingerprint, validate replay identity, and perform zero DML", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    prepareDatabase();
    assert.equal(psql("future_write", "select public.normalize_follow_up_write_due_at(null) is null;"), "t");
    assert.equal(psql("future_write", "select public.normalize_follow_up_write_due_at('2026-09-20T10:20:30.1-02:30');"), "2026-09-20T12:50:30.100000Z");
    assert.equal(psql("future_write", "select public.normalize_follow_up_write_due_at('1970-01-01T00:00:00Z'),public.normalize_follow_up_write_due_at('9999-12-31T23:59:59.999999Z');"), "1970-01-01T00:00:00.000000Z|9999-12-31T23:59:59.999999Z");
    for (const invalid of [" 2026-09-20T10:20:30Z", "2026-09-20T10:20Z", "2026-09-20T10:20:30.1234567Z", "2026-02-29T10:20:30Z", "2026-09-20T24:00:00Z", "2026-09-20T10:20:60Z", "1969-12-31T23:59:59Z", "2026-09-20T10:20:30+14:01", "2026-09-20T10:20:30-00:00", "1970-01-01T00:00:00+01:00", "9999-12-31T23:59:59-01:00"]) {
      assert.equal(psql("future_write", `select public.normalize_follow_up_write_due_at(${sqlLiteral(invalid)}) is null;`), "t", invalid);
    }
    assert.equal(psql("future_write", `select public.follow_up_write_request_fingerprint('${createdRequestId}','${actorId}','${leadId}',${sqlLiteral(createdNote)},'${createdDueAt}');`), "7fb5f3864aecf612bba53fd7b09ed314fa84bfdbd0af74177b50c0231453e15f");
    assert.equal(psql("future_write", `select public.follow_up_write_request_fingerprint('${historyRequestId}','${actorId}','${leadId}','History only',null);`), fingerprint(historyRequestId, "History only", null));

    const before = psql("future_write", snapshotSql);
    assert.deepEqual(replay(createdRequestId, createdNote, "2026-09-20T10:20:30.1-02:30"), { ok: true, outcome: "created", requestId: createdRequestId, noteId: createdNoteId, eventId: createdRequestId, taskId: createdTaskId, taskStatus: "completed", dueAt: createdDueAt, replayed: true });
    assert.deepEqual(replay(rescheduledRequestId, rescheduledNote, rescheduledDueAt), { ok: true, outcome: "rescheduled", requestId: rescheduledRequestId, noteId: rescheduledNoteId, eventId: rescheduledRequestId, taskId: rescheduledTaskId, taskStatus: "in_progress", dueAt: rescheduledDueAt, replayed: true });
    assert.deepEqual(replay(historyRequestId, "History only", null), { ok: true, outcome: "history_only", requestId: historyRequestId, noteId: historyNoteId, eventId: historyRequestId, taskId: null, taskStatus: null, dueAt: null, replayed: true });
    assert.equal(replay("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "Absent", null), null);
    assert.deepEqual(replay(createdRequestId, "Changed body", createdDueAt), { ok: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "IDEMPOTENCY_CONFLICT" } });
    assert.deepEqual(replay(createdRequestId, createdNote, "2026-09-22T00:00:00Z"), { ok: false, error: { code: "IDEMPOTENCY_CONFLICT", message: "IDEMPOTENCY_CONFLICT" } });
    assert.deepEqual(replay(corruptRequestId, "Expected body", null), { ok: false, error: { code: "REPLAY_INTEGRITY_FAILURE", message: "REPLAY_INTEGRITY_FAILURE" } });
    assert.equal(psql("future_write", snapshotSql), before);

    psql("future_write", `alter table public.tasks disable trigger prevent_task_representation_update; update public.tasks set metadata='{}'::jsonb where id='${createdTaskId}'; alter table public.tasks enable trigger prevent_task_representation_update;`);
    const drifted = psql("future_write", snapshotSql);
    assert.deepEqual(replay(createdRequestId, createdNote, createdDueAt), { ok: false, error: { code: "REPLAY_INTEGRITY_FAILURE", message: "REPLAY_INTEGRITY_FAILURE" } });
    assert.equal(psql("future_write", snapshotSql), drifted);
    assert.equal(psql("future_write", `select bool_and(not prosecdef and provolatile in ('i','s')) from pg_proc where oid in ('public.normalize_follow_up_write_due_at(text)'::regprocedure,'public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text)'::regprocedure,'public.read_follow_up_write_replay(uuid,uuid,uuid,text,text)'::regprocedure);`), "t");
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});

test("0071 atomically creates, reschedules, serializes, replays, and rejects unsafe occupancy", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    prepareDatabase();
    applyMigration("future_write", "0071_follow_up_task_future_write_rpc.sql");
    const error = (value: unknown, code: string) => assert.deepEqual(value, { ok: false, error: { code, message: code } });
    error(parseLastJson(psql("future_write", `select public.register_follow_up_action('${randomUUID()}','${actorId}','${leadId}','Note',null)::text;`)), "AUTH_REQUIRED");
    error(write(randomUUID(), leadId, "Note", null, actorId, advisorId), "AUTH_ACTOR_MISMATCH");
    error(write(randomUUID(), leadId, "Note", null, outsiderId), "AUTH_FORBIDDEN");
    psql("future_write", `update public.profiles set is_active=false where id='${outsiderId}';`);
    error(write(randomUUID(), leadId, "Note", null, outsiderId), "AUTH_INACTIVE");
    psql("future_write", `update public.profiles set is_active=true where id='${outsiderId}';`);
    error(write(randomUUID(), leadId, "Note", null, advisorId), "AUTH_FORBIDDEN");
    error(write("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA9", leadId, "Note", null), "INVALID_REQUEST");
    error(write(randomUUID(), leadId, " ", null), "INVALID_REQUEST");
    error(write(randomUUID(), leadId, "Note", "2026-09-20T10:20Z"), "INVALID_REQUEST");
    error(write(randomUUID(), leadId, "é".repeat(2001), null), "LIMIT_EXCEEDED");
    error(write(randomUUID(), deletedLeadId, "Note", null), "LEAD_NOT_OPERATIONAL");
    error(write(randomUUID(), invalidOwnerLeadId, "Note", null), "OWNER_CONTEXT_INVALID");

    const historyId = randomUUID();
    const history = write(historyId, occupiedLeadId, " Advisor history ", null, advisorId);
    assert.deepEqual({ ...history, noteId: typeof history.noteId }, { ok: true, outcome: "history_only", requestId: historyId, noteId: "string", eventId: historyId, taskId: null, taskStatus: null, dueAt: null, replayed: false });
    psql("future_write", `insert into public.tasks(owner_id,lead_id,description,due_at,status,idempotency_key) values ('${advisorId}','${occupiedLeadId}','Manual','2026-09-20','pending',repeat('a',64));`);
    error(write(randomUUID(), occupiedLeadId, "Manual occupied", createdDueAt), "TASK_OCCUPANCY_CONFLICT");
    psql("future_write", `update public.tasks set status='completed' where lead_id='${occupiedLeadId}'; insert into public.tasks(owner_id,lead_id,description,due_at,status,idempotency_key) values ('${actorId}','${occupiedLeadId}','Foreign','2026-09-21','in_progress',repeat('b',64));`);
    error(write(randomUUID(), occupiedLeadId, "Foreign occupied", createdDueAt), "TASK_OCCUPANCY_CONFLICT");
    psql("future_write", `insert into public.tasks(owner_id,lead_id,description,due_at,status,idempotency_key) values ('${advisorId}','${occupiedLeadId}','Second active','2026-09-22','pending',repeat('c',64));`);
    error(write(randomUUID(), occupiedLeadId, "Multiple occupied", createdDueAt), "TASK_OCCUPANCY_CONFLICT");
    psql("future_write", `update public.tasks set status=case when owner_id='${advisorId}' then 'completed' else 'canceled' end where lead_id='${occupiedLeadId}';`);
    const createdId = randomUUID();
    const created = write(createdId, occupiedLeadId, "Create after terminal", createdDueAt);
    assert.deepEqual({ ...created, noteId: typeof created.noteId, taskId: typeof created.taskId }, { ok: true, outcome: "created", requestId: createdId, noteId: "string", eventId: createdId, taskId: "string", taskStatus: "pending", dueAt: createdDueAt, replayed: false });
    assert.equal(psql("future_write", `select count(*)=1 and bool_and(t.owner_id='${advisorId}' and t.lead_id='${occupiedLeadId}' and t.quote_id is null and t.description='Follow up with lead' and t.due_at='${createdDueAt}' and t.status='pending' and t.idempotency_key=lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=${createdId}','UTF8'),'sha256'),'hex')) and t.task_kind='follow_up' and t.source_event_id='${createdId}' and t.source_event_type='follow_up_registered' and t.source_event_created_at=e.created_at and t.source_due_at='${createdDueAt}' and t.source_payload=e.payload and t.metadata=jsonb_build_object('schema','follow_up_task.v1','source_event_id','${createdId}','source_event_type','follow_up_registered','owner_id','${advisorId}','lead_id','${occupiedLeadId}')) from public.tasks t join public.lead_events e on e.id=t.source_event_id where t.id='${created.taskId}';`), "t");

    const immutableBefore = psql("future_write", `select row(id,owner_id,lead_id,quote_id,description,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata)::text from public.tasks where id='${rescheduledTaskId}';`);
    const firstReschedule = randomUUID();
    const firstResult = write(firstReschedule, leadId, "First reschedule", createdDueAt);
    assert.deepEqual({ taskId: firstResult.taskId, taskStatus: firstResult.taskStatus }, { taskId: rescheduledTaskId, taskStatus: "in_progress" });
    assert.equal(psql("future_write", `select row(id,owner_id,lead_id,quote_id,description,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata)::text from public.tasks where id='${rescheduledTaskId}';`), immutableBefore);
    const historyAfterTask = randomUUID();
    assert.equal(write(historyAfterTask, leadId, "History keeps due", null).outcome, "history_only");
    assert.equal(psql("future_write", `select due_at='${createdDueAt}' and status='in_progress' from public.tasks where id='${rescheduledTaskId}';`), "t");

    psql("future_write", `create function public.slow_future_note() returns trigger language plpgsql as $$begin if new.body like 'Slow %' then perform pg_sleep(1); end if; return new; end$$; create trigger slow_future_note before insert on public.lead_notes for each row execute function public.slow_future_note();`);
    const sameId = randomUUID();
    const sameResults = await Promise.all([psqlAsync("future_write", writeSql(sameId, concurrentLeadId, "Slow same", createdDueAt)), psqlAsync("future_write", writeSql(sameId, concurrentLeadId, "Slow same", createdDueAt))]);
    assert.deepEqual(sameResults.map(parseLastJson).map((value) => value.replayed).sort(), [false, true]);
    assert.equal(psql("future_write", `select (select count(*) from public.lead_events where id='${sameId}')||'|'||(select count(*) from public.lead_notes where lead_id='${concurrentLeadId}')||'|'||(select count(*) from public.tasks where lead_id='${concurrentLeadId}');`), "1|1|1");
    psql("future_write", `update public.tasks set status='in_progress' where lead_id='${concurrentLeadId}' and status='pending';`);
    const earlierId = randomUUID();
    const laterId = randomUUID();
    const earlier = psqlAsync("future_write", writeSql(earlierId, concurrentLeadId, "Slow earlier", createdDueAt));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const later = psqlAsync("future_write", writeSql(laterId, concurrentLeadId, "Later", rescheduledDueAt));
    assert.deepEqual((await Promise.all([earlier, later])).map(parseLastJson).map((value) => value.outcome), ["rescheduled", "rescheduled"]);
    assert.equal(write(earlierId, concurrentLeadId, "Slow earlier", createdDueAt).replayed, true);
    assert.equal(psql("future_write", `select due_at='${rescheduledDueAt}' and status='in_progress' from public.tasks where lead_id='${concurrentLeadId}' and status='in_progress';`), "t");

    const rollbackId = randomUUID();
    psql("future_write", `create function public.fail_future_task() returns trigger language plpgsql as $$begin if new.source_event_id='${rollbackId}' then raise exception 'forced later failure'; end if; return new; end$$; create trigger fail_future_task before insert on public.tasks for each row execute function public.fail_future_task();`);
    assert.throws(() => write(rollbackId, rollbackLeadId, "Rollback", createdDueAt), /forced later failure/);
    assert.equal(psql("future_write", `select (select count(*) from public.lead_notes where lead_id='${rollbackLeadId}')=0 and (select count(*) from public.lead_events where id='${rollbackId}')=0 and (select count(*) from public.tasks where source_event_id='${rollbackId}')=0;`), "t");
    assert.equal(psql("future_write", `select not has_function_privilege('anon','public.register_follow_up_action(text,uuid,text,text,text)','execute') and not has_function_privilege('service_role','public.register_follow_up_action(text,uuid,text,text,text)','execute');`), "t");
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
