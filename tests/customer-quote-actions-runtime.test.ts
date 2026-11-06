import assert from "node:assert/strict";
import test from "node:test";
import { actorSession, applyMigration, psql, psqlAsync, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime";
import { parityBodySql, portalActors as actors, portalId, portalPdfHash, portalRpc, preparePortalQuotesDatabase, registerPortalQuote, sqlJson } from "./helpers/customer-quotes-runtime";

test("verified customer quote mutations are isolated, replay-safe, atomic and staff-compatible", {
  skip: process.env.RUN_CUSTOMER_QUOTES_DB_TESTS !== "1", timeout: 360_000,
}, async t => withPostgresContainer(async () => {
  const priorParity = preparePortalQuotesDatabase(90);
  const staffDefinitions = () => psql("quote_base", `select md5(string_agg(pg_get_functiondef(p.oid),'|' order by p.oid))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and (p.proname like 'crm_%' or p.proname='task_action' or p.proname like 'task_automation_%');`);
  const priorStaff = staffDefinitions();
  const legacy = registerPortalQuote(portalId(22), "legacy_differential", false);
  const legacyLock = psql("quote_base", `select lock_version from public.quotes where id='${legacy.quoteId}';`);
  const legacyCommand = `${actorSession(actors.admin)} begin;
    select * from public.crm_accept_quote('${legacy.quoteId}','${legacy.versionId}',${legacyLock},null,null,'legacy_differential_accept');
    select json_build_object('status',status,'accepted_version',accepted_version_id)::text from public.quotes where id='${legacy.quoteId}'; rollback;`;
  const priorLegacyOutput = psql("quote_base", legacyCommand);
  applyMigration("quote_base", "0091_customer_quote_reads_and_terms.sql");
  applyMigration("quote_base", "0092_customer_quote_actions.sql");
  assert.equal(staffDefinitions(), priorStaff, "all existing CRM, Task action and automation function definitions remain identical");
  assert.equal(psql("quote_base", legacyCommand), priorLegacyOutput, "existing ready-acceptance RPC output and commercial state match the pre-Week05 baseline");
  assert.equal(psql("quote_base", parityBodySql), priorParity, "existing parity-check bodies remain byte-identical");
  assert.equal(psql("quote_base", `select bool_and(prosecdef and proconfig=array['search_path=""'] and not has_function_privilege('authenticated',oid,'execute'))
    from pg_proc where oid in ('public.validate_task_automation_task_parity()'::regprocedure,'public.validate_task_automation_origin_parity()'::regprocedure);`), "t");
  const a = registerPortalQuote(), b = registerPortalQuote(portalId(22), "actions_b");
  const initialLock = psql("quote_base", `select lock_version from public.quotes where id='${a.quoteId}';`);
  assert.deepEqual(portalRpc(actors.alice, `public.accept_customer_quote('${portalId(49)}','${a.quoteId}','${a.versionId}',${initialLock},'${portalId(99)}','${"0".repeat(64)}','${portalPdfHash}',true)`), { ok: false, code: "TERMS_REQUIRED" });
  assert.equal(psql("quote_base", "select count(*) from public.quote_acceptances;"), "0");
  const detail = () => portalRpc(actors.alice, `public.read_customer_quote('${a.quoteId}',null,null)`);
  const terms1 = portalRpc(actors.admin, "public.publish_portal_quote_terms('test-actions-v1','TEST ONLY approved proposal conditions version one.')");
  assert.equal(terms1.ok, true);
  const view = detail();
  const accept = (requestId: string, overrides: Record<string, unknown> = {}) => {
    const value = { requestId, quoteId: a.quoteId, versionId: a.versionId, lock: view.quote.lockVersion,
      termsId: view.terms.termsId, termsHash: view.terms.sha256, pdfHash: portalPdfHash, consent: true, ...overrides };
    return `public.accept_customer_quote('${value.requestId}','${value.quoteId}','${value.versionId}',${value.lock},'${value.termsId}','${value.termsHash}','${value.pdfHash}',${value.consent})`;
  };
  const state = () => psql("quote_base", `select encode(extensions.digest(jsonb_build_array(
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.quotes x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.quote_versions x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.tasks x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.quote_events x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.lead_events x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.task_action_receipts x),
    (select jsonb_agg(to_jsonb(x) order by x.outcome_key) from public.task_automation_outcomes x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.quote_acceptances x),
    (select jsonb_agg(to_jsonb(x) order by x.id) from public.customer_requests x),
    (select jsonb_agg(to_jsonb(x) order by x.event_id) from public.portal_quote_work x))::text,'sha256'),'hex');`);
  await t.test("cross-customer, stale, unconsented and changed terms/PDF requests cause zero mutations", () => {
    for (const [actor, args] of [
      [actors.bob, {}], [actors.alice, { lock: view.quote.lockVersion + 1 }], [actors.alice, { consent: false }],
      [actors.alice, { termsHash: "b".repeat(64) }], [actors.alice, { pdfHash: "b".repeat(64) }],
      [actors.alice, { versionId: b.versionId }],
    ] as const) {
      const before = state();
      assert.equal(portalRpc(actor, accept(portalId(50), args)).ok, false);
      assert.equal(state(), before);
    }
    const newer = portalRpc(actors.admin, "public.publish_portal_quote_terms('test-actions-v2','TEST ONLY approved proposal conditions version two.')");
    assert.equal(newer.ok, true);
    const before = state();
    assert.equal(portalRpc(actors.alice, accept(portalId(50))).ok, false);
    assert.equal(state(), before);
  });
  const current = detail();
  const acceptedCall = accept(portalId(51), { termsId: current.terms.termsId, termsHash: current.terms.sha256 });
  await t.test("expired, ready and noncurrent sent versions cannot be customer-accepted", () => {
    psql("quote_base", `insert into public.leads(id,contact_id,status_id,assigned_to) values('${portalId(23)}','${portalId(11)}','${portalId(13)}','${actors.advisor}');`);
    const expired = registerPortalQuote(portalId(23), "expired", true, "2000-01-01");
    const ready = registerPortalQuote(portalId(23), "unsent", false);
    const older = registerPortalQuote(portalId(23), "noncurrent");
    const beforeNew = psql("quote_base", `select lock_version from public.quotes where id='${older.quoteId}';`);
    psql("quote_base", `${actorSession(actors.admin)} select * from public.crm_add_quote_version('${older.quoteId}',${beforeNew},'PRIVATE NEW DRAFT',null,'MXN',1500,300,'2099-12-31','PRIVATE',null,null,'new_private_version');`);
    for (const target of [expired, ready, older]) {
      const lock = Number(psql("quote_base", `select lock_version from public.quotes where id='${target.quoteId}';`));
      const before = state();
      assert.equal(portalRpc(actors.alice, accept(portalId(55), { quoteId: target.quoteId, versionId: target.versionId, lock, termsId: current.terms.termsId, termsHash: current.terms.sha256 })).ok, false);
      assert.equal(state(), before);
    }
    const olderView = portalRpc(actors.alice, `public.read_customer_quote('${older.quoteId}','${older.versionId}',null)`);
    assert.equal(olderView.version.current, false);
    assert.equal(JSON.stringify(olderView).includes("PRIVATE"), false);
  });
  await t.test("concurrent acceptance records one exact immutable proof, task and event without winning the Opportunity", async () => {
    const results = await Promise.all([1, 2].map(() => psqlAsync("quote_base", `${actorSession(actors.alice)} select (${acceptedCall})::text;`)));
    assert.equal(sqlJson(results[0]).ok, true);
    assert.deepEqual(sqlJson(results[0]), sqlJson(results[1]));
    assert.equal(psql("quote_base", "select count(*) from public.quote_acceptances;"), "1");
    assert.equal(psql("quote_base", `select count(*) from public.quote_events where quote_id='${a.quoteId}' and event_type='quote_accepted';`), "1");
    const proof = sqlJson(psql("quote_base", "select to_jsonb(x)::text from public.quote_acceptances x;"));
    assert.equal(proof.customer_id, actors.alice); assert.equal(proof.contact_id, portalId(11));
    assert.equal(proof.quote_version_id, a.versionId); assert.equal(proof.document_sha256, portalPdfHash);
    assert.equal(proof.terms_id, current.terms.termsId); assert.equal(proof.terms_body, current.terms.body);
    assert.equal(proof.source, "customer_portal.v1");
    assert.equal(psql("quote_base", `select status from public.quote_versions where id='${a.versionId}';`), "accepted");
    assert.equal(psql("quote_base", `select status_id from public.leads where id='${portalId(21)}';`), portalId(13));
    assert.equal(psql("quote_base", `select count(*) from public.portal_quote_work w join public.tasks t on t.id=w.task_id where w.quote_id='${a.quoteId}' and t.owner_id='${actors.advisor}' and t.due_at=w.event_at+interval '24 hours';`), "1");
    assert.throws(() => psql("quote_base", `update public.quote_acceptances set terms_body='changed';`), /IMMUTABLE/);
    const publicView = detail(); assert.equal(publicView.acceptance.acceptanceId, proof.id);
    assert.equal(JSON.stringify(publicView).includes("PRIVATE"), false);
    assert.equal(portalRpc(actors.admin, "public.publish_portal_quote_terms('test-actions-v3','TEST ONLY later approved conditions.')").ok, true);
    assert.equal(detail().terms.termsId, proof.terms_id, "accepted terms remain the exact agreed snapshot");
  });
  await t.test("existing staff response events still cancel follow-up without fabricating customer requests", () => {
    const response = portalRpc(actors.advisor, `public.crm_record_quote_version_response('${portalId(71)}','${actors.advisor}','${b.quoteId}','${b.versionId}','email')`);
    assert.equal(response.ok, true);
    assert.equal(psql("quote_base", `select actor_id from public.quote_events where id='${portalId(71)}';`), actors.advisor);
    assert.equal(psql("quote_base", "select count(*) from public.customer_requests;"), "0");
    assert.equal(psql("quote_base", `select count(*) from public.portal_quote_work where kind='quote_change';`), "0");
  });
  await t.test("requests cancel exact-version follow-up, replay once, and remain customer-attributed", async () => {
    const lock = detail().quote.lockVersion, body = "Please change the departure date. TEST ONLY.";
    const call = `public.request_customer_quote_change('${portalId(52)}','${a.quoteId}','${a.versionId}',${lock},${sqlLiteral(body)})`;
    const first = portalRpc(actors.alice, call);
    assert.equal(first.ok, true); assert.deepEqual(portalRpc(actors.alice, call), first);
    assert.equal(portalRpc(actors.bob, call).ok, false);
    const conflict = call.replace(body, "Different text"); const before = state();
    assert.equal(portalRpc(actors.alice, conflict).ok, false); assert.equal(state(), before);
    const row = sqlJson(psql("quote_base", "select to_jsonb(x)::text from public.customer_requests x;"));
    assert.equal(row.customer_id, actors.alice);
    assert.equal(psql("quote_base", `select w.event_at=r.created_at from public.portal_quote_work w join public.customer_requests r on r.response_event_id=w.event_id where r.id='${row.id}';`), "t");
    assert.equal(psql("quote_base", `select actor_id is null from public.quote_events where id='${row.response_event_id}';`), "t");
    assert.equal(psql("quote_base", `select count(*) from public.portal_quote_work where kind='quote_change';`), "1");
    assert.equal(portalRpc(actors.advisor, "public.read_portal_quote_work(null,null)").items.length, 2);
    assert.equal(portalRpc(actors.alice, "public.read_portal_quote_work(null,null)").ok, false);
    assert.equal(detail().requests[0].requestId, row.id);
    const action = `public.manage_portal_quote_work('${row.response_event_id}','${portalId(70)}','completed',null)`;
    assert.equal(portalRpc(actors.alice, action).ok, false);
    const completed = portalRpc(actors.advisor, action);
    assert.equal(completed.ok, true);
    assert.deepEqual(portalRpc(actors.advisor, action), completed);
    assert.equal(detail().requests[0].status, "completed");
    assert.equal(psql("quote_base", `select actor_kind||':'||actor_id::text from public.task_action_receipts where id='${completed.receiptId}';`), `human:${actors.advisor}`);
  });
  await t.test("inactive owner creates Admin intake; claiming creates one Task at the original due time", () => {
    psql("quote_base", `update public.profiles set is_active=false where id='${actors.advisor}';`);
    const lock = Number(psql("quote_base", `select lock_version from public.quotes where id='${b.quoteId}';`));
    const call = `public.request_customer_quote_change('${portalId(53)}','${b.quoteId}','${b.versionId}',${lock},'Please revise this proposal. TEST ONLY.')`;
    assert.equal(portalRpc(actors.bob, call).ok, true);
    const work = portalRpc(actors.admin, "public.read_portal_quote_work(null,null)").items.find((item: { quoteId: string }) => item.quoteId === b.quoteId);
    assert.equal(work.taskId, null);
    const claimed = portalRpc(actors.admin, `public.claim_portal_quote_work('${work.eventId}')`);
    assert.equal(claimed.ok, true); assert.deepEqual(portalRpc(actors.admin, `public.claim_portal_quote_work('${work.eventId}')`), claimed);
    assert.equal(psql("quote_base", `select due_at=event_at+interval '24 hours' from public.portal_quote_work where event_id='${work.eventId}';`), "t");
    psql("quote_base", `update public.profiles set is_active=true where id='${actors.advisor}';`);
  });
  await t.test("customer cannot replace accepted proposals; canonical staff ready acceptance still works", () => {
    const other = registerPortalQuote(portalId(21), "competing_a");
    const data = portalRpc(actors.alice, `public.read_customer_quote('${other.quoteId}',null,null)`);
    const before = state();
    assert.equal(portalRpc(actors.alice, accept(portalId(54), { quoteId: other.quoteId, versionId: other.versionId, lock: data.quote.lockVersion, termsId: data.terms.termsId, termsHash: data.terms.sha256 })).ok, false);
    assert.equal(state(), before);
    const staff = registerPortalQuote(portalId(22), "staff_ready", false);
    const lock = psql("quote_base", `select lock_version from public.quotes where id='${staff.quoteId}';`);
    psql("quote_base", `${actorSession(actors.admin)} select * from public.crm_accept_quote('${staff.quoteId}','${staff.versionId}',${lock},null,null,'legacy_ready_accept');`);
    assert.equal(psql("quote_base", `select status from public.quotes where id='${staff.quoteId}';`), "accepted");
    const replacement = registerPortalQuote(portalId(22), "staff_replacement");
    const replacementLock = psql("quote_base", `select lock_version from public.quotes where id='${replacement.quoteId}';`);
    psql("quote_base", `${actorSession(actors.admin)} select * from public.crm_accept_quote('${replacement.quoteId}','${replacement.versionId}',${replacementLock},'${staff.quoteId}','TEST ONLY explicit replacement','staff_explicit_replace');`);
    const historical = portalRpc(actors.bob, `public.read_customer_quote('${staff.quoteId}','${staff.versionId}',null)`);
    assert.equal(historical.ok, true); assert.equal(historical.version.status, "superseded"); assert.equal(historical.version.canAccept, false);
  });
  await t.test("a late staff-work failure rolls back commercial state, evidence, Tasks and events", () => {
    psql("quote_base", `insert into public.leads(id,contact_id,status_id,assigned_to) values('${portalId(24)}','${portalId(11)}','${portalId(13)}','${actors.advisor}');`);
    const target = registerPortalQuote(portalId(24), "atomic");
    const data = portalRpc(actors.alice, `public.read_customer_quote('${target.quoteId}',null,null)`);
    const call = accept(portalId(56), { quoteId: target.quoteId, versionId: target.versionId, lock: data.quote.lockVersion, termsId: data.terms.termsId, termsHash: data.terms.sha256 });
    psql("quote_base", `create function public.portal_test_failure() returns trigger language plpgsql as $$ begin raise exception 'TEST_ONLY_WRITE_FAILURE'; end $$;
      create trigger portal_test_failure before insert on public.portal_quote_work for each row execute function public.portal_test_failure();`);
    const before = state();
    assert.throws(() => portalRpc(actors.alice, call), /TEST_ONLY_WRITE_FAILURE/);
    assert.equal(state(), before);
    psql("quote_base", "drop trigger portal_test_failure on public.portal_quote_work; drop function public.portal_test_failure();");
    assert.equal(portalRpc(actors.alice, call).ok, true);
  });
  async function waitForSession(name: string, waiting: boolean) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const found = psql("quote_base", `select exists(select 1 from pg_stat_activity where application_name='${name}'
        and wait_event_type='${waiting ? "Lock" : "Timeout"}');`);
      if (found === "t") return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail(`Expected ${name} to ${waiting ? "wait for a lock" : "hold its transaction during pg_sleep"}`);
  }
  await t.test("historical-bootstrap exclusive universe guard blocks customer writes until release", async () => {
    const lock = detail().quote.lockVersion;
    const before = state();
    const holder = psqlAsync("quote_base", "set application_name='portal_universe_holder'; begin; select pg_advisory_xact_lock(3825938359965795805); select pg_sleep(5); commit;");
    let customer: Promise<string> | undefined;
    try {
      await waitForSession("portal_universe_holder", false);
      customer = psqlAsync("quote_base", `set application_name='portal_universe_customer'; ${actorSession(actors.alice)}
        select public.request_customer_quote_change('${portalId(57)}','${a.quoteId}','${a.versionId}',${lock},'TEST ONLY universe contention.')::text;`);
      await waitForSession("portal_universe_customer", true);
      assert.equal(state(), before, "blocked customer has not written evidence, events or work");
      await holder;
      assert.equal(sqlJson(await customer).ok, true);
      assert.equal(psql("quote_base", `select count(*) from public.customer_requests where request_id='${portalId(57)}';`), "1");
    } finally { await Promise.allSettled([holder, ...(customer ? [customer] : [])]); }
  });
  await t.test("staff version mutation serializes customer acceptance and rejects its stale view without evidence", async () => {
    psql("quote_base", `insert into public.leads(id,contact_id,status_id,assigned_to) values('${portalId(25)}','${portalId(11)}','${portalId(13)}','${actors.advisor}');`);
    const target = registerPortalQuote(portalId(25), "staff_race");
    const data = portalRpc(actors.alice, `public.read_customer_quote('${target.quoteId}',null,null)`);
    const call = accept(portalId(58), { quoteId: target.quoteId, versionId: target.versionId, lock: data.quote.lockVersion, termsId: data.terms.termsId, termsHash: data.terms.sha256 });
    const staff = psqlAsync("quote_base", `set application_name='portal_staff_holder'; ${actorSession(actors.admin)} begin;
      select * from public.crm_add_quote_version('${target.quoteId}',${data.quote.lockVersion},'TEST ONLY newer version',null,'MXN',1600,300,'2099-12-31',null,null,null,'staff_race_version');
      select pg_sleep(5); commit;`);
    let customer: Promise<string> | undefined;
    try {
      await waitForSession("portal_staff_holder", false);
      customer = psqlAsync("quote_base", `set application_name='portal_staff_customer'; ${actorSession(actors.alice)} select (${call})::text;`);
      await waitForSession("portal_staff_customer", true);
      await staff;
      assert.equal(sqlJson(await customer).ok, false);
      assert.equal(psql("quote_base", `select count(*) from public.quote_acceptances where quote_id='${target.quoteId}';`), "0");
      assert.equal(psql("quote_base", `select count(*) from public.quote_events where quote_id='${target.quoteId}' and actor_id is null;`), "0");
      assert.equal(psql("quote_base", `select count(*) from public.portal_quote_work where quote_id='${target.quoteId}';`), "0");
      assert.equal(psql("quote_base", `select count(*) from public.quote_versions where quote_id='${target.quoteId}';`), "2");
    } finally { await Promise.allSettled([staff, ...(customer ? [customer] : [])]); }
  });
}));
