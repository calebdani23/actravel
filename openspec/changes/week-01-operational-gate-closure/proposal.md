# Proposal: Week 01 Operational Gate Closure

## Intent

Move Week 01 from `BLOCKED` to a proposed `PASS` using read-only evidence, compatibility checks, disposable local recovery, and the maintainer-approved `ABSENT_WITH_EFFECT_EQUIVALENCE` amendment. A fresh independent verifier retains final authority.

## Scope

### In Scope
- Prove ref, role, classification, and no-replay dispositions with owners, authorizer, verifier, and UTC evidence; record `0057` honestly as not executed and accepted only under the amended `ABSENT_WITH_EFFECT_EQUIVALENCE` rule.
- Bootstrap a disposable local Supabase stack from repository migrations; create an identified logical backup, restore it into a second fresh target, verify invariants, clean both, and obtain independent verifier-agent sign-off. This proves local recoverability only, not production restore.
- Run isolated remote-type compatibility tests. If preliminary gates pass and compatibility is clean, use maintainer authorization to regenerate `lib/supabase/database.types.ts` from the exact ref in a bounded final slice.
- Run TypeScript/lint/build/relevant tests, prove no unintended app behavior change, evaluate final gate, and correct stale durable links.

### Out of Scope
- Production DDL/DML, restore/recovery, ledger repair/replay, provider mutation, `0061+`, migration edits, app behavior/schema changes, archived evidence, or `docs/about/helps/intakes/image.png` (preserve image). Production is read-only.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `baseline-reconciliation`: role/disposition records, isolated type compatibility, local recovery evidence, the approved absent-with-effect-equivalence rule, and fail-closed closure gates.

## Approach

Sequence is non-circular: prove dispositions; verify local recovery; test remote-type compatibility; regenerate tracked types only after clean preliminary gates; run validation and behavioral checks; then evaluate the final gate. If compatibility fails or regeneration requires app/schema changes, remain `BLOCKED` and plan separate remediation—never force closure. Preserve read-only production, image, no-repair/no-replay/provider-mutation/`0061+` boundaries.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/specs/baseline-reconciliation/spec.md` | Modified | Closure/evidence requirements. |
| `docs/implementation/ACTIVE.md` | Modified | Final gate and Week 02 advance. |
| `docs/DECISIONS.md`, `docs/PROGRESS.md` | Modified | Evidence and link cleanup. |
| `lib/supabase/database.types.ts` | Conditional in this change | Exact-ref regeneration only in the bounded final slice. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ref/provenance, recovery, or compatibility proof fails | High | Fail closed; retain `BLOCKED`; discard artifacts. |
| Regenerated types require app/schema changes | Med | Do not force closure; plan separate remediation. |

## Rollback Plan

Revert documentation/link changes and bounded tracked-type regeneration; discard targets/backups/worktrees. Never reverse provider history; restore `ACTIVE.md` to `BLOCKED` if evidence is invalidated.

## Dependencies

- Maintainer authorization, local runtime, repository migrations, isolated credentials, and verifier sign-off.

## Success Criteria

- [ ] Every discrepancy has classification, disposition, owner, authorizer, source, and UTC time; `0057` absence is not relabeled as execution.
- [ ] Restore, invariants, cleanup, independent verification, and isolated type compatibility are evidenced.
- [ ] If regenerated, tracked types pass TypeScript/lint/build/relevant tests with no unintended app behavior change.
- [ ] One proposed final gate is published; Week 02 may become the next planning cycle only after a fresh independent verifier confirms all amended requirements. `0061+` remains separately gated.
