# Proposal: Week 01 Recovery Runner Model

## Intent

Add one deterministic pure orchestration model that validates recovery-run event ordering, closed receipts/resources, cleanup gates, failure precedence, reconciliation hashes, and a terminal manifest envelope without executing or contacting anything. A passing model suite is only `orchestration-only-not-recovery-evidence`.

## Scope

### In Scope

- `scripts/recovery-runner-model.mjs` as the only future library file.
- `tests/recovery-runner-model.test.mjs` as the only future test file.
- Exact exports: `RUN_STATES`, `EVENT_TYPES`, `FAILURE_PRECEDENCE`, `createRunModel`, `applyRunEvent`, `reconcileRun`, and `buildManifestEnvelope`.
- Pure immutable validation, event reduction, receipt/resource accounting, cleanup gates, failure selection, reconciliation, secret scanning, and canonical terminal manifest construction.
- Direct read-only use of committed core `canonicalJson`, `sha256Hex`, `assertRuntimeToken`, and `scanSecrets`.
- One implementation slice whose total physical authored lines across library and tests is at most 650; forecast before implementation and count before review.

### Out of Scope

- Package scripts, dependencies, helpers, adapters, defaults, CLIs, or executable entry points.
- `child_process`, filesystem, socket, signal, clock, timeout, cancellation, network, provider, Docker, Supabase, Postgres, SQL, migration, application, generated-type, or image behavior.
- Actual command execution, timeout/signal mapping, resource cleanup execution, manifest publication, publication receipts, restore proof, readiness proof, or Week 01 closure.

## Public Contract

`createRunModel({runId,parentToken,commandIds,resourceIds})` validates exact closed input, primitive ID grammar `[a-z0-9][a-z0-9._-]{0,63}`, exact lowercase runtime token syntax, dense unique arrays, and disjoint command/resource ID sets. It stores only `sha256Hex(parentToken)`, sorts and snapshots IDs, and returns the exact deeply frozen model fields:

`schema,runId,parentTokenHash,interpretation,state,pendingFailures,commandIds,resourceIds,receipts,resources,events,reconciled,terminal`.

`applyRunEvent` accepts only the nine closed event schemas and returns a new model without mutating either argument. `reconcileRun` is exactly equivalent to applying `RECONCILE`. `buildManifestEnvelope` accepts only terminal models and returns `{envelope,bytes,sha256}` with no self hash or publication claim.

The internal, non-exported `RecoveryRunnerModelError` has `name === 'RecoveryRunnerModelError'`, `message === code`, and only the eleven codes `ERR_MODEL_INPUT`, `ERR_EVENT_SCHEMA`, `ERR_TRANSITION`, `ERR_DUPLICATE`, `ERR_UNKNOWN_ID`, `ERR_RECEIPT_SET`, `ERR_RESOURCE_SET`, `ERR_SECRET`, `ERR_RECONCILE`, `ERR_TERMINAL`, and `ERR_MANIFEST`. Its frozen details always contain `field` and `reason` and may contain only applicable `index`, `id`, or `eventType` keys. Fields are exactly `options|model|event|commandIds|resourceIds|receipt|resource|failure|manifest`; reasons are exactly `invalid|missing|unknown|duplicate|late|incomplete|secret|not_allowed|not_terminal`. A supplied index is non-negative, diagnostic identifiers are grammar-validated and secret-scanned before inclusion, and no inspected value, scanner finding, caller text, or native error text is exposed.

Error mapping is deterministic and exhaustive: creation/model input maps to `ERR_MODEL_INPUT`; event shape to `ERR_EVENT_SCHEMA`; invalid state/event pairing to `ERR_TRANSITION`; duplicate IDs/receipts/resources/failures/events to `ERR_DUPLICATE`; unknown references to `ERR_UNKNOWN_ID`; receipt completion/order/hash to `ERR_RECEIPT_SET`; resource ownership/release/cleanup to `ERR_RESOURCE_SET`; scan findings to `ERR_SECRET`; remaining cleaned reconciliation preconditions to `ERR_RECONCILE`; terminal event/model misuse to `ERR_TERMINAL`; and envelope/body/attestation build issues to `ERR_MANIFEST`. No other observable error is permitted.

## Lifecycle

The only state order is `created,preflight,running,cleaning,cleaned,reconciled,succeeded,blocked,failed,aborted`.

- `PRECHECK_OK` moves `created` to `preflight`.
- The first valid `COMMAND_RECEIPT` or `RESOURCE_ACQUIRED` moves `preflight` to `running`.
- `CLEANUP_STARTED` moves `preflight` or `running` to `cleaning`; no later receipt or acquisition is accepted.
- `RESOURCE_RELEASED` is accepted only in `cleaning` for an acquired, unreleased declared resource.
- `CLEANUP_COMPLETED` requires every acquired resource released and moves to `cleaned`.
- Non-cleanup `FAILURE_RECORDED` events are accepted only in `preflight`, `running`, or `cleaning`; category `cleanup` is accepted only in `cleaning` before `CLEANUP_COMPLETED`.
- `cleaned` accepts only `RECONCILE`; reconciliation requires complete secret-free closed sets and moves to `reconciled`.
- `FINALIZE` selects one terminal by fixed failure precedence, or `succeeded` when there is no failure.
- Every terminal state rejects every event.

Failures never skip cleanup, no failure event is accepted after cleanup completion, and reconciliation errors throw without mutating the model rather than becoming late failures. Precedence is exactly `secret->blocked`, `cleanup->failed`, `signal->aborted`, `timeout->failed`, `command->failed`, `preflight->blocked`; category order wins regardless of event order, with ascending `safeCode` as the same-category tie-breaker.

## Manifest Contract

The terminal envelope is exactly `{schema:'actravel.recovery-run-manifest/v1',body,attestations}`. Its body binds model schema, run identity and parent-token hash, interpretation, terminal record, sorted IDs, ordered receipts/resources/events, and state trace. Attestations are exactly `receiptSetHash`, `resourceSetHash`, `eventSetHash`, `reconciliationHash`, and `secretScan:{ok:true,hash}`.

`bytes` is canonical UTF-8 with no newline. The returned `sha256` hashes those bytes and is not embedded in the envelope. There is no path, write, rename, publication, or publication receipt.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/recovery-runner-model.mjs` | Future new file | Pure closed run model, reducer, reconciliation, and manifest envelope. |
| `tests/recovery-runner-model.test.mjs` | Future new file | Exhaustive external-free `node:test` contract coverage. |
| `scripts/recovery-harness-lib.mjs` | Read-only dependency | Reuse four committed core functions without changing exports. |

## Risks

| Risk | Mitigation |
|---|---|
| Hidden mutation or proxy leakage | Descriptor-aware snapshots, fixed errors, deep freezing, caller-mutation and hostile-proxy tests. |
| Event-order-dependent terminal result | Fixed exported precedence and sorted unique failure records. |
| Incomplete cleanup presented as terminal | Cleanup completion and reconciliation gates; no execution inference. |
| Manifest mistaken for recovery evidence | Exact negative interpretation and no adapters, publication, or readiness fields. |

## Rollback Plan

Revert only the single model implementation slice. No package, core, migration, application, or external-system rollback is involved.

## Success Criteria

- [ ] The two future files are the only implementation artifacts and total at most 650 physical authored lines; if forecast or actual total exceeds the cap, work stops for rescoping before review and is not split while claiming the same cap.
- [ ] Exact schemas, exports, transitions, failures, receipts, resources, reconciliation, and terminal manifest behavior are deterministic and immutable.
- [ ] Tests exhaust precedence permutations and cover all transition, identity, cleanup timing, closed error, reconciliation non-mutation, secret, mutation, proxy, ordering, and hash boundaries without external systems.
- [ ] The output states only `orchestration-only-not-recovery-evidence`; execution, cleanup action, publication, readiness, restore, and Week 01 closure remain deferred.
