# Active AC Travel Implementation Cycle

## Current milestone

- **Week:** 03
- **Theme:** Tasks + Mi día
- **Status:** Five Week 03 support changes are complete and archived locally. The parent followups-to-tasks outcome remains open pending approved-plan Task apply, disposition parity, future-write conversion, and read cutover.
- **Context preparation merged on main:** `224cc37608f8842725733a5522bbe4ab0dbfe8c1`
- **Executable product baseline before documentation-only preparation:** `01d5a6b0bea066a0ea87943de922e39d18eb4dac`
- **Primary brief:** [`weeks/week-03-tasks-my-day.md`](./weeks/week-03-tasks-my-day.md)

The context-preparation merge changed documentation only. When beginning implementation, always inspect current `main` HEAD rather than assuming either SHA is still the latest commit.

## Week 01 closure history

`week-01-operational-gate-closure` remains the completed bounded Week 01 change. Its amended packet passed final independent verification under token `sha256:e031596ae703108ce9841aad44373afe2b0f4a301a54e52d775ca4d3c802cbf5`.

## Current change state

The completed Week 03 support archives are:

- [Follow-up Task representation](../../openspec/changes/archive/2026-09-01-week-03-followups-to-tasks/archive-report.md)
- [Classifier/backfill preview](../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-backfill/archive-report.md)
- [Preview reader](../../openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-preview-reader/archive-report.md)
- [PostgreSQL helper](../../openspec/changes/archive/2026-09-06-week-03-postgres-integration-harness/archive-report.md)
- [Approval ledger](../../openspec/changes/archive/2026-09-08-week-03-followup-task-approval-ledger/archive-report.md), archived in commit `5f65d42`; its canonical capability is [`follow-up-task-approval-ledger`](../../openspec/specs/follow-up-task-approval-ledger/spec.md).

No active Week 03 OpenSpec packet currently exists.

**Next action:** create the independently reviewable change `week-03-followup-task-approved-plan-apply`. That change must apply an approved immutable plan to Tasks before the separately bounded parity/write/read cutover; do not create its OpenSpec packet as part of this routing correction.

Migrations `0061`-`0065` are local artifacts supported only by archived local/disposable evidence. Current remote migration and schema state is unknown because it was not inspected; no remote parity, migration application, production readiness, or rollout is claimed.

## Required context for the next action

Read only:

1. [`weeks/week-03-tasks-my-day.md`](./weeks/week-03-tasks-my-day.md)
2. [`follow-up-task-approval-ledger` canonical specification](../../openspec/specs/follow-up-task-approval-ledger/spec.md)
3. `docs/PROGRESS.md`
4. `docs/ENVIRONMENT.md`
5. `db/migrations/` **inventory/state**, not every file body by default

## Known gates

- Remote Supabase migration history must be checked, not inferred from docs.
- `main` may move after this file is written; inspect current HEAD when starting the change.
- If remote schema differs from documented baseline, update the active change with discovered reality before implementing features.
- Approved-plan apply must preserve zero-duplicate/idempotency guarantees and must not silently collapse explicit non-eligible dispositions.
- Archived MVP documents under `docs/archive/**` are provenance only and must not be used as implementation instructions.

## Not active yet

Do not begin SLA/task automation or role-aware Mi día before approved-plan apply and follow-up parity/write/read cutover are complete. Portal Identity, quote acceptance, Trips, Travelers, payment plan, Suppliers, incidents, and Marketing Studio remain outside the active Week 03 route.
