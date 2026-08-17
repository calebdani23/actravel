# Delta for Baseline Reconciliation

## MODIFIED Requirements

### Requirement: Reconcile complete local and authoritative remote history

The report MUST use fresh local and remote evidence, discrepancy classifications, evidence references, times, owners, and authorizers. It MUST classify `0051`, `drop_public_rate_limits_write_policy`, `0020`, `0044`–`0049`, and `0057`/`0060` exactly once. (Previously: it required explicit dispositions for named findings.)

#### Scenario: Findings receive deterministic classifications
- GIVEN local or remote evidence is available, missing, or contradictory
- WHEN reconciliation is completed
- THEN every named finding has exactly one classification, disposition, owner, authorizer, source, and capture time

### Requirement: Capture fresh, separated evidence

The packet MUST separate linked project identity from environment role and authorization. It MUST label local bytes, authoritative remote ledger, live catalog/behavior, generated types, validation, and operator evidence separately. Read-only catalog or final-state evidence, archived packets, schema state, Docker, and local tests MUST NOT be treated as migration provenance, authorization, recovery, or production evidence. (Previously: it required fresh identity, hashes, sources, and timestamps.)

#### Scenario: Catalog evidence cannot prove provenance
- GIVEN a catalog object or policy matches a local migration body
- WHEN provenance is evaluated
- THEN the observation corroborates live behavior only and does not establish that migration was applied

### Requirement: Detect generated type drift safely

The packet MUST generate a remote type artifact in ignored temporary storage, compare it deterministically with `lib/supabase/database.types.ts`, and report hashes and differences. It MUST leave tracked generated types unchanged and MUST NOT overwrite or regenerate them. (Previously: regeneration could occur after proven alignment.)

#### Scenario: Fresh types differ
- GIVEN remote types are generated for comparison
- WHEN the diff is produced
- THEN only ignored temporary artifacts are written, tracked types remain unchanged, and drift is reported without provenance inference

### Requirement: Verify validation and environment safety

Baseline lint, build, and quote-notification tests MUST be recorded with outcomes and MUST disable external boundaries; no real Resend, Meta, Storage, or production smoke traffic MAY run. Recovery rehearsal MUST be `verified` only with an approved disposable non-production target, role and authorization, cost/tooling/credential confirmation, backup identity, restore and invariant checks, cleanup proof, and independent sign-off. Missing prerequisites MUST be recorded as `unavailable`, not failed or verified. (Previously: validation distinguished local and remote readiness.)

#### Scenario: Safe baseline validation passes
- GIVEN external boundaries are disabled
- WHEN lint, build, and quote tests run
- THEN results are reproducible and no external traffic or database mutation occurs

#### Scenario: Rehearsal prerequisites are absent
- GIVEN target, authorization, tooling, cost, credentials, backup, cleanup, or independent sign-off is missing
- WHEN recovery readiness is evaluated
- THEN rehearsal status is `unavailable` and the final gate is `BLOCKED`

### Requirement: Gate all risky actions and preserve scope

The packet MUST NOT perform DDL, DML, history repair, migration push/reset, provider-native repair, `0061+`, type overwrite, application behavior changes, production smoke, real external traffic, or modification of unrelated paths including `docs/about/helps/intakes/image.png`. A request crossing these boundaries MUST fail closed. (Previously: risky operations and application changes were prohibited.)

#### Scenario: Scope boundary is crossed
- GIVEN an operator requests a prohibited mutation or unrelated file change
- WHEN the request is evaluated
- THEN it is rejected, recorded as blocked, and no action occurs

### Requirement: Publish a bounded final decision

The packet MUST publish exactly one final gate: `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`. Durable `DECISIONS.md`, `PROGRESS.md`, and `ACTIVE.md` updates MUST cite verified facts and blockers, and MUST NOT advance Week 01 unless every completion gate is proven. `0061+` MUST remain unsafe while any provenance, identity, authorization, discrepancy, validation, type-preservation, or recovery gate is missing, unavailable, failed, or unreviewed. (Previously: the packet published one gate and a migration-allocation answer.)

#### Scenario: Evidence packet completes before closure
- GIVEN the evidence packet is reproducible but an operational prerequisite is unavailable
- WHEN durable status is updated
- THEN the packet may complete, the sole final gate is `BLOCKED`, and Week 01 remains active
