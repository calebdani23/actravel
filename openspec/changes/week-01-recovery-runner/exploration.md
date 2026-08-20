## Exploration: week-01-recovery-runner

### Current State

The committed recovery core already provides pure `canonicalJson`, `sha256Hex`, `assertRuntimeToken`, and `scanSecrets` functions. It performs no recovery-run orchestration, I/O, process execution, cleanup, publication, or readiness verification.

The previous runner plan mixed a state model with fake command, filesystem, clock, signal, and socket adapters. That surface was too broad for one reviewable micro-slice and could be mistaken for executable recovery evidence. This change is therefore normalized to a pure orchestration model only.

### Exact Boundary

Only these future implementation files are in scope:

- `scripts/recovery-runner-model.mjs`
- `tests/recovery-runner-model.test.mjs`

There is no package script, helper module, adapter, default, CLI, publication path, or integration surface. The slice does not use `child_process`, filesystem, sockets, signals, clocks, Docker, Supabase, Postgres, SQL, providers, migrations, application code, generated types, or images.

The model imports the committed core functions directly and does not change the core. Its exact public exports are:

- `RUN_STATES`
- `EVENT_TYPES`
- `FAILURE_PRECEDENCE`
- `createRunModel(options)`
- `applyRunEvent(model, event)`
- `reconcileRun(model)`
- `buildManifestEnvelope(model)`

### Closed Model

`createRunModel({runId,parentToken,commandIds,resourceIds})` accepts an exact plain object. Primitive IDs use `[a-z0-9][a-z0-9._-]{0,63}`. `parentToken` must pass `assertRuntimeToken`, which enforces an exact lowercase `sha256:` token. Command and resource ID arrays must be dense, unique string arrays; the two sets must be disjoint. Inputs are snapshotted, sorted, scanned, and never retained by reference.

The parent token is never stored. The model stores `sha256Hex(parentToken)` as `parentTokenHash` and returns exactly these deeply frozen plain fields:

`schema,runId,parentTokenHash,interpretation,state,pendingFailures,commandIds,resourceIds,receipts,resources,events,reconciled,terminal`.

The schema is `actravel.recovery-run-model/v1`; interpretation is exactly `orchestration-only-not-recovery-evidence`. Resource records are created for every declared resource ID so the closed set is explicit; nullable owner and cleanup hashes distinguish unacquired, acquired, and released records without an execution claim.

### Event Model

The exact state order is `created,preflight,running,cleaning,cleaned,reconciled,succeeded,blocked,failed,aborted`. The exact event types are `PRECHECK_OK`, `COMMAND_RECEIPT`, `RESOURCE_ACQUIRED`, `CLEANUP_STARTED`, `RESOURCE_RELEASED`, `FAILURE_RECORDED`, `CLEANUP_COMPLETED`, `RECONCILE`, and `FINALIZE`. Every event is an exact-key plain data object; unknown types, fields, accessors, sparse arrays, proxies that throw, and invalid values are rejected with a closed safe error.

The monotonic path is:

`created -> preflight -> running? -> cleaning -> cleaned -> reconciled -> terminal`.

The first command receipt or resource acquisition moves `preflight` to `running`. Cleanup can start from `preflight` or `running`. Receipts and acquisitions are forbidden once cleaning starts. Resource releases occur only while cleaning. Cleanup completion requires every acquired resource to have one release. Non-cleanup failures may be recorded in `preflight`, `running`, or `cleaning`; category `cleanup` may be recorded only in `cleaning`, before `CLEANUP_COMPLETED`. The `cleaned` state accepts only `RECONCILE`, so no failure event is accepted after cleanup completion. Reconciliation requires cleaned state and complete receipt/resource sets. Finalization is the sole event accepted from reconciled state. Terminal models reject every event.

`applyRunEvent(model, {type:'RECONCILE'})` and `reconcileRun(model)` are exactly equivalent. The latter exists as an explicit pure reconciliation boundary, not as an adapter or asynchronous action.

### Closed Error Contract

The internal, non-exported error has `name === 'RecoveryRunnerModelError'`, `message === code`, and one of exactly these codes: `ERR_MODEL_INPUT`, `ERR_EVENT_SCHEMA`, `ERR_TRANSITION`, `ERR_DUPLICATE`, `ERR_UNKNOWN_ID`, `ERR_RECEIPT_SET`, `ERR_RESOURCE_SET`, `ERR_SECRET`, `ERR_RECONCILE`, `ERR_TERMINAL`, or `ERR_MANIFEST`. Its frozen `details` has required `field` and `reason` plus only applicable `index`, `id`, or `eventType` members. Fields are limited to `options|model|event|commandIds|resourceIds|receipt|resource|failure|manifest`; reasons are limited to `invalid|missing|unknown|duplicate|late|incomplete|secret|not_allowed|not_terminal`.

An included `index` is a non-negative safe integer. Diagnostic identifiers must first match `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` and pass secret scanning; domain IDs and `safeCode` retain the stricter lowercase primitive grammar, and `eventType` must additionally be a known `EVENT_TYPES` member. Invalid or inspected text is omitted rather than echoed, scanner findings are never exposed, and `safeCode` is not a detail key.

Branch mapping is closed: malformed creation or model input maps to `ERR_MODEL_INPUT`; event object/type/field shape to `ERR_EVENT_SCHEMA`; an invalid state value or disallowed non-terminal state/event pairing to `ERR_TRANSITION`; duplicate IDs, receipts, resources, failures, or events to `ERR_DUPLICATE`; unknown declared-ID references to `ERR_UNKNOWN_ID`; receipt completion, sequence/order, or hash defects to `ERR_RECEIPT_SET`; resource ownership, release, or cleanup-gate defects to `ERR_RESOURCE_SET`; any scan finding to `ERR_SECRET`; cleaned-state reconciliation prerequisites not covered by the receipt/resource/secret branches to `ERR_RECONCILE`; terminal event/model misuse, including a terminal-only operation on a non-terminal model, to `ERR_TERMINAL`; and envelope/body/attestation construction defects after terminal acceptance to `ERR_MANIFEST`. Reflective, core, canonicalization, and encoding failures are normalized to the active branch. No native or additional observable error is allowed.

### Failure and Ordering Rules

Failure precedence is fixed and independent of event order:

1. `secret -> blocked`
2. `cleanup -> failed`
3. `signal -> aborted`
4. `timeout -> failed`
5. `command -> failed`
6. `preflight -> blocked`

Pending failures are unique by `(category,safeCode)` and sorted by precedence, then ascending `safeCode`. Safe codes use `[a-z0-9][a-z0-9._-]{0,63}` and are secret-scanned. A non-`ok` command receipt automatically adds the fixed failure `command/receipt-error`, `timeout/receipt-timeout`, or `signal/receipt-signal` unless already present. `FINALIZE` selects the first pending failure or emits `succeeded` when none exists.

Receipts are unique by command ID and sequence, sorted by sequence, and use exact lowercase SHA-256 output hashes. Reconciliation requires one receipt for every command ID and the final sequence set `0..n-1`. Resources are sorted by resource ID. Acquisition requires a declared resource and declared owner command; release requires a previously acquired, unreleased resource and an exact lowercase SHA-256 cleanup hash.

An attempted cleanup completion with an unreleased acquired resource is rejected without changing the model. Any cleanup failure must be represented by category `cleanup` in a `FAILURE_RECORDED` event while state is `cleaning` and before successful cleanup completion. Once cleanup completes, no failure event can be added. The model never invents cleanup execution or evidence.

### Reconciliation and Manifest

Reconciliation scans canonical event, receipt, and resource strings with the committed `scanSecrets`; validates exact closed sets; and computes immutable `receiptSetHash`, `resourceSetHash`, `eventSetHash`, `secretScan`, and `reconciliationHash` values. A reconciliation validation error throws its mapped closed error without mutating the cleaned model and is never converted into a late failure event. The event hash is projected over the accepted history plus the only legal next event, `FINALIZE`, so the terminal model's complete event list is bound without changing reconciliation after finalization.

`buildManifestEnvelope` accepts only a terminal model. It returns exactly `{envelope,bytes,sha256}`. `envelope` is exactly `{schema:'actravel.recovery-run-manifest/v1',body,attestations}`. The body binds the model schema, run identity, parent-token hash, exact interpretation, terminal record, sorted command/resource IDs, ordered receipts/resources/events, and derived state trace. Attestations contain the reconciled receipt, resource, event, reconciliation, and secret-scan hashes.

`bytes` is a fresh UTF-8 encoding of `canonicalJson(envelope)` with no trailing newline. `sha256` is `sha256Hex(bytes)` and remains outside the envelope. There is no self hash, publication receipt, path, or readiness statement.

### Test Strategy

- Assert the exact exports, frozen constants, exact schemas, all eleven error codes, deterministic branch mapping, safe optional details, and deep model immutability.
- Cover every legal transition and every invalid, late, terminal, duplicate, unknown, orphan, overlap, and missing-ID path, including cleanup-only failure timing and reconciliation-only `cleaned`.
- Cover dense arrays, caller mutation, accessors, throwing/revoked proxies, old-model preservation, and no retention of `parentToken`.
- Cover one receipt per command, unique contiguous sequences, all statuses, automatic failures, resource ownership, release gates, and cleanup/reconcile completeness.
- Exhaust all 720 category-precedence permutations and same-category `safeCode` ordering.
- Reject secret-like IDs/safe codes and re-scan canonical reconciliation inputs.
- Assert deterministic ordering and hashes, manifest non-self-reference, fresh bytes, canonical UTF-8 without newline, and no readiness claim.
- Use only built-in `node:test` and `node:assert/strict`; no external system, fake adapter, timer, signal, socket, filesystem, or race test exists.

### Delivery

Use one pure model implementation slice limited to the two future files. The sum of physical authored lines across `scripts/recovery-runner-model.mjs` and `tests/recovery-runner-model.test.mjs` must be at most 650; planning artifacts are excluded. Forecast the total before implementation and count the actual total before review. If either exceeds 650, stop and rescope before review; do not split delivery while claiming the same cap.

### Risks

- A mutable or permissive object could smuggle fields or secrets. Mitigation: exact descriptor-aware snapshots, closed errors, deep freezing, core scanning, and proxy tests.
- Event order could alter terminal precedence. Mitigation: sorted unique failures and a fixed exported precedence table.
- Reconciliation could omit finalization from the event attestation. Mitigation: hash the sole legal projected `FINALIZE` event during reconciliation and verify it after finalization.
- A manifest PASS could be overstated. Mitigation: the exact interpretation is `orchestration-only-not-recovery-evidence`, and all execution, cleanup action, publication, and readiness work is explicitly deferred.

### Ready for Proposal

Yes. There are no open questions. The proposal and specification must preserve this pure two-file boundary and defer actual command adapters, timeout/signal mapping, cleanup execution, filesystem publication, and all integration evidence.
