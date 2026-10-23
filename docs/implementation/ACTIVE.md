# Active AC Travel Implementation Cycle

## Current milestone

- **Week:** 04 implementation — independent runtime verification pending
- **Theme:** Customer identity foundation
- **Status:** Week 03 is **closed locally** through `week-03-final-closure-reconciliation`: 10/10 archives, 132/132 packet task rows, 19/19 canonical specifications, fresh unchanged 97/97 and 81/81 aggregates with zero skips, TypeScript, lint, the 96/96-page build, protected hashes 28/28, exact `0089`, diff/restoration, and cleanup passed.
- **Context preparation merged on main:** `224cc37608f8842725733a5522bbe4ab0dbfe8c1`
- **Executable product baseline before documentation-only preparation:** `01d5a6b0bea066a0ea87943de922e39d18eb4dac`
- **Primary brief:** [`weeks/week-04-portal-identity.md`](./weeks/week-04-portal-identity.md). The user's explicit implementation request superseded the planning-only handoff. Current code is local-only; see [`week-04-customer-identity.md`](./week-04-customer-identity.md) and `odd/tasks/week-04-customer-identity.md`.

The context-preparation merge changed documentation only. When beginning implementation, always inspect current `main` HEAD rather than assuming either SHA is still the latest commit.

## Week 01 closure history

`week-01-operational-gate-closure` remains the completed bounded Week 01 change. Its amended packet passed final independent verification under token `sha256:e031596ae703108ce9841aad44373afe2b0f4a301a54e52d775ca4d3c802cbf5`.

## Week 03 locally verified closure record

The local verdict preserves the classifier zero-scenario/corrected-failure history; preview-reader operational, readability, and baseline-only advisories; PostgreSQL-helper advisories; approval-ledger unmanaged-compatibility interpretation; approved-plan duration/coverage warnings and corrected findings; and the historical Docker-readiness incident resolved by an unchanged complete rerun. Packet counts remain overlapping compositions, not a deduplicated total.

The completed Week 03 support archives are:

- [Follow-up Task representation](../../openspec/changes/archive/2026-09-01-week-03-followups-to-tasks/archive-report.md)
- [Classifier/backfill preview](../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-backfill/archive-report.md)
- [Preview reader](../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-preview-reader/archive-report.md)
- [PostgreSQL helper](../../openspec/changes/archive/2026-09-06-week-03-postgres-integration-harness/archive-report.md)
- [Approval ledger](../../openspec/changes/archive/2026-09-08-week-03-followup-task-approval-ledger/archive-report.md), archived in commit `5f65d42`; its canonical capability is [`follow-up-task-approval-ledger`](../../openspec/specs/follow-up-task-approval-ledger/spec.md).

The approved-plan apply change is archived locally at [`openspec/changes/archive/2026-09-13-week-03-followup-task-approved-plan-apply/`](../../openspec/changes/archive/2026-09-13-week-03-followup-task-approved-plan-apply/). Its promoted canonical capability is [`follow-up-task-approved-plan-apply`](../../openspec/specs/follow-up-task-approved-plan-apply/spec.md).

The followups-to-tasks cutover is archived locally at [`openspec/changes/archive/2026-09-14-week-03-followups-to-tasks-cutover/`](../../openspec/changes/archive/2026-09-14-week-03-followups-to-tasks-cutover/). Its promoted canonical capabilities are:

- [`follow-up-task-disposition-readiness`](../../openspec/specs/follow-up-task-disposition-readiness/spec.md)
- [`follow-up-task-future-write`](../../openspec/specs/follow-up-task-future-write/spec.md)
- [`follow-up-task-read-contracts`](../../openspec/specs/follow-up-task-read-contracts/spec.md)
- [`follow-up-task-application-cutover`](../../openspec/specs/follow-up-task-application-cutover/spec.md)

The task automation and action-audit packet is archived locally at [`openspec/changes/archive/2026-09-24-week-03-task-automation-and-action-audit/`](../../openspec/changes/archive/2026-09-24-week-03-task-automation-and-action-audit/). Its promoted canonical capabilities are:

- [`task-action-audit`](../../openspec/specs/task-action-audit/spec.md)
- [`task-automation-foundation`](../../openspec/specs/task-automation-foundation/spec.md)
- [`task-source-automation`](../../openspec/specs/task-source-automation/spec.md)
- the amended [`tasks-foundation`](../../openspec/specs/tasks-foundation/spec.md)

Migrations `0068`–`0076` implement local readiness, future writes, append-only ordinary event writes, and Task read contracts. Dashboard, lead, related-opportunity, and Contact pending-work projections are admitted and Task-backed locally.

The archived automation/action-audit packet completed local implementation through S13: [cumulative apply evidence](../../openspec/changes/archive/2026-09-24-week-03-task-automation-and-action-audit/apply-progress.md) and [final verification](../../openspec/changes/archive/2026-09-24-week-03-task-automation-and-action-audit/verify-report.md). Local `0079` retains the exact foundation; local `0080` completes future first-contact behavior plus exact quote generation, response, terminal, unambiguous WhatsApp, and verified exact-payment cancellation.

The historical automation bootstrap packet is archived locally at [`openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap/`](../../openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap/). Its promoted canonical capabilities are:

- [`task-automation-historical-classification`](../../openspec/specs/task-automation-historical-classification/spec.md)
- [`task-automation-historical-preview`](../../openspec/specs/task-automation-historical-preview/spec.md)
- [`task-automation-historical-approval`](../../openspec/specs/task-automation-historical-approval/spec.md)
- [`task-automation-historical-apply`](../../openspec/specs/task-automation-historical-apply/spec.md)

The packet completed local implementation through S18: local unapplied `0081`–`0088`, strict auth-first preview/approval/apply/readiness callers, exact manual types, atomic receipt-first apply, read-only readiness accounting, aggregate rollback proof, and protected `0077`–`0080` preservation passed with zero skips. The transient Docker-readiness incident recorded during verification was resolved by a clean unchanged rerun.

**Mi día S1–S5:** the complete packet is archived locally at [`openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/`](../../openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/). Its promoted canonical capabilities are:

- [`role-aware-mi-dia`](../../openspec/specs/role-aware-mi-dia/spec.md)
- the amended [`follow-up-task-application-cutover`](../../openspec/specs/follow-up-task-application-cutover/spec.md)

Final local evidence is 21/21 requirements, 81/81 scenarios, and 11/11 tasks. Focused Mi día/routing **33/33**, UI **5/5**, Chromium E2E **5/5**, Mi día runtime **1/1**, combined action/automation/source/historical regression **97/97**, and follow-up/Task/CRM preservation **81/81** passed with zero skips. TypeScript, lint, the 96/96-page build, diff checks, the protected 28/28 manifest, and cleanup passed; verify-report SHA-256 is `f3a178dd5d71b6c1479992efa3f2c66ff56a6ec2052e97f47bc8cdee0f91206d`.

**Next action:** resolve Week 04 independent runtime verification. Parent-run disposable PostgreSQL and a separate loopback Chromium/build worker passed; the independent verifier could run static/Auth-boundary checks only. Week 04 remains open. Do not deploy, apply remote migrations, or advance Week 05 from these local results.

Migrations `0061`–`0089` are local artifacts supported only by local/disposable evidence. No remote state was inspected or changed during archive.

## Required context for the next action

Read only:

1. [`weeks/week-04-portal-identity.md`](./weeks/week-04-portal-identity.md) and `odd/tasks/week-04-customer-identity.md` for current scope and missing proof; Week 03 remains the locally closed predecessor.
2. `docs/blueprints/INDEX.md` to locate only the customer-identity business, product, and architecture sections needed for bounded planning.
3. Current customer/contact schema, RLS, generated types, and identity-adjacent tests as executable reality; inspect narrowly before drafting any Week 04 proposal.
4. `docs/PROGRESS.md` and `docs/DECISIONS.md` for the exact local-only boundary and remote unknowns.

## Known gates

- Remote migration, schema, data, and execution state remain unknown; any remote reconciliation or rollout requires separate current-state inspection and explicit authorization.
- `main` may move after this file is written; inspect current HEAD when starting the change.
- If remote schema differs from documented baseline, update the active change with discovered reality before implementing features.
- SLA/task automation and Task action audit/idempotency must preserve the cutover's history-only, blocking-readiness, single-request, status-preservation, and zero-duplicate guarantees.
- Role-aware Mi día is archived locally and must not be reopened during closure reconciliation unless contradictory current evidence is found.
- Week 03 is closed locally only; current remote migration, schema, data, RLS, historical-bootstrap execution, and deployed application state remain unknown.
- Archived MVP documents under `docs/archive/**` are provenance only and must not be used as implementation instructions.

## Not active yet

Do not infer remote parity, migration application, operational bootstrap execution, deployment, rollout, or production readiness from local closure evidence. Week 04 identity/invitation/shell implementation is present but closure remains pending. Customer quote acceptance, Trips, Travelers, payment plans, Suppliers, incidents, notifications, Marketing Studio, release hardening, and Weeks 05–12 remain future work.
