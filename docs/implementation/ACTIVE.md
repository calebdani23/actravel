# Active AC Travel Implementation Cycle

## Current milestone

- **Week:** 01
- **Theme:** Baseline & Safety
- **Status:** Week 01 PASS; maintainer amendment accepts `0057` as `ABSENT_WITH_EFFECT_EQUIVALENCE`; Week 02 is planning-only next action
- **Context preparation merged on main:** `224cc37608f8842725733a5522bbe4ab0dbfe8c1`
- **Executable product baseline before documentation-only preparation:** `01d5a6b0bea066a0ea87943de922e39d18eb4dac`
- **Primary brief:** [`weeks/week-01-baseline-safety.md`](./weeks/week-01-baseline-safety.md)

The context-preparation merge changed documentation only. When beginning implementation, always inspect current `main` HEAD rather than assuming either SHA is still the latest commit.

## Active change

`week-01-operational-gate-closure` is the bounded change at [`openspec/changes/week-01-operational-gate-closure/`](../../openspec/changes/week-01-operational-gate-closure/). The amended packet passed final independent verification under token `sha256:e031596ae703108ce9841aad44373afe2b0f4a301a54e52d775ca4d3c802cbf5`.

**Next action:** Week 02 planning only; do not regenerate types or allocate/run `0061+` automatically.

Do not create migration `0061+` or new Business OS schema. The packet's final gate is **PASS** under the explicit amendment; `0057` did not execute, equivalent effects are evidenced, and authoritative absence is accepted as disposition rather than provenance. `0061+` remains separately gated.

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
