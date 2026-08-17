# Proposal: Migration Provenance and Recovery Readiness

## Intent

Create an independent, append-only readiness packet that refreshes migration provenance, environment identity, and recovery evidence before any new migration identifier is considered. The operational problem is that archived remediation evidence is stale and blocked, while local and remote history discrepancies remain capable of causing unsafe sequencing or false recovery confidence.

## Scope

### In Scope
- Refresh repository identity, protected-path hashes, migration inventory, and documentation-versus-executable evidence.
- Maintain an exclusive discrepancy register for `0051`, the rate-limit policy, `0020`, `0044`–`0049`, and `0057`/`0060`, with role-based owners and unresolved states where proof is absent.
- Collect read-only repository/live-contract evidence where an approved target permits it; record, gate, or fail closed on authoritative remote provenance, target identity, backup/restore rehearsal, cleanup, and operator authorization.
- Publish one final `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP` gate; `0061+` remains explicitly unsafe unless every required gate is proven.

### Out of Scope
- DDL, DML, migration execution or history mutation, provider-native repair, placeholder or compensating migrations, remote repair, and generated-type regeneration.
- Schema/RLS/RPC changes, data backfill, feature work, dependency-baseline work, or local historical files that could imply application.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `baseline-reconciliation`: strengthen the evidence packet, recovery-readiness gate, role-based ownership, source-time traceability, and explicit fail-closed `0061+` decision without mutation.

## Approach

Use the recommended evidence-and-recovery gate. Treat archived artifacts as historical inputs, separate local migration bytes, remote ledger, live behavior, and generated types, and classify each discrepancy exactly once. Repository/process evidence may be produced locally; provider history, environment authorization, backup/restore target, rehearsal, cleanup, and operator sign-off may only be requested, recorded, and gated. Preserve the generated-type drift baseline.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/migration-provenance-recovery-readiness/` | New | Evidence model, register, readiness checklist, and final gate artifacts. |
| `openspec/specs/baseline-reconciliation/spec.md` | Modified contract | Clarifies provenance, recovery, ownership, and fail-closed requirements. |
| `db/migrations/0020`, `0044`–`0049`, `0057`, `0060` | Read-only | Inspect as provenance-sensitive inputs; never replay. |
| `lib/supabase/database.types.ts` | Protected | Preserve unchanged and retain drift evidence. |

## Risks

| Risk | Likelihood | Mitigation |
|------|--------|------------|
| Guessed provenance or stale identity misstates readiness | High | Fresh hashes/timestamps, authoritative evidence, exclusive classifications, manual-review blockers. |
| Production-like target or untested backup is treated as safe | Med | Explicit environment/authorization gate; fail closed without disposable target and rehearsal proof. |

## Rollback Plan

No database or tracked schema/type mutation occurs. Delete or supersede the evidence packet; retain archived evidence unchanged. Any missing or contradictory proof returns `BLOCKED`, with no `0061+`, repair, or placeholder application permitted.

## Dependencies

- Role-authorized provider/maintainer access, sanitized target identity, approved disposable non-production target and backup, recovery operator sign-off, and separate authorization for any future ledger repair.

## Success Criteria

- [ ] Every named discrepancy has one traceable classification, owner, disposition, and authorization state.
- [ ] Repository evidence is current; archived identity is not presented as current remote proof.
- [ ] Recovery is verified by a documented rehearsal, or deterministically marked unavailable/failed and blocking.
- [ ] Final gate states whether migration allocation is safe; absent required external evidence keeps `0061+` unsafe.
