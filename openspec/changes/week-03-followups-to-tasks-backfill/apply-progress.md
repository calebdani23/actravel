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
