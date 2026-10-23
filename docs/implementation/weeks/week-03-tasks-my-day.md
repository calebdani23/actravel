# Week 03 — Tasks + Mi día

## Outcome
Make pending work explicit and turn the staff home into a role-aware operational queue.

## Dependencies
Tasks foundation from Week 02.

## Status

Week 03 is **closed locally**. The final reconciliation confirms the complete ten-archive chain, its current canonical composition, preserved qualifications, and the unchanged role-aware Mi día route.

Current remote migration, schema, data, RLS, historical-bootstrap execution, and deployed application state remain unknown. No remote inspection or mutation, migration application, operational bootstrap execution, deployment, rollout, or production-readiness determination occurred.

## Completion ledger

| Support change | Archive | Status |
|---|---|---|
| Follow-up Task representation | [2026-09-01 archive](../../../openspec/changes/archive/2026-09-01-week-03-followups-to-tasks/archive-report.md) | Complete |
| Classifier/backfill preview | [2026-09-04 archive](../../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-backfill/archive-report.md) | Complete |
| Preview reader | [2026-09-04 archive](../../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-preview-reader/archive-report.md) | Complete |
| PostgreSQL helper | [2026-09-06 archive](../../../openspec/changes/archive/2026-09-06-week-03-postgres-integration-harness/archive-report.md) | Complete |
| Approval ledger | [2026-09-08 archive](../../../openspec/changes/archive/2026-09-08-week-03-followup-task-approval-ledger/archive-report.md) | Complete at `5f65d42` |
| Approved-plan apply | [2026-09-13 archive](../../../openspec/changes/archive/2026-09-13-week-03-followup-task-approved-plan-apply/archive-report.md) | Complete with preserved warnings |
| Follow-ups-to-Tasks cutover | [2026-09-14 archive](../../../openspec/changes/archive/2026-09-14-week-03-followups-to-tasks-cutover/archive-report.md) | Complete |
| Task automation and action audit | [2026-09-24 archive](../../../openspec/changes/archive/2026-09-24-week-03-task-automation-and-action-audit/archive-report.md) | Complete |
| Historical automation bootstrap | [2026-09-28 archive](../../../openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap/archive-report.md) | Complete after unchanged rerun |
| Role-aware Mi día | [2026-10-06 archive](../../../openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/archive-report.md) | Complete |

All ten former active paths are absent, all **132/132** packet task rows are complete, and terminal records are `PASS` or `PASS WITH WARNINGS` with no unresolved blocker or critical finding. The **19/19** canonical specifications include later compositions and `tasks-foundation`; overlapping packet counts are not presented as deduplicated coverage.

## Preserved qualifications

- The classifier packet retains its zero-scenario-heading warning and corrected failed-verification history.
- Preview-reader operational/readability and baseline-only aggregate advisories remain attributable to that packet.
- PostgreSQL-helper advisories and the approval-ledger unmanaged-compatibility interpretation remain explicit.
- Approved-plan runtime-duration/unavailable-coverage warnings and corrected findings remain provenance.
- The historical-bootstrap Docker-readiness incident remains recorded and was resolved only by an unchanged complete rerun.

## Final local evidence

Fresh unchanged serial aggregates passed **97/97** and **81/81** with zero skips. TypeScript and lint passed; the production build retained **96/96 pages**; protected migrations passed **28/28**; `0089_mi_dia_read_contract.sql` retained SHA-256 `8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc`; generated-file restoration, diff checks, mixed-worktree preservation, and container cleanup passed.

## Primary work
- migrate/represent active follow-ups as first-class Tasks;
- keep `lead_events` as history, not pending-work storage;
- implement SLA due/overdue projections;
- generate first-contact and quote-follow-up tasks idempotently;
- evolve Dashboard toward `Mi día` by role.

## Required context
Volume I SLA + lifecycle; Volume II `Mi día`/CRM; Volume III Tasks/SLA. Inspect current dashboard, Contact 360, `lead_events` follow-up logic, and tests narrowly.

## Closure boundary and next route

Admin, Manager, and Asesor role unions retain bounded Mi día with canonical audited Task actions; Operations, Finance, and Marketing retain the legacy Dashboard and `Resumen`. Home remains `/admin/dashboard`.

The next route is only a separate bounded Week 04 `customer-identity-foundation` **planning** change. Weeks 04–12 remain future program work; this local closure authorizes no Week 04 implementation, remote work, migration application, deployment, or rollout.
