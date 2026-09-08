# Week 03 — Tasks + Mi día

## Outcome
Make pending work explicit and turn the staff home into a role-aware operational queue.

## Dependencies
Tasks foundation from Week 02.

## Status

The parent followups-to-tasks outcome is **OPEN**. The completed support chain does not close it: closure still requires approved-plan Task apply, explicit disposition parity, future-write conversion, and read cutover.

## Completion ledger

| Support change | Archive | Status |
|---|---|---|
| Follow-up Task representation | [2026-09-01 archive](../../../openspec/changes/archive/2026-09-01-week-03-followups-to-tasks/archive-report.md) | Complete |
| Classifier/backfill preview | [2026-09-04 archive](../../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-backfill/archive-report.md) | Complete |
| Preview reader | [2026-09-04 archive](../../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-preview-reader/archive-report.md) | Complete |
| PostgreSQL helper | [2026-09-06 archive](../../../openspec/changes/archive/2026-09-06-week-03-postgres-integration-harness/archive-report.md) | Complete |
| Approval ledger | [2026-09-08 archive](../../../openspec/changes/archive/2026-09-08-week-03-followup-task-approval-ledger/archive-report.md) | Complete at `5f65d42` |

## Primary work
- migrate/represent active follow-ups as first-class Tasks;
- keep `lead_events` as history, not pending-work storage;
- implement SLA due/overdue projections;
- generate first-contact and quote-follow-up tasks idempotently;
- evolve Dashboard toward `Mi día` by role.

## Required context
Volume I SLA + lifecycle; Volume II `Mi día`/CRM; Volume III Tasks/SLA. Inspect current dashboard, Contact 360, `lead_events` follow-up logic, and tests narrowly.

## Remaining dependency order

1. Approved-plan Task apply: `week-03-followup-task-approved-plan-apply`.
2. Explicit disposition parity, future-write conversion, and read cutover.
3. SLA/task automation.
4. Role-aware Mi día.
5. Week 03 closure.

## Completion gate
Approved historical plans and future follow-ups live as Tasks with explicit disposition parity and completed read cutover; overdue/next work is correct per role; actions are auditable/idempotent; current CRM history remains intact.
