# Design: Week 03 Follow-ups-to-Tasks Cutover

## Approach and Decisions

Local sequence: selected-request readiness → atomic future write → compatible Task reads → admitted cutover. Preserve `0049`, `0052`, `0061`–`0067`, and archives byte-for-byte.

| Choice | Rejected | Rationale |
|---|---|---|
| `history_only` null dates | Reject | Avoid invented work. |
| `block_readiness` | Waiver | Prevent silent loss. |
| `single_request` | Global parity | Avoid overlap ambiguity. |
| `preserve_in_progress` | Replace/complete | Not a lifecycle transition. |
| `auto-chain`, `stacked-to-main` | Aggregate exception | ≤400 each; 1,200 cannot override. |

## Contracts, Admission, and Provenance

`read_follow_up_task_disposition_readiness(text,uuid)→jsonb` is postgres-owned authenticated-only `SECURITY DEFINER`; its Admin-first adapter accepts `{requestId}`. Preserve auth→request→approval→receipt→2,000-limit→parity precedence, closed failures, zero DML, receipt-ordinal `eligible`, and exact-`0064` `already-converted`. Shapes: `{ok,requestId,approvalId,applyReceiptId,ready,counts,rows}` and `{ordinal,eventId,disposition,outcome,taskId}`. Equations: `taskBacked=eligible+alreadyConverted;intentionalNoTask=invalidDateNoTask+excludedLeadNotOperational+excludedNonSelectedHistory;unresolvedManualReview=manualReviewUnassignedOwner+collisionManualReview;total=theirSum=approval.total_count`; readiness requires exact mappings and zero unresolved rows.

Admission uses `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=<lowercase-uuid>`. `tests/follow-up-task-local-cutover-admission.test.ts` uses only disposable `tests/helpers/postgres-runtime.ts`, creates/applies it as fixture Admin, then calls readiness. `ok=true`,`ready=true`, request match, and prerequisites atomically write `tmp/week-03-followups-to-tasks-cutover/local-admission.json`: `{schema:"follow-up-task-local-admission.v1",selectedRequestId,database:"disposable-postgres",readinessRpc:"read_follow_up_task_disposition_readiness",readinessResult,prerequisites:{futureWrite:true,activeReadIndex:true,contactAggregate:true,contact360Summary:true,contactOpportunityPage:true}}`; otherwise remove/fail. Unit 4 calls `assertLocalAdmission()` from `tests/helpers/follow-up-task-cutover-admission.ts` before dynamic imports. False/failed/unavailable/malformed/missing/mismatched evidence blocks cutover; remote readiness stays unknown.

`registerFollowUpTaskWrite` exposes `register_follow_up_action(text,uuid,text,text,text)→jsonb`, accepts `{requestId,leadId,noteBody,dueAt}`, returns `{ok,outcome,requestId,noteId,eventId,taskId,taskStatus,dueAt,replayed}`, and sets `eventId=requestId`. Preserve normalization/errors, authorization, request→lead→owner→Task locks, atomicity, status-preserving reschedule, occupancy failure, append-only events, and privileged purge. Payload: `{schema:"follow-up-write.v1",requestId,requestFingerprint,noteId,taskId,outcome,followUpAt:dueAt,hasNote:true}`; fingerprint is canonical UTF-8 SHA-256 of `['follow-up-write-request.v1',requestId,actorId,leadId,noteBody,dueAt]`.

Creation assigns all 14 fields: `owner_id=lockedLead.assigned_to;lead_id=request.leadId;quote_id=null;description="Follow up with lead";due_at=normalizedDueAt;status="pending";idempotency_key=sourceHash;task_kind="follow_up";source_event_id=requestId;source_event_type="follow_up_registered";source_event_created_at=event.created_at=transactionMicrosecond;source_due_at=normalizedDueAt;source_payload=exactEventPayload;metadata=follow_up_task.v1ExactMetadata`. Replay verifies fingerprint, event/note, and immutable `0064` provenance, ignoring mutable due/status/update fields. Changed input conflicts; drift fails integrity; replay never mutates.

Reads use visible live-lead `follow_up` Tasks in `pending|in_progress`, ordered `due_at,id`; counts are items, aliases minimum due. Events remain history/activity/search. Preserve exact `0049`/`0052` signatures, columns, defaults, validation, grants, invoker security, limits, and cursors.

## Serial Native Slices

Define `U(){ node --conditions react-server --import tsx --test "$@"; }`; DB commands set `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1`.

| Slice | Exact goal and concrete paths | Focused command / runtime disposition | Budget and independent rollback |
|---|---|---|---|
| 1a | `db/migrations/0068_follow_up_task_readiness_helpers.sql`; integrity helpers/test | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/follow-up-task-readiness-runtime.test.ts`; runtime corrupts approval/receipt and proves no DML. | ≤400. Revoke/drop `public.read_follow_up_task_disposition_readiness(text,uuid)` first; then drop `public.follow_up_task_readiness_rows(uuid)`, `public.follow_up_task_readiness_validate_receipt(uuid)`, `public.follow_up_task_readiness_validate_approval(uuid)`; remove only ordinal assembly/integrity reads. |
| 1b | `db/migrations/0069_follow_up_task_disposition_readiness_rpc.sql`; closed mapping/readiness | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/follow-up-task-readiness-runtime.test.ts`; runtime covers seven dispositions/blockers. | ≤400. Revoke/drop `read_follow_up_task_disposition_readiness(text,uuid)`. |
| 1c | `lib/admin/follow-up-task-disposition-readiness.ts`, `lib/supabase/database.types.ts`, `tests/follow-up-task-disposition-readiness.test.ts`; adapter | `U tests/follow-up-task-disposition-readiness.test.ts`. Runtime N/A: no independent process boundary; auth/client/shape mocks plus 1b RPC runtime substitute. | ≤400. Remove only adapter and type additions. |
| 2a | `db/migrations/0070_follow_up_task_future_write_helpers.sql`; three write helpers | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/follow-up-task-future-write-runtime.test.ts`; runtime proves deterministic, nonmutating helpers. | ≤400. Revert `registerFollowUpAction` and `registerFollowUpTaskWrite`; revoke/drop `public.register_follow_up_action(text,uuid,text,text,text)`; then drop `public.read_follow_up_write_replay(uuid,uuid,uuid,text,text)`, `public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text)`, `public.normalize_follow_up_write_due_at(text)`; remove only replay inspection/fingerprint/date normalization. |
| 2b | `db/migrations/0071_follow_up_task_future_write_rpc.sql`; atomic create/reschedule/replay | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/follow-up-task-future-write-runtime.test.ts tests/tasks-rls.test.ts tests/tasks-follow-up-representation.test.ts tests/tasks-foundation-contract.test.ts`; runtime covers concurrency/rollback. | ≤400. After 2d, revoke/drop RPC; retain committed rows. |
| 2c | `db/migrations/0072_lead_events_append_only.sql`, `tests/lead-events-append-only-runtime.test.ts`; ordinary append-only | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/lead-events-append-only-runtime.test.ts`; runtime denies update/delete and preserves privileged purge. | ≤400. Next migration restores prior policy. |
| 2d | `lib/admin/follow-up-task-future-write.ts`,`app/admin/(protected)/leads/[id]/actions.ts`,`app/admin/(protected)/leads/[id]/page.tsx`,`lib/supabase/database.types.ts`; atomic caller | `U tests/follow-up-task-future-write.test.ts tests/endpoint-protection.test.ts tests/crm-final-correctness.test.ts`. Runtime N/A: thin action adds no boundary beyond adapter/RPC; action-import evidence plus 2b runtime substitute. | ≤400. Revert page/action, adapter, then types. |
| 3a | `db/migrations/0073_follow_up_task_active_read_index.sql`, index/test | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/follow-up-task-read-index-runtime.test.ts`; runtime proves predicate/plan. | ≤400. Next migration drops only the index. |
| 3b | `db/migrations/0074_crm_contact_aggregate_follow_up_task_read.sql`; Task aggregate | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/crm-contact-aggregate-task-read-runtime.test.ts tests/crm-final-correctness.test.ts`; runtime proves counts/filter/history. | ≤400. Next migration restores exact `0049` definition. |
| 3c | `db/migrations/0075_crm_contact_360_summary_follow_up_task_read.sql`; Task summary | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/crm-contact-360-summary-task-read-runtime.test.ts`; runtime proves count/minimum/history. | ≤400. Next migration restores exact `0052` summary. |
| 3d | `db/migrations/0076_crm_contact_opportunity_follow_up_task_read.sql`; Task opportunity aliases | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/crm-contact-opportunity-task-read-runtime.test.ts`; runtime proves earliest/terminal/history behavior. | ≤400. Next migration restores exact `0052` page. |
| 4 gate | `tests/follow-up-task-local-cutover-admission.test.ts`,`tests/helpers/follow-up-task-cutover-admission.ts`; evidence only | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=<same-lowercase-uuid> RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 U tests/follow-up-task-local-cutover-admission.test.ts`; runtime proves selected request/prerequisites. | ≤400. Delete evidence; revert test/helper. |
| 4a | `lib/admin/dashboard.ts`, focused/admin-ops tests; paged Task queue | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=<same-lowercase-uuid> U tests/follow-up-task-dashboard-cutover.test.ts tests/admin-ops.test.ts`. Runtime N/A: pure projection; fake-client paging/order/error/no-event evidence plus gate/3a substitute. | ≤400. Revert Dashboard reader only. |
| 4b | `lib/admin/tasks.ts`, `lib/admin/leads.ts`; lead/Contact projections | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=<same-lowercase-uuid> U tests/follow-up-task-application-cutover.test.ts tests/lead-search.test.ts tests/contact-crm-ui.test.ts tests/crm-contact-360-rpc-contract.test.ts tests/tasks-runtime.test.ts`. Runtime N/A: adapters consume 0074–0076; fixture earliest/terminal/history evidence plus 3b–3d substitute. | ≤400. Revert Task/lead readers only. |

2d endpoint assertions preserve `registerFollowUpAction`, Admin/Asesor gating, and form fields. Replace positive direct-note-insert, `"follow_up_registered"`, and action-side `Number.isNaN(parsed.getTime())` assertions with `registerFollowUpTaskWrite({requestId,leadId,noteBody,dueAt})` plus negatives for all three. Adapter tests own normalization and exact RPC evidence.

Merged SQL rollback uses a new next-number migration. Never reopen history, delete committed rows, or compress proof.

## Threat Matrix and Boundary

N/A — no routing, shell, subprocess, VCS/PR automation, executable classification, or process-integration change; only the existing disposable helper is consumed. No SLA, general action audit, notifications, role-aware Mi día, remote work/claim, rollout, or Week 03 closure. Open questions: none.
