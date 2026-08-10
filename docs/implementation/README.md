# AC Travel Business OS — Implementation Context

This directory is the **agent entry point for ongoing implementation**.

The repository intentionally uses progressive context. Agents should not load the full AC Travel history or every Blueprint before each task.

## Start here

For substantial product/implementation work:

1. Read `AGENTS.md` (normally loaded by the repo agent runtime).
2. Read [`ACTIVE.md`](./ACTIVE.md).
3. Read only the active week brief referenced by `ACTIVE.md`.
4. Read the active SDD/OpenSpec change artifacts if a change is already open.
5. Open only the Blueprint sections and repository contracts referenced by that week/change.
6. Search before broad-reading.

## Progressive Context Rule

Default context budget:

- `AGENTS.md`;
- `docs/implementation/ACTIVE.md`;
- one active week brief;
- one active change spec/design/tasks set;
- the smallest referenced code/migrations/tests set.

Do **not** read by default: all Blueprint volumes, all `docs/`, every migration, all `lib/admin/*`, or the full test tree.

If understanding requires 4+ repository files, follow the repository's existing delegation/exploration rules rather than expanding the parent context.

## Authority order

When sources appear to conflict, use this implementation order:

1. **Active change specification/design/tasks** — exact implementation scope.
2. **Current code + current DB schema/migrations + executable tests** — current executable reality and compatibility constraints.
3. **Active week brief** — current milestone intent and completion gates.
4. **Technical Blueprint — Volume III** — target technical direction.
5. **Product Blueprint — Volume II** — intended product experience.
6. **Business Blueprint — Volume I** — business policy/operating model.
7. **Historical MVP roadmap/docs** — provenance only.

Nuance: current code says what exists, not necessarily what should remain forever. Example: physical `leads` remains for compatibility while target domain vocabulary is Opportunity.

## Source router

| Question | Primary source |
| --- | --- |
| What are we implementing now? | `ACTIVE.md` + week brief + active change |
| Why does the business need it? | Volume I |
| What should customer/staff experience be? | Volume II |
| How should repository/data evolve? | Volume III |
| What actually exists now? | Current branch code/schema/tests |
| What durable implementation decision exists? | `docs/DECISIONS.md` |
| What has shipped / been verified? | `docs/PROGRESS.md` |
| What environment/runtime variables exist? | `docs/ENVIRONMENT.md` |

## Week ≠ Change

A week is a planning milestone. A Change is a specification/implementation unit. Do not implement an entire week as one giant change.

Example:

```text
Week 06 — Trip Foundation
  ├─ trip-schema-foundation
  ├─ legacy-booking-trip-backfill
  ├─ sales-operations-handoff
  └─ trip-admin-workspace
```

Each change must be independently specifiable, verifiable, reviewable, and archivable.

## Change package minimum contract

Every substantial change should state:

- Change ID
- Problem / desired outcome
- In scope
- Out of scope
- Existing contracts/invariants to preserve
- Data/migration implications
- RLS/security implications
- Acceptance criteria
- Tests/evidence
- Rollback/recovery strategy
- Documentation updates

## 12-week program map

| Week | Theme | Primary outcome |
| --- | --- | --- |
| 01 | Baseline & Safety | Repo/Supabase/test/release baseline reconciled |
| 02 | Domain Foundation | Manager/capabilities + Tasks/notifications foundation |
| 03 | Tasks + Mi día | Explicit work queue and SLA-driven staff home |
| 04 | Portal Identity | Secure customer identity/auth/RLS shell |
| 05 | Portal Quotes | Verified quote access/acceptance/change requests |
| 06 | Trip Foundation | Trip aggregate + formal Sales→Operations handoff |
| 07 | Travelers + Documents | Traveler/access/document visibility model |
| 08 | Reservations + Suppliers + Support | Multi-service operations, suppliers, incidents |
| 09 | Payment Plan | Obligations/allocations/balance model |
| 10 | Operational Portal | Pre-trip customer experience across money/docs/travelers |
| 11 | Marketing + Public | Campaign/publication attribution and CMS efficiency |
| 12 | Hardening & Release | RLS/E2E/migration/observability/release readiness |

## Moving the active cycle

`ACTIVE.md` should stay short. When a week/change closes:

1. update `docs/PROGRESS.md` with verified shipped state;
2. record durable architecture/product decisions in `docs/DECISIONS.md`;
3. archive/close the active change using the repository SDD process;
4. change `ACTIVE.md` to the next allowed change/week;
5. refine the next week brief only with knowledge actually discovered.

Do not pre-author dozens of detailed future changes. The weekly briefs preserve direction; detailed Changes are created close to execution.

## Historical roadmap rule

`docs/ROADMAP.md` and `docs/NEXT_STEPS_ROADMAP.md` describe earlier MVP evolution and remain useful as provenance. They are superseded for active Business OS sequencing by this directory and the approved Blueprints.
