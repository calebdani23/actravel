# Delta for Baseline Reconciliation

## ADDED Requirements

### Requirement: Guard production inspection
The packet MUST verify the exact production ref and URL first. Production MUST remain read-only: no DDL, DML, repair/replay, or provider mutation.

#### Scenario: Identity passes
- GIVEN ref and URL match the identity
- WHEN inspection runs
- THEN read-only evidence is captured

#### Scenario: Identity fails
- GIVEN either identity is missing or mismatched
- WHEN an operation is requested
- THEN it fails closed

### Requirement: Capture honest provider dispositions
Every provider statement/definition and discrepancy MUST include source, UTC time, owner, authorizer, verifier, classification, and disposition. Approved `accepted` or `no-replay` MUST preserve classification and MUST NOT imply provenance.

#### Scenario: Disposition is reviewed
- GIVEN evidence and metadata exist
- WHEN the maintainer approves a disposition
- THEN classification remains traceable

#### Scenario: Evidence is incomplete
- GIVEN any statement, definition, classification, or approval is missing
- WHEN closure is evaluated
- THEN the finding blocks

#### Scenario: Absent migration has equivalent durable effects
- GIVEN the authoritative 59-row ledger proves `0057` is absent, normalized local/production `0060` bytes match, and live catalog effects equal the intended `0057` outcome
- WHEN the maintainer explicitly approves `ABSENT_WITH_EFFECT_EQUIVALENCE` under the bound recovery, category, provider, type, and prior-evidence receipts
- THEN the packet records truthfully that `0057` did not execute, authorizes no replay or repair, and the amended safety/provenance gate is satisfied without fabricating historical provenance

### Requirement: Require attributable review
Each gate MUST name owner, authorizer, verifier, and UTC evidence. Self-authorization or unverified review MUST NOT satisfy it.

#### Scenario: Review is independent
- GIVEN all roles and UTC evidence exist
- WHEN the verifier reviews the packet
- THEN the gate is eligible for evaluation

### Requirement: Prove local recoverability only
The rehearsal MUST boot isolated local Supabase/Docker from repository migrations, create an identified logical backup, restore into a second fresh disposable target, compare invariants, clean both targets/backups/secrets, and obtain independent verifier-agent sign-off. It MUST be labeled local-only.

#### Scenario: Rehearsal passes
- GIVEN bootstrap, migration, backup, restore, invariants, cleanup, and sign-off pass
- WHEN evidence is reviewed
- THEN local recoverability is verified

#### Scenario: Rehearsal fails
- GIVEN CLI/tooling, bootstrap, migration, restore, invariant, cleanup, or sign-off fails or is unavailable
- WHEN readiness is evaluated
- THEN recovery is unverified and closure fails closed

### Requirement: Isolate remote type compatibility
Remote-type tests MUST run in an isolated non-production context and preserve a tracked preimage. Failure MUST leave tracked types unchanged.

#### Scenario: Compatibility fails
- GIVEN the isolated test fails or requires app/schema changes
- WHEN the result is reviewed
- THEN regeneration and closure remain blocked

### Requirement: Gate regeneration and validation
Tracked `database.types.ts` regeneration MAY occur only after preliminary gates and compatibility pass. It MUST be followed by TypeScript, lint, build, tests, and evidence of no unintended app behavior change.

#### Scenario: Authorized slice passes
- GIVEN preliminary gates and compatibility pass
- WHEN regeneration and validation complete
- THEN update is accepted

#### Scenario: Validation fails
- GIVEN regeneration causes compatibility or validation failure
- WHEN closure is evaluated
- THEN no app/schema change is forced

### Requirement: Clean durable links
Stale durable archive links MUST be corrected or removed without unrelated changes. `docs/about/helps/intakes/image.png` MUST be preserved.

#### Scenario: Cleanup is bounded
- GIVEN stale links are identified
- WHEN documentation updates
- THEN only stale links change and image is unchanged

## MODIFIED Requirements

### Requirement: Publish a bounded final decision
The packet MUST publish exactly one final gate: `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`. Durable status updates MUST cite verified facts, and MUST NOT advance Week 01 or Week 02 unless every amended completion gate is proven. `0061+` MUST remain separately gated and MUST NOT be implied as automatically runnable. Under the explicit maintainer amendment, `ABSENT_WITH_EFFECT_EQUIVALENCE` satisfies the historical `0057` gate only when its absence, exact LF-normalized `0060` equivalence, live durable effects, no-replay authorization, and bound recovery/evidence receipts are all present; it does not establish that `0057` executed.

#### Scenario: All gates pass
- GIVEN every completion gate passes
- WHEN the gate is published
- THEN one `PASS` or `PASS WITH FOLLOW-UP` is recorded and Week 02 may become the next planning cycle after fresh independent verification

#### Scenario: A gate fails
- GIVEN any guard, evidence, review, recovery, compatibility, validation, cleanup, or sign-off gate fails
- WHEN the gate is published
- THEN exactly one `BLOCKED` result is recorded with no repair, replay, mutation, or history change
