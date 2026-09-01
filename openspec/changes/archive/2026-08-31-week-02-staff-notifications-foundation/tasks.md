# Tasks: Week 02 Staff Notifications Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 850–1,050 overall (SQL, types, tests) |
| 400-line budget risk | High; overall exceeds 800 |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 schema/contracts; PR 2 adapter/runtime; PR 3 final implementation/regression/cleanup evidence |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Overall forecast exceeds 800 lines, but every autonomous staged review slice must remain within the cached 800-line review budget. For this retry, the implementation-only PR 1 boundary is capped at 400 changed lines; planning/progress artifacts are a separate documentation/evidence boundary.

### Suggested Work Units

| Unit | Goal (exact start → finish) | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Start at 0062; finish schema, ledger, security, RPC contract, and generated types | PR 1 (371-line implementation-only boundary) | `node --import tsx --test tests/staff-notifications-contract.test.ts tests/staff-notifications-types.test.ts` | Disposable PostgreSQL through 0062 + candidate; no remote mutation | Remove 0063, additive generated types, and focused contract/type tests |
| 2 | Start with PR 1; finish typed adapter and behavior proof | PR 2 | `node --import tsx --test tests/staff-notifications-runtime.test.ts tests/staff-notifications-types.test.ts` | Shadow roles: replay/read/mark/history | Revert adapter, types, and tests |
| 3 | Start with PR 2; finish implementation regressions, disposable apply, cleanup, and evidence | PR 3 | `npm run lint && npm run build && npm run test:quote-notifications` | Disposable shadow 0062→candidate; capture receipts, no remote mutation | Delete notification-owned disposable evidence and cleanup changes |

## Phase 1: Fresh Gate 0 and Foundation

- [x] 1.1 Capture read-only HEAD, inventory/checksums, remote history/schema identity, archived Harness/Tasks evidence, and dependency reconciliation; stop on ambiguity.
- [x] 1.2 RED: add `tests/staff-notifications-contract.test.ts` asserting `id, recipient_id, kind, title, body, quote_id, task_id, read_at, idempotency_key, created_at`, checks, immutable fields, FKs, indexes, unique recipient/key.
- [x] 1.3 GREEN: create `db/migrations/0063_staff_notifications_foundation.sql` with UUID/`now()` defaults, kinds `task|quote|system`, bounded trimmed title/body, SHA-key regex, exact FKs/on-delete/indexes, and atomic replay comparison.

## Phase 2: Security Seams and Types

- [x] 2.1 RED: extend contract tests for revoke/grants, recipient SELECT RLS, `postgres`-owned `SECURITY DEFINER`/`search_path=public`, and exact EXECUTE grants.
- [x] 2.2 GREEN: implement RPCs `create_staff_notification` (service-role, live predicates, SN001–SN005) and `mark_staff_notification_read` (authenticated recipient, idempotent `coalesce`), preserving history and denying direct DML.
- [x] 2.3 RED/GREEN: add exact table and `Functions` signatures/returns to `lib/supabase/database.types.ts`; change Supabase factory generics only if required, preserving session behavior.

## Phase 3: Adapter and Runtime Verification

- [x] 3.1 RED/GREEN: add runtime boundary tests for canonical keying, invalid input, and SQLSTATE-only error behavior.
- [x] 3.2 GREEN: create `lib/admin/staff-notifications.ts` with bounded normalization, lowercase UUIDs, exact SHA-256 UTF-8 key, typed RPC adapters, and SQLSTATE-only `STAFF_NOTIFICATION_*` mapping.
- [x] 3.3 Add compile assertions in `tests/staff-notifications-types.test.ts`; run focused tests plus existing Tasks, auth/CRM/quote regressions without external traffic.

## Phase 4: Disposable Apply, Cleanup, and Closure

- [x] 4.1 Apply the exact candidate once to a disposable shadow through `0062`; capture schema/RLS/grants/type/runtime receipts and verify no remote Supabase mutation.
- [x] 4.2 Remove only disposable artifacts/evidence; verify auth/CRM/quotes/audit files, types, inventory, and unrelated tests are preserved.

Post-Task Gates (not checklist items):
- Gate: independent verifier confirms exact candidate, receipts, preservation, and no-remote claim.
- Gate: native review and post-apply approval pass; then archive this change and update lifecycle documents only through the owning workflow.
