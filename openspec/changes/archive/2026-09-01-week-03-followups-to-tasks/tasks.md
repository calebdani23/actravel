# Tasks: Follow-up Task Representation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 450–650; below approved 800-line maximum |
| 400-line budget risk | High (informational legacy signal) |
| Chained PRs recommended | No |
| Suggested split | One bounded PR |
| Delivery strategy | auto-forecast |
| Chain strategy | not-applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not-applicable
400-line budget risk: High
Approval is bound to this session’s configured 800-line maximum; no further decision is required.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | RED contracts | 1 | `node --import tsx --test tests/tasks-follow-up-representation.test.ts tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts` | Disposable shadow only | Revert tests |
| 2 | GREEN schema/types | 1 | `npx tsc --noEmit` | `init --workdir /tmp/opencode/<id>`; `cp -a db/migrations /tmp/opencode/<id>/supabase/migrations`; `start --workdir /tmp/opencode/<id> --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes`; `db reset --workdir /tmp/opencode/<id> --local --no-seed`; local gen types; `stop --workdir /tmp/opencode/<id> --no-backup` | Revert 0064/type block |
| 3 | GREEN adapter/evidence | 1 | `npm run lint && npx tsc --noEmit && npm run build` | Focused tests, disposable shadow; no remote | Revert adapter/tests/evidence |

## Phase 1: RED contracts and safety

- [x] 1.1 RED — Files=`tests/tasks-follow-up-representation.test.ts`; Command=work-unit 1; Evidence=failed tests for fields/defaults, exact metadata, UTF-8 bounds, lowercase UUIDs, UTC microseconds, and manual/all-or-none INSERT rules (`source_due_at = due_at`); Rollback=test file.
- [x] 1.2 RED — Files=`tests/tasks-foundation-contract.test.ts`, `tests/tasks-rls.test.ts`; Command=work-unit 1; Evidence=failed uniqueness, immutability, no-FK, `ON DELETE SET NULL`, purge, RPC/RLS/grant/lifecycle, and zero-Task-DML assertions; Rollback=test files.
- [x] 1.3 RED — Files=`tests/tasks-follow-up-representation.test.ts`; Command=`npx --yes supabase@2.115.0 init --workdir /tmp/opencode/<id>` plus read-only reconciliation; Evidence=fail-closed `0060`, exact `0061→0062→0063→0064`, disposable-only and no-remote-mutation checks; Rollback=temp root.

## Phase 2: GREEN schema and types

- [x] 2.1 GREEN after all Phase 1 RED evidence — File=`db/migrations/0064_follow_up_task_representation.sql`; Command=`npx --yes supabase@2.115.0 db reset --workdir /tmp/opencode/<id> --local --no-seed`; Evidence=columns, triggers, index, bounds, no FK, schema-only/zero historical DML pass; Rollback=delete 0064.
- [x] 2.2 GREEN — File=`lib/supabase/database.types.ts`; Command=`npx --yes supabase@2.115.0 gen types typescript --local --workdir /tmp/opencode/<id> > /tmp/opencode/<id>/database.types.ts` then `npx tsc --noEmit`; Evidence=copy only exact additive Tasks Row/Insert/Update fields and Relationships; Rollback=restore type file. Do not run linked `npm run db:types`.

## Phase 3: RED then GREEN adapter

- [x] 3.1 RED — File=`tests/tasks-runtime.test.ts`; Command=`node --import tsx --test tests/tasks-runtime.test.ts tests/tasks-follow-up-representation.test.ts`; Evidence=failed TaskRow/list/create/transition, manual-null, additive-field, and unchanged CRM-read assertions; Rollback=test file.
- [x] 3.2 GREEN after 3.1 RED — File=`lib/admin/tasks.ts`; Command=3.1 command; Evidence=only `FollowUpTaskMetadata` and `FollowUpTaskRepresentation` aliases make tests pass; Rollback=adapter file.

## Phase 4: Verification and evidence

- [x] 4.1 GREEN — Files=`tests/tasks-follow-up-representation.test.ts`, `tests/tasks-foundation-contract.test.ts`, `tests/tasks-rls.test.ts`, `tests/tasks-runtime.test.ts`; Commands=work-unit 3 plus focused commands; Evidence=all tests, lint, typecheck, build, cleanup, rollback, and representation-only exclusions pass (no backfill/classification/preview/approve/apply/RPC/ledger/automation/SLA/notifications/UI/CRM cutover/future creation/historical Task DML).
- [x] 4.2 Apply evidence — File=`openspec/changes/week-03-followups-to-tasks/apply-progress.md`; `sdd-apply` writes it only after evidence. Update `docs/PROGRESS.md` only then; claim no remote parity or production readiness. Rollback=local files only.
