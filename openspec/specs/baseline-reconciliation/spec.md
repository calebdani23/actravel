# Baseline Reconciliation Specification

## Purpose

Establish an evidence-first, non-destructive account of repository, Supabase history, live schema, generated types, environments, and recovery readiness before any new migration identifier is allocated.

## Requirements

### Requirement: Capture and classify the repository baseline

The reconciliation report MUST record current Git HEAD, branch, working-tree state, migration filenames/order/checksums where available, and classify documentation-only commits separately from executable application or schema changes. It MUST identify gaps such as the local `0051` gap without treating documentation as database evidence.

#### Scenario: Git evidence is complete
- GIVEN the repository contains code, migrations, and documentation commits
- WHEN the baseline is inspected
- THEN the report records exact Git evidence and identifies documentation-only commits without claiming remote application

### Requirement: Reconcile complete local and authoritative remote history

The report MUST inventory local migrations and authoritative remote history with names, versions, authorized hashes, sanitized identity, and evidence times. It MUST give one disposition per discrepancy and cover remote `0051`, `drop_public_rate_limits_write_policy`, local `0020`, placeholders `0044`–`0049`, and local `0057` absorbed by `0060`. (Previously: it required explicit dispositions for `0053`–`0060`.)

#### Scenario: Named findings are reconciled
- GIVEN local and remote evidence is available or unavailable
- WHEN the comparison is completed
- THEN each finding has one classification, owner, blocker, disposition, and authorization state

### Requirement: Use exclusive discrepancy labels

Every discrepancy MUST be classified exactly once as `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`. It MUST NOT infer ledger provenance from schema state or local body provenance from a ledger row; missing proof MUST remain manual review. (Previously: it did not state both inference prohibitions.)

#### Scenario: Proof cannot establish provenance
- GIVEN a final schema or ledger row appears to suggest a migration relationship
- WHEN provenance is evaluated
- THEN no relationship is inferred and the finding remains `ambiguous/manual-review`

### Requirement: Compare history to live schema

The report MUST compare targeted schema, functions/RPCs/helpers, triggers, constraints, and RLS behavior read-only, preserving authorization, CRM governance, quote cutover, purge, archive/restore, helper grants, and data integrity. (Previously: it required reporting live drift without mutation.)

#### Scenario: A protected invariant differs
- GIVEN a targeted live object or authorization behavior differs
- WHEN evidence is compared
- THEN it is blocked and reported without cleanup, repair, DDL, or DML

### Requirement: Detect generated type drift safely

The baseline MUST preserve type-drift comparison and evidence, but this change MUST NOT regenerate or modify tracked generated types. (Previously: regeneration could occur after proven alignment.)

#### Scenario: Type drift is detected
- GIVEN a comparison finds generated type drift
- WHEN this change evaluates completion
- THEN the baseline is retained and tracked type regeneration is prohibited

### Requirement: Verify validation and environment safety

The baseline MUST distinguish verified, failed, and unavailable evidence for local backup/restore rehearsal, remote readiness, production readiness, and external-boundary-disabled validation. Local proof MUST NOT represent remote or production restore proof. (Previously: capability and recovery proof were merely distinguished.)

#### Scenario: Recovery proof is unavailable
- GIVEN a rehearsal, backup, or restore check cannot be completed
- WHEN completion is evaluated
- THEN it receives deterministic `unavailable` or `failed` and cannot pass

### Requirement: Gate all risky actions and preserve scope

The packet MUST NOT execute DDL, DML, migrations, migration/history mutation, provider-native or remote repair, migration creation/allocation, placeholder or compensating migrations, generated-type regeneration, or application behavior changes. `0061+` is explicitly prohibited by this change. A request crossing these boundaries MUST fail closed. (Previously: risky operations stopped with a seven-part approval packet.)

#### Scenario: A prohibited operation is requested
- GIVEN an operator requests repair, migration creation, history allocation, or mutation
- WHEN the request is evaluated
- THEN it is rejected with a blocker and no action occurs

### Requirement: Publish a bounded final decision

The packet MUST publish exactly one `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP` gate and state whether migration allocation is safe. `0061+` MUST remain unsafe unless every required repository, authoritative remote, target, authorization, discrepancy, and recovery gate is proven. (Previously: the report ended with one gate and a safe/not-safe allocation answer.)

#### Scenario: The final gate is issued
- GIVEN all findings are exclusive and traceable
- WHEN any required proof is missing, failed, or unavailable
- THEN the sole outcome is `BLOCKED` and `0061+` is explicitly unsafe

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

### Requirement: Bound dependency-baseline parallel work

`dependency-baseline` MAY proceed in parallel only for manifest/lockfile inventory and verification; it MUST fail closed on any migration, schema, generated type, or database scope drift.

#### Scenario: Inventory remains in scope
- GIVEN only manifests and lockfiles are inspected
- WHEN verification completes
- THEN no migration, schema, type, or database artifact is changed
