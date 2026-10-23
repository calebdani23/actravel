# Proposal: Apply Approved Follow-up Plans to Tasks

## Intent

Consume one immutable Admin approval row, atomically create its eligible Tasks, and leave a purge-surviving receipt from stored projections.

## Scope

### In Scope
- Transactional `SECURITY DEFINER` PostgreSQL RPC accepting request identity and expected actor.
- Owner/lead and occupancy revalidation, replay/concurrency, stale/conflict outcomes, zero unrelated DML.
- Receipt, adapter, manual types, migration, RLS/grants, tests.

### Out of Scope
- Dashboard/Contact 360 cutover, future writes, parity read switch, automation, SLA, notifications, Mi día, UI, remote migration, rollout, and Week 1.
- Existing Tasks are not adopted; exact receipts replay.

## Capabilities

### New Capabilities
- `follow-up-task-approved-plan-apply`: conversion of one immutable approved plan plus purge-independent receipt.

### Modified Capabilities
- None. Migrations `0061`–`0065` remain immutable.

## Approach

Lock request/receipt and approval, validate hashes/order/shape, revalidate owners, leads, and occupancy, then insert eligible 14-field projections plus a receipt atomically. Advisory locks use one fixed total namespace order: receipt request, source event, owner/idempotency, then owner/lead, with preimages ordered bytewise under `C` collation inside each namespace. Receipt identity/result replays only after canonical UUID, exact ordered Task-ID equality, distinctness, and count/cardinality integrity pass; stale context, occupancy, malformed approval, malformed success data, or conflict closes without partial DML. Direct writes remain revoked; receipt SELECT is Admin-only and RPC execution authenticated.

Dependencies: `tasks-foundation`, `follow-up-task-representation`, `follow-up-backfill-preview`, `follow-up-backfill-preview-reader`, `postgres-integration-harness`, `follow-up-task-approval-ledger`. Tentative `0066` is receipt/security and `0067` apply RPC, pending read-only allocation reconciliation. Remote state is unknown and fail-closed. Authenticate first; accept `{requestId}` only; use manual types.

## Affected Areas

- `db/migrations/00xx*.sql`: receipt/RPC/RLS; `lib/admin/*approved-plan-apply.ts`: adapter; `lib/supabase/database.types.ts`: manual boundary; tests.

## Risks

- Drift/partial conversion: hash-validated transaction. Remote uncertainty: read-only reconciliation. Live changes: locked revalidation.

## Rollback Plan

Revert each slice's files and proof only. No remote rollback or Task DML. Proof spans `0057` through `0066`–`0067`; `0061`–`0065` remain immutable and remote parity is unverified.

## Delivery Strategy

Use serial stacked-to-main slices; each slice starts from refreshed `main` after its prerequisite merges, targets `main`, remains independently buildable/testable, and ships proof with behavior. There is no test-later or decoder-later split. The automatic forecast is four PRs and exactly 1,500 estimated additions+deletions.

| Slice | Behavior and proof | Estimate (add+del) | Rollback boundary |
|---|---|---:|---|
| 1. Receipt/security foundation | Tentative `0066`; receipt schema, complete result-integrity helper/trigger, RLS/grants, focused/static/disposable proof. | 250 (≤400) | `0066` and its proof. |
| 2. Apply RPC/atomic behavior | Tentative `0067`; full RPC/transaction, exact projections, the fixed total advisory-lock order, replay/concurrency, stale/conflict, purge, and co-located focused/static/runtime proof. Maintainer-approved `size:exception`: 650 estimated, hard cap 800. | 650 (≤800) | `0067` and its proof. |
| 3. Manual database type boundary | Exact receipt Row/Insert/Update/Relationships and RPC Args/Returns plus compile-time contract proof. | 220 (≤400) | Manual database types and type-contract proof. |
| 4. Adapter/strict decoding | Authenticated `{requestId}` adapter and every strict RPC/nested-result decoder it needs, auth-before-client, malformed-success cases, final focused/static/runtime verification, and durable docs. | 380 (≤400) | Adapter, all of its decoders, verification, and docs. |

Dependency: `main` → 1 📍 → refreshed `main` → 2 → refreshed `main` → 3 → refreshed `main` → 4. Parity/read cutover remains outside.

## Success Criteria

- [ ] An approved row creates eligible Tasks and an immutable purge-surviving receipt atomically.
- [ ] Replay/concurrency, canonical UUID and exact ordered Task-ID/count integrity, stale/conflict/manual-review, RLS/grants, rollback, and zero-unrelated-DML are proven.
- [ ] Slices 1, 3, and 4 are ≤400 additions+deletions; Slice 2 has the approved exception and hard 800 cap.
