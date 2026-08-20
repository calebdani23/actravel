# Delta for Recovery Harness

## ADDED Requirements

### Requirement: Pure model boundary

The change MUST add only future files `scripts/recovery-runner-model.mjs` and `tests/recovery-runner-model.test.mjs`. The module MUST be synchronous, pure, immutable, deterministic, and external-free. It MUST import committed core `canonicalJson`, `sha256Hex`, `assertRuntimeToken`, and `scanSecrets` directly and MUST NOT change the core.

The module MUST export exactly `RUN_STATES`, `EVENT_TYPES`, `FAILURE_PRECEDENCE`, `createRunModel`, `applyRunEvent`, `reconcileRun`, and `buildManifestEnvelope`.

It MUST NOT add a package script, dependency, helper, adapter, default, CLI, publication path, or process/fs/socket/signal/clock behavior. Docker, Supabase, Postgres, SQL, providers, migrations, application code, generated types, images, and integration behavior are outside the change.

#### Scenario: Module inspection
- GIVEN the model module is imported
- WHEN its namespace and source boundary are inspected
- THEN only the seven named exports exist and no external-system or default-adapter behavior exists

### Requirement: Closed creation contract

`createRunModel` MUST accept exactly `{runId,parentToken,commandIds,resourceIds}` as an exact plain enumerable data object. `runId` and every command/resource ID MUST match `[a-z0-9][a-z0-9._-]{0,63}`. `parentToken` MUST pass `assertRuntimeToken` and therefore be exactly lowercase `sha256:` plus 64 lowercase hexadecimal characters.

`commandIds` and `resourceIds` MUST be dense arrays of primitive strings, MUST be unique within each array, and MUST be disjoint across arrays. IDs MUST be snapshotted, secret-scanned, and sorted lexicographically. The input token MUST never be retained; `parentTokenHash` MUST equal `sha256Hex(parentToken)`.

The returned deeply frozen plain model MUST contain exactly `schema,runId,parentTokenHash,interpretation,state,pendingFailures,commandIds,resourceIds,receipts,resources,events,reconciled,terminal`. `schema` MUST be `actravel.recovery-run-model/v1`, `interpretation` MUST be `orchestration-only-not-recovery-evidence`, and initial state MUST be `created`.

Each declared resource MUST have one initial exact record `{resourceId,ownerCommandId:null,cleanupHash:null}`. All other collection fields MUST initially be empty; `reconciled` and `terminal` MUST initially be null.

#### Scenario: Defensive creation
- GIVEN valid options followed by caller mutation
- WHEN the returned model is inspected and mutation is attempted
- THEN sorted snapshots remain unchanged, all nested model data is frozen, and the parent token appears nowhere in the model

#### Scenario: Invalid creation
- GIVEN missing/extra fields, invalid IDs/token, sparse or duplicate arrays, overlapping ID sets, accessors, or hostile proxies
- WHEN `createRunModel` reads the options
- THEN it throws a closed safe model error and retains no caller data or native error text

### Requirement: Closed constants and errors

`RUN_STATES` MUST be the frozen ordered array `created,preflight,running,cleaning,cleaned,reconciled,succeeded,blocked,failed,aborted`. `EVENT_TYPES` MUST be the frozen ordered array `PRECHECK_OK,COMMAND_RECEIPT,RESOURCE_ACQUIRED,CLEANUP_STARTED,RESOURCE_RELEASED,FAILURE_RECORDED,CLEANUP_COMPLETED,RECONCILE,FINALIZE`.

`FAILURE_PRECEDENCE` MUST be a frozen array of frozen exact `{category,terminal}` records in this order: `secret/blocked`, `cleanup/failed`, `signal/aborted`, `timeout/failed`, `command/failed`, `preflight/blocked`.

The internal class MUST be named `RecoveryRunnerModelError` and MUST NOT be exported. Its `name` MUST be `RecoveryRunnerModelError`, its `message` MUST equal its `code`, and its code MUST be exactly one of `ERR_MODEL_INPUT`, `ERR_EVENT_SCHEMA`, `ERR_TRANSITION`, `ERR_DUPLICATE`, `ERR_UNKNOWN_ID`, `ERR_RECEIPT_SET`, `ERR_RESOURCE_SET`, `ERR_SECRET`, `ERR_RECONCILE`, `ERR_TERMINAL`, or `ERR_MANIFEST`.

Its exact frozen `details` MUST contain required `field` and `reason` members and MAY contain only applicable `index`, `id`, or `eventType` members. `field` MUST be exactly one of `options|model|event|commandIds|resourceIds|receipt|resource|failure|manifest`. `reason` MUST be exactly one of `invalid|missing|unknown|duplicate|late|incomplete|secret|not_allowed|not_terminal`. An included `index` MUST be a non-negative safe integer. An included diagnostic identifier MUST first match `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` and pass secret scanning; domain `id` and `safeCode` values MUST retain `[a-z0-9][a-z0-9._-]{0,63}`, and an included `eventType` MUST additionally be a known `EVENT_TYPES` member. `safeCode` MUST NOT be a details key. Invalid or inspected values, caller values, scanner findings, cause messages, stack excerpts, proxy text, and native error text MUST NOT be exposed.

Validation branches MUST map deterministically and exclusively as follows:

- malformed creation input or model shape/invariants without a more specific branch: `ERR_MODEL_INPUT`;
- event object, type, key, descriptor, or required-field shape: `ERR_EVENT_SCHEMA`;
- invalid model state or a known event disallowed in the current non-terminal state: `ERR_TRANSITION`;
- duplicate IDs, set overlap, receipts, resources, failures, or events: `ERR_DUPLICATE`;
- unknown command/resource references: `ERR_UNKNOWN_ID`;
- receipt completion, sequence/order, or output-hash defects: `ERR_RECEIPT_SET`;
- resource ownership, acquisition/release, cleanup-hash, or cleanup-completion defects: `ERR_RESOURCE_SET`;
- any `scanSecrets` finding: `ERR_SECRET`;
- cleaned-state reconciliation prerequisites not covered by receipt, resource, or secret branches: `ERR_RECONCILE`;
- any event applied to a terminal model, malformed terminal model use, or terminal-only operation on a non-terminal model: `ERR_TERMINAL`;
- envelope, body, attestation, canonicalization, or encoding construction defects after terminal acceptance: `ERR_MANIFEST`.

Reflective reads, core validation, canonicalization, and encoding failures MUST be normalized to the active branch. No public function MAY expose any other error class, code, message, details member, or native exception. Where one input violates multiple rules, validators MUST use one documented fixed validation order so the same input always selects the same branch.

#### Scenario: Closed failure surface
- GIVEN malformed input or a proxy trap that throws secret-bearing text
- WHEN any public function rejects it
- THEN the error has the fixed internal class name, one of exactly eleven code/messages, only allowed safe details, deterministic branch selection, and no trapped text

### Requirement: Exact event schemas

Every event MUST be an exact plain enumerable data object with one of these schemas and no other fields:

- `{type:'PRECHECK_OK'}`
- `{type:'COMMAND_RECEIPT',commandId,sequence,status,outputHash}` where status is `ok|error|timeout|signal`
- `{type:'RESOURCE_ACQUIRED',resourceId,ownerCommandId}`
- `{type:'CLEANUP_STARTED'}`
- `{type:'RESOURCE_RELEASED',resourceId,cleanupHash}`
- `{type:'FAILURE_RECORDED',category,safeCode}` where category is `secret|cleanup|signal|timeout|command|preflight`
- `{type:'CLEANUP_COMPLETED'}`
- `{type:'RECONCILE'}`
- `{type:'FINALIZE'}`

Event IDs MUST use the primitive ID grammar. `sequence` MUST be a non-negative safe integer. `outputHash` and `cleanupHash` MUST be exactly 64 lowercase hexadecimal characters. `safeCode` MUST match `[a-z0-9][a-z0-9._-]{0,63}` and pass `scanSecrets` before retention.

`applyRunEvent` MUST validate and snapshot its model and event, MUST return a new deeply frozen model, and MUST leave both arguments and every older model unchanged. Unknown types, missing/extra fields, accessors, symbols, sparse structures, invalid primitives, and proxy failures MUST reject safely.

#### Scenario: Event schema matrix
- GIVEN each event type with its exact valid shape and variants with one missing, extra, or invalid field
- WHEN `applyRunEvent` validates the event
- THEN only the exact valid shape can enter the state machine

### Requirement: Monotonic lifecycle

The only transition path MUST be `created -> preflight -> running? -> cleaning -> cleaned -> reconciled -> terminal`.

- Only `PRECHECK_OK` MUST move `created` to `preflight`.
- The first accepted command receipt or resource acquisition in `preflight` MUST move state to `running`; later valid work events MUST remain `running`.
- `CLEANUP_STARTED` MUST be accepted only from `preflight` or `running` and MUST move to `cleaning`.
- Command receipts and resource acquisitions MUST be forbidden in and after `cleaning`.
- Resource release and cleanup completion MUST be accepted only in `cleaning`.
- `RECONCILE` MUST be accepted only from `cleaned` and MUST move to `reconciled`.
- `FINALIZE` MUST be the only event accepted from `reconciled`.
- `succeeded`, `blocked`, `failed`, and `aborted` MUST reject every event.

`FAILURE_RECORDED` for categories other than `cleanup` MUST be accepted only in `preflight`, `running`, or `cleaning`; it MUST NOT skip cleanup or directly change state. Category `cleanup` MUST be accepted only while state is `cleaning` and before `CLEANUP_COMPLETED`. State `cleaned` MUST accept only `RECONCILE`, and no failure event of any category MUST be accepted after cleanup completion. Failure events MUST also be rejected in `created`, `reconciled`, or terminal state.

#### Scenario: Every transition
- GIVEN a model at each non-terminal and terminal state
- WHEN every event type is attempted
- THEN exactly the allowed transitions succeed, cleanup failures exist only in the cleaning window, `cleaned` is reconciliation-only, failures do not bypass cleanup, and late or terminal events reject without mutation

### Requirement: Deterministic failures

Pending failures MUST be exact `{category,safeCode}` records, unique by both fields, and sorted by exported category precedence then ascending `safeCode`. Applying an explicit duplicate failure MUST reject.

A command receipt with `error`, `timeout`, or `signal` status MUST automatically add `command/receipt-error`, `timeout/receipt-timeout`, or `signal/receipt-signal`, respectively, unless that exact failure already exists. Status `ok` MUST add no failure. Automatic insertion MUST NOT create a synthetic event.

`FINALIZE` MUST select the first sorted failure and create exact terminal `{state,category,safeCode}`. With no failures it MUST create `{state:'succeeded',category:null,safeCode:null}`. Model `state` MUST equal terminal `state`.

#### Scenario: Precedence permutations
- GIVEN every permutation of all six categories and multiple safe codes in one category
- WHEN the model is finalized after cleanup and reconciliation
- THEN `secret`, `cleanup`, `signal`, `timeout`, `command`, then `preflight` precedence wins independently of event order and the lexicographically first same-category code wins

### Requirement: Closed receipts

Stored receipts MUST be exact `{commandId,sequence,status,outputHash}` records sorted by sequence. A receipt MUST reference a declared command ID. Each command ID and each sequence MUST occur at most once. Duplicate, unknown, late, negative, unsafe, or non-integer values MUST reject.

Reconciliation MUST require exactly one receipt for every declared command ID and MUST require the sequence set to equal contiguous `0..commandIds.length-1`. It MUST reject missing, extra, duplicate, gapped, or reordered identity claims.

#### Scenario: Receipt completeness
- GIVEN zero or more declared commands and receipt sets with missing IDs, duplicate IDs/sequences, gaps, or valid out-of-arrival-order sequences
- WHEN work events and reconciliation are applied
- THEN invalid identities reject, stored receipts sort by sequence, and only the exact contiguous complete set reconciles

### Requirement: Closed resources and cleanup gate

Stored resource records MUST be exact `{resourceId,ownerCommandId,cleanupHash}` records sorted by resource ID. A null owner and hash mean unacquired; a declared owner with null hash means acquired; a declared owner with a hash means released.

`RESOURCE_ACQUIRED` MUST reference one declared resource and one declared command owner. Each resource MUST be acquired at most once. `RESOURCE_RELEASED` MUST reference an acquired, unreleased resource and MUST be accepted only while cleaning. Unknown, orphaned, duplicate, unacquired, or late resource events MUST reject.

`CLEANUP_COMPLETED` MUST require every acquired resource to have exactly one release and MUST move `cleaning` to `cleaned`. Declared but unacquired resources MUST remain explicit null records and require no release. A failed completion attempt MUST not mutate the model. Any cleanup failure intended to affect final status MUST be represented by a category `cleanup` failure while still `cleaning` and before successful cleanup completion; it cannot be added in `cleaned`. The model MUST NOT infer execution, retries, or release success.

#### Scenario: Cleanup completeness
- GIVEN acquired, released, unacquired, duplicate, unknown, and orphaned resource variants
- WHEN release and cleanup completion events are applied
- THEN only each acquired resource's single cleaning-phase release satisfies the gate and no cleanup action is executed

### Requirement: Pure reconciliation

`reconcileRun(model)` MUST be exactly equivalent to `applyRunEvent(model,{type:'RECONCILE'})`. It MUST require `cleaned`, a complete closed receipt set, the exact declared resource set, and a valid release for every acquired resource.

Any reconciliation validation failure MUST throw the applicable closed `ERR_RECEIPT_SET`, `ERR_RESOURCE_SET`, `ERR_SECRET`, or `ERR_RECONCILE` error without mutating the cleaned model. It MUST NOT append `FAILURE_RECORDED`, add a pending failure, or otherwise reinterpret validation failure as a late failure event.

Reconciliation MUST form canonical strings for the ordered terminal event projection, receipts, and resources; MUST require `scanSecrets` to return `ok:true`; and MUST produce an exact deeply frozen record `{receiptSetHash,resourceSetHash,eventSetHash,reconciliationHash,secretScan}`. `secretScan` MUST be exactly `{ok:true,hash}`.

`receiptSetHash`, `resourceSetHash`, and `eventSetHash` MUST hash canonical ordered sets. The event set MUST include accepted history, `RECONCILE`, and the sole projected legal next event `FINALIZE`. `secretScan.hash` MUST hash the canonical array of scanned strings. `reconciliationHash` MUST hash the canonical exact object `{receiptSetHash,resourceSetHash,eventSetHash,secretScan}`. Reconciliation MUST append only `RECONCILE` to the returned model and MUST set state to `reconciled`; `FINALIZE` later MUST make the actual event list match the projected event hash.

#### Scenario: Reconciliation gate
- GIVEN cleaned models with complete, incomplete, inconsistent, or secret-like canonical data
- WHEN reconciliation is requested through either public path
- THEN both paths are equivalent, only complete secret-free data reconciles, and all hashes are deterministic and immutable

### Requirement: Terminal manifest envelope

`buildManifestEnvelope` MUST accept only a valid terminal model. It MUST return exactly `{envelope,bytes,sha256}`. `envelope` MUST be exactly `{schema:'actravel.recovery-run-manifest/v1',body,attestations}`.

`body` MUST contain exactly `{modelSchema,runId,parentTokenHash,interpretation,terminal,commandIds,resourceIds,receipts,resources,events,stateTrace}`. IDs/resources MUST be lexicographic, receipts MUST be sequence ordered, events MUST remain application ordered, and `stateTrace` MUST be the initial `created` plus each state reached by an event that changes state.

`attestations` MUST contain exactly `{receiptSetHash,resourceSetHash,eventSetHash,reconciliationHash,secretScan}` and MUST equal the model's reconciliation record. `bytes` MUST be a fresh `TextEncoder` UTF-8 encoding of `canonicalJson(envelope)` with no trailing newline. `sha256` MUST equal `sha256Hex(bytes)` and MUST remain outside the envelope. The envelope MUST have no self hash, publication path, publication receipt, or readiness field.

#### Scenario: Canonical non-self-referential manifest
- GIVEN equivalent terminal models and repeated manifest builds
- WHEN envelopes are built
- THEN canonical bytes and hashes match, returned byte mutation cannot affect a later build, and the external hash is absent from its own envelope

### Requirement: External-free exhaustive tests

Tests MUST use only `node:test` and `node:assert/strict`. They MUST cover exact exports and schemas, all eleven error codes and deterministic validation mappings, allowed detail keys/values and secret-safe omission, immutability, every transition, cleanup-only failure timing, reconciliation-only `cleaned`, all terminal rejections, invalid/late/duplicate/missing IDs, every failure-precedence permutation, cleanup and reconciliation gates, reconciliation-error non-mutation, secret rejection, deterministic ordering/hashes, manifest non-self-reference, caller mutation, accessors, throwing/revoked proxies, and the exact interpretation.

The sum of physical authored lines across `scripts/recovery-runner-model.mjs` and `tests/recovery-runner-model.test.mjs` MUST remain at or below 650 in one model slice. Planning artifacts are excluded. The total MUST be forecast before implementation and counted before review. If either forecast or actual total exceeds 650, implementation MUST stop for rescoping before review and MUST NOT be split while claiming the same cap.

#### Scenario: Passing model suite
- GIVEN all external-free tests pass
- WHEN the result is reported
- THEN it states only `orchestration-only-not-recovery-evidence` and makes no command, cleanup, publication, restore, readiness, provider, or Week 01 closure claim

## MODIFIED Requirements

### Requirement: Micro-slice boundary

The recovery core remains pure and unchanged. This delta adds only a pure orchestration model and exhaustive pure tests. Actual command adapters, timeout/signal mapping, cleanup execution, filesystem publication, package integration, and external recovery evidence MUST remain deferred.

#### Scenario: Core and model boundary
- GIVEN core and model tests pass
- WHEN the change is reviewed
- THEN no process, fs, socket, signal, clock, network, SQL, Docker, Supabase, Postgres, provider, migration, package, application, type, image, integration, publication, readiness, or closure behavior has been implemented
