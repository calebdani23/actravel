# Follow-up Task Future Write Specification

## Purpose

Define transactional, replay-safe future follow-up writes.

## Requirements

### Requirement: Closed normalized request and result

The adapter MUST accept exactly `{requestId,leadId,noteBody,dueAt}`; callers MUST retain `requestId` across retries. IDs MUST be lowercase canonical UUIDs. Trimmed `noteBody` MUST contain 1–4,000 UTF-8 bytes. `dueAt` MUST be null or RFC 3339 with seconds and at most six fractional digits, normalized to six-digit UTC. Success MUST be exactly `{ok:true,outcome,requestId,noteId,eventId,taskId,taskStatus,dueAt,replayed}`, where `outcome` is `created|rescheduled|history_only`, Task fields are null only for `history_only`, and `eventId=requestId`.

Failures MUST use `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_FORBIDDEN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|LIMIT_EXCEEDED|IDEMPOTENCY_CONFLICT|REPLAY_INTEGRITY_FAILURE|LEAD_NOT_OPERATIONAL|OWNER_CONTEXT_INVALID|TASK_OCCUPANCY_CONFLICT`; only the adapter MAY add `PERSISTENCE_FAILURE` without provider text. Precedence MUST be auth, request, limits, replay, lead, owner, occupancy, then persistence.

#### Scenario: Missing date is history-only

- GIVEN a request whose `dueAt` is null
- WHEN the write commits
- THEN one note and one event commit, no Task changes, and success has `outcome="history_only"` with Task fields null

### Requirement: Independent authorization and live context

The adapter MUST authenticate `admin|asesor` before client creation. The boundary MUST independently authenticate the expected active actor. An Admin MAY act on any live assigned lead; an Asesor MUST be its assignee. The lead MUST be non-deleted, non-archived, and have one active owner with valid Task context.

#### Scenario: Stale assignment fails closed

- GIVEN an Asesor is no longer assigned, or the lead/owner is not operational
- WHEN a new request is submitted
- THEN the exact authorization or context failure returns with no note, event, or Task mutation

### Requirement: Atomic history and Task outcome

One transaction MUST insert the note, append `follow_up_registered` with ID `requestId`, and create or reschedule at most one Task. The caller MUST use only this RPC and revalidate only after success. Event payload MUST be exactly `{schema:"follow-up-write.v1",requestId,requestFingerprint,noteId,taskId,outcome,followUpAt,hasNote:true}`. Failure MUST roll back every effect. Ordinary authenticated paths MUST NOT update/delete events; privileged test purge MUST remain.

#### Scenario: Later write fails

- GIVEN note insertion succeeds but event or Task persistence fails
- WHEN the transaction ends
- THEN no note, event, or Task change is committed

### Requirement: Canonical create and status-preserving reschedule

With a date and no active canonical follow-up, the write MUST create one `pending` Task using the `0064` representation, `source_event_id=requestId`, and `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id="+requestId)))`. One complete active follow-up for the live lead/current owner MUST be rescheduled by changing only `due_at` and `updated_at`; ID, status, source identity, provenance, and key MUST remain unchanged, including `in_progress`. Terminal history permits creation. Multiple matches, malformed provenance, owner drift, or active manual/foreign occupancy MUST return `TASK_OCCUPANCY_CONFLICT` without adoption.

#### Scenario: In-progress reschedule

- GIVEN one canonical `in_progress` follow-up Task for the live lead and owner
- WHEN a later request supplies a different date
- THEN the same Task receives the new date and remains `in_progress` with immutable fields unchanged

### Requirement: Replay and serialization

After auth, input, and limit checks, the boundary MUST lock request identity before replay lookup, then the live lead, owner facts, and matching active Tasks in UUID order. A matching normalized request MUST return recorded identities with `replayed=true` and no mutation. Different normalized values under the same request ID MUST return `IDEMPOTENCY_CONFLICT`. Different request IDs for one lead MUST serialize; a delayed replay MUST NOT restore an older date.

#### Scenario: Concurrent retry and later reschedule

- GIVEN identical concurrent calls followed by a later request and then a delayed retry
- WHEN all calls finish
- THEN one first result exists, the later date wins, and the delayed retry performs no mutation

### Requirement: Additive local delivery and rollback

The capability SHALL follow readiness and preserve `0061`–`0067`. Rollback MUST remove callers before the boundary and MUST NOT delete committed rows. Local proof MUST NOT imply hosted parity, remote rollout, production readiness, or Week 03 closure.

#### Scenario: Local-only proof

- GIVEN local write scenarios pass without remote access
- WHEN readiness is reported
- THEN local behavior is proven and remote mutation remains unauthorized
