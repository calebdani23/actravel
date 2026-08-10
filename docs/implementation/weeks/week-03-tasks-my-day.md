# Week 03 — Tasks + Mi día

## Outcome
Make pending work explicit and turn the staff home into a role-aware operational queue.

## Dependencies
Tasks foundation from Week 02.

## Primary work
- migrate/represent active follow-ups as first-class Tasks;
- keep `lead_events` as history, not pending-work storage;
- implement SLA due/overdue projections;
- generate first-contact and quote-follow-up tasks idempotently;
- evolve Dashboard toward `Mi día` by role.

## Required context
Volume I SLA + lifecycle; Volume II `Mi día`/CRM; Volume III Tasks/SLA. Inspect current dashboard, Contact 360, `lead_events` follow-up logic, and tests narrowly.

## Suggested Changes
1. `followups-to-tasks`
2. `task-automation-core`
3. `my-day-work-queue`

## Completion gate
New follow-ups live as Tasks; overdue/next work is correct per role; actions are auditable/idempotent; current CRM history remains intact.
