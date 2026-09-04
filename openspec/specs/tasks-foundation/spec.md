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

Each task MUST persist an active owner, UTC `due_at`, status (`pending`, `in_progress`, `completed`, or `canceled`), lead or standalone `quotes.id`, bounded deterministic idempotency, and `created_at`/`updated_at`. Creation MUST be `pending`; DELETE MUST be unavailable. Follow-up fields MUST obey task-kind all-or-none checks. A non-null `source_event_id` MUST have no foreign key, be globally unique across Tasks even after source purge, and be immutable. Provenance MUST be bounded and immutable. Lead/quote context MUST retain `ON DELETE SET NULL`.

(Previously: Tasks did not include additive follow-up representation fields, source identity, or immutable bounded provenance.)

#### Scenario: Create pending task
- GIVEN an authenticated human supplies live context, owner, and UTC due date
- WHEN creation succeeds
- THEN one `pending` task has context, idempotency, and timestamps

#### Scenario: Invalid record rejected
- GIVEN a value violates the contract
- WHEN creation is attempted
- THEN it fails without mutation

#### Scenario: Representation constraint is enforced
- GIVEN a Task has incomplete follow-up fields, a duplicate source UUID, or changed immutable provenance
- WHEN persistence is attempted
- THEN it fails without mutating any Task

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

Only `pending` → `in_progress`, `completed`, or `canceled`, and `in_progress` → `completed` or `canceled`, MUST be accepted. Terminal tasks MUST be immutable; DELETE MUST be unavailable.

#### Scenario: Allowed transition
- GIVEN a nonterminal task and allowed target
- WHEN an authorized transition is requested
- THEN status and `updated_at` change

#### Scenario: Invalid transition
- GIVEN a terminal task or disallowed pair
- WHEN transition or DELETE is requested
- THEN it is denied without mutation

### Requirement: Identical ownership authorization

The active owner MUST manage their own task; Admin all tasks; Manager active non-Admin-owned tasks. Admin-owned tasks MUST be Admin-only. Unknown-only or inactive identities MUST be denied. Server, RPC, and RLS decisions MUST be identical and nonrecursive.

#### Scenario: Ownership matrix
- GIVEN an active owner, Admin, Manager, non-owner, unknown-only, or inactive identity
- WHEN create or transition is attempted
- THEN all boundaries apply the stated decision

### Requirement: Actors and history

Only authenticated humans MAY invoke `create_task` or `task_transition`. Service-role creation MUST remain denied. Create/replay MUST validate live context. Historical Tasks MUST remain readable after lead or quote deletion through `ON DELETE SET NULL`. Source identity MUST NOT require CRM retention; immutable provenance MUST remain readable after purge. Lifecycle, RLS, ownership, quote, and CRM behavior MUST remain unchanged.

(Previously: Historical preservation covered task context but not additive follow-up representation.)

#### Scenario: Historical task readable
- GIVEN a valid task whose lead or quote is later deleted or deactivated
- WHEN its owner or Admin reads it
- THEN it remains readable, but new creation/replay from that context is denied

#### Scenario: Existing invariants remain unchanged
- GIVEN a manual, quote-linked, or lead-deleted Task
- WHEN existing lifecycle, RLS, ownership, quote, or CRM behavior is exercised
- THEN the prior decision and `ON DELETE SET NULL` result remain unchanged

#### Scenario: Source purge preserves representation
- GIVEN a follow-up Task's source event is removed by an authorized hard purge
- WHEN an authorized reader reads the Task
- THEN its UUID and bounded provenance remain readable without recreating or mutating source data

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

Tests for the Tasks boundary MUST cover only the expected future Task representation: exact source/lead/owner facts, normalized due date, source-namespaced idempotency, exact conversion, eligible mapping, and every collision reason. The projection MUST use `status: "pending"`, `task_kind: "follow_up"`, selected `owner_id`/`lead_id`, `quote_id: null`, description exactly `"Follow up with lead"`, `due_at`/`source_due_at`, source event id/type/created timestamp, allow-listed `source_payload` exactly `{followUpAt,hasNote}`, exact five-key metadata `{schema,source_event_id,source_event_type,owner_id,lead_id}`, and `idempotency_key`. Its generic key is `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<lowercaseSourceEventId>")))`; source key is `source_event_id`, owner-idempotency key is `(owner_id,idempotency_key)`, and owner-lead key is `(owner_id,lead_id)`. Equality includes every deterministic value, excludes `id`, `created_at`, and `updated_at`, and uses recursive canonical JSON equality. `ExistingTaskFact.id` is identity/reporting only. The plan is descriptive and immutable; no Task row is changed.

Coverage MUST include duplicate Task IDs as `InvalidFact`, multiple distinct source matches as `DUPLICATE_SOURCE`, source mismatch, mutually exclusive owner-idempotency and owner-lead branches, exact Task equality, the complete 70-byte idempotency vector, and canonical plan behavior. The counts vector MUST use exactly this order: `[eligible, invalid-date/no-task, manual-review/unassigned-owner, excluded/lead-not-operational, excluded/non-selected-history, already-converted, collision/manual-review]`. Owner facts MUST use the closed discriminated union and exact role/reason mapping in the preview specification; malformed tags are `InvalidFact`. Tests construct legal facts and assert required counts and limits rather than maintaining pseudo-fixture catalogs.

## Non-Goals

Notifications, automation, SLA, Mi día, backfill, UI, new audit schema, generic RBAC, and remote application.
