import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { canonicalHash, canonicalJson } from "../lib/admin/task-automation-historical-contract"
import * as postgresRuntime from "./helpers/postgres-runtime"
import { actorSession, applyMigration, migrationNames, prepareBaseDatabase, psql, psqlAsync, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime"

const enabled = process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS === "1"
const uuid = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const admin = uuid(1, 101), inactive = uuid(1, 102), advisor = uuid(1, 103), owner = uuid(1, 104)
const approvalId = uuid(2, 101), requestId = uuid(3, 101), opportunityId = uuid(4, 101)
const quoteId = uuid(5, 101), versionId = uuid(6, 101), sentId = uuid(7, 101), contactId = uuid(8, 102), statusId = uuid(9, 102)
const createdAt = "2026-09-26T12:00:00.000000Z", anchorAt = "2026-01-02T12:00:00.000000Z"
const canonicalTimestamp = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/
const sourceCutoffs = { opportunityAssignment: "2026-09-01T00:00:00.000000Z", quoteSent: "2026-09-01T00:00:00.000000Z" }
const snapshotCutoffs = { opportunityRoots: null, quoteVersionRoots: null, assignmentEvidence: null, quoteSourceEvidence: null,
  taskOccupancy: null, automationOrigins: null, automationOutcomes: null, automationTombstones: null }
const scalar = (value: string) => value.split(/\r?\n/).filter(Boolean).at(-1)
const rows = [{ ordinal: 0, sourceKind: "opportunity_assignment", rootId: opportunityId, anchorAt, sourceId: opportunityId,
  ownerId: owner, opportunityId, quoteId: null, quoteVersionId: null, sentEventId: null, disposition: "apply/generate",
  reason: "ELIGIBLE_GENERATE", action: "generate", operationSourceKind: "opportunity_assignment", operationSourceId: opportunityId,
  sourceKey: "a".repeat(64), sourceOrder: 1, originKey: "b".repeat(64), taskId: uuid(8, 101), taskKind: "first_contact",
  dueRuleVersion: "mx-calendar.v1", dueAt: "2026-01-02T12:15:00.000000Z", outcomeKey: "c".repeat(64), tombstoneKey: null },
{ ordinal: 1, sourceKind: "quote_sent", rootId: versionId, anchorAt, sourceId: sentId, ownerId: null, opportunityId,
  quoteId, quoteVersionId: versionId, sentEventId: sentId, disposition: "apply/suppress", reason: "SOURCE_INVALIDATED",
  action: "suppress", operationSourceKind: "quote_rejected", operationSourceId: versionId, sourceKey: "d".repeat(64),
  sourceOrder: 1, originKey: "e".repeat(64), taskId: null, taskKind: null, dueRuleVersion: null, dueAt: null,
  outcomeKey: "f".repeat(64), tombstoneKey: "9".repeat(64) }]
const projectionKeys = ["ordinal", "action", "operationSourceKind", "operationSourceId", "sourceKey", "sourceOrder", "originKey",
  "taskId", "taskKind", "ownerId", "opportunityId", "quoteId", "quoteVersionId", "sentEventId", "anchorAt", "dueRuleVersion",
  "dueAt", "outcomeKey", "tombstoneKey"] as const
const projections = rows.map((row) => Object.fromEntries(projectionKeys.map((key) => [key, row[key]])))
const counts = [1, 1, 0, 0, 0, 0, 0, 0]
const plan = { schema: "task-automation-historical-plan.v1", ruleVersion: "task-automation-historical.v1", sourceCutoffs,
  snapshotCutoffs, snapshotHash: "8".repeat(64), rows, counts, totalCount: 2 }
const bytes = (value: unknown) => Buffer.byteLength(canonicalJson(value), "utf8")

function approval(overrides: Record<string, unknown> = {}) {
  const id = String(overrides.id ?? approvalId), request = String(overrides.request_id ?? requestId)
  const approvedPlan = overrides.plan ?? plan, approvedProjections = overrides.projections ?? projections
  const planHash = canonicalHash(approvedPlan), projectionHash = canonicalHash(approvedProjections)
  const requestPreimage = ["task-automation-historical-approval-request.v1", request, admin, "admin",
    "task-automation-historical-preview.v1", "task-automation-historical.v1", sourceCutoffs, snapshotCutoffs,
    plan.snapshotHash, planHash, projectionHash, approvedPlan, approvedProjections]
  const base = { id, request_id: request, actor_id: admin, actor_role: "admin", schema_version: "task-automation-historical-approval.v1",
    preview_schema: "task-automation-historical-preview.v1", rule_version: "task-automation-historical.v1", source_cutoffs: sourceCutoffs,
    snapshot_cutoffs: snapshotCutoffs, snapshot_hash: plan.snapshotHash, plan: approvedPlan, plan_hash: planHash, projections: approvedProjections,
    projection_hash: projectionHash, request_fingerprint: canonicalHash(requestPreimage), approval_fingerprint: "", apply_generate_count: 1,
    apply_suppress_count: 1, already_projected_count: 0, already_suppressed_count: 0, excluded_not_actionable_count: 0,
    manual_review_owner_invalid_count: 0, manual_review_context_invalid_count: 0, collision_manual_review_count: 0,
    total_count: 2, row_count: 2, generate_count: 1, suppress_count: 1, projection_count: 2,
    plan_byte_count: bytes(approvedPlan), projection_byte_count: bytes(approvedProjections), request_byte_count: bytes(requestPreimage), created_at: createdAt }
  const value = { ...base, ...overrides }
  const storedCounts = [value.apply_generate_count, value.apply_suppress_count, value.already_projected_count,
    value.already_suppressed_count, value.excluded_not_actionable_count, value.manual_review_owner_invalid_count,
    value.manual_review_context_invalid_count, value.collision_manual_review_count]
  value.approval_fingerprint = canonicalHash(["task-automation-historical-approval-fingerprint.v1", value.id, value.request_id,
    value.actor_id, value.actor_role, value.schema_version, value.preview_schema, value.rule_version, value.source_cutoffs,
    value.snapshot_cutoffs, value.snapshot_hash, value.plan_hash, value.projection_hash, value.request_fingerprint, value.plan,
    value.projections, storedCounts, value.total_count, value.row_count, value.generate_count, value.suppress_count, value.projection_count,
    value.plan_byte_count, value.projection_byte_count, value.request_byte_count, value.created_at])
  return value
}
const insertSql = (value: Record<string, unknown>) => `insert into public.task_automation_historical_approvals
  select row.* from jsonb_populate_record(null::public.task_automation_historical_approvals,${sqlLiteral(JSON.stringify(value))}::jsonb) row;`

type ApprovalRequest = ReturnType<typeof approvalRequest>
function approvalRequest(overrides: Record<string, unknown> = {}) {
  const actorId = String(overrides.actorId ?? admin), requestedId = String(overrides.requestId ?? requestId)
  const approvedPlan = overrides.plan ?? plan, approvedProjections = overrides.projections ?? projections
  const planHash = String(overrides.planHash ?? canonicalHash(approvedPlan))
  const projectionHash = String(overrides.projectionHash ?? canonicalHash(approvedProjections))
  const previewSchema = String(overrides.previewSchema ?? "task-automation-historical-preview.v1")
  const ruleVersion = String(overrides.ruleVersion ?? "task-automation-historical.v1")
  const snapshotHash = String(overrides.snapshotHash ?? plan.snapshotHash)
  const requestPreimage = ["task-automation-historical-approval-request.v1", requestedId, actorId, "admin", previewSchema,
    ruleVersion, sourceCutoffs, snapshotCutoffs, snapshotHash, planHash, projectionHash, approvedPlan, approvedProjections]
  return { requestId: requestedId, actorId, previewSchema, ruleVersion, sourceCutoffs, snapshotCutoffs, snapshotHash,
    planHash, projectionHash, requestFingerprint: String(overrides.requestFingerprint ?? canonicalHash(requestPreimage)),
    plan: approvedPlan, projections: approvedProjections }
}
function approveSql(value: ApprovalRequest, sessionActor: string | null = value.actorId, expectedActor = value.actorId) {
  const text = (input: string) => sqlLiteral(input)
  const json = (input: unknown) => `${sqlLiteral(JSON.stringify(input))}::jsonb`
  return `${sessionActor ? actorSession(sessionActor) : ""} select public.approve_task_automation_historical_plan(${text(value.requestId)},'${expectedActor}',${text(value.previewSchema)},${text(value.ruleVersion)},${json(value.sourceCutoffs)},${json(value.snapshotCutoffs)},${text(value.snapshotHash)},${text(value.planHash)},${text(value.projectionHash)},${text(value.requestFingerprint)},${json(value.plan)},${json(value.projections)})::text;`
}
const parseApproval = (value: string) => JSON.parse(scalar(value)!)

type SafetyKind = "spawn" | "readiness" | "psql" | "timeout"
type SafetyRuntime = {
  uniquePostgresContainerName(label: string): string
  withPostgresContainer<T>(scenario: (runtime: { psql(database: string, source: string): Promise<string> }) => Promise<T>, options: {
    containerName: string; image: string; commandTimeoutMs: number; readinessAttempts: number; readinessDelayMs: number
    sleep(milliseconds: number): Promise<void>
    invoke(args: string[], options: { timeoutMs: number }): Promise<string>
  }): Promise<T>
}
const safetyRuntime = postgresRuntime as unknown as SafetyRuntime

function fakeDocker(kind: SafetyKind) {
  const calls: { args: string[]; timeoutMs: number }[] = [], containers = new Set<string>()
  const id = "a".repeat(64)
  let label = ""
  const invoke = async (args: string[], options: { timeoutMs: number }) => {
    calls.push({ args: [...args], timeoutMs: options.timeoutMs })
    if (args[0] === "run") {
      label = args[args.indexOf("--label") + 1]
      containers.add(id)
      if (kind === "spawn") throw new Error("spawn failure")
      return id
    }
    if (args[0] === "rm") { containers.delete(args.at(-1)!); return "" }
    if (args[0] === "ps") {
      const filter = args[args.indexOf("--filter") + 1]
      return filter === `label=${label}` ? [...containers].join("\n") : ""
    }
    if (args.includes("pg_isready")) {
      if (kind === "readiness") throw new Error("readiness failure")
      return "ready"
    }
    if (args.includes("psql")) {
      const source = args[args.indexOf("-c") + 1]
      if (source === "select 1") return "1"
      if (kind === "psql") throw new Error("psql failure")
      if (kind === "timeout") throw Object.assign(new Error("subprocess timed out"), { code: "ETIMEDOUT" })
      return "1"
    }
    throw new Error(`unexpected docker invocation: ${args.join(" ")}`)
  }
  return { calls, containers, invoke }
}

test("historical approval runtime harness is argv-only and cleanup-first", () => {
  const helper = readFileSync("tests/helpers/postgres-runtime.ts", "utf8")
  const source = readFileSync("tests/task-automation-historical-approval-runtime.test.ts", "utf8")
  assert.match(helper, /execFile(?:Sync)?\("docker", (?:args|\[)/)
  assert.doesNotMatch(helper, /\bexec(?:Sync)?\s*\(|shell\s*:\s*true/)
  assert.ok(source.indexOf("skip: !enabled") < source.indexOf("withPostgresContainer(async"))
  assert.match(source, /await withPostgresContainer\(async \(\) => \{/)
  assert.match(helper, /timeout: postgresCommandTimeoutMs[\s\S]*killSignal: "SIGKILL"/)
})

test("historical approval subprocess failures and timeouts await cleanup without leftovers", async (t) => {
  assert.equal(typeof safetyRuntime.uniquePostgresContainerName, "function")
  assert.equal(typeof safetyRuntime.withPostgresContainer, "function")
  const names = new Set<string>()
  for (const kind of ["spawn", "readiness", "psql", "timeout"] as const) {
    await t.test(kind, async () => {
      const name = safetyRuntime.uniquePostgresContainerName(`historical-approval-${kind}`)
      assert.equal(names.has(name), false); names.add(name)
      const fake = fakeDocker(kind)
      await assert.rejects(safetyRuntime.withPostgresContainer(async (runtime) => {
        assert.ok(kind === "psql" || kind === "timeout")
        await runtime.psql("postgres", "select application failure")
      }, {
        containerName: name, image: "postgres:16-alpine;not-a-shell", commandTimeoutMs: 25,
        readinessAttempts: kind === "readiness" ? 2 : 3, readinessDelayMs: 0,
        sleep: async () => {}, invoke: fake.invoke,
      }), kind === "readiness" ? /did not become ready/ : kind === "timeout" ? /timed out/ : new RegExp(`${kind}.*failure`))
      assert.equal(fake.containers.size, 0)
      assert.deepEqual(fake.calls.slice(-2).map(({ args }) => args[0]), ["rm", "ps"])
      assert.ok(fake.calls.every(({ timeoutMs }) => timeoutMs === 25))
      const run = fake.calls.find(({ args }) => args[0] === "run")!
      assert.equal(run.args[run.args.indexOf("--name") + 1], name)
      assert.equal(run.args.at(-1), "postgres:16-alpine;not-a-shell")
    })
  }
  assert.equal(names.size, 4)
})

test("0082 stores exact immutable purge-independent approvals", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_approval"
  await withPostgresContainer(async () => {
    prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 81)) applyMigration(database, name)
    applyMigration(database, "0082_task_automation_historical_approval_foundation.sql")
    psql(database, `insert into auth.users(id,email) values ('${admin}','admin@test'),('${inactive}','inactive@test'),('${advisor}','advisor@test'),('${owner}','owner@test');
      insert into public.profiles(id,full_name,is_active) values ('${admin}','Admin',true),('${inactive}','Inactive',false),('${advisor}','Advisor',true),('${owner}','Owner',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${admin}'::uuid,'admin'),('${inactive}'::uuid,'admin'),('${advisor}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;
      insert into public.contacts(id,first_name,email,is_test_data) values ('${contactId}','Source','source@test',true); insert into public.lead_statuses(id,name,label_es,label_en) values ('${statusId}','approval_source','Open','Open'); insert into public.leads(id,contact_id,status_id,created_at,is_test_data) values ('${opportunityId}','${contactId}','${statusId}','2026-01-02 12:00:00+00',true);
      grant select on public.profiles,public.profile_roles,public.roles to authenticated;`)
    const columns = JSON.parse(psql(database, `select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)::text from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.task_automation_historical_approvals'::regclass and a.attnum>0 and not a.attisdropped;`))
    assert.deepEqual(columns.map((value: unknown[]) => value.slice(0, 3)), [
      ["id","uuid",true],["request_id","uuid",true],["actor_id","uuid",true],["actor_role","text",true],
      ["schema_version","text",true],["preview_schema","text",true],["rule_version","text",true],["source_cutoffs","jsonb",true],
      ["snapshot_cutoffs","jsonb",true],["snapshot_hash","text",true],["plan","jsonb",true],["plan_hash","text",true],
      ["projections","jsonb",true],["projection_hash","text",true],["request_fingerprint","text",true],["approval_fingerprint","text",true],
      ...["apply_generate_count","apply_suppress_count","already_projected_count","already_suppressed_count","excluded_not_actionable_count","manual_review_owner_invalid_count","manual_review_context_invalid_count","collision_manual_review_count","total_count","row_count","generate_count","suppress_count","projection_count","plan_byte_count","projection_byte_count","request_byte_count"].map((name) => [name,"integer",true]),
      ["created_at","timestamp with time zone",true],
    ])
    assert.deepEqual(columns.filter((value: unknown[]) => value[3] !== null).map((value: unknown[]) => value[0]), ["id","actor_role","created_at"])
    assert.match(String(columns[0][3]), /extensions\.gen_random_uuid\(\)/); assert.equal(columns[3][3], "'admin'::text"); assert.match(String(columns.at(-1)[3]), /date_trunc\('microseconds'/)
    assert.equal(psql(database, `select relrowsecurity and relforcerowsecurity,(select count(*) from pg_constraint where conrelid='public.task_automation_historical_approvals'::regclass and contype='f'),
      (select count(*) from pg_constraint where conrelid='public.task_automation_historical_approvals'::regclass and contype='c') from pg_class where oid='public.task_automation_historical_approvals'::regclass;`), "t|0|9")
    psql(database, insertSql(approval()))
    assert.equal(psql(database, `select public.validate_task_automation_historical_approval(value),plan_hash=public.task_automation_historical_hash(plan),projection_hash=public.task_automation_historical_hash(projections),plan_byte_count=octet_length(convert_to(public.follow_up_canonical_json(plan),'UTF8')),projection_byte_count=octet_length(convert_to(public.follow_up_canonical_json(projections),'UTF8')) from public.task_automation_historical_approvals value;`), "t|t|t|t|t")
    assert.equal(scalar(psql(database, `${actorSession(admin)} select count(*) from public.task_automation_historical_approvals;`)), "1")
    assert.equal(scalar(psql(database, `${actorSession(inactive)} select count(*) from public.task_automation_historical_approvals;`)), "0")
    assert.equal(scalar(psql(database, `${actorSession(advisor)} select count(*) from public.task_automation_historical_approvals;`)), "0")
    assert.throws(() => psql(database, `${actorSession(admin)} ${insertSql(approval({ id: uuid(2, 102), request_id: uuid(3, 102) }))}`), /permission denied/)
    assert.throws(() => psql(database, `update public.task_automation_historical_approvals set plan=plan;`), /HISTORICAL_APPROVAL_IMMUTABLE/)
    assert.throws(() => psql(database, `delete from public.task_automation_historical_approvals;`), /HISTORICAL_APPROVAL_IMMUTABLE/)
    assert.throws(() => psql(database, insertSql(approval({ id: uuid(2, 103), request_id: uuid(3, 103), plan_hash: "0".repeat(64) }))), /HISTORICAL_APPROVAL_INTEGRITY/)
    assert.throws(() => psql(database, insertSql(approval({ id: uuid(2, 105), request_id: uuid(3, 105), projection_count: 1 }))), /HISTORICAL_APPROVAL_INTEGRITY/)
    assert.throws(() => psql(database, insertSql(approval({ id: uuid(2, 106), request_id: uuid(3, 106), plan: { ...plan, rows: [{ ...rows[0], extra: true }, rows[1]] } }))), /HISTORICAL_APPROVAL_INTEGRITY/)
    const falseCounts = [2, 0, 0, 0, 0, 0, 0, 0]
    assert.throws(() => psql(database, insertSql(approval({ id: uuid(2, 107), request_id: uuid(3, 107),
      plan: { ...plan, counts: falseCounts }, apply_generate_count: 2, apply_suppress_count: 0, generate_count: 2, suppress_count: 0 }))), /HISTORICAL_APPROVAL_INTEGRITY/)
    psql(database, `delete from public.lead_events; delete from public.quote_events; delete from public.leads where id='${opportunityId}';`)
    assert.equal(psql(database, "select count(*) from public.task_automation_historical_approvals;"), "1")
    const concurrent = approval({ id: uuid(2, 104), request_id: uuid(3, 104) })
    const outcomes = await Promise.allSettled([psqlAsync(database, insertSql(concurrent)), psqlAsync(database, insertSql(concurrent))])
    assert.deepEqual(outcomes.map((value) => value.status).sort(), ["fulfilled", "rejected"])
    assert.equal(psql(database, "select count(*) from public.task_automation_historical_approvals;"), "2")
    assert.equal(psql(database, `select has_table_privilege('anon','public.task_automation_historical_approvals','select'),has_table_privilege('authenticated','public.task_automation_historical_approvals','select'),has_table_privilege('service_role','public.task_automation_historical_approvals','select'),has_table_privilege('authenticated','public.task_automation_historical_approvals','insert,update,delete'),has_function_privilege('authenticated','public.validate_task_automation_historical_approval(public.task_automation_historical_approvals)','execute');`), "f|t|f|f|f")
    const marker = `/tmp/opencode/historical-approval-${process.pid}`
    assert.throws(() => psql(`${database};touch ${marker}`, "select 1")); assert.equal(existsSync(marker), false)
  })
})

test("0083 authenticates, validates, serializes, replays, and conflicts without source mutation", { skip: !enabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_approval_rpc", otherAdmin = uuid(1, 105)
  const failure = (code: string) => ({ ok: false, error: { code, message: code } })
  await withPostgresContainer(async () => {
    prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 83)
    assert.equal(migrations.at(-1), "0083_task_automation_historical_approval_rpc.sql")
    for (const name of migrations) applyMigration(database, name)
    psql(database, `insert into auth.users(id,email) values ('${admin}','admin@test'),('${otherAdmin}','other@test'),('${inactive}','inactive@test'),('${advisor}','advisor@test');
      insert into public.profiles(id,full_name,is_active) values ('${admin}','Admin',true),('${otherAdmin}','Other',true),('${inactive}','Inactive',false),('${advisor}','Advisor',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select value.id,role.id from (values ('${admin}'::uuid,'admin'),('${otherAdmin}'::uuid,'admin'),('${inactive}'::uuid,'admin'),('${advisor}'::uuid,'asesor')) value(id,name) join public.roles role on role.name=value.name;`)
    const call = (value: ApprovalRequest, actor: string | null = value.actorId, expected = value.actorId) => parseApproval(psql(database, approveSql(value, actor, expected)))
    const base = approvalRequest()
    assert.deepEqual(call(base, null), failure("AUTH_REQUIRED"))
    assert.deepEqual(call({ ...base, actorId: inactive }, inactive, inactive), failure("AUTH_INACTIVE"))
    assert.deepEqual(call({ ...base, actorId: advisor }, advisor, advisor), failure("AUTH_NOT_ADMIN"))
    assert.deepEqual(call(base, admin, otherAdmin), failure("AUTH_ACTOR_MISMATCH"))
    assert.deepEqual(call({ ...base, requestId: "NOT-A-UUID" }), failure("INVALID_REQUEST"))
    assert.deepEqual(call({ ...base, previewSchema: "wrong" }), failure("INVALID_PREVIEW"))
    assert.deepEqual(call(approvalRequest({ plan: { ...plan, rows: [{ ...rows[0], extra: true }, rows[1]] } })), failure("INVALID_PLAN"))
    assert.deepEqual(call(approvalRequest({ projections: [...projections].reverse() })), failure("INVALID_PROJECTION"))
    assert.deepEqual(call({ ...base, planHash: "0".repeat(64) }), failure("HASH_MISMATCH"))

    const limitRows = Array.from({ length: 2001 }, (_, index) => ({ ...rows[0], ordinal: index,
      rootId: uuid(4, index + 1000), sourceId: uuid(4, index + 1000), opportunityId: uuid(4, index + 1000),
      operationSourceId: uuid(4, index + 1000), sourceKey: canonicalHash(["limit-source", index]),
      originKey: canonicalHash(["limit-origin", index]), taskId: uuid(8, index + 1000), outcomeKey: canonicalHash(["limit-outcome", index]) }))
    assert.deepEqual(call(approvalRequest({ plan: { ...plan, rows: limitRows, counts: [2001,0,0,0,0,0,0,0], totalCount: 2001 }, projections: [] })), failure("INVALID_PROJECTION"))

    const state = () => psql(database, `select jsonb_build_array((select count(*) from public.leads),(select count(*) from public.tasks),(select count(*) from public.task_automation_origins),(select count(*) from public.task_automation_outcomes),(select count(*) from public.task_automation_tombstones))::text;`)
    const before = state(), created = call(base)
    assert.equal(created.ok, true); assert.equal(created.status, "approved")
    assert.match(created.created_at, canonicalTimestamp)
    assert.deepEqual(Object.keys(created).sort(), ["actor_id","actor_role","already_projected_count","already_suppressed_count","apply_generate_count","apply_suppress_count","approval_fingerprint","collision_manual_review_count","created_at","excluded_not_actionable_count","generate_count","id","manual_review_context_invalid_count","manual_review_owner_invalid_count","ok","plan","plan_byte_count","plan_hash","preview_schema","projection_byte_count","projection_count","projection_hash","projections","request_byte_count","request_fingerprint","request_id","row_count","rule_version","schema_version","snapshot_cutoffs","snapshot_hash","source_cutoffs","status","suppress_count","total_count"].sort())
    const requestPreimage = ["task-automation-historical-approval-request.v1", requestId, admin, "admin", base.previewSchema,
      base.ruleVersion, sourceCutoffs, snapshotCutoffs, plan.snapshotHash, canonicalHash(plan), canonicalHash(projections), plan, projections]
    assert.equal(created.plan_byte_count, bytes(plan)); assert.equal(created.projection_byte_count, bytes(projections)); assert.equal(created.request_byte_count, bytes(requestPreimage))
    assert.deepEqual([created.apply_generate_count,created.apply_suppress_count,created.already_projected_count,created.already_suppressed_count,
      created.excluded_not_actionable_count,created.manual_review_owner_invalid_count,created.manual_review_context_invalid_count,created.collision_manual_review_count], counts)
    assert.equal(created.plan_hash, canonicalHash(plan)); assert.equal(created.projection_hash, canonicalHash(projections)); assert.equal(created.request_fingerprint, canonicalHash(requestPreimage))
    const replay = call(base); assert.equal(replay.status, "replayed"); assert.equal(replay.id, created.id)
    assert.match(replay.created_at, canonicalTimestamp); assert.equal(replay.created_at, created.created_at)
    const changedPlan = { ...plan, snapshotHash: "7".repeat(64) }
    assert.deepEqual(call(approvalRequest({ plan: changedPlan, snapshotHash: changedPlan.snapshotHash })), failure("APPROVAL_IDEMPOTENCY_CONFLICT"))
    assert.deepEqual(call(approvalRequest({ actorId: otherAdmin }), otherAdmin), failure("APPROVAL_IDEMPOTENCY_CONFLICT"))

    const concurrentRequest = approvalRequest({ requestId: uuid(3, 102) })
    const concurrent = await Promise.all([psqlAsync(database, approveSql(concurrentRequest)), psqlAsync(database, approveSql(concurrentRequest))])
    const concurrentRows = concurrent.map(parseApproval)
    assert.deepEqual(concurrentRows.map((value) => value.status).sort(), ["approved", "replayed"])
    assert.equal(new Set(concurrentRows.map((value) => value.id)).size, 1)
    assert.equal(psql(database, `select count(*) from public.task_automation_historical_approvals where request_id='${concurrentRequest.requestId}';`), "1")
    assert.equal(state(), before)
    assert.equal(psql(database, `select pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),p.prosecdef from pg_proc p where p.oid='public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)'::regprocedure;`), "p_request_id_text text, p_expected_actor_id uuid, p_preview_schema text, p_rule_version text, p_source_cutoffs jsonb, p_snapshot_cutoffs jsonb, p_snapshot_hash text, p_plan_hash text, p_projection_hash text, p_request_fingerprint text, p_plan jsonb, p_projections jsonb|jsonb|t")
    assert.equal(psql(database, `select has_function_privilege('authenticated','public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)','execute'),has_function_privilege('anon','public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)','execute'),has_function_privilege('service_role','public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)','execute');`), "t|f|f")
  })
})
