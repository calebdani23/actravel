# Delta for Tasks Foundation

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Persist task data

Each task MUST persist its active owner, UTC `due_at`, status, lead or standalone `quotes.id`, bounded idempotency, and timestamps. Creation MUST be `pending`; DELETE MUST be unavailable. Follow-up fields MUST obey task-kind all-or-none checks. A non-null `source_event_id` MUST have no foreign key, be globally unique across Tasks even after source purge, and be immutable. Provenance MUST be bounded and immutable. Lead/quote context MUST retain `ON DELETE SET NULL`.
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

### Requirement: Actors and history

Only authenticated humans MAY invoke `create_task` or `task_transition`; service-role creation MUST remain denied. Create/replay MUST validate live context. Historical Tasks MUST remain readable after lead or quote deletion through `ON DELETE SET NULL`. Source identity MUST NOT require CRM retention; immutable provenance MUST remain readable after purge. Lifecycle, RLS, ownership, quote, and CRM behavior MUST remain unchanged.
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

### Requirement: Representation-only migration

The migration MUST follow `0061` → `0062` → `0063` → the new migration, use read-only reconciliation, and use a disposable shadow from remote `0060`. It MUST change representation schema only, MUST NOT be applied remotely, and MUST perform zero historical Task DML.
(Previously: Tasks Foundation verification did not define the follow-up representation migration boundary.)

#### Scenario: Local-only zero-row migration
- GIVEN the local migration chain and disposable shadow prerequisites are verified
- WHEN the representation migration is applied in the shadow
- THEN it changes representation schema only and inserts or updates zero historical Task rows

#### Scenario: Rollout evidence is insufficient
- GIVEN reconciliation, ordering, or shadow evidence is missing or ambiguous
- WHEN rollout preparation runs
- THEN no remote mutation occurs and no historical Task DML occurs

## Non-Goals

No source selection/classification outcomes, preview/approve/apply, hashes, RPCs, ledgers, conversion, cancellation, parity, converted-row rollback, automation, SLA, notifications, Mi día/UI, CRM cutover, action rewrite, or future follow-up creation. Rollback MUST be local-only: files and the migration MAY be reverted before rollout, but rollback MUST NOT contact or mutate the remote project. No converted rows require cancellation.
