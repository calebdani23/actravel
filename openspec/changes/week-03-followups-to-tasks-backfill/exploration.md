## Exploration: week-03-followups-to-tasks-backfill

### Current State
The additive follow-up representation now exists locally in `0064` and is designed for one immutable
source event, bounded provenance, and a globally unique `source_event_id`. It does not classify or
insert historical Tasks. The local dependency chain is `0061` → `0062` → `0063` → `0064`, while the
read-only remote fact remains that the linked project ended at `0060` on 2026-09-01. Local `0061`–`0064`
therefore remain unapplied remotely; this exploration authorizes no remote inspection beyond that fact
and no mutation.

CRM currently writes a `lead_notes` row and then a `lead_events` row with event type
`follow_up_registered` and payload `{ followUpAt, hasNote }`. Existing dashboard and lead-list reads
derive the latest follow-up from event history. `lead_events` is history, not a lifecycle queue, and
the current write/read paths must remain unchanged during this successor. Tasks require an owner,
exactly one live lead or quote context at creation, a UTC due instant, and a bounded owner/context
idempotency key; their context foreign keys may later be nulled by deletion while immutable follow-up
provenance survives.

The prior design-gate learning is material: classifier, preview/approval, atomic Task DML, audit
ledger, cancellation, and parity in one slice makes the review boundary ambiguous. The safest next
step is consequently a deterministic, read-only classification and preview plan. It advances the
backfill by proving the population and decisions without creating operational Tasks or silently
changing CRM behavior.

### Affected Areas
- `openspec/specs/follow-up-task-representation/spec.md` — supplies the already-available target representation and immutable provenance contract.
- `openspec/specs/tasks-foundation/spec.md` — supplies owner, UTC date, idempotency, lifecycle, RLS, deletion, and local-only migration invariants.
- `db/migrations/0064_follow_up_task_representation.sql` — target schema; no new migration or DML is needed for the preview-only slice.
- `app/admin/(protected)/leads/[id]/actions.ts` — current source write contract; do not rewrite it.
- `lib/admin/dashboard.ts`, `lib/admin/leads.ts` — current event-derived compatibility reads; retain them unchanged.
- `lib/admin/tasks.ts` and `tests/tasks-*` — existing Task adapter/security contracts that execution must consume without weakening.
- `openspec/changes/archive/2026-09-01-week-03-followups-to-tasks/*` — archived representation packet and evidence; historical context only, not current remote proof.

### Approaches
1. **Deterministic classification and preview plan only** — read a fixed source snapshot, classify every relevant event into an explicit disposition, and emit a canonical row-level plan plus hash. Do not approve, insert, update, cancel, create a ledger table, cut over reads, or execute remote/local migration work in this slice.
   - Pros: smallest independently reviewable boundary; proves source population, date/owner rules, ambiguity handling, collision inventory, and expected zero DML; supports a separately authorized executor and repeatable review.
   - Cons: no Tasks are visible yet; the plan format and later executor contract must be kept stable; parity and cancellation remain future work.
   - Effort: Medium

2. **Combined preview plus execution** — classify, obtain approval, and atomically insert source-linked Tasks (with audit/ledger evidence) in one change.
   - Pros: delivers converted pending work sooner and can make approval bind directly to a plan hash.
   - Cons: combines policy decisions, privileged DML, concurrency, rollback/cancellation, audit retention, and compatibility validation; a bad classification becomes production data and the review surface is too broad.
   - Effort: High

3. **Direct migration backfill** — use a migration to select historical events and insert Tasks directly.
   - Pros: superficially compact and transactional.
   - Cons: cannot safely represent unassigned or ambiguous rows, risks owner/context idempotency collisions, couples schema rollout to historical data mutation, has weak human review, and is incompatible with the explicit zero-historical-DML and remote-parity gates around `0061`–`0064`.
   - Effort: Low initially, High risk

### Recommendation
Choose Approach 1: a read-only deterministic classification/preview plan, with no Task DML. Define
the execution contract now, but leave approval, ledger persistence, Task insertion, cancellation,
rollback of converted rows, parity, and CRM cutover to separately named successor changes.

The source population should include `follow_up_registered` events under non-deleted, non-archived
leads. For each lead, select the latest valid dated follow-up deterministically by
`created_at DESC, id DESC`; retain all other events in the plan as non-selected history. A missing,
null, malformed, or timezone-ambiguous `followUpAt` is classified as `invalid-date/no-task`, not
invented as due work. A date-only value may be accepted only under an explicit contract as UTC
midnight; timezone-bearing values normalize to a UTC instant at microsecond precision. The plan must
record the original value and normalized value (or rejection reason), never depend on server local
timezone, and preserve the event timestamp separately from the due timestamp.

An eligible candidate requires a live lead and an existing active assigned profile. Unassigned,
unknown, inactive, or otherwise non-authoritative owners are `manual-review/unassigned-owner`; never
assign a default owner. Deleted or archived leads are `excluded/lead-not-operational`, preserving
history but creating no work. Quote context is not inferred. The proposed representation is a
follow-up Task linked to the lead, with source event type `follow_up_registered`, source timestamps
and bounded payload snapshot, and immutable metadata matching `follow_up_task.v1`.

The future executor must derive idempotency from source identity (for example a bounded SHA-256 key
over a versioned `source_event_id` namespace), not reuse the existing owner/lead key: that key can
collide with a manual Task and cannot represent multiple historical follow-ups. The preview must
report an already-linked source as `already-converted` only when its immutable fields agree. Any
duplicate source, mismatched existing Task, owner/lead-key collision, changed source payload, or
conflicting candidate is `collision/manual-review`; no overwrite or merge is permitted. Provenance
must snapshot the source event and remain useful after lead/event purge without becoming a second
operational source.

Review evidence should include the input snapshot boundary, canonical rule/version, row-level
disposition and reason, candidate counts, owner/date normalization, collision details, bounded
provenance previews, plan hash, and an explicit expected Task DML count of zero. An independent
reviewer must be able to recompute the hash and verify that every source row is accounted for.
Approval of that plan must be a separate authorization artifact; it must not itself execute work.

The plan reader must run server-side through an authorized read path, preserve existing RLS and
least-privilege boundaries, avoid exposing unnecessary payload/PII, and never use service-role
authority as a reason to bypass review. Capture a repeatable-read snapshot (or immutable cutoff by
`created_at,id`); events arriving after the cutoff are deferred to a later plan. A future executor
must revalidate source identity, lead operational state, owner activity, and plan hash in a
transaction, rely on the unique source index for races, and fail closed on drift. Preview rollback
is simply discarding the unapproved plan; no converted rows, cancellation path, or remote state is
created.

Keep event-derived dashboard, lead-list, Contact 360, and history reads unchanged. Compatibility
reads and parity validation belong after execution and before any narrow CRM pending-work cutover.
Explicitly exclude CRM cutover, automation/SLA, notifications, Mi día/UI, future follow-up
creation, action rewrites, and remote application. The next proposal should also state the hard
precondition of fresh authorized reconciliation and disposable-shadow verification from remote
`0060` through local `0064` before any later execution slice.

### Risks
- A permissive date parser or server-local timezone can create a wrong due date; strict UTC normalization and explicit rejection are required.
- Legacy ownership and lead lifecycle can drift between preview and execution; owner/activity and lead state must be rechecked, with ambiguous rows held for review.
- Existing manual Tasks may share the owner/lead idempotency key; source-based idempotency and collision reporting prevent silent conflation.
- Concurrent follow-up writes after the snapshot can be missed or double-planned; bounded snapshots, deterministic ordering, and the unique source index make reruns safe.
- Treating a preview or archived packet as approval, remote parity, or audit history would cross the gate; all remain local/read-only evidence until separately authorized.

### Ready for Proposal
Yes — propose the preview-only classification slice with a versioned deterministic plan and zero
Task DML. Make execution/approval, audit ledger, cancellation/rollback, parity, compatibility-read
cutover, and all excluded Week 03 features explicit successor boundaries. Next step: `sdd-propose`.
