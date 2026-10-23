# Task Automation Historical Apply and Readiness Specification

## Purpose

Define atomic execution of one immutable approved historical bootstrap plan, a purge-independent apply receipt, and a read-only readiness/accounting result. This capability does not change future hooks, implement Mi día, perform remote rollout, or close Week 03.

## Requirements

### Requirement: Auth-first apply and readiness boundaries

Apply and readiness MUST each accept exactly `{requestId}` where `requestId` is lowercase canonical UUID text. Each server boundary MUST authenticate an active Admin before client construction. Each database boundary MUST independently require an authenticated active Admin and exact expected-actor equality. Existing Task, origin, outcome, tombstone, approval, and receipt RLS MUST remain enforced and MUST NOT be broadened.

Apply failure MUST be exactly `{ok:false,error:{code,message}}` with `message=code`. Database apply codes MUST be limited, in precedence order, to `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|APPLY_IDEMPOTENCY_CONFLICT|APPLY_RECEIPT_INTEGRITY_FAILURE|APPROVAL_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|STALE_PLAN_INTEGRITY|STALE_LIVE_CONTEXT|STALE_SOURCE_ORDER|IDENTITY_OCCUPANCY_CONFLICT|LIMIT_EXCEEDED`. Only the adapter MAY add `PERSISTENCE_FAILURE` for transport, unexpected database failure, or malformed result data. Provider text MUST never be exposed.

#### Scenario: Auth rejection performs no apply read or write

- GIVEN the actor is missing, inactive, non-Admin, or differs from the expected actor
- WHEN apply or readiness is requested
- THEN the exact auth failure returns before protected state is exposed
- AND no operational write occurs

#### Scenario: Input shape is closed

- GIVEN `{requestId}` includes any additional key or a noncanonical UUID
- WHEN apply validates the request
- THEN `INVALID_REQUEST` returns
- AND no request lock or operational mutation occurs

### Requirement: Receipt-first replay and approval integrity

After request-identity serialization, apply MUST inspect an existing receipt before requiring an approval. An exact self-validating receipt owned by the same actor MUST replay even if approval or source rows were later purged. A malformed receipt MUST return `APPLY_RECEIPT_INTEGRITY_FAILURE`; a same-request receipt with different actor or immutable result identity MUST return `APPLY_IDEMPOTENCY_CONFLICT`. Replay MUST perform no Task, origin, outcome, tombstone, approval, or receipt write.

A receiptless flow MUST require exactly one approval for the request and actor. It MUST recompute and validate every immutable approval schema, cutoff, snapshot, plan, projection, hash, count, ordering, deterministic identity, and UTF-8 byte equation before any operational lock or write. Missing approval MUST return `APPROVAL_NOT_FOUND`; any mismatch MUST return `APPROVAL_INTEGRITY_FAILURE`.

#### Scenario: Receipt replay survives approval purge

- GIVEN a valid committed receipt and later authorized purge of the corresponding approval and source rows
- WHEN the same active Admin retries the request
- THEN the original receipt replays without approval lookup success being required
- AND no write is repeated

#### Scenario: Tampered approval prevents all writes

- GIVEN a receiptless request whose approval plan, projection, count, byte count, or hash is inconsistent
- WHEN apply runs
- THEN `APPROVAL_INTEGRITY_FAILURE` returns
- AND no Task, origin, outcome, tombstone, or receipt is committed

### Requirement: Full stale-plan and live-context revalidation

Before any insert, apply MUST revalidate that the immutable `0080` source cutoff rows still exist exactly once and equal the approved values; the current pre-cutoff Opportunity and sent quote-version census still equals the approved root set; every approved root and required immutable evidence identity still exists with the approved source, anchor, version, and linkage; and no new, missing, or changed pre-cutoff root would alter a disposition. Any difference MUST return `STALE_PLAN_INTEGRITY` and require a new preview and approval.

Every planned generate row MUST also revalidate the current operational context and current owner. The owner MUST equal the approved owner, have an active profile, and have a nonempty role set containing only `admin|manager|asesor`. Opportunity generation requires a present, non-deleted, non-archived, nonterminal Opportunity assigned to that owner. Quote generation requires the exact present quote/version relationship, nondeleted quote, sent version, first persisted sent occurrence, and current approved owner context. Every planned suppress row MUST revalidate the exact approved invalidation occurrence and exact-version linkage. Any live mismatch MUST return `STALE_LIVE_CONTEXT`.

`updated_at`, transaction time, apply time, or a newly inferred occurrence MUST NOT repair or replace approved evidence.

#### Scenario: Backdated root makes the approved census stale

- GIVEN approval is complete and another pre-cutoff root appears before apply
- WHEN apply recenses the immutable membership universe
- THEN `STALE_PLAN_INTEGRITY` returns
- AND the new root is not ignored
- AND zero bootstrap writes commit

#### Scenario: Owner changes after approval

- GIVEN a generate row's Opportunity or quote owner changes after approval
- WHEN apply revalidates current context
- THEN `STALE_LIVE_CONTEXT` returns
- AND no projection or receipt is partially written

### Requirement: Frozen source order and identity occupancy

For every planned action, apply MUST lock and recompute the greatest existing source order across outcomes and tombstones for the approved `originKey`. The next order MUST equal the approved `sourceOrder` exactly. Apply MUST NOT renumber, skip, or dynamically replace the approved value. A changed sequence or exhausted order MUST return `STALE_SOURCE_ORDER`.

Apply MUST validate every planned deterministic Task UUID, automation origin key, Task idempotency/automation key, origin root uniqueness key, source tuple, outcome key, and tombstone origin/source identity. Any existing row in a planned namespace MUST either be the exact state already represented by a non-action approval row or cause `IDENTITY_OCCUPANCY_CONFLICT`. Planned apply rows MUST NOT adopt, relabel, update, merge, or repair an existing manual, follow-up, foreign automation, malformed, or competing bootstrap row.

#### Scenario: Sequence change rejects rather than renumbers

- GIVEN approval froze `sourceOrder=3` and another committed source action advances the origin sequence before apply
- WHEN apply revalidates the order
- THEN `STALE_SOURCE_ORDER` returns
- AND no projection is renumbered to `4`

#### Scenario: Deterministic Task UUID is occupied

- GIVEN a foreign Task already uses a planned deterministic bootstrap Task UUID
- WHEN apply checks occupancy
- THEN `IDENTITY_OCCUPANCY_CONFLICT` returns
- AND the Task is not adopted or changed

### Requirement: Canonical lock order and concurrency

Receiptless apply MUST acquire locks only in this exact rank order: request advisory → approval/receipt rows → exclusive universe advisory → raw source advisory → raw origin advisory → deterministic Task identity advisory → source/evidence/context rows including any occupied Task row → writes/receipt. Raw source and raw origin advisory identities MUST each be acquired in ascending bytewise key order; deterministic Task identity advisories MUST be acquired in ascending lowercase UUID byte order; and source/evidence/context rows, including any occupied Task row, MUST be acquired in canonical bytewise key order. Identities and rows within a rank MUST be deduplicated before locking. Apply MUST NOT acquire a lower-rank lock after a higher-rank lock.

Every future source, evidence, or context writer, including the existing future hooks, MUST acquire the same bootstrap universe advisory in shared mode before mutating guarded state and MUST hold it through commit. Receiptless apply MUST hold the matching exclusive bootstrap universe advisory through commit or rollback. Exclusive acquisition MUST drain earlier shared holders before final census and revalidation, and MUST block later shared holders until the apply transaction ends, so an absent or backdated root, evidence row, or context row MUST NOT appear as a phantom between final revalidation and receipt creation or before commit. This shared guard MUST NOT otherwise change future-hook behavior.

Concurrent identical calls MUST converge to exactly one receipt and one set of writes. A same-request call with changed actor or immutable identity MUST conflict. A different request that races for any source, origin, Task, outcome, or tombstone namespace MUST allow at most one complete winner; every loser MUST fail atomically without adoption.

#### Scenario: Identical concurrent applies converge

- GIVEN two identical apply calls for one approved request
- WHEN they execute concurrently
- THEN one atomic write set and one receipt exist
- AND the other call replays that exact receipt
- AND both calls obey request advisory → approval/receipt rows → exclusive universe advisory → raw source advisory → raw origin advisory → deterministic Task identity advisory → source/evidence/context rows including any occupied Task row → writes/receipt rank order

#### Scenario: Competing requests and future writers cannot split the plan

- GIVEN two approved requests compete for at least one origin or deterministic Task identity while a future hook attempts to write a source, evidence, or context row in the guarded bootstrap universe
- WHEN the requests and the shared-guard future writer execute concurrently
- THEN at most one request commits
- AND the losing request commits no Task, origin, outcome, tombstone, or receipt
- AND the exclusive universe guard drains any earlier shared writer before final revalidation and blocks any later shared writer through apply commit or rollback
- AND no absent or backdated root, evidence row, or context row appears as a phantom between final revalidation and receipt creation

### Requirement: Exact atomic generate and suppress writes

Only approved projections may write. Each `generate` projection MUST insert exactly one deterministic `pending` native Task, one immutable origin, and one immutable applied generate outcome. The Task MUST use its approved deterministic UUID, owner, context, due time, kind, description, and `idempotency_key=automation_origin_key=originKey`; it MUST use null legacy follow-up provenance. The origin MUST preserve the archived source tuple, anchor, due-rule version, and deterministic Task identity exactly.

Each `suppress` projection MUST insert exactly one immutable `source_invalidated` tombstone and one immutable applied suppress outcome using the approved source tuple, source order, origin key, outcome key, and tombstone key. It MUST create no Task or origin. Already, excluded, owner-invalid, context-invalid, and collision rows MUST produce no Task, origin, outcome, or tombstone write.

All projection writes and exactly one apply receipt MUST commit in one transaction. Any validation, constraint, insert, or receipt failure MUST roll back the whole write set. Approval and source rows MUST remain unchanged.

#### Scenario: Mixed generate and suppress plan commits atomically

- GIVEN one valid generate projection, one valid suppress projection, and retained non-action rows
- WHEN apply succeeds
- THEN exactly one Task, one origin, two outcomes, one tombstone, and one receipt commit
- AND retained non-action rows cause no operational write

#### Scenario: Failure after the first projection rolls back everything

- GIVEN a two-projection plan and a failure while applying the second projection
- WHEN the transaction ends
- THEN no Task, origin, outcome, tombstone, or receipt from either projection remains

### Requirement: Immutable purge-independent apply receipt

The apply receipt MUST be append-only, self-validating, and independent of cascading source or approval foreign keys. It MUST retain receipt ID, request ID, approval ID, actor ID, approval fingerprint, plan hash, projection hash, ordered Task IDs, ordered origin keys, ordered outcome keys, ordered tombstone keys, generated count, suppressed count, projection count, result, result hash, result UTF-8 byte count, and canonical creation time.

The stored canonical result MUST be exactly `{schema:"task-automation-historical-apply-result.v1",requestId,approvalId,actorId,planHash,projectionHash,taskIds,originKeys,outcomeKeys,tombstoneKeys,generatedCount,suppressedCount,projectionCount}`. Arrays MUST preserve approved projection order after filtering to their corresponding generated values. All array values MUST be canonical, distinct within their identity namespace, and equal the top-level receipt arrays. `generatedCount=taskIds.length=originKeys.length`; `suppressedCount=tombstoneKeys.length`; `projectionCount=generatedCount+suppressedCount=outcomeKeys.length`. `resultHash` MUST be `H(result)`, and the stored byte count MUST equal the exact UTF-8 length of `C(result)`.

RLS MUST be enabled and forced on receipts. Only a currently authenticated active Admin MAY select them. Direct INSERT, UPDATE, and DELETE and public, anonymous, non-Admin, or service-role direct access MUST be denied. `replayed` MUST appear only in the returned envelope and MUST NOT be stored or hashed.

#### Scenario: Receipt arrays prove exact write parity

- GIVEN an apply commits two generate projections and one suppress projection
- WHEN its receipt is read
- THEN it contains two ordered Task IDs, two ordered origin keys, three ordered outcome keys, and one ordered tombstone key
- AND every count, array, result value, byte count, and hash agrees exactly

#### Scenario: Receipt mutation is rejected

- GIVEN a committed receipt
- WHEN any actor attempts direct update or deletion
- THEN the mutation is rejected
- AND subsequent replay returns the original receipt unchanged

### Requirement: Exact apply result decoding

Apply success MUST be exactly `{ok:true,status:"success",replayed,receiptId,requestId,approvalId,actorId,approvalFingerprint,planHash,projectionHash,taskIds,originKeys,outcomeKeys,tombstoneKeys,generatedCount,suppressedCount,projectionCount,result,resultHash,resultByteCount,createdAt}`. Every top-level and nested key, UUID, hash, timestamp, count, order, distinctness rule, and equality equation MUST be validated before constructing public success. Extra, missing, malformed, duplicated, reordered, or inconsistent data MUST map to adapter-only `PERSISTENCE_FAILURE`.

#### Scenario: Malformed receipt response is rejected

- GIVEN the provider returns a success with reordered outcome keys, a duplicate Task ID, or a mismatched result count
- WHEN the adapter decodes it
- THEN `PERSISTENCE_FAILURE` returns
- AND no public apply success is constructed

### Requirement: Readiness exact result and row accounting

Readiness MUST be read-only and evaluate only one request. Success MUST be exactly `{ok:true,requestId,approvalId,applyReceiptId,ready,counts,rows}`. Rows MUST be ordered by approved zero-based ordinal and contain exactly `{ordinal,sourceKind,rootId,disposition,outcome,taskId,originKey,outcomeKey,tombstoneKey}`. `outcome` MUST be exactly the disposition's snake-case accounting value: `generated|suppressed|already_projected|already_suppressed|excluded_not_actionable|manual_review_owner_invalid|manual_review_context_invalid|collision_manual_review`.

`counts` MUST contain exactly `applyGenerate,applySuppress,alreadyProjected,alreadySuppressed,excludedNotActionable,manualReviewOwnerInvalid,manualReviewContextInvalid,collisionManualReview,receiptGenerated,receiptSuppressed,plannedWrites,receiptWrites,taskBacked,suppressed,intentionalNoWrite,unresolvedManualReview,total`.

The following equations MUST all hold:

- the first eight values equal the approval's closed count vector;
- `plannedWrites=applyGenerate+applySuppress`;
- `receiptGenerated=applyGenerate` and `receiptSuppressed=applySuppress`;
- `receiptWrites=receiptGenerated+receiptSuppressed=plannedWrites`;
- `taskBacked=applyGenerate+alreadyProjected`;
- `suppressed=applySuppress+alreadySuppressed`;
- `intentionalNoWrite=excludedNotActionable`;
- `unresolvedManualReview=manualReviewOwnerInvalid+manualReviewContextInvalid+collisionManualReview`;
- `total=taskBacked+suppressed+intentionalNoWrite+unresolvedManualReview=rows.length=approval.totalCount`.

Every approval root MUST appear once. Generate rows MUST map one-to-one to exact ordered receipt Task/origin/outcome identities and retained immutable rows. Suppress rows MUST map one-to-one to exact ordered receipt tombstone/outcome identities. Already rows MUST resolve to exact compatible retained state but MUST NOT be claimed by the receipt. Excluded and manual-review rows MUST have no bootstrap write identity.

#### Scenario: Complete mixed accounting remains not ready with manual review

- GIVEN valid parity for generated, suppressed, already, and excluded rows plus one owner-invalid and one collision row
- WHEN readiness is read
- THEN every root appears once with its exact outcome
- AND `unresolvedManualReview=2`
- AND `ready=false`

#### Scenario: Complete zero-manual plan is ready

- GIVEN every root is exactly generated, suppressed, already projected, already suppressed, or intentionally excluded and all receipt/state parity is exact
- WHEN readiness is read
- THEN all equations hold
- AND `unresolvedManualReview=0`
- AND `ready=true`

### Requirement: Readiness integrity, failures, and no mutation

`ready` MUST be true only when approval integrity, receipt integrity, root accounting, all count equations, all planned-write receipt parity, all retained immutable-state parity, and zero owner/context/collision manual-review counts are proven. Missing receipt MUST never be treated as zero-write readiness. Readiness MUST NOT reapply or repair data.

Readiness failure codes MUST be limited, in precedence order, to `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|APPROVAL_NOT_FOUND|APPLY_RECEIPT_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|APPLY_RECEIPT_INTEGRITY_FAILURE|ROOT_ACCOUNTING_FAILURE|WRITE_PARITY_FAILURE|LIMIT_EXCEEDED`; only the adapter MAY add `PERSISTENCE_FAILURE`. Failure MUST expose no provider text or partial rows. Repeated reads of unchanged retained state MUST return the same ordered result.

#### Scenario: Missing write fails parity rather than lowering a count

- GIVEN the receipt declares one generated Task but its exact origin or outcome is absent or mismatched
- WHEN readiness is read
- THEN `WRITE_PARITY_FAILURE` returns
- AND no count is silently adjusted
- AND no row is inserted or repaired

#### Scenario: Readiness performs zero DML

- GIVEN any valid or invalid approved request
- WHEN readiness is evaluated
- THEN it performs no INSERT, UPDATE, DELETE, apply, adoption, or repair

### Requirement: Rollback, preservation, and local-only boundary

Before any historical approval, receipt, Task, origin, outcome, or tombstone exists, callers, apply/readiness boundaries, and additive empty storage MAY be removed in reverse dependency order. After any such state exists, rollback MUST be forward-only: disable preview, approval, and new apply execution; retain all approvals, receipts, Tasks, origins, outcomes, tombstones, source history, and terminal state; preserve compatible audited Task actions; and keep legacy `task_transition` revoked. An incorrect Task MUST be remediated only through a separately approved audited action, never DELETE, adoption, receipt rewrite, or history rewrite.

This capability MUST leave migrations and behavior `0077`–`0080` unchanged. It MUST operate and be assessed only against local or disposable state until separately authorized reconciliation. It MUST NOT access or mutate a remote, change future automation hooks, implement Mi día or Dashboard/CRM reads, send notifications, claim production readiness, perform rollout, or close Week 03.

#### Scenario: Persisted bootstrap state requires forward disable

- GIVEN at least one historical approval or applied bootstrap record exists
- WHEN rollback is required
- THEN new bootstrap execution is disabled while all immutable and Task state is retained
- AND no remote operation, Mi día delivery, or Week 03 closure is claimed
