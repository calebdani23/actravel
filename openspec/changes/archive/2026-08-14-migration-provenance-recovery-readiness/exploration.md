## Exploration: migration-provenance-recovery-readiness

### Executive decision

Create a new, independent, read-only readiness change that closes evidence and process gaps around migration provenance and recovery. It must not repair history, allocate `0061+`, mutate Supabase, regenerate tracked types, or infer provenance from schema behavior.

### Current State

The archived `migration-history-remediation` packet is documentation-complete but its final gate is `BLOCKED`; next migration allocation is explicitly unsafe. The current checkout is now at `7e3ba3494e7831630a85fb5d3538d84670dc2118` on `main`, while the archived packet froze identity at `5db1ea37c5a4e7c7fdb88b76e82a7d51dbc4e7a8`. Therefore, the packet is useful historical evidence but requires a fresh identity/status capture before it can be treated as current.

The local migration chain contains 59 files through `0060` and omits local `0051`. Archived authoritative evidence records remote `0051`, a remote-only `drop_public_rate_limits_write_policy`, placeholder rows `0044`–`0049`, direct evidence for `0053`–`0056`, `0058`–`0060`, and no remote `0057`. Local `0020` and substantive local `0044`–`0049` remain unproven; local `0057` is behaviorally repeated by `0060`, but that does not establish ledger provenance.

The repository has no initialized or linked local Supabase project configuration. No approved non-production backup/restore target or successful recovery rehearsal exists. Generated database types have known drift and were intentionally not regenerated. Local lint, build, and quote-notification validation passed in the archived packet, but those results do not establish remote schema, migration, or recovery readiness.

### Verified Blockers

| Blocker | Current classification | What must change before a later migration tranche |
|---|---|---|
| Remote `0051` and rate-limit policy provenance | `remote-only/untracked` | Authoritative provider/maintainer evidence for identity, statement/body, application context, and disposition |
| Local `0020` provenance | `ambiguous/manual-review` | Evidence or an explicit accepted unresolved disposition; never replay by inference |
| Remote `0044`–`0049` placeholders | `ambiguous/manual-review` | Determine whether substantive behavior was applied through authoritative evidence, without treating placeholders as proof |
| Local `0057` versus remote ledger | `local pending` | Written decision documenting `0060` absorption and why no replay/history rewrite is allowed |
| Environment role and target | Incomplete | Fresh sanitized identity, project role, staging/non-production separation, and authorization owner |
| Recovery readiness | `unavailable` | Approved disposable target, backup input, restore procedure, rehearsal evidence, cleanup evidence, and operator sign-off |
| Generated type alignment | Blocked follow-up | Preserve the drift baseline; align only in a separately authorized step after schema/provenance gates pass |
| Provider-native history repair authorization | Not authorized | Separate maintainer decision with exact target, provenance, recovery proof, rehearsal, and rollback/ledger plan |

### Evidence Gaps and Required Evidence Plan

The new change should produce a bounded, append-only evidence packet with source timestamps and hashes where appropriate:

1. Refresh repository identity and protected-path status from the current checkout; distinguish documentation commits from executable/schema changes.
2. Obtain or explicitly mark unavailable authoritative remote ledger evidence for every discrepancy, retaining sanitized project identity and access/authorization ownership.
3. Keep the four truth planes separate: local migration bytes, remote ledger statements/rows, live schema and RLS behavior, and generated types. Record one exclusive disposition per discrepancy.
4. Verify targeted CRM, quote, purge, archive/restore, helper-grant, RLS, and data-integrity behavior read-only where an approved target permits it. Behavior can corroborate risk and compatibility, never prove migration provenance.
5. Define and execute, or fail closed on, a non-production backup/restore rehearsal. Local application tests and external-boundary-disabled checks must remain separately labeled from database recovery proof.
6. Preserve the generated-type diff and protected hash; do not regenerate `lib/supabase/database.types.ts` in this change.
7. Publish a single final gate (`PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`) that answers whether any new migration identifier is safe. Missing provenance, target identity, recovery evidence, rehearsal, or authorization must remain blocking.

### Affected Areas

- `openspec/changes/migration-provenance-recovery-readiness/` — new evidence/readiness packet; the only intended change area for this exploration and its later proposal.
- `openspec/changes/archive/2026-08-11-migration-history-remediation/final-gate.md` — archived `BLOCKED` decision and owners to carry forward as provenance, not as current proof.
- `openspec/changes/archive/2026-08-11-migration-history-remediation/evidence-ledger.md` — existing evidence IDs, hashes, classifications, and limitations to refresh or explicitly supersede.
- `openspec/changes/archive/2026-08-11-migration-history-remediation/migration-register.md` — discrepancy register for `0051`, policy row, `0020`, `0044`–`0049`, and `0057`/`0060`.
- `openspec/changes/archive/2026-08-11-migration-history-remediation/local-rehearsal.md` — prior `unavailable` recovery disposition and repository validation baseline.
- `openspec/specs/baseline-reconciliation/spec.md` — active invariants: exclusive classifications, read-only comparison, no type regeneration, fail-closed recovery, and explicit `0061+` block.
- `db/migrations/0020_catalog_media_columns_fix.sql`, `0044`–`0049`, `0057`, and `0060` — provenance-sensitive migration bodies; inspect only, never replay as part of this change.
- `lib/supabase/database.types.ts` — known generated contract drift; preserve unchanged during readiness work.
- `docs/implementation/ACTIVE.md` and `docs/implementation/weeks/week-01-baseline-safety.md` — current sequencing and the rule that no `0061+` or Business OS schema may begin before baseline safety is proven.

### Approaches

1. **Provider-native history repair now** — repair or reconcile remote ledger rows immediately.
   - Pros: could eventually restore a provider-consistent history without a new schema migration.
   - Cons: provenance is not yet exact, the target may be production-like, recovery is unproven, and ledger mutation can change future tooling behavior without changing schema.
   - Effort: High.
   - Decision: Reject for this change; requires a separate authorized change.

2. **Historical local files or no-op records** — add local representations for missing or placeholder history.
   - Pros: improves discoverability and may help maintainers map known discrepancies.
   - Cons: can falsely imply application, collide with sequencing, and cannot prove or repair remote provenance.
   - Effort: Medium.
   - Decision: Optional later audit aid only, explicitly non-authoritative; not part of the first slice.

3. **Compensating future migration** — add an additive migration for behavior believed to be missing.
   - Pros: append-only and testable when a real live-contract gap is proven.
   - Cons: does not solve provenance and can duplicate or alter unknown RLS/RPC/data-integrity behavior.
   - Effort: High.
   - Decision: Out of scope; consider only after a separate live-behavior finding and authorization.

4. **Evidence and recovery readiness gate (recommended)** — refresh identity, maintain the discrepancy register, obtain authoritative provenance where possible, rehearse recovery on an approved non-production target, and issue one fail-closed gate without database mutation.
   - Pros: reversible, auditable, low production risk, and directly resolves repository/process blockers that can be resolved here.
   - Cons: may leave unresolved external/operator prerequisites and keeps `0061+` blocked until proof exists.
   - Effort: Low to Medium.

### Recommendation and First Slice

Use approach 4 as a narrowly scoped independent change. The first slice should create the evidence model and acceptance gate, then collect only read-only or explicitly approved non-production evidence. It should refresh the stale archived identity, preserve the existing register as historical input, and classify each item as `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review` exactly once.

The slice can resolve through repository artifacts/process: evidence structure, ownership, source-time traceability, protected hashes, scope/authorization gates, explicit no-replay decisions, and a reproducible readiness checklist. It can only record and gate external/operator prerequisites: authoritative provider history access, production/staging role confirmation, approved backup/restore target, recovery operator sign-off, provider-native repair authorization, and any actual remote repair.

### Non-Goals

- No DDL, DML, migration execution, migration-history mutation, provider-native repair, placeholder application, compensating migration, or `0061+` allocation.
- No schema cleanup, RLS/RPC change, data backfill, remote query that mutates state, or generated-type regeneration.
- No claim that final schema behavior proves migration provenance.
- No claim that local tests, Docker availability, CLI documentation, or application build success proves backup/restore readiness.
- No dependency-baseline, Business OS schema, feature, or unrelated documentation work.

### Risks

- A guessed mapping for `0051`, `0020`, the rate-limit policy, or `0044`–`0049` could misstate security, authorization, purge, archive, or data-integrity history.
- A stale archived identity could be mistaken for current remote evidence unless refreshed first.
- An approved target may be production-like; accidental remote inspection or mutation must be explicitly denied by the execution gate.
- Recovery evidence can be overstated if backup existence is confused with a tested restore.
- Type regeneration can erase the diagnostic drift baseline and create false confidence.
- A readiness packet that lacks named owners and authorization states may be complete as documentation but still unusable as a release gate.

### Proposal Inputs

The later proposal must resolve or explicitly record:

- the owner authorized to obtain and approve migration provenance;
- the sanitized remote project identity and environment role;
- whether an approved disposable non-production target and backup source exist;
- the recovery rehearsal procedure, cleanup proof, and operator sign-off;
- whether dependency-only work may proceed independently while `0061+` remains blocked;
- whether local non-authoritative history representations are wanted;
- the decision authority and rollback semantics for any future provider-native ledger repair;
- acceptance of the invariant that no future migration identifier is safe while any required provenance, target, recovery, rehearsal, or authorization gate is missing.

### Ready for Proposal

Yes, for a read-only provenance and recovery-readiness proposal using the evidence-and-recovery gate. The proposal should remain independent of the archived remediation change, treat its artifacts as historical inputs, and preserve `0061+` as explicitly unsafe until every required external gate is proven.
