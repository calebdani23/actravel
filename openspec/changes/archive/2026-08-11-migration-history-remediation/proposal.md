# Proposal: Migration History Remediation

Create a read-only provenance register and evidence packet before migration allocation or database change, without inventing history or changing live behavior.

## Intent and Stakeholders

Provenance is non-reproducible across schema/RLS/functions, remote ledger, local files/checksums, and generated types. This risks authorization, CRM, quotes, purge, archive/restore, and data integrity, blocking `0061+`. Maintainers, operators, owners, and security reviewers need reproducible release and recovery evidence.

## Scope

### In Scope
- A register with exactly one exclusive state per finding: `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`.
- A sanitized project/environment identity (no secrets), source/hash inventory, live behavior/RLS comparison, preserved type-drift baseline, and evidence packet.
- Disposable Supabase local-stack backup/restore rehearsal evidence, with limitations recorded.
- Gate dispositions for remote `0051`, `drop_public_rate_limits_write_policy`, local `0020`, remote placeholders `0044`–`0049`, and local `0057` absorbed by `0060`.

### Out of Scope / Non-goals
- Production mutation, history/ledger repair, schema/DDL/DML, compensating migration, `0061+`, tracked type regeneration, or local historical/no-op files.
- Claiming backup/restore or remote/production restore readiness is proven.

## Capabilities

### New Capabilities
- `migration-provenance-register`: auditable discrepancy classifications and evidence.

### Modified Capabilities
- `baseline-reconciliation`: retain fail-closed, non-destructive, and type-regeneration gates.

## Approach and Required Decisions

Use defer-and-ledger-only. Sources are migration files, lockfiles, remote ledger/statements, archived reports, Supabase metadata, schema/RLS/helper checks, tests, and backup metadata. Record unresolved provenance; do not infer from final state. Local rehearsal cannot prove remote/production restore readiness; repair architecture is deferred.

The packet preserves RLS/authorization, CRM governance, quote cutover, purge, archive/restore, and data-integrity invariants. `0051` and the rate-limit row require authoritative provenance; `0020` and `0044`–`0049` remain manual review; `0057` is absorbed by `0060`, not replayed. Future migration is blocked by missing provenance, approved target, recovery evidence, rehearsal, or authorization.

`dependency-baseline` may proceed in parallel only for manifest/lockfile inventory and verification; it must not touch migrations, schema, generated types, or databases.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `openspec/changes/migration-history-remediation/` | New | Proposal/evidence |
| `db/migrations/`, Supabase metadata, tests | Read-only | Inputs |
| `lib/supabase/database.types.ts` | Preserved | Drift baseline; no regeneration |

## Risks and Rollback

| Risk | Mitigation |
|---|---|
| Guessed provenance changes security/integrity | Fail closed; exact evidence/authorization |
| Production target or untested recovery | Sanitize; classify unavailable; rehearse locally |
| Evidence mistaken for readiness | Explicit no-mutation/`0061+` gate |

Rollback only reverts the documentation register and packet; it implies no database rollback.

## Success Criteria

- [ ] Every discrepancy has one disposition, evidence source, owner, and blocker status.
- [ ] Identity, ledger/local comparison, CRM/quote/RLS checks, type diff, and local rehearsal results are recorded.
- [ ] Provider-native repair is identified as the only future ledger-repair candidate, separately authorized only after exact provenance and recovery/rehearsal gates.
