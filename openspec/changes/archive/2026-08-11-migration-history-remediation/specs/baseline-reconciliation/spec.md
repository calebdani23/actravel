# Delta for Baseline Reconciliation

## MODIFIED Requirements

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

### Requirement: Verify validation and recovery safety

The baseline MUST distinguish verified, failed, and unavailable evidence for local backup/restore rehearsal, remote readiness, production readiness, and external-boundary-disabled validation. Local proof MUST NOT represent remote or production restore proof. (Previously: capability and recovery proof were merely distinguished.)

#### Scenario: Recovery proof is unavailable
- GIVEN a rehearsal, backup, or restore check cannot be completed
- WHEN completion is evaluated
- THEN it receives deterministic `unavailable` or `failed` and cannot pass

### Requirement: Gate all risky actions and preserve scope

Any repair, compensating or historical/no-op migration, DDL/DML, production mutation, `0061+`, tracked type regeneration, or dependency-baseline migration/schema/type/database work MUST stop. This change MUST NOT execute or authorize it. Future provider-native repair requires a separate maintainership decision, exact provenance, recovery evidence, rehearsal, and explicit production authorization. (Previously: risky operations stopped with a seven-part approval packet.)

#### Scenario: A prohibited action is requested
- GIVEN a proposed action crosses this scope boundary
- WHEN it is evaluated
- THEN the result is fail-closed with a blocker and no action is executed

### Requirement: Publish a bounded final decision

The packet MUST provide success/failure criteria, source-time traceability, and exactly one final gate: `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`. It MUST state whether next migration allocation is safe; missing provenance, target, recovery evidence, rehearsal, or authorization MUST block it. (Previously: the report ended with one gate and a safe/not-safe allocation answer.)

#### Scenario: The register is complete but gates remain closed
- GIVEN all findings are traceable but a required proof or authorization is missing
- WHEN the final gate is issued
- THEN the result is `BLOCKED` and `0061+` is explicitly unsafe

## ADDED Requirements

### Requirement: Bound dependency-baseline parallel work

`dependency-baseline` MAY proceed in parallel only for manifest/lockfile inventory and verification; it MUST fail closed on any migration, schema, generated type, or database scope drift.

#### Scenario: Inventory remains in scope
- GIVEN only manifests and lockfiles are inspected
- WHEN verification completes
- THEN no migration, schema, type, or database artifact is changed
