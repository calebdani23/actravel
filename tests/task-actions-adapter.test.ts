import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { performTaskAction, type TaskActionResult } from "@/lib/admin/task-actions"
import { applyMigration, cleanupPostgres, containerName, docker, migrationNames, postgresImage, prepareBaseDatabase, psql, waitForPostgres } from "./helpers/postgres-runtime"

const enabled = process.env.RUN_TASK_AUTOMATION_DB_TESTS === "1"
const actorId = "41000000-0000-4000-8000-000000000001"
const ownerId = "41000000-0000-4000-8000-000000000002"
const requestId = "4a000000-0000-4000-8000-000000000001"
const taskId = "43000000-0000-4000-8000-000000000001"
const input = { requestId, taskId, targetStatus: "completed", cancelReason: null, completionOutcome: "work_completed", note: "Done" } as const
const failure = (code: string) => ({ ok: false, error: { code, message: code } })
const success = (): Record<string, unknown> => ({
  ok: true, schema: "task-action-result.v1", receiptId: "44000000-0000-4000-8000-000000000001",
  requestId, taskId, actorKind: "human", actorId, ownerId, action: "complete", fromStatus: "in_progress",
  targetStatus: "completed", cancelReason: null, completionOutcome: "work_completed", note: "Done",
  sourceKind: null, sourceId: null, sourceKey: null, sourceOrder: null, outcome: "applied",
  createdAt: "2026-09-18T12:34:56.123456Z", replayed: false,
})
const auth = async (...args: unknown[]) => {
  assert.equal(args.length, 0)
  return { user: { id: actorId }, profile: { id: actorId, full_name: "Actor", is_active: true }, roles: [] }
}
const run = (data: unknown, overrides: Record<string, unknown> = {}) => performTaskAction(input, {
  requireAdminRole: auth, createClient: async () => ({}) as never,
  invokeRpc: async () => ({ data, error: null }), ...overrides,
} as never)

test("authenticates before client creation and invokes only task_action with the exact arguments", async () => {
  const calls: string[] = []
  const result = await performTaskAction(input, {
    requireAdminRole: (async (...args: unknown[]) => { assert.equal(args.length, 0); calls.push("auth"); return auth() }) as never,
    createClient: async () => { calls.push("client"); return { rpc: async (name: string, args: unknown) => { calls.push(name); assert.deepEqual(args, {
      p_request_id_text: requestId, p_expected_actor_id: actorId, p_task_id_text: taskId, p_target_status: "completed",
      p_cancel_reason: null, p_completion_outcome: "work_completed", p_note: "Done",
    }); return { data: success(), error: null } } } as never },
  })
  assert.deepEqual(calls, ["auth", "client", "task_action"])
  assert.deepEqual(result, success() as TaskActionResult)

  let created = false
  const authError = new Error("auth boundary")
  await assert.rejects(() => performTaskAction(input, {
    requireAdminRole: async () => { throw authError },
    createClient: async () => { created = true; return {} as never },
  }), (error) => error === authError)
  assert.equal(created, false)
})

test("rejects noncanonical input and closed metadata before client creation", async () => {
  const invalid = [
    { ...input, extra: true }, { ...input, requestId: requestId.toUpperCase() },
    { ...input, targetStatus: "in_progress", completionOutcome: null, note: "note" },
    { ...input, cancelReason: "other" }, { ...input, completionOutcome: "unknown" },
    { ...input, targetStatus: "canceled", cancelReason: null, completionOutcome: null, note: null },
    { ...input, note: " padded " }, { ...input, note: "é".repeat(1001) },
  ]
  for (const value of invalid) {
    let created = false
    assert.deepEqual(await performTaskAction(value as never, { requireAdminRole: auth, createClient: async () => { created = true; return {} as never } }), failure("INVALID_REQUEST"))
    assert.equal(created, false)
  }
})

test("strictly decodes results and suppresses provider details for forward-disable compatibility", async () => {
  for (const code of ["AUTH_REQUIRED", "AUTH_INACTIVE", "AUTH_ACTOR_MISMATCH", "INVALID_REQUEST", "TASK_FORBIDDEN", "TASK_ACTION_IDEMPOTENCY_CONFLICT", "TASK_INVALID_TRANSITION"]) {
    assert.deepEqual(await run(failure(code)), failure(code))
  }
  for (const mutate of [
    (value: Record<string, unknown>) => { value.receiptId = "bad" },
    (value: Record<string, unknown>) => { value.requestId = taskId },
    (value: Record<string, unknown>) => { value.actorId = ownerId },
    (value: Record<string, unknown>) => { value.action = "cancel" },
    (value: Record<string, unknown>) => { value.sourceKind = "forbidden" },
    (value: Record<string, unknown>) => { value.outcome = "not_applicable_terminal" },
    (value: Record<string, unknown>) => { value.extra = true },
  ]) {
    const value = success(); mutate(value)
    assert.deepEqual(await run(value), failure("PERSISTENCE_FAILURE"))
  }
  assert.deepEqual(await run({ ok: false, error: { code: "INVALID_REQUEST", message: "provider text" } }), failure("PERSISTENCE_FAILURE"))
  assert.deepEqual(await run(success(), { invokeRpc: async () => { throw new Error("provider secret") } }), failure("PERSISTENCE_FAILURE"))
  assert.deepEqual(await run(success(), { invokeRpc: async () => ({ data: null, error: { message: "permission denied for task_action" } }) }), failure("PERSISTENCE_FAILURE"))
})

test("0078 replaces the authenticated legacy grant only after the audited grant and public types drop the legacy RPC", () => {
  const sql = readFileSync("db/migrations/0078_task_action_rpc.sql", "utf8")
  const tasks = readFileSync("lib/admin/tasks.ts", "utf8")
  const types = readFileSync("lib/supabase/database.types.ts", "utf8")
  const grant = sql.indexOf("grant execute on function public.task_action(text,uuid,text,text,text,text,text) to authenticated")
  const revoke = sql.indexOf("revoke all on function public.task_transition(uuid,text) from authenticated")
  assert.ok(grant >= 0 && revoke > grant)
  assert.doesNotMatch(tasks, /transitionTask|rpc\("task_transition"/)
  assert.match(types, /p_target_status: "in_progress" \| "completed" \| "canceled"/)
  assert.doesNotMatch(types, /task_transition:/)
})

test("0078 runtime grants only authenticated audited human execution", { skip: !enabled, timeout: 240_000 }, async () => {
  docker(["run", "--rm", "-d", "--name", containerName, "-e", "POSTGRES_PASSWORD=postgres", postgresImage])
  try {
    await waitForPostgres(); prepareBaseDatabase(); psql("postgres", "create database task_actions_adapter template quote_base;")
    const migrations = migrationNames().filter((name) => Number(name.slice(0, 4)) >= 57 && Number(name.slice(0, 4)) <= 78)
    for (const name of migrations) applyMigration("task_actions_adapter", name)
    assert.equal(psql("task_actions_adapter", "select array[has_function_privilege('authenticated','public.task_action(text,uuid,text,text,text,text,text)','execute'),has_function_privilege('authenticated','public.task_transition(uuid,text)','execute'),has_function_privilege('anon','public.task_action(text,uuid,text,text,text,text,text)','execute'),has_function_privilege('service_role','public.task_action(text,uuid,text,text,text,text,text)','execute')]::text;"), "{t,f,f,f}")
  } finally {
    cleanupPostgres()
    assert.equal(docker(["ps", "-aq", "--filter", `name=^${containerName}$`]), "")
  }
})
