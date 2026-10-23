import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { Database, Json } from "../lib/supabase/database.types"
import type { SnapshotCutoffs, SourceCutoffs } from "../lib/admin/task-automation-historical-contract"
import { canonicalHash } from "../lib/admin/task-automation-historical-contract"
import { buildHistoricalTaskAutomationPlan } from "../lib/admin/task-automation-historical-classification"
import { authorizeTaskAutomationHistoricalAdmin, type BootstrapAuthDeps } from "../lib/admin/task-automation-historical-auth"
import { readTaskAutomationHistoricalPreview } from "../lib/admin/task-automation-historical-preview"
import {
  decodeHistoricalBoundaryResult,
  decodeHistoricalSourceResult,
  HistoricalRootReadFailure,
  readTaskAutomationHistoricalPreviewSource,
  readHistoricalJoinChunks,
  readHistoricalRootKeyset,
  type HistoricalBoundaryResult,
  type HistoricalSourceSuccess,
  type HistoricalSourceResult,
} from "../lib/admin/task-automation-historical-preview-source"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type BoundaryRpc = Database["public"]["Functions"]["read_task_automation_historical_boundaries"]
type SourceRpc = Database["public"]["Functions"]["read_task_automation_historical_sources"]
type BoundaryCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "CUTOFF_UNAVAILABLE" | "LIMIT_EXCEEDED"
type ExpectedBoundaryResult =
  | { ok: true; source_cutoffs: SourceCutoffs; snapshot_cutoffs: SnapshotCutoffs; opportunity_root_count: number; quote_version_root_count: number }
  | { [Code in BoundaryCode]: { ok: false; error: { code: Code; message: Code } } }[BoundaryCode]
type Contracts = [
  Assert<Equal<BoundaryRpc["Args"], { p_expected_actor_id: string }>>,
  Assert<Equal<BoundaryRpc["Returns"], Json>>,
  Assert<Equal<SourceRpc["Args"], { p_expected_actor_id: string; p_boundaries: Json }>>,
  Assert<Equal<SourceRpc["Returns"], Json>>,
  Assert<Equal<HistoricalBoundaryResult, ExpectedBoundaryResult>>,
]
const contracts: Contracts = [true, true, true, true, true]

const migration = "db/migrations/0081_task_automation_historical_preview_boundary.sql"
const timestamp = (value: number) => `2026-01-01T00:00:${String(value).padStart(2, "0")}.000000Z`
const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const hash = (value: string) => value.repeat(64)
const sourceFixture = (): HistoricalSourceSuccess => ({
  ok: true,
  opportunity_facts: [{ opportunity_id: id(1), created_at: timestamp(1), assigned_to: id(2), deleted: false, archived: false, status_id: id(3), terminal: false }],
  quote_facts: [{ quote_version_id: id(4), quote_id: id(5), opportunity_id: id(1), sent_at: timestamp(2), owner_id: id(2), quote_deleted: false, opportunity_deleted: false, opportunity_archived: false, version_status: "sent" }],
  assignment_evidence: [{ event_id: id(6), opportunity_id: id(1), occurred_at: timestamp(2), event_type: "assigned", payload_valid: true, assigned_to: id(2), status_id: null, status_terminal: false }],
  quote_source_evidence: [{ evidence_id: id(7), occurred_at: timestamp(3), kind: "quote_sent", quote_version_id: id(4), quote_id: id(5), opportunity_id: id(1), accepted_quote_version_id: null, payment_status: null, payload_valid: true }],
  owner_facts: [{ owner_id: id(2), profile_exists: true, is_active: true, roles: ["asesor"] }],
  task_occupancy: [{ id: id(8), created_at: timestamp(4), updated_at: timestamp(5), owner_id: id(2), lead_id: id(1), quote_id: null, description: "Complete first contact", due_at: timestamp(6), status: "pending", task_kind: "first_contact", idempotency_key: hash("a"), automation_origin_key: hash("a"), legacy_provenance: false }],
  automation_origins: [{ origin_key: hash("a"), task_kind: "first_contact", source_kind: "opportunity_assignment", operation: "generate", opportunity_id: id(1), quote_version_id: null, sent_event_id: null, anchor_at: timestamp(2), due_rule_version: "mx-calendar.v1", task_id: id(8), created_at: timestamp(4) }],
  automation_outcomes: [{ outcome_key: hash("b"), source_kind: "opportunity_assignment", source_id: id(1), source_key: hash("c"), source_order: 1, operation: "generate", origin_key: hash("a"), task_id: id(8), outcome: "applied", reason: null, created_at: timestamp(4) }],
  automation_tombstones: [{ tombstone_key: hash("d"), source_kind: "opportunity_unassigned", source_id: id(6), source_key: hash("e"), source_order: 2, origin_key: hash("f"), reason: "source_invalidated", created_at: timestamp(5) }],
})
const fixtureBoundary = (): HistoricalBoundaryResult => ({ ok: true,
  source_cutoffs: { opportunityAssignment: timestamp(30), quoteSent: timestamp(30) },
  snapshot_cutoffs: { opportunityRoots: [timestamp(1), id(1)], quoteVersionRoots: [timestamp(2), id(4)],
    assignmentEvidence: [timestamp(2), id(6)], quoteSourceEvidence: [timestamp(3), id(7)], taskOccupancy: [timestamp(4), id(8)],
    automationOrigins: [timestamp(4), hash("a")], automationOutcomes: [timestamp(4), hash("b")], automationTombstones: [timestamp(5), hash("d")] },
  opportunity_root_count: 1, quote_version_root_count: 1 })
const hasCode = (code: "MALFORMED_ROW" | "INCOMPLETE_JOIN") => (error: unknown) => error instanceof HistoricalRootReadFailure && error.code === code

test("0081 preserves the exact S5 boundary and adds the bounded S6 source join", () => {
  assert.deepEqual(contracts, [true, true, true, true, true])
  const sql = readFileSync(migration, "utf8")
  assert.match(sql, /task_automation_historical_hash\(jsonb\) returns text/i)
  assert.match(sql, /task_automation_historical_task_uuid\(text\) returns uuid/i)
  assert.match(sql, /read_task_automation_historical_boundaries\(p_expected_actor_id uuid\) returns jsonb/i)
  assert.match(sql, /read_task_automation_historical_sources\(p_expected_actor_id uuid,p_boundaries jsonb\) returns jsonb/i)
  assert.match(sql, /created_at\s*<\s*v_opportunity_cutoff/i)
  assert.match(sql, /sent_at is not null and [\w.]+sent_at\s*<\s*v_quote_cutoff/i)
  assert.match(sql, /opportunity_root_count[\s\S]*quote_version_root_count/i)
  assert.match(sql, /grant execute on function public\.read_task_automation_historical_boundaries\(uuid\) to authenticated/i)
  assert.match(sql, /grant execute on function public\.read_task_automation_historical_sources\(uuid,jsonb\) to authenticated/i)
  assert.match(sql, /revoke all on function public\.task_automation_historical_hash\(jsonb\) from public,anon,authenticated,service_role/i)
  assert.doesNotMatch(sql, /\b(?:insert into|update public\.|delete from|truncate table)\b/i)
})

test("source joins distinguish authoritative emptiness from missing, malformed, and out-of-root facts", () => {
  const boundary: HistoricalBoundaryResult = { ok: true, source_cutoffs: { opportunityAssignment: timestamp(30), quoteSent: timestamp(30) },
    snapshot_cutoffs: { opportunityRoots: null, quoteVersionRoots: null, assignmentEvidence: null, quoteSourceEvidence: null,
      taskOccupancy: null, automationOrigins: null, automationOutcomes: null, automationTombstones: null },
    opportunity_root_count: 0, quote_version_root_count: 0 }
  const empty: HistoricalSourceResult = { ok: true, opportunity_facts: [], quote_facts: [], assignment_evidence: [],
    quote_source_evidence: [], owner_facts: [], task_occupancy: [], automation_origins: [], automation_outcomes: [], automation_tombstones: [] }
  assert.deepEqual(decodeHistoricalSourceResult(empty, boundary), empty)
  assert.throws(() => decodeHistoricalSourceResult({ ...empty, owner_facts: undefined }, boundary),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "MALFORMED_ROW")
  assert.throws(() => decodeHistoricalSourceResult({ ...empty, extra: [] }, boundary),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "MALFORMED_ROW")
  const evidence = { event_id: id(1), opportunity_id: id(2), occurred_at: timestamp(1), event_type: "assigned",
    payload_valid: true, assigned_to: id(3), status_id: null, status_terminal: false }
  assert.throws(() => decodeHistoricalSourceResult({ ...empty, assignment_evidence: [evidence] }, boundary),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "MALFORMED_ROW")
  assert.throws(() => decodeHistoricalSourceResult({ ...empty, owner_facts: [{ owner_id: "bad", profile_exists: false, is_active: false, roles: [] }] }, boundary),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "MALFORMED_ROW")
  assert.deepEqual(decodeHistoricalSourceResult({ ok: false, error: { code: "QUERY_FAILED", message: "QUERY_FAILED" } }, boundary),
    { ok: false, error: { code: "QUERY_FAILED", message: "QUERY_FAILED" } })
})

test("source decoding rejects every malformed scalar field without invoking accessors or proxies", () => {
  const invalid = {
    opportunity_facts: { opportunity_id: "bad", created_at: "bad", assigned_to: false, deleted: "false", archived: 0, status_id: "bad", terminal: null },
    quote_facts: { quote_version_id: "bad", quote_id: "bad", opportunity_id: "bad", sent_at: "bad", owner_id: false, quote_deleted: 0, opportunity_deleted: "false", opportunity_archived: null, version_status: 1 },
    assignment_evidence: { event_id: "bad", opportunity_id: "bad", occurred_at: "bad", event_type: "other", payload_valid: 1, assigned_to: false, status_id: false, status_terminal: 0 },
    quote_source_evidence: { evidence_id: "bad", occurred_at: "bad", kind: "other", quote_version_id: false, quote_id: false, opportunity_id: "bad", accepted_quote_version_id: false, payment_status: false, payload_valid: 1 },
    owner_facts: { owner_id: "bad", profile_exists: 1, is_active: "true", roles: "asesor" },
    task_occupancy: { id: "bad", created_at: "bad", updated_at: "bad", owner_id: "bad", lead_id: false, quote_id: false, description: 1, due_at: "bad", status: 1, task_kind: "other", idempotency_key: "bad", automation_origin_key: false, legacy_provenance: 0 },
    automation_origins: { origin_key: "bad", task_kind: "other", source_kind: "other", operation: "other", opportunity_id: false, quote_version_id: false, sent_event_id: false, anchor_at: "bad", due_rule_version: 1, task_id: false, created_at: "bad" },
    automation_outcomes: { outcome_key: "bad", source_kind: "other", source_id: "bad", source_key: "bad", source_order: 1.5, operation: "other", origin_key: "bad", task_id: false, outcome: "other", reason: false, created_at: "bad" },
    automation_tombstones: { tombstone_key: "bad", source_kind: "other", source_id: "bad", source_key: "bad", source_order: -1, origin_key: "bad", reason: "other", created_at: "bad" },
  } as const
  for (const [collection, fields] of Object.entries(invalid)) {
    assert.deepEqual(Object.keys(fields).sort(), Object.keys(sourceFixture()[collection as keyof typeof invalid][0]).sort())
    for (const [field, value] of Object.entries(fields)) {
      const candidate = structuredClone(sourceFixture()) as unknown as Record<string, Record<string, unknown>[]>
      candidate[collection][0][field] = value
      assert.throws(() => decodeHistoricalSourceResult(candidate, fixtureBoundary()), hasCode("MALFORMED_ROW"), `${collection}.${field}`)
    }
  }
  let accessorRead = false
  const accessor = { ...sourceFixture().opportunity_facts[0] }
  Object.defineProperty(accessor, "opportunity_id", { enumerable: true, get() { accessorRead = true; throw new Error("unsafe accessor") } })
  assert.throws(() => decodeHistoricalSourceResult({ ...sourceFixture(), opportunity_facts: [accessor] }, fixtureBoundary()), hasCode("MALFORMED_ROW"))
  assert.equal(accessorRead, false)
  let proxyRead = false
  const proxy = new Proxy(sourceFixture(), { ownKeys() { proxyRead = true; throw new Error("unsafe proxy") } })
  assert.throws(() => decodeHistoricalSourceResult(proxy, fixtureBoundary()), hasCode("MALFORMED_ROW"))
  assert.equal(proxyRead, false)
})

test("source decoding closes root joins while retaining cross-scope ambiguity evidence", () => {
  const missingOwner = sourceFixture(); missingOwner.owner_facts = []
  assert.throws(() => decodeHistoricalSourceResult(missingOwner, fixtureBoundary()), hasCode("INCOMPLETE_JOIN"))
  for (const quoteVersionId of [null, id(99)]) {
    const candidate = sourceFixture(); candidate.quote_source_evidence[0] = { ...candidate.quote_source_evidence[0], quote_version_id: quoteVersionId } as never
    assert.throws(() => decodeHistoricalSourceResult(candidate, fixtureBoundary()), hasCode("MALFORMED_ROW"))
  }
  const broadPayment = sourceFixture(); broadPayment.quote_source_evidence = [{ evidence_id: id(9), occurred_at: timestamp(4), kind: "payment",
    quote_version_id: null, quote_id: null, opportunity_id: id(1), accepted_quote_version_id: null, payment_status: "verified", payload_valid: true }]
  assert.deepEqual(decodeHistoricalSourceResult(broadPayment, fixtureBoundary()), broadPayment)
  broadPayment.quote_source_evidence[0].accepted_quote_version_id = id(99)
  assert.deepEqual(decodeHistoricalSourceResult(broadPayment, fixtureBoundary()), broadPayment)
  broadPayment.quote_source_evidence[0].opportunity_id = id(98)
  assert.throws(() => decodeHistoricalSourceResult(broadPayment, fixtureBoundary()), hasCode("MALFORMED_ROW"))
  const crossScope = sourceFixture(); crossScope.quote_source_evidence[0].quote_id = id(98); crossScope.quote_source_evidence[0].opportunity_id = id(97)
  assert.deepEqual(decodeHistoricalSourceResult(crossScope, fixtureBoundary()), crossScope)
})

test("root keysets use strict 200-row pages, fixed boundaries, and one sentinel", async () => {
  const rows = Array.from({ length: 401 }, (_, index) => ({ cursor: [timestamp(Math.floor(index / 20)), id(index + 1)] as const }))
  const calls: unknown[] = []
  const result = await readHistoricalRootKeyset({
    family: "opportunityRoots", cutoff: timestamp(30), highWater: rows.at(-1)!.cursor, census: rows.length,
    readPage: async (request) => {
      calls.push(request)
      const start = request.after ? rows.findIndex((row) => row.cursor[1] === request.after![1]) + 1 : 0
      return rows.slice(start, start + request.limit)
    },
  })
  assert.equal(result.length, 401)
  assert.deepEqual(calls.map((value) => (value as { limit: number }).limit), [200, 200, 200, 1])
  assert.equal((calls[1] as { after: readonly string[] }).after[1], id(200))
  assert.equal((calls[3] as { after: readonly string[] }).after[1], id(401))
})

test("supporting joins use sorted 200-ID chunks, explicit emptiness, sentinels, and retry accounting", async () => {
  const ids = Array.from({ length: 401 }, (_, index) => id(401 - index)), calls: { ids: readonly string[]; limit: number }[] = []
  let attempts = 0
  const result = await readHistoricalJoinChunks({ ids, maxRows: 20_000, physicalAttempts: () => attempts,
    readChunk: async (request) => { calls.push(request); attempts += 2; return [] },
  })
  assert.deepEqual(calls.map((call) => call.ids.length), [200, 200, 1])
  assert.equal(calls[0].ids[0], id(1)); assert.deepEqual(result, { rows: [], logicalReads: 3, physicalAttempts: 6 })
  await assert.rejects(readHistoricalJoinChunks({ ids: [id(1)], maxRows: 1, readChunk: async () => null }),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "INCOMPLETE_JOIN")
  await assert.rejects(readHistoricalJoinChunks({ ids: [id(1)], maxRows: 1, readChunk: async () => [{}, {}] }),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "LIMIT_EXCEEDED")
  await assert.rejects(readHistoricalJoinChunks({ ids: [id(1), id(1)], maxRows: 1, readChunk: async () => [] }),
    (error) => error instanceof HistoricalRootReadFailure && error.code === "MALFORMED_ROW")
})

test("root keysets reject cutoff equality, census disagreement, and the 2,001st root without partial rows", async () => {
  const cutoff = timestamp(30), highWater = [timestamp(29), id(9999)] as const
  await assert.rejects(readHistoricalRootKeyset({ family: "quoteVersionRoots", cutoff, highWater, census: 1,
    readPage: async ({ limit }) => limit === 1 ? [] : [{ cursor: [cutoff, id(1)] as const }],
  }), (error) => error instanceof HistoricalRootReadFailure && error.code === "MALFORMED_ROW")
  await assert.rejects(readHistoricalRootKeyset({ family: "quoteVersionRoots", cutoff, highWater, census: 1,
    readPage: async () => [],
  }), (error) => error instanceof HistoricalRootReadFailure && error.code === "INCOMPLETE_JOIN")
  const roots = Array.from({ length: 2001 }, (_, index) => ({ cursor: [timestamp(Math.floor(index / 100)), id(index + 1)] as const }))
  await assert.rejects(readHistoricalRootKeyset({ family: "quoteVersionRoots", cutoff, highWater: roots.at(-1)!.cursor, census: 2000,
    readPage: async ({ after, limit }) => { const start = after ? roots.findIndex((row) => row.cursor[1] === after[1]) + 1 : 0; return roots.slice(start, start + limit) },
  }), (error) => error instanceof HistoricalRootReadFailure && error.code === "LIMIT_EXCEEDED")
})

const authDeps = (user: unknown, profile: unknown, roles: unknown): BootstrapAuthDeps => ({
  createAuthClient: async () => ({ phase: "auth" }),
  getUser: async () => ({ data: { user }, error: null }),
  readProfile: async () => ({ data: profile, error: null }),
  readRoles: async () => ({ data: roles, error: null }),
})

test("bootstrap auth distinguishes session, activity, role, and dependency failures", async () => {
  assert.deepEqual(await authorizeTaskAutomationHistoricalAdmin("CLIENT_UNAVAILABLE", authDeps(null, null, [])),
    { ok: false, error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } })
  assert.deepEqual(await authorizeTaskAutomationHistoricalAdmin("CLIENT_UNAVAILABLE", authDeps({ id: id(1) }, null, [])),
    { ok: false, error: { code: "AUTH_INACTIVE", message: "AUTH_INACTIVE" } })
  assert.deepEqual(await authorizeTaskAutomationHistoricalAdmin("CLIENT_UNAVAILABLE", authDeps({ id: id(1) }, { id: id(1), is_active: true }, [{ roles: { name: "asesor" } }])),
    { ok: false, error: { code: "AUTH_NOT_ADMIN", message: "AUTH_NOT_ADMIN" } })
  assert.deepEqual(await authorizeTaskAutomationHistoricalAdmin("CLIENT_UNAVAILABLE", authDeps({ id: id(1) }, { id: id(1), is_active: true }, [{ roles: { name: "admin" } }])),
    { ok: true, actorId: id(1), actorRole: "admin" })
  const dependency = await authorizeTaskAutomationHistoricalAdmin("PERSISTENCE_FAILURE", {
    ...authDeps({ id: id(1) }, { id: id(1), is_active: true }, []), readRoles: async () => { throw new Error("provider secret") },
  })
  assert.deepEqual(dependency, { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } })
  assert.doesNotMatch(JSON.stringify(dependency), /provider|secret/i)
})

test("preview source adapter authorizes before a separate client and wires both 0081 RPCs exactly", async () => {
  const calls: unknown[] = [], authClient = { phase: "auth" }, sourceClient = { phase: "source" }
  const result = await readTaskAutomationHistoricalPreviewSource({
    auth: { ...authDeps({ id: id(1) }, { id: id(1), is_active: true }, [{ roles: { name: "admin" } }]),
      createAuthClient: async () => { calls.push("auth-client"); return authClient } },
    createSourceClient: async () => { calls.push("source-client"); return sourceClient },
    invokeBoundary: async (client, args) => { calls.push([client, "boundary", args]); return { data: fixtureBoundary(), error: null } },
    invokeSource: async (client, args) => { calls.push([client, "source", args]); return { data: sourceFixture(), error: null } },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(calls, ["auth-client", "source-client", [sourceClient, "boundary", { p_expected_actor_id: id(1) }],
    [sourceClient, "source", { p_expected_actor_id: id(1), p_boundaries: fixtureBoundary() }]])

  let sourceConstructed = false
  const denied = await readTaskAutomationHistoricalPreviewSource({ auth: authDeps(null, null, []),
    createSourceClient: async () => { sourceConstructed = true; return sourceClient } })
  assert.deepEqual(denied, { ok: false, error: { code: "AUTH_REQUIRED", message: "AUTH_REQUIRED" } })
  assert.equal(sourceConstructed, false)
})

test("preview source adapter preserves domain codes and suppresses provider failures", async () => {
  const auth = authDeps({ id: id(1) }, { id: id(1), is_active: true }, [{ roles: { name: "admin" } }])
  const client = {}, boundary = fixtureBoundary()
  const mismatch = await readTaskAutomationHistoricalPreviewSource({ auth, createSourceClient: async () => client,
    invokeBoundary: async () => ({ data: { ok: false, error: { code: "AUTH_ACTOR_MISMATCH", message: "AUTH_ACTOR_MISMATCH" } }, error: null }) })
  assert.deepEqual(mismatch, { ok: false, error: { code: "AUTH_ACTOR_MISMATCH", message: "AUTH_ACTOR_MISMATCH" } })
  const failed = await readTaskAutomationHistoricalPreviewSource({ auth, createSourceClient: async () => client,
    invokeBoundary: async () => ({ data: boundary, error: null }),
    invokeSource: async () => ({ data: null, error: { message: "provider secret", details: "pii" } }) })
  assert.deepEqual(failed, { ok: false, error: { code: "QUERY_FAILED", message: "QUERY_FAILED" } })
  assert.doesNotMatch(JSON.stringify(failed), /provider|secret|pii/i)
  assert.throws(() => decodeHistoricalBoundaryResult({ ...boundary, extra: true }), hasCode("MALFORMED_ROW"))
})

const emptySource = (): HistoricalSourceSuccess => ({ ok: true, opportunity_facts: [], quote_facts: [], assignment_evidence: [],
  quote_source_evidence: [], owner_facts: [], task_occupancy: [], automation_origins: [], automation_outcomes: [], automation_tombstones: [] })
const emptyBoundary = (): Extract<HistoricalBoundaryResult, { ok: true }> => ({ ok: true,
  source_cutoffs: { opportunityAssignment: timestamp(30), quoteSent: timestamp(30) },
  snapshot_cutoffs: { opportunityRoots: null, quoteVersionRoots: null, assignmentEvidence: null, quoteSourceEvidence: null,
    taskOccupancy: null, automationOrigins: null, automationOutcomes: null, automationTombstones: null },
  opportunity_root_count: 0, quote_version_root_count: 0 })

test("historical preview converges on P2, classifies once, and returns the exact canonical envelope", async () => {
  let reads = 0, classifierCalls = 0, attempts = 0
  const boundary = emptyBoundary(), source = emptySource()
  const result = await readTaskAutomationHistoricalPreview({
    readSource: async () => { reads++; attempts += reads === 1 ? 3 : 1; return { ok: true, actorId: id(1), boundary, source } },
    physicalAttempts: () => attempts,
    classify: (input) => { classifierCalls++; return buildHistoricalTaskAutomationPlan(input) },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const snapshotHash = canonicalHash(["task-automation-historical-snapshot.v1", boundary.source_cutoffs, boundary.snapshot_cutoffs,
    [], [], [], [], [], [], [], [], []])
  assert.deepEqual(Object.keys(result).sort(), ["counts", "diagnostics", "ok", "plan", "planHash", "ruleVersion", "schema",
    "snapshotCutoffs", "snapshotHash", "sourceCutoffs", "totalCount"].sort())
  assert.equal(result.snapshotHash, snapshotHash)
  assert.equal(result.plan.snapshotHash, snapshotHash)
  assert.equal(result.planHash, canonicalHash(result.plan))
  assert.deepEqual(result.counts, [0, 0, 0, 0, 0, 0, 0, 0])
  assert.equal(result.totalCount, 0)
  assert.deepEqual(result.diagnostics, { passes: 2, logicalReads: 4, physicalAttempts: 4, opportunityRootCount: 0, quoteVersionRootCount: 0 })
  assert.equal(classifierCalls, 1)
})

test("historical preview uses only adjacent pairs and fails closed on exhaustion and stale boundaries", async () => {
  let p4 = 0, p4Classifications = 0
  const converged = await readTaskAutomationHistoricalPreview({ readSource: async () => {
    const source = sourceFixture(); source.owner_facts[0].roles = [["admin"], ["asesor"], ["manager"], ["manager"]][p4++]
    return { ok: true, actorId: id(1), boundary: fixtureBoundary() as never, source }
  }, classify: (input) => { p4Classifications++; return buildHistoricalTaskAutomationPlan(input) } })
  assert.equal(converged.ok, true)
  if (converged.ok) assert.deepEqual(converged.diagnostics, { passes: 4, logicalReads: 8, physicalAttempts: 8,
    opportunityRootCount: 1, quoteVersionRootCount: 1 })
  assert.equal(p4Classifications, 1)

  const roles = [["admin"], ["asesor"], ["manager"], ["admin", "manager"]]
  let index = 0, classifierCalls = 0
  const changing = await readTaskAutomationHistoricalPreview({
    readSource: async () => { const source = sourceFixture(); source.owner_facts[0].roles = roles[index++]; return { ok: true, actorId: id(1), boundary: fixtureBoundary() as never, source } },
    classify: (input) => { classifierCalls++; return buildHistoricalTaskAutomationPlan(input) },
  })
  assert.deepEqual(changing, { ok: false, error: { code: "SNAPSHOT_NOT_CONVERGED", message: "SNAPSHOT_NOT_CONVERGED" },
    diagnostics: { passes: 4, logicalReads: 8, physicalAttempts: 8, opportunityRootCount: 1, quoteVersionRootCount: 1 } })
  assert.equal(classifierCalls, 0)

  index = 0
  const stale = await readTaskAutomationHistoricalPreview({ readSource: async () => {
    const boundary = emptyBoundary(); if (index++) boundary.source_cutoffs.quoteSent = timestamp(29)
    return { ok: true, actorId: id(1), boundary, source: emptySource() }
  } })
  assert.deepEqual(stale, { ok: false, error: { code: "INCOMPLETE_JOIN", message: "INCOMPLETE_JOIN" },
    diagnostics: { passes: 2, logicalReads: 4, physicalAttempts: 4, opportunityRootCount: 0, quoteVersionRootCount: 0 } })
})

test("historical preview closes source, classifier, and malformed result failures without partial plan data", async () => {
  const failed = await readTaskAutomationHistoricalPreview({ readSource: async () => ({ ok: false,
    error: { code: "MALFORMED_ROW", message: "MALFORMED_ROW" } }) })
  assert.deepEqual(failed, { ok: false, error: { code: "MALFORMED_ROW", message: "MALFORMED_ROW" },
    diagnostics: { passes: 1, logicalReads: 2, physicalAttempts: 2, opportunityRootCount: 0, quoteVersionRootCount: 0 } })
  const unknown = await readTaskAutomationHistoricalPreview({ readSource: async () => ({ ok: false,
    error: { code: "PROVIDER_SECRET", message: "PROVIDER_SECRET" } }) as never })
  assert.equal(unknown.ok, false); if (!unknown.ok) assert.equal(unknown.error.code, "MALFORMED_ROW")
  let accessorRead = false
  const accessor = await readTaskAutomationHistoricalPreview({ readSource: async () => Object.defineProperty({}, "ok",
    { enumerable: true, get() { accessorRead = true; throw new Error("provider secret") } }) as never })
  assert.equal(accessor.ok, false); assert.equal(accessorRead, false)
  const malformed = await readTaskAutomationHistoricalPreview({ readSource: async () => ({ ok: true, actorId: id(1),
    boundary: emptyBoundary(), source: emptySource() }), classify: () => ({ plan: {}, planHash: hash("a") }) as never })
  assert.equal(malformed.ok, false); if (!malformed.ok) assert.equal(malformed.error.code, "CANONICALIZATION_FAILURE")
  const classified = await readTaskAutomationHistoricalPreview({ readSource: async () => ({ ok: true, actorId: id(1),
    boundary: emptyBoundary(), source: emptySource() }), classify: () => { throw new Error("provider pii") } })
  assert.equal(classified.ok, false); if (!classified.ok) {
    assert.equal(classified.error.code, "CLASSIFICATION_FAILED")
    assert.doesNotMatch(JSON.stringify(classified), /provider|pii/i)
  }
})

test("historical preview closes nested boundary accessors and proxies without executing them", async () => {
  const expected = { ok: false, error: { code: "CANONICALIZATION_FAILURE", message: "CANONICALIZATION_FAILURE" },
    diagnostics: { passes: 1, logicalReads: 2, physicalAttempts: 2, opportunityRootCount: 0, quoteVersionRootCount: 0 } }
  let accessorRead = false
  const accessorBoundary = emptyBoundary()
  Object.defineProperty(accessorBoundary.source_cutoffs, "quoteSent", { enumerable: true,
    get() { accessorRead = true; throw new Error("provider boundary secret") } })
  assert.deepEqual(await readTaskAutomationHistoricalPreview({ readSource: async () => ({
    ok: true, actorId: id(1), boundary: accessorBoundary, source: emptySource(),
  }) }), expected)
  assert.equal(accessorRead, false)

  let proxyRead = false
  const proxyBoundary = emptyBoundary()
  proxyBoundary.snapshot_cutoffs = new Proxy(proxyBoundary.snapshot_cutoffs, {
    ownKeys() { proxyRead = true; throw new Error("provider boundary secret") },
    getOwnPropertyDescriptor() { proxyRead = true; throw new Error("provider boundary secret") },
  })
  assert.deepEqual(await readTaskAutomationHistoricalPreview({ readSource: async () => ({
    ok: true, actorId: id(1), boundary: proxyBoundary, source: emptySource(),
  }) }), expected)
  assert.equal(proxyRead, false)
})

test("historical preview rejects self-hashed classifier rows outside the closed S1 contract", async () => {
  type MutablePlan = ReturnType<typeof buildHistoricalTaskAutomationPlan>["plan"]
  const cases: [string, (plan: MutablePlan) => void][] = [
    ["disposition", (plan) => { plan.rows[0].disposition = "other" as never }],
    ["reason matrix", (plan) => { plan.rows[0].reason = "SOURCE_INVALIDATED" }],
    ["field domain", (plan) => { plan.rows[0].rootId = "not-a-uuid" }],
    ["canonical order", (plan) => { plan.rows.reverse(); plan.rows.forEach((row, ordinal) => { row.ordinal = ordinal }) }],
    ["ordinal", (plan) => { plan.rows[0].ordinal = 1 }],
    ["counts", (plan) => {
      const source = plan.counts.findIndex((count) => count > 0), target = (source + 1) % plan.counts.length
      const counts = [...plan.counts] as number[]
      counts[source]--; counts[target]++
      plan.counts = counts as unknown as MutablePlan["counts"]
    }],
  ]
  const expected = { ok: false, error: { code: "CANONICALIZATION_FAILURE", message: "CANONICALIZATION_FAILURE" },
    diagnostics: { passes: 2, logicalReads: 4, physicalAttempts: 4, opportunityRootCount: 1, quoteVersionRootCount: 1 } }
  for (const [name, mutate] of cases) {
    const result = await readTaskAutomationHistoricalPreview({
      readSource: async () => ({ ok: true, actorId: id(1), boundary: fixtureBoundary() as never, source: sourceFixture() }),
      classify: (input) => {
        const classified = structuredClone(buildHistoricalTaskAutomationPlan(input))
        mutate(classified.plan)
        classified.planHash = canonicalHash(classified.plan)
        return classified
      },
    })
    assert.deepEqual(result, expected, name)
  }
})
