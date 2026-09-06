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
  serviceSession,
  sqlLiteral,
  waitForPostgres,
} from "./helpers/postgres-runtime";
const enabled = process.env.RUN_QUOTE_REGISTRATION_DB_TESTS === "1";
const adminId = "11111111-1111-4111-8111-111111111111";
const advisorId = "22222222-2222-4222-8222-222222222222";
const contactId = "33333333-3333-4333-8333-333333333333";
const opportunityId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const statusId = "66666666-6666-4666-8666-666666666666";
const advisorySha = "a".repeat(64);

function beginSql(key: string, actorId = adminId, request: string | null = requestId, sha = advisorySha, size = 20) {
  return `${actorSession(actorId)}
    select row_to_json(result)::text
    from public.crm_begin_quote_registration(
      '${opportunityId}', '  Initial PDF quote  ', '  Commercial summary  ',
      'MXN', 1250, 250, '2026-12-31', '  Internal note  ',
      ${request ? sqlLiteral(request) : "null"}::uuid, ${size}, '${sha}', '${key}'
    ) result;
  `;
}

function registerSql(intentId: string, sha = advisorySha, size = 20) {
  return `${serviceSession()}
    select row_to_json(result)::text
    from public.crm_register_quote_with_pdf('${intentId}', ${size}, '${sha}') result;
  `;
}

function parseRow<T>(output: string): T {
  const line = output.split("\n").findLast((value) => value.trim().startsWith("{"));
  assert.ok(line, `Expected a JSON row, received: ${output}`);
  return JSON.parse(line) as T;
}

function prepareDatabase(database: string, includeCutover: boolean) {
  psql("postgres", `create database ${database} template quote_base;`);
  if (includeCutover) applyMigration(database, "0057_quote_rpc_cutover.sql");
  applyMigration(database, "0058_fix_legacy_quote_document_link_ambiguity.sql");
  applyMigration(database, "0059_quote_registration_intents.sql");
  psql(database, `
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant select on all tables in schema public to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated, service_role;
  `);
}

function seed(database: string) {
  psql(database, `
    insert into auth.users (id, email) values
      ('${adminId}', 'admin@example.test'),
      ('${advisorId}', 'advisor@example.test');
    insert into public.profiles (id, full_name, is_active) values
      ('${adminId}', 'Runtime Admin', true),
      ('${advisorId}', 'Runtime Advisor', true);
    insert into public.roles (name, description) values
      ('admin', 'Admin'), ('asesor', 'Advisor')
    on conflict (name) do nothing;
    insert into public.profile_roles (profile_id, role_id)
    select '${adminId}', id from public.roles where name = 'admin';
    insert into public.profile_roles (profile_id, role_id)
    select '${advisorId}', id from public.roles where name = 'asesor';
    insert into public.lead_statuses (id, name, label_es, label_en, sort_order, is_terminal)
    values ('${statusId}', 'runtime_open', 'Abierta', 'Open', 1, false);
    insert into public.contacts (id, first_name, email)
    values ('${contactId}', 'Runtime', 'runtime@example.test');
    insert into public.leads (id, contact_id, status_id, assigned_to, summary)
    values ('${opportunityId}', '${contactId}', '${statusId}', '${adminId}', 'Runtime opportunity');
    insert into public.quote_requests (id, lead_id, contact_id, status)
    values ('${requestId}', '${opportunityId}', '${contactId}', 'received');
  `);
}

function insertObject(database: string, path: string, size: number, mime = "application/pdf", asActor = true) {
  const prefix = asActor ? actorSession(adminId) : "";
  return psql(database, `${prefix}
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('quote-pdfs', ${sqlLiteral(path)}, '${adminId}', jsonb_build_object('size', '${size}', 'mimetype', '${mime}'));
  `);
}

test("0059 and 0060 apply on live-compatible and full chains and enforce registration cutover contracts", {
  skip: !enabled,
  timeout: 240_000,
}, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage]);
  try {
    await waitForPostgres();

    prepareBaseDatabase();
    prepareDatabase("quote_live", false);
    prepareDatabase("quote_full", true);
    seed("quote_live");
    seed("quote_full");
    for (const database of ["quote_live", "quote_full"]) {
      const historical = parseRow<{ quote_id: string }>(psql(database, `${actorSession(adminId)}
        select row_to_json(result)::text from public.crm_create_quote(
          '${opportunityId}', 'Historical quote', null, 'MXN', 100, 20,
          null, null, null, 'historical_before_0060'
        ) result;
      `));
      applyMigration(database, "0060_quote_pdf_creation_cutover.sql");
      assert.equal(psql(database, "select to_regclass('public.quote_registration_intents') is not null;"), "t");
      assert.equal(psql(database, "select to_regprocedure('public.crm_create_quote(uuid,text,text,text,numeric,numeric,date,text,uuid,text)') is null;"), "t");
      assert.equal(psql(database, "select to_regprocedure('public.crm_link_legacy_quote_document(uuid,uuid,text)') is null;"), "t");
      assert.equal(psql(database, "select to_regprocedure('public.crm_accept_quote_version(uuid,uuid)') is null;"), "t");
      assert.equal(psql(database, `select count(*) from public.quotes where id = '${historical.quote_id}' and registration_intent_id is null;`), "1");
      assert.throws(() => psql(database, `
        begin;
        insert into public.quotes (contact_id, lead_id, title, status, owner_id, created_by, next_version_number, idempotency_key)
        values ('${contactId}', '${opportunityId}', 'Bypass', 'draft', '${adminId}', '${adminId}', 1, 'direct_bypass_${database}');
        commit;
      `), /Every new quote must commit with a finalized registration intent/i);
    }

    const begun = parseRow<{
      intent_id: string;
      target_quote_id: string;
      target_quote_version_id: string;
      target_document_id: string;
      path: string;
      intent_status: string;
      attempt_count: number;
      idempotent_replay: boolean;
    }>(psql("quote_live", beginSql("runtime_success")));
    assert.equal(begun.intent_status, "pending");
    assert.equal(begun.attempt_count, 1);
    assert.equal(begun.idempotent_replay, false);
    assert.equal(psql("quote_live", `
      select
        (select count(*) from public.quotes where id = '${begun.target_quote_id}') || ',' ||
        (select count(*) from public.quote_versions where id = '${begun.target_quote_version_id}') || ',' ||
        (select count(*) from public.documents where id = '${begun.target_document_id}');
    `), "0,0,0");

    const replay = parseRow<typeof begun>(psql("quote_live", beginSql("runtime_success")));
    assert.equal(replay.intent_id, begun.intent_id);
    assert.equal(replay.idempotent_replay, true);
    assert.equal(replay.attempt_count, 1);

    assert.throws(() => insertObject("quote_live", `${begun.path}.wrong`, 20), /row-level security|violates row-level security/i);
    insertObject("quote_live", begun.path, 20);
    assert.throws(() => psql("quote_live", `${actorSession(adminId)}
      select * from public.crm_register_quote_with_pdf('${begun.intent_id}', 20, '${advisorySha}');
    `), /permission denied|trusted server boundary/i);
    assert.throws(() => psql("quote_live", `${actorSession(adminId)}
      insert into storage.objects (bucket_id, name, metadata)
      values ('quote-pdfs', ${sqlLiteral(begun.path)}, '{}'::jsonb)
      on conflict (bucket_id, name) do update set metadata = excluded.metadata;
    `), /row-level security|permission denied/i);

    const finalized = parseRow<{
      quote_id: string;
      quote_version_id: string;
      document_id: string;
      quote_status: string;
      version_status: string;
      document_state: string;
      idempotent_replay: boolean;
    }>(psql("quote_live", registerSql(begun.intent_id)));
    assert.equal(finalized.quote_id, begun.target_quote_id);
    assert.equal(finalized.quote_version_id, begun.target_quote_version_id);
    assert.equal(finalized.document_id, begun.target_document_id);
    assert.equal(finalized.quote_status, "ready");
    assert.equal(finalized.version_status, "ready");
    assert.equal(finalized.document_state, "ready");
    assert.equal(finalized.idempotent_replay, false);
    assert.equal(psql("quote_live", `
      select
        (select count(*) from public.quotes where registration_intent_id = '${begun.intent_id}' and status = 'ready') || ',' ||
        (select count(*) from public.quote_versions where id = '${begun.target_quote_version_id}' and version_number = 1 and status = 'ready' and finalized_at is not null) || ',' ||
        (select count(*) from public.documents where id = '${begun.target_document_id}' and storage_state = 'ready' and sha256 = '${advisorySha}') || ',' ||
        (select count(*) from public.quote_events where quote_id = '${begun.target_quote_id}' and event_type = 'quote_registered_with_pdf') || ',' ||
        (select count(*) from public.lead_events where lead_id = '${opportunityId}' and event_type = 'quote_registered_with_pdf');
    `), "1,1,1,1,1");
    const finalizedReplay = parseRow<{ idempotent_replay: boolean }>(psql("quote_live", registerSql(begun.intent_id)));
    assert.equal(finalizedReplay.idempotent_replay, true);

    const invalid = parseRow<typeof begun>(psql("quote_live", beginSql("runtime_invalid_file", adminId, requestId, "b".repeat(64), 10)));
    insertObject("quote_live", invalid.path, 11, "application/pdf", false);
    assert.throws(() => psql("quote_live", registerSql(invalid.intent_id, "b".repeat(64), 10)), /metadata or timing does not match/i);
    assert.equal(psql("quote_live", `select count(*) from public.quotes where id = '${invalid.target_quote_id}';`), "0");

    assert.throws(() => psql("quote_live", beginSql("runtime_unassigned", advisorId, null)), /assigned advisor|administrator/i);
    assert.throws(() => psql("quote_live", beginSql("runtime_bad_request", adminId, "77777777-7777-4777-8777-777777777777")), /Originating request must belong/i);

    const failed = parseRow<typeof begun>(psql("quote_live", beginSql("runtime_failure", adminId, null)));
    insertObject("quote_live", failed.path, 20);
    const failureResult = parseRow<{ intent_status: string; idempotent_replay: boolean }>(psql("quote_live", `${actorSession(adminId)}
      select row_to_json(result)::text
      from public.crm_fail_quote_registration('${failed.intent_id}', 'runtime_upload_failed', 'Safe deterministic runtime failure') result;
    `));
    assert.equal(failureResult.intent_status, "failed");
    assert.equal(failureResult.idempotent_replay, false);
    assert.equal(psql("quote_live", `select count(*) from public.quotes where id = '${failed.target_quote_id}';`), "0");
    psql("quote_live", `${actorSession(adminId)}
      delete from storage.objects where bucket_id = 'quote-pdfs' and name = ${sqlLiteral(failed.path)};
    `);
    assert.equal(psql("quote_live", `select count(*) from storage.objects where bucket_id = 'quote-pdfs' and name = ${sqlLiteral(failed.path)};`), "0");
    const retried = parseRow<typeof begun>(psql("quote_live", beginSql("runtime_failure", adminId, null)));
    assert.equal(retried.intent_id, failed.intent_id);
    assert.equal(retried.attempt_count, 2);
    assert.equal(retried.idempotent_replay, false);

    const concurrent = parseRow<typeof begun>(psql("quote_live", beginSql("runtime_concurrent", adminId, null)));
    insertObject("quote_live", concurrent.path, 20);
    const concurrentResults = await Promise.all([
      psqlAsync("quote_live", registerSql(concurrent.intent_id)),
      psqlAsync("quote_live", registerSql(concurrent.intent_id)),
    ]);
    const concurrentRows = concurrentResults.map((result) => parseRow<{ idempotent_replay: boolean }>(result));
    assert.deepEqual(concurrentRows.map((row) => row.idempotent_replay).sort(), [false, true]);
    assert.equal(psql("quote_live", `
      select
        (select count(*) from public.quotes where registration_intent_id = '${concurrent.intent_id}') || ',' ||
        (select count(*) from public.quote_versions where id = '${concurrent.target_quote_version_id}') || ',' ||
        (select count(*) from public.documents where id = '${concurrent.target_document_id}') || ',' ||
        (select count(*) from public.quote_events where quote_id = '${concurrent.target_quote_id}' and event_type = 'quote_registered_with_pdf');
    `), "1,1,1,1");
  } finally {
    cleanupPostgres();
  }
});
