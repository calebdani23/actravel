# Staff Notifications Foundation Specification

## Purpose

Provide a staff-notification ledger for controlled creation and recipient-owned read state;
delivery, automation, and UI are excluded.

## Requirements

### Requirement: Persist constrained notification records

The system MUST persist `staff_notifications` records with UUID, `recipient_id`,
constrained `kind`, required nonblank bounded `title` and `body`, nullable descriptive `quote_id`,
optional `task_id`, nullable `read_at`, bounded deterministic idempotency, and UTC `created_at`.
Content and context MUST be immutable after creation; `read_at` is the only recipient-owned state.

#### Scenario: Valid notification is created
- GIVEN a trusted creation request names an active recipient, allowed kind, title, and body
- WHEN creation succeeds
- THEN one unread record is stored with its context and UTC timestamp

#### Scenario: Invalid notification is rejected
- GIVEN the kind is unknown, content is invalid, or a required relation is invalid
- WHEN creation is attempted
- THEN it fails without mutation

### Requirement: Restrict creation to the trusted seam

Only the designated non-automated service-role seam MAY create notifications. Anonymous clients,
authenticated humans, direct table DML, and unspecified services MUST NOT create, update, or delete
records. Automation, delivery scheduling, and UI are excluded.

#### Scenario: Unauthorized creation fails closed
- GIVEN an anonymous client, authenticated human, or service caller outside the designated seam
- WHEN notification creation is requested
- THEN authorization fails without mutation

### Requirement: Make creation deterministic and replay-safe

Creation MUST use a bounded deterministic idempotency key and uniqueness preventing
duplicate logical notifications. Exact replay MUST return the existing record without duplication;
conflicting replay MUST fail without mutation and MUST NOT replace immutable values.

#### Scenario: Exact replay
- GIVEN the same recipient, kind, content, context, and idempotency key are submitted again
- WHEN the request is replayed
- THEN the original record is returned and its timestamps/read state remain unchanged

#### Scenario: Conflicting replay
- GIVEN the key identifies a record but immutable values differ
- WHEN the request is replayed
- THEN it fails closed and creates no second record

### Requirement: Enforce recipient-only visibility and read state

An authenticated human with an active profile MUST read only notifications addressed to that
profile. The recipient MAY mark their own notification read; this MUST be idempotent and MUST NOT
change immutable fields. Non-recipients, inactive/unknown identities, anonymous clients, and
service-role callers MUST be denied read-state mutation.

#### Scenario: Recipient reads and marks read
- GIVEN an authenticated active human is the notification recipient
- WHEN they list the notification and mark it read
- THEN it is visible and `read_at` is set, while immutable fields are unchanged

#### Scenario: Other actor cannot access or mutate
- GIVEN a different, inactive, unknown, anonymous, or service-role actor
- WHEN they read or mark the notification read
- THEN no notification data is disclosed and no state changes

### Requirement: Preserve history and descriptive context

Notifications MUST remain readable by their recipient after referenced context is removed or
deactivated; context links MUST NOT hide history. `quote_id` is descriptive only and MUST NOT
grant quote access or alter quote lifecycle. No backfill is included.

#### Scenario: Context is later unavailable
- GIVEN a valid notification references a task or quote that is later deleted or deactivated
- WHEN the recipient reads notification history
- THEN the notification remains readable with nullable context and no new notification is created

### Requirement: Fail closed and verify independently

Unknown kinds, malformed data, missing/inactive recipients, inconsistent types, absent
RLS, or ambiguous migration state MUST fail closed. The child MUST depend on the archived verified
Tasks foundation, perform independent local migration/schema/RLS/type/runtime verification, preserve
existing auth/CRM/quotes/audit behavior, and MUST NOT mutate remote state. Generic RBAC, audit
rewrites, delivery, automation, UI, Mi día, and broad service creation are excluded.

#### Scenario: Dependency is unavailable
- GIVEN archived Tasks evidence or child-specific verification is unavailable or ambiguous
- WHEN preparation or verification runs
- THEN no migration allocation or mutation occurs and readiness is denied
