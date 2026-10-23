# Task Action Audit Specification

## Purpose

Define the sole replay-safe boundary for human Task actions and automated cancellation.

## Requirements

### Requirement: Closed action request

The boundary MUST accept only `{requestId,taskId,targetStatus,cancelReason,completionOutcome,note}`, canonical lowercase UUIDs, and target `in_progress|completed|canceled`. Start MUST forbid reason, outcome, and note. Completion MAY carry `completionOutcome=null|first_contact_completed|work_completed`; cancellation MUST carry `cancelReason=no_longer_needed|duplicate|source_invalidated|other`. Either terminal action MAY carry a trimmed 1–2,000 UTF-8-byte note. RPC failures SHALL be `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|TASK_FORBIDDEN|TASK_ACTION_IDEMPOTENCY_CONFLICT|TASK_INVALID_TRANSITION`; only the adapter MAY add `PERSISTENCE_FAILURE`, without provider text. After authentication and request validation, the RPC MAY look up and classify a receipt by request identity, but it MUST resolve and lock the current Task and enforce current authorization before returning replay or `TASK_ACTION_IDEMPOTENCY_CONFLICT`. Only then MAY an exact receipt replay return; lifecycle checks MUST follow replay or idempotency-conflict resolution.

#### Scenario: Action metadata is validated
- GIVEN a start with a note, a cancellation without a reason, or an unknown completion outcome
- WHEN the boundary validates the request
- THEN `INVALID_REQUEST` returns and no client, Task, or receipt is created

### Requirement: Immutable action receipt

Every accepted action MUST append one purge-independent receipt containing request, receipt, Task, actor, owner snapshot, action, from/to status, metadata, actor kind, source identity, result, and original timestamp. Receipts MUST be bounded, self-consistent, immutable, and unavailable for direct DML.

#### Scenario: Applied action is durable
- GIVEN an authorized pending Task and valid completion request
- WHEN the action commits
- THEN Task status and exactly one `applied` receipt commit atomically
- AND later source or context purge leaves the receipt unchanged

### Requirement: Current authorization and receipt visibility

The server-only adapter MUST authenticate before client creation; the RPC MUST independently require the expected active actor on every call, including replay. The active owner MAY manage their Task; Admin MAY manage all; Manager MAY manage active non-Admin-owned Tasks; Admin-owned Tasks MUST be Admin-only. Unknown or inactive identities MUST be denied without disclosing existence. Receipt SELECT MUST apply that current owner-snapshot matrix through forced RLS; public, anon, and service-role execution MUST remain denied.

#### Scenario: Role change blocks replay
- GIVEN an actor committed a receipt but no longer has current authority
- WHEN that actor retries or reads it
- THEN `TASK_FORBIDDEN` or RLS denial occurs without mutation

### Requirement: Replay and audited no-op

After the RPC resolves and locks the current Task and enforces current authorization, an exact request fingerprint MUST return the original receipt with `replayed=true` before lifecycle checks, even after a later action. Reusing its request ID with another actor, Task, target, or metadata MUST return `TASK_ACTION_IDEMPOTENCY_CONFLICT` before lifecycle checks. A new authorized request already at its nonterminal or same terminal target MUST append one `already_at_target` receipt without touching the Task.

#### Scenario: Delayed exact replay
- GIVEN an applied start receipt and a later valid completion
- WHEN the exact start request is retried
- THEN the original start receipt replays and completed status is unchanged

#### Scenario: New same-target request
- GIVEN a Task already has the requested status
- WHEN a different authorized request targets that status
- THEN one `already_at_target` receipt is written and `updated_at` is unchanged

### Requirement: Terminal races

Actions MUST serialize deterministically. Identical concurrent calls MUST converge to one receipt; distinct same-target calls MUST yield one `applied` and one `already_at_target`. The first terminal commit MUST win. A different human terminal target MUST return `TASK_INVALID_TRANSITION` without receipt; later automated cancellation MUST append `not_applicable_terminal` without changing status.

#### Scenario: Human completion races automation
- GIVEN authorized completion and source cancellation race on one active Task
- WHEN both serialize
- THEN the first terminal commit remains final
- AND the losing automation records `not_applicable_terminal` or the losing human receives `TASK_INVALID_TRANSITION`

### Requirement: Migration and rollback boundary

`0077` SHALL add receipt storage, immutability, grants, and forced RLS only. `0078` SHALL add the RPC/adapter and revoke authenticated legacy `task_transition` only after replacement; `0062` MUST remain unchanged. Destructive reversal and legacy `task_transition` restoration MAY occur only when no persisted state created or governed by `0077`–`0080` exists—not Tasks, origins, outcomes, tombstones, receipts, events, or terminal action state. Once any exists, rollback MUST only forward-disable hooks/new execution; it MUST retain all listed state, preserve compatible audited adapter behavior, and keep legacy `task_transition` revoked. Proof MUST remain local-only and claim no rollout or closure.

#### Scenario: Persisted rollback
- GIVEN any Task, origin, outcome, tombstone, receipt, event, or terminal action state created or governed by `0077`–`0080` has persisted locally
- WHEN rollback is required
- THEN rollback forward-disables hooks/new execution and retains all listed state
- AND compatible audited adapter behavior is preserved and legacy `task_transition` remains revoked
