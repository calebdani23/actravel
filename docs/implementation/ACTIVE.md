# Active AC Travel Implementation Cycle

## Current milestone

- **Week:** 01
- **Theme:** Baseline & Safety
- **Status:** active; baseline evidence packet captured, final gate blocked
- **Context preparation merged on main:** `224cc37608f8842725733a5522bbe4ab0dbfe8c1`
- **Executable product baseline before documentation-only preparation:** `01d5a6b0bea066a0ea87943de922e39d18eb4dac`
- **Primary brief:** [`weeks/week-01-baseline-safety.md`](./weeks/week-01-baseline-safety.md)

The context-preparation merge changed documentation only. When beginning implementation, always inspect current `main` HEAD rather than assuming either SHA is still the latest commit.

## Active change

`baseline-reconcile-operational-closure` has a bounded evidence packet at [`openspec/changes/baseline-reconcile-operational-closure/`](../../openspec/changes/baseline-reconcile-operational-closure/).

**Next action:** obtain independent review/ownership, resolve the remote `0057` and `0020` findings, and supply every disposable rehearsal prerequisite before considering closure.

Do not create migration `0061+` or new Business OS schema. The packet's sole final gate is `BLOCKED`; remote `0057` provenance and operational recovery readiness are not proven.

## Required context for the next action

Read only:

1. [`weeks/week-01-baseline-safety.md`](./weeks/week-01-baseline-safety.md)
2. Technical Blueprint Volume III sections: `Gate 0`, `Migration strategy`, `Testing and release`, `Agent execution contract`
3. `docs/PROGRESS.md`
4. `docs/ENVIRONMENT.md`
5. `db/migrations/` **inventory/state**, not every file body by default

## Known gates

- Remote Supabase migration history must be checked, not inferred from docs.
- `main` may move after this file is written; inspect current HEAD when starting the change.
- If remote schema differs from documented baseline, update the active change with discovered reality before implementing features.
- Archived MVP documents under `docs/archive/**` are provenance only and must not be used as implementation instructions.

## Not active yet

Do not begin Tasks/Mi día, Portal Identity, quote acceptance, Trips, Travelers, payment plan, Suppliers, incidents, or Marketing Studio until Week 01 baseline gates are complete.
