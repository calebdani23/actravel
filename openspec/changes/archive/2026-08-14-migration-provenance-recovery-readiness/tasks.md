# Tasks: Migration Provenance and Recovery Readiness

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated authored changed lines | 300–420 lines across 8–10 Markdown/check artifacts |
| Estimated files | 8–10 |
| Dominant risk | False readiness from inferred remote provenance or untested recovery |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Delivery strategy | single-pr-default; one PR preferred |
| Maintainer `size:exception` required | Yes, before apply; the single-PR plan accepts the possible 400-line overage |
| Recommended boundary | One packet-only PR; keep repository evidence and external prerequisite records visibly separate |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Capture identity, inventory, hashes, and evidence contracts | PR 1 | packet validation script/checks | N/A: repository-only | Remove/supersede packet evidence files |
| 2 | Reconcile claims and classify all discrepancies | PR 1 | duplicate/required-field checks | N/A: no live access without approval | Revert comparison/register artifacts |
| 3 | Record recovery prerequisites and final fail-closed gate | PR 1 | gate decision checks | N/A unless approved disposable target exists | Revert recovery/gate artifacts |

## Phase 1: Repository Evidence Foundation

- [x] 1.1 Create `identity.md` with fresh HEAD, branch, worktree state, migration order/checksums, protected-path hashes, sanitized environment identity, SHA-256 conventions, UTC timestamps, and source/collector roles.
- [x] 1.2 Create `evidence-ledger.md` using immutable IDs and all contract fields; separate local bytes, remote ledger, live behavior, generated types, source limitations, and unavailable external evidence.
- [x] 1.3 Preserve the existing `specs/baseline-reconciliation/spec.md` delta and validate it against packet outputs; preserve `lib/supabase/database.types.ts`, migration files, and archived artifacts unchanged. Normalize the design reference to the actual change-local `specs/baseline-reconciliation/spec.md` path; do not edit the living spec.

## Phase 2: Reconciliation and Ownership

- [x] 2.1 Create `documentation-executable-comparison.md`; pair every in-scope claim with executable evidence or explicit missing/divergent status, including exact archived-to-current Git path/mode/hash evidence and provenance limitations.
- [x] 2.2 Create `discrepancy-register.md` with exactly one state for `0051`, rate-limit policy, `0020`, `0044`–`0049`, and `0057`/`0060`; include evidence refs, owner, authorizer, disposition, status, and source-time traceability.
- [x] 2.3 Add a role/authorization register to the ledger or register: collector, provider/maintainer owner, recovery operator, and decision authority remain distinct; absent approval is blocking.

## Phase 3: External Prerequisites and Gate

- [x] 3.1 Create `recovery-readiness.md`; record approved sanitized target, read-only plan, backup/hash, restore procedure/version, results, cleanup, sign-off, or explicit `requested`/`unavailable`/`failed` blockers. Never fabricate operator evidence.
- [x] 3.2 Create `final-gate.md` with one deterministic `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP` result; require every repository, remote, target, authorization, discrepancy, contradiction, and recovery gate before marking `0061+` safe.
- [x] 3.3 Document that absent target approval means no live inspection; approved inspection is read-only. Explicitly reject DDL/DML, migration/history mutation, repair, allocation, placeholder migrations, regeneration, schema/RLS/RPC, application code, and remote mutation.

## Phase 4: RED Verification and Boundaries

- [x] 4.1 Add RED checks for missing/contradictory evidence, unsafe or unauthorized targets, failed/unavailable rehearsal or cleanup, duplicate discrepancy states, and prohibited operations; verify each fails closed.
- [x] 4.2 Add RED checks for incomplete documentation/executable pairs and premature edits to `openspec/specs/baseline-reconciliation/spec.md`; verify generated-type drift and archived immutability remain recorded.
- [x] 4.3 Verify hashes, exact available source timestamps, required owner/authorizer fields, migration ordering, exclusive states, gate uniqueness, and packet-vs-external evidence separation; run only labeled repository checks (no database execution).

> **Post-verification/archive note — not an implementation task:** After successful packet verification and archive, consolidate the existing change-local delta into the living spec only through the authorized archive workflow; otherwise leave it untouched. Record verified state and decisions in `docs/PROGRESS.md` and `docs/DECISIONS.md` only during later authorized closeout. These actions occur after all checkboxes are complete and are not prerequisites for native verify.
