import assert from "node:assert/strict"
import test from "node:test"

import { readMiDiaPage, resolveMiDiaScope, type MiDiaDeps, type MiDiaItem, type MiDiaSuccess } from "@/lib/admin/mi-dia"

const ACTOR = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const LEAD = "33333333-3333-4333-8333-333333333333"
const TASK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const REF = "2026-09-28T12:00:00.123000Z"
const TODAY = "2026-09-28T06:00:00.000000Z"
const TOMORROW = "2026-09-29T06:00:00.000000Z"

const item = (values: Partial<MiDiaItem> = {}): MiDiaItem => ({
  taskId: TASK, ownerId: ACTOR, ownerLabel: "Asesora Uno", kind: "follow_up", status: "pending",
  description: "Contactar", dueAt: REF, bucket: "today", leadId: LEAD, quoteId: null,
  navigationHref: `/admin/leads/${LEAD}`, ...values,
})
const success = (values: Partial<MiDiaSuccess> = {}): MiDiaSuccess => ({
  ok: true, referenceTime: REF, todayStart: TODAY, tomorrowStart: TOMORROW, scope: "self",
  counts: { overdue: 0, today: 1, upcoming: 0, total: 1 }, items: [item()],
  pageInfo: { hasMore: false, nextCursor: null }, ...values,
})

function harness(options: { roles?: readonly string[]; active?: boolean; user?: boolean; result?: unknown; now?: () => Date } = {}) {
  const calls: string[] = []; let args: unknown
  const mark = <T>(name: string, value: T) => { calls.push(name); return value }
  const deps: MiDiaDeps = {
    createAuthClient: async () => mark("auth-client", {}),
    getUser: async () => mark("user", { data: { user: options.user === false ? null : { id: ACTOR } }, error: null }),
    readProfile: async () => mark("profile", { data: { id: ACTOR, is_active: options.active !== false }, error: null }),
    readRoles: async () => mark("roles", { data: (options.roles ?? ["asesor"]).map((name) => ({ roles: { name } })), error: null }),
    createReadClient: async () => mark("read-client", {}),
    invokeRpc: async (_client, value) => { args = value; return mark("rpc", { data: options.result ?? success(), error: null }) },
    now: options.now ?? (() => new Date("2026-09-28T12:00:00.123Z")),
  }
  return { deps, calls, args: () => args }
}

test("auth, active profile, supported scope, request, and the second client are strictly ordered", async () => {
  assert.equal(resolveMiDiaScope(["admin", "operaciones"]), "all")
  assert.equal(resolveMiDiaScope(["manager", "asesor"]), "team")
  assert.equal(resolveMiDiaScope(["asesor", "marketing"]), "self")
  assert.equal(resolveMiDiaScope(["operaciones", "unknown"]), null)
  const first = harness()
  assert.deepEqual(await readMiDiaPage({ cursor: null }, first.deps), success())
  assert.deepEqual(first.calls, ["auth-client", "user", "profile", "roles", "read-client", "rpc"])
  assert.deepEqual(first.args(), { p_reference_time_text: REF, p_expected_actor_id: ACTOR, p_limit: 20, p_after_due_at_text: null, p_after_id_text: null })
  for (const [options, code] of [[{ user: false }, "AUTH_REQUIRED"], [{ active: false }, "AUTH_INACTIVE"], [{ roles: ["finanzas"] }, "AUTH_ROLE_UNSUPPORTED"]] as const) {
    const denied = harness(options)
    assert.deepEqual(await readMiDiaPage({ cursor: { bad: true } }, denied.deps), { ok: false, error: { code, message: code } })
    assert.equal(denied.calls.includes("read-client"), false)
  }
})

test("cursor input is exact and carries reference time and the due/id key unchanged", async () => {
  const cursor = { referenceTime: REF, afterDueAt: "2026-09-28T12:00:00.122999Z", afterId: TASK }
  const later = success({ items: [item({ taskId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })] })
  const next = harness({ result: later, now: () => { throw new Error("clock must not run") } })
  assert.deepEqual(await readMiDiaPage({ cursor }, next.deps), later)
  assert.deepEqual(next.args(), { p_reference_time_text: REF, p_expected_actor_id: ACTOR, p_limit: 20, p_after_due_at_text: cursor.afterDueAt, p_after_id_text: TASK })
  const invalid = [{}, { cursor: [] }, { cursor: null, extra: true }, { cursor: { referenceTime: REF, afterDueAt: REF } },
    { cursor: { referenceTime: REF, afterDueAt: REF, afterId: TASK, extra: true } },
    { cursor: { referenceTime: "2026-09-28T12:00:00.123Z", afterDueAt: REF, afterId: TASK } },
    { cursor: { referenceTime: REF, afterDueAt: REF, afterId: TASK.toUpperCase() } }, new Proxy({ cursor: null }, {})]
  for (const input of invalid) {
    const blocked = harness()
    assert.deepEqual(await readMiDiaPage(input, blocked.deps), { ok: false, error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" } })
    assert.equal(blocked.calls.includes("read-client"), false)
  }
})

test("decoder closes exact shapes, boundaries, ordering, counts, cursors, and hostile data", async () => {
  const boundaryItems = [
    item({ taskId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", dueAt: "2026-09-28T12:00:00.122999Z", bucket: "overdue" }),
    item({ taskId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2" }),
    item({ taskId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", dueAt: TOMORROW, bucket: "upcoming" }),
  ]
  const boundaries = success({ counts: { overdue: 1, today: 1, upcoming: 1, total: 3 }, items: boundaryItems })
  assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ result: boundaries }).deps), boundaries)
  const nightRef = "2026-09-28T03:00:00.000000Z"
  const night = success({ referenceTime: nightRef, todayStart: "2026-09-27T06:00:00.000000Z", tomorrowStart: TODAY, items: [item({ dueAt: nightRef })] })
  assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ result: night, now: () => new Date("2026-09-28T03:00:00.000Z") }).deps), night)
  const twenty = Array.from({ length: 20 }, (_, index) => item({ taskId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}` }))
  const paged = success({ counts: { overdue: 0, today: 20, upcoming: 0, total: 20 }, items: twenty,
    pageInfo: { hasMore: true, nextCursor: { referenceTime: REF, afterDueAt: REF, afterId: twenty[19].taskId } } })
  assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ result: paged }).deps), paged)
  const accessor = success(); Object.defineProperty(accessor, "scope", { enumerable: true, get: () => "self" })
  const symbol = success() as MiDiaSuccess & { [key: symbol]: boolean }; symbol[Symbol("extra")] = true
  const sparse = success(); sparse.items = new Array(1)
  const malformed: unknown[] = [new Proxy(success(), {}), accessor, symbol, sparse,
    { ...success(), extra: true }, { ...success(), scope: "other" },
    success({ counts: { overdue: 0, today: 1, upcoming: 0, total: 2 } }),
    success({ items: [item(), item()] }), success({ items: [...boundaryItems].reverse(), counts: { overdue: 1, today: 1, upcoming: 1, total: 3 } }),
    success({ pageInfo: { hasMore: true, nextCursor: null } }),
    success({ pageInfo: { hasMore: false, nextCursor: { referenceTime: REF, afterDueAt: REF, afterId: TASK } } }),
  ]
  for (const result of malformed) {
    assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ result }).deps), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  }
})

test("navigation is null-preserving and non-null paths require local role, owner, kind, and context coherence", async () => {
  const nullLink = success({ items: [item({ navigationHref: null })] })
  assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ result: nullLink }).deps), nullLink)
  const adminPage = success({ scope: "all", items: [item({ ownerId: OTHER })] })
  assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ roles: ["admin"], result: adminPage }).deps), adminPage)
  for (const roles of [["manager"], ["manager", "asesor"]] as const) {
    const team = success({ scope: "team", items: [item({ ownerId: OTHER })] })
    assert.deepEqual(await readMiDiaPage({ cursor: null }, harness({ roles: [...roles], result: team }).deps), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  }
  for (const badItem of [item({ navigationHref: `/admin/quotes/${LEAD}` }), item({ quoteId: LEAD }), item({ ownerId: OTHER })]) {
    assert.equal((await readMiDiaPage({ cursor: null }, harness({ result: success({ items: [badItem] }) }).deps)).ok, false)
  }
})

test("provider details, throws, and malformed closed failures are suppressed", async () => {
  const provider: MiDiaDeps = { ...harness().deps, invokeRpc: async () => ({ data: null, error: { message: "secret provider text" } }) }
  assert.deepEqual(await readMiDiaPage({ cursor: null }, provider), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  const thrown: MiDiaDeps = { ...harness().deps, invokeRpc: async () => { throw new Error("PII") } }
  assert.deepEqual(await readMiDiaPage({ cursor: null }, thrown), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  const malformed = harness({ result: { ok: false, error: { code: "OTHER", message: "provider detail" } } })
  assert.deepEqual(await readMiDiaPage({ cursor: null }, malformed.deps), { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
})
