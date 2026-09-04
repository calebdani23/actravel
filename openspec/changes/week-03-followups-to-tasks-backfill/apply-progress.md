# Apply Progress: Follow-up Backfill Preview

## Outcome

Slice 1 (tasks 1.1–1.6) and Slice 2 (tasks 2.1–2.6) are complete after parent-confirmed commit `75b2b58`.

## Completed

- [x] 1.1 Typed facts, result rows, closed dispositions/reasons, and typed errors.
- [x] 1.2 Strict UTC parser with canonical normalization and boundary validation.
- [x] 1.3 Fact validation, inclusive cutoff, duplicate rejection, and latest-valid selection.
- [x] 1.4 Lifecycle/owner precedence and invalid-raw nullability.
- [x] 1.5 Non-selected suppression, ascending rows, seven-count accounting, and total count.
- [x] 1.6 Focused verification completed; no staging, commit, push, review, I/O, or remote mutation.
- [x] 2.1 Exact future Task projection, idempotency, equality, and collision precedence.
- [x] 2.2 Recursive canonical JSON, UTF-8 tuple serialization, and SHA-256.
- [x] 2.3 Verified 362-byte canonical golden and 70-byte idempotency vector.
- [x] 2.4 Row/static-header/2,000-row/1MiB bounds.
- [x] 2.5 Purity and regression coverage, including Slice 1 advisory corrections.
- [x] 2.6 Evidence recorded; no staging, commit, push, review, I/O, or remote mutation.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1–1.5 | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` — FAIL before implementation (`MODULE_NOT_FOUND`) | Same command — 3/4 initially, then 4/4 passing after parser/lifecycle fixes | Removed unused placeholder imports/functions; lint clean |
| 2.1–2.5 | RED assertions added before implementation; focused suite GREEN after canonicalizer/task fixes | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` — PASS, 8/8 | Pure synchronous implementation; no live seam |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` — PASS, 8/8 tests |
| Runtime harness command/scenario and exact result | N/A: pure immutable classifier has no runtime/I/O boundary |
| Rollback boundary | Revert `lib/admin/follow-up-backfill-preview.ts`, `tests/follow-up-backfill-preview.test.ts`, and this Slice 1 task/progress state; preserve all unrelated files and Week 01 |

## Verification

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS, zero errors/warnings after cleanup.
- Corrective Slice 1 pass: `git diff --check` — exit 0; no whitespace errors.
- `npx tsc --noEmit` — PASS.
- `npm run build` — PASS (96 static pages generated).
- Slice 2 `git diff --check` — exit 0; no whitespace errors.

## Delivery

- Mode: stacked-to-main chained PR slice; auto-forecast; slice budget 650.
- Boundary: parent-confirmed Slice 1 commit through Task projection/collisions/canonical plan/limits/regressions/evidence.
- Slice 2 remained within the 650-line budget; next route is verification.

## Bounded Remediation Evidence

- Token: `sha256:7185647381e4b133e1d39434f18793b693cb2cf3945e491e0631f774961ae799`
- Fixed demonstrated blockers: actionable `tasks` now exclude already-converted and collision/manual-review rows; task output is sorted by source event creation time then source event ID.
- Added linear existing-task indexes for source ID, owner/idempotency, and owner/lead, plus mutation-based per-lead event grouping, with a 2,000-entry bound checked before validation. Duplicate Task IDs remain `InvalidFact` and collision precedence is unchanged.
- RED→GREEN coverage added for collision task suppression, permutation-invariant task arrays, 2,001 existing-task rejection, and bounded 2,000-entry behavior.
- Golden canonical plan/hash preserved because tasks remain outside the canonical tuple.
- Failed verification report preserved verbatim at `history/failed-verify-actionable-tasks.md`; active `verify-report.md` removed so independent verification can regenerate it.
- Runtime harness: N/A — pure immutable classifier has no runtime/I/O boundary.
- Rollback boundary: revert `lib/admin/follow-up-backfill-preview.ts`, `tests/follow-up-backfill-preview.test.ts`, remediation evidence, and history provenance move only.

## Post-Remediation Verification

| Exact command | Result |
|---|---|
| `node --import tsx --test tests/follow-up-backfill-preview.test.ts` | PASS / exit 0 — 9/9 tests |
| `npx tsc --noEmit` | PASS / exit 0 |
| `npm run lint` | PASS / exit 0 |
| `git diff --check` | PASS / exit 0 |

Active `verify-report.md` is absent; failed verification report is preserved at `history/failed-verify-actionable-tasks.md`.
