# Task Automation Historical Approval Specification

## Purpose

Define one immutable Admin-owned approval for an exact canonical historical bootstrap preview and its exact generate/suppress projections.

## Requirements

### Requirement: Exact auth-first approval input

The approval boundary MUST accept exactly `{requestId,preview}`. `requestId` MUST be lowercase canonical UUID text and `preview` MUST be an exact successful historical preview envelope. The server boundary MUST authenticate an active Admin before client construction. The database boundary MUST independently require an authenticated active Admin, exact expected-actor equality, and the `admin` role.

Approval MUST NOT reread roots, evidence, Tasks, origins, outcomes, tombstones, profiles, roles, quotes, or Opportunities. It MUST NOT mutate any source or automation state. It may persist only the immutable approval described by this capability.

#### Scenario: Authorization fails before persistence access

- GIVEN the caller is missing, inactive, non-Admin, or has a mismatched expected actor
- WHEN approval is requested
- THEN the exact auth failure returns before approval persistence
- AND no source or approval row is written

#### Scenario: Extra input is rejected

- GIVEN an input containing `requestId`, `preview`, and an additional field
- WHEN approval validates the request
- THEN `INVALID_REQUEST` returns
- AND no approval is persisted

### Requirement: Preview integrity and projection derivation

Approval MUST validate the preview's exact keys, schemas, rule version, source cutoffs, snapshot cutoffs, snapshot hash, canonical plan, canonical plan hash, row order, ordinals, count vector, total equation, diagnostics shape, and every row's closed disposition/reason and identity nullability. It MUST parse and re-canonicalize the plan and require byte-for-byte equality. `planHash` MUST equal `H(plan)`.

The approval projections MUST be derived, never trusted as caller input. Exactly one projection MUST be emitted for each canonical row whose `action` is `generate` or `suppress`, in ascending row ordinal. Each projection MUST contain exactly `ordinal,action,operationSourceKind,operationSourceId,sourceKey,sourceOrder,originKey,taskId,taskKind,ownerId,opportunityId,quoteId,quoteVersionId,sentEventId,anchorAt,dueRuleVersion,dueAt,outcomeKey,tombstoneKey`. Values MUST equal the source row exactly. No already, excluded, manual-review, or collision row may emit a projection.

`projectionHash` MUST be `H(projections)`. `projectionCount` MUST equal `counts[0]+counts[1]`; `generateCount=counts[0]`; `suppressCount=counts[1]`; and `rowCount=totalCount=sum(counts)`.

#### Scenario: Mixed plan derives only apply projections

- GIVEN a canonical plan containing all eight dispositions
- WHEN approval derives projections
- THEN only `apply/generate` and `apply/suppress` rows produce projections
- AND projection order equals canonical row order

#### Scenario: Supplied hash mismatch fails closed

- GIVEN a preview whose plan bytes do not match `planHash`
- WHEN approval validates it
- THEN `HASH_MISMATCH` returns
- AND no approval is written

### Requirement: Canonical approval equations and limits

The approval schema MUST be `task-automation-historical-approval.v1`. The request preimage MUST be exactly:

`["task-automation-historical-approval-request.v1",requestId,actorId,"admin",preview.schema,preview.ruleVersion,preview.sourceCutoffs,preview.snapshotCutoffs,preview.snapshotHash,preview.planHash,projectionHash,preview.plan,projections]`.

`requestFingerprint` MUST equal `H(requestPreimage)`. `planByteCount`, `projectionByteCount`, and `requestByteCount` MUST equal the UTF-8 lengths of `C(plan)`, `C(projections)`, and `C(requestPreimage)`. The approval MUST preserve all eight named disposition counts, total, row count, generate count, suppress count, projection count, every supplied cutoff and snapshot value, and every derived hash and byte count.

Inherited classification limits MUST be enforced again. Each canonical projection MUST be at most 4,096 UTF-8 bytes, the projection array at most 16,777,216 bytes, and the request preimage at most 33,554,432 bytes. Any count, row, projection, or byte-limit violation MUST return `LIMIT_EXCEEDED` before persistence.

#### Scenario: UTF-8 byte counts use bytes, not characters

- GIVEN a legal canonical preview containing multibyte text in an allowed canonical value
- WHEN approval computes byte counts
- THEN each count equals the exact UTF-8 octet length
- AND replay compares the stored byte values exactly

### Requirement: One immutable Admin-owned ledger row

Each request ID MUST identify at most one approval row. The row MUST retain approval ID, request ID, actor ID, actor role `admin`, approval schema, preview schema, rule version, source cutoffs, snapshot cutoffs, snapshot hash, canonical plan and hash, canonical projections and hash, request fingerprint, all eight named counts, total/row/generate/suppress/projection counts, three UTF-8 byte counts, and canonical creation time.

Approval rows MUST be append-only and unavailable for direct INSERT, UPDATE, or DELETE. RLS MUST be enabled and forced. Only a currently authenticated active Admin MAY select approvals. Public, anonymous, non-Admin authenticated, and service-role direct table access or approval execution MUST be denied; only the narrowly granted authenticated approval boundary may insert after its independent Admin check. No cascading source foreign key may make an approval disappear when source data is purged.

#### Scenario: Approval remains immutable after source purge

- GIVEN one approval has been committed and its source rows are later authoritatively purged
- WHEN an authorized Admin reads the approval
- THEN its canonical plan, projections, identities, hashes, counts, bytes, actor, and timestamp remain unchanged

#### Scenario: Direct mutation is denied

- GIVEN an authenticated Admin attempts direct UPDATE or DELETE of an approval
- WHEN the mutation is evaluated
- THEN it is rejected
- AND the approval remains byte-identical

### Requirement: Exact replay and idempotency conflict

Approval MUST serialize on request identity before lookup or insert. An identical retry by the same actor with the same request fingerprint and every immutable value equal MUST return the original approval with `replayed=true` and write no row. Reuse of the request ID by a different actor, or with any changed preview identity, plan byte, projection byte, cutoff, snapshot, hash, count, or byte count, MUST return `APPROVAL_IDEMPOTENCY_CONFLICT` and write nothing. Concurrent identical requests MUST converge to one approval; concurrent conflicting requests MUST produce at most one approval and one or more closed conflicts.

`replayed` MUST exist only in the returned envelope and MUST NOT participate in canonical approval bytes or stored approval identity.

#### Scenario: Concurrent identical approval converges

- GIVEN two identical approval calls from the same Admin and request ID
- WHEN they execute concurrently
- THEN exactly one immutable approval exists
- AND both successful callers receive the same approval identity
- AND exactly one response is allowed to report initial persistence

#### Scenario: Changed actor conflicts

- GIVEN a request ID already belongs to one Admin's approval
- WHEN another Admin submits otherwise identical bytes under that request ID
- THEN `APPROVAL_IDEMPOTENCY_CONFLICT` returns
- AND the original actor identity remains unchanged

### Requirement: Exact approval result and closed failures

Approval success MUST be exactly `{ok:true,status:"success",replayed,approvalId,requestId,actorId,actorRole,schema,previewSchema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,plan,planHash,projections,projectionHash,requestFingerprint,counts,totalCount,rowCount,generateCount,suppressCount,projectionCount,planByteCount,projectionByteCount,requestByteCount,createdAt}`. Every identifier, timestamp, hash, count, array, object, and nested key MUST be strictly decoded; extra, missing, malformed, reordered, or inconsistent values MUST NOT construct public success.

Database domain failures MUST be limited, in precedence order, to `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|INVALID_PREVIEW|INVALID_PLAN|INVALID_PROJECTION|LIMIT_EXCEEDED|HASH_MISMATCH|APPROVAL_IDEMPOTENCY_CONFLICT`. Only the server adapter MAY add `PERSISTENCE_FAILURE` for transport, unexpected database failure, or malformed provider data. Failure MUST be exactly `{ok:false,error:{code,message}}` with `message=code` and no provider text.

#### Scenario: Malformed success is not exposed

- GIVEN persistence returns a success object with an extra key, malformed UUID, mismatched count, or altered projection order
- WHEN the server boundary decodes it
- THEN it returns `PERSISTENCE_FAILURE`
- AND no public approval success is constructed

### Requirement: Approval rollback and local-only boundary

Before any historical approval or downstream bootstrap state exists, the additive approval boundary and empty storage MAY be removed in reverse dependency order. After any approval exists, rollback MUST be forward-only: approval execution MAY be disabled, but every approval MUST be retained immutable for audit and possible receipt validation. This capability MUST NOT modify `0077`–`0080`, future hooks, legacy action revocation, source history, Mi día, notifications, remotes, rollout state, or Week 03 closure.

#### Scenario: Persisted approval blocks destructive rollback

- GIVEN at least one historical approval exists
- WHEN rollback is required
- THEN new approval execution is disabled without deleting or rewriting the ledger
- AND no remote operation or closure claim is made
