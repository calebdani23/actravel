# Week 01 — Baseline & Safety

## Outcome

Create a trustworthy technical baseline before any Business OS schema or feature work. At the end of this week, repository code, Supabase migration history, generated DB types, tests, and deployment assumptions must describe the same system.

## Why this week exists

Volume III identified the primary execution risk: the repository contains a mature migration chain through `0060`, but repository documentation cannot prove which migrations/schema objects are actually applied to the remote Supabase project. Building `0061+` on an unverified history can corrupt sequencing or create false confidence.

## Business outcome

No visible customer feature. This is deliberate risk reduction so later CRM, Portal, Trip, Finance, and Marketing changes do not invalidate production data/RLS.

## Technical outcome

- remote/repo migration history reconciled;
- staging/rehearsal path confirmed;
- generated DB types aligned to the verified schema;
- current build/test baseline recorded;
- dependencies/release assumptions made reproducible;
- no unknown schema drift remains unexplained.

## Recommended Change IDs

Work sequentially. Do not combine all of Week 01 unless reality proves the work is mechanical.

1. `baseline-reconcile` — **first and blocking**
2. `dependency-baseline` — pin/record dependency versions without feature work
3. `ci-safety-gates` — only if current CI/release automation needs a separate change

## Required context

Read:

- `docs/implementation/README.md`
- Technical Blueprint Volume III: `Baseline repository strengths`, `Gate 0`, `Migration strategy`, `Testing and release`, `Agent execution contract`
- `docs/PROGRESS.md`
- `docs/ENVIRONMENT.md`
- root `package.json` + lockfile
- migration **inventory** in `db/migrations/`

Read individual migration bodies only when a mismatch/dependency requires them.

## Existing contracts that must not break

- Supabase remains operational source of truth.
- Existing RLS is authoritative.
- Current quote subsystem and 0053–0060 chain must not be rewritten merely to simplify reconciliation.
- Existing public quote intake must persist principal business data even when external boundaries fail.
- No destructive cleanup merely to force local/remote histories to look equal.

## `baseline-reconcile` evidence checklist

The first change must establish evidence for:

- current Git HEAD, branch, clean/dirty state;
- actual Supabase project/ref/environment targeted locally;
- remote migration history;
- local migration inventory and names/checksums where available;
- whether 0053–0060 exist remotely;
- schema objects not represented by expected migration history;
- current RLS/helper state for critical CRM/quote objects when drift is suspected;
- generated type drift;
- build/lint/test baseline;
- production/staging separation;
- available backup/rollback/recovery capability.

## Deliverables

- reconciliation report stored with active SDD/OpenSpec artifacts;
- every mismatch classified as: represented/applied, local pending, remote-only/untracked, or ambiguous/manual-review;
- remediation plan before allocating any new migration identifier;
- DB types regenerated only after alignment;
- durable findings added to `docs/DECISIONS.md` / verified state to `docs/PROGRESS.md`.

## Out of scope

No Tasks table, Manager role, customer portal, Trips, Travelers, payment plan, supplier model, Marketing Studio, or unrelated redesign.

## Verification

At minimum after reconciliation/remediation:

```bash
npm run lint
npm run build
npm run test:quote-notifications
```

Run existing DB/contract/E2E suites relevant to any schema/migration change. Do not send real Resend/Meta traffic from tests.

## Completion gates

Week 01 baseline is complete only when:

- repo and remote migration histories are explicitly reconciled;
- no unknown remote-only schema change remains unexplained;
- generated types match aligned schema;
- critical build/tests pass;
- rollback/recovery assumptions are documented;
- the next migration identifier can be selected safely;
- `ACTIVE.md` can move to Week 02 without hidden schema blockers.

## Handoff to Week 02

Provide confirmed schema/migration baseline, current role/RLS inventory, verified test commands, and constraints that future Tasks/notifications changes must preserve.
