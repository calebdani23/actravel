import assert from "node:assert/strict";
import test from "node:test";
import {
  actorSession,
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

const enabled = process.env.RUN_FOLLOW_UP_APPROVAL_DB_TESTS === "1";
const adminId = "11111111-1111-4111-8111-111111111111";
const advisorId = "22222222-2222-4222-8222-222222222222";
const requestId = "55555555-5555-4555-8555-555555555555";
const eventId = "66666666-6666-4666-8666-666666666666";
const nonEligibleEventId = "99999999-9999-4999-8999-999999999999";
const leadId = "77777777-7777-4777-8777-777777777777";
const ownerId = "88888888-8888-4888-8888-888888888888";
const eventAt = "2026-09-01T12:00:00.000Z";
const dueAt = "2026-09-02T12:00:00.000Z";

function parseResult(output: string) {
  const line = output.split("\n").findLast((value) => value.trim().startsWith("{"));
  assert.ok(line, `Expected JSON result, received: ${output}`);
  return JSON.parse(line) as Record<string, unknown>;
}

function parseScalarResult(output: string) {
  const line = output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).at(-1);
  assert.ok(line, `Expected scalar result, received: ${output}`);
  return line;
}

function approvalSql(actorId: string, request = requestId, readerHash = "a".repeat(64)) {
  return `set role postgres;
    create temp table approval_input as
    with values as (
      select
        ${sqlLiteral(request)}::text as request_text,
        ${sqlLiteral(readerHash)}::text as reader_hash,
        ${sqlLiteral(eventAt)}::text as event_text,
        ${sqlLiteral(eventId)}::uuid as event_id
    ), plan_values as (
      select values.*, public.follow_up_canonical_json(jsonb_build_array(
        ${sqlLiteral(eventId)}, ${sqlLiteral(leadId)}, ${sqlLiteral(ownerId)}, ${sqlLiteral(eventAt)},
        ${sqlLiteral(dueAt)}, true, ${sqlLiteral(dueAt)}, 'eligible', 'ELIGIBLE'
      )) as row_json
      from values
    ), payload as (
      select plan_values.*,
        public.follow_up_canonical_json(jsonb_build_array(
           'follow-up-backfill.v1', event_text, event_id::text,
           jsonb_build_array(row_json::jsonb, jsonb_build_array(
             ${sqlLiteral(nonEligibleEventId)}, ${sqlLiteral(leadId)}, null, ${sqlLiteral(eventAt)}, null, null, null,
             'invalid-date/no-task', 'INVALID_DATE_NO_TASK'
           )), jsonb_build_array(1, 1, 0, 0, 0, 0, 0), 2, 0, 0, 0, false
        )) as plan,
        public.follow_up_canonical_json(jsonb_build_array(
          jsonb_build_object('owner_id', ${sqlLiteral(ownerId)}, 'lead_id', ${sqlLiteral(leadId)},
            'quote_id', null, 'description', 'Follow up with lead', 'due_at', ${sqlLiteral(dueAt)},
            'status', 'pending', 'idempotency_key', lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=' || lower(${sqlLiteral(eventId)}), 'UTF8'), 'sha256'), 'hex')),
            'task_kind', 'follow_up', 'source_event_id', lower(${sqlLiteral(eventId)}), 'source_event_type', 'follow_up_registered',
            'source_event_created_at', ${sqlLiteral(eventAt)}, 'source_due_at', ${sqlLiteral(dueAt)},
            'source_payload', jsonb_build_object('followUpAt', ${sqlLiteral(dueAt)}, 'hasNote', true),
            'metadata', jsonb_build_object('schema', 'follow_up_task.v1', 'source_event_id', lower(${sqlLiteral(eventId)}),
              'source_event_type', 'follow_up_registered', 'owner_id', lower(${sqlLiteral(ownerId)}), 'lead_id', lower(${sqlLiteral(leadId)}))
          )
        )) as projection
      from plan_values
    ), hashes as (
      select payload.*, lower(encode(extensions.digest(convert_to(plan, 'UTF8'), 'sha256'), 'hex')) as plan_hash,
        lower(encode(extensions.digest(convert_to(projection, 'UTF8'), 'sha256'), 'hex')) as projection_hash
      from payload
    ), request_value as (
      select hashes.*, public.follow_up_canonical_json(jsonb_build_array(
        'follow-up-approval-request.v1', request_text, ${sqlLiteral(actorId)},
        'follow-up-approval.v1', 'follow-up-backfill.v1', jsonb_build_array(event_text, event_id::text), null,
        reader_hash, plan_hash, projection_hash, plan::jsonb, projection::jsonb
      )) as request_canonical
      from hashes
    )
    select request_text, ${sqlLiteral(actorId)}::uuid as expected_actor_id,
      'follow-up-approval.v1' as schema_version, 'follow-up-backfill.v1' as rule_version,
      event_text as event_cutoff_created_at, event_id as event_cutoff_id,
      null::text as task_cutoff_created_at, null::uuid as task_cutoff_id,
      reader_hash, plan_hash, projection_hash,
      lower(encode(extensions.digest(convert_to(request_canonical, 'UTF8'), 'sha256'), 'hex')) as request_fingerprint,
      plan, projection::jsonb
    from request_value;
    grant select on approval_input to authenticated;
    ${actorSession(actorId)}
    select public.approve_follow_up_task_plan(request_text, expected_actor_id,
      schema_version, rule_version, event_cutoff_created_at, event_cutoff_id, task_cutoff_created_at, task_cutoff_id,
      reader_hash, plan_hash, projection_hash,
      request_fingerprint,
      plan, projection::jsonb)
    from approval_input;
  `;
}

function prepareDatabase() {
  psql("postgres", "create database approval_ledger template quote_base;");
  for (const name of [
    "0057_quote_rpc_cutover.sql", "0058_fix_legacy_quote_document_link_ambiguity.sql",
    "0059_quote_registration_intents.sql", "0060_quote_pdf_creation_cutover.sql",
    "0061_manager_capability_foundation.sql", "0062_tasks_foundation.sql",
    "0063_staff_notifications_foundation.sql", "0064_follow_up_task_representation.sql",
    "0065_follow_up_task_approval_ledger.sql",
  ]) applyMigration("approval_ledger", name);
  psql("approval_ledger", `grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    insert into auth.users (id, email) values ('${adminId}', 'admin@example.test'), ('${advisorId}', 'advisor@example.test');
    insert into public.profiles (id, full_name, is_active) values ('${adminId}', 'Runtime Admin', true), ('${advisorId}', 'Runtime Advisor', true);
    insert into public.roles (name, description) values ('admin', 'Admin'), ('asesor', 'Advisor') on conflict (name) do nothing;
    insert into public.profile_roles (profile_id, role_id) select '${adminId}', id from public.roles where name = 'admin';
    insert into public.profile_roles (profile_id, role_id) select '${advisorId}', id from public.roles where name = 'asesor';`);
  psql("approval_ledger", "grant select on public.profile_roles, public.roles to authenticated;");
}

test("0065 approval ledger is authorized, immutable, replay-safe, and concurrent-safe", {
  skip: !enabled,
  timeout: 240_000,
}, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();
    prepareBaseDatabase();
    prepareDatabase();

    const approved = parseResult(psql("approval_ledger", approvalSql(adminId)));
    assert.equal(approved.ok, true, `First approval RPC response: ${JSON.stringify(approved)}`);
    assert.equal(approved.status, "approved", `First approval RPC response: ${JSON.stringify(approved)}`);
    assert.equal(psql("approval_ledger", "select count(*) from public.follow_up_task_approvals;"), "1");
    assert.equal(psql("approval_ledger", "select count(*) from public.tasks;"), "0");

    const replay = parseResult(psql("approval_ledger", approvalSql(adminId)));
    assert.equal(replay.ok, true);
    assert.equal(replay.status, "replayed");
    const conflict = parseResult(psql("approval_ledger", approvalSql(adminId, requestId, "b".repeat(64))));
    assert.deepEqual(conflict, { ok: false, error: { code: "APPROVAL_IDEMPOTENCY_CONFLICT", message: "APPROVAL_IDEMPOTENCY_CONFLICT" } });

    const required = parseResult(psql("approval_ledger", `${actorSession("")}
      select public.approve_follow_up_task_plan(null, '${adminId}', 'follow-up-approval.v1', 'follow-up-backfill.v1', '${eventAt}', '${eventId}', null, null, '${"a".repeat(64)}', '${"a".repeat(64)}', '${"a".repeat(64)}', '${"a".repeat(64)}', '[]', '[]'::jsonb);`));
    assert.deepEqual(required, { ok: false, error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } });
    assert.equal(parseScalarResult(psql("approval_ledger", `${actorSession(advisorId)} select count(*) from public.follow_up_task_approvals;`)), "0");

    const concurrent = await Promise.all([
      psqlAsync("approval_ledger", approvalSql(adminId, "99999999-9999-4999-8999-999999999999")),
      psqlAsync("approval_ledger", approvalSql(adminId, "99999999-9999-4999-8999-999999999999")),
    ]);
    assert.deepEqual(concurrent.map(parseResult).map((row) => row.status).sort(), ["approved", "replayed"]);
    assert.equal(psql("approval_ledger", "select count(*) from public.follow_up_task_approvals;"), "2");

    assert.throws(() => psql("approval_ledger", `select set_config('request.jwt.claim.sub', '${adminId}', false); select set_config('request.jwt.claim.role', 'authenticated', false); set role postgres;
      update public.follow_up_task_approvals set canonical_plan = canonical_plan where request_id = '${requestId}';`), /FOLLOW_UP_APPROVAL_IMMUTABLE/);
    assert.throws(() => psql("approval_ledger", `select set_config('request.jwt.claim.sub', '${adminId}', false); select set_config('request.jwt.claim.role', 'authenticated', false); set role postgres;
      delete from public.follow_up_task_approvals where request_id = '${requestId}';`), /FOLLOW_UP_APPROVAL_IMMUTABLE/);
    assert.equal(psql("approval_ledger", "delete from public.lead_events; select count(*) from public.follow_up_task_approvals;"), "2");
    assert.equal(psql("approval_ledger", "select count(*) from public.tasks;"), "0");
  } finally {
    cleanupPostgres();
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "");
  }
});
