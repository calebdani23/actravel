```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1cfb476fd2e9355355edb11f04fa88b76c14bbba309b09296263b4973cfac1e2
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 12/12
scenarios: 13/13
test_command: node --test tests/recovery-runner-model.test.mjs
test_exit_code: 0
test_output_hash: sha256:64c343c616c7ee5baf628efbc21a1f4d22846efea94a85fbdb46652b14d37de2
build_command: npm run lint
build_exit_code: 0
build_output_hash: sha256:27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf
```

# Verification Report

**Change:** `week-01-recovery-runner`
**Attempt:** `sha256:7d48826fb4953de16edf509ecd22a386f8690833dc16c19cdbdb0d904b66036e`
**Mode:** Strict TDD
**Verdict:** **PASS WITH WARNINGS**

## Completeness

| Dimension | Result |
|---|---:|
| Requirements | 12/12 verified (11 added, 1 modified) |
| Scenarios | 13/13 covered by passing runtime checks |
| Tasks | 13/13 checked complete |
| Implementation scope | 401/650 physical authored lines |
| Changed implementation files | Exactly the model and its test file |

All proposal, specification, design, tasks, and apply-progress artifacts were read. The implementation imports the four committed core functions, exports exactly the seven required names, and adds no adapter, package, dependency, or external-system behavior. Core and protected application boundaries remain unchanged.

## Runtime Evidence

| Command | Exit | Result | Output hash |
|---|---:|---|---|
| `node --test tests/recovery-runner-model.test.mjs` | 0 | 22 passed, 0 failed; 720 permutations / 4,320 category applications; 90 state-event cells; 27 malformed schemas | `sha256:64c343c616c7ee5baf628efbc21a1f4d22846efea94a85fbdb46652b14d37de2` |
| `npm run test:recovery-harness` | 0 | 17 passed, 0 failed | `sha256:34d873bb7b1a4d5223fb367c489a98a39695aa3a903eafdd911d4c055486eb38` |
| `npm run lint` | 0 | zero errors and warnings | `sha256:27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf` |

No application build was declared or run for this external-free model slice. The envelope's required build fields intentionally record `npm run lint` as the static-validation command.

## Requirement and Scenario Compliance

| Area | Evidence | Status |
|---|---|---|
| Pure boundary, exports, constants, schemas, errors | Namespace/constants assertions, source inspection, lint | PASS |
| Creation, snapshots, immutability, hostile inputs | Accessor, sparse, symbol, cycle, throwing/revoked proxy, mutation tests | PASS |
| Lifecycle and all branches | 90 explicit state/event outcomes; terminal absorption and cleanup timing | PASS |
| Failure precedence | All 720 orders, six categories per order, same-category code ordering | PASS |
| Receipts/resources/cleanup | Identity, sequence, ownership, release, completeness, late/unknown/duplicate checks | PASS |
| Reconciliation/attestations | Equivalent entry points, exact three-string hashes, secret scan, non-mutation, tamper rejection | PASS |
| Manifest | Terminal-only envelope, trace, canonical UTF-8, fresh bytes, external hash, no self/publication fields | PASS |
| Scope and interpretation | 401/650 line gate; no package/core/image/external behavior; exact `orchestration-only-not-recovery-evidence` | PASS |

## Design and Task Verification

The reducer is synchronous, deterministic, recursively frozen, replay-bound, and preserves prior models. Cleanup records assertions only; it does not execute cleanup. Reconciliation and manifest construction verify closed sets and attestations without publication. All checked task units, including the strict-TDD correction probes, are supported by source and runtime evidence.

Committed code slice `4725d2a` is present on `main` and `origin/main`; its tree contains the two implementation files with 158 + 243 = 401 lines. Approved code review lineage `review-57fdcb6845936901` has preserved final evidence with outcome `passed` / overall `PASS` for the candidate scope. Its code target is `sha256:57fdcb6845936901d2b85c5ddd2754265e2a249c06e52c4d017effb9e6239e0a`. The exact interpretation is `orchestration-only-not-recovery-evidence`. This verification report itself has not been reviewed; a distinct report-only review follows.

## Warnings and Scope

- This verifies orchestration only. It does **not** prove command execution, backup/restore, cleanup execution, provider status, migration provenance, operational readiness, or Week 01 closure.
- No lifecycle commands, external systems, provider/database/Docker operations, or publication operations were called.
- Existing unrelated worktree changes were left untouched.

## Rollback and Archive Recommendation

Rollback is limited to reverting `scripts/recovery-runner-model.mjs` and `tests/recovery-runner-model.test.mjs`; no package, core, migration, application, image, or external rollback is required. The implementation slice is suitable for OpenSpec archival after normal maintainer acceptance, but archive metadata must preserve the warning that this is not recovery evidence and must not close the Week 01 operational gate.
