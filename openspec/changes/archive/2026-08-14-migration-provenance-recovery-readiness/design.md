# Design: Migration Provenance and Recovery Readiness

This change creates a bounded, append-only, read-only packet answering whether a new migration identifier is safe. It refreshes evidence, records external prerequisites without inventing proof, and fails closed while provenance, target, recovery, or authorization is unresolved. Archived remediation artifacts remain historical and untouched.

## Technical Approach

Use immutable evidence records, one exclusive discrepancy register, and one final gate. Deterministic repository files hold evidence; provider and operator facts are explicit `requested`, `verified`, `failed`, or `unavailable` records. The packet does not modify database state, migration history, generated types, or application/schema files.

## Artifact Structure

Create these packet artifacts under this change:

| Artifact | Purpose |
|---|---|
| `identity.md` | Git HEAD/branch/tree state, environment identity, protected-path hashes, capture times. |
| `evidence-ledger.md` | Append-only evidence records and source limitations. |
| `documentation-executable-comparison.md` | Explicit comparison of documentation claims with executable repository/live evidence; records agreement, divergence, and limits without treating either as provenance proof. |
| `discrepancy-register.md` | Exactly one classification, owner, disposition, blocker, and authorization state for each named finding. |
| `recovery-readiness.md` | Target, backup, restore rehearsal, cleanup, operator evidence, or explicit unavailable/failed state. |
| `final-gate.md` | The sole `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP` decision and `0061+` safety answer. |

Archived files are cited by path as historical evidence; new IDs never edit or replace them.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Truth model | Keep four planes separate: local bytes, provider ledger, live schema/behavior, generated types. | One narrative; schema-based inference. | Prevents behavior or generated contracts being mistaken for provenance. |
| Evidence format | Bounded append-only Markdown records with stable IDs. | Mutable checklist; unbounded logs. | Deterministic diffs and supersession without erasing history. |
| External access | Approved-target/read-only gate before live inspection. | Implicit CLI/provider trust. | Prevents unsafe inspection or mutation and exposes missing authorization. |
| Recovery | Treat backup existence, restore rehearsal, cleanup, and sign-off as separate proofs. | “Backup exists” as readiness. | Recovery confidence requires tested restoration on an approved disposable target. |

## Evidence and Discrepancy Contracts

Each ledger record contains:

```text
id, plane, subject, source_kind, source_locator, captured_at_utc,
source_identity, content_hash, status, limitations, collector, authorization
```

Each documentation/executable comparison record additionally contains explicit `documentation_artifact`, `executable_artifact`, `comparison_result`, and `provenance_limitations` fields.

Hashes use SHA-256 over exact bytes or canonicalized output; timestamps are UTC ISO-8601. Provider identities are sanitized, never secrets. Missing or contradictory records are `unavailable`/`failed` and blocking. Each target finding (`0051`, rate-limit policy, `0020`, `0044`–`0049`, `0057`/`0060`) has exactly one state: `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`. State changes append a record referencing the prior ID.

Role boundaries are explicit: collector gathers repository/read-only evidence; provider/maintainer owner supplies authoritative ledger evidence; recovery operator owns rehearsal proof; decision authority approves the final gate or any future repair. No collector may authorize DDL/DML, migration execution/history mutation, provider repair, placeholder/compensating migration, generated-type regeneration, or application/schema change.

## Data Flow and Execution Gate

`repository snapshot → protected hashes/inventory → documentation/executable comparison → four-plane comparison → discrepancy register → recovery evidence → final gate`

The documentation/executable comparison pairs each relevant claim with its executable artifact or observed read-only behavior, records mismatches and missing counterparts, and labels documentation as contextual evidence only. Neither documentation nor schema/live behavior is accepted as proof of migration provenance.

Before live collection, require an approved non-production target, sanitized identity, named collector, read-only credentials/command plan, and scope approval. If any check fails, stop and record the prerequisite as blocked; never guess a target. External collection is a prerequisite record, not an implied capability.

## Recovery and Final Gate Algorithm

Record backup identity/hash, disposable target identity, restore procedure/version, times, restored-object checks, cleanup proof, and operator sign-off independently. Local tests, builds, Docker availability, and external-boundary-disabled tests cannot satisfy recovery proof.

The final gate evaluates: current identity; complete local inventory; authoritative ledger evidence or explicit blockers; exclusive classifications; read-only live-contract checks; preserved generated-type drift; approved target/authorization; successful rehearsal and cleanup; and absence of contradictions. `PASS` requires all required proofs and no blockers. `PASS WITH FOLLOW-UP` is allowed only for explicitly non-blocking follow-up items and never if provenance, target, recovery, rehearsal, authorization, or contradiction gates are missing. Otherwise emit exactly `BLOCKED` and state `0061+` unsafe.

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/migration-provenance-recovery-readiness/design.md` | Create | Technical design for the packet. |
| `openspec/changes/migration-provenance-recovery-readiness/{packet artifacts}` | Later create | Evidence and gate outputs only. |
| `openspec/changes/migration-provenance-recovery-readiness/documentation-executable-comparison.md` | Later create | Change-local evidence comparing documentation claims to executable evidence, with explicit provenance limitations. |
| `openspec/changes/migration-provenance-recovery-readiness/specs/baseline-reconciliation/spec.md` | Existing | Change-local delta specification for the modified `baseline-reconciliation` capability contract; not the living spec. |
| `openspec/specs/baseline-reconciliation/spec.md` | Archive consolidation only | Eventually consolidate the verified delta after successful packet verification and archive; do not edit the living spec during design or packet execution. |

## Testing and Validation

Validate hashes, UTC timestamps, protected `database.types.ts`, migration ordering, exclusive-state uniqueness, required fields, archived immutability, and final-gate rules with repository checks. The comparison artifact must populate both artifact fields for each in-scope documentation claim, pair it with executable evidence or an explicit missing/divergent result, and must not promote either source into provenance proof. Verify the change-local `baseline-reconciliation` delta against the final packet; only after successful verification and archive may it be consolidated into the living capability contract. Run lint/build/quote-notification checks only as labeled application evidence. RED cases cover missing/contradictory evidence, unsafe targets, failed/unavailable rehearsal, duplicate classifications, prohibited operations, incomplete documentation/executable pairings, and premature living-spec edits. No database execution is part of validation.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR, executable-classification, or process-integration boundary is introduced.

## Migration / Rollout and Rollback

No migration required. Rollback is deletion or supersession of this packet only; archived evidence remains unchanged. Any later provider repair requires a separate authorized change with exact provenance, recovery proof, rehearsal, rollback/ledger plan, and production authorization.

## Open Questions

- [ ] Which maintainer and recovery operator will provide the external prerequisite records?
- [ ] What approved disposable target and backup source are authorized?
