# Delta for Baseline Reconciliation

## ADDED Requirements

### Requirement: Capture fresh, separated evidence

The packet MUST record fresh Git HEAD, branch, worktree state, migration filenames/order/checksums, protected-path hashes, source, and capture time. It MUST separately identify local bytes, the authoritative remote ledger, live behavior, and generated types. Documentation and archived packets MAY provide historical context but MUST NOT represent current remote proof.

#### Scenario: Identity is reproducible
- GIVEN repository and protected paths are inspected
- WHEN the packet is created
- THEN exact identity, hashes, sources, and timestamps are recorded

### Requirement: Reconcile documentation with executable evidence

The packet MUST deterministically classify changes since the archived identity as documentation-only or as touching executable, schema, or protected paths. The classification MUST cite Git path, mode, and hash evidence. Documentation-only changes MUST NOT be treated as refreshed remote provenance; any executable, schema, or protected-path change MUST invalidate stale assumptions and remain blocking until reassessed.

#### Scenario: Changed paths are classified against archived identity
- GIVEN repository changes exist since the archived identity
- WHEN documentation and executable/protected paths are compared
- THEN the packet records the classification with Git path, mode, and hash evidence
- AND documentation-only changes do not refresh remote provenance, while executable/protected-path changes invalidate stale assumptions and block until reassessed

### Requirement: Classify every discrepancy exclusively

Each named finding—`0051`, `drop_public_rate_limits_write_policy`, `0020`, `0044`–`0049`, and `0057`/`0060`—MUST have exactly one label: `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`. It MUST include evidence references, owner, disposition, authorization state, and source-time traceability. Missing or contradictory proof MUST remain manual review.

#### Scenario: Provenance is only implied
- GIVEN schema state or a ledger row appears to suggest a relationship
- WHEN authoritative linkage to local bytes is absent
- THEN no relationship is inferred and the finding blocks readiness

### Requirement: Assign role-based authority

Every evidence item, discrepancy, and gate MUST name a role-based owner, required authorizer, status, and next disposition. Collection, review, and operator sign-off MUST be attributable and distinct; authorization MUST NOT be self-assumed.

#### Scenario: Authorization is incomplete
- GIVEN an item lacks an accountable role or required approval
- WHEN readiness is assessed
- THEN it is blocking and unresolved

### Requirement: Bound approved live inspection and recovery

Live inspection MUST be read-only and limited to an explicitly approved, sanitized target with recorded environment identity and separation. Backup/restore rehearsal MUST use an approved disposable non-production target and record backup identity, restore result, operator sign-off, and cleanup result. Failed, unavailable, or unverified cleanup MUST block. Repository-verifiable evidence MUST remain distinct from external/operator evidence.

#### Scenario: Recovery rehearsal is incomplete
- GIVEN target, backup, restore, authorization, or cleanup evidence is missing or contradictory
- WHEN the gate is evaluated
- THEN the result is deterministically `BLOCKED`, not assumed successful

### Requirement: Preserve generated-type and historical boundaries

The packet MUST preserve the generated-type drift baseline and original evidence unchanged. It MUST NOT regenerate or modify tracked generated types. Archived evidence MAY inform investigation only as labeled historical input and MUST NOT satisfy fresh identity, provenance, target, authorization, or recovery gates.

#### Scenario: Type drift or stale history is found
- GIVEN generated types differ or archived proof conflicts with current evidence
- WHEN readiness is assessed
- THEN drift and contradiction remain recorded and cannot be presented as aligned proof

## MODIFIED Requirements

### Requirement: Gate all risky actions and preserve scope

The packet MUST NOT execute DDL, DML, migrations, migration/history mutation, provider-native or remote repair, migration creation/allocation, placeholder or compensating migrations, generated-type regeneration, or application behavior changes. `0061+` is explicitly prohibited by this change. A request crossing these boundaries MUST fail closed.
(Previously: it stopped risky actions but did not explicitly enumerate provenance-recovery operations or prohibit `0061+` allocation.)

#### Scenario: A prohibited operation is requested
- GIVEN an operator requests repair, migration creation, history allocation, or mutation
- WHEN the request is evaluated
- THEN it is rejected with a blocker and no action occurs

### Requirement: Publish a bounded final decision

The packet MUST publish exactly one `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP` gate and state whether migration allocation is safe. `0061+` MUST remain unsafe unless every required repository, authoritative remote, target, authorization, discrepancy, and recovery gate is proven.
(Previously: it published one gate and an allocation answer without the expanded evidence and recovery conditions.)

#### Scenario: The final gate is issued
- GIVEN all findings are exclusive and traceable
- WHEN any required proof is missing, failed, or unavailable
- THEN the sole outcome is `BLOCKED` and `0061+` is explicitly unsafe
