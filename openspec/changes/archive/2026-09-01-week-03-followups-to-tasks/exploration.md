## Exploration: week-03-followups-to-tasks

### Current State

The repository has a local Tasks foundation in `0062_tasks_foundation.sql`, plus local
`0061_manager_capability_foundation.sql` and `0063_staff_notifications_foundation.sql`.
The linked read-only inventory supplied for this phase ends at
`0060_quote_pdf_creation_cutover`; `tasks`, `staff_notifications`, and the Manager role are
not present remotely. Consequently, a follow-up migration cannot be treated as a standalone
remote migration or as production-ready. The prerequisite local sequence is `0061` → `0062`
→ `0063` → the follow-up migration, subject to a fresh remote reconciliation and separately
authorized rollout.

The existing CRM records follow-up intent in `lead_events` with event type
`follow_up_registered` and JSON `payload.followUpAt`. `registerFollowUpAction` first writes an
internal `lead_notes` row, then appends the event; the date is optional. CRM aggregates and
Contact 360 currently reconstruct the latest follow-up per lead from event history, excluding
deleted/archived leads. The dashboard and lead detail still expose this event-derived behavior.
`lead_events` is cascading history under a lead and has no pending-work lifecycle.

The current Tasks representation is deliberately small: one required `owner_id`, exactly one
lead or quote context at creation, required description/due date, four statuses, and a
deterministic `(owner_id, idempotency_key)` key. Creation currently derives one key per owner
and context (`tasks:v1|owner=...|lead=...`), so it is suitable for one canonical migrated
follow-up per owner/lead, but not for multiple historical or recurring follow-ups. Context FKs
are `ON DELETE SET NULL`; creation rejects missing/deleted context, while historical rows may
remain readable after deletion. RLS is read-only at the table boundary and delegates ownership
to the shared task helper: owner, Admin, and Manager rules must remain unchanged.

The local generated types include `tasks` and `staff_notifications`, but they describe only the
local candidate schema. They do not prove remote application. Existing tests prove the Tasks
contract, canonicalization, replay/conflict behavior, lifecycle, RLS, and preservation of CRM
follow-up contracts; they do not yet prove a follow-up backfill or event-to-task compatibility
read.

### Affected Areas

- `db/migrations/0061_manager_capability_foundation.sql` — prerequisite local role vocabulary;
  remote absence means its application must be reconciled before any dependent rollout.
- `db/migrations/0062_tasks_foundation.sql` — existing target table, ownership/RLS, lifecycle,
  idempotency, and deletion semantics that the representation must extend without weakening.
- `db/migrations/0063_staff_notifications_foundation.sql` — ordering prerequisite because it
  depends on `tasks`; notification creation remains out of scope for this change.
- `db/migrations/0049_crm_contact_aggregate_filters.sql` and
  `db/migrations/0052_crm_contact_360_rpc_contracts.sql` — current event-derived pending
  follow-up projections; a later compatibility read/cutover must replace only the pending-work
  source while preserving historical event/activity output.
- `app/admin/(protected)/leads/[id]/actions.ts` — current write path couples a note and
  `follow_up_registered` event; automation and UI changes are explicitly excluded, so this
  action should not be silently rewritten in the first slice.
- `lib/admin/tasks.ts` and `lib/supabase/database.types.ts` — existing adapter and local schema
  contracts; any new source/type fields require additive, exact generated-type treatment.
- `tests/tasks-foundation-contract.test.ts`, `tests/tasks-rls.test.ts`,
  `tests/tasks-runtime.test.ts`, and existing CRM tests — regression and new migration/backfill
  contract coverage, including idempotence, ownership, ambiguous rows, and history retention.
- `openspec/changes/archive/2026-08-31-week-02-tasks-foundation/*` — authoritative local Tasks
  scope and known limitations; it explicitly excluded follow-up conversion and backfill.

### Approaches

1. **Additive source-linked backfill with compatibility read** — add a nullable source event
   reference (unique where present) and an explicit follow-up task classification or equivalent
   stable metadata; backfill only the latest valid dated follow-up for each eligible,
   assigned, non-deleted/non-archived lead; make the operation deterministic and rerunnable;
   retain `lead_events`/`lead_notes` as immutable history. Keep the existing event projection
   during expand/backfill, then switch pending-work reads only after validation in a separately
   bounded cutover.
   - Pros: preserves provenance, makes retries safe, prevents duplicate conversion, permits
     reconciliation of ambiguous/unassigned rows, and follows expand → backfill → dual-read →
     validate → cutover.
   - Cons: requires a schema extension and a carefully defined compatibility period; the first
     migration cannot claim that all existing CRM screens already use Tasks.
   - Effort: Medium

2. **Direct one-shot insert into the existing Tasks shape** — insert one generic task per latest
   follow-up using the assigned advisor as owner and the existing owner/context idempotency key,
   without source linkage or a compatibility layer.
   - Pros: smallest SQL change and reuses the existing foundation unchanged.
   - Cons: loses direct event provenance, collides with any pre-existing task for the same
     owner/lead, cannot classify or safely retry changed source events, cannot represent
     unassigned/ambiguous follow-ups, and makes rollback/cutover auditing difficult.
   - Effort: Low initially, High risk

3. **Rewrite CRM projections immediately to read Tasks** — create/backfill tasks and change the
   Contact 360/dashboard aggregate queries in the same change.
   - Pros: visible end-to-end behavior immediately reflects the new pending-work source.
   - Cons: expands the review surface into CRM projection compatibility, risks regressions in
     existing event-derived tests, and bundles a cutover before remote migration parity is
     established.
   - Effort: High

### Recommendation

Choose Approach 1, limited to the follow-up representation and migration/backfill contract.
The first independently reviewable slice should establish an additive, provenance-preserving
mapping from the latest valid `follow_up_registered` event to one first-class Task, with a
stable source identity and deterministic rerun behavior. It should explicitly classify rather
than invent owners for unassigned leads, skip deleted/archived leads, preserve optional/malformed
dates as history without creating due work, and surface collisions or conflicting source rows
for review instead of overwriting Tasks. A generic description may summarize the follow-up, but
the source event remains the audit/history authority.

Do not alter automation, SLA calculations/projections, staff notifications, Mi día/UI, or the
existing action in this slice. Keep the current event-derived reads as the compatibility path
until a later change validates parity and performs the narrow cutover. New migration numbering
must be allocated only after reconciling the supplied remote `0060` baseline: the executable
dependency order is `0061`, `0062`, `0063`, then the new follow-up migration, not the new
migration alone. No remote application, allocation, or service mutation is authorized here.

The implementation proposal should require fresh disposable-shadow verification from the exact
`0060` baseline (or an explicitly approved equivalent), migration order checks, deterministic
backfill/re-run tests, source-link uniqueness, assignment and ambiguity handling, RLS/security
regression checks, preservation of event/note history, and a rollback boundary limited to the
new follow-up artifacts. It should not assume that local generated types or archived evidence
establish remote parity.

### Risks

- Applying the new migration remotely before `0061`–`0063` would fail or create an untracked
  partial foundation; remote history must be checked and the full dependency sequence separately
  authorized.
- The current Tasks idempotency key is one-per-owner/lead and omits source-event identity;
  reusing it blindly can conflate a migrated follow-up with a manually created task or a later
  follow-up.
- `owner_id` is required, but legacy follow-ups can be unassigned; assigning them to an arbitrary
  staff member would violate ownership and audit integrity. They need a review classification.
- Legacy event payloads may be absent, malformed, null, or contain multiple follow-up events;
  only a deterministic latest-valid rule should create pending work.
- Changing CRM aggregates in the migration could make old event-history tests and screens appear
  correct while silently changing semantics; compatibility reads and parity checks should precede
  cutover.
- Existing Tasks context FKs intentionally allow historical rows to survive parent deletion;
  any source linkage must preserve that history/rollback invariant and must not add destructive
  cleanup.
- Local type definitions and archived disposable-shadow receipts cannot be used as evidence that
  the linked project has `0061+`; production readiness remains unclaimed.

### Ready for Proposal

Yes. Authorize a single, migration-focused follow-up representation slice using an additive
source-linked, deterministic backfill with explicit ambiguity reporting and compatibility reads.
The proposal must make the `0060` remote baseline and `0061`–`0063` dependency order a hard
precondition, keep all automation/SLA/notifications/Mi día/UI work out of scope, and prohibit
remote mutation during exploration and implementation planning until its own rollout gate is
approved.
