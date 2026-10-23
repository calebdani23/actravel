# Task Automation Historical Preview Specification

## Purpose

Define an Admin-only, bounded, convergent, read-only preview that constructs the complete historical bootstrap plan against immutable `0080` source cutoffs.

## Requirements

### Requirement: Auth-first exact result boundary

The preview boundary MUST authenticate an active Admin before constructing a database client or reading any source. Any privileged database boundary MUST independently require an authenticated active Admin and exact expected-actor equality. Existing source-table RLS MUST remain enforced and MUST NOT be broadened.

Preview success MUST be exactly:

`{ok:true,schema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,plan,planHash,counts,totalCount,diagnostics}`

where `schema="task-automation-historical-preview.v1"`, `ruleVersion="task-automation-historical.v1"`, and all duplicated plan metadata MUST equal the corresponding canonical plan values. `diagnostics` MUST be exactly `{passes,logicalReads,physicalAttempts,opportunityRootCount,quoteVersionRootCount}` and MUST contain only nonnegative integers.

Failure MUST be exactly `{ok:false,error:{code,message},diagnostics?}`, with `message=code`, no partial plan fields, and code limited to `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|CLIENT_UNAVAILABLE|CUTOFF_UNAVAILABLE|QUERY_FAILED|MALFORMED_ROW|INCOMPLETE_JOIN|LIMIT_EXCEEDED|SNAPSHOT_NOT_CONVERGED|CLASSIFICATION_FAILED|CANONICALIZATION_FAILURE`. No result may expose provider text, query text, URLs, raw payloads, notes, contact data, or other PII.

#### Scenario: Adapter authorization rejects before client construction

- GIVEN the session is missing, inactive, or lacks Admin role
- WHEN preview is requested
- THEN the exact auth failure is returned
- AND no database client is constructed
- AND no source read occurs

#### Scenario: Successful envelope is exact

- GIVEN an authorized Admin and a converged bounded snapshot
- WHEN preview succeeds
- THEN the response contains exactly the declared success keys
- AND plan metadata, counts, total, and hashes agree byte-for-byte

### Requirement: Immutable source cutoffs and membership

The reader MUST read exactly one immutable cutoff for each source kind `opportunity_assignment` and `quote_sent` before any planning pass. Both values MUST be finite canonical UTC-microsecond timestamps and MUST remain unchanged across all passes. Missing, duplicate, malformed, mutable, or unexpected cutoff rows MUST return `CUTOFF_UNAVAILABLE` with no plan.

Opportunity membership MUST be determined only by `created_at < opportunity_assignment.cutoff_at`. Quote-version membership MUST be determined only by `sent_at IS NOT NULL AND sent_at < quote_sent.cutoff_at`. Preview time and page completion time MUST NOT affect membership. The reader MUST include non-operational and occupied roots and MUST NOT filter roots by current owner validity, Task eligibility, or expected disposition.

#### Scenario: A root on the cutoff is future-only

- GIVEN one Opportunity before the assignment cutoff and one Opportunity exactly at it
- WHEN membership is read
- THEN only the strictly earlier Opportunity belongs to the historical plan

#### Scenario: Invalid cutoff set fails before planning passes

- GIVEN one source cutoff is missing or duplicated
- WHEN preview starts
- THEN `CUTOFF_UNAVAILABLE` is returned
- AND no canonical plan is constructed

### Requirement: Complete root census and bounded keyset reads

Each root family MUST be read with ascending deterministic keyset pagination and an independent exact census. Pages MUST contain at most 200 roots. Ten pages cover the maximum 2,000 roots per family; a sentinel beyond 2,000 MUST return `LIMIT_EXCEEDED`, never a truncated plan. Offset pagination MUST NOT be used. Every root page, census, and sentinel MUST retain the immutable source-cutoff predicate.

Supporting assignment, sent-event, invalidation, current-context, ownership, role, Task occupancy, origin, outcome, and tombstone facts MUST be read only for the bounded root set. Related evidence MUST use deterministic keyset or sorted bounded-ID reads. No evidence collection may silently truncate; an explicit sentinel MUST fail closed. The complete normalized supporting-evidence population MUST contain at most 20,000 rows per source family and at most 40,000 rows overall.

Every selected shape MUST be allow-listed and closed. Wildcard selection, unneeded actor/message/body fields, and broad payload retrieval MUST NOT occur. A returned extra field, malformed identifier or timestamp, duplicate primary identity, row outside the requested roots, missing required join, or census/page disagreement MUST return `MALFORMED_ROW` or `INCOMPLETE_JOIN` with no plan.

#### Scenario: Root overflow cannot produce a partial plan

- GIVEN 2,001 pre-cutoff sent quote versions
- WHEN preview reads quote roots
- THEN the sentinel returns `LIMIT_EXCEEDED`
- AND no Opportunity-only or first-2,000 quote plan is returned

#### Scenario: Authoritative absence differs from a missing join

- GIVEN one root has an explicitly complete empty assignment-evidence set and another root's evidence query omits a required page
- WHEN preview reads facts
- THEN the first root may classify as missing evidence
- AND the second causes `INCOMPLETE_JOIN` for the entire preview

### Requirement: Fixed snapshot cutoffs and complete facts

Before pass one, the reader MUST freeze one inclusive high-water cursor for each normalized collection: `opportunityRoots`, `quoteVersionRoots`, `assignmentEvidence`, `quoteSourceEvidence`, `taskOccupancy`, `automationOrigins`, `automationOutcomes`, and `automationTombstones`. `snapshotCutoffs` MUST contain exactly those keys; each value MUST be either null or `[canonicalTimestamp,canonicalIdentity]`, where identity is the collection's lowercase UUID or 64-lowerhex key. Every pass MUST reuse the same cursors and apply strict-after pagination within the inclusive boundary.

Current point facts such as profile activity, assigned owner, roles, root operational state, and exact-version relationships MUST be read completely in every pass and included in the snapshot digest even when they do not have an append-only cursor. A requested owner or role identity missing from an otherwise successful join MUST be represented only by the classifier's explicit missing-profile fact when authoritative absence is proved; transport omission is `INCOMPLETE_JOIN`.

Task occupancy MUST cover every Task that can occupy a deterministic Task ID, automation origin/idempotency key, root uniqueness key, source tuple, outcome key, or tombstone identity for any row. Exact current automation state MUST be decoded separately from general occupancy. The reader MUST NOT treat a matching manual or foreign Task as an existing historical projection.

#### Scenario: Foreign Task remains occupancy

- GIVEN a manual Task occupies a deterministic bootstrap Task ID or origin key
- WHEN preview reads occupancy
- THEN the Task is supplied as foreign occupancy
- AND it cannot be decoded as an exact projected Task

#### Scenario: Snapshot cursors never advance between passes

- GIVEN new evidence is appended after pass one beyond a frozen high-water cursor
- WHEN later passes run
- THEN every pass retains the original cursor
- AND the new row is not silently mixed into only one accepted pass

### Requirement: Canonical snapshot digest and convergence

Each planning pass MUST normalize and sort all root, evidence, join, and occupancy facts according to the classification contract. Its digest preimage MUST be exactly:

`["task-automation-historical-snapshot.v1",sourceCutoffs,snapshotCutoffs,opportunityFacts,quoteFacts,assignmentEvidence,quoteSourceEvidence,ownerFacts,taskOccupancy,automationOrigins,automationOutcomes,automationTombstones]`.

`snapshotHash` MUST be lowercase SHA-256 of the exact UTF-8 canonical JSON bytes. The reader MUST compare pass one with pass two; only if they differ MAY it compare pass three with pass four. It MUST accept pass two or pass four only when the adjacent hashes and normalized bytes are equal. Four nonconvergent passes MUST return `SNAPSHOT_NOT_CONVERGED`. Digest or canonical-byte failure MUST return `CANONICALIZATION_FAILURE`. The classifier MUST run exactly once after convergence and zero times on any read, limit, digest, or convergence failure.

`logicalReads` MUST increment once per requested logical read. `physicalAttempts` MUST count every underlying transport attempt, including retries, without changing pages, cursors, sentinels, or convergence-pass count.

#### Scenario: Second pass converges

- GIVEN pass one and pass two produce identical normalized bytes
- WHEN convergence is evaluated
- THEN pass two is accepted
- AND the classifier runs exactly once

#### Scenario: Four changing passes fail closed

- GIVEN each adjacent pass differs in at least one current fact or bounded row
- WHEN four passes complete
- THEN `SNAPSHOT_NOT_CONVERGED` is returned
- AND the classifier is not called

#### Scenario: Provider retries do not alter logical accounting

- GIVEN one logical root page requires three transport attempts
- WHEN diagnostics are returned
- THEN `logicalReads` increases by one
- AND `physicalAttempts` increases by three
- AND no additional page or cursor is created

### Requirement: Canonical classifier integration

After convergence, the reader MUST invoke the historical classifier with the accepted complete facts, source cutoffs, snapshot cutoffs, and snapshot hash. It MUST validate the returned exact plan schema, canonical bytes, ordering, eight-count vector, root counts, total equation, and `planHash`. A classifier domain failure MUST map to `CLASSIFICATION_FAILED`; a malformed classifier result or hash/count mismatch MUST map to `CANONICALIZATION_FAILURE`. Neither case may return a partial plan.

#### Scenario: Classifier count mismatch is not exposed as success

- GIVEN the classifier returns rows whose count sum differs from `totalCount`
- WHEN the reader validates the result
- THEN preview returns `CANONICALIZATION_FAILURE`
- AND no success envelope is constructed

### Requirement: Read-only boundary and exclusions

Preview MUST perform zero INSERT, UPDATE, DELETE, approval, apply, Task adoption, Task action, origin, outcome, tombstone, or receipt write. It MUST NOT modify `0077`–`0080`, future hooks, source history, CRM reads, quote behavior, Dashboard, Mi día, notifications, or closure state. It MUST operate only against local or disposable state for this change; successful local preview MUST NOT claim remote parity, rollout, or production readiness.

#### Scenario: Preview cannot authorize mutation or rollout

- GIVEN a successful local preview with generate and suppress rows
- WHEN the result is returned
- THEN every operational row remains unchanged
- AND the result alone authorizes neither apply nor any remote operation
