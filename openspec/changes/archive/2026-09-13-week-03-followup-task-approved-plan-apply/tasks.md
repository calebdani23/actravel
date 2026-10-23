# Tasks: Apply Approved Follow-up Plans to Tasks

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,500 authored; correction ~40–90 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → corrective PR 5 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Slice 2: approved `size:exception`, cap 800. PR 5: ≤400. Local/disposable only; no remotes; 0061–0065 immutable.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback |
|---|---|---|---|---|---|
| 1 | Receipt | 1 | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approved-plan-apply-receipt.test.ts` | Same; disposable DB | 0066/test |
| 2 | Apply | 2, exception ≤800 | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approved-plan-apply-runtime.test.ts` | Same; disposable DB | 0067/test |
| 3 | Manual types | 3 | `node --import tsx --test tests/follow-up-task-approved-plan-apply-types.test.ts` | N/A: compile contract | types/test |
| 4 | Adapter | 4 | `node --conditions react-server --import tsx --test tests/follow-up-task-approved-plan-apply-adapter.test.ts` | N/A: injected RPC | adapter/docs/test |
| 5 | Compatibility | 5 | `node --conditions react-server --import tsx --test tests/follow-up-task-approval.test.ts` | approval DB through 0067 | approval files |

## Phase 1: Receipt

- [x] 1.1 RED `tests/follow-up-task-approved-plan-apply-receipt.test.ts`: malformed identities/results, ID order/distinctness/counts, zero, RLS/immutability, purge.
- [x] 1.2 Implement `db/migrations/0066_follow_up_task_apply_receipt_foundation.sql`: no-FK receipt, validator/trigger, RLS/grants, rollback.
- [x] 1.3 Verify disposable receipt, allocation, security, and rollback in `tests/follow-up-task-approved-plan-apply-receipt.test.ts`.

## Phase 2: Apply

- [x] 2.1 RED `tests/follow-up-task-approved-plan-apply-runtime.test.ts`: auth/invalid, absent/tamper, zero/mixed/14 fields, replay/concurrency/mismatch, lock order, stale before three occupancies, second-insert rollback, limits, purge, no unrelated DML.
- [x] 2.2 Implement `db/migrations/0067_follow_up_task_apply_rpc.sql`: fingerprints, ordered locks/inserts, live checks, atomic receipt, closed errors, rollback.
- [x] 2.3 Verify 10/10 runtime, 4/4 receipt, fingerprint replay, isolated occupancy, concurrency, and rollback in `tests/follow-up-task-approved-plan-apply-runtime.test.ts`.

## Phase 3: Types

- [x] 3.1 RED exact receipt/RPC contracts in `tests/follow-up-task-approved-plan-apply-types.test.ts`.
- [x] 3.2 Add manual receipt/apply `Json` boundaries in `lib/supabase/database.types.ts`; no generated/downstream reads.
- [x] 3.3 Verify compile contracts in `tests/follow-up-task-approved-plan-apply-types.test.ts`.

## Phase 4: Adapter

- [x] 4.1 RED auth/provider, exact-key/UUID/identity, ordered/duplicate-ID, count/cardinality cases in `tests/follow-up-task-approved-plan-apply-adapter.test.ts`.
- [x] 4.2 Implement `{requestId}` and strict decoders in `lib/admin/follow-up-task-approved-plan-apply.ts`, preserving closed unions.
- [x] 4.3 Record local proof/rollback in `docs/DECISIONS.md` and `docs/PROGRESS.md`; verify lint, types, build, diff.

## Phase 5: Corrective Compatibility Work Unit

- [x] 5.1 RED `tests/follow-up-task-approval.test.ts` and `tests/follow-up-task-approval-ledger-runtime.test.ts`: 0067 fresh/replay rows include `approval_fingerprint`, decode, preserve public shape.
- [x] 5.2 Validate private `approval_fingerprint` in `lib/admin/follow-up-task-approval.ts`; add approval Row/Insert/Update fields in `lib/supabase/database.types.ts`; keep public `ApprovalSuccess` unchanged and `db/migrations/0065_follow_up_task_approval_ledger.sql` (read-only) byte-identical.
- [x] 5.3 Document compatibility/rollback in `docs/DECISIONS.md` and `docs/PROGRESS.md` without rewriting archived ledger semantics.

## Phase 6: Fresh Pre-Archive Verification

- [x] 6.1 Run approval unit/runtime, DB-enabled four-file suite, lint, TypeScript, safe build, rollback, and `git diff --check`; require zero DB skips.
- [x] 6.2 Read back candidate/evidence: confirm 0061–0065 unchanged, local-only scope, budgets, docs, and unrelated files; do not create or fabricate verify-report.md.

## Phase 7: Integrity and UTF-8 Remediation

- [x] 7.1 RED-first extend disposable apply proof for self-consistent canonical approval tampering, every disposition/count equation, complete plan shape, and all canonical UTF-8 boundaries with exact failure precedence and zero DML.
- [x] 7.2 Correct only `0067_follow_up_task_apply_rpc.sql` so complete immutable approval validation precedes mutation and the 512-byte row, 2048-byte projection-item, 4096-byte static-header, and aggregate UTF-8 bounds are enforced without changing retained behavior.
- [x] 7.3 Run the required focused/full verification with zero database skips, preserve protected paths/index/failed evidence, and merge cumulative remediation evidence into living docs and both apply-progress stores.

## Phase 8: Required Canonical Row JSON-Null Remediation

- [x] 8.1 RED-first add eligible and retained-noneligible regression cases for JSON null in every required canonical row field, requiring `APPROVAL_INTEGRITY_FAILURE` and unchanged Task, receipt, and unrelated-DML counts.
- [x] 8.2 Correct only `0067_follow_up_task_apply_rpc.sql` with explicit required-field null rejection before regex, disposition/reason, count, bounds, or write decisions while preserving all prior contracts.
- [x] 8.3 Run every required focused/full/static/build check with zero database skips, preserve protected paths/index/failed evidence, and merge cumulative evidence into living docs and both apply-progress stores.
