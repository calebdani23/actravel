# Apply Progress: Week 03 Follow-up Task Approval Ledger

## Work unit

PR 1, stacked-to-main: migration and static contract only. Standard mode; no test
runner strict-TDD configuration was present. This maintainer-authorized corrective retry
is bounded by native parent token `sha256:0394fcf1759e6442ecb7680818a346eeb3d8209612e06d346a4de84750aa3851`.

## Completed tasks

- [x] 1.1 RED static contract test.
- [x] 1.2 0065 migration and GREEN static contract.
- [x] 1.3 bounded PR 1 handoff.

## TDD cycle evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | `node --import tsx --test tests/follow-up-task-approval.test.ts` failed before 0065 existed (`existsSync` false and migration read `ENOENT`). | N/A — contract-only RED completed before migration. | Corrected one test regex typo without changing the contract scope. |
| 1.2 | Existing static contracts failed against the absent migration. | Focused static suite: 5/5 passing after corrective migration/test changes. | Split null/actor precedence; nested the exact header; separated shape/semantic checks from limit classification; isolated count exceptions; strengthened count/projection/replay assertions. |
| 1.3 | N/A | `npx tsc --noEmit`, `npm run lint`, and `git diff --check` all passed. | N/A |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/follow-up-task-approval.test.ts` — PASS, 5/5 tests, 0 failures. |
| Runtime harness command/scenario and exact result | N/A — this PR is explicitly SQL text/static-contract only; runtime PostgreSQL is PR 2. |
| Rollback boundary | Delete `db/migrations/0065_follow_up_task_approval_ledger.sql` and `tests/follow-up-task-approval.test.ts`; revert this change's task/progress artifacts only. |

## Corrective retry evidence

- RED assertions were strengthened first for null actor/cutoff precedence, canonical cutoff/plan equality, ten-shape/nine-field rows, seven count equations, legal matrix, static header, exact projection, limits, exact replay identity, and UPDATE/DELETE rejection.
- GREEN corrected only migration 0065 and this focused static test. PR 2 remains entirely pending.

## Verification and boundary

- `npx tsc --noEmit --incremental false` — PASS.
- `npm run lint` — PASS.
- `git diff --check` — PASS; tracked task delta is bounded and implementation correction remains below the 250 changed-line budget relative to the native parent token.
- No generated types, adapter, runtime harness, Docker, database, remote, lifecycle, staging, or Gentle-AI operation was used.
- No Task table DML is present in 0065.
- Correction scope is exactly `db/migrations/0065_follow_up_task_approval_ledger.sql`, `tests/follow-up-task-approval.test.ts`, and these SDD artifacts; no PR 2 task was advanced.

## Handoff

Ready for parent review/commit, then PR 2. The parent owns commit and PR lifecycle actions.
