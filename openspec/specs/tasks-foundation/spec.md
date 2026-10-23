# Tasks Foundation Specification

## Requirements

### Requirement: Reconcile migration state

Before any identifier or schema, read-only Gate 0 MUST resolve local/remote migration history, schema, RLS/helper metadata, and identifier safety. It MUST fail closed on ambiguity or unavailable tooling. Local `0061` MUST remain unapplied remotely unless separately authorized. After Gate 0, a shadow MAY apply dependent `0061`, then Tasks; remote application MUST NOT be inferred.

#### Scenario: Unsafe allocation blocked
- GIVEN required evidence is ambiguous or tooling unavailable
- WHEN Tasks preparation runs
- THEN no identifier or mutation occurs

#### Scenario: Local shadow dependency
- GIVEN Gate 0 passed
- WHEN an isolated shadow runs
- THEN it may apply `0061` then Tasks, never remotely

### Requirement: Persist task data

Each Task MUST persist an active owner, UTC `due_at`, status (`pending|in_progress|completed|canceled`), lead or standalone quote, bounded idempotency, and timestamps. Creation MUST be `pending`; DELETE MUST be unavailable. Kind MUST be `manual|follow_up|first_contact|quote_follow_up`. Follow-up fields MUST remain all-or-none; non-null `source_event_id` MUST remain no-FK, globally unique after purge, and immutable. Provenance MUST remain bounded and immutable. Native automation MUST use a separate immutable origin and MUST NOT repurpose `source_event_id`. Context MUST retain `ON DELETE SET NULL`.

(Previously: Task kinds were limited to `manual|follow_up`, with provenance only for canonical follow-up Tasks.)

#### Scenario: Create pending task
- GIVEN an authenticated human supplies valid live context, owner, description, and UTC due date
- WHEN creation succeeds
- THEN one `pending` manual Task has context, idempotency, and timestamps

#### Scenario: Invalid record rejected
- GIVEN a value violates status, kind, context, bound, or provenance rules
- WHEN persistence is attempted
- THEN it fails without mutation

#### Scenario: Representation constraint is enforced
- GIVEN follow-up fields are incomplete or native automation origin parity is invalid
- WHEN persistence is attempted
- THEN it fails without weakening canonical follow-up representation

### Requirement: Generated type and adapter compatibility

Generated types and the task adapter MUST expose and read additive follow-up fields, including the
representation kind, `source_event_id`, and bounded provenance. Rows and callers without metadata
MUST remain readable without a CRM read-path change.

#### Scenario: Existing adapter read remains valid
- GIVEN a manual Task row with all new fields null
- WHEN an existing authorized adapter read runs
- THEN it returns the Task without error and preserves its existing shape and behavior

#### Scenario: Additive fields are readable
- GIVEN a Task row containing valid follow-up representation metadata
- WHEN the adapter reads it
- THEN the generated types and returned data expose that metadata without changing CRM event-derived reads

### Requirement: Replay-safe creation

Idempotency replay MUST return the existing task only while all immutable values and live context match. A conflicting or nonlive replay MUST fail without mutation. Keys MUST be deterministic and bounded.

#### Scenario: Exact replay
- GIVEN a matching task has unchanged values and live context
- WHEN the same request is submitted
- THEN the existing task is returned without duplication

#### Scenario: Conflict replay
- GIVEN the key matches but values differ or context is stale
- WHEN replay is submitted
- THEN it fails without mutation

### Requirement: Terminal lifecycle

Only `pending` → `in_progress|completed|canceled` and `in_progress` → `completed|canceled` MUST mutate status. Humans and automation MUST use audited boundaries. Terminal status MUST be immutable, DELETE unavailable, and authenticated legacy `task_transition` unavailable after replacement. A new authorized same-target request MAY record an audited no-op without Task mutation.

(Previously: Authorized transitions used unaudited `task_transition`, and same-target requests were invalid.)

#### Scenario: Allowed transition
- GIVEN a nonterminal Task and valid audited action
- WHEN the action commits
- THEN status, `updated_at`, and exactly one receipt commit atomically

#### Scenario: Invalid transition
- GIVEN a terminal Task and incompatible human target, or a disallowed pair
- WHEN action or DELETE is requested
- THEN it is denied without Task mutation

### Requirement: Identical ownership authorization

The active owner MUST manage their own task; Admin all tasks; Manager active non-Admin-owned tasks. Admin-owned tasks MUST be Admin-only. Unknown-only or inactive identities MUST be denied. Server, RPC, and RLS decisions MUST be identical and nonrecursive.

#### Scenario: Ownership matrix
- GIVEN an active owner, Admin, Manager, non-owner, unknown-only, or inactive identity
- WHEN create or transition is attempted
- THEN all boundaries apply the stated decision

### Requirement: Actors and history

Only authenticated humans MAY invoke `create_task` or public audited actions; service-role creation/action MUST remain denied. Only admitted automation MAY cancel internally. Create/replay MUST validate live context or current authority. Historical Tasks, origins, and receipts MUST remain RLS-readable after source purge; lifecycle, ownership, quote, CRM history, and `ON DELETE SET NULL` behavior MUST remain unchanged.

(Previously: Humans could invoke unaudited `task_transition`, and history covered Tasks/follow-up provenance but no action receipts or automation origins.)

#### Scenario: Historical task readable
- GIVEN a valid Task whose lead or quote is later deleted or deactivated
- WHEN its currently authorized owner or Admin reads it
- THEN Task, retained origin, and permitted receipts remain without recreating source data

#### Scenario: Existing invariants remain unchanged
- GIVEN a manual, canonical follow-up, quote-linked, or lead-deleted Task
- WHEN existing RLS, ownership, quote, CRM, or history behavior is exercised
- THEN the prior decision and `ON DELETE SET NULL` result remain unchanged

#### Scenario: Source purge preserves audit
- GIVEN a follow-up or automated Task's source is authoritatively purged
- WHEN an authorized reader reads retained records
- THEN Task provenance, any origin/receipts, and terminal status remain immutable
### Requirement: Local verification and preservation

Generated types and local shadow, static, SQL/RLS, and server-boundary evidence MUST pass without production fallback. Week 03 development readiness MUST be distinct from production readiness. Verification MUST show no change to Manager, CRM, quotes, audit, leads, `lead_events.followUpAt`, dashboard, physical data, intake image, or unrelated state.

#### Scenario: Readiness gate
- GIVEN the evidence set is complete
- WHEN verification runs
- THEN Week 03 readiness is reported only if all evidence passes
- AND production readiness remains separate until authorized evidence exists

### Requirement: Representation-only migration

The migration MUST follow `0061` → `0062` → `0063` → the new migration, use read-only reconciliation,
and use a disposable shadow from remote `0060`. It MUST change representation schema only, MUST NOT
be applied remotely, and MUST perform zero historical Task DML.

#### Scenario: Local-only zero-row migration
- GIVEN the local migration chain and disposable shadow prerequisites are verified
- WHEN the representation migration is applied in the shadow
- THEN it changes representation schema only and inserts or updates zero historical Task rows

#### Scenario: Rollout evidence is insufficient
- GIVEN reconciliation, ordering, or shadow evidence is missing or ambiguous
- WHEN rollout preparation runs
- THEN no remote mutation occurs and no historical Task DML occurs

### Requirement: Future Task projection and classifier boundary

Tests for the Tasks boundary MUST cover only the expected future Task representation: exact source/lead/owner facts, normalized due date, source-namespaced idempotency, exact conversion, eligible mapping, and every collision reason. The projection MUST use `status: "pending"`, `task_kind: "follow_up"`, selected `owner_id`/`lead_id`, `quote_id: null`, description exactly `"Follow up with lead"`, `due_at`/`source_due_at`, source event id/type/created timestamp, allow-listed `source_payload` exactly `{followUpAt,hasNote}`, exact five-key metadata `{schema,source_event_id,source_event_type,owner_id,lead_id}`, and `idempotency_key`. Its generic key is `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<lowercaseSourceEventId>")))`; source key is `source_event_id`, owner-idempotency key is `(owner_id,idempotency_key)`, and owner-lead key is `(owner_id,lead_id)`. Equality includes every deterministic value, excludes `id`, `created_at`, and `updated_at`, and uses recursive canonical JSON equality. `TaskOccupancyFact` MUST be created for EVERY Task row regardless of `task_kind` or source, including lowercase UUID Task-id/owner, UUID-or-null lead, and 64-lowerhex idempotency facts; only exact complete follow-up-source equality creates `ExistingTaskFact`. `created_at` is a cursor/digest field excluded from classifier equality. Every existing fact must match exactly one occupancy by all four fields or classification throws `InvariantViolation`. `ExistingTaskFact.id` is identity/reporting only. The plan is descriptive and immutable; no Task row is changed.

Coverage MUST include duplicate Task IDs as `InvalidFact`, multiple distinct source matches as `DUPLICATE_SOURCE`, source mismatch, mutually exclusive owner-idempotency and owner-lead branches, exact Task equality, the complete 70-byte idempotency vector, and canonical plan behavior. The counts vector MUST use exactly this order: `[eligible, invalid-date/no-task, manual-review/unassigned-owner, excluded/lead-not-operational, excluded/non-selected-history, already-converted, collision/manual-review]`. Owner facts MUST use the closed discriminated union and exact role/reason mapping in the preview specification; malformed tags are `InvalidFact`. Tests construct legal facts and assert required counts and limits rather than maintaining pseudo-fixture catalogs.

### Requirement: Closed collision and accounting contract

Tests MUST cover duplicate Task IDs as `InvalidFact`, distinct source matches as `DUPLICATE_SOURCE`, both owner collision branches, exact equality, the complete idempotency vector, seven-count order, closed owner facts and reasons, row/byte limits, and canonical plan behavior. Tests MUST use bounded read-only injected transports; pure classification MAY run, but approval, execution, ledger, cancellation, revalidation, cutover, rollout, operational creation, automation, SLA, notifications, Mi día, and UI are deferred.

#### Scenario: Collision branches remain exclusive
- GIVEN occupancy matching owner/idempotency or owner/lead
- WHEN classification evaluates it
- THEN exactly the applicable collision reason is counted without changing Task equality

#### Scenario: All Task occupancy is accounted for
- GIVEN bounded rows containing Tasks of any kind and source
- WHEN the reader supplies classifier facts
- THEN every Task has occupancy and only exact follow-up-source matches have `ExistingTaskFact`

#### Scenario: Canonical mapping is unchanged
- GIVEN the same candidate and exact existing source match
- WHEN classification runs with occupancy facts
- THEN disposition and canonical output equal the prior result

### Requirement: Additive automation and audit sequence

`0077`–`0080` MUST remain ordered audit storage, action boundary, automation foundation, then future hooks. They MUST NOT modify `0061`–`0076`, events, cutover signatures, readiness, zero-duplicate guarantees, `in_progress` preservation, or Task-backed reads; current readers remain `follow_up`-only. Evidence MUST be local-only; Mi día, notifications, bootstrap, remote rollout, and closure remain excluded.

#### Scenario: Existing cutover remains canonical
- GIVEN automation migrations are applied locally
- WHEN existing follow-up writes and reads run
- THEN their representation, history-only behavior, ordering, visibility, and zero-duplicate results remain unchanged

## Non-Goals

Notifications, automation, SLA, Mi día, backfill, UI, new audit schema, generic RBAC, and remote application.
