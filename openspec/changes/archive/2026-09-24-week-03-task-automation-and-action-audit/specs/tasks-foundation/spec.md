# Delta for Tasks Foundation

## ADDED Requirements

### Requirement: Additive automation and audit sequence

`0077`–`0080` MUST remain ordered audit storage, action boundary, automation foundation, then future hooks. They MUST NOT modify `0061`–`0076`, events, cutover signatures, readiness, zero-duplicate guarantees, `in_progress` preservation, or Task-backed reads; current readers remain `follow_up`-only. Evidence MUST be local-only; Mi día, notifications, bootstrap, remote rollout, and closure remain excluded.

#### Scenario: Existing cutover remains canonical
- GIVEN automation migrations are applied locally
- WHEN existing follow-up writes and reads run
- THEN their representation, history-only behavior, ordering, visibility, and zero-duplicate results remain unchanged

## MODIFIED Requirements

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
