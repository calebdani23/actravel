import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { canonicalHash, deterministicTaskUuid } from "../lib/admin/task-automation-historical-contract"
import { applyMigration, migrationNames, prepareBaseDatabase, psql, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime"

const enabled = process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS === "1"
const uuid = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const owner = uuid(1, 401), contact = uuid(2, 401), status = uuid(3, 401), root = uuid(4, 401), rollbackRoot = uuid(4, 402)
const quote = uuid(5, 401), version = uuid(6, 401), sent = uuid(7, 401), response = uuid(8, 401)
const generatedVersion = uuid(6, 402), generatedSent = uuid(7, 402)
const anchorAt = "2026-01-05T15:00:00.000000Z", dueAt = "2026-01-05T15:15:00.000000Z"
const json = (value: unknown) => `${sqlLiteral(JSON.stringify(value))}::jsonb`

const generate = (opportunityId: string) => {
  const sourceKey = canonicalHash(["task-automation-source.v1","opportunity_assignment",opportunityId,owner,anchorAt])
  const originKey = canonicalHash(["task-automation:v1","first_contact",opportunityId])
  return { ordinal:0,action:"generate",operationSourceKind:"opportunity_assignment",operationSourceId:opportunityId,sourceKey,sourceOrder:1,
    originKey,taskId:deterministicTaskUuid(originKey),taskKind:"first_contact",ownerId:owner,opportunityId,quoteId:null,quoteVersionId:null,
    sentEventId:null,anchorAt,dueRuleVersion:"mx-calendar.v1",dueAt,
    outcomeKey:canonicalHash(["task-automation-outcome.v1","opportunity_assignment",opportunityId,sourceKey,"generate",originKey]),tombstoneKey:null }
}

const suppress = (sourceOrder = 1) => {
  const sourceKey = canonicalHash(["task-automation-source.v1","quote_version_response",version,response])
  const originKey = canonicalHash(["task-automation:v1","quote_follow_up",version,sent])
  return { ordinal:1,action:"suppress",operationSourceKind:"quote_version_response",operationSourceId:response,sourceKey,sourceOrder,
    originKey,taskId:null,taskKind:null,ownerId:null,opportunityId:root,quoteId:quote,quoteVersionId:version,sentEventId:sent,
    anchorAt:null,dueRuleVersion:null,dueAt:null,
    outcomeKey:canonicalHash(["task-automation-outcome.v1","quote_version_response",response,sourceKey,"suppress",originKey]),
    tombstoneKey:canonicalHash(["task-automation-tombstone.v1","quote_version_response",response,sourceKey,sourceOrder,originKey,"source_invalidated"]) }
}

const generateQuote = () => {
  const sourceKey = canonicalHash(["task-automation-source.v1","quote_sent",generatedVersion,generatedSent])
  const originKey = canonicalHash(["task-automation:v1","quote_follow_up",generatedVersion,generatedSent])
  return { ordinal:2,action:"generate",operationSourceKind:"quote_sent",operationSourceId:generatedSent,sourceKey,sourceOrder:1,
    originKey,taskId:deterministicTaskUuid(originKey),taskKind:"quote_follow_up",ownerId:owner,opportunityId:root,quoteId:quote,
    quoteVersionId:generatedVersion,sentEventId:generatedSent,anchorAt,dueRuleVersion:"elapsed-48h.v1",dueAt:"2026-01-07T15:00:00.000000Z",
    outcomeKey:canonicalHash(["task-automation-outcome.v1","quote_sent",generatedSent,sourceKey,"generate",originKey]),tombstoneKey:null }
}

test("0086 declares only private exact generate/suppress writer primitives", () => {
  const sql = readFileSync("db/migrations/0086_task_automation_historical_apply_writers.sql", "utf8")
  assert.match(sql, /task_automation_historical_write_generate\(p_projection jsonb\) returns jsonb/)
  assert.match(sql, /task_automation_historical_write_suppress\(p_projection jsonb\) returns jsonb/)
  assert.match(sql, /security definer set search_path=''/)
  assert.match(sql, /TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE/)
  assert.doesNotMatch(sql, /task_automation_project|apply_task_automation_historical_plan|grant execute/i)
})

test("0087 declares the sole public receipt-first coordinator in total lock order", () => {
  const sql = readFileSync("db/migrations/0087_task_automation_historical_apply_rpc.sql", "utf8")
  assert.match(sql, /apply_task_automation_historical_plan\(p_request_id_text text,p_expected_actor_id uuid\) returns jsonb/)
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*select \* into v_receipt[\s\S]*for update[\s\S]*select \* into v_approval[\s\S]*for update[\s\S]*pg_advisory_xact_lock\(3825938359965795805\)[\s\S]*task_automation_historical_revalidate_plan[\s\S]*task_automation_historical_revalidate_live[\s\S]*for update nowait[\s\S]*task_automation_historical_write_generate[\s\S]*task_automation_historical_write_suppress[\s\S]*insert into public\.task_automation_historical_apply_receipts/i)
  assert.match(sql, /security definer set search_path=''/)
  assert.match(sql, /revoke all on function public\.apply_task_automation_historical_plan\(text,uuid\) from public,anon,authenticated,service_role;[\s\S]*grant execute on function public\.apply_task_automation_historical_plan\(text,uuid\) to authenticated;/i)
  assert.doesNotMatch(sql, /readiness|task_automation_project|grant execute[\s\S]*(anon|service_role)/i)
})

test("0086 rejects null quote suppression context without native writes", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_null_quote_context"
  await withPostgresContainer(async () => {
    prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 86)
    assert.equal(migrations.at(-1), "0086_task_automation_historical_apply_writers.sql")
    for (const name of migrations) applyMigration(database, name)
    const projection = suppress()
    const capture = (value: unknown) => psql(database, `create or replace function pg_temp.capture() returns text language plpgsql as $capture$ begin perform public.task_automation_historical_write_suppress(${json(value)}); return 'UNEXPECTED_SUCCESS'; exception when others then return sqlerrm; end $capture$; select pg_temp.capture();`).split(/\r?\n/).filter(Boolean).at(-1)
    for (const field of ["opportunityId", "quoteId", "quoteVersionId", "sentEventId"] as const) {
      assert.equal(capture({ ...projection, [field]:null }), "TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE")
      assert.equal(psql(database, `select jsonb_build_array((select count(*) from task_automation_tombstones),(select count(*) from task_automation_outcomes),(select count(*) from tasks),(select count(*) from task_automation_origins))::text;`), "[0, 0, 0, 0]")
    }
  })
})

test("0086 writes exact native identities and rejects replay, drift, occupancy, and partial state", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_apply_writers"
  await withPostgresContainer(async () => {
    prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 86)
    assert.equal(migrations.at(-1), "0086_task_automation_historical_apply_writers.sql")
    for (const name of migrations) applyMigration(database, name)
    psql(database, `insert into auth.users(id,email) values ('${owner}','owner@test');
      insert into public.profiles(id,full_name,is_active) values ('${owner}','Owner',true);
      insert into public.roles(name,description) values ('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select '${owner}',id from public.roles where name='asesor';
      insert into public.contacts(id,first_name,email) values ('${contact}','Historical','historical@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','writer_open','Open','Open');
      alter table public.leads disable trigger generate_first_contact_on_assignment; alter table public.leads disable trigger first_contact_invalidation_before_generation;
      insert into public.leads(id,contact_id,status_id,assigned_to,created_at) values
        ('${root}','${contact}','${status}','${owner}','2026-01-05T14:00Z'),('${rollbackRoot}','${contact}','${status}','${owner}','2026-01-05T14:00Z');
      alter table public.leads enable trigger generate_first_contact_on_assignment; alter table public.leads enable trigger first_contact_invalidation_before_generation;
      alter table public.quotes disable trigger enforce_quote_registration_link; alter table public.quotes disable trigger enforce_new_quote_registration_complete;
      insert into public.quotes(id,contact_id,lead_id,title,owner_id,created_by) values ('${quote}','${contact}','${root}','Writer quote','${owner}','${owner}');
      alter table public.quotes enable trigger enforce_quote_registration_link; alter table public.quotes enable trigger enforce_new_quote_registration_complete;`)
    const generated = generate(root), quoteGenerated = generateQuote(), suppressed = suppress()
    const generatedResult = JSON.parse(psql(database, `begin; select pg_advisory_xact_lock(3825938359965795805);
      select public.task_automation_historical_write_generate(${json(generated)})::text; commit;`).split(/\r?\n/).filter(Boolean).at(-1)!)
    const capture = (body: string) => psql(database, `create or replace function pg_temp.capture() returns text language plpgsql as $capture$ begin ${body} return 'UNEXPECTED_SUCCESS'; exception when others then return sqlerrm; end $capture$; select pg_temp.capture();`).split(/\r?\n/).filter(Boolean).at(-1)
    assert.equal(capture(`perform public.task_automation_historical_write_suppress(${json(suppress(2))});`), "TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE")
    const suppressedResult = JSON.parse(psql(database, `begin; select pg_advisory_xact_lock(3825938359965795805);
      select public.task_automation_historical_write_suppress(${json(suppressed)})::text; commit;`).split(/\r?\n/).filter(Boolean).at(-1)!)
    assert.equal(capture(`perform public.task_automation_historical_write_generate(${json({ ...quoteGenerated, opportunityId:null })});`), "TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE")
    const quoteResult = JSON.parse(psql(database, `begin; select pg_advisory_xact_lock(3825938359965795805);
      select public.task_automation_historical_write_generate(${json(quoteGenerated)})::text; commit;`).split(/\r?\n/).filter(Boolean).at(-1)!)
    assert.deepEqual(generatedResult, { taskId:generated.taskId,originKey:generated.originKey,outcomeKey:generated.outcomeKey })
    assert.deepEqual(suppressedResult, { outcomeKey:suppressed.outcomeKey,tombstoneKey:suppressed.tombstoneKey })
    assert.deepEqual(quoteResult, { taskId:quoteGenerated.taskId,originKey:quoteGenerated.originKey,outcomeKey:quoteGenerated.outcomeKey })
    assert.equal(psql(database, `select (t.quote_id='${quote}' and t.lead_id is null and t.description='Follow up on quote version' and o.quote_version_id='${generatedVersion}' and o.sent_event_id='${generatedSent}' and o.opportunity_id is null and x.task_id=t.id)::text from tasks t join task_automation_origins o on o.task_id=t.id join task_automation_outcomes x on x.origin_key=o.origin_key where t.id='${quoteGenerated.taskId}';`), "true")
    assert.deepEqual(JSON.parse(psql(database, `select jsonb_build_array(
      (select jsonb_build_object('id',id,'owner',owner_id,'lead',lead_id,'quote',quote_id,'description',description,'due',to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'status',status,'kind',task_kind,'idempotency',idempotency_key,'automation',automation_origin_key,'legacy',source_event_id is not null or source_event_type is not null or source_payload is not null or metadata is not null) from tasks where id='${generated.taskId}'),
      (select jsonb_build_object('originKey',origin_key,'taskKind',task_kind,'sourceKind',source_kind,'operation',operation,'opportunityId',opportunity_id,'quoteVersionId',quote_version_id,'sentEventId',sent_event_id,'anchorAt',to_char(anchor_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'dueRuleVersion',due_rule_version,'taskId',task_id) from task_automation_origins where origin_key='${generated.originKey}'),
      (select jsonb_build_object('outcomeKey',outcome_key,'sourceKind',source_kind,'sourceId',source_id,'sourceKey',source_key,'sourceOrder',source_order,'operation',operation,'originKey',origin_key,'taskId',task_id,'outcome',outcome,'reason',reason) from task_automation_outcomes where outcome_key='${generated.outcomeKey}'),
      (select jsonb_build_object('tombstoneKey',tombstone_key,'sourceKind',source_kind,'sourceId',source_id,'sourceKey',source_key,'sourceOrder',source_order,'originKey',origin_key,'reason',reason) from task_automation_tombstones where tombstone_key='${suppressed.tombstoneKey}'),
      (select jsonb_build_object('outcomeKey',outcome_key,'sourceKind',source_kind,'sourceId',source_id,'sourceKey',source_key,'sourceOrder',source_order,'operation',operation,'originKey',origin_key,'taskId',task_id,'outcome',outcome,'reason',reason) from task_automation_outcomes where outcome_key='${suppressed.outcomeKey}'))::text;`)), [{
        id:generated.taskId,owner,lead:root,quote:null,description:"Complete first contact",due:dueAt,status:"pending",kind:"first_contact",
        idempotency:generated.originKey,automation:generated.originKey,legacy:false,
      }, { originKey:generated.originKey,taskKind:"first_contact",sourceKind:"opportunity_assignment",operation:"generate",opportunityId:root,
        quoteVersionId:null,sentEventId:null,anchorAt,dueRuleVersion:"mx-calendar.v1",taskId:generated.taskId },
      { outcomeKey:generated.outcomeKey,sourceKind:"opportunity_assignment",sourceId:root,sourceKey:generated.sourceKey,sourceOrder:1,
        operation:"generate",originKey:generated.originKey,taskId:generated.taskId,outcome:"applied",reason:null },
      { tombstoneKey:suppressed.tombstoneKey,sourceKind:"quote_version_response",sourceId:response,sourceKey:suppressed.sourceKey,sourceOrder:1,
        originKey:suppressed.originKey,reason:"source_invalidated" },
      { outcomeKey:suppressed.outcomeKey,sourceKind:"quote_version_response",sourceId:response,sourceKey:suppressed.sourceKey,sourceOrder:1,
        operation:"suppress",originKey:suppressed.originKey,taskId:null,outcome:"applied",reason:null }])
    assert.equal(capture(`perform public.task_automation_historical_write_generate(${json(generated)});`), "TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE")
    const rollbackGenerate = generate(rollbackRoot)
    assert.equal(capture(`perform public.task_automation_historical_write_generate(${json(rollbackGenerate)}); perform public.task_automation_historical_write_suppress(${json({ ...suppressed, tombstoneKey:"0".repeat(64) })});`), "TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE")
    assert.equal(psql(database, `select count(*) from tasks where id='${rollbackGenerate.taskId}';`), "0")
    assert.equal(psql(database, `select bool_and(pg_get_userbyid(proowner)='postgres' and 'search_path=""'=any(proconfig) and not has_function_privilege('authenticated',oid,'execute')) from pg_proc where oid in ('public.task_automation_historical_write_generate(jsonb)'::regprocedure,'public.task_automation_historical_write_suppress(jsonb)'::regprocedure);`), "t")
    assert.equal(psql(database, `select bool_and(relrowsecurity) and not has_table_privilege('authenticated','public.tasks','insert') and not has_table_privilege('authenticated','public.task_automation_origins','insert') and not has_table_privilege('authenticated','public.task_automation_outcomes','insert') and not has_table_privilege('authenticated','public.task_automation_tombstones','insert') from pg_class where oid in ('public.tasks'::regclass,'public.task_automation_origins'::regclass,'public.task_automation_outcomes'::regclass,'public.task_automation_tombstones'::regclass);`), "t")
    assert.equal(psql(database, `select jsonb_build_array((select count(*) from tasks),(select count(*) from task_automation_origins),(select count(*) from task_automation_outcomes),(select count(*) from task_automation_tombstones),(select count(*) from task_automation_historical_apply_receipts))::text;`), "[2, 2, 3, 1, 0]")
  })
})
