# Apply Progress: week-01-recovery-runner

## Mode

Strict TDD; single approved stacked-to-main slice; external-free pure model.

## Completed Tasks

- [x] 1.1–1.3 RED contract, lifecycle, receipt/resource/reconciliation/manifest tests.
- [x] 2.1–2.3 immutable model, reducer, reconciliation, and manifest implementation.
- [x] 3.1 direct test suite GREEN.
- [x] 3.2 lint, line-count, diff, and boundary checks.
- [x] Bounded strict-TDD correction: replay validation, trap-safe snapshots, cleanup/resource gates, attestation recomputation, terminal derivation, and exact reconciliation formula.
- [x] Final narrow strict-TDD correction: exact invariant branches, active public-branch trap normalization, direct unknown/reconcile/hash assertions, same-category winner, and unfiltered six-category application across all 720 generated orders.
- [x] Nested strict-TDD correction: revoked nested-slot normalization, terminal primitive guards, and exact pre-replay stored ID/receipt/resource invariant mapping.
- [x] Final localized strict-TDD correction: stored cleanupHash/owner resource classification, all-state/event probing, and per-event malformed-schema coverage.
- [x] Final strict-TDD priority correction: stored receipt sequence mapping, semantic receipt/resource duplicate precedence, explicit 90-cell outcome assertions, and finalized same-category winner coverage.

## Correction TDD Cycle Evidence

| Work unit | RED | GREEN | REFACTOR |
|---|---|---|---|
| Pure model and contract suite | New stored-sequence, mixed-priority, explicit outcome-matrix, and finalized-winner probes were added as RED before GREEN | 22 tests passed, including 720 unique orders × 6 applied categories, 90 explicit state-event outcomes, and 27 malformed event-schema probes | Fixed order is snapshot/schema → semantic receipt/resource duplicate → terminal/state gate → reference checks → semantic reduction; retained hostile normalization |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --test tests/recovery-runner-model.test.mjs` — 22 passed, 0 failed; 720 unique generated orders, 4,320 category applications, 90 explicit state-event outcomes, 27 malformed-schema probes, 5 malformed sequence variants + zero-valid + duplicate + gap assertions |
| Core test command and exact result | `npm run test:recovery-harness` — 17 passed, 0 failed |
| Runtime harness command/scenario and exact result | N/A: external-free synchronous pure model has no runtime boundary |
| Rollback boundary | Revert `scripts/recovery-runner-model.mjs` and `tests/recovery-runner-model.test.mjs` only; no core/package/image changes |

## Boundary

Physical authored lines: 401 combined (158 implementation + 243 tests), below the 650-line cap. `npm run lint` passed with zero errors and zero warnings. The unrelated image remained unchanged at worktree SHA-256 `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`, worktree blob `651b57a0dc46a1cf240f7c31b195769e134bbd1a`, HEAD blob `9f36d20de078381756ba42d334be082ffd1ed888`. Interpretation remains exactly `orchestration-only-not-recovery-evidence`.

## Correction Fixes

- Receipt records now project exactly `{commandId,sequence,status,outputHash}`.
- Every public operation snapshots and validates nested model structures; revoked/throwing model and event proxies normalize to closed errors.
- Reconciliation scans pending failures for secrets but hashes exactly the three normalized event, receipt, and resource strings.
- `RECONCILE` before `cleaned` maps to `ERR_TRANSITION`; automatic receipt failures deduplicate.
- Ordering uses deterministic code-point comparison rather than locale collation.
- State, records, terminal values, and reconciliation attestations are accepted only when replay derives the supplied model.
- Invalid model state, stored receipt hash, duplicate stored failure, and malformed terminal records now select `ERR_TRANSITION`, `ERR_RECEIPT_SET`, `ERR_DUPLICATE`, and `ERR_TERMINAL` respectively; manifest validation preserves malformed-terminal `ERR_TERMINAL`.
- Reflective model/event traps, including traps throwing a captured internal error, normalize to fixed `ERR_MODEL_INPUT`/`ERR_EVENT_SCHEMA` details without leaking the trapped error.
- Reconciliation secret scanning is directly asserted over exactly the three canonical ordered strings; same-category failures select the ascending safeCode winner.
- Revoked arrays now normalize `Array.isArray` traps to the active branch; terminal category/code values require primitive strings before set/regex checks.
- Stored command/resource IDs, receipt/resource identity, unknown references, and receipt/resource ordering are classified locally before replay comparison: duplicate, unknown, receipt-set, and resource-set branches remain observable and safe.
- Stored cleanupHash values and ownerCommandId defects now map to `ERR_RESOURCE_SET` with `{field:'resource',reason:'invalid'}`; descriptor access remains normalized as `{field:'resource',reason:'missing'}` under `ERR_MODEL_INPUT` without leaking text. Resource history/hash mismatches are classified before replay fallback.
- Stored negative, non-safe, non-number, non-integer, and malformed receipt sequences map to `ERR_RECEIPT_SET` with `{field:'receipt',reason:'invalid'}`; duplicate command/sequence identities remain `ERR_DUPLICATE`, and reconciliation gaps remain `ERR_RECEIPT_SET`/`incomplete`. Sequence zero is explicitly valid.
- Event application checks semantic receipt/resource identity duplicates before state and reference checks; mixed duplicate+unknown or duplicate+late cases therefore return `ERR_DUPLICATE` first. The explicit matrix asserts every one of the 90 state/event cells, including successful transitions and exact error codes.
