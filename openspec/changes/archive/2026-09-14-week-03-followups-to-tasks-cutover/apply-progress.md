# Apply Progress: Week 03 Follow-ups-to-Tasks Cutover

## Cumulative Status

| Slice | Task | Status | Boundary |
|---|---|---|---|
| 1a readiness helpers | 1.1 | Complete after canonical-header correction | Local helper migration and disposable runtime proof only |
| 1b disposition readiness RPC | 1.2 | Complete | Admin-only read boundary and disposable runtime proof only |
| 1c readiness adapter/types | 1.3 | Complete | Strict Admin-first adapter, manual RPC types, and mocked focused proof only |
| 2a future-write helpers | 2.1 | Complete | Three nonmutating helpers and disposable runtime proof only |
| 2b future-write RPC | 2.2 | Complete | Authenticated atomic write boundary and disposable runtime proof only |
| 2c lead-events append-only | 2.3 | Complete | Ordinary INSERT-only policy, preserved reads, and privileged disposable purge proof only |
| 2d future-write adapter/caller | 2.4 | Complete | Strict adapter, sole-RPC Server Action, stable form request ID, manual types, and mocked proof only |
| 3a active follow-up read index | 3.1 | Complete | One partial Task index and read-only disposable predicate/order/join/plan proof only |
| 3b contact aggregate Task read | 3.2 | Complete | Exact-compatible 0049 replacement and read-only disposable aggregate/RLS/history proof only |
| 3c Contact 360 summary Task read | 3.3 | Complete | Exact-compatible 0052 summary replacement and read-only disposable contract/RLS/history proof only |
| 3d Contact opportunity Task read | 3.4 | Complete | Exact-compatible 0052 opportunity-page replacement and read-only disposable contract/RLS/history proof only |
| 4-gate local cutover admission | 4.1 | Complete after deterministic-evidence correction | Exact selected-request disposable Admin/approval/apply/readiness evidence only |
| 4a Dashboard Task cutover | 4.2 | Complete | Admitted paged Task queue/count projection and fake-client proof only |
| 4b lead/Contact Task cutover | 4.3 | Complete | Admitted paged Task projections, compatible Contact aliases, and fixture proof only |

Tasks 1.1–4.3 are checked (14/14 complete, 0 pending). All prior histories are retained; independent SDD verification is next.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `tests/follow-up-task-readiness-runtime.test.ts` | Disposable PostgreSQL integration | N/A — both files were new | Exit 1: 0 pass, 2 fail, 0 skip because migration 0068 did not exist | Exit 0: 2 pass, 0 fail, 0 skip | Valid record, unknown request, corrupted receipt, and corrupted approval paths | No production refactor needed; final focused rerun remained green |
| 1.1 correction | `tests/follow-up-task-readiness-runtime.test.ts` | Disposable PostgreSQL integration | Exit 0: 2 pass, 0 fail, 0 skip before correction | Exit 1: 1 pass, 1 fail, 0 skip; coherent positions 6–9 tamper returned `t\|t\|3` instead of `f\|f\|0` | Exit 0: 2 pass, 0 fail, 0 skip after one-line production correction | Canonical valid record is accepted; self-consistent changed header and inconsistent hash records are rejected | No refactor needed; actual stored positions now participate in the archived header comparison |
| 1.2 | `tests/follow-up-task-readiness-runtime.test.ts` | Disposable PostgreSQL integration | Exit 0: 2 pass, 0 fail, 0 skip before 1b | Exit 1: 1 pass, 2 fail, 0 skip because migration 0069 did not exist | Exit 0: 3 pass, 0 fail, 0 skip after implementation and fixture corrections | Seven dispositions, blocked and ready outcomes, auth/request/approval/receipt/limit/parity precedence, ordered eligible IDs, and exact converted representation | Renamed the request UUID variable to remove PL/pgSQL ambiguity; final focused rerun remained green |
| 1.3 | `tests/follow-up-task-disposition-readiness.test.ts` | Unit with auth/client/RPC mocks | `npx tsc --noEmit` exit 0 before production edits; adapter/test were new | Exit 1: 0 pass, 1 fail because the adapter module did not exist | Exit 0: 6 pass, 0 fail after implementation and correction of an all-numeric uppercase test fixture | Added ready/blocked results, seven dispositions, closed errors, malformed shapes/accounting/order, and the default RPC path; final 7 pass | Narrowed validated counts into the public type and exercised the default typed RPC call; final focused rerun remained green |
| 2.1 | `tests/follow-up-task-future-write-runtime.test.ts` | Disposable PostgreSQL integration | N/A — migration and test were new | Exit 1: 0 pass, 2 fail, 0 skip because migration 0070 did not exist | Exit 0: 2 pass, 0 fail, 0 skip after implementation and SQL syntax correction | Null/offset/bound dates, fixed UTF-8 fingerprint, three outcomes, absent replay, changed-input conflicts, note drift, mutable Task fields, and immutable provenance drift | Replaced invalid schema-qualified SQL special syntax; final focused rerun remained green |
| 2.2 | `tests/follow-up-task-future-write-runtime.test.ts` | Disposable PostgreSQL integration | Exit 0: 2 pass, 0 fail, 0 skip before 2b | Exit 1: 2 pass, 2 fail, 0 skip because migration 0071 did not exist | Exit 0: 4 pass, 0 fail, 0 skip after implementation and two SQL corrections | Auth/actor/input/limit precedence, assigned-Asesor/Admin paths, history/create/reschedule, exact provenance, manual/foreign/multiple occupancy, terminal creation, same/different-request concurrency, delayed replay, and later-write rollback | Corrected the alphabetic uppercase UUID fixture and SQL special-form/variable ambiguity; final focused rerun remained green |
| 2.3 | `tests/lead-events-append-only-runtime.test.ts` | Disposable PostgreSQL integration | N/A — migration and test were new | After correcting a fixture-only contact prerequisite, exit 1: 0 pass, 2 fail, 0 skip because migration 0072 did not exist | Exit 0: 2 pass, 0 fail, 0 skip after policy implementation and harness corrections | Admin/assigned-Asesor SELECT+INSERT, operations SELECT-only, marketing denial, ordinary UPDATE/DELETE denial, unchanged payload, exact policy inventory, unrelated-policy identity, and owner-level test purge | Extracted session-output handling and exercised the intended privileged PostgreSQL purge path; no production refactor was needed and the final focused rerun remained green |
| 2.4 | `tests/follow-up-task-future-write.test.ts`, `tests/endpoint-protection.test.ts` | Unit plus source contract | Exit 0: 22 pass, 0 fail, 0 skip for existing endpoint/correctness tests | Exit 1: 21 pass, 2 fail, 0 skip because the adapter module did not exist | Exit 0: 27 pass, 0 fail, 0 skip after adapter/action/page/type implementation | RFC 3339 and form-date normalization, created/rescheduled/history-only results, exact input/RPC/failures, provider suppression, role gate, sole-RPC action, stable form UUID, and success-only revalidation | Corrected two source-regex expectations, added status-preserving replay triangulation, and confirmed the final focused rerun remained green |
| 3.1 | `tests/follow-up-task-read-index-runtime.test.ts` | Disposable PostgreSQL integration | N/A — migration and test were new | Exit 1: 0 pass, 2 fail, 0 skip because migration 0073 did not exist | Exit 0: 2 pass, 0 fail, 0 skip after the additive partial-index migration and rollback-comment correction | Pending/in-progress, manual/follow-up, null/live/archived/deleted lead, overdue-boundary, due-time tie, terminal, planner-index, no-sort, and before/after snapshot cases | No production refactor needed; the exact partial predicate and lead/due/id key order remained focused and the final rerun stayed green |
| 3.2 | `tests/crm-contact-aggregate-task-read-runtime.test.ts` | Disposable PostgreSQL integration plus source contract | N/A — migration and test were new | Exit 1: 0 pass, 2 fail, 0 skip because migration 0074 did not exist | Exit 0: 2 pass, 0 fail, 0 skip after one disposable-fixture SELECT-grant correction | Exact 0049 signature/defaults/return order/types/grants/invoker contract, Task-RLS actor differences, active/terminal/manual/live-lead cases, event disagreement/history, filters/order/pagination, limit clamp, and before/after data snapshot | No production refactor needed; final required two-file rerun passed 8 tests with zero skips |
| 3.3 | `tests/crm-contact-360-summary-task-read-runtime.test.ts` | Disposable PostgreSQL integration plus source contract | N/A — migration and test were new | Exit 1: 0 pass, 2 fail, 0 skip because migration 0075 did not exist | Exit 0: 2 pass, 0 fail, 0 skip after correcting fixture expectations for numeric display and operations-scoped lead visibility | Exact 0052 catalog/grants/null behavior, three Task-RLS actors, pending/in-progress, completed/canceled/manual/live-lead exclusions, event disagreement/history, every non-follow-up result field, and before/after data snapshot | No production refactor needed; the final triangulation rerun remained green with zero skips |
| 3.4 | `tests/crm-contact-opportunity-task-read-runtime.test.ts` | Disposable PostgreSQL integration plus source contract | N/A — migration and test were new | Exit 1: 0 pass, 2 fail, 0 skip because migration 0076 did not exist | Exit 0: 2 pass, 0 fail, 0 skip after correcting one source assertion to follow SQL clause order | Exact 0052 catalog/defaults/returns/grants/validation/cursor/state/limit contract, three Task-RLS actors, earliest active Task, terminal/manual/live-lead exclusions, overdue-event/future-Task disagreement, latest event history, all non-follow-up fields, order/pagination, and before/after data snapshot | No production refactor needed; final triangulation rerun remained green with zero skips |
| 4.1 | `tests/follow-up-task-local-cutover-admission.test.ts` | Disposable PostgreSQL integration plus synchronous evidence boundary | N/A — test and helper were new | Exit 1: 0 pass, 1 fail, 0 skip because the admission helper did not exist | Exit 0: 2 pass, 0 fail, 0 skip after implementing strict evidence validation and atomic write | Exact selected request, valid Admin approval/apply, ready RPC result, all five prerequisites, exact readback, plus false/failed/unavailable/malformed/mismatched fail-closed removal | No further refactor needed; final focused rerun remained green with zero skips |
| 4.2 | `tests/follow-up-task-dashboard-cutover.test.ts` | Unit with admission boundary and fake Supabase client | Existing `tests/admin-ops.test.ts`: exit 0; 10 passed, 0 failed, 0 skipped | Exit 1; 1 passed, 2 failed, 0 skipped because `fetchFollowUpTaskQueue` did not exist | Exit 0; 3 passed, 0 failed, 0 skipped after the Task reader implementation | Exact admission plus six invalid forms, 1,002 rows over two pages, one-lead duplicate work items, due/id order, overdue item count, exact predicate/live-lead filters, page-two failure, and no event fallback | No further production refactor needed; focused and combined reruns remained green |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-readiness-runtime.test.ts` → exit 0; 2 tests passed, 0 failed, 0 skipped, duration 84583.245527 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL changed plan positions 6–9 to `1,2,3,true`, recomputed canonical/hash/fingerprint values and receipt links, received `f\|f\|0`, and proved identical before/after state hashes around validation |
| Rollback boundary | Remove the later public RPC first if present, then the three helper functions in the dependency order below; no unrelated schema or data is removed |

### Slice 1b Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-readiness-runtime.test.ts` → exit 0; 3 tests passed, 0 failed, 0 skipped, duration 110192.670902 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved seven exact counts/outcomes, blocked and ready equations, canonical row order, receipt ordinality, exact eligible/already-converted Tasks, closed precedence/failures, deterministic repeated reads, exact keys, authenticated-only execution, provider-text exclusion, and identical state hashes around every RPC call |
| Rollback boundary | Revoke and drop only `public.read_follow_up_task_disposition_readiness(text,uuid)` before any later helper rollback; no data repair and no unrelated rollback |

### Slice 1c Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test tests/follow-up-task-disposition-readiness.test.ts` → exit 0; 7 tests passed, 0 failed, 0 skipped, duration 815.329914 ms |
| Runtime harness command/scenario and exact result | N/A — the adapter adds no independent process boundary; auth/client/RPC mocks plus the completed slice 1b disposable PostgreSQL runtime substitute prove the boundary |
| Rollback boundary | Delete `lib/admin/follow-up-task-disposition-readiness.ts` and `tests/follow-up-task-disposition-readiness.test.ts`, then remove only `read_follow_up_task_disposition_readiness` from `Database.public.Functions`; retain all prior manual additions and unrelated work |

### Slice 2a Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-future-write-runtime.test.ts` → exit 0; 2 tests passed, 0 failed, 0 skipped, duration 94965.485825 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved exact date normalization/bounds, fixed canonical UTF-8 fingerprints, created/rescheduled/history-only replay identities, changed-input conflicts, note/provenance integrity failures, mutable Task-field tolerance, absent replay, and identical before/after state hashes around helper calls |
| Rollback boundary | Remove later callers, then the public write RPC, then `read_follow_up_write_replay`, `follow_up_write_request_fingerprint`, and `normalize_follow_up_write_due_at`; this slice adds only those three helpers plus focused proof |

### Slice 2b Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-future-write-runtime.test.ts` → exit 0; 4 passed, 0 failed, 0 skipped; duration 197351.931802 ms |
| Runtime harness command/scenario and exact result | The required four-file disposable PostgreSQL command passed 13 tests, 0 failed, 0 skipped; duration 200668.611217 ms. It proved exact auth/errors/grants, atomic outcomes/provenance, status-preserving reschedule, replay/conflict, occupancy/terminal behavior, both concurrency modes, delayed replay, and rollback after Task failure. |
| Rollback boundary | After caller removal, revoke and drop only `public.register_follow_up_action(text,uuid,text,text,text)`; retain committed rows, 0070 helpers, and unrelated work. |

### Slice 2c Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/lead-events-append-only-runtime.test.ts` → exit 0; 2 passed, 0 failed, 0 skipped; duration 89554.597949 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved preserved Admin/assigned-Asesor SELECT+INSERT, operations read-only visibility, marketing denial, zero-row ordinary UPDATE/DELETE, immutable payload, exact SELECT+INSERT policy inventory, unchanged unrelated policies, and one privileged owner purge of marked test data. |
| Rollback boundary | Add a later migration that drops only `lead events insert scoped` and restores the exact prior `lead events write scoped` FOR ALL policy with both predicates `(public.is_admin() or public.is_assigned_lead(lead_id))`; retain rows and unrelated work. |

### Slice 2d Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test tests/follow-up-task-future-write.test.ts tests/endpoint-protection.test.ts tests/crm-final-correctness.test.ts` → exit 0; 27 passed, 0 failed, 0 skipped; duration 1073.253529 ms |
| Runtime harness command/scenario and exact result | N/A — the thin action/adapter adds no independent process boundary; auth/client/RPC mocks plus the completed slice 2b disposable RPC substitute (13 passed, 0 failed, 0 skipped) prove the boundary |
| Rollback boundary | Revert the lead page/action, delete the adapter and focused test while restoring only the changed endpoint assertions, then remove only the added `register_follow_up_action` manual type; retain RPC rows and unrelated work |

### Slice 3a Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-read-index-runtime.test.ts` → exit 0; 2 passed, 0 failed, 0 skipped; duration 87596.5499 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved the exact active follow-up predicate, live-lead join, terminal/manual/null/deleted/archived exclusion, `due_at ASC,id ASC`, equality-not-overdue, planner use of `tasks_active_follow_up_read_idx` without a Sort under `enable_seqscan=off`, and an unchanged before/after Tasks+leads snapshot. |
| Rollback boundary | After reverting later read consumers, add a later migration that drops only `public.tasks_active_follow_up_read_idx`; retain migration 0073, all rows, prior indexes, and unrelated work. |

### Slice 3b Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/crm-contact-aggregate-task-read-runtime.test.ts tests/crm-final-correctness.test.ts` → exit 0; 8 passed, 0 failed, 0 skipped; duration 89635.221306 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved exact 0049 catalog compatibility and grants, security-invoker Task-RLS filtering, item overdue counts/minimum due date, active/terminal/manual/live-lead behavior, overdue/quick-view/search/order/pagination/clamp behavior, event disagreement with event-derived activity, and an unchanged contacts/leads/Tasks/events snapshot. |
| Rollback boundary | Revert later readers first, then add a later migration restoring the exact immutable 0049 function definition; retain 0074, every row/history record, prior migrations/indexes, and unrelated work. |

### Slice 3c Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/crm-contact-360-summary-task-read-runtime.test.ts` → exit 0; 2 passed, 0 failed, 0 skipped; duration 89483.209493 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved exact 0052 catalog compatibility, grants, null-input behavior, security-invoker Task-RLS filtering for Admin/Asesor/Manager, active item counts/minimum date, completed/canceled/manual/archived/deleted exclusions, Task/event disagreement, event-derived activity, all non-follow-up fields, and an unchanged contacts/leads/Tasks/events snapshot. |
| Rollback boundary | Revert later readers first, then add a later migration restoring the exact immutable 0052 summary definition; retain 0075, every row/history record, prior migrations/indexes, and unrelated work. |

### Slice 3d Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/crm-contact-opportunity-task-read-runtime.test.ts` → exit 0; 2 passed, 0 failed, 0 skipped; duration 84454.902444 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL proved the exact 0052 opportunity-page catalog, grants, validation, paired cursors, state modes, 1–100 limits, order/pagination, RLS-visible earliest active Task and any-overdue aliases, terminal/manual/non-live exclusions, latest historical event creation, event disagreement, all non-follow-up fields, and an unchanged contacts/leads/Tasks/events snapshot. |
| Rollback boundary | Revert application readers first, then add a later migration restoring the exact immutable 0052 opportunity-page definition; retain 0076, every row/history record, prior migrations/indexes, and unrelated work. |

### Native Slice 4-gate Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-local-cutover-admission.test.ts` → exit 0; 2 passed, 0 failed, 0 skipped; duration 85921.346592 ms |
| Runtime harness command/scenario and exact result | Same command and result; disposable PostgreSQL applied migrations through 0076, created a valid Admin/owner/lead approval fixture for the selected request, applied one Task, received matching `ok=true,ready=true`, verified all five prerequisites, wrote atomically, read back exactly, and removed the container. |
| Rollback boundary | Remove `tmp/week-03-followups-to-tasks-cutover/local-admission.json`, then delete the admission helper and focused test; no database data is retained and no unrelated work is removed. |

## Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-readiness-runtime.test.ts` — exit 0; 3 passed, 0 failed, 0 skipped after 1b triangulation.
2. `npx tsc --noEmit` — exit 0; no output.
3. `git diff --check` — exit 0; no output.

### Slice 1c Verification

1. `node --conditions react-server --import tsx --test tests/follow-up-task-disposition-readiness.test.ts` — exit 0; 7 passed, 0 failed, 0 skipped; duration 815.329914 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 2a Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-future-write-runtime.test.ts` — exit 0; 2 passed, 0 failed, 0 skipped; duration 94965.485825 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `git diff --check` — exit 0; no output.

### Native Slice 2b Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-future-write-runtime.test.ts tests/tasks-rls.test.ts tests/tasks-follow-up-representation.test.ts tests/tasks-foundation-contract.test.ts` — exit 0; 13 passed, 0 failed, 0 skipped; duration 200668.611217 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 2c Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/lead-events-append-only-runtime.test.ts` — exit 0; 2 passed, 0 failed, 0 skipped; duration 89554.597949 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 2d Verification

1. `node --conditions react-server --import tsx --test tests/follow-up-task-future-write.test.ts tests/endpoint-protection.test.ts tests/crm-final-correctness.test.ts` — exit 0; 27 passed, 0 failed, 0 skipped; duration 1073.253529 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 3a Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-read-index-runtime.test.ts` — exit 0; 2 passed, 0 failed, 0 skipped; duration 87596.5499 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 3b Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/crm-contact-aggregate-task-read-runtime.test.ts tests/crm-final-correctness.test.ts` — exit 0; 8 passed, 0 failed, 0 skipped; duration 89635.221306 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 3c Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/crm-contact-360-summary-task-read-runtime.test.ts` — exit 0; 2 passed, 0 failed, 0 skipped; duration 89483.209493 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 3d Verification

1. `RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/crm-contact-opportunity-task-read-runtime.test.ts` — exit 0; 2 passed, 0 failed, 0 skipped; duration 84454.902444 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.

### Native Slice 4-gate Verification

1. `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-local-cutover-admission.test.ts` — exit 0; 2 passed, 0 failed, 0 skipped; duration 85921.346592 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.
5. Evidence readback SHA-256: `199260f3aa16fb8570aa3184d332df2b2e0a30ac23517c8738d17be53bad4343`.

## Exact Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0068_follow_up_task_readiness_helpers.sql` | 138 | 0 | 138 |
| `tests/follow-up-task-readiness-runtime.test.ts` | 140 | 0 | 140 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 61 | 0 | 61 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| **Total** | **340** | **1** | **341** |

Generated lines excluded: 0. Cumulative slice: 341 authored lines. Correction attempt delta: migration +1/-1, test +22/-0, apply progress +13/-12, tasks +0/-0; 36 additions + 13 deletions = 49 authored lines, below the 400-line attempt limit.

### Native Slice 1b Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0069_follow_up_task_disposition_readiness_rpc.sql` | 122 | 0 | 122 |
| `tests/follow-up-task-readiness-runtime.test.ts` | 137 | 27 | 164 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 39 | 9 | 48 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| **Slice 1b total** | **299** | **37** | **336** |

Generated lines excluded: 0. Cumulative 1a plus 1b accounting is 677 authored lines across two autonomous ≤400 slices.

### Native Slice 1c Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `lib/admin/follow-up-task-disposition-readiness.ts` | 96 | 0 | 96 |
| `tests/follow-up-task-disposition-readiness.test.ts` | 170 | 0 | 170 |
| `lib/supabase/database.types.ts` | 7 | 0 | 7 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 41 | 1 | 42 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| **Slice 1c total** | **315** | **2** | **317** |

Generated lines excluded: 0. Native slice 1c remains below its 400-authored-line cap and is autonomous from 1a/1b.

### Post-1c Gate Correction Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 59 | 7 | 66 |
| `docs/implementation/ACTIVE.md` | 10 | 8 | 18 |
| **Correction total** | **69** | **15** | **84** |

Generated lines excluded: 0. The documentation-only correction remains below the 400-authored-line cap and does not enlarge or alter the protected staged candidate.

### Native Slice 2a Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0070_follow_up_task_future_write_helpers.sql` | 135 | 0 | 135 |
| `tests/follow-up-task-future-write-runtime.test.ts` | 139 | 0 | 139 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 1 | 44 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| **Slice 2a total** | **318** | **2** | **320** |

Generated lines excluded: 0. Native slice 2a remains below its 400-authored-line cap and is autonomous from slices 1a–1c.

### Native Slice 2b Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0071_follow_up_task_future_write_rpc.sql` | 156 | 0 | 156 |
| `tests/follow-up-task-future-write-runtime.test.ts` | 114 | 0 | 114 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 1 | 44 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 4 | 4 | 8 |
| **Slice 2b total** | **318** | **6** | **324** |

Generated lines excluded: 0. Native slice 2b remains below its strict 400-authored-line cap and is autonomous from slices 1a–2a.

### Native Slice 2c Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0072_lead_events_append_only.sql` | 12 | 0 | 12 |
| `tests/lead-events-append-only-runtime.test.ts` | 88 | 0 | 88 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 44 | 1 | 45 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 4 | 4 | 8 |
| **Slice 2c total** | **149** | **6** | **155** |

Generated lines excluded: 0. Native slice 2c remains below its strict 400-authored-line cap and is autonomous from slices 1a–2b.

### Native Slice 2d Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `lib/admin/follow-up-task-future-write.ts` | 90 | 0 | 90 |
| `tests/follow-up-task-future-write.test.ts` | 91 | 0 | 91 |
| `app/admin/(protected)/leads/[id]/actions.ts` | 9 | 17 | 26 |
| `app/admin/(protected)/leads/[id]/page.tsx` | 2 | 0 | 2 |
| `lib/supabase/database.types.ts` | 10 | 0 | 10 |
| `tests/endpoint-protection.test.ts` | 9 | 4 | 13 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 48 | 1 | 49 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 3 | 3 | 6 |
| **Slice 2d total** | **263** | **26** | **289** |

Generated lines excluded: 0. Native slice 2d remains below its strict 400-authored-line cap and is autonomous from slices 1a–2c.

### Native Slice 3a Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0073_follow_up_task_active_read_index.sql` | 11 | 0 | 11 |
| `tests/follow-up-task-read-index-runtime.test.ts` | 86 | 0 | 86 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 1 | 44 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 4 | 4 | 8 |
| **Slice 3a total** | **145** | **6** | **151** |

Generated lines excluded: 0. Native slice 3a remains below its strict 400-authored-line cap and is autonomous from slices 1a–2d.

### Native Slice 3b Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0074_crm_contact_aggregate_follow_up_task_read.sql` | 127 | 0 | 127 |
| `tests/crm-contact-aggregate-task-read-runtime.test.ts` | 97 | 0 | 97 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 1 | 44 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 4 | 4 | 8 |
| **Slice 3b total** | **272** | **6** | **278** |

Generated lines excluded: 0. Native slice 3b remains below its strict 400-authored-line cap and is autonomous from slices 1a–3a.

### Native Slice 3c Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0075_crm_contact_360_summary_follow_up_task_read.sql` | 117 | 0 | 117 |
| `tests/crm-contact-360-summary-task-read-runtime.test.ts` | 80 | 0 | 80 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 1 | 44 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 4 | 4 | 8 |
| **Slice 3c total** | **245** | **6** | **251** |

Generated lines excluded: 0. Native slice 3c remains below its strict 400-authored-line cap and is autonomous from slices 1a–3b.

### Native Slice 3d Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `db/migrations/0076_crm_contact_opportunity_follow_up_task_read.sql` | 150 | 0 | 150 |
| `tests/crm-contact-opportunity-task-read-runtime.test.ts` | 103 | 0 | 103 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 1 | 44 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 4 | 4 | 8 |
| **Slice 3d total** | **301** | **6** | **307** |

Generated lines excluded: 0. Native slice 3d remains below its strict 400-authored-line cap and is autonomous from slices 1a–3c.

### Native Slice 4-gate Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `tests/follow-up-task-local-cutover-admission.test.ts` | 122 | 0 | 122 |
| `tests/helpers/follow-up-task-cutover-admission.ts` | 133 | 0 | 133 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 43 | 0 | 43 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 3 | 3 | 6 |
| **Native slice 4-gate total** | **302** | **4** | **306** |

Generated evidence excluded from authored review accounting: `tmp/week-03-followups-to-tasks-cutover/local-admission.json` has 42 lines and SHA-256 `199260f3aa16fb8570aa3184d332df2b2e0a30ac23517c8738d17be53bad4343`; it remains included in exact evidence identity. Native slice 4-gate is autonomous and must remain at or below 400 authored lines.

## Rollback Boundaries

### Native Slice 4-gate

1. Remove `tmp/week-03-followups-to-tasks-cutover/local-admission.json` first so no later reader can pass admission.
2. Delete `tests/helpers/follow-up-task-cutover-admission.ts`, then `tests/follow-up-task-local-cutover-admission.test.ts`.
3. Retain migrations through `0076`, all prior proof and rows, and unrelated work; the disposable fixture and container retain no database data.

### Slice 3d

1. Revert application readers before restoring this database definition.
2. Add a later migration that restores the exact immutable `0052` `crm_contact_opportunity_page` definition; never edit or delete `0076` or `0052`.
3. Retain every Task/event/contact/lead row, the active read index, all prior migrations, prior proof, and unrelated work.

### Slice 3c

1. Revert later application/read consumers before restoring this database definition.
2. Add a later migration that restores the exact immutable `0052` `crm_contact_360_summary` definition; never edit or delete `0075` or `0052`.
3. Retain every Task/event/contact/lead row, the active read index, all prior migrations, prior proof, and unrelated work.

### Slice 3b

1. Revert later application/read consumers before restoring this database definition.
2. Add a later migration that restores the exact immutable `0049` `crm_contact_aggregate_page` definition; never edit or delete `0074` or `0049`.
3. Retain every Task/event/contact/lead row, the active read index, all prior migrations, prior proof, and unrelated work.

### Slice 3a

1. Revert later Task-backed read definitions and application readers before removing their index dependency.
2. Add a later migration that drops only `public.tasks_active_follow_up_read_idx`; never edit or delete migration `0073`.
3. Retain all Task/lead rows, prior indexes, migrations through `0072`, prior proof, and unrelated work.

### Slice 2d

1. Revert only the stable request field and sole-RPC caller changes in the lead page/action.
2. Delete `lib/admin/follow-up-task-future-write.ts` and `tests/follow-up-task-future-write.test.ts`, and restore only the slice 2d endpoint assertions.
3. Remove only `register_follow_up_action` from `Database.public.Functions`.
4. Retain committed notes, events, Tasks, migrations through `0072`, prior proof, and unrelated work.

### Slice 2c

1. Add a later migration; never edit `0072` or any earlier migration.
2. Drop only `lead events insert scoped` on `public.lead_events`.
3. Restore exact policy `lead events write scoped` as `FOR ALL TO authenticated USING (public.is_admin() or public.is_assigned_lead(lead_id)) WITH CHECK (public.is_admin() or public.is_assigned_lead(lead_id))`.
4. Retain every event row, SELECT policy, prior migration, caller, and unrelated file.

### Slice 2b

1. Remove the future caller in slice 2d before rollback.
2. Revoke all execution and drop only `public.register_follow_up_action(text,uuid,text,text,text)`.
3. Retain committed notes, events, Tasks, the 0070 helpers, prior migrations, and unrelated work.

### Slice 2a

1. Revert later callers before removing their database dependencies.
2. Revoke and drop the later `public.register_follow_up_action(text,uuid,text,text,text)` RPC if present.
3. Drop `public.read_follow_up_write_replay(uuid,uuid,uuid,text,text)`.
4. Drop `public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text)`.
5. Drop `public.normalize_follow_up_write_due_at(text)`; retain all persisted rows and unrelated work.

### Slice 1c

1. Delete `lib/admin/follow-up-task-disposition-readiness.ts` and its focused test.
2. Remove only the `read_follow_up_task_disposition_readiness` Args/Returns entry added to `lib/supabase/database.types.ts`.
3. Retain every prior manual database type addition, migration, RPC, helper, row, and unrelated file.

### Slice 1b

1. Revoke all execution on `public.read_follow_up_task_disposition_readiness(text,uuid)`.
2. Drop only `public.read_follow_up_task_disposition_readiness(text,uuid)`.
3. Perform no data repair; retain 0068 helpers unless their later dependency-ordered rollback is separately required.

### Corrected Slice 1a Dependency Order

1. Revoke and drop later `public.read_follow_up_task_disposition_readiness(text,uuid)` first if it exists.
2. Drop `public.follow_up_task_readiness_rows(uuid)`.
3. Drop `public.follow_up_task_readiness_validate_receipt(uuid)`.
4. Drop `public.follow_up_task_readiness_validate_approval(uuid)`.

This slice still adds only the three helper functions. The correction changes one approval-validation expression, creates no public readiness RPC, and requires no data repair.

## Preservation Proof

SHA-256 values remained identical before and after 1b: `0049` `887c448a790627e8a3a6c77d2be5177fd879ddb97d9f96702ae6bc5593ee75d6`; `0052` `c75a2a6b38d554644981e0f51363654c9f139b27aea5625febe5e8d536b027a0`; `0061` `979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`; `0062` `0e2504acf26bebc9f507336dfd54370f5ced8659b364f10afef8e5847bb10eb6`; `0063` `615f35d7c3063920c380b455d0460f1aa7664999573bddedaf0de5bab9c6b894`; `0064` `feb523e233ff458ae99dfdb15b02ff418e0d07fcaaf0e4a1443b73da029bebf4`; `0065` `b68cfb0979c0335e703715a03e84f60837ca2ee4de737848804c95c7f2fd9f39`; `0066` `b24e255e401f61d6cf5727e6c0e44c4f8de9b6917b8280e4d38e1113524127f6`; `0067` `439f75207122418effdda8cab246853e06a164aa680d77eaef91f261e767cb6a`; `0068` `43683902b3de05f6e294315726071e4fbce6c1cf913d83ea944d489d3cc9ec3d`.

No approved-plan archive/canonical file, Week 01 planning file, OpenCode/Gentle-AI wrapper file, package state, Git index entry, remote, or remote database was changed by slice 1b.

Slice 1c preserved the same local-only boundary: migrations `0049`, `0052`, and `0061`–`0069` retained the listed hashes plus `0069` `5105a1a9930918aafc30103d5d9eba74ff6127ab7e62cbaf811c4b2f544b12b1`; archives, Week 01, package state, unrelated work, and the pre-existing staged candidate were not edited; no database or remote operation occurred. Its content-stable cached-diff SHA-256 was `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`; that value was incorrectly described here as the Git-index checksum. A later read-only checksum of the raw `.git/index` file observed `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495`. Both historical facts are retained because they measure different byte domains.

## Post-1c Artifact-routing Gate Correction

This automatic correction changes evidence and active-context routing only. It is not another implementation task, changes no checkbox, and leaves tasks 2.1–4.3 pending (11 tasks).

### Content-stable Staged Candidate Receipt

| Receipt component | Read-only command | Baseline before correction | Final readback |
|---|---|---|---|
| Path manifest | `git diff --cached --name-status` | 15 paths; exact manifest below | Same 15 paths in the same status/order |
| Object manifest | `GIT_OPTIONAL_LOCKS=0 git diff --cached --raw --no-abbrev -z \| sha256sum` | `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0` | `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0` |
| Staged content | `git diff --cached --binary \| sha256sum` | `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566` | `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566` |
| Raw index file, diagnostic only | `sha256sum "$(git rev-parse --git-path index)"` | `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` | `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` |

| Status | Staged path |
|---|---|
| A | `db/migrations/0066_follow_up_task_apply_receipt_foundation.sql` |
| A | `db/migrations/0067_follow_up_task_apply_rpc.sql` |
| M | `docs/DECISIONS.md` |
| M | `docs/PROGRESS.md` |
| M | `docs/implementation/ACTIVE.md` |
| A | `lib/admin/follow-up-task-approved-plan-apply.ts` |
| M | `lib/supabase/database.types.ts` |
| A | `openspec/changes/week-03-followup-task-approved-plan-apply/design.md` |
| A | `openspec/changes/week-03-followup-task-approved-plan-apply/exploration.md` |
| A | `openspec/changes/week-03-followup-task-approved-plan-apply/proposal.md` |
| A | `openspec/changes/week-03-followup-task-approved-plan-apply/specs/follow-up-task-approved-plan-apply/spec.md` |
| A | `tests/follow-up-task-approved-plan-apply-adapter.test.ts` |
| A | `tests/follow-up-task-approved-plan-apply-receipt.test.ts` |
| A | `tests/follow-up-task-approved-plan-apply-runtime.test.ts` |
| A | `tests/follow-up-task-approved-plan-apply-types.test.ts` |

The archived approved-plan apply progress and archive report identify `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566` as the protected candidate's cached-content diff receipt. The baseline content receipt above matches it exactly. The raw index-file checksum includes mutable index metadata such as the stat cache and is therefore diagnostic history, not candidate identity; its different `6beed1…` value does not establish a staged-content change. No staging or intentional index refresh was performed.
Final readback reproduced the baseline path manifest, object-manifest receipt, staged-content receipt, and raw diagnostic checksum exactly. The staged paths and content therefore did not change during this correction; neither documentation correction was staged, so the corrected working-tree bytes remain outside the protected candidate.

### Correction Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --cached --name-status` → exit 0, the same 15 paths in the same status/order; `git diff --cached --binary \| sha256sum` → exit 0, `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`; `git diff --check` → exit 0, no output; `npx tsc --noEmit` → exit 0, no output |
| Runtime harness command/scenario and exact result | N/A — this correction changes only Markdown evidence and context routing; no runtime boundary exists |
| Rollback boundary | Revert only this post-1c correction in `apply-progress.md` and the matching routing correction in `docs/implementation/ACTIVE.md`; retain all slice 1a–1c implementation, tests, task checkboxes, and unrelated state |

### Slice 2a Preservation Readback

Slice 2a retained the recorded `0049`, `0052`, and `0061`–`0069` SHA-256 values byte-for-byte; new `0070` is `401b70a47c452fb96db83a437be92dd55a6e0653cf4ee60308a76b4fe224f7b6`. The 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline exactly. Archives, Week 01, unrelated work, package state, callers, and remotes were untouched.

### Slice 2b Preservation Readback

Slice 2b retained the recorded `0049`, `0052`, and `0061`–`0070` SHA-256 values byte-for-byte; new `0071` is `bbf463220bbe225c3e589a494a2385295c51fccbd37b1acdf87e6897157bdd53`. The same 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline exactly. Archives, Week 01, unrelated work, package state, callers, and remotes were untouched.

### Slice 2c Preservation Readback

Slice 2c retained the recorded `0049`, `0052`, and `0061`–`0071` SHA-256 values byte-for-byte; new `0072` is `76fe05bacf16be7ea00b3d075bdb46e514b9d0d633ffa2d5189a7e1b4362ed9d`. The same 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline exactly. Archives, Week 01, future-write RPC/callers, unrelated work, package state, remotes, and remote databases were untouched.

### Slice 2d Preservation Readback

Slice 2d retained migrations `0049`, `0052`, and `0061`–`0072` byte-for-byte, including tail `0072` at `76fe05bacf16be7ea00b3d075bdb46e514b9d0d633ffa2d5189a7e1b4362ed9d`. The 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline. Archives, Week 01, unrelated work, package state, migrations, remotes, and remote databases were untouched.

### Slice 3a Preservation Readback

Slice 3a retained migrations `0049`, `0052`, and `0061`–`0072` byte-for-byte, including `0072` at `76fe05bacf16be7ea00b3d075bdb46e514b9d0d633ffa2d5189a7e1b4362ed9d`; new `0073` is `fef8635f028dd952d8310cfc7846f4d46c9449a1d15b7eaa4c71c7124c918bcb`. The protected 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline. Archives, Week 01, unrelated work, package state, prior indexes, remotes, and remote databases were untouched.

### Slice 3b Preservation Readback

Slice 3b retained migrations `0049`, `0052`, and `0061`–`0073` byte-for-byte, including immutable `0049` at `887c448a790627e8a3a6c77d2be5177fd879ddb97d9f96702ae6bc5593ee75d6` and `0073` at `fef8635f028dd952d8310cfc7846f4d46c9449a1d15b7eaa4c71c7124c918bcb`; new `0074` is `4f65dca985a5d7fa2a3727d07addd002aa1caf7618e759cc0110b4540546896f`. The protected 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline. Archives, Week 01, unrelated work, package state, prior indexes, remotes, and remote databases were untouched.

### Slice 3c Preservation Readback

Slice 3c retained migrations `0049`, `0052`, and `0061`–`0074` byte-for-byte, including immutable `0052` at `c75a2a6b38d554644981e0f51363654c9f139b27aea5625febe5e8d536b027a0` and `0074` at `4f65dca985a5d7fa2a3727d07addd002aa1caf7618e759cc0110b4540546896f`; new `0075` is `3893948d858913d513ae2a60e34e84dadbaca927449101a377ba544df8ad152a`. The protected 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline. Archives, Week 01, unrelated work, package state, prior indexes, remotes, and remote databases were untouched.

### Slice 3d Preservation Readback

Slice 3d retained migrations `0049`, `0052`, and `0061`–`0075` byte-for-byte, including immutable `0052` at `c75a2a6b38d554644981e0f51363654c9f139b27aea5625febe5e8d536b027a0` and `0075` at `3893948d858913d513ae2a60e34e84dadbaca927449101a377ba544df8ad152a`; new `0076` is `1ca1e45d6e5e4c6f952dffc8163b0784ea87b6b47db1a641fb90134ee8a6308b`. The protected 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline. Archives, Week 01, unrelated work, package state, prior indexes, remotes, and remote databases were untouched.

### Native Slice 4-gate Preservation Readback

Native slice 4-gate retained migrations `0049`, `0052`, and `0061`–`0076` byte-for-byte, including tail `0076` at `1ca1e45d6e5e4c6f952dffc8163b0784ea87b6b47db1a641fb90134ee8a6308b`. The protected 15-path staged manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` matched the baseline exactly. Archives, Week 01, application readers, unrelated work, package state, remotes, and remote databases were untouched; the disposable container was removed.

## Post-2a Active-routing Artifact Correction

This automatic artifact correction aligns `docs/implementation/ACTIVE.md` with the checked task ledger and cumulative evidence after native slice 2a. Tasks 1.1–2.1 are complete (4/14), 10 tasks remain, the next task is 2.2 / native slice 2b, and the local migration tail reaches `0070`. The cutover remains incomplete, and remote migration/schema state remains unknown.

### Atomic Routing Convention

Each future native slice must update `docs/implementation/ACTIVE.md` atomically with its task checkbox and cumulative apply-progress evidence. This convention keeps implementation routing coherent; it changes no product scope, delivery boundary, rollback boundary, or remote-state claim.

### Correction Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check` → exit 0; no output. `npx tsc --noEmit` → exit 0; no output. |
| Runtime harness command/scenario and exact result | N/A — this correction changes only Markdown routing/evidence and has no runtime boundary. |
| Rollback boundary | Revert only this section and the matching post-2a routing edits in `docs/implementation/ACTIVE.md`; retain all task checkboxes, implementation, tests, migrations, earlier evidence, and unrelated work. |

### Correction Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `docs/implementation/ACTIVE.md` | 6 | 4 | 10 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 34 | 0 | 34 |
| **Correction total** | **40** | **4** | **44** |

Generated lines excluded: 0. This documentation-only correction remains below the 400-authored-line cap and does not enlarge or alter any implementation slice.

### Correction Preservation Proof

The approved-plan archive link `../../openspec/changes/archive/2026-09-13-week-03-followup-task-approved-plan-apply/` and canonical capability link `../../openspec/specs/follow-up-task-approved-plan-apply/spec.md` remain unchanged in `docs/implementation/ACTIVE.md`. Its Required context, Known gates, and Not active yet scope boundaries are unchanged.

Only `docs/implementation/ACTIVE.md` and this cumulative traceability section were intentionally edited. No task checkbox, source, test, migration, package state, archive, canonical specification, Git stage, remote, or database was changed.

The staged manifest remains the same 15 paths in the same status/order, with object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` before and after this correction. No staging or intentional index refresh was performed.

## Delivery and Local-Only Boundary

Delivery remains `auto-chain` with `stacked-to-main`. This bounded work unit is native slice `1b-disposition-readiness-rpc`, starts from corrected 1a, and ends at the local Admin-only readiness RPC plus proof; no branch, commit, push, PR, remote access, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `1c-readiness-adapter-types` starts from completed 1b and ends at the strict local adapter, exact manual RPC type boundary, and focused mocked proof. It is an autonomous ≤400 stacked-to-main slice; no branch, staging, commit, push, PR, remote access, database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `2a-future-write-helpers` starts from completed 1c and ends at three deterministic nonmutating helpers plus disposable proof. Delivery remains `auto-chain` with `stacked-to-main`; no caller, public write RPC, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `2b-future-write-rpc` starts from completed 2a and ends at the local authenticated transactional RPC plus disposable proof. Delivery remains `auto-chain` with `stacked-to-main`; no caller, 0072 migration, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `2c-lead-events-append-only` starts from completed 2b and ends at exact ordinary INSERT-only authorization plus disposable append-only/purge proof. Delivery remains `auto-chain` with `stacked-to-main`; no caller, future migration, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `2d-future-write-adapter-cutover` starts from completed 2c and ends at the strict adapter, sole-RPC action, stable lowercase form request UUID, exact manual 0071 types, and focused mocked proof. Delivery remains `auto-chain` with `stacked-to-main`; no migration, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `3a-active-follow-up-read-index` starts from completed 2d and ends at one additive partial Task index plus disposable predicate/order/live-lead/plan proof. Delivery remains `auto-chain` with `stacked-to-main`; no read RPC, application reader, historical DML, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `3b-contact-aggregate-task-read` starts from completed 3a and ends at the exact-compatible Task-backed contact aggregate plus disposable RLS/count/filter/history proof. Delivery remains `auto-chain` with `stacked-to-main`; no application reader, 0052 replacement, historical DML, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `3c-contact-360-summary-task-read` starts from completed 3b and ends at the exact-compatible Task-backed Contact 360 summary plus disposable contract/RLS/count/minimum/history proof. Delivery remains `auto-chain` with `stacked-to-main`; no opportunity-page replacement, application reader, historical DML, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `3d-contact-opportunity-task-read` starts from completed 3c and ends at the exact-compatible Task-backed Contact opportunity page plus disposable contract/RLS/earliest/terminal/history proof. Delivery remains `auto-chain` with `stacked-to-main`; no application reader, historical DML, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

Native slice `4-gate-local-cutover-admission` starts from completed 3d and ends at exact selected-request local evidence plus a strict fail-closed assertion helper. Delivery remains `auto-chain` with `stacked-to-main`; no application reader, migration, persistent database data, branch, staging, commit, push, PR, remote access, remote database mutation, rollout, production-readiness claim, closure claim, or remote-state claim was made.

## Native Slice 4-gate Deterministic-evidence Correction

Task 4.1 remains complete and checked; tasks 4.2 and 4.3 remain pending. This correction supersedes only the prior post-process evidence lifecycle and generated evidence identity, while retaining all earlier implementation history.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 correction | `tests/follow-up-task-local-cutover-admission.test.ts` | Disposable PostgreSQL integration plus synchronous evidence boundary | Prior independent run: exit 0, 2 passed, 0 failed, 0 skipped, but generated IDs changed hash `199260…` to `0c0ced…` and a post-process read found the admission absent | Independent lifecycle evidence showed the focused verifier could finish without retained evidence; random approval, receipt, and Task IDs made clean-run bytes unstable | Two clean exact focused runs: each exit 0 with 1 passed, 0 failed, 0 skipped; final evidence retained with identical SHA-256 `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1` | Malformed, mismatched, `ready=false`, `ok=false`, and unavailable-prerequisite cases all remove evidence before the final valid runtime publication; every readiness identity is fixed | Consolidated ordering into one sequential test, moved final publication after disposable cleanup, and retained evidence only after exact readback and mode checks |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-local-cutover-admission.test.ts` → clean run 1: exit 0, 1 passed, 0 failed, 0 skipped, duration 88320.230596 ms; clean run 2: exit 0, 1 passed, 0 failed, 0 skipped, duration 88548.533202 ms |
| Runtime harness command/scenario and exact result | Same command and results; each run completed all invalid cases first, disposable PostgreSQL then approved/applied/read the selected request with deterministic approval/receipt/Task identities, cleanup completed, and one final valid publication remained; both final files hashed to `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1` |
| Rollback boundary | Remove `tmp/week-03-followups-to-tasks-cutover/local-admission.json`, revert only this test correction and this progress section; retain the admission helper, task 4.1 checkbox, migrations through 0076, and unrelated work |

### Verification and Evidence Identity

1. Focused command above — two clean runs, both exit 0 with 1 passed, 0 failed, 0 skipped.
2. `sha256sum tmp/week-03-followups-to-tasks-cutover/local-admission.json` — after each clean run, exit 0 with identical `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1`.
3. `npx tsc --noEmit` — exit 0; no output.
4. `npm run lint` — exit 0; ESLint completed with no findings.
5. `git diff --check` — exit 0; no output.

The retained 42-line JSON is mode `0600`, parses successfully, is bound to `03c07000-0000-4000-8000-000000000001`, has `ok=true`, `ready=true`, all five prerequisites `true`, and passes `assertLocalAdmission()`.

### Conservative Review-budget Accounting

The original and corrected focused test contain 122 and 144 lines respectively, so counting both files in full gives a 266-line upper bound. Including the two authored lines for the status replacement and all 36 appended progress lines produces a conservative 304-line work-unit bound even if every involved line is counted as changed, below the acquired 400-line cap. Generated local evidence is excluded from authored review lines but retained in exact evidence identity.

### Preservation

Only `tests/follow-up-task-local-cutover-admission.test.ts`, this cumulative progress artifact, and ignored local evidence were intentionally changed. `tests/helpers/follow-up-task-cutover-admission.ts`, tasks checkboxes, application readers, migrations, `docs/implementation/ACTIVE.md`, archives, package state, Git index/staging, remotes, and remote databases were not changed by this correction. Delivery remains the autonomous `auto-chain` / `stacked-to-main` 4-gate correction boundary; no branch, commit, push, or PR action occurred.

## 4-gate Deterministic-evidence Corrective Rerun

This is the one allowed clean corrective rerun acquired by the parent for the second attempt. It is bound exactly to failed evidence revision `sha256:1de5e4a026c10b69cfd5ec1a0b54f7f67cc1fbd749974a9844c3dd9f5a8b768b` and records a successful replacement without changing implementation scope.

### Result Contract

| Field | Result |
|---|---|
| Result | `success` |
| Attempt | Parent-acquired second corrective attempt; no local attempt acquisition was performed |
| Failed evidence revision | `sha256:1de5e4a026c10b69cfd5ec1a0b54f7f67cc1fbd749974a9844c3dd9f5a8b768b` |
| Final evidence revision | `sha256:931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1` |
| Task state | 12/14 complete; task 4.1 remains checked and tasks 4.2–4.3 remain pending |
| Next task | 4.2 / native slice 4a |
| Delivery boundary | `auto-chain` / `stacked-to-main`; evidence-only corrective rerun of native 4-gate |

### Corrective TDD Cycle Evidence

| Task | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 4.1 corrective rerun | Existing corrected test/helper and prior complete RED-first cycle retained | Bound failed evidence revision recorded that the required final evidence state was not accepted | Exact focused rerun exited 0 with 1 passed, 0 failed, 0 skipped | Exact SHA, TypeScript, lint, diff check, and normal final readback all passed; retained evidence has the selected request, `ok=true`, `ready=true`, and all five prerequisites true | None — no implementation defect was found and no source/test/helper change was needed |

### Corrective Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-local-cutover-admission.test.ts` → exit 0; 1 passed, 0 failed, 0 skipped; duration 88693.463753 ms |
| Runtime harness command/scenario and exact result | Same command and result; the existing test/helper rejected invalid states, completed the disposable PostgreSQL lifecycle, accepted the deterministic final publication, and left the mode-`0600` evidence present after process completion |
| Rollback boundary | Revert only this appended corrective-rerun section from `apply-progress.md`; the ignored generated evidence can be removed independently without reverting the corrected helper/test or any unrelated implementation |

### Required Check Results

1. Exact focused admission command — exit 0; 1 passed, 0 failed, 0 skipped; duration 88693.463753 ms.
2. `sha256sum tmp/week-03-followups-to-tasks-cutover/local-admission.json` — exit 0; `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1`.
3. `npx tsc --noEmit` — exit 0; no output.
4. `npm run lint` — exit 0; ESLint completed with no findings.
5. `git diff --check` — exit 0; no output.
6. Normal final readback — evidence remained present as 42-line JSON; selected request `03c07000-0000-4000-8000-000000000001`, `ok=true`, `ready=true`, and `futureWrite`, `activeReadIndex`, `contactAggregate`, `contact360Summary`, and `contactOpportunityPage` all equal `true`.

### Corrective Rerun Line Delta

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 54 | 0 | 54 |
| **Corrective rerun total** | **54** | **0** | **54** |

Generated evidence remains 42 lines and is excluded from authored review accounting but included in exact evidence identity. The corrective rerun remains below the native 400-authored-line budget.

### Preservation

Only this cumulative `apply-progress.md` artifact was intentionally authored during the rerun; the required command regenerated the ignored local evidence. The helper, focused test, source, migrations, tasks ledger, `docs/implementation/ACTIVE.md`, package state, Git index/staging, remotes, and remote databases were not edited.

The run used the exact project `work-unit-commits` and `chained-pr` skill paths before execution, remained sole-writer and non-delegated, and performed no attempt acquisition, install, stage, commit, push, PR, remote access, or remote database operation. Task state remains 12/14 with 4.2 next.

## Native Slice 4a Dashboard Task Cutover

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test tests/follow-up-task-dashboard-cutover.test.ts tests/admin-ops.test.ts` → exit 0; 13 passed, 0 failed, 0 skipped; duration 1178.940544 ms |
| Runtime harness command/scenario and exact result | N/A — Dashboard loading is a pure projection without an independent runtime boundary. The admitted fake-client proof exercises exact Task filters, live-lead inner join, 1,000-row paging to exhaustion, deterministic due/id order, duplicate work items for one lead, overdue item counting, page failure through the existing error channel, and zero `lead_events` fallback; native 4-gate evidence and slice 3a index runtime are substitutes. |
| Rollback boundary | Revert only the Task-backed follow-up reader in `lib/admin/dashboard.ts` and delete `tests/follow-up-task-dashboard-cutover.test.ts`; retain every non-follow-up Dashboard metric, admission evidence/helper, migration/index/read-contract receipt, and unrelated change. |

### Delivery Boundary

Native slice `4a-dashboard-task-cutover` starts from completed local admission task 4.1 and ends at the admitted paged Dashboard Task queue/count plus focused proof. Delivery remains `auto-chain` with `stacked-to-main` and a 400-authored-line cap. No branch, attempt acquisition, stage, commit, push, PR, install, remote access, database mutation, rollout, production-readiness claim, closure claim, or remote-state claim occurred.

### Verification

1. Exact focused two-file command — exit 0; 13 passed, 0 failed, 0 skipped; duration 1178.940544 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `git diff --check` — exit 0; no output.
5. Admission readback — mode `0600`, selected request matched, and SHA-256 remained `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1`.

### Exact Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `lib/admin/dashboard.ts` | 33 | 30 | 63 |
| `tests/follow-up-task-dashboard-cutover.test.ts` | 152 | 0 | 152 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 44 | 1 | 45 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 3 | 3 | 6 |
| **Native slice 4a total** | **233** | **35** | **268** |

Generated lines excluded: 0. Native slice 4a remains below the acquired 400-authored-line cap.

### Preservation

The exact admission evidence remains present at SHA-256 `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1`; its helper and local 4-gate proof were not edited. `tests/admin-ops.test.ts` remained read-only.
Migrations, including the 3a active-read index and tail `0076`, archives, Week 01, package state, unrelated work, and remote/local databases were not changed. The migration tail remains `0076`; this slice performs no DML.
The protected staged 15-path manifest/order, object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0`, staged-content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566`, and raw index checksum `6beed1e44e0a874b1e1faf7d20c1d8e412d252ebca0b2db8c53784267aa82495` remained unchanged. Task state is 13/14; only task 4.3 / native slice 4b remains pending.

## Native Slice 4b Lead and Contact Task Cutover

### Result Contract

| Field | Result |
|---|---|
| Result | `success` |
| Task state | 14/14 complete; 0 pending |
| Delivery boundary | Parent-acquired `4b-lead-contact-task-cutover`; `auto-chain` / `stacked-to-main`; 400-authored-line cap |
| Migration tail | `0076`; no migration or database mutation |
| Next action | Independent `sdd-verify`; no archive, remote, rollout, Week 03 closure, or production-readiness claim |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.3 | `tests/follow-up-task-application-cutover.test.ts` | Unit/source contract with admitted fake Supabase client | Existing listed regressions: exit 0; 30 passed, 0 failed, 0 skipped | Exit 1; 0 passed, 3 failed, 0 skipped because the Task projection/index reader did not exist and leads still used event-derived pending values | Exit 0; 3 passed, 0 failed, 0 skipped after Task reader and lead wiring | Earliest due/id, active statuses, terminal advance/clear, equality-not-overdue, live-lead exclusion, 1,001-row paging, page failure, related DTOs, Contact aliases, limits, and event history | Typed relation fixture correction only; focused rerun remained green |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test tests/follow-up-task-application-cutover.test.ts tests/lead-search.test.ts tests/contact-crm-ui.test.ts tests/crm-contact-360-rpc-contract.test.ts tests/tasks-runtime.test.ts` → exit 0; 33 passed, 0 failed, 0 skipped; duration 1237.260319 ms |
| Runtime harness command/scenario and exact result | N/A — this adapter projection adds no independent runtime boundary. Admitted fixtures prove Task-RLS-shaped queries, paging, ordering, terminal clearing, fail-closed errors, DTOs, aliases, limits, and retained event history; verified slice 3b–3d disposable SQL plus native 4-gate evidence are substitutes. |
| Rollback boundary | Revert the Task projection reader in `lib/admin/tasks.ts` and its lead wiring in `lib/admin/leads.ts`, then delete the focused test; revert application readers before restoring read contracts. Retain Tasks, events, migrations, aliases, admission evidence, and unrelated work. |

### Verification

1. Exact five-file test command — exit 0; 33 passed, 0 failed, 0 skipped; duration 1237.260319 ms.
2. `npx tsc --noEmit` — exit 0; no output.
3. `npm run lint` — exit 0; ESLint completed with no findings.
4. `npm run build` — exit 0; Next.js compiled, type-checked, and generated 96/96 static pages; build-only `next-env.d.ts` change was restored.
5. `git diff --check` — exit 0; no output.
6. Admission SHA-256 remained `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1`.

### Exact Changed-Line Accounting

| Path | Additions | Deletions | Authored Lines |
|---|---:|---:|---:|
| `lib/admin/tasks.ts` | 68 | 0 | 68 |
| `lib/admin/leads.ts` | 10 | 40 | 50 |
| `tests/follow-up-task-application-cutover.test.ts` | 124 | 0 | 124 |
| `openspec/changes/week-03-followups-to-tasks-cutover/apply-progress.md` | 58 | 1 | 59 |
| `openspec/changes/week-03-followups-to-tasks-cutover/tasks.md` | 1 | 1 | 2 |
| `docs/implementation/ACTIVE.md` | 3 | 3 | 6 |
| **Native slice 4b total** | **264** | **45** | **309** |

Generated lines excluded: 0. Native slice 4b remains below the acquired 400-authored-line cap.

### Preservation and Delivery

Task RLS and live-lead visibility are authoritative; no service-role, event-date fallback, hidden-work reconstruction, or cross-opportunity inference was added. Lead and Contact timelines, search, `lastActivityAt`, historical follow-up creation values, DTO names/nullability, and limits remain event/alias compatible.

Admission evidence remains mode `0600` at SHA-256 `931fe544fb857fc7b6ec262127cc56335ace1a846492a56aabf594f1a4116ce1`. Migrations through tail `0076`, archives, Week 01, local-only boundaries, package state, unrelated work, and the protected staged candidate were not intentionally changed. No attempt acquisition, delegation, branch, stage, commit, push, PR, install, remote access, or database mutation occurred.
The protected staged object receipt `967d204745fd2acdf3df4aab0062d8d9cc0d2f943f540b1f44298a3ed52d0ff0` and content receipt `4aef055335739335c746180c969d85b1a29dfc1c9da750b1b274543877ff3566` remained exact; restoring build-generated `next-env.d.ts` refreshed only raw index stat-cache metadata, whose diagnostic checksum is now `b7d592d3915895ef3da898072286a69dd03a2f97740ad169c8718adc4470c046`, without staging or candidate-content change.
