# Tasks: Week 03 Follow-ups-to-Tasks Cutover

## Review Workload Forecast

|Field|Value|
|---|---|
|Estimated authored changes|1a 140–190; 1b 180–240; 1c 120–160; 2a 160–210; 2b 260–340; 2c 100–140; 2d 180–240; 3a 80–120; 3b 200–280; 3c 180–240; 3d 180–240; 4-gate 180–240; 4a 180–240; 4b 260–320; total 2,400–3,200|
|400-line budget risk|High aggregate; each native slice ≤400|
|Chained PRs recommended|Yes: 14 serial stacked-to-main PRs|
|Delivery strategy|auto-chain|
|Chain strategy|stacked-to-main|

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Each checkbox is one runnable/reviewable PR. Aggregate 401–1,200 exceptions are authorized and >1,200 auto-splits; native ≤400 requires splitting, never compression/recombination across completed migrations.

Commands: `U(){ node --conditions react-server --import tsx --test "$@"; }`; `DB(){ RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U "$@"; }`; before Phase 4, `export FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=<same-lowercase-uuid>`.

Every slice includes **P**: byte-preserve `db/migrations/0049_crm_contact_aggregate_filters.sql` (read-only), `db/migrations/0052_crm_contact_360_rpc_contracts.sql` (read-only), `db/migrations/0061_manager_capability_foundation.sql` (read-only) through `db/migrations/0067_follow_up_task_apply_rpc.sql` (read-only), archives, Task RLS/signatures/event-history; no historical DML/committed-row deletion. **NR**: disposable PostgreSQL/mocks only; no remote access/claim/rollout/closure. Rollback SQL uses a new next-number migration. Threat matrix: N/A. Preserve `history_only`,`block_readiness`,`single_request`,`preserve_in_progress`; exclude SLA/automation, general Task-action audit, notifications, role-aware Mi día.

### Suggested Work Units

The checklist is the 14-PR ledger; every line supplies goal, command, runtime disposition, completion, and rollback boundary.

## Phase 1: Selected-request readiness

- [x] 1.1 **1a.** RED `tests/follow-up-task-readiness-runtime.test.ts`; GREEN `db/migrations/0068_follow_up_task_readiness_helpers.sql`; run `DB tests/follow-up-task-readiness-runtime.test.ts`. Runtime=corrupt-approval/receipt/no-DML;done=deterministic-integrity/ordinal-helpers. Rollback: revoke/drop `public.read_follow_up_task_disposition_readiness(text,uuid)`→drop `public.follow_up_task_readiness_rows(uuid)`→`public.follow_up_task_readiness_validate_receipt(uuid)`→`public.follow_up_task_readiness_validate_approval(uuid)`. P/NR.
- [x] 1.2 **1b.** RED `tests/follow-up-task-readiness-runtime.test.ts`; GREEN `db/migrations/0069_follow_up_task_disposition_readiness_rpc.sql`; run `DB tests/follow-up-task-readiness-runtime.test.ts`. Runtime=seven-dispositions/equations/blockers/precedence/read-only;done=closed-readiness. Rollback: revoke/drop `public.read_follow_up_task_disposition_readiness(text,uuid)` only. P/NR.
- [x] 1.3 **1c.** RED `tests/follow-up-task-disposition-readiness.test.ts`; GREEN `lib/admin/follow-up-task-disposition-readiness.ts`,`lib/supabase/database.types.ts`; run `U tests/follow-up-task-disposition-readiness.test.ts`. Runtime=N/A(no-process-boundary);mocks+1b-substitute;done=Admin-first-exact-shape/errors. Rollback: adapter/type additions only. P/NR.

## Phase 2: Atomic future write

- [x] 2.1 **2a.** RED `tests/follow-up-task-future-write-runtime.test.ts`; GREEN `db/migrations/0070_follow_up_task_future_write_helpers.sql`; run `DB tests/follow-up-task-future-write-runtime.test.ts`. Runtime=deterministic/nonmutating-helpers;done=normalization/fingerprint/replay. Rollback: revert `registerFollowUpAction`→`registerFollowUpTaskWrite`; revoke/drop `public.register_follow_up_action(text,uuid,text,text,text)`; drop `public.read_follow_up_write_replay(uuid,uuid,uuid,text,text)`→`public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text)`→`public.normalize_follow_up_write_due_at(text)`. P/NR.
- [x] 2.2 **2b.** RED `tests/follow-up-task-future-write-runtime.test.ts`; GREEN `db/migrations/0071_follow_up_task_future_write_rpc.sql`; run `DB tests/follow-up-task-future-write-runtime.test.ts tests/tasks-rls.test.ts tests/tasks-follow-up-representation.test.ts tests/tasks-foundation-contract.test.ts`. Regressions: `tests/tasks-rls.test.ts` (read-only),`tests/tasks-follow-up-representation.test.ts` (read-only),`tests/tasks-foundation-contract.test.ts` (read-only). Runtime=atomicity/concurrency/replay/rollback/occupancy;done=exact-RPC/provenance/choices. After 2d revoke/drop RPC; retain rows. P/NR.
- [x] 2.3 **2c.** RED `tests/lead-events-append-only-runtime.test.ts`; GREEN `db/migrations/0072_lead_events_append_only.sql`; run `DB tests/lead-events-append-only-runtime.test.ts`. Runtime=deny-ordinary-update/delete+allow-privileged-purge;done=append-only-policy. Rollback: next migration restores prior policy. P/NR.
- [x] 2.4 **2d.** RED `tests/follow-up-task-future-write.test.ts`,`tests/endpoint-protection.test.ts`; GREEN `lib/admin/follow-up-task-future-write.ts`,`app/admin/(protected)/leads/[id]/actions.ts`,`app/admin/(protected)/leads/[id]/page.tsx`,`lib/supabase/database.types.ts`; run `U tests/follow-up-task-future-write.test.ts tests/endpoint-protection.test.ts tests/crm-final-correctness.test.ts`; `tests/crm-final-correctness.test.ts` (read-only). Runtime=N/A(thin-action);import+2b-substitute;done=sole-RPC/exact-gating-fields-negatives. Rollback: page/action→adapter→types. P/NR.

## Phase 3: Task-backed read contracts

- [x] 3.1 **3a.** RED `tests/follow-up-task-read-index-runtime.test.ts`; GREEN `db/migrations/0073_follow_up_task_active_read_index.sql`; run `DB tests/follow-up-task-read-index-runtime.test.ts`. Runtime=predicate/plan;done=active-read-index. Rollback: next migration drops only index. P/NR.
- [x] 3.2 **3b.** RED `tests/crm-contact-aggregate-task-read-runtime.test.ts`; GREEN `db/migrations/0074_crm_contact_aggregate_follow_up_task_read.sql`; run `DB tests/crm-contact-aggregate-task-read-runtime.test.ts tests/crm-final-correctness.test.ts`; `tests/crm-final-correctness.test.ts` (read-only). Runtime=item-counts/filter/history;done=exact-0049-compatible-Task-aggregate. Rollback: next migration restores exact 0049 definition. P/NR.
- [x] 3.3 **3c.** RED `tests/crm-contact-360-summary-task-read-runtime.test.ts`; GREEN `db/migrations/0075_crm_contact_360_summary_follow_up_task_read.sql`; run `DB tests/crm-contact-360-summary-task-read-runtime.test.ts`. Runtime=count/minimum/history;done=exact-0052-compatible-summary. Rollback: next migration restores 0052 summary. P/NR.
- [x] 3.4 **3d.** RED `tests/crm-contact-opportunity-task-read-runtime.test.ts`; GREEN `db/migrations/0076_crm_contact_opportunity_follow_up_task_read.sql`; run `DB tests/crm-contact-opportunity-task-read-runtime.test.ts`. Runtime=earliest/terminal/history-aliases;done=exact-0052-compatible-page. Rollback: next migration restores 0052 page. P/NR.

## Phase 4: Admitted application cutover

- [x] 4.1 **4-gate.** RED `tests/follow-up-task-local-cutover-admission.test.ts`; GREEN `tests/helpers/follow-up-task-cutover-admission.ts`; consume `tests/helpers/postgres-runtime.ts` (read-only); run `DB tests/follow-up-task-local-cutover-admission.test.ts`. Runtime=helper-only/create-apply-fixture-Admin/call-readiness. Done=atomically-write `tmp/week-03-followups-to-tasks-cutover/local-admission.json` as `{"schema":"follow-up-task-local-admission.v1","selectedRequestId":"<same-lowercase-uuid>","database":"disposable-postgres","readinessRpc":"read_follow_up_task_disposition_readiness","readinessResult":"<matching-ok=true-ready=true-result>","prerequisites":{"futureWrite":true,"activeReadIndex":true,"contactAggregate":true,"contact360Summary":true,"contactOpportunityPage":true}}`; else remove/fail. Rollback: evidence→helper/test. P/NR.
- [x] 4.2 **4a.** RED `tests/follow-up-task-dashboard-cutover.test.ts`; GREEN `lib/admin/dashboard.ts`; run `U tests/follow-up-task-dashboard-cutover.test.ts tests/admin-ops.test.ts`; `tests/admin-ops.test.ts` (read-only). `assertLocalAdmission()` precedes imports; false/failed/unavailable/malformed/missing/mismatched evidence blocks. Runtime=N/A(pure-projection);fake-client+paging/order/error/no-event+gate/3a;done=untruncated-Task-ID-queue/count. Rollback: Dashboard reader only. P/NR.
- [x] 4.3 **4b.** RED `tests/follow-up-task-application-cutover.test.ts`; GREEN `lib/admin/tasks.ts`,`lib/admin/leads.ts`; run `U tests/follow-up-task-application-cutover.test.ts tests/lead-search.test.ts tests/contact-crm-ui.test.ts tests/crm-contact-360-rpc-contract.test.ts tests/tasks-runtime.test.ts`. Regressions: `tests/lead-search.test.ts` (read-only),`tests/contact-crm-ui.test.ts` (read-only),`tests/crm-contact-360-rpc-contract.test.ts` (read-only),`tests/tasks-runtime.test.ts` (read-only). Admission precedes imports. Runtime=N/A(adapter);fixtures+3b–3d;done=earliest/terminal/history/RLS+DTO/limits. Rollback: Task/lead readers before read contracts. P/NR.
