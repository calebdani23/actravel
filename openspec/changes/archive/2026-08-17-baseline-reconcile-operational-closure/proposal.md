# Proposal: Baseline Reconciliation Operational Closure

## Intent

Collect available Week 01 evidence and publish a deterministic repository/remote/type/test comparison. Make blockers explicit; proposal completion is not Week 01 closure.

## Scope

### In Scope
- Capture append-only Git, migration/checksum, protected-path, dependency, and validation evidence.
- Collect read-only metadata/catalog evidence from ref `bdyhakpmxegoipbmbtjb`; generate types outside tracked paths and compare without overwrite.
- Classify every named discrepancy once; separate repository/provider/operator evidence; publish one `BLOCKED` gate and verified facts in `docs/DECISIONS.md`, `docs/PROGRESS.md`, and `docs/implementation/ACTIVE.md`.
- Define a separately gated disposable rehearsal, recording `unavailable` when identity, authorization, tooling/cost, backup, cleanup proof, or independent sign-off is missing.

### Out of Scope
- Any DDL/DML, migration/history repair, push/reset, provider-native repair, `0061+`, type overwrite/regeneration, application changes, production smoke, real Resend/Meta traffic, or destructive cleanup.
- Treating schema, archived packets, Docker, or local tests as provenance, recovery, authorization, or production evidence.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `baseline-reconciliation`: formalize separated evidence, gated rehearsal, and the single blocked final gate.

## Approach

Use an append-only packet: inspect local state and the linked target read-only, normalize/hash artifacts, assign owner/authorizer/status, and record verified facts. Further live inspection waits for role and authorization. Rehearsal is a later gated slice.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/...` | New | Proposal and follow-up artifacts |
| `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/implementation/ACTIVE.md` | Modified | Verified facts, blockers, gate; retain Week 01 unless proven |
| `db/migrations/`, `lib/supabase/database.types.ts` | Read-only | Inventory and type comparison |
| `docs/about/helps/intakes/image.png` | Preserved | Unrelated change |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Linked ref/ provenance ambiguous | High | Read-only boundary, role confirmation, labels, fail-closed gate |
| Docker creates recovery confidence | Med | Require native toolchain, target, cleanup proof, sign-off |
| Validation rewrites metadata | Med | Check status; preserve unrelated changes |

## Rollback Plan

Revert this proposal/evidence change and documented durable updates; remove temporary artifacts. Do not alter migrations, tracked types, databases, or the unrelated image.

## Dependencies

- Confirmed role/authorization, authoritative provenance, and approved disposable target with backup, native tooling, cost/credentials, cleanup, and sign-off.

## Success Criteria

- [ ] Every named finding has one disposition, owner/authorizer, source/time, and evidence reference.
- [ ] Local/remote/type/test comparison is reproducible and tracked types remain unchanged.
- [ ] Rehearsal is `verified` only with all required proof; otherwise `unavailable`.
- [ ] Exactly one final gate is published: `BLOCKED` until all required gates are proven; `0061+` remains unsafe.

## Proposal question round

Confirm whether authorization ownership and independent rehearsal sign-off are available. If not, record external blockers; do not make Week 01 closable by assumption.
