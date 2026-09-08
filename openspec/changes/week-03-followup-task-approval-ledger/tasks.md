# Tasks: Week 03 Follow-up Task Approval Ledger

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 880–1,290 total; each unit <800 |
| 400-line risk | High |
| 800-line budget risk | Low per unit; high if units are combined |
| Chained PRs recommended | Yes |
| Split | PR 1 migration → PR 2 runtime → PR 3 adapter → PR 4 types/docs |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | 0065 schema/security/canonical contract | PR 1 | `node --import tsx --test tests/follow-up-task-approval.test.ts` | SQL text/AST only; no remote DB | Revert migration and static tests |
| 2 | PostgreSQL proof | PR 2 | `node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` | Existing helper; guarded Docker, cleanup/absence | Delete runtime test |
| 3 | Auth-first adapter | PR 3 | `node --import tsx --test tests/follow-up-task-approval.test.ts` | Injected `ApprovalDeps`; no network | Revert adapter/tests |
| 4 | Types and evidence | PR 4 | `npx tsc --noEmit --incremental false` | N/A: type/doc only | Revert types/docs |

## Phase 1: Migration and Static Contracts (PR 1)

- [x] RED 1.1 Add static tests in `tests/follow-up-task-approval.test.ts` for 0065’s exact DDL/checks, canonical SQL/hash/UTF-8 equations, seven counts/scenarios, predicate order, grants/RLS/trigger, advisory lock, and no Task DML/remote markers.
- [x] GREEN 1.2 Create/correct `db/migrations/0065_follow_up_task_approval_ledger.sql` with one-row DDL, immutable UPDATE/DELETE triggers, forced RLS/Admin SELECT, revoked writes, helper, and exact RPC auth/validation/lock/replay/conflict/insert contracts; static command passes. Corrective PR1 SQL precedence, nested-header, limit-category, count-exception, and replay-field contracts are covered.
- [x] STOP 1.3 Parent reviews/commits PR 1; rollback removes migration/tests.

## Phase 2: Local PostgreSQL Runtime Proof (PR 2)

- [x] RED 2.1 Add scenarios to `tests/follow-up-task-approval-ledger-runtime.test.ts` using shared helper symbols for lexical 0057–0065, auth/RLS, replay, conflict/concurrency, append-only, purge survival, and zero Task DML.
- [x] GREEN 2.2 Implement guarded Docker lifecycle with skip-before-Docker, `try/finally` cleanup, post-absence assertion, exact JSON failures, and one-row convergence; no linked/remote access or migration application. Applying 0057–0065 inside the disposable local database is required.
- [x] STOP 2.3 Parent reviews/commits PR 2; rollback deletes test; container absent.

## Phase 3: Server Adapter and Injected Unit Contracts (PR 3)

- [x] RED 3.1 Add injected tests for `approveFollowUpTask`, `ApprovalDeps`, `ApproveRpcArgs`, projection/hash/request construction, auth-before-client, exact 7/7 contracts, strict decoding, malformed/provider errors, replay, and precedence.
- [x] GREEN 3.2 Create `lib/admin/follow-up-task-approval.ts` with exact unions, 14-field projection, UTF-8 SHA-256 values, auth before client, RPC mapping, and closed response/error contracts; run the focused command.
- [x] STOP 3.3 Parent reviews/commits PR 3; rollback removes adapter/tests.

## Phase 4: Types, Documentation, and Final Verification (PR 4)

- [x] RED 4.1 Add type-contract assertions for exact table Row/Insert/Update/Relationships and RPC Args/Returns `Json` in `tests/follow-up-task-approval.test.ts`; reject key, optionality, nullability, and extra-field drift.
- [x] GREEN 4.2 Manually update `lib/supabase/database.types.ts`; do not run linked generation. Record evidence and unchanged remote/Task-DML boundary in `docs/DECISIONS.md` and `docs/PROGRESS.md`; run tests, lint, and `npx tsc --noEmit --incremental false`.
- [ ] STOP 4.3 Parent reviews/commits PR 4; rollback is the type/docs diff. Evidence confirms no protected/unrelated changes or remote work.
