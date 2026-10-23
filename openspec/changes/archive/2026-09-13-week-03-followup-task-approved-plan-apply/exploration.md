# Exploration: Approved follow-up plan apply

Apply one immutable, Admin-approved historical follow-up plan as one transactional conversion to first-class `tasks`. The apply boundary must consume the approval ledger rather than rereading or recomputing the preview, create only its eligible projections, and fail closed when approval, live context, or current Task occupancy has changed.

## Current State

- The preview reader is Admin-gated, server-only, bounded, convergent, and read-only. Its canonical plan contains seven dispositions; only `eligible` rows become the 14-field `FutureFollowUpTask` projections.
- The approval adapter authenticates with `requireAdminRole(["admin"])` before client creation, reconstructs projections in canonical row order, and persists an immutable, replay-safe approval through `approve_follow_up_task_plan` (`0065`). The approval row has no source-event foreign key and therefore survives source purge.
- `tasks` exists from `0062`; `0064` adds immutable follow-up representation, global nullable `source_event_id` uniqueness, and representation validation. Existing `create_task` is for manual/ordinary tasks and cannot create the approved 14-field follow-up representation.
- Current Task RLS is read-only at the table boundary; existing writes are controlled by `SECURITY DEFINER` functions and authenticated execution grants. Existing ownership rules are Admin/all, owner/self, or Manager/non-Admin-owned active staff.
- Local migrations end at `0065`, but remote migration/schema state is explicitly unknown. Local proof uses the PostgreSQL helper and disposable shadow only; no remote migration or production readiness is established.

## Affected Areas

- `openspec/specs/follow-up-task-approval-ledger/spec.md` — normative approval identity, immutable projection, replay, and actor contract.
- `openspec/specs/follow-up-backfill-preview/spec.md` / `openspec/specs/follow-up-backfill-preview-reader/spec.md` — normative disposition, projection, occupancy, and snapshot semantics (the classifier path is read-only and must not be reused as an apply side effect).
- `openspec/specs/tasks-foundation/spec.md` and `openspec/specs/follow-up-task-representation/spec.md` — Task representation, source-purge survival, ownership, idempotency, and no-delete invariants.
- `db/migrations/0062_tasks_foundation.sql`, `0064_follow_up_task_representation.sql`, `0065_follow_up_task_approval_ledger.sql` — immutable historical schema, RLS/grants, representation triggers, and approval RPC that the two tentative additive migrations must follow. Historical `0061`–`0065` are immutable.
- `lib/admin/follow-up-task-approval.ts` — adapter/type boundary and exact projection shape; apply should accept a narrow request ID/result contract rather than trust client projections.
- `lib/admin/tasks.ts` — existing Task adapter conventions; generic `createTask` is not suitable for batch follow-up conversion because it omits representation fields and is not all-or-nothing.
- `tests/follow-up-task-approval-ledger-runtime.test.ts`, `tests/tasks-rls.test.ts`, and `tests/tasks-runtime.test.ts` — existing local PostgreSQL, security, and adapter evidence to extend narrowly for apply.
- `db/migrations/` — two tentative additive migrations must be allocated after `0065` only after read-only migration reconciliation: `0066` for receipt/security foundation and `0067` for apply RPC/atomic behavior. Unknown remote state remains a gate, not an assumption.

## Approaches

1. **Single transactional `SECURITY DEFINER` apply RPC with a durable receipt (recommended)** — accept only a validated request ID and expected actor; authenticate in the adapter before client creation, then let PostgreSQL lock the approval and a receipt key, revalidate the stored immutable approval and all eligible projections, verify live owner/lead facts and absence of conflicting Task occupancy, insert the exact projection set, and insert one receipt in the same transaction.
   - Pros: one atomic boundary; database-enforced representation and unique-source/idempotency constraints; easy rollback; concurrent calls converge; receipt survives source purge; no client-controlled projection drift; zero unrelated DML.
   - Cons: a larger SQL contract; requires explicit domain error precedence and careful validation of JSONB projection shape.
   - Effort: High.

2. **Server adapter reads approval and inserts Tasks through existing Task RPCs** — load the approval, loop over projections, and call `create_task` or a new per-row RPC.
   - Pros: more TypeScript-visible control and smaller individual SQL functions.
   - Cons: cannot guarantee all-or-nothing across calls; existing `create_task` cannot persist follow-up representation; partial failure and retry ambiguity are unavoidable without moving the transaction and receipt into PostgreSQL.
   - Effort: High, with unacceptable atomicity risk.

3. **Bulk client insert under a transaction-like application workflow** — use an elevated client to insert projections and write a receipt after the batch.
   - Pros: superficially simple and reuses generated table types.
   - Cons: no transaction spanning independent API calls; service-role/elevated writes weaken the established human/RLS boundary; source purge and concurrent apply races remain; not compatible with the local proof or zero-unrelated-DML requirement.
   - Effort: Medium, but not acceptable.

## Recommendation

Use approach 1 with two tentative additive migrations after read-only allocation reconciliation: `0066_follow_up_task_apply_receipt_foundation.sql` for the purge-surviving receipt, constraints, RLS, and security/grant foundation, followed by `0067_follow_up_task_apply_rpc.sql` for the transactional apply RPC and atomic behavior. Historical migrations `0061`–`0065` remain immutable. Add a server-only apply adapter and focused local proof.

The public adapter should receive `{requestId}` (and use `requireAdminRole(["admin"])` before `createClient`), pass only the authenticated actor ID and request ID to an RPC, and map only closed domain codes. The RPC should:

1. Validate authenticated role/profile/expected actor, request UUID, and approval lookup; lock by the same valid 16-hex advisory conversion used by `0065`, then lock the approval row and an apply-receipt key.
2. Treat the approval row as immutable truth. Revalidate its stored hashes, canonical plan/projection relationship, eligible count, and projection order/shape; never reread `lead_events` or reconstruct a new plan.
3. Revalidate every eligible owner as active and every lead as present, non-deleted, and still operational. Revalidate current Task occupancy by source UUID, owner/idempotency key, and owner/lead key. An exact pre-existing Task is not silently adopted on a first apply: absent receipt plus any occupancy is a stale/conflict outcome; only an exact existing receipt is a replay.
4. Insert exactly one follow-up Task per approved eligible projection, with explicit columns matching the approval projection and no generic automation or future-write path. Insert a purge-independent receipt containing approval/request identity, immutable plan/projection hashes, applied count, and a bounded canonical applied-task identity/result payload. Both Task inserts and receipt insert commit or roll back together.
5. On replay, lock and return the receipt only after exact request/approval identity and stored result equality checks. On stale plan, owner/lead change, occupancy conflict, malformed projection, or receipt mismatch, return a closed manual-review/conflict code and perform zero DML.

The receipt should be a separate append-only table with no foreign key to `lead_events`, and should avoid depending on mutable CRM context. Its RLS should expose SELECT only to Admin, while the apply RPC is `SECURITY DEFINER`, postgres-owned, empty-search-path, and executable only by `authenticated`; direct Task/receipt INSERT, UPDATE, and DELETE grants remain revoked. This preserves the existing human-authenticated boundary and makes the receipt available after source purge.

Local verification should extend the existing helper-based disposable database scenario across `0057` through every newly allocated migration, tentatively through `0067`: Admin success, exact Task count/projection equality, noneligible rows producing no Task, replay, concurrent identical calls, stale owner/lead, source/idempotency/owner-lead conflicts, rollback on any failed row, receipt/source-purge survival, RLS/grant inspection, and a final count proving no unrelated table DML. The receipt/security foundation and other independently bounded slices should remain within the normal review budget. The behavior-complete RPC/runtime slice is the maintainer-approved `size:exception`: it may exceed 400 changed lines while remaining within the session's 800-line review budget because its migration, adapter, tests, and runtime proof form one atomic transaction boundary. Do not run remote migration application or claim remote parity.

## Delivery and review boundary

- **Slice 1 — receipt/security foundation:** bounded schema, receipt immutability, purge independence, RLS/grants, and contract evidence in tentative `0066`; no Task conversion.
- **Slice 2 — apply RPC/atomic behavior:** tentative `0067`, adapter, focused tests, and PostgreSQL proof as one behavior-complete unit. The maintainer-approved `size:exception` applies only to this slice when authored additions plus deletions exceed 400 lines but remain at or below the 800-line session review budget. The exception is intentional: splitting the RPC, its transaction proof, and its runtime tests would hide the atomic rollback/concurrency contract behind independently incomplete units.
- **All other slices:** remain bounded to the normal review threshold and retain tests/docs with their behavior unit; no chained delivery is required for them solely because this exception exists.
- **Dependency:** `0065` immutable approval ledger → `0066` receipt/security foundation → `0067` apply RPC/runtime slice → later parity/future-write/read cutover (excluded here).

## Risks

- **Approval/Task drift:** trusting client projections or rereading sources could apply a different plan. The RPC must use the stored approval and verify canonical hashes before mutation.
- **Partial conversion:** per-row adapter calls or post-insert receipts would violate all-or-nothing semantics. Task inserts and receipt must share one database transaction.
- **Concurrent future or repeated apply:** advisory locking plus a unique receipt key and existing Task uniqueness must distinguish exact replay from stale/conflict; never silently collapse a noneligible/manual-review disposition.
- **Live-context changes:** owner deactivation, lead deletion/archive, or reassignment after approval can make a plan stale. Revalidate inside the transaction immediately before inserts.
- **Purge coupling:** receipt and Task provenance must not require `lead_events` retention or foreign keys; source UUIDs and bounded immutable provenance must remain in Tasks/receipt.
- **Remote uncertainty:** allocating or applying tentative `0066`/`0067` before Gate 0 could collide with unknown state. Read-only migration allocation reconciliation must precede both; the change must include local-only migration/proof boundaries and explicitly stop before remote operations.
- **Scope creep:** dashboard/read cutover, future writes, disposition UI, automation, SLA, notifications, and Mi día are downstream changes and must remain excluded.

## Ready for Proposal

Yes. The proposal should define the exact tentative `0066` receipt/security schema, tentative `0067` RPC signature, closed error precedence, revalidation predicates, replay identity, receipt payload bounds, adapter result types, size-exception review boundary, and focused local proof through tentative `0067`. It should preserve the explicit noneligible dispositions and make the first apply path independent from future-write and dashboard work.
