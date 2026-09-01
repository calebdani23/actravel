# Apply Progress: Follow-up Task Representation

## Outcome

All nine tasks are complete in one bounded, representation-only local apply batch. No remote
database was contacted or mutated.

## Completed

- RED contract/security/runtime tests were written first; the initial focused run failed because
  migration `0064` was absent. The adapter contract was then made green with additive aliases.
- Added `0064_follow_up_task_representation.sql` with nullable additive fields, exact UTF-8 bounds,
  partial global source uniqueness, insert validation, immutable representation triggers, and no FK
  to CRM history.
- Aligned the generated `tasks` Row/Insert/Update block from a disposable local shadow and added
  `FollowUpTaskMetadata` and `FollowUpTaskRepresentation` aliases without changing write RPCs.
- Disposable shadow applied `0060 → 0061 → 0062 → 0063 → 0064`; generated types succeeded; the
  runtime SQL scenario proved manual insertion, follow-up insertion, lead deletion with
  `ON DELETE SET NULL`, and preservation of source UUID/snapshot. The shadow began with zero Tasks.

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/tasks-follow-up-representation.test.ts tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts tests/tasks-runtime.test.ts` — PASS, 13/13 tests |
| Runtime harness command/scenario and exact result | Disposable Supabase shadow reset plus Docker PostgreSQL scenario — PASS: 2 Tasks inserted, lead deleted, 2 Tasks remained, source UUID and immutable metadata remained; transaction rolled back |
| Rollback boundary | Revert `0064_follow_up_task_representation.sql`, the additive Tasks type block, adapter aliases, four focused test files, this progress file, and the progress entry; no unrelated or remote state |

## Full Verification

- `npm run lint` — PASS.
- `npx tsc --noEmit` — PASS.
- `npm run build` — PASS.
- Shadow cleanup — completed with `supabase stop --workdir /tmp/opencode/week-03-followups-shadow --no-backup`; no linked migration command was run.

## Scope and Delivery

Representation-only, single bounded PR under the approved 800-line maximum; no backfill,
classification, automation, SLA, notifications, UI, CRM cutover, historical Task DML, or remote
parity/production-readiness claim.
