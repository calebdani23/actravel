# Delta for Tasks Foundation

## MODIFIED Requirements

### Requirement: Future Task projection and classifier boundary

Tests MUST preserve the future Task representation: pending follow-up kind, selected owner/lead,
null quote, exact description, normalized due fields, source event fields, allow-listed payload,
five-key metadata, and source-namespaced idempotency. Equality MUST compare all deterministic values
with recursive canonical JSON and exclude generated IDs and timestamps. The generic key MUST be
`lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<lowercaseSourceEventId>")))`; collision keys
are source, `(owner_id,idempotency_key)`, and `(owner_id,lead_id)`. The reader MUST create
`TaskOccupancyFact` array for EVERY Task row regardless of `task_kind` or source, including lowercase
UUID Task-id/owner, UUID-or-null lead, and 64-lowerhex idempotency facts; only exact complete
follow-up-source equality creates `ExistingTaskFact`. `created_at` is a cursor/digest field excluded
from classifier equality. Every existing fact must match exactly one occupancy by all four fields or
classification throws `InvariantViolation`.
No Task row is changed.
(Previously: occupancy coverage was limited to described manual or follow-up categories.)

#### Scenario: All Task occupancy is accounted for
- GIVEN bounded rows containing Tasks of any kind and source
- WHEN the reader supplies classifier facts
- THEN every Task has occupancy and only exact follow-up-source matches have `ExistingTaskFact`

#### Scenario: Canonical mapping is unchanged
- GIVEN the same candidate and exact existing source match
- WHEN classification runs with occupancy facts
- THEN disposition and canonical output equal the prior result

### Requirement: Closed collision and accounting contract

Tests MUST cover duplicate Task IDs as `InvalidFact`, distinct source matches as `DUPLICATE_SOURCE`,
both owner collision branches, exact equality, the complete idempotency vector, seven-count order,
closed owner facts and reasons, row/byte limits, and canonical plan behavior. Tests MUST use bounded
read-only injected transports; pure classification MAY run, but approval, execution, ledger,
cancellation, revalidation, cutover, rollout, operational creation, automation, SLA, notifications,
Mi día, and UI are deferred.
(Previously: the boundary did not state the complete deferred operational surface.)

#### Scenario: Collision branches remain exclusive
- GIVEN occupancy matching owner/idempotency or owner/lead
- WHEN classification evaluates it
- THEN exactly the applicable collision reason is counted without changing Task equality
