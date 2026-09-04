# Apply Progress: Admin Follow-up Tasks Preview Reader

## Scope
- Slice: reader Slice1, tasks 1.1–2.2 only
- Delivery: auto-chain, stacked-to-main; PR 1 classifier contract
- Token: `sha256:be43c4fc683969083cc57cbabd0d759a75e57dbedf8147f5cc6f33f705f51e83`
- Mode: Strict TDD, RED → GREEN

## Completed Tasks
- [x] 1.1 Occupancy, exact existing-task, invariant, duplicate, collision, accounting, and canonical-preservation vectors.
- [x] 1.2 Occupancy field/cardinality validation and generated timestamp equality coverage.
- [x] 2.1 Closed `TaskOccupancyFact`, bounded validation, duplicate detection, and exact four-field existing-task matching.
- [x] 2.2 Collision maps derive from occupancy, excluding null leads, with source equality and golden output preserved.

## TDD Cycle Evidence
| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | New occupancy/collision vectors failed | Classifier test passed | Canonical assertions unchanged |
| 1.2 | Validation/timestamp assertions failed | Classifier test passed | Reused closed validation helpers |
| 2.1 | Occupancy contract absent | `npx tsc --noEmit` passed | Pure boundary/error taxonomy preserved |
| 2.2 | Maps came from existing follow-up rows | Focused classifier test passed (11/11) | No reader/server/auth/Supabase/I/O/schema/DML changes |

## Work Unit Evidence
| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` — PASS, 11/11 |
| Runtime harness command/scenario and exact result | N/A — pure classifier only; no runtime/remote boundary in this slice |
| Rollback boundary | Revert `lib/admin/follow-up-backfill-preview.ts` and `tests/follow-up-backfill-preview.test.ts` |

## Verification
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `git diff --check` — PASS

## Remaining
- [ ] 3.1–5.2 — reader and broader verification deferred to subsequent slices.
