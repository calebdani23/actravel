# Follow-up Task Representation Specification

## Purpose

Define additive, representation-only metadata for follow-up Tasks. This change does not select,
classify, preview, approve, apply, or convert historical events; all backfill execution is deferred
to `week-03-followups-to-tasks-backfill`.

## Requirements

### Requirement: Additive follow-up representation

Tasks MUST support a follow-up kind and nullable representation fields without invalidating manual Tasks or changing existing lifecycle, authorization, quote, or CRM behavior. Follow-up-specific fields MUST be present together or absent together according to task kind.

#### Scenario: Manual Task remains compatible
- GIVEN an existing or newly created manual Task
- WHEN it is read or transitioned through an authorized existing path
- THEN it remains valid and its behavior is unchanged

#### Scenario: Follow-up representation is complete
- GIVEN a Task has follow-up kind
- WHEN it is persisted
- THEN its required follow-up representation fields are all present, or persistence fails without mutation

### Requirement: Immutable logical source identity

A follow-up Task MAY retain one logical `source_event_id` UUID without a foreign key. When non-null,
`source_event_id` MUST be globally unique across all Tasks, including after the source event or CRM
parent is purged, MUST be immutable, and MUST remain stored after purge.

#### Scenario: Source UUID survives purge
- GIVEN a source-linked Task and a separately authorized purge of its source event
- WHEN the Task is read
- THEN its source UUID remains available and no source row is required

#### Scenario: Duplicate or changed identity is rejected
- GIVEN a UUID already used by another Task, or an existing Task with a different UUID
- WHEN insert or update is attempted
- THEN it fails without changing either Task

### Requirement: Bounded historical provenance

Follow-up provenance MUST be bounded and sufficient to explain the Task’s historical meaning without requiring retained CRM rows. Provenance MUST be immutable after initial persistence and MUST NOT become a second source of operational behavior.

#### Scenario: Provenance is readable without CRM context
- GIVEN a source-linked Task whose source context is unavailable
- WHEN an authorized reader retrieves it
- THEN bounded provenance still conveys its historical meaning

### Requirement: Representation contract and security tests

Contract, adapter, deletion, lifecycle, and authorization tests MUST verify the representation
schema and existing Task invariants. Tests MUST verify global `source_event_id` uniqueness after
source purge and MUST prove that no historical Task DML occurs.

#### Scenario: Representation regression suite passes
- GIVEN valid manual and follow-up representations plus a purged source context
- WHEN schema, adapter, RLS, lifecycle, and deletion tests run
- THEN representation is preserved and existing Task decisions remain unchanged

#### Scenario: Backfill execution is absent
- GIVEN this change is applied in a disposable verification environment
- WHEN the change's tests and migration run
- THEN no historical Task is inserted, updated, deleted, classified, or converted

### Requirement: Safe representation migration

The migration MUST be ordered after `0063`, verified with read-only reconciliation, and tested only
in a disposable shadow based on remote `0060`. It MUST not be applied remotely and MUST perform zero
historical Task DML.

#### Scenario: Unsafe or mutating preparation is blocked
- GIVEN migration order, reconciliation, or shadow evidence is missing or ambiguous
- WHEN preparation runs
- THEN no remote mutation occurs and no historical Task DML occurs

## Non-Goals

Source selection/classification outcomes, historical preview/approve/apply, plan hashes, RPCs, backfill ledgers, conversion, cancellation, parity, converted-row rollback, automation, SLA, notifications, Mi día/UI, CRM cutover, action rewrite, and future follow-up creation are deferred to `week-03-followups-to-tasks-backfill` or excluded.

Rollback MUST be local-only: files and the migration MAY be reverted before rollout, but rollback
MUST NOT contact or mutate the remote project. This change creates no converted rows requiring
post-apply cancellation.
