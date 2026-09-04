# Tasks: Follow-up-to-Task Classifier and Canonical Plan

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 800–1,050 total; each slice 350–650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Slice 1: facts/parser/selection; Slice 2: Task/canonicalization/regressions |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
Size exception: No; decision resolved

### Suggested Work Units

| Unit | Start → finish | Test | Runtime harness | Rollback / commit boundary |
|---|---|---|---|---|
| 1 | Empty implementation → typed facts, rows, parser, selection, dispositions | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` | N/A: pure immutable function | Revert foundation files after parent confirms bounded review and work-unit commit |
| 2 | Parent-confirmed Slice 1 commit → Task mapping, collisions, canonical plan, evidence | focused test + `npx tsc --noEmit` | N/A: no I/O/DB seam | Revert Slice 2 files after parent confirms bounded review and work-unit commit |

## Phase 1: Slice 1 — RED → GREEN Foundation

- [x] 1.1 RED: add legal/invalid builders and typed error-precedence tests in `tests/follow-up-backfill-preview.test.ts`; GREEN: define fact/result/row/error types in `lib/admin/follow-up-backfill-preview.ts`.
- [x] 1.2 RED: test date-only, fractions, years, offsets, leap seconds, whitespace, `24:00`, and canonical-boundary rejection; GREEN: implement strict UTC parser in `lib/admin/follow-up-backfill-preview.ts`.
- [x] 1.3 RED: test missing/malformed facts, duplicate IDs, cutoff ties, lowercase ordering, and latest-valid fallback; GREEN: implement validation and selection.
- [x] 1.4 RED: test lead lifecycle, all seven dispositions, closed reasons, owner tags, and invalid-raw nullability; GREEN: implement precedence and classification.
- [x] 1.5 RED: test non-selected all-null fields, ascending rows, exact counts, and total accounting; GREEN: implement row emission, sorting, and counts.
- [x] 1.6 Verify Slice 1 focused tests, typecheck, lint, clean diff, and evidence; stop after verification/evidence. Agents never stage, commit, or review; parent performs bounded review and the work-unit commit.

## Phase 2: Slice 2 — RED → GREEN Task and Canonical Plan

- [ ] 2.1 Start only after parent confirms the Slice 1 work-unit commit. RED: test exact future Task fields, source-namespaced idempotency, equality, duplicate IDs, source mismatch, and collision precedence/mutual exclusion; GREEN: implement mapping/collisions.
- [ ] 2.2 RED: test recursive canonical equality and repeatability; GREEN: implement canonical JSON tuple, UTF-8 serialization, and SHA-256.
- [ ] 2.3 RED: assert the sole 362-byte golden hash and complete 70-byte idempotency vector; GREEN: enforce exact vectors without extra fixtures.
- [ ] 2.4 RED: test 2,000/2,001 rows, enumerate/property-assert that every legal row variant is ≤512 bytes (no exact 512-byte fixture), 4,096-byte header, and 1MiB defense; GREEN: enforce static and defensive plan bounds.
- [ ] 2.5 RED: add exhaustive regressions for frozen-input purity and no I/O/logging/auth/mutation/live seam; GREEN: fix regressions and run full verification.
- [ ] 2.6 Record verified evidence in `openspec/changes/week-03-followups-to-tasks-backfill/apply-progress.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md`; stop after verification/evidence. Agents never stage, commit, or review; parent performs bounded review and the Slice 2 work-unit commit.
