## Exploration: Week 03 follow-ups-to-Tasks cutover

### Current State

The local executable chain ends at `0067`. The archived approved-plan apply capability is complete locally at 23/23 tasks and 12/12 requirements/scenarios: an immutable approved plan creates only its ordered `eligible` Tasks and an append-only receipt atomically. The approval retains all seven canonical dispositions. This is local/disposable evidence only; current remote migration, schema, and data state is unknown.

Current behavior differs from the required cutover in three places:

| Boundary | Current behavior | Required behavior |
|---|---|---|
| Approved-plan accounting | Approval counts retain all seven dispositions, but the apply receipt proves only ordered eligible Task IDs/count. There is no explicit cutover-readiness result that accounts for Task-backed, intentional-no-Task, and unresolved rows without double counting. | A read-only parity gate must account for every row of an explicitly selected applied approval. `eligible` and `already-converted` rows must be Task-backed; intentional exclusions remain counted; unresolved manual-review/collision rows must be explicit and must not silently disappear. |
| Future follow-up write | `registerFollowUpAction` performs two application-side writes: a `lead_notes` insert followed by a `follow_up_registered` event insert. The operation is not atomic, has no request identity, does not create/update a Task, and ignores the event insert result. | One authenticated PostgreSQL transaction must validate the request/live lead, create the note and immutable event, and create or reschedule the operational follow-up Task idempotently. Retries must not duplicate rows or let an older retry overwrite a later schedule. |
| Pending-work reads | Dashboard reads all follow-up events and chooses the latest dated event per lead. Contact list and Contact 360 RPCs cast `payload.followUpAt`; lead detail performs another event-derived cross-opportunity projection. Terminal Task state cannot clear these projections. | Pending work must be `tasks.task_kind='follow_up' AND status IN ('pending','in_progress')`, ordered/projected by `tasks.due_at` under existing Task RLS. `lead_events` remains the activity/history source only. Completing or canceling a Task removes it from pending-work projections. |

The current schema supports the cutover but exposes important constraints:

- `tasks.source_event_id` is globally unique and immutable; follow-up provenance fields are immutable, while operational `due_at` and lifecycle status are separate mutable fields.
- Generic `create_task` creates only manual Tasks and derives one owner/context key. It cannot atomically write a note/event or create the 14-field follow-up representation, so it is not a valid future-write boundary.
- Task table DML is revoked; writes use `SECURITY DEFINER` RPCs. Existing Task visibility is Admin/all, owner/self, and Manager/non-Admin owner. The cutover should inherit this RLS rather than invent role-aware Mi día rules.
- Ordinary code only appends lead events, but the surviving `lead events write scoped` RLS policy is `FOR ALL`; database-enforced append-only behavior is therefore not currently complete. Existing privileged test-data purge must remain possible.
- The current contact RPC output names (`next_follow_up_at`, `latest_follow_up_at`, and `follow_up_overdue`) can remain compatibility aliases while their values become Task-derived. Activity timestamps and timelines must continue to use event history.

#### Capability boundaries

In scope:

1. Request-scoped disposition parity/readiness for one applied immutable approval.
2. Transactional, replay-safe future dated follow-up write through a dedicated RPC.
3. Task-backed pending-work projections for Dashboard, contact/lead list, lead detail, and Contact 360.
4. Exact manual Supabase types/adapters, local contract tests, and disposable PostgreSQL proof.
5. Ordinary-path append-only enforcement for `lead_events` if the proposal adopts the recommendation below; privileged test purge remains an explicit exception.

Out of scope: SLA calculations, automatic first-contact/quote-follow-up generation, general Task action audit/receipts, notifications, role-aware Mi día composition, remote reconciliation/application, production data execution, rollout, and Week 03 closure.

#### Data and idempotency invariants

- Migrations `0061`-`0067` and all archived/canonical artifacts remain immutable. New local migrations should be additive and tentatively start at `0068`.
- Parity is scoped by explicit approved-plan `requestId`; canonical row ordinal plus source event UUID is the row identity. Counts must reconcile exactly to the existing seven-value order and `total_count`, with each row in one and only one outcome bucket.
- For parity, ordered `eligible` rows map one-to-one to `follow_up_task_apply_receipts.task_ids`; `already-converted` rows resolve through the globally unique `tasks.source_event_id` and exact approved representation. The remaining five dispositions are retained accounting, not inferred from current Task occupancy.
- A future write should carry a caller-stable lowercase UUID `requestId`. Reuse it as the immutable event ID and record a bounded request fingerprint plus note/Task identity in that event payload; the event becomes the minimal replay record without adding a general action-audit table. The note may use a preallocated ID but is not itself an immutable receipt under the current schema.
- A newly created follow-up Task keeps the canonical key `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<requestId>")))`. Rescheduling an existing active follow-up Task keeps its original source identity, provenance, and idempotency key; only operational `due_at`/`updated_at` changes.
- Exact replay returns without mutation after matching the existing immutable request event fingerprint and recorded note/Task identity. Request-ID reuse with different actor, lead, note, due date, or Task outcome is a closed idempotency conflict. A delayed replay must never restore an older due date after a later request has rescheduled the Task.
- Lock order should be request advisory lock, live lead row, current owner/profile-role facts, then matching active Task rows by UUID. Different request IDs for the same lead serialize on the lead lock.
- Update only one exact active follow-up Task for the same live lead/current owner. A terminal prior follow-up permits a new Task. Multiple active matches, an active manual/foreign occupancy, owner/assignment drift, or malformed provenance fails closed; this slice must not adopt unrelated Tasks or rewrite immutable provenance.
- Pending-work reads include only follow-up Tasks in `pending` or `in_progress`; completed/canceled Tasks and all event payload dates are excluded. Lead/contact activity remains event-derived.

#### Local versus remote state

Local implementation may add migration files, adapters, application cutover code, and disposable tests through the new local migration tail. Local passing tests would prove PostgreSQL/RLS/transaction behavior only. It would not prove hosted PostgREST/Auth behavior or current production data parity.

Remote rollout remains blocked until a separately authorized read-only reconciliation confirms migration history and exact schema through the required new migrations, the intended approvals are applied, and the parity gate passes against remote data. No remote migration application, data repair, feature rollout, rollback, or production-readiness claim belongs to this change.

### Affected Areas

- `db/migrations/0062_tasks_foundation.sql`, `0064_follow_up_task_representation.sql`, `0066_follow_up_task_apply_receipt_foundation.sql`, `0067_follow_up_task_apply_rpc.sql` — immutable Task, provenance, receipt, and approved-apply contracts that new migrations must extend rather than edit.
- `db/migrations/0049_crm_contact_aggregate_filters.sql` and `0052_crm_contact_360_rpc_contracts.sql` — historical definitions to preserve; a new migration must `CREATE OR REPLACE` the same public read signatures with Task-derived pending work.
- Tentative `db/migrations/0068_follow_up_task_disposition_parity.sql` — read-only, Admin-gated request-scoped parity/readiness contract; no historical DML.
- Tentative `db/migrations/0069_follow_up_task_future_write.sql` — transactional note/event/Task write, request replay, live-context checks, narrow grants, and optional ordinary-path event append-only hardening; no backfill.
- Tentative `db/migrations/0070_follow_up_task_read_contracts.sql` — additive indexes if justified and replacement definitions for contact aggregate/Contact 360 pending-work projections; no data mutation.
- `app/admin/(protected)/leads/[id]/actions.ts` and `app/admin/(protected)/leads/[id]/page.tsx` — replace the two-call writer with the dedicated RPC and carry a stable request UUID; resolve the current optional-date product decision.
- `lib/admin/tasks.ts` — add exact pending-follow-up query/projection and future-write adapter contracts; generic manual Task APIs remain unchanged.
- `lib/admin/dashboard.ts` and `app/admin/(protected)/dashboard/page.tsx` — replace event queue construction with visible nonterminal follow-up Tasks while preserving current presentation and non-follow-up metrics.
- `lib/admin/leads.ts` — change lead-detail and latent lead-list pending-work indexes to Tasks; retain `lead_events` for search/timeline/activity metadata.
- `lib/admin/contacts.ts` and `app/admin/(protected)/contacts/[id]/page.tsx` — preserve stable DTO/UI shapes while consuming Task-derived RPC values; activity remains event-derived.
- `lib/supabase/database.types.ts` — add exact new RPC boundaries and preserve existing table/RPC shapes unless a new field is deliberately specified.
- `tests/admin-ops.test.ts`, `tests/lead-search.test.ts`, `tests/contact-crm-ui.test.ts`, `tests/crm-final-correctness.test.ts`, `tests/crm-contact-360-rpc-contract.test.ts`, and `tests/tasks-*.test.ts` — replace event-pending assertions, preserve timeline/history assertions, and add transactional/parity/read-cutover evidence.
- New focused parity, future-write adapter/runtime, and read-cutover runtime tests — prove exact accounting, replay/concurrency/rollback, RLS, and end-to-end Task-only pending projections in disposable PostgreSQL.

### Approaches

1. **Parity gate, transactional future-write RPC, then Task-only read cutover** — add three dependency-ordered database capabilities and switch application readers only after the compatibility read contracts exist.
   - Pros: preserves one transaction for note/event/Task; uses existing Task provenance/RLS; makes every approved outcome explicit; supports safe expand → validate → cutover ordering; each rollback unit is independent.
   - Cons: requires exact parity and replay schemas, several strict SQL contracts, and coordinated adapter/type changes.
   - Effort: High

2. **Server Action orchestration with dual-read compatibility** — let the action insert note/event and call Task APIs separately; let readers merge event dates and Tasks during transition.
   - Pros: less SQL initially and superficially smaller application changes.
   - Cons: cannot make three writes atomic; retries can duplicate or reorder effects; dual-read precedence can double count and keeps event payloads operational; rollback and parity become ambiguous.
   - Effort: Medium initially, High operational risk

3. **Immediate Task read switch with no formal parity or future-write transaction** — change Dashboard/CRM queries after the historical apply.
   - Pros: smallest visible cutover.
   - Cons: new writes are immediately lost from pending-work views, manual-review/collision outcomes disappear silently, and partial note/event writes remain possible. This does not satisfy the Week 03 dependency gate.
   - Effort: Low, unacceptable correctness risk

### Recommendation

Use Approach 1 in this order:

1. **Disposition parity/readiness.** Add a read-only Admin boundary for an explicit applied `requestId`. Revalidate approval/receipt identity and immutable counts, map eligible ordinals to receipt Task IDs, resolve `already-converted` by exact source representation, and return closed counts for `taskBacked`, `intentionalNoTask`, and `unresolvedManualReview`. Treat `manual-review/unassigned-owner` and `collision/manual-review` as readiness blockers by default; invalid-date, non-operational lead, and non-selected history remain explicitly accounted non-Task outcomes. Do not mutate or “correct” rows in this slice.
2. **Future-write conversion.** Add one `SECURITY DEFINER` RPC accepting request ID, lead ID, bounded note body, and canonical due timestamp/null. Authenticate Admin or assigned Asesor independently, lock live context, and atomically create the note, append an exact-ID event carrying the bounded replay fingerprint/result identity, and create/reschedule the Task. Keep provenance immutable, preserve status on reschedule, create a new Task only after terminal history, and return a strict replay-safe result. Replace `registerFollowUpAction`; never loop through `create_task`.
3. **Read contracts.** In a new migration, replace the existing contact aggregate and Contact 360 function definitions without changing signatures. Derive counts/next due/overdue from visible nonterminal follow-up Tasks joined to live leads/contacts. Preserve all event-based activity CTEs and timelines. Add only query-plan-justified indexes, likely a partial Task index over `(lead_id,due_at,id)` for `task_kind='follow_up' AND status IN ('pending','in_progress')`.
4. **Application cutover.** Query the same Task predicate for Dashboard and lead detail, use earliest due work per lead where a compatibility scalar is required, and count work items where the UI exposes counts. Continue displaying historical follow-up events only in activity timelines. Keep current RPC/DTO field names as compatibility aliases unless proposal validation proves a rename is required.

Ordinary staff writes to `lead_events` should become append-only in the future-write migration by replacing the surviving `FOR ALL` policy with INSERT-only authorization while retaining SELECT policy and privileged test-data purge behavior. This makes “immutable history” enforceable rather than merely conventional.

#### Test strategy

- **Parity unit/contract:** all seven dispositions, mixed plans, exact count order/total, eligible receipt ordinality, exact already-converted match, missing/malformed approval or receipt, duplicate source/ordinal, unresolved blockers, zero DML, and no cross-request double count.
- **Future-write adapter/action:** auth before client, strict request/date/body normalization, exact RPC args/results, provider text suppression, stable hidden request ID, revalidation only after successful RPC.
- **Future-write disposable runtime:** create, active reschedule, preserved provenance/key/status, terminal-then-create, exact replay, conflicting replay, concurrent same/different request IDs, stale owner/lead, manual/multiple occupancy, second-write failure rollback, note/event/Task cardinality, RLS/grants, event UPDATE/DELETE denial, and privileged purge preservation.
- **Read-cutover SQL/runtime:** contact aggregate filters/quick views, Contact 360 summary/opportunity page, Dashboard/lead detail fixtures, earliest due ordering, overdue boundary, terminal exclusion, Task RLS visibility, deleted/archived lead exclusion, event payload disagreement proving Tasks win, and unchanged event activity/history.
- **Preservation:** exact hashes/diffs for `0061`-`0067`, migration-order and rollback proof in disposable PostgreSQL, manual type contracts, existing Task lifecycle/RLS suites, lint/type/build only in later apply/verify phases, and zero remote access.

#### Rollback units

1. Drop the parity RPC/adapter/types/tests; no data rollback.
2. Revert the action to its prior writer only after removing the application dependency, restore the prior event policy if hardened, and drop the future-write RPC. Never delete Tasks, notes, or events created by successful transactions.
3. Restore the prior `0049`/`0052` function definitions with `CREATE OR REPLACE` and remove only new read indexes after the application reader is rolled back. Do not edit historical migration files.
4. Revert Dashboard/lead Task adapters and UI-compatible DTO changes. Roll back in reverse dependency order: application reads → SQL read contracts → future writer → parity.

#### Review workload forecast

The total forecast is approximately **2,400-3,200 authored additions plus deletions**, so automatic slicing is required. Use serial stacked-to-main work units after the approved-plan apply baseline is cleanly integrated:

| Work unit | Estimated changed lines | Review boundary |
|---|---:|---|
| 1. Parity RPC, adapter/types, focused proof | 500-750 | Maintainer-authorized `size:exception`; cap 1,200 |
| 2. Future-write RPC, action/form, types, transactional proof | 750-1,050 | Maintainer-authorized `size:exception`; cap 1,200 |
| 3. Task-backed CRM read contracts and disposable proof | 650-950 | Maintainer-authorized `size:exception`; cap 1,200 |
| 4. Dashboard/lead/Contact application cutover and regressions | 450-700 | Maintainer-authorized `size:exception`; cap 1,200 |

Each unit includes its own tests and rollback evidence and should remain independently reviewable in about 60 minutes. If any honest unit exceeds 1,200 lines, perform one automatic work-unit split; stricter native caps govern. Do not compress code/tests/docs to meet the budget.

Decision needed before apply: No for slicing; the maintainer already authorized 401-1,200-line exceptions and automatic slicing above 1,200.

Chained PRs recommended: Yes

400-line budget risk: High

### Risks

- **Parity population ambiguity:** multiple approvals can overlap the same source events. Global accounting is unsafe without an explicit selected request or ordered manifest; never sum all approval rows implicitly.
- **Manual-review invisibility:** switching reads while unassigned/collision rows remain unresolved can hide previously visible pending dates. Default readiness should block on those categories.
- **Stale replay:** a retry of an older future-write request could overwrite a later due date unless existing request identity returns without Task mutation.
- **Provenance drift:** rescheduling must not rewrite source event identity/payload/metadata or source-namespaced idempotency.
- **Occupancy ambiguity:** generic/manual or multiple active Tasks must not be silently adopted as the canonical follow-up Task.
- **Authorization drift:** Task RLS visibility differs from event visibility, notably for Manager versus operaciones/finanzas. This cutover must inherit Task authorization and avoid adding Mi día-specific role policy.
- **SQL compatibility:** replacing long-lived RPC definitions can break generated/manual return contracts or filters even when output names are unchanged; exact contract and runtime coverage is required.
- **Dirty baseline:** unrelated OpenCode/Gentle-AI changes and stale Week 01 planning are present locally. Future work units must isolate only this change and preserve the existing index/worktree state.
- **Remote uncertainty:** local parity code and disposable fixtures do not establish production migration or data parity. Remote reconciliation and rollout remain separate and blocked.

### Ready for Proposal

Yes. No source-backed external research is needed before proposal; the required behavior is governed by current repository contracts and PostgreSQL/Supabase patterns already proven locally.

The proposal must explicitly resolve these product decisions before specification:

1. Whether a missing next-contact date remains a successful history-only action (recommended for compatibility and alignment with `invalid-date/no-task`) or becomes invalid after cutover.
2. Whether unresolved unassigned-owner/collision rows block cutover readiness (recommended) or can proceed under an explicit operational sign-off.
3. Whether parity is limited to one explicitly selected applied request (recommended for this bounded change) or must accept an explicit ordered multi-request manifest.
4. Whether rescheduling an `in_progress` Task preserves that status (recommended for this cutover) or completes/replaces it; the latter crosses into the deferred Task-action lifecycle/audit scope.

The orchestrator should tell the user that proposal/design can proceed locally with four automatically sliced work units, but implementation must not imply remote parity or rollout and must not begin SLA, automation, Mi día, notifications, or final Week 03 closure.
