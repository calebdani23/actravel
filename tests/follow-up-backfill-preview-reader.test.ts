import assert from "node:assert/strict"
import test from "node:test"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createPreviewReadDataSource, readFollowUpBackfillPreview, type PreviewReadDataSource } from "../lib/admin/follow-up-backfill-preview-reader"
import type { PreviewResult } from "../lib/admin/follow-up-backfill-preview"

const owner = "33333333-3333-4333-8333-333333333333"
const lead = "22222222-2222-4222-8222-222222222222"
const eventId = "11111111-1111-4111-8111-111111111111"
const source: PreviewReadDataSource = {
  eventCutoff: async () => [{ created_at: "2026-01-31T23:59:59.000000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
  taskCutoff: async () => [], events: async () => [{ id: eventId, lead_id: lead, created_at: "2026-01-01T00:00:00.000000Z", event_type: "follow_up_registered", follow_up_at: "2026-01-02", has_note: true }], tasks: async () => [],
  leads: async () => [{ id: lead, assigned_to: owner, deleted_at: null, archived_at: null }], profiles: async () => [{ id: owner, is_active: true }],
  profileRoles: async () => [{ profile_id: owner, role_id: "44444444-4444-4444-8444-444444444444" }], roles: async () => [{ id: "44444444-4444-4444-8444-444444444444", name: "asesor" }],
}

const roleId = "44444444-4444-4444-8444-444444444444"
const taskId = "55555555-5555-4555-8555-555555555555"
const taskCreatedAt = "2026-01-03T00:00:00.000000Z"
const idFor = (n: number) => `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`
const manualTask = (id = taskId, leadId = lead) => ({
  id, task_kind: "manual", source_event_id: null, source_event_type: null, source_event_created_at: null,
  source_due_at: null, source_payload: null, metadata: null, status: "pending", owner_id: owner,
  lead_id: leadId, quote_id: null, description: "Manual task", due_at: null,
  idempotency_key: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", created_at: taskCreatedAt,
})
const followUpTask = (id = taskId) => ({
  ...manualTask(id), task_kind: "follow_up", source_event_id: eventId, source_event_type: "follow_up_registered",
  source_event_created_at: "2026-01-01T00:00:00.000000Z", source_due_at: "2026-01-02T00:00:00.000000Z",
  source_payload: { followUpAt: "2026-01-02", hasNote: true }, metadata: {
    schema: "follow_up_task.v1", source_event_id: eventId, source_event_type: "follow_up_registered",
    owner_id: owner, lead_id: lead,
  }, description: "Follow up with lead", due_at: "2026-01-02T00:00:00.000000Z",
  idempotency_key: "f44b1020cf8c806af9763f16caa79037358a472a866519467e246c1f59d8e3f5",
})
const convergingClassify = (seen: { input?: unknown }[]) => (input: any): PreviewResult => {
  seen.push({ input })
  const counts = [0, 0, 0, 0, 0, 0, 0] as PreviewResult["counts"]
  const canonicalPlan: PreviewResult["canonicalPlan"] = [input.ruleVersion, input.cutoffCreatedAt, input.cutoffId, [], counts, 0, 0, 0, 0, false]
  return { rows: [], counts, totalCount: 0, tasks: [], canonicalPlan,
    canonicalBytes: new Uint8Array(), canonicalHash: "x" }
}

test("authorizes before constructing the read source and invokes classifier once", async () => {
  const calls: string[] = []; let classified = 0
  const result = await readFollowUpBackfillPreview({ requireAdminRole: async (roles) => { calls.push(`auth:${roles.join()}`); return {} }, createReadDataSource: async () => { calls.push("source"); return source }, classify: (input) => { classified++; return { rows: [], counts: [0,0,0,0,0,0,0], totalCount: 0, tasks: [], canonicalPlan: [input.ruleVersion,input.cutoffCreatedAt,input.cutoffId,[],[0,0,0,0,0,0,0],0,0,0,0,false], canonicalBytes: new Uint8Array(), canonicalHash: "x" } }, digest: () => "same" })
  assert.equal(result.ok, true); assert.equal(classified, 1); assert.deepEqual(calls, ["auth:admin", "source"])
  if (result.ok) assert.deepEqual(result.eventCutoff, { createdAt: "2026-01-31T23:59:59.000000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
})

test("maps auth, cutoff, digest and classifier failures to stable code-only errors", async () => {
  const denied = await readFollowUpBackfillPreview({ requireAdminRole: async () => { throw new Error("PII") }, createReadDataSource: async () => source })
  assert.deepEqual(denied, { ok: false, error: { code: "Unauthorized", message: "Unauthorized" } })
  const failed = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => ({ ...source, eventCutoff: async () => { throw new Error("secret") } }) })
  assert.deepEqual(failed, { ok: false, error: { code: "QueryFailed", message: "QueryFailed" }, diagnostics: { logicalReads: 1, physicalAttempts: 1 } })
})

test("reports logical reads separately from provider retry attempts", async () => {
  const calls: string[] = []
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}),
    createReadDataSource: async () => ({ ...source, physicalAttempts: () => 4, eventCutoff: async () => { calls.push("cutoff"); return [{ created_at: "2026-01-31T23:59:59.000000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] } }),
    digest: () => "same",
    classify: () => ({ rows: [], counts: [0, 0, 0, 0, 0, 0, 0], totalCount: 0, tasks: [], canonicalPlan: ["follow-up-backfill.v1", "2026-01-31T23:59:59.000000Z", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [], [0, 0, 0, 0, 0, 0, 0], 0, 0, 0, 0, false], canonicalBytes: new Uint8Array(), canonicalHash: "x" }),
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  if (result.ok) assert.deepEqual(result.diagnostics, { logicalReads: 12, physicalAttempts: 4 })
  assert.deepEqual(calls, ["cutoff"])
})

test("counts four underlying fetch attempts for one logical source method", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SECRET_KEY = "test-key"
  let attempts = 0
  const fetchImpl: typeof fetch = async () => {
    attempts++
    if (attempts < 4) return new Response("temporary", { status: 503 })
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
  }
  const readSource = createPreviewReadDataSource(fetchImpl)
  await readSource.events("2026-01-31T23:59:59.000000Z|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", undefined, 200)
  assert.equal(attempts, 4)
  assert.equal(readSource.physicalAttempts?.(), 4)
})

test("integrates a four-attempt cutoff fetch as one logical read without extra pages or chunks", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SECRET_KEY = "test-key"
  let attempts = 0
  const successfulRequests: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input)
    if (url.includes("select=created_at%2Cid") && url.includes("lead_events")) {
      attempts++
      if (attempts < 4) return new Response("temporary", { status: 503 })
      successfulRequests.push(url)
      return new Response(JSON.stringify([{ created_at: "2026-01-31T23:59:59.000000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }]), { status: 200 })
    }
    successfulRequests.push(url)
    if (url.includes("/tasks?")) return new Response("[]", { status: 200 })
    if (url.includes("/lead_events?")) return new Response(JSON.stringify([{ id: eventId, lead_id: lead, created_at: "2026-01-01T00:00:00.000000Z", event_type: "follow_up_registered", follow_up_at: "2026-01-02", has_note: true }]), { status: 200 })
    if (url.includes("/leads?")) return new Response(JSON.stringify([{ id: lead, assigned_to: owner, deleted_at: null, archived_at: null }]), { status: 200 })
    if (url.includes("/profiles?")) return new Response(JSON.stringify([{ id: owner, is_active: true }]), { status: 200 })
    if (url.includes("/profile_roles?")) return new Response(JSON.stringify([{ profile_id: owner, role_id: roleId }]), { status: 200 })
    if (url.includes("/roles?")) return new Response(JSON.stringify([{ id: roleId, name: "asesor" }]), { status: 200 })
    throw new Error(`unexpected request: ${url}`)
  }
  const result = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), fetch: fetchImpl, digest: () => "same", classify: convergingClassify([]) })
  assert.equal(result.ok, true, JSON.stringify(result))
  if (result.ok) assert.deepEqual(result.diagnostics, { logicalReads: 12, physicalAttempts: 15 })
  assert.equal(attempts, 4)
  assert.equal(successfulRequests.filter((url) => url.includes("/lead_events?") && !url.includes("select=created_at%2Cid")).length, 2)
  assert.equal(successfulRequests.filter((url) => url.includes("/tasks?") && !url.includes("select=created_at%2Cid")).length, 0)
  assert.equal(successfulRequests.filter((url) => url.includes("/leads?")).length, 2)
  assert.equal(successfulRequests.filter((url) => url.includes("/profiles?")).length, 2)
  assert.equal(successfulRequests.filter((url) => url.includes("/profile_roles?")).length, 2)
  assert.equal(successfulRequests.filter((url) => url.includes("/roles?")).length, 2)
})

test("fails closed on extra event columns and never invokes the classifier", async () => {
  let classified = 0
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}), createReadDataSource: async () => ({ ...source,
      events: async () => [{ id: eventId, lead_id: lead, created_at: "2026-01-01T00:00:00.000000Z", event_type: "follow_up_registered", follow_up_at: null, has_note: false, secret: "pii" }],
    }), classify: () => { classified++; throw new Error("should not run") },
  })
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "MalformedRow"); assert.equal(classified, 0)
})

test("requires sorted page chains and accepts an empty task population", async () => {
  const seen: Array<[string | undefined, number | undefined]> = []
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}), createReadDataSource: async () => ({ ...source,
      events: async (_cut, cursor, limit) => { seen.push([cursor, limit]); return cursor ? [] : [{ id: eventId, lead_id: lead, created_at: "2026-01-01T00:00:00.000000Z", event_type: "follow_up_registered", follow_up_at: "2026-01-02", has_note: true }] },
    }), digest: () => "same",
  })
  assert.equal(result.ok, true); assert.deepEqual(seen, [[undefined, 200], [undefined, 200]])
})

test("rejects malformed canonical cutoff rows directly", async () => {
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}),
    createReadDataSource: async () => ({ ...source, eventCutoff: async () => [{ created_at: "not-canonical", id: eventId }] }),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, "MalformedRow")
})

test("uses exact event aliases and a raw, sorted bounded query", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SECRET_KEY = "test-key"
  const urls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(String(input))
    return new Response(JSON.stringify([{ id: eventId, lead_id: lead, created_at: "2026-01-01T00:00:00.000000Z", event_type: "follow_up_registered", follow_up_at: "2026-01-02", has_note: true }]), { status: 200, headers: { "content-type": "application/json" } })
  }
  const readSource = createPreviewReadDataSource(fetchImpl)
  await readSource.events("2026-01-31T23:59:59.000000Z|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", undefined, 200)
  const url = decodeURIComponent(urls[0])
  assert.match(url, /follow_up_at:payload->>followUpAt/)
  assert.match(url, /has_note:payload->hasNote/)
  assert.match(url, /order=created_at\.asc,id\.asc/)
  assert.match(url, /created_at\.lt\.2026-01-31T23:59:59\.000000Z,and\(created_at\.eq\.2026-01-31T23:59:59\.000000Z,id\.lte\.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\)/)
  assert.equal(readSource.physicalAttempts?.(), 1)
})

test("maps every manual and complete follow-up Task to occupancy and exact existing facts", async () => {
  const captured: any[] = []
  const digests: any[] = []
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}),
    createReadDataSource: async () => ({ ...source, taskCutoff: async () => [{ created_at: taskCreatedAt, id: "77777777-7777-4777-8777-777777777777" }], tasks: async () => [manualTask(), followUpTask("66666666-6666-4666-8666-666666666666")] }),
    digest: (snapshot) => { digests.push(snapshot); return "same" }, classify: convergingClassify(captured),
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(captured.length, 1)
  assert.deepEqual(captured[0].input.taskOccupancies.map((task: any) => task.id), [taskId, "66666666-6666-4666-8666-666666666666"])
  assert.deepEqual(captured[0].input.existingTasks, [followUpTask("66666666-6666-4666-8666-666666666666")])
  assert.deepEqual(captured[0].input.taskOccupancies, [manualTask(), followUpTask("66666666-6666-4666-8666-666666666666")].map(({ id, owner_id, lead_id, idempotency_key }) => ({ id, owner_id, lead_id, idempotency_key })))
  assert.deepEqual(digests[0][5].map((task: any) => task.id), [taskId, "66666666-6666-4666-8666-666666666666"])
})

test("chunks more than 200 unique join IDs in sorted chunks", async () => {
  const tasks = Array.from({ length: 201 }, (_, i) => manualTask(idFor(i + 1), idFor(i + 1000)))
  const calls: string[][] = []
  let taskPage = 0
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}), createReadDataSource: async () => ({ ...source, taskCutoff: async () => [{ created_at: taskCreatedAt, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }],
      events: async () => [], tasks: async (_cut: string, _cursor: string | undefined, limit?: number) => { const offset = (taskPage++ % 2) * 200; return tasks.slice(offset, offset + (limit === 1 ? 1 : 200)) },
      leads: async (ids) => { calls.push(ids); return ids.map((id) => ({ id, assigned_to: null, deleted_at: null, archived_at: null })) },
    }), digest: () => "same", classify: convergingClassify([]),
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  const chunks = [Array.from({ length: 200 }, (_, i) => idFor(i + 1000)), [idFor(1200)]]
  assert.deepEqual(calls, [...chunks, ...chunks])
})

test("validates role joins globally, dedupes identical mappings, and rejects malformed/conflicting rows", async () => {
  const role = { id: roleId, name: "asesor" }
  const baseSource = (overrides: Partial<PreviewReadDataSource> = {}): PreviewReadDataSource => ({ ...source,
    profileRoles: async () => [{ profile_id: owner, role_id: roleId }, { profile_id: owner, role_id: roleId }], roles: async () => [role], ...overrides,
  })
  const mixedCapture: any[] = []
  const mixed = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => baseSource({ roles: async () => [role, { id: idFor(2), name: "unsupported" }] , profileRoles: async () => [{ profile_id: owner, role_id: roleId }, { profile_id: owner, role_id: idFor(2) }] }), digest: () => "same", classify: convergingClassify(mixedCapture) })
  assert.equal(mixed.ok, true)
  assert.equal(mixedCapture[0].input.events[0].owner.tag, "invalid-role")
  const missing = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => baseSource({ roles: async () => [] }), digest: () => "same", classify: convergingClassify([]) })
  assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.error.code, "IncompleteJoin")
  const malformed = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => baseSource({ roles: async () => [{ ...role, name: 3 } as any] }), digest: () => "same" })
  assert.equal(malformed.ok, false); if (!malformed.ok) assert.equal(malformed.error.code, "MalformedRow")
})

test("applies missing-profile and inactive-profile precedence directly", async () => {
  const baseSource = (profileRows: unknown[]): PreviewReadDataSource => ({ ...source,
    profiles: async () => profileRows,
    profileRoles: async () => [{ profile_id: owner, role_id: roleId }],
    roles: async () => [{ id: roleId, name: "asesor" }],
  })
  const capture: any[] = []
  const missing = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => baseSource([]), digest: () => "same", classify: convergingClassify(capture) })
  assert.equal(missing.ok, true, JSON.stringify(missing))
  assert.equal(capture[0].input.events[0].owner.tag, "missing-profile")
  const inactive = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => baseSource([{ id: owner, is_active: false }]), digest: () => "same", classify: convergingClassify(capture) })
  assert.equal(inactive.ok, true, JSON.stringify(inactive))
  assert.equal(capture[1].input.events[0].owner.tag, "inactive-profile")
})

test("dedupes an identical profile_role mapping into one active owner fact", async () => {
  const capture: any[] = []
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}),
    createReadDataSource: async () => ({ ...source, profileRoles: async () => [{ profile_id: owner, role_id: roleId }, { profile_id: owner, role_id: roleId }], roles: async () => [{ id: roleId, name: "asesor" }] }),
    digest: () => "same", classify: convergingClassify(capture),
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.deepEqual(capture[0].input.events[0].owner, { tag: "active", ownerId: owner, roles: ["asesor"] })
})

test("normalizes digest occupancy input by Task ID, not created_at order", async () => {
  const first = { ...manualTask(idFor(2)), created_at: "2026-01-01T00:00:00.000000Z" }
  const second = { ...manualTask(idFor(1)), created_at: "2026-01-02T00:00:00.000000Z" }
  const snapshots: any[] = []
  const result = await readFollowUpBackfillPreview({
    requireAdminRole: async () => ({}),
    createReadDataSource: async () => ({ ...source, taskCutoff: async () => [{ created_at: second.created_at, id: idFor(2) }], tasks: async () => [first, second] }),
    digest: (snapshot) => { snapshots.push(snapshot); return "same" }, classify: convergingClassify([]),
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.ok(snapshots.length >= 2)
  for (const snapshot of snapshots) assert.deepEqual(snapshot[5].map((task: any) => task.id), [idFor(1), idFor(2)])
})

test("rejects noncanonical page timestamps", async () => {
  for (const override of [
    { events: async () => [{ id: eventId, lead_id: lead, created_at: "2026-01-01", event_type: "follow_up_registered", follow_up_at: null, has_note: false }] },
    { tasks: async () => [manualTask().constructor === Object ? { ...manualTask(), created_at: "2026-01-03" } : manualTask()] },
  ]) {
    const result = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => ({ ...source, taskCutoff: async () => [{ created_at: taskCreatedAt, id: taskId }], ...override }), digest: () => "same" })
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "MalformedRow")
  }
})

test("uses P3/P4 convergence, counts classifier calls, and stops after digest failure", async () => {
  let classified = 0
  const hashes = ["p1", "p2", "p3", "p3"]
  const converged = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => source, digest: () => hashes.shift()!, classify: () => { classified++; return {} as any } })
  assert.equal(converged.ok, true); assert.equal(classified, 1)
  const nonconverged = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => source, digest: (() => { let n = 0; return () => `hash-${n++}` })(), classify: (() => { classified++ }) as any })
  assert.equal(nonconverged.ok, false); if (!nonconverged.ok) assert.equal(nonconverged.error.code, "SnapshotNotConverged"); assert.equal(classified, 1)
  let sourceReads = 0
  const counted = { ...source, eventCutoff: async () => { sourceReads++; return source.eventCutoff() }, taskCutoff: async () => { sourceReads++; return source.taskCutoff() }, events: async (cut: string, cursor?: string, limit?: number) => { sourceReads++; return source.events(cut, cursor, limit) } }
  const failed = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => counted, digest: () => { throw new Error("digest") }, classify: (() => { classified++ }) as any })
  assert.equal(failed.ok, false); if (!failed.ok) assert.equal(failed.error.code, "QueryFailed"); assert.equal(sourceReads, 3)
})

test("returns the 2,001-row sentinel without invoking the classifier", async () => {
  const rows = Array.from({ length: 2001 }, (_, i) => ({ id: idFor(i + 1), lead_id: lead, created_at: "2026-01-01T00:00:00.000000Z", event_type: "follow_up_registered", follow_up_at: null, has_note: false }))
  let page = 0, classified = 0
  const result = await readFollowUpBackfillPreview({ requireAdminRole: async () => ({}), createReadDataSource: async () => ({ ...source,
    events: async (_cut, _cursor, limit) => { const index = page++ % 11; return limit === 1 || index === 10 ? [rows[2000]] : rows.slice(index * 200, index * 200 + 200) },
  }), digest: () => "never", classify: (() => { classified++ }) as any })
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "LimitExceeded"); assert.equal(classified, 0)
})
