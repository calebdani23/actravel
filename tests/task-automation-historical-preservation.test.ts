import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"
import { actorSession, applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime"

const changeRoot = "openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap"
const expected = [
  ["9d34d3006bbd73080ca2f89cdde12fd80f53d347a19ccd9fcd0294d741ff3d26", "db/migrations/0077_task_action_audit_foundation.sql"],
  ["74497f963022a442bcde5c30b2976f35ea26dc851c06547b0f8be11239d5d7e3", "db/migrations/0078_task_action_rpc.sql"],
  ["918d7117f53f6665209fbdfccefe0613be1dadb57b4015386c42f322d167428b", "db/migrations/0079_task_automation_foundation.sql"],
  ["28baa3d2f0f7f4c8699cfcf7eb57b20111b7d8edb6217299192dfeea05741447", "db/migrations/0080_task_automation_sources.sql"],
] as const

test("historical bootstrap preserves the exact 0077-0080 working-tree bytes", () => {
  const manifest = readFileSync(`${changeRoot}/0077-0080.sha256`, "utf8")
  assert.equal(manifest, `${expected.map(([hash, path]) => `${hash}  ${path}`).join("\n")}\n`)
  for (const [hash, path] of expected) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash, path)
  }
})

test("S1 remains a pure removable boundary", () => {
  const source = readFileSync("lib/admin/task-automation-historical-contract.ts", "utf8")
  assert.doesNotMatch(source, /server-only|@\/lib\/supabase|process\.|readFile|writeFile|fetch\(|createClient|\.rpc\(/i)
})

test("S18 readiness caller is removable and final evidence remains local-only", () => {
  const adapter = readFileSync("lib/admin/task-automation-historical-readiness.ts", "utf8")
  assert.match(adapter, /server-only/)
  assert.match(adapter, /authorizeTaskAutomationHistoricalAdmin[\s\S]*createPersistenceClient[\s\S]*read_task_automation_historical_readiness/)
  assert.doesNotMatch(adapter, /apply_task_automation_historical_plan|approve_task_automation_historical_plan|insert\(|update\(|delete\(/)
  const design = readFileSync(`${changeRoot}/design.md`, "utf8")
  const tasks = readFileSync(`${changeRoot}/tasks.md`, "utf8")
  assert.match(design, /After any approval or bootstrap state exists, rollback is forward-only/)
  assert.match(design, /callers are disabled, but all approvals, receipts, Tasks, origins, outcomes, tombstones[\s\S]*remain/)
  assert.match(tasks, /remote access\/mutation[\s\S]*Week 03 closure are outside every task/)
})

const runtimeEnabled = process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS === "1"
const uuid = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const parse = (value: string) => JSON.parse(value.split(/\r?\n/).at(-1)!)

test("0081 enforces exact historical boundaries in disposable PostgreSQL", { skip: !runtimeEnabled, timeout: 240_000 }, async () => {
  const database = "task_automation_historical_boundary"
  const actor = { admin: uuid(1, 81), inactive: uuid(1, 82), advisor: uuid(1, 83), other: uuid(1, 84) }
  const contact = uuid(2, 81), status = uuid(3, 81), historical = uuid(4, 81), future = uuid(4, 82)
  const call = (sessionActor: string | null, expected = actor.admin) => parse(psql(database,
    `${sessionActor ? actorSession(sessionActor) : ""} select public.read_task_automation_historical_boundaries('${expected}')::text;`))
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage])
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", `create database ${database} template quote_base;`)
    for (const name of migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 79)) applyMigration(database, name)
    psql(database, `
      insert into auth.users(id,email) values ('${actor.admin}','admin@test'),('${actor.inactive}','inactive@test'),('${actor.advisor}','advisor@test'),('${actor.other}','other@test');
      insert into public.profiles(id,full_name,is_active) values ('${actor.admin}','Admin',true),('${actor.inactive}','Inactive',false),('${actor.advisor}','Advisor',true),('${actor.other}','Other',true);
      insert into public.roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing;
      insert into public.profile_roles(profile_id,role_id) select '${actor.admin}',id from public.roles where name='admin';
      insert into public.profile_roles(profile_id,role_id) select '${actor.advisor}',id from public.roles where name='asesor';
      insert into public.contacts(id,first_name,email) values ('${contact}','Historical','historical@test');
      insert into public.lead_statuses(id,name,label_es,label_en) values ('${status}','historical_open','Open','Open');
      insert into public.leads(id,contact_id,status_id,created_at) values ('${historical}','${contact}','${status}','2026-01-01 00:00:00+00');
    `)
    applyMigration(database, "0080_task_automation_sources.sql")
    psql(database, `insert into public.leads(id,contact_id,status_id,created_at) select '${future}','${contact}','${status}',cutoff_at+interval '1 microsecond' from public.task_automation_source_cutoffs where source_kind='opportunity_assignment';`)
    applyMigration(database, "0081_task_automation_historical_preview_boundary.sql")

    assert.deepEqual(call(null), { ok: false, error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } })
    assert.deepEqual(call(actor.inactive, actor.inactive), { ok: false, error: { code: "AUTH_INACTIVE", message: "AUTH_INACTIVE" } })
    assert.deepEqual(call(actor.advisor, actor.advisor), { ok: false, error: { code: "AUTH_NOT_ADMIN", message: "AUTH_NOT_ADMIN" } })
    assert.deepEqual(call(actor.admin, actor.other), { ok: false, error: { code: "AUTH_ACTOR_MISMATCH", message: "AUTH_ACTOR_MISMATCH" } })
    const success = call(actor.admin)
    assert.deepEqual(Object.keys(success).sort(), ["ok", "opportunity_root_count", "quote_version_root_count", "snapshot_cutoffs", "source_cutoffs"])
    assert.equal(success.ok, true); assert.equal(success.opportunity_root_count, 1); assert.equal(success.quote_version_root_count, 0); assert.equal(Number.isInteger(success.opportunity_root_count), true)
    assert.deepEqual(Object.keys(success.source_cutoffs).sort(), ["opportunityAssignment", "quoteSent"])
    assert.deepEqual(Object.keys(success.snapshot_cutoffs).sort(), ["assignmentEvidence", "automationOrigins", "automationOutcomes", "automationTombstones", "opportunityRoots", "quoteSourceEvidence", "quoteVersionRoots", "taskOccupancy"])
    assert.deepEqual(success.snapshot_cutoffs.opportunityRoots, ["2026-01-01T00:00:00.000000Z", historical])
    assert.equal(psql(database, `select public.task_automation_historical_hash('{"b":1,"a":0}'::jsonb);`), createHash("sha256").update('{"a":0,"b":1}').digest("hex"))
    assert.equal(psql(database, `select public.task_automation_historical_task_uuid('${"0".repeat(64)}');`), "0d51288c-8994-5a85-b9d0-18826b6ec18b")
    assert.equal(psql(database, `select has_function_privilege('authenticated','public.read_task_automation_historical_boundaries(uuid)','EXECUTE')::text||':'||has_function_privilege('anon','public.read_task_automation_historical_boundaries(uuid)','EXECUTE')::text||':'||has_function_privilege('service_role','public.read_task_automation_historical_boundaries(uuid)','EXECUTE')::text||':'||has_table_privilege('authenticated','public.task_automation_source_cutoffs','SELECT')::text;`), "true:false:false:false")
    assert.throws(() => psql(database, "update public.task_automation_source_cutoffs set cutoff_at=cutoff_at+interval '1 second';"), /TASK_AUTOMATION_CUTOFF_IMMUTABLE/)
    psql(database, `insert into public.leads(contact_id,status_id,created_at) select '${contact}','${status}',cutoff_at-interval '1 second' from public.task_automation_source_cutoffs cross join generate_series(1,2000) where source_kind='opportunity_assignment';`)
    assert.deepEqual(call(actor.admin), { ok: false, error: { code: "LIMIT_EXCEEDED", message: "LIMIT_EXCEEDED" } })
    psql(database, "alter table public.task_automation_source_cutoffs disable trigger prevent_task_automation_cutoff_change; alter table public.task_automation_source_cutoffs drop constraint task_automation_source_cutoffs_pkey; insert into public.task_automation_source_cutoffs select * from public.task_automation_source_cutoffs where source_kind='quote_sent';")
    assert.deepEqual(call(actor.admin), { ok: false, error: { code: "CUTOFF_UNAVAILABLE", message: "CUTOFF_UNAVAILABLE" } })
    psql(database, "delete from public.task_automation_source_cutoffs where ctid=(select ctid from public.task_automation_source_cutoffs where source_kind='quote_sent' limit 1); alter table public.task_automation_source_cutoffs drop constraint task_automation_source_cutoffs_time_check; update public.task_automation_source_cutoffs set cutoff_at='infinity' where source_kind='quote_sent';")
    assert.deepEqual(call(actor.admin), { ok: false, error: { code: "CUTOFF_UNAVAILABLE", message: "CUTOFF_UNAVAILABLE" } })
    psql(database, "delete from public.task_automation_source_cutoffs where source_kind='quote_sent';")
    assert.deepEqual(call(actor.admin), { ok: false, error: { code: "CUTOFF_UNAVAILABLE", message: "CUTOFF_UNAVAILABLE" } })
  } finally {
    cleanupPostgres(); assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "")
  }
})
