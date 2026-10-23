# Follow-up Task Approved-Plan Apply Specification

Exactly 12 requirements and 12 scenarios are normative. Parity/cutover, dashboard/Contact 360, future writes,
automation/SLA/notifications/Mi día/UI/rollout, and Week 1 are excluded.

### Requirement: Auth-first request boundary
The server adapter MUST accept exactly `{requestId:string}`, call `requireAdminRole(["admin"])` before client/RPC
creation, and let that call's throws propagate unchanged without creating a client. The uniquely named RPC
`apply_approved_follow_up_task_plan(p_request_id_text text,p_expected_actor_id uuid)` MUST independently require an
authenticated active Admin and exact actor equality. Existing `0065` RPC `approve_follow_up_task_plan` MUST remain
immutable and MUST NOT be called or changed.
#### Scenario: Auth rejection
- GIVEN a missing, inactive, non-Admin, or mismatched actor session
- WHEN apply receives `{requestId}`
- THEN adapter auth throws propagate unchanged before client/RPC; independently, the RPC returns the exact auth code
  (`AUTH_REQUIRED`, `AUTH_INACTIVE`, `AUTH_NOT_ADMIN`, or `AUTH_ACTOR_MISMATCH`) with no DML.

### Requirement: Immutable approval integrity
The RPC MUST lock the request and approval when present, return `APPROVAL_NOT_FOUND` when no receipt exists and the
approval is absent, and validate stored version, cutoffs, hashes, canonical plan and projections, counts, order, and
UTF-8 byte equations before mutation; altered data MUST close as integrity failure.
#### Scenario: Tampered approval
- GIVEN a receiptless request with an absent approval, or an approval with inconsistent immutable data
- WHEN apply runs
- THEN `APPROVAL_NOT_FOUND` or `APPROVAL_INTEGRITY_FAILURE`, respectively, returns with no Task or receipt DML.

### Requirement: Eligible ordered projection
Only stored `eligible` rows MUST produce candidates in canonical order and exact approved values. Every noneligible
disposition, including excluded and manual-review rows, MUST remain retained in the approval and MUST NOT be discarded.
#### Scenario: Mixed dispositions
- GIVEN eligible, excluded, and manual-review rows
- WHEN apply commits
- THEN only eligible rows become candidates and all dispositions remain represented in the retained approval.

### Requirement: Live context revalidation
Immediately before insertion, each candidate MUST have an active owner with a NONEMPTY role set, where every role is
one of exactly `admin|manager|asesor`, and a present, non-deleted, non-archived operational lead assigned to that owner.
An empty set or any outside role MUST close as stale.
#### Scenario: Stale owner or lead
- GIVEN an owner is inactive, has an empty role set, has an outside role, or a lead is deleted, archived, or reassigned
- WHEN apply runs
- THEN `STALE_LIVE_CONTEXT` returns with no Task or receipt.

### Requirement: Closed precedence
The RPC domain union MUST be exactly `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|
APPLY_IDEMPOTENCY_CONFLICT|APPROVAL_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|STALE_LIVE_CONTEXT|TASK_OCCUPANCY_CONFLICT|
LIMIT_EXCEEDED`; the RPC MUST NEVER emit `PERSISTENCE_FAILURE`. Precedence MUST be auth (required, inactive, not-admin,
actor-mismatch), invalid request, application receipt mismatch, approval missing, approval integrity, stale context,
occupancy, then bounds. The adapter-only result union adds `PERSISTENCE_FAILURE` after unexpected provider/SQL errors or
malformed responses; successful exact receipt replay is checked at the receipt step, and no provider text is exposed.
#### Scenario: Stale beats conflict
- GIVEN a valid receiptless request with stale context and occupied Task keys
- WHEN apply runs
- THEN `STALE_LIVE_CONTEXT` wins and all writes are absent.

### Requirement: Atomic Task and receipt transaction
All eligible Tasks and exactly one receipt MUST commit atomically; approval rows MUST NOT be updated. Any failure MUST roll
back every Task and the receipt.
#### Scenario: Partial insert failure
- GIVEN two eligible candidates and failure on the second insert
- WHEN apply runs
- THEN neither Task nor receipt remains committed.

### Requirement: Exact 14-field Task shape
Each inserted Task MUST provide exactly `owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,
source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata`: approved owner/lead/due,
null quote, `Follow up with lead`, `pending`, `follow_up`, and exact follow-up-v1 provenance.
#### Scenario: Eligible creation
- GIVEN one valid eligible projection
- WHEN apply commits
- THEN exactly one Task has the complete 14-field approved representation.

### Requirement: Immutable purge-independent receipt
A separate append-only receipt MUST store request/approval/actor identity, fingerprint, ordered Task IDs, count, and
bounded result, with no purge-coupling foreign key. After the request lock, the RPC MUST check the receipt before requiring
an approval: exact identity/result replays even after approval purge, while a receiptless flow MUST require the approval.
Canonical UUID text MUST match lowercase
`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`; SQL-side text MUST also equal its
UUID cast roundtrip. The receipt helper/trigger and RPC MUST require canonical receipt/request/approval/actor/Task UUIDs,
and nested `result` MUST be exactly
`{schema:"follow-up-task-apply-result.v1",requestId,approvalId,actorId,taskIds,taskCount}` with no other keys. Its three
identity values MUST equal the canonical text of the corresponding top-level receipt values. Task IDs MUST be distinct,
with exact ordered equality between top-level `task_ids` and nested `result.taskIds`, and
`task_count=result.taskCount=cardinality(task_ids)=cardinality(result.taskIds)`. Malformed, duplicate, reordered,
missing, extra, or mismatched IDs or counts MUST prevent receipt persistence or valid replay. The receipt MUST survive
source and approval purge without relaxing any of these checks.
#### Scenario: Receipt survives purge
- GIVEN a committed apply followed by authorized source and approval purge
- WHEN the receipt is read by an Admin
- THEN replay succeeds from the self-validating receipt alone, and its canonical identities, exact ordered distinct Task
  IDs, equal counts, receipt bytes, and Task source UUID remain available and unchanged.

### Requirement: Replay and occupancy conflicts
Exact receipt identity/result MUST replay without inserts, and concurrent identical calls MUST converge to one receipt.
Receipt identity/result mismatch MUST return `APPLY_IDEMPOTENCY_CONFLICT`. Any receiptless existing Task in any of the
three namespaces—`source_event_id`, `(owner_id,idempotency_key)`, or `(owner_id,lead_id)`—MUST return
`TASK_OCCUPANCY_CONFLICT`; Tasks MUST never be adopted. The only advisory-lock namespace order MUST be rank 1
`follow-up-apply:receipt-request:v1|<lower(request UUID)>`, rank 2
`follow-up-apply:source:v1|<lower(source UUID)>`, rank 3
`follow-up-apply:owner-idempotency:v1|<lower(owner UUID)>|<key>`, and rank 4
`follow-up-apply:owner-lead:v1|<lower(owner UUID)>|<lower(lead UUID)>`. Within each rank, deduplicated preimages MUST be
acquired in ascending PostgreSQL text order under `COLLATE "C"`, which is bytewise for these ASCII preimages. Rank 1 MUST
be acquired before receipt lookup; receiptless execution MUST acquire ranks 2 through 4 after locked live validation. No
alternate rank, phase, or ordering is permitted.
#### Scenario: Replay versus receiptless occupancy
- GIVEN concurrent retries, an actor-mismatched receipt, and a receiptless Task matching each occupancy namespace
- WHEN apply runs
- THEN exact calls replay one receipt, receipt mismatch returns `APPLY_IDEMPOTENCY_CONFLICT`, and receiptless occupancy
  returns `TASK_OCCUPANCY_CONFLICT` without adoption.

### Requirement: RLS, grants, and append-only security
Receipt RLS MUST be enabled and forced with Admin-only SELECT; direct receipt/Task writes and public, anon, and service-role
RPC execution MUST be revoked, authenticated execution narrowly granted, and receipt UPDATE/DELETE MUST fail.
#### Scenario: Non-Admin access
- GIVEN a non-Admin attempts to read, insert, update, or delete a receipt
- WHEN access is attempted
- THEN RLS/grants or immutable enforcement reject it and the receipt is unchanged.

### Requirement: Bounds, zero unrelated DML, and type boundaries
The 2,000-row and canonical UTF-8 limits MUST be checked before mutation; source, CRM, quote, profile, and approval DML
outside the receipt insert MUST be zero. Private RPC and public camel-case result unions MUST be exact; malformed provider
data MUST map to `PERSISTENCE_FAILURE`. The adapter's strict decoder MUST validate every UUID-bearing success value:
top-level `id`, `request_id`, `approval_id`, `actor_id`, every `task_ids` item, and nested `result.requestId`,
`result.approvalId`, `result.actorId`, and every `result.taskIds` item. It MUST also require distinct Task IDs, exact
equality of nested and top-level request/approval/actor identities, exact ordered equality of top-level and nested Task-ID
arrays, and equality of both counts with both array cardinalities. It MUST reject wrong/missing/extra keys or types and
every malformed, duplicate, reordered, missing, extra, or mismatched ID/count case before constructing public success.
The adapter and every strict RPC or nested-result decoder it requires MUST ship and be tested in the same
behavior-complete slice.
#### Scenario: Closed bounded failure
- GIVEN an over-limit plan, or a success response with a malformed UUID, duplicate/reordered/missing/extra/mismatched Task
  ID, disagreeing top-level/nested count, wrong cardinality, or wrong/missing/extra key
- WHEN apply runs through the adapter
- THEN `LIMIT_EXCEEDED` or exact adapter-only `PERSISTENCE_FAILURE` returns, no public success is constructed, and zero
  unrelated DML occurs.

### Requirement: Additive delivery and proof gate
`database.types.ts` MUST manually define exact receipt Row/Insert/Update/Relationships and RPC Args/Returns using `Json`;
no generated types or downstream reads MAY be added. The only tentative post-`0065` migrations MUST be
`0066_follow_up_task_apply_receipt_foundation.sql` and `0067_follow_up_task_apply_rpc.sql`, allocated only after read-only
reconciliation. They MUST leave `0061`–`0065` immutable, include rollback, and be proven only in disposable PostgreSQL.
Unknown remote state MUST block all remote operations.
#### Scenario: Unknown state blocks delivery
- GIVEN migration reconciliation, disposable proof, or rollback evidence is missing or ambiguous
- WHEN preparation is evaluated
- THEN delivery is blocked, historical migrations remain unchanged, and remote state is untouched.
