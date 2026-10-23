# Follow-up Task Disposition Readiness Specification

## Purpose

Define a read-only, single-request gate that proves an applied approval is completely accounted before local read cutover.

## Requirements

### Requirement: Admin-only single-request boundary

The adapter MUST accept exactly `{requestId:string}` where `requestId` is a lowercase canonical UUID. It MUST authenticate an active Admin before creating a client. The RPC MUST independently authenticate the same expected actor and MUST evaluate only that request. Success MUST have exactly:

`{ok:true,requestId,approvalId,applyReceiptId,ready,counts,rows}`

`counts` MUST contain the seven camel-case approval counts plus `taskBacked`, `intentionalNoTask`, `unresolvedManualReview`, and `total`. Each `rows` item MUST be exactly `{ordinal,eventId,disposition,outcome,taskId}`, ordered by zero-based canonical-plan ordinal. Failure codes MUST be limited to `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|APPROVAL_NOT_FOUND|APPLY_RECEIPT_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|APPLY_RECEIPT_INTEGRITY_FAILURE|TASK_PARITY_FAILURE|LIMIT_EXCEEDED`; only the adapter MAY add `PERSISTENCE_FAILURE` for transport, SQL, or malformed-result failures. Precedence MUST be auth, request, approval, receipt, limits, then Task parity.

#### Scenario: Auth-first rejection

- GIVEN a missing, inactive, non-Admin, or mismatched actor and a valid request ID
- WHEN readiness is requested
- THEN the exact auth failure returns before request data is read and no client is created after adapter auth rejection

### Requirement: Exact Task-backed resolution

The gate MUST revalidate the immutable approval and apply receipt defined by the canonical approved-plan apply contract without re-applying it. `eligible` rows MUST map one-to-one, in eligible-row order, to the receipt's distinct ordered Task IDs. `already-converted` rows MUST resolve by globally unique `source_event_id` and the approved canonical follow-up representation. Missing, duplicate, cross-request, reordered, or mismatched mappings MUST return `TASK_PARITY_FAILURE`.

#### Scenario: Mixed Task-backed rows

- GIVEN a valid applied approval with two eligible rows and one already-converted row
- WHEN readiness is read
- THEN all three rows have `outcome="task_backed"`, exact Task IDs, and canonical ordinal order

### Requirement: Closed disposition accounting

Every approval row MUST appear exactly once. `taskBacked=eligible+alreadyConverted`; `intentionalNoTask=invalidDateNoTask+excludedLeadNotOperational+excludedNonSelectedHistory`; `unresolvedManualReview=manualReviewUnassignedOwner+collisionManualReview`; and `total` MUST equal both their sum and the immutable approval total. `ready` MUST be true only when all equations hold, every Task-backed row resolves, and `unresolvedManualReview=0`.

#### Scenario: Unresolved rows block readiness

- GIVEN valid closed accounting containing one unassigned-owner row and one collision row
- WHEN readiness is read
- THEN both rows are explicit `unresolved_manual_review` outcomes and `ready` is false

### Requirement: Deterministic, bounded, read-only behavior

The gate MUST support at most 2,000 approval rows, return no extra keys, expose no provider text, and perform zero INSERT, UPDATE, or DELETE. Repeated reads of unchanged rows MUST return the same ordered result. Admin-only access MUST NOT weaken Task, approval, or receipt RLS.

#### Scenario: Limit or integrity failure

- GIVEN an over-limit approval or a malformed approval, receipt, or result
- WHEN readiness is read
- THEN the exact closed failure returns and every database row remains unchanged

### Requirement: Dependency and rollback boundary

This capability SHALL extend, not replace, migrations and contracts `0061`–`0067`. Local or disposable proof MUST NOT claim remote parity, rollout, production readiness, or Week 03 closure. Rollback MUST remove only this read boundary and MUST require no data repair.

#### Scenario: Unknown remote state

- GIVEN local readiness succeeds but remote migration and data state were not reconciled
- WHEN release readiness is assessed
- THEN remote readiness remains unknown and no remote operation is authorized
