# Tasks: Week 03 Task Automation and Action Audit

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 3,970–4,470; slices 250–375 |
| Headroom | 25–150 per slice |
| 400-line budget risk | High; slices ≤400 |
| Chained PRs recommended | Yes; 13 PRs, five packets |
| Suggested split | `0077` → `0078` → `0079` → `0080-A` → `0080-B` |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Packets ≤1,200; >1,200 auto-splits at native boundaries; native >400 splits behaviorally, never artificially.

`F(){ FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_TASK_AUTOMATION_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 "$@" && npx tsc --noEmit; }`

### Suggested Work Units

Runtime=focused command, disposable PostgreSQL.

| Packet | Goal/PRs | Focused command | Runtime | Rollback |
|---|---|---|---|---|
| `0077` | Audit/1–2 | `F tests/task-action-receipt-{integrity,visibility}.test.ts` | PostgreSQL | Revoke visibility/retain ledger |
| `0078` | Actions/3–5 | `F tests/task-action-lifecycle.test.ts tests/task-action-races.test.ts tests/task-actions-adapter.test.ts` | PostgreSQL | Disable execution/retain audit |
| `0079` | Foundation/6–8 | `F tests/task-automation-{origin,projector,calendar}.test.ts` | PostgreSQL | Disable projectors/retain records |
| `0080-A` | Contact/9–10 | `F tests/task-source-first-contact-{generation,lifecycle}.test.ts` | PostgreSQL | Disable contact hooks |
| `0080-B` | Quotes/11–13 | `F tests/task-source-quote-{generation,response,cancellation}.test.ts tests/task-automation-cutover-preservation.test.ts` | PostgreSQL | Disable quote hooks/RPC |

## Phase 0: Gate

- [x] 0.1 Gate 0: read-only remote migration/schema/function-name inventory via `supabase_list_migrations`, `supabase_list_tables`, and SELECT; collision requires upstream revision. Not implementation-complete; never authorizes remote mutation.

S1–S13 atomically own `openspec/changes/week-03-task-automation-and-action-audit/tasks.md`, `docs/implementation/ACTIVE.md`, and `docs/DECISIONS.md`; S13 owns `docs/PROGRESS.md`.

## Phase 1: `0077` Audit

- [x] 1.1 **S1 300–340/60+.** RED `tests/task-action-receipt-integrity.test.ts`; GREEN `db/migrations/0077_task_action_audit_foundation.sql`,`lib/supabase/database.types.ts`; `F tests/task-action-receipt-integrity.test.ts`; complete=shape/hash/append-only/purge; rollback=zero-state drop/otherwise retain.
- [x] 1.2 **S2 250–290/110+.** RED `tests/task-action-receipt-visibility.test.ts`; GREEN `db/migrations/0077_task_action_audit_foundation.sql`; `F tests/task-action-receipt-visibility.test.ts`; complete=snapshot-RLS/immutability; rollback=revoke visibility/retain rows.

## Phase 2: `0078` Actions

- [x] 2.1 **S3 330–365/35+.** RED `tests/task-action-lifecycle.test.ts`; GREEN `db/migrations/0078_task_action_rpc.sql`,`lib/supabase/database.types.ts`; `F tests/task-action-lifecycle.test.ts`; complete=metadata/auth/applied/no-op; rollback=revoke RPC/retain state.
- [x] 2.2 **S4 300–340/60+.** RED `tests/task-action-races.test.ts`; GREEN `db/migrations/0078_task_action_rpc.sql`; `F tests/task-action-races.test.ts`; complete=replay/conflict/races/first-terminal/writer; rollback=disable writer/retain audit.
- [x] 2.3 **S5 250–290/110+.** RED `tests/task-actions-adapter.test.ts`; GREEN `db/migrations/0078_task_action_rpc.sql`,`lib/admin/task-actions.ts`,`lib/admin/tasks.ts`,`lib/supabase/database.types.ts`; `F tests/task-actions-adapter.test.ts`; complete=exact adapter/legacy revocation; rollback=zero-state restore/otherwise compatible-disable.

## Phase 3: `0079` Foundation

- [x] 3.1 **S6 320–360/40+.** RED `tests/task-automation-origin.test.ts`; GREEN `db/migrations/0079_task_automation_foundation.sql`,`lib/supabase/database.types.ts`; `F tests/task-automation-origin.test.ts`; complete=parity/origin/convergence; rollback=disable projection/retain origins/Tasks.
- [x] 3.2 **S7 300–340/60+.** RED `tests/task-automation-projector.test.ts`; GREEN `db/migrations/0079_task_automation_foundation.sql`,`lib/supabase/database.types.ts`; `F tests/task-automation-projector.test.ts`; complete=unresolved/no-adoption/convergence; rollback=disable projector/retain outcomes.
- [x] 3.3 **S8 300–340/60+.** RED `tests/task-automation-calendar.test.ts`; GREEN `db/migrations/0079_task_automation_foundation.sql`,`lib/supabase/database.types.ts`; `F tests/task-automation-calendar.test.ts`; complete=pinned-Mexico-City vectors/replay; rollback=disable helper/retain rules/origins.

## Phase 4: `0080` Sources

- [x] 4.1 **S9 330–365/35+.** RED `tests/task-source-first-contact-generation.test.ts`; GREEN `db/migrations/0080_task_automation_sources.sql`,`lib/supabase/database.types.ts`; `F tests/task-source-first-contact-generation.test.ts`; complete=anchor/assignment/cutoff/tombstone; rollback=disable hook/retain rows.
- [x] 4.2 **S10 300–340/60+.** RED `tests/task-source-first-contact-lifecycle.test.ts`; GREEN `db/migrations/0080_task_automation_sources.sql`; `F tests/task-source-first-contact-lifecycle.test.ts`; complete=transfer/invalidation/contact-completion; rollback=disable hooks/retain terminal state.
- [x] 4.3 **S11 320–360/40+.** RED `tests/task-source-quote-generation.test.ts`; GREEN `db/migrations/0080_task_automation_sources.sql`; `F tests/task-source-quote-generation.test.ts`; complete=first-sent/+48h/replay/race; rollback=disable hook/retain rows.
- [x] 4.4 **S12 330–365/35+.** RED `tests/task-source-quote-response.test.ts`; GREEN `db/migrations/0080_task_automation_sources.sql`,`lib/supabase/database.types.ts`; `F tests/task-source-quote-response.test.ts`; complete=exact-response/terminal-cancellation RPC; rollback=revoke RPC/hooks/retain audit.
- [x] 4.5 **S13 340–375/25+.** RED `tests/task-source-quote-cancellation.test.ts`,`tests/task-automation-cutover-preservation.test.ts`; GREEN `db/migrations/0080_task_automation_sources.sql`; `F tests/task-source-quote-cancellation.test.ts tests/task-automation-cutover-preservation.test.ts`; complete=WhatsApp/payment/races/preservation; rollback=disable hooks/retain history.

## Scope

Preserve `db/migrations/0049_crm_contact_aggregate_filters.sql` (read-only), `db/migrations/0052_crm_contact_360_rpc_contracts.sql` (read-only), `db/migrations/006[1-9]_*.sql` (read-only), `db/migrations/007[0-6]_*.sql` (read-only), `lib/admin/dashboard.ts` (read-only), `app/admin/(protected)/dashboard/page.tsx` (read-only), `app/admin/(protected)/leads/[id]/actions.ts` (read-only), `app/admin/(protected)/leads/new/actions.ts` (read-only), `app/admin/(protected)/quotes/actions.ts` (read-only), `app/admin/(protected)/operations/actions.ts` (read-only). Exclude bootstrap, Mi día, notifications, event rewrites, remote mutation/rollout/readiness, closure. Threat matrix: N/A.
