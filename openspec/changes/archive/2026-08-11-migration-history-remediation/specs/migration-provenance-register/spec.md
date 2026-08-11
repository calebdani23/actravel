# Migration Provenance Register Specification

## Purpose

Create a read-only, auditable register and evidence packet that records migration provenance without changing live behavior or allocating a new migration.

## Requirements

### Requirement: Record one exclusive classification per discrepancy

The register MUST assign exactly one classification to every discrepancy: `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`. It MUST NOT infer provenance from final schema state or infer a local migration body from a remote ledger row.

#### Scenario: Evidence is incomplete
- GIVEN sources are missing or contradictory
- WHEN a discrepancy is registered
- THEN it is classified `ambiguous/manual-review`, with no repair or replay authorized

### Requirement: Preserve auditable identity and evidence

Each entry MUST record migration and object identities; local and remote names; checksums or statement hashes only where authorized; behavior plane, ledger plane, local representation plane, and type plane; evidence source and timestamp; owner; blocker; disposition; and authorization state. Project and environment identity MUST be sanitized and MUST contain no secrets.

#### Scenario: An entry is reviewable
- GIVEN local files, remote ledger/statements, metadata, schema/RLS checks, tests, or backup metadata are available
- WHEN the packet is produced
- THEN a reviewer can trace each field to a source and time without credentials or secret values

### Requirement: Apply the approved discrepancy dispositions

The register MUST classify remote `0051` and `drop_public_rate_limits_write_policy` as `remote-only/untracked`, blocked pending authoritative provenance; local `0020` and remote placeholders `0044`–`0049` as `ambiguous/manual-review`; and local `0057` as `local pending`, absorbed by `0060`, not replayed. No entry may authorize a compensating migration.

#### Scenario: Known cases are closed
- GIVEN the named local and remote findings are inspected
- WHEN dispositions are reviewed
- THEN each has the exact classification, blocker, owner, and authorization state above

### Requirement: Preserve behavior and recovery invariants

The packet MUST verify without mutation that RLS, authorization, CRM governance, quote cutover, purge, archive/restore, helper grants, and data-integrity invariants remain preserved. A disposable local-stack backup/restore rehearsal MUST record commands, inputs, timestamps, outcomes, and deterministic `failed` or `unavailable` classifications.

#### Scenario: Local rehearsal succeeds
- GIVEN a disposable local stack and backup metadata are available
- WHEN backup and restore are rehearsed
- THEN evidence records the result and explicitly states that local proof does not establish remote or production restore readiness

### Requirement: Keep repair and parallel work bounded

This change MUST NOT create historical/no-op local migrations, compensating migrations, DDL/DML, production mutations, tracked type regeneration, or `0061+`. Future provider-native repair MUST be a separate maintainership decision requiring exact provenance, recovery evidence, rehearsal, and separately explicit production authorization. `dependency-baseline` MAY inventory and verify manifests/lockfiles only and MUST fail closed on migration, schema, type, or database scope drift.

#### Scenario: Scope drift appears
- GIVEN a dependency-baseline activity requests migration, schema, type, or database work
- WHEN scope is evaluated
- THEN it stops as a deterministic blocked finding and performs no such work
