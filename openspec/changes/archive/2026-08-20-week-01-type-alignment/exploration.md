## Exploration: week-01-type-alignment

### Current State
The Week 01 parent remains active and `BLOCKED`; its next bounded action is isolated type compatibility without tracked regeneration. The archived `week-01-captured-type-tsc` slice already established a deterministic, read-only compiler diagnostic and verified the exact ignored snapshot identity. The protected candidate is `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, with SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`, 113159 bytes, and 3697 LF lines. The archived evidence reports zero baseline/candidate diagnostics and a compatible captured-snapshot result, but it did not modify tracked types or evaluate the full application validation surface.

The tracked generated contract is `lib/supabase/database.types.ts`. Earlier evidence records its protected preimage as mode `100644`, SHA-256 `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436`, with a deterministic non-equal comparison of 1,105 additions, 765 deletions, and 2,238 unified-diff lines. The snapshot exposes 35 tables and 57 functions versus 47 functions in the tracked file, so consumer compatibility must be proven after the exact byte replacement; it must not be inferred from the captured compiler result.

This child is a mechanical alignment slice, not generation or provider evidence. It should copy the already captured bytes exactly into the one tracked generated file, preserve/verify the required mode and protected preimage, record the new hash and semantic generated diff ledger, then validate consumers. The implementation source allowlist is exactly `lib/supabase/database.types.ts`; planning and progress artifacts are evidence, not implementation targets. Generated lines remain part of review identity and rollback evidence, but are not charged to the authored-line budget. Any application or test source change needed to make consumers pass is a stop condition and belongs to a later child.

### Affected Areas
- `lib/supabase/database.types.ts` — the sole generated tracked file permitted to change; replace only with the exact captured bytes.
- `tmp/audit-evidence/baseline-reconcile-remote-types.ts` — ignored, fixed-path/fixed-hash source artifact; read-only input and identity guard, never a generated output target.
- `scripts/captured-type-tsc.mjs` — existing captured diagnostic; rerun directly as evidence before/around alignment, without changing its contract or source.
- `tests/captured-type-tsc.test.mjs` — existing diagnostic contract suite; confirms the captured-input guard remains intact.
- `tests/*quote*.test.*`, `tests/*contract*.test.*` — existing quote and generated-type consumer contracts that must be selected by the validation plan; failures requiring edits block this child.
- `package.json` / `tsconfig.json` — inspection-only command and compiler configuration context; no changes are in scope.
- `openspec/specs/baseline-reconciliation/spec.md` and archived `week-01-captured-type-tsc` evidence — governing boundaries and historical inputs; neither establishes fresh provenance or Week 01 closure.

### Approaches
1. **Exact guarded copy (recommended)** — verify the tracked preimage, snapshot path/hash/bytes/mode, copy the snapshot byte-for-byte to `lib/supabase/database.types.ts`, verify mode and postimage hash, and record a semantic diff ledger.
   - Pros: deterministic one-file change; no provider contact, generation, migration, or handwritten source edits; straightforward rollback and review identity.
   - Cons: does not prove provider provenance or schema history; may reveal consumer incompatibilities that require a follow-up child.
   - Effort: Low

2. **Regenerate from Supabase or a generation command** — invoke the existing `db:types` path or provider generation and compare the result.
   - Pros: could refresh types from a current source.
   - Cons: violates the exact-byte requirement and hard no-generation/provider boundary; risks changing the protected input and makes the result non-deterministic.
   - Effort: Not permitted

3. **Hand-edit types or adapt consumers** — manually reconcile declarations or fix application/test failures in the same child.
   - Pros: might make selected consumers compile.
   - Cons: violates generated-file integrity and no-handwritten-source scope; obscures whether the exact snapshot is compatible and expands rollback risk.
   - Effort: Not permitted

### Recommendation
Proceed with the exact guarded copy only. The implementation source allowlist is exactly `lib/supabase/database.types.ts`; this exploration and all planning/progress artifacts are evidence only, not implementation targets. No package, lockfile, config, application, migration, adapter, image, or parent implementation changes are allowed. The apply/verify record should include: protected preimage (path, mode, hash, bytes), exact copy result (mode, bytes, new SHA-256), semantic generated diff ledger (counts and stable patch/hash identity), captured diagnostic result, direct `tsc --noEmit` result, lint, a guarded build with external boundaries disabled, quote notifications, and generated-type contract tests. The build must be guarded so it cannot publish or contact external systems. Capture every pre-existing unrelated dirty path before execution and require its exact state to remain unchanged. An exact command-owned `next-env.d.ts` rewrite may be restored to its captured preimage without preventing PASS; a collision, unknown bytes, or failed restoration is `BLOCKED`. Do not run generation, provider operations, migrations, or any fresh provenance/closure workflow.

Generated changed lines are review identity and must be included in the diff/ledger and rollback accounting, but excluded from authored-line budget calculations. If direct `tsc`, build, quote notifications, or generated-type contracts expose an application consumer failure, stop with the failure recorded; do not edit consumers in this child. Push/delivery remains externally blocked by missing GitHub credentials and is not a reason to widen local scope.

### Risks
- The exact snapshot may be compiler-compatible yet fail broader application, build, quote, or generated-contract checks; this must remain a blocked follow-up rather than trigger app edits.
- A copy made without a byte/mode preimage guard could overwrite unrelated work or misrepresent the generated payload; fail closed on any preimage mismatch.
- The generated diff is large and can be mistaken for authored work; retain it in review identity while keeping authored accounting separate.
- The snapshot is historical captured evidence, not fresh provider provenance, schema alignment proof, recovery readiness, permission for `0061+`, or Week 01 closure.
- Existing unrelated worktree changes, including the known image path, are allowed only when captured and unchanged; no provider contact or mutation is allowed.
- Rollback must preflight its targets, then restore the generated type preimage and any exact command-owned `next-env.d.ts` preimage unless either rollback target collided. It never touches unrelated dirty paths, whose captured unchanged presence does not stop rollback.

### Ready for Proposal
Yes — authorize a single-file, exact-byte alignment proposal with protected preimage/postimage guards and the stated validation ledger. The proposal should explicitly make any consumer failure a stop condition for a later child, preserve the parent `BLOCKED` status, and exclude generation, provider contact, migrations, handwritten source changes, and fresh provenance/closure claims.
