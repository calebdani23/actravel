import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { applyTaskAutomationHistoricalPlan, type HistoricalApplyRpcArgs } from "../lib/admin/task-automation-historical-apply"
import { canonicalHash, canonicalJson } from "../lib/admin/task-automation-historical-contract"
import { actorSession, applyMigration, migrationNames, prepareBaseDatabase, psql, psqlAsync, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime"

const enabled = process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS === "1"
const uuid = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const admin = uuid(1, 201), inactive = uuid(1, 202), advisor = uuid(1, 203)
const createdAt = "2026-09-26T21:30:00.000000Z"
const bytes = (value: unknown) => Buffer.byteLength(canonicalJson(value), "utf8")

function receipt(overrides: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { id: uuid(2, 201), request_id: uuid(3, 201), approval_id: uuid(4, 201), actor_id: admin,
    approval_fingerprint: "a".repeat(64), plan_hash: "b".repeat(64), projection_hash: "c".repeat(64), task_ids: [uuid(5, 201)],
    origin_keys: ["d".repeat(64)], outcome_keys: ["e".repeat(64), "f".repeat(64)], tombstone_keys: ["9".repeat(64)],
    generated_count: 1, suppressed_count: 1, projection_count: 2, created_at: createdAt, ...overrides }
  value.result ??= { schema: "task-automation-historical-apply-result.v1", requestId: value.request_id, approvalId: value.approval_id,
    actorId: value.actor_id, planHash: value.plan_hash, projectionHash: value.projection_hash, taskIds: value.task_ids,
    originKeys: value.origin_keys, outcomeKeys: value.outcome_keys, tombstoneKeys: value.tombstone_keys,
    generatedCount: value.generated_count, suppressedCount: value.suppressed_count, projectionCount: value.projection_count }
  value.result_hash ??= canonicalHash(value.result)
  value.result_byte_count ??= bytes(value.result)
  return value
}
const insertSql = (value: Record<string, unknown>) => `insert into public.task_automation_historical_apply_receipts
  select row.* from jsonb_populate_record(null::public.task_automation_historical_apply_receipts,${sqlLiteral(JSON.stringify(value))}::jsonb) row;`

const applyRequest = uuid(3, 220), applyApproval = uuid(4, 220), applyReceipt = uuid(2, 220)
const auth = (events?: string[]) => ({ createAuthClient: async () => { events?.push("auth"); return {} },
  getUser: async () => ({ data: { user: { id: admin } }, error: null }),
  readProfile: async () => ({ data: { id: admin, is_active: true }, error: null }),
  readRoles: async () => ({ data: [{ roles: { name: "admin" } }], error: null }) })
function applySuccess(status: "applied" | "replayed" = "applied") {
  const task_ids = [uuid(5, 220), uuid(5, 221)], origin_keys = ["a".repeat(64), "b".repeat(64)]
  const outcome_keys = ["c".repeat(64), "d".repeat(64), "e".repeat(64)], tombstone_keys = ["f".repeat(64)]
  const result = { schema: "task-automation-historical-apply-result.v1", requestId: applyRequest, approvalId: applyApproval,
    actorId: admin, planHash: "1".repeat(64), projectionHash: "2".repeat(64), taskIds: task_ids, originKeys: origin_keys,
    outcomeKeys: outcome_keys, tombstoneKeys: tombstone_keys, generatedCount: 2, suppressedCount: 1, projectionCount: 3 }
  return { ok: true, status, id: applyReceipt, request_id: applyRequest, approval_id: applyApproval, actor_id: admin,
    approval_fingerprint: "3".repeat(64), plan_hash: result.planHash, projection_hash: result.projectionHash, task_ids,
    origin_keys, outcome_keys, tombstone_keys, generated_count: 2, suppressed_count: 1, projection_count: 3, result,
    result_hash: canonicalHash(result), result_byte_count: bytes(result), created_at: createdAt }
}

test("0084 declares only the immutable apply receipt foundation", () => {
  const sql = readFileSync("db/migrations/0084_task_automation_historical_apply_receipt.sql", "utf8")
  assert.match(sql, /create table public\.task_automation_historical_apply_receipts/)
  assert.match(sql, /validate_task_automation_historical_apply_receipt/)
  assert.match(sql, /reject_task_automation_historical_apply_receipt_mutation/)
  assert.doesNotMatch(sql, /\breplayed\b|\breferences\b|apply_task_automation_historical_plan|task_automation_historical_universe_guard/)
})

test("apply adapter is auth-first and maps only the exact ordered receipt", async () => {
  const events: string[] = []; let seen: HistoricalApplyRpcArgs | undefined, invalidPersistence = 0
  const noUser = { createAuthClient: async () => ({}), getUser: async () => ({ data: { user: null }, error: null }) }
  assert.deepEqual(await applyTaskAutomationHistoricalPlan({ requestId: "bad", extra: true }, { auth: noUser,
    createPersistenceClient: async () => { throw new Error("must not construct") } }),
  { ok: false, error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } })
  assert.deepEqual(await applyTaskAutomationHistoricalPlan({ requestId: applyRequest, extra: true }, { auth: auth(),
    createPersistenceClient: async () => { invalidPersistence++; return {} } }),
  { ok: false, error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" } })
  assert.equal(invalidPersistence, 0)
  const value = await applyTaskAutomationHistoricalPlan({ requestId: applyRequest }, { auth: auth(events),
    createPersistenceClient: async () => { events.push("persistence"); return {} },
    invokeRpc: async (_client, args) => { events.push("rpc"); seen = args; return { data: applySuccess(), error: null } } })
  assert.deepEqual(events, ["auth", "persistence", "rpc"])
  assert.deepEqual(seen, { p_request_id_text: applyRequest, p_expected_actor_id: admin })
  assert.equal(value.ok, true)
  if (!value.ok) return
  assert.deepEqual(Object.keys(value), ["ok", "status", "replayed", "receiptId", "requestId", "approvalId", "actorId",
    "approvalFingerprint", "planHash", "projectionHash", "taskIds", "originKeys", "outcomeKeys", "tombstoneKeys",
    "generatedCount", "suppressedCount", "projectionCount", "result", "resultHash", "resultByteCount", "createdAt"])
  assert.equal(value.status, "success"); assert.equal(value.replayed, false); assert.deepEqual(value.result.taskIds, value.taskIds)
})

test("apply adapter preserves every domain code and suppresses malformed provider data", async () => {
  const invoke = async (data: unknown, error: unknown = null) => applyTaskAutomationHistoricalPlan({ requestId: applyRequest }, {
    auth: auth(), createPersistenceClient: async () => ({}), invokeRpc: async () => ({ data, error }) })
  const codes = ["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_NOT_ADMIN", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST",
    "APPLY_IDEMPOTENCY_CONFLICT", "APPLY_RECEIPT_INTEGRITY_FAILURE", "APPROVAL_NOT_FOUND", "APPROVAL_INTEGRITY_FAILURE",
    "STALE_PLAN_INTEGRITY", "STALE_LIVE_CONTEXT", "STALE_SOURCE_ORDER", "IDENTITY_OCCUPANCY_CONFLICT", "LIMIT_EXCEEDED"]
  for (const code of codes) assert.deepEqual(await invoke({ ok: false, error: { code, message: code } }),
    { ok: false, error: { code, message: code } }, code)
  const replay = await invoke(applySuccess("replayed")); assert.equal(replay.ok && replay.replayed, true)
  const valid = applySuccess(), reversed = [...valid.result.outcomeKeys].reverse()
  const malformed = [{ ...valid, extra: true }, { ...valid, approval_fingerprint: "provider secret" },
    { ...valid, task_ids: [valid.task_ids[0], valid.task_ids[0]] },
    { ...valid, result: { ...valid.result, outcomeKeys: reversed } }, { ...valid, generated_count: 1 },
    { ...valid, result_hash: "0".repeat(64) }, { ...valid, result_byte_count: valid.result_byte_count + 1 },
    { ok: false, error: { code: "STALE_PLAN_INTEGRITY", message: "provider secret" } }]
  for (const data of malformed) assert.deepEqual(await invoke(data),
    { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  assert.deepEqual(await invoke(null, { message: "provider secret" }),
    { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
})

test("0084 stores exact immutable purge-independent receipts safely under concurrency", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_receipt"
  await withPostgresContainer(async () => {
    prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 84)
    assert.equal(migrations.at(-1), "0084_task_automation_historical_apply_receipt.sql")
    for (const name of migrations) applyMigration(database, name)
    psql(database, `insert into auth.users(id,email) values ('${admin}','admin@test'),('${inactive}','inactive@test'),('${advisor}','advisor@test');
      insert into public.profiles(id,full_name,is_active) values ('${admin}','Admin',true),('${inactive}','Inactive',false),('${advisor}','Advisor',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${admin}'::uuid,'admin'),('${inactive}'::uuid,'admin'),('${advisor}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;
      grant select on public.profiles,public.profile_roles,public.roles to authenticated;`)
    const columns = JSON.parse(psql(database, `select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)::text from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.task_automation_historical_apply_receipts'::regclass and a.attnum>0 and not a.attisdropped;`))
    assert.deepEqual(columns.map((value: unknown[]) => value.slice(0, 3)), [
      ["id","uuid",true],["request_id","uuid",true],["approval_id","uuid",true],["actor_id","uuid",true],
      ...["approval_fingerprint","plan_hash","projection_hash"].map((name) => [name,"text",true]),["task_ids","uuid[]",true],
      ...["origin_keys","outcome_keys","tombstone_keys"].map((name) => [name,"text[]",true]),
      ...["generated_count","suppressed_count","projection_count"].map((name) => [name,"integer",true]),["result","jsonb",true],
      ["result_hash","text",true],["result_byte_count","integer",true],["created_at","timestamp with time zone",true],
    ])
    assert.deepEqual(columns.filter((value: unknown[]) => value[3] !== null).map((value: unknown[]) => value[0]), ["id","created_at"])
    assert.equal(psql(database, `select relrowsecurity and relforcerowsecurity,(select count(*) from pg_constraint where conrelid='public.task_automation_historical_apply_receipts'::regclass and contype='f'),(select count(*) from pg_constraint where conrelid='public.task_automation_historical_apply_receipts'::regclass and contype='u') from pg_class where oid='public.task_automation_historical_apply_receipts'::regclass;`), "t|0|1")
    psql(database, insertSql(receipt()))
    assert.equal(psql(database, `select public.validate_task_automation_historical_apply_receipt(value),result_hash=public.task_automation_historical_hash(result),result_byte_count=octet_length(convert_to(public.follow_up_canonical_json(result),'UTF8')) from public.task_automation_historical_apply_receipts value;`), "t|t|t")
    assert.equal(psql(database, `${actorSession(admin)} select count(*) from public.task_automation_historical_apply_receipts;`).split(/\r?\n/).filter(Boolean).at(-1), "1")
    assert.equal(psql(database, `${actorSession(inactive)} select count(*) from public.task_automation_historical_apply_receipts;`).split(/\r?\n/).filter(Boolean).at(-1), "0")
    assert.equal(psql(database, `${actorSession(advisor)} select count(*) from public.task_automation_historical_apply_receipts;`).split(/\r?\n/).filter(Boolean).at(-1), "0")
    assert.throws(() => psql(database, `${actorSession(admin)} ${insertSql(receipt({ id: uuid(2, 202), request_id: uuid(3, 202) }))}`), /permission denied/)
    assert.throws(() => psql(database, "update public.task_automation_historical_apply_receipts set result=result;"), /HISTORICAL_APPLY_RECEIPT_IMMUTABLE/)
    assert.throws(() => psql(database, "delete from public.task_automation_historical_apply_receipts;"), /HISTORICAL_APPLY_RECEIPT_IMMUTABLE/)
    const baseResult = receipt().result as Record<string, unknown>
    const invalid = [
      receipt({ id: uuid(2, 203), request_id: uuid(3, 203), result_hash: "0".repeat(64) }),
      receipt({ id: uuid(2, 204), request_id: uuid(3, 204), outcome_keys: ["e".repeat(64), "e".repeat(64)] }),
      receipt({ id: uuid(2, 205), request_id: uuid(3, 205), task_ids: [null] }),
      receipt({ id: uuid(2, 206), request_id: uuid(3, 206), task_ids: [[uuid(5, 201)]] }),
      receipt({ id: uuid(2, 209), request_id: uuid(3, 209), generated_count: 0 }),
      receipt({ id: uuid(2, 210), request_id: uuid(3, 210), result: { ...baseResult, outcomeKeys: [...baseResult.outcomeKeys as string[]].reverse() } }),
      receipt({ id: uuid(2, 211), request_id: uuid(3, 211), result: { ...baseResult, replayed: false } }),
    ]
    for (const value of invalid) assert.throws(() => psql(database, insertSql(value)), /HISTORICAL_APPLY_RECEIPT_INTEGRITY|violates check constraint/)
    psql(database, insertSql(receipt({ id: uuid(2, 207), request_id: uuid(3, 207), task_ids: [], origin_keys: [], outcome_keys: [], tombstone_keys: [], generated_count: 0, suppressed_count: 0, projection_count: 0 })))
    psql(database, "delete from public.lead_events; delete from public.quote_events; delete from public.leads;")
    assert.equal(psql(database, "select count(*) from public.task_automation_historical_apply_receipts;"), "2")
    const concurrent = receipt({ id: uuid(2, 208), request_id: uuid(3, 208) })
    const outcomes = await Promise.allSettled([psqlAsync(database, insertSql(concurrent)), psqlAsync(database, insertSql(concurrent))])
    assert.deepEqual(outcomes.map((value) => value.status).sort(), ["fulfilled", "rejected"])
    assert.equal(psql(database, `select count(*) from public.task_automation_historical_apply_receipts where request_id='${concurrent.request_id}';`), "1")
    assert.equal(psql(database, `select has_table_privilege('anon','public.task_automation_historical_apply_receipts','select'),has_table_privilege('authenticated','public.task_automation_historical_apply_receipts','select'),has_table_privilege('service_role','public.task_automation_historical_apply_receipts','select'),has_table_privilege('authenticated','public.task_automation_historical_apply_receipts','insert,update,delete'),has_function_privilege('authenticated','public.validate_task_automation_historical_apply_receipt(public.task_automation_historical_apply_receipts)','execute'),has_function_privilege('authenticated','public.reject_task_automation_historical_apply_receipt_mutation()','execute'),(select bool_and(pg_get_userbyid(proowner)='postgres' and not prosecdef and 'search_path=""'=any(proconfig)) from pg_proc where oid in ('public.validate_task_automation_historical_apply_receipt(public.task_automation_historical_apply_receipts)'::regprocedure,'public.reject_task_automation_historical_apply_receipt_mutation()'::regprocedure));`), "f|t|f|f|f|f|t")
  })
})
