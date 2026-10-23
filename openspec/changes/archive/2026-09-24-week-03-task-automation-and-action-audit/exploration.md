## Exploration: Week 03 Task automation and action audit

### Current State

**Evidence boundary.** This exploration used the working tree at `50c82a05d5516320f514be43714e032484ac6eda`, including the locally archived cutover and uncommitted `0068`–`0076` artifacts. Remote migration, schema, and data state remains unknown. CodeGraph was unavailable because the repository has no project index, and the request permits no write other than this artifact, so investigation used narrow file reads and searches. External research is **not needed**: the remaining gaps are AC Travel product-policy decisions and later authorized remote reconciliation, not questions requiring third-party sources.

| Area | Current behavior through `0076` | Required behavior |
|---|---|---|
| Task representation | `tasks.task_kind` is only `manual|follow_up`. `0064` requires exact immutable event provenance for `follow_up`; manual Tasks have no provenance. | Add native `first_contact` and `quote_follow_up` kinds with bounded, immutable automation provenance that does not weaken the canonical `follow_up` representation. |
| Due/overdue | Active follow-up readers already use `due_at ASC,id ASC`; `due_at < referenceTime` is overdue and equality is not. Terminal Tasks are excluded. | Reuse that exact projection rule for automated Tasks. Derive UTC-microsecond `due_at` deterministically from an immutable source occurrence and rule version; do not persist a mutable overdue flag. |
| Generation | `create_task` creates manual Tasks; approved apply and `register_follow_up_action` create/reschedule only canonical `follow_up` Tasks. No SLA automation exists. | Generate at most one Task per admitted source occurrence, with source-namespaced SHA-256 idempotency and serialization shared by event-driven and reconciliation paths. |
| Cancellation | Only human `task_transition` can cancel, and no source event cancels Tasks automatically. | Cancel only the specifically linked active automated Task, record the cancellation durably, and never cancel manual or canonical historical-follow-up Tasks by broad lead/owner matching. |
| Lifecycle idempotency | `task_transition(task,status)` has no request identity or receipt. It rejects every same-target call as `PT006/TASK_INVALID_TRANSITION`, including a retry after an uncertain success. | Introduce request-scoped action receipts. Exact retries replay; a new authorized request already at the same target returns an audited no-op; incompatible terminal transitions still fail. |
| Action audit | A lifecycle transition updates only `tasks.status` and `updated_at`. There is no durable actor, previous status, outcome, or result receipt. | Persist append-only, purge-independent actor/action/from/to/outcome/result history for every accepted human lifecycle action and automated cancellation. |
| Authorization | `task_actor_can_manage` requires an active actor: owner manages own; Admin manages all; Manager manages active non-Admin-owned Tasks; Admin-owned Tasks are Admin-only. Task RLS uses the same helper. No direct Task DML is granted. | Preserve this matrix exactly in adapter, RPC, receipt visibility, and concurrency paths. Do not substitute UI visibility, broad role checks, or service-role access for Task authorization. |
| History/cutover | Pending work is Task-backed; `lead_events` and `quote_events` remain append-only history. Missing follow-up dates are history-only; selected-request readiness, zero duplicates, and `in_progress` preservation are canonical. | Add automation/audit without rewriting events, adopting occupied Tasks, changing follow-up read signatures, or modifying migrations `0049`, `0052`, or `0061`–`0076`. |
| App/UI | `lib/admin/tasks.ts` exposes unused `createTask`, `transitionTask`, and `listTasks`. No production caller or Task action UI exists. Dashboard shows read-only `follow_up` items only. | Ship a strict server-only action adapter, but keep Dashboard/Mi día queues and role-aware UI unchanged. Generated native automation Tasks become UI-consumable only in the later Mi día change. |

**SLA and source-event map.**

| Rule | Exact authoritative statement | Current executable source | Gap before specification |
|---|---|---|---|
| First contact | A new lead during business hours targets first response within 15 minutes; the technical blueprint says a new assigned Opportunity creates the Task. | Assigned leads can originate from direct/RPC inserts. Later assignment is a direct `leads` update followed by a separate, unchecked `assigned` event insert. | Business calendar/time zone, due anchor (`lead.created_at` versus assignment), out-of-hours handling, reassignment behavior, and the event that proves first contact are unspecified. |
| Quote follow-up | First transition to sent creates follow-up at `sent_at + 48 hours`; cancel on response, acceptance, or payment. | `crm_mark_quote_sent` is already transactionally idempotent, sets `quote_versions.sent_at`, and emits actual event type `quote_sent` through append-only `quote_events`/`lead_events`. Acceptance emits `quote_accepted`. | “Response” is not a closed event set. `whatsapp_inbound_received` exists but is opportunity-level; phone/email/manual response does not. Payment writes are direct and statuses are `pending|received|verified|rejected|refunded`; the qualifying status and quote scope are unspecified. |
| Initial quote | Business guidance says 24–48 hours depending on complexity. | No exact complexity policy or dedicated Task source exists. | This is not deterministic enough and is not one of the two Week 03 automation rules; keep it out of scope. |

`quote_rejected`, `quote_expired`, `quote_cancelled`, and `quote_superseded` also make a sent-version follow-up non-actionable, but the active brief does not explicitly classify all of them as cancellation events. That set needs an explicit product decision rather than inference.

**Recommended action contract.** The public boundary should accept exactly `{requestId,taskId,targetStatus}` with canonical lowercase UUIDs and `targetStatus` limited to `in_progress|completed|canceled`. The closed action mapping is `in_progress → start`, `completed → complete`, and `canceled → cancel`; there is no transition action back to `pending`. A successful human receipt should expose exact request/receipt/task/actor identity, action, previous/target status, `outcome=applied|already_at_target`, original result timestamp, and `replayed`.

- Authentication and input validation happen before client/data access; the RPC independently checks the expected active actor.
- The RPC locks request identity before receipt lookup, then locks the Task. Missing and unauthorized Tasks retain the existing non-disclosing `TASK_FORBIDDEN` behavior.
- Exact request fingerprint replay returns the immutable original receipt with `replayed=true` and no mutation, even if a later valid action advanced the Task.
- Reusing a request ID with another actor, Task, or target returns `TASK_ACTION_IDEMPOTENCY_CONFLICT`.
- A different authorized request for the current status writes one `already_at_target` receipt without touching the Task. A terminal Task targeted to a different status remains `TASK_INVALID_TRANSITION` with no receipt/DML.
- Concurrent identical requests converge to one action receipt. Concurrent distinct same-target requests serialize on Task ID: one applies and the other records `already_at_target`.
- Accepted automated cancellation uses the same internal action writer and lock order, with a source identity and `actor_kind=automation`; its closed outcomes are `applied|already_at_target|not_applicable_terminal`, and replay is one receipt, never a second status mutation.

### Affected Areas

- `db/migrations/0062_tasks_foundation.sql` — immutable reference for lifecycle, SQLSTATE mapping, grants, and exact owner/Admin/Manager authorization.
- `db/migrations/0064_follow_up_task_representation.sql` — immutable reference; a new migration must widen kinds without weakening exact `follow_up` checks.
- `db/migrations/0066_follow_up_task_apply_receipt_foundation.sql` — receipt/append-only/RLS precedent; it remains unchanged.
- `db/migrations/0070_follow_up_task_future_write_helpers.sql` and `0071_follow_up_task_future_write_rpc.sql` — replay, lock, owner-context, and `in_progress`-preservation precedents; unchanged.
- `db/migrations/0072_lead_events_append_only.sql` and `0073`–`0076` — history and read-contract invariants; unchanged.
- `db/migrations/0077_*` onward — additive action audit, action RPC, automation provenance/projector, and source-trigger sequence.
- `lib/admin/tasks.ts` or a focused `lib/admin/task-actions.ts` — strict request/result adapter; legacy unaudited transition use must be cut off.
- `lib/supabase/database.types.ts` — exact additive receipt/origin/RPC types.
- `app/admin/(protected)/leads/[id]/actions.ts` and `leads/new/actions.ts` — current non-atomic assignment/intake source facts; first-contact integration must not weaken current Admin/advisor authorization.
- `app/admin/(protected)/quotes/actions.ts` — existing idempotent sent/accept boundaries and revalidation; DB-side automation should avoid a second app-side write.
- `app/admin/(protected)/operations/actions.ts` — current payment source is direct DML; qualifying cancellation must be database-enforced across all write paths.
- `lib/admin/dashboard.ts` and `app/admin/(protected)/dashboard/page.tsx` — read-only context and explicit non-target; no role-aware queue or new action UI in this change.
- `tests/tasks-*.test.ts`, cutover Task-read tests, and new focused action/automation contract, runtime, RLS, adapter, and concurrency tests — preservation and behavior proof.

### Approaches

1. **Database source projectors plus immutable ledgers** — Source-table/event triggers call one internal projector/action writer; a bounded explicit reconciler may call the same helpers after separate admission.
   - Pros: Atomic with canonical source mutations, covers direct/RPC/app paths, strongest zero-duplicate and audit guarantees, no scheduler dependency, preserves RLS as authority.
   - Cons: Trigger ordering and lock discipline are complex; first-contact assignment and cancellation policy must be closed first; pre-`0077` reconciliation needs separate admission.
   - Effort: High

2. **Explicit periodic reconciler only** — A scheduled/admin process projects all source facts and converges Tasks.
   - Pros: Naturally rerunnable and suitable for existing rows; source policy is centralized.
   - Cons: Work can be absent or stale between runs, requires an operational scheduler not present in scope, weakens atomic source/action receipts, and complicates race handling.
   - Effort: Medium

3. **Application action orchestration** — Existing Server Actions create/cancel Tasks after lead, quote, response, or payment writes.
   - Pros: Smallest initial SQL change and familiar TypeScript flow.
   - Cons: Existing assignment/payment paths are non-transactional, alternate writers bypass automation, retries can duplicate or miss work, and authorization/audit decisions drift across boundaries.
   - Effort: Medium, but unacceptable reliability risk

### Recommendation

Use **Approach 1**. Keep source mutation, Task mutation, immutable automation origin, and action receipt in one database transaction whenever the canonical source event is written. Use source-specific origin identity rather than owner/lead occupancy, and use one canonical helper/lock order for trigger and optional reconciliation calls. Do not use existing `source_event_id` for non-follow-up provenance; preserve its exact `0064` meaning by storing automation origin separately.

**Proposed model and sequence from `0077`:**

1. `0077_task_action_audit_foundation.sql` — append-only `task_action_receipts`, canonical request/result fingerprint, actor and owner snapshots, action/from/to/outcome/source fields, direct-write revocation, forced RLS, and exact receipt visibility through `task_actor_can_manage(owner_id)`.
2. `0078_task_action_rpc.sql` — strict request-ID lifecycle RPC and internal action writer; auth → request → replay → Task/authorization → transition precedence; request then Task lock order; revoke authenticated execution of legacy unaudited `task_transition` only after the new adapter boundary exists. Leave its historical migration/function body untouched.
3. `0079_task_automation_foundation.sql` — widen `task_kind` only to `manual|follow_up|first_contact|quote_follow_up`; preserve exact `0064` validation; add immutable `task_automation_origins`, source-namespace uniqueness, due-rule version, deferred Task/origin parity, and deterministic generation/projector helpers.
4. `0080_task_automation_sources.sql` — narrowly attach admitted first-contact and quote-sent generation plus approved cancellation sources. Source invalidation must cancel by origin identity through the audited action helper, never by broad lead ownership.

**Task identity/provenance.** `first_contact` and `quote_follow_up` Tasks remain `pending` on creation. Their SHA-256 keys use a new `task-automation:v1` namespace and immutable source-occurrence identity; the origin table is globally unique on the closed source tuple and one-to-one with its Task. Quote follow-up can safely anchor to the first persisted `quote_sent` event/quote-version occurrence. First-contact cannot be finalized until the product chooses one-per-opportunity versus one-per-assignment semantics; per-assignment semantics requires a durable assignment request/event identity rather than the current best-effort event write.

**App/adapters.** Add a server-only adapter that calls `requireAdminRole()` without inventing a narrower role list, authenticates before client creation, passes expected actor identity, strictly decodes exact RPC keys/UUIDs/enums, maps only closed domain codes, and converts malformed/provider results to adapter-only `PERSISTENCE_FAILURE`. Keep the existing Dashboard, lead projections, and role queues unchanged. Existing lead/quote/payment actions should rely on admitted database source hooks and retain their current path revalidation; no second Task write should be added in TypeScript.

**Verification plan.** Tests must stay with each work unit and include:

- pure fixed-time due/overdue vectors, UTC normalization, equality-not-overdue, and stable `due_at,id` ordering;
- static migration checks for closed kinds, immutable origin/receipt data, exact grants, no legacy-migration edits, and no event UPDATE/DELETE;
- disposable PostgreSQL generation/replay/concurrency tests proving one source occurrence → one Task/origin and no adoption of manual or canonical `follow_up` Tasks;
- exact owner/Admin/Manager/Admin-owned/inactive/unknown action authorization at RPC and receipt RLS boundaries;
- same-request replay, altered-request conflict, new-request same-target audited no-op, delayed replay after later transition, terminal mismatch, and concurrent identical/distinct actions;
- quote sent `+48h` and each approved cancellation source, including races with human completion; first-contact business-calendar vectors after policy is fixed;
- strict adapter shape/provider-failure tests and regressions showing current Task-backed CRM reads/history remain unchanged and the current Dashboard does not become Mi día.

**Rollback.** Before any persisted local test data, reverse `0080` → `0077` by removing callers/triggers and grants first. After any admitted rows exist, rollback is forward-only: disable source triggers and revoke new action execution, restore a compatible app boundary, but retain Tasks, origins, and action receipts; never delete receipts, automated Tasks, `lead_events`, or `quote_events`, and never rewrite terminal status. Any read/index rollback uses a later additive migration. No rollback or proof may contact the remote project.

**Native review forecast.** 400-line budget risk: **High**. Chained PRs recommended: **Yes**. Decision needed before apply: **No for slicing** because the maintainer authorized auto-splitting and aggregate exception up to 1,200 authored changed lines; unresolved product policy still blocks proposal/spec completion. Use four dependency-ordered stacked-to-main work units: (1) action ledger, 240–290 lines; (2) action RPC/adapter, 260–310; (3) automation origin/generation, 270–330; (4) source cancellation/integration, 230–270. Target aggregate is 1,000–1,200, and every native slice is capped at 400 additions plus deletions including its tests/types/docs. After one honest sizing pass, split at the action-audit/automation seam rather than compressing code or tests if either limit cannot be met.

**Unresolved product decisions:**

1. AC Travel business-hours time zone, weekly schedule, holidays, and daylight-saving policy.
2. Whether first-contact due time anchors to lead creation, first assignment, or the later of those; and how out-of-hours arrivals roll forward.
3. Whether first-contact is once per Opportunity or once per assignment, and what reassignment/unassignment/archive/terminal transitions do to its Task.
4. Which durable event proves first contact and whether it completes or cancels the Task; the current internal note/follow-up events are not proof of an external response.
5. The closed “customer response” event set and cancellation scope when an inbound response is opportunity-level but several quote versions/quotes exist.
6. Which payment state (`received` or only `verified`) and relationship (`accepted_quote_version_id`, quote, or lead) cancels a quote follow-up.
7. Whether rejection, expiry, cancellation, and supersession are additional mandatory quote-follow-up cancellation sources.
8. Whether an unassigned/inactive/invalid-role owner blocks the source business action or records an unresolved automation outcome for later reconciliation.
9. Whether completion/cancellation requires a bounded reason/outcome category or text beyond the target status.
10. Whether exact receipt replay by the original active actor remains readable after later role changes, and which terminal outcome wins in a human-complete versus automated-cancel race.
11. Whether eligible pre-`0077` assigned Opportunities/sent quotes require a separately approved preview/apply bootstrap or automation is future-source-only.

### Risks

- An unspecified business calendar makes first-contact due times non-deterministic and therefore blocks an exact SLA specification.
- Triggering from current `assigned` history is unsafe because assignment and event insertion are separate and the helper ignores event insert errors.
- Broad response/payment matching could cancel the wrong quote/version Task when one Opportunity has multiple commercial records.
- Leaving authenticated access to legacy `task_transition` would preserve an unaudited bypass; revoking it before adapter cutover would break callers.
- Trigger lock order can deadlock with quote, lead, payment, follow-up-write, or action RPC locks unless one global source → Task → receipt order is specified and tested.
- Automation Tasks will not be operationally visible in the current Dashboard because role-aware Mi día is deliberately excluded; this phase must not claim rollout readiness.
- Existing working-tree migrations `0068`–`0076` are local/untracked artifacts and remote state is unknown, so `0077` allocation is local planning only.

### Ready for Proposal

**No.** The architecture and bounded migration route are clear, external research is unnecessary, and native slicing is pre-authorized, but the orchestrator should tell the user that the eleven product decisions above—especially the business calendar, first-contact anchor/occurrence semantics, and closed response/payment cancellation set—must be resolved before an exact proposal/spec can be approved. Scope must continue to exclude role-aware Mi día UI/queues, notifications, remote rollout, historical event rewriting, and final Week 03 closure.
