# Tasks: Week 02 Tasks Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650–780 |
| Dominant risk | Security-sensitive SQL/RLS/RPC parity and exact replay semantics |
| Above 400 lines | Yes |
| Above 800 lines | No (forecast) |
| Chained PRs recommended | Yes — two focused autonomous slices |
| Delivery strategy | auto-forecast |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Ledger schema, helper, RPC grants/RLS, generated types | PR 1 | `node --import tsx --test tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts` | Disposable local shadow: Gate 0, apply `0061` once, apply candidate, inspect catalog, teardown | Revert migration, generated Tasks block, and contract/RLS tests only |
| 2 | Typed adapters and replay/lifecycle/authorization behavior | PR 2 | `node --import tsx --test tests/tasks-runtime.test.ts` | Local shadow RPC runtime with isolated fixtures, concurrent replay, context deletion, teardown | Revert `lib/admin/tasks.ts` and runtime tests; retain PR 1 |

## Phase 1: Gate and Foundation (PR 1)

- [x] 1.1 RED: add `tests/tasks-foundation-contract.test.ts` for Gate 0 fail-closed/no-allocation, exact table columns/checks/FKs/index, no title/DELETE, UTC `due_at`, RPC signatures, stable PT001–PT006 SQLSTATEs, `postgres` ownership, fixed `search_path`, exact grants, and service-role/anon denial.
- [x] 1.2 RED: add `tests/tasks-rls.test.ts` covering the complete owner/Admin/Manager/Admin-owned/unknown/inactive matrix and read-only authenticated RLS, with Manager/CRM/quotes/audit/preservation assertions; explicitly exclude `staff_notifications`.
- [x] 1.3 GREEN: after Gate 0 allocates `<next>`, create `db/migrations/<next>_tasks_foundation.sql` with the exact Tasks ledger, nonrecursive `task_actor_can_manage(uuid)`, authenticated-human-only `create_task(...)`/`task_transition(...)`, exact grants/RLS, no DELETE, and `ON DELETE SET NULL` context FKs.
- [x] 1.4 GREEN: regenerate `lib/supabase/database.types.ts` from the local shadow and retain only additive exact Tasks table/function definitions; prove all pre-existing and unrelated bytes are unchanged.

## Phase 2: Behavior and Boundary (PR 2)

- [x] 2.1 RED: add `tests/tasks-runtime.test.ts` for canonicalization, live-context validation, pending creation, deterministic bounded SHA-256 key, exact atomic `INSERT ... ON CONFLICT DO NOTHING RETURNING` then locked-winner comparison, exact replay, conflict/stale replay, and no mutation on errors.
- [x] 2.2 RED: extend runtime coverage for every authorization cell, service-role creation denial, allowed transitions, terminal immutability, DELETE denial, and historical reads after lead/quote deletion or deactivation.
- [x] 2.3 GREEN: create `lib/admin/tasks.ts` with matching normalization and typed RPC adapters; map SQLSTATEs (never messages) to stable boundary errors and preserve UTC formatting.

## Phase 3: Verification and Release Gates

- [ ] 3.1 Run local lint/type/build plus all three Tasks tests; verify generated types compile and no production fallback or remote mutation occurred.
- [ ] 3.2 Run independent SDD verification against fresh evidence: exact-once shadow application/teardown, schema/catalog/RLS/grants, preservation/no-remote checks, and Week 03 readiness separate from production readiness.
- [ ] 3.3 Obtain bounded external review and post-apply approval independently; archive the complete evidence packet before marking this change ready for Notifications/Week 03.
