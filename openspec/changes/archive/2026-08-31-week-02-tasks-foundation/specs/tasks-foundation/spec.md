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

Each task MUST persist an active owner, UTC `due_at`, status (`pending`, `in_progress`, `completed`, or `canceled`), lead or standalone `quotes.id`, bounded deterministic idempotency, and `created_at`/`updated_at`. Creation MUST be `pending`; DELETE MUST be unavailable.

#### Scenario: Create pending task
- GIVEN an authenticated human supplies live context, owner, and UTC due date
- WHEN creation succeeds
- THEN one `pending` task has context, idempotency, and timestamps

#### Scenario: Invalid record rejected
- GIVEN a value violates the contract
- WHEN creation is attempted
- THEN it fails without mutation

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

Only authenticated humans MAY invoke `create_task` or `task_transition`. Service-role Task creation MUST be denied because no compatible cross-domain audit sink exists; a future audited service seam is Week 03/future work. Create/replay MUST validate live context. Historical tasks MUST survive parent soft/hard deletion and remain authorization-readable.

#### Scenario: Historical task readable
- GIVEN a valid task whose lead or quote is later deleted or deactivated
- WHEN its owner or Admin reads it
- THEN it remains readable, but new creation/replay from that context is denied

### Requirement: Local verification and preservation

Generated types and local shadow, static, SQL/RLS, and server-boundary evidence MUST pass without production fallback. Week 03 development readiness MUST be distinct from production readiness. Verification MUST show no change to Manager, CRM, quotes, audit, leads, `lead_events.followUpAt`, dashboard, physical data, intake image, or unrelated state.

#### Scenario: Readiness gate
- GIVEN the evidence set is complete
- WHEN verification runs
- THEN Week 03 readiness is reported only if all evidence passes
- AND production readiness remains separate until authorized evidence exists

## Non-Goals

Notifications, automation, SLA, Mi día, backfill, UI, new audit schema, generic RBAC, and remote application.
