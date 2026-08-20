# Tasks: Week 01 Recovery Runner Model

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 600–640 physical authored lines across the two files |
| 400-line budget risk | High |
| Chained PRs recommended | No — one approved implementation slice |
| Suggested split | Single PR, stacked-to-main |
| Delivery strategy | single-pr |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: High

Stop and rescope before review if the combined physical line count exceeds 650; do not split while claiming the same cap. Protected boundaries: no adapters, external calls, package/config changes, core changes, image behavior, publication/readiness evidence, or Week 01 closure claims. Evidence is limited to the direct node:test model suite and the exact interpretation `orchestration-only-not-recovery-evidence`. Rollback is a two-file revert of this slice only.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Pure model and exhaustive contract suite | PR 1 | `node --test tests/recovery-runner-model.test.mjs` | N/A: external-free pure model | Revert both listed files only |

## Phase 1: RED Contract Matrix

- [x] 1.1 Create `tests/recovery-runner-model.test.mjs` with failing `node:test` cases for Pure model boundary, Closed creation contract, and Closed constants and errors.
- [x] 1.2 Add RED lifecycle/failure tests for Monotonic lifecycle and Deterministic failures.
- [x] 1.3 Add RED receipt/resource/reconciliation/manifest tests for Closed receipts, Closed resources and cleanup gate, Pure reconciliation, and Terminal manifest envelope.

## Phase 2: GREEN Pure Model

- [x] 2.1 Create `scripts/recovery-runner-model.mjs` with the closed pure model boundary and safe immutable validators.
- [x] 2.2 Implement `createRunModel`, `applyRunEvent`, and immutable lifecycle reduction.
- [x] 2.3 Implement `reconcileRun` and `buildManifestEnvelope` with closed-set validation, hashes, projection, and canonical bytes.

## Phase 3: Verification and Boundary Review

- [x] 3.1 Run `node --test tests/recovery-runner-model.test.mjs`; all tests GREEN and report only `orchestration-only-not-recovery-evidence`.
- [x] 3.2 Count physical authored lines and verify the implementation boundary with diff checks and lint.

## Bounded Strict-TDD Correction

- [x] Correct replay binding, descriptor-safe snapshots, cleanup completeness, attestation verification, terminal derivation, and exact three-string reconciliation hashing.
- [x] Add RED probes for forged history, hostile nested structures, cleanup timing, stale/tampered attestations, terminal forgery, and reconciliation boundaries.
- [x] Final narrow strict-TDD correction: exact model-invariant branches, active-branch proxy normalization, direct unknown/reconcile/hash assertions, same-category winner, and all six categories applied in each of 720 generated orders.
- [x] Nested strict-TDD correction: revoked nested-slot normalization, terminal primitive guards, and pre-replay stored ID/receipt/resource invariant classification.
- [x] Final localized strict-TDD correction: stored cleanupHash/owner resource classification, 90 state-event probes, and 27 malformed event-schema probes.
- [x] Final strict-TDD priority correction: stored sequence mappings, semantic duplicate precedence, explicit 90-cell outcomes, and finalized same-category winner assertion.
