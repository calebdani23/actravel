# Tasks: Admin Follow-up Tasks Preview Reader

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,100–1,500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 classifier contract; PR 2 reader/data source; PR 3 contracts, verification, evidence/docs |
| Delivery strategy | auto-chain (forecast threshold 800) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Add `TaskOccupancyFact` and preserve pure classifier output (<800 lines) | PR 1 | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` | N/A: pure, zero remote activity | Revert classifier and its tests; stop for parent review/commit |
| 2 | Add Admin-first bounded reader and injected source (<800 lines) | PR 2 | `node --import tsx --test tests/follow-up-backfill-preview-reader.test.ts` | Injected local transport; no remote access | Revert new reader only; stop for parent review/commit |
| 3 | Complete contracts, verification, evidence, and docs (<800 lines) | PR 3 | Focused tests, `npx tsc --noEmit`, `npm run lint`, `git diff --check` | N/A: no UI/schema/DML/remote harness | Revert test/docs changes; stop for parent review/commit |

## Phase 1: Classifier RED

- [x] 1.1 In `tests/follow-up-backfill-preview.test.ts`, add failing vectors for `TaskOccupancyFact` on every Task kind/source, exact existing-task matching, `InvariantViolation`, duplicate IDs, both collision branches, seven-count order, and unchanged canonical plans.
- [x] 1.2 Add failing assertions for occupancy IDs/owner/lead/idempotency validation, 2,000-row/byte bounds, and exclusion of Task `created_at` from equality while retaining it in digest input.

## Phase 2: Classifier GREEN

- [x] 2.1 In `lib/admin/follow-up-backfill-preview.ts`, add the closed occupancy type/input, validate/account every Task, require one occupancy per existing fact, and keep existing facts limited to exact complete follow-up representations.
- [x] 2.2 Update pure maps, canonicalization, collision precedence, and digest inputs without changing dispositions; run the focused classifier test command.

## Phase 3: Reader RED

- [x] 3.1 Create `tests/follow-up-backfill-preview-reader.test.ts` with Admin-before-client/read, envelope/privacy, factory/provider/cutoff error, exact projection/filter/order/raw-`.or` contract, dual cutoff, bounded paging, cursor, real four-attempt retry, and empty/partial-page cases.
- [x] 3.2 Add join/decoder vectors for malformed/extra rows, incomplete joins, owner precedence/dedup/unsupported roles, all-Task occupancy, exact existing facts, digest/classifier failure, convergence, zero-after-failure reads, and zero writes.

## Phase 4: Reader GREEN

- [x] 4.1 Create server-only `lib/admin/follow-up-backfill-preview-reader.ts`: authorize `requireAdminRole(["admin"])`, then construct the injected read source; implement explicit DTOs, dual immutable cutoffs, keyset pages/sentinels, canonical raw predicates, and physical/logical diagnostics.
- [x] 4.2 Implement deterministic bounded joins/closed decoders, owner facts, occupancy/existing mapping, SHA-256 snapshot digest, paired convergence, exactly-once classifier invocation, and code-only stable errors; run reader tests.

## Phase 5: Verification / Evidence / Docs

- [ ] 5.1 Per slice, run its focused command and stop for parent review/commit; after PR 3, run both test files, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`; confirm no UI/schema/DML/remote access.
- [ ] 5.2 Record verified results and rollback boundary in `docs/DECISIONS.md` and `docs/PROGRESS.md`; preserve the injected-only evidence, exact retry counts, and deferred operational scope.
