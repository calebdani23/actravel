# Design: Week 01 Recovery Runner Model

## Technical Approach

Add one synchronous ESM module, `scripts/recovery-runner-model.mjs`, and one external-free `node:test` file. The module is a pure immutable reducer and canonical manifest builder. It imports only committed core `canonicalJson`, `sha256Hex`, `assertRuntimeToken`, and `scanSecrets`; no core export changes or substitute canonical/hash/secret logic are allowed.

There are no adapters, promises, races, timers, signals, sockets, command calls, filesystem calls, publication calls, defaults, or executable entry points. The model records assertions supplied as closed events but does not perform or claim the underlying work.

## Exact Exports and Constants

The module exports exactly:

```js
RUN_STATES
EVENT_TYPES
FAILURE_PRECEDENCE
createRunModel(options)
applyRunEvent(model, event)
reconcileRun(model)
buildManifestEnvelope(model)
```

`RUN_STATES` is the frozen array:

```js
['created', 'preflight', 'running', 'cleaning', 'cleaned', 'reconciled',
 'succeeded', 'blocked', 'failed', 'aborted']
```

`EVENT_TYPES` is the frozen array:

```js
['PRECHECK_OK', 'COMMAND_RECEIPT', 'RESOURCE_ACQUIRED', 'CLEANUP_STARTED',
 'RESOURCE_RELEASED', 'FAILURE_RECORDED', 'CLEANUP_COMPLETED', 'RECONCILE',
 'FINALIZE']
```

`FAILURE_PRECEDENCE` is a frozen array whose records are also frozen:

```js
[
  { category: 'secret', terminal: 'blocked' },
  { category: 'cleanup', terminal: 'failed' },
  { category: 'signal', terminal: 'aborted' },
  { category: 'timeout', terminal: 'failed' },
  { category: 'command', terminal: 'failed' },
  { category: 'preflight', terminal: 'blocked' },
]
```

## Exact Schemas

All model, event, reconciliation, terminal, envelope, and attestation objects are exact-key plain enumerable data objects. Returned structural data is recursively frozen. Caller inputs are read through descriptor-aware snapshots so accessors, symbols, non-enumerable compensating fields, sparse arrays, inherited fields, and proxy failures cannot enter the model or leak native errors.

```js
/** @typedef {{runId:string,parentToken:string,commandIds:string[],resourceIds:string[]}} CreateOptions */
/** @typedef {{category:FailureCategory,safeCode:string}} PendingFailure */
/** @typedef {{commandId:string,sequence:number,status:'ok'|'error'|'timeout'|'signal',outputHash:string}} Receipt */
/** @typedef {{resourceId:string,ownerCommandId:string|null,cleanupHash:string|null}} Resource */
/** @typedef {{receiptSetHash:string,resourceSetHash:string,eventSetHash:string,reconciliationHash:string,secretScan:{ok:true,hash:string}}} Reconciliation */
/** @typedef {{state:'succeeded'|'blocked'|'failed'|'aborted',category:FailureCategory|null,safeCode:string|null}} Terminal */
/** @typedef {{schema:'actravel.recovery-run-model/v1',runId:string,parentTokenHash:string,interpretation:'orchestration-only-not-recovery-evidence',state:string,pendingFailures:PendingFailure[],commandIds:string[],resourceIds:string[],receipts:Receipt[],resources:Resource[],events:RunEvent[],reconciled:Reconciliation|null,terminal:Terminal|null}} RunModel */
```

The exact event union is:

```js
{ type: 'PRECHECK_OK' }
{ type: 'COMMAND_RECEIPT', commandId, sequence, status, outputHash }
{ type: 'RESOURCE_ACQUIRED', resourceId, ownerCommandId }
{ type: 'CLEANUP_STARTED' }
{ type: 'RESOURCE_RELEASED', resourceId, cleanupHash }
{ type: 'FAILURE_RECORDED', category, safeCode }
{ type: 'CLEANUP_COMPLETED' }
{ type: 'RECONCILE' }
{ type: 'FINALIZE' }
```

Primitive IDs and safe codes match `[a-z0-9][a-z0-9._-]{0,63}`. Hash fields other than `parentToken` are exactly 64 lowercase hexadecimal characters. `parentToken` is exactly lowercase `sha256:` plus 64 lowercase hexadecimal characters and must pass core `assertRuntimeToken`. Sequence is a non-negative safe integer.

Creation sorts command and resource IDs lexicographically after validating dense unique arrays and set disjointness. It scans IDs, stores `sha256Hex(parentToken)` only, initializes one resource record per declared resource, and never retains source references or the token.

## Internal Error Contract

The module defines but does not export `RecoveryRunnerModelError`. Its `name` is exactly `RecoveryRunnerModelError`. `message` is exactly the selected `code`, and code is one of:

```text
ERR_MODEL_INPUT
ERR_EVENT_SCHEMA
ERR_TRANSITION
ERR_DUPLICATE
ERR_UNKNOWN_ID
ERR_RECEIPT_SET
ERR_RESOURCE_SET
ERR_SECRET
ERR_RECONCILE
ERR_TERMINAL
ERR_MANIFEST
```

`details` is a frozen exact object with required `field` and `reason`, plus only applicable `index`, `id`, or `eventType`. Fields are exactly `options|model|event|commandIds|resourceIds|receipt|resource|failure|manifest`; reasons are exactly `invalid|missing|unknown|duplicate|late|incomplete|secret|not_allowed|not_terminal`. No other detail key exists, including `safeCode`.

An included `index` is a non-negative safe integer. Before inclusion, diagnostic `id` or `eventType` text must match `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` and pass `scanSecrets`; an `eventType` must also be in `EVENT_TYPES`. Domain IDs and `safeCode` retain the normalized lowercase subset `[a-z0-9][a-z0-9._-]{0,63}` and are scanned before retention. Invalid, untrusted, or inspected text is omitted, and scanner findings, tokens, proxy exceptions, causes, native messages, and stack text never appear.

Branch selection is closed and deterministic:

| Validation branch | Code |
|---|---|
| Creation input or model shape/invariant without a more specific branch | `ERR_MODEL_INPUT` |
| Event object/type/key/descriptor/required-field shape | `ERR_EVENT_SCHEMA` |
| Invalid state value or known event rejected by a non-terminal state | `ERR_TRANSITION` |
| Duplicate/overlapping IDs or duplicate receipt/resource/failure/event identity | `ERR_DUPLICATE` |
| Unknown command or resource reference | `ERR_UNKNOWN_ID` |
| Receipt completeness, sequence/order, or output hash | `ERR_RECEIPT_SET` |
| Resource ownership, acquisition/release, cleanup hash, or cleanup gate | `ERR_RESOURCE_SET` |
| Any scanner finding | `ERR_SECRET` |
| Remaining cleaned-state reconciliation precondition | `ERR_RECONCILE` |
| Event on terminal, malformed terminal use, or terminal-only call on non-terminal | `ERR_TERMINAL` |
| Envelope/body/attestation canonicalization, encoding, or build issue after terminal acceptance | `ERR_MANIFEST` |

Validation uses one fixed order: safe argument snapshots and outer exactness, event shape when present, secret safety, terminal guard, duplicate identity/history, non-terminal state/event gate, references, receipt/resource semantics, reconciliation-only checks, then manifest construction. More-specific model invariant checks use the same table rather than collapsing to `ERR_MODEL_INPUT`. Core, reflective, canonicalization, and encoding exceptions are normalized to the active branch; no caught exception or additional error is observable.

## State Reduction

Every successful reducer call creates a new recursively frozen model. The old model and event remain unchanged. Before reduction, the exact model schema and all internal invariants are revalidated so a caller-constructed or altered lookalike cannot bypass the state machine.

| Current state | Accepted event | Next state/effect |
|---|---|---|
| `created` | `PRECHECK_OK` | `preflight` |
| `preflight` | first command receipt/resource acquisition | `running` plus record |
| `preflight` | non-cleanup `FAILURE_RECORDED` | remain `preflight` |
| `preflight` | `CLEANUP_STARTED` | `cleaning` |
| `running` | command receipt/resource acquisition/non-cleanup failure | remain `running` |
| `running` | `CLEANUP_STARTED` | `cleaning` |
| `cleaning` | resource release/any failure category | remain `cleaning` |
| `cleaning` | `CLEANUP_COMPLETED` | `cleaned` after release gate |
| `cleaned` | `RECONCILE` | `reconciled` after complete validation |
| `reconciled` | `FINALIZE` | selected terminal state |
| terminal | none | reject every event |

All unlisted non-terminal combinations reject with `ERR_TRANSITION`, subject to the fixed duplicate and semantic-validation order above. Category `cleanup` is valid only while state is `cleaning` and before `CLEANUP_COMPLETED`; other failure categories are valid only in `preflight`, `running`, or `cleaning`. The `cleaned` state accepts only `RECONCILE`, so no failure event can arrive after cleanup completion. Work cannot arrive after cleaning starts, release cannot arrive outside cleaning, reconciliation cannot occur before cleaned, and terminal states are absorbing under `ERR_TERMINAL`.

`applyRunEvent(model,{type:'RECONCILE'})` delegates to the same internal operation as `reconcileRun(model)`. `reconcileRun` constructs the exact no-field `RECONCILE` event itself. No asynchronous behavior exists.

## Failure Reduction

Pending failures are a sorted mathematical set keyed by `(category,safeCode)`. Explicit duplicates reject. Category sort uses `FAILURE_PRECEDENCE`; ties use ascending code-point `safeCode` order.

Receipt statuses inject these failures into that set only when absent:

| Receipt status | Automatic failure |
|---|---|
| `ok` | none |
| `error` | `{category:'command',safeCode:'receipt-error'}` |
| `timeout` | `{category:'timeout',safeCode:'receipt-timeout'}` |
| `signal` | `{category:'signal',safeCode:'receipt-signal'}` |

Automatic failures do not create synthetic events because the receipt already binds the status. `FINALIZE` takes the first sorted failure and maps it through `FAILURE_PRECEDENCE`; absent failures produce succeeded. Terminal shape is always `{state,category,safeCode}`, using null category/code only for succeeded.

## Receipt and Resource Reduction

Receipts are stored as exact records sorted by numeric sequence. A command can have one receipt, and sequence values are unique on insertion. Reconciliation requires receipt command IDs to equal the declared set and sequence values to equal `0..commandIds.length-1`. Arrival order is irrelevant to receipt ordering but remains visible in `events`.

Resources are initialized and retained in resource-ID order:

- `{resourceId,ownerCommandId:null,cleanupHash:null}` means declared and unacquired.
- `{resourceId,ownerCommandId,cleanupHash:null}` means acquired and unreleased.
- `{resourceId,ownerCommandId,cleanupHash}` means acquired and released.

Acquisition requires a declared resource, a declared command owner, and null owner/hash. Release requires `cleaning`, a non-null owner, and null cleanup hash. Every unknown, orphaned, duplicate, unacquired, or late event rejects.

`CLEANUP_COMPLETED` checks only model evidence: every acquired record must have a cleanup hash. Unacquired declared resources remain explicit and need no release. A rejected completion does not add a failure automatically; if the orchestration caller wants a cleanup failure represented, it must apply category `cleanup` in `FAILURE_RECORDED` while still `cleaning` and before successful completion. Once state is `cleaned`, only reconciliation is legal. This avoids inventing retries, execution, cleanup outcomes, or late failures.

## Reconciliation Hashes

Reconciliation requires `cleaned`, exactly one receipt per command, contiguous unique sequences, the exact initialized resource set, and one release for every acquired resource.

A failed reconciliation throws the applicable `ERR_RECEIPT_SET`, `ERR_RESOURCE_SET`, `ERR_SECRET`, or `ERR_RECONCILE` without returning or mutating a model. It never appends an event, adds a pending failure, or converts validation into a late `FAILURE_RECORDED` assertion.

It constructs:

```js
const finalEvents = [...acceptedEvents, { type: 'RECONCILE' }, { type: 'FINALIZE' }]
const scanStrings = [
  canonicalJson(finalEvents),
  canonicalJson(orderedReceipts),
  canonicalJson(orderedResources),
]
```

All three strings must pass `scanSecrets`. Hashes are:

```js
receiptSetHash = sha256Hex(canonicalJson(orderedReceipts))
resourceSetHash = sha256Hex(canonicalJson(orderedResources))
eventSetHash = sha256Hex(canonicalJson(finalEvents))
secretScan = { ok: true, hash: sha256Hex(canonicalJson(scanStrings)) }
reconciliationHash = sha256Hex(canonicalJson({
  receiptSetHash,
  resourceSetHash,
  eventSetHash,
  secretScan,
}))
```

The returned reconciled model appends `RECONCILE`, not the projected `FINALIZE`. Because `FINALIZE` is the only event accepted next and has no payload, terminalization makes the actual event list exactly match `eventSetHash` while the immutable reconciliation record remains unchanged.

## Manifest Construction

`buildManifestEnvelope` revalidates a terminal model, confirms that actual events match the reconciliation event hash, and constructs:

```js
const envelope = {
  schema: 'actravel.recovery-run-manifest/v1',
  body: {
    modelSchema: model.schema,
    runId: model.runId,
    parentTokenHash: model.parentTokenHash,
    interpretation: model.interpretation,
    terminal: model.terminal,
    commandIds: model.commandIds,
    resourceIds: model.resourceIds,
    receipts: model.receipts,
    resources: model.resources,
    events: model.events,
    stateTrace,
  },
  attestations: model.reconciled,
}
```

`stateTrace` starts with `created` and appends only states reached by state-changing events. It is one of `created,preflight,cleaning,cleaned,reconciled,terminal` or `created,preflight,running,cleaning,cleaned,reconciled,terminal`.

The result is exactly `{envelope,bytes,sha256}`. Envelope/result structures are frozen. `bytes` is a newly allocated `TextEncoder().encode(canonicalJson(envelope))`; it has no newline. `sha256` is `sha256Hex(bytes)` and is not embedded in the envelope. A later build allocates fresh bytes, so mutation of a previous returned byte array cannot affect model/envelope state or later output.

There is no manifest path, self hash, publication receipt, write, rename, or readiness field.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/recovery-runner-model.mjs` | Future create | Pure validation, immutable reducer, reconciliation, and manifest envelope. |
| `tests/recovery-runner-model.test.mjs` | Future create | Exhaustive table-driven external-free contract tests. |

No other file changes are allowed in the implementation slice.

## Testing Strategy

Tests use only `node:test` and `node:assert/strict` and cover:

- exact module exports, constant values/order/freezing, all eleven errors, deterministic branch mapping, and safe optional details;
- exact create/model/event/reconciliation/terminal/manifest schemas;
- valid and invalid matrix for every event in every state, including terminal absorption;
- ID/token/hash/safe-code boundaries, sparse arrays, overlaps, duplicates, unknown/orphan/late events, accessors, symbols, throwing proxies, and revoked proxies;
- input snapshots, deep freezing, old-model preservation, caller mutation, parent-token non-retention, and fresh manifest bytes;
- receipt status mapping, one receipt per command, unique contiguous sequences, sorting, completeness, and missing IDs;
- resource ownership, acquisition/release uniqueness, unacquired records, cleanup completion gate, cleaning-only cleanup failure recording, reconciliation-only `cleaned`, and reconciliation-error non-mutation;
- all 720 failure-category permutations plus same-category `safeCode` ordering;
- secret-like IDs/safe codes and reconciliation's canonical re-scan;
- equivalent reconciliation entry points, exact component hashes, deterministic event/receipt/resource order, final event projection, and tamper rejection;
- terminal-only manifest building, state trace, canonical UTF-8 without newline, external SHA, non-self-reference, and exact negative interpretation.

No fake adapter, race, timer, signal, socket, filesystem, process, network, database, Docker, Supabase, provider, publication, or integration test belongs in this slice.

## Delivery

Target one implementation slice whose sum of physical authored lines across the two future files is no more than 650, using compact table-driven tests. Planning artifacts are excluded. Forecast the total before implementation and count the actual total before review. If either exceeds 650, stop and rescope before review; do not split delivery while claiming the same cap. No helper or package change is introduced.

Actual command adapters, timeout/signal mapping, cleanup execution, filesystem publication, and all recovery-readiness evidence are explicitly deferred.

## Open Questions

None.
