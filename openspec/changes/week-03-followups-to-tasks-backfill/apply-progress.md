# Apply Progress: Follow-up Backfill Preview

## Outcome

Slice 1 (tasks 1.1–1.6) is complete. Slice 2 remains intentionally untouched.

## Completed

- [x] 1.1 Typed facts, result rows, closed dispositions/reasons, and typed errors.
- [x] 1.2 Strict UTC parser with canonical normalization and boundary validation.
- [x] 1.3 Fact validation, inclusive cutoff, duplicate rejection, and latest-valid selection.
- [x] 1.4 Lifecycle/owner precedence and invalid-raw nullability.
- [x] 1.5 Non-selected suppression, ascending rows, seven-count accounting, and total count.
- [x] 1.6 Focused verification completed; no staging, commit, push, review, I/O, or remote mutation.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1–1.5 | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` — FAIL before implementation (`MODULE_NOT_FOUND`) | Same command — 3/4 initially, then 4/4 passing after parser/lifecycle fixes | Removed unused placeholder imports/functions; lint clean |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` — PASS, 4/4 tests |
| Runtime harness command/scenario and exact result | N/A: pure immutable classifier has no runtime/I/O boundary |
| Rollback boundary | Revert `lib/admin/follow-up-backfill-preview.ts`, `tests/follow-up-backfill-preview.test.ts`, and this Slice 1 task/progress state; preserve all unrelated files and Week 01 |

## Verification

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS, zero errors/warnings after cleanup.
- Corrective Slice 1 pass: `git diff --check` — exit 0; no whitespace errors.

## Delivery

- Mode: stacked-to-main chained PR slice; auto-forecast; slice budget 650.
- Boundary: empty implementation through facts/parser/validation/selection/dispositions/rows/counts.
- Slice 2 tasks 2.1–2.6 remain pending and are excluded from this apply batch.
