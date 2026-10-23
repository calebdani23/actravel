# Design: Apply Approved Follow-up Plans to Tasks

## Technical Approach

Add exactly two tentative additive migrations after `0065`, allocated only after read-only
reconciliation: `0066_follow_up_task_apply_receipt_foundation.sql` (receipt/security) and
`0067_follow_up_task_apply_rpc.sql` (apply RPC). Local proof runs `0057`–`0067`; historical
`0061`–`0065` are unchanged. The sole new RPC is `public.apply_approved_follow_up_task_plan(p_request_id_text text,
p_expected_actor_id uuid) returns jsonb`. It is a `SECURITY DEFINER` transaction: authenticate,
lock request and receipt, replay before approval lookup, then validate the immutable approval, lock
live/occupancy keys deterministically, insert ordered eligible Tasks, and insert one receipt. Never
copy, modify, or call `approve_follow_up_task_plan` from `0065`; migrations `0061`–`0065` stay immutable.

## Architecture Decisions

| Choice | Rejected | Rationale |
|---|---|---|
| Unique two-argument apply RPC | Reuse approval RPC/client projections | Apply consumes stored approval and cannot drift. |
| Receipt-first branching | Approval-first lookup | A valid receipt replays after approval purge. |
| One PostgreSQL transaction | Adapter Task loop | Tasks and receipt are all-or-nothing. |
| No-FK append-only receipt | Source/approval/Task FKs | Purges cannot invalidate evidence. |

## Data Flow / Locking

The sole acquisition sequence is: rank-1 request advisory lock; receipt row lock and replay
self-validation; if receiptless, approval row lock and integrity validation; stable sorted `profiles`
locks; stable sorted `leads` locks; stable sorted `profile_roles` then `roles` locks; live validation;
rank-2 through rank-4 occupancy advisory locks in the total order below; sorted existing Task-row
locks; occupancy validation; bounds validation; sorted inserts; receipt insert. Every lock remains
held through insertion; no alternate lock order is permitted.

| Rank | Advisory-lock namespace | Exact preimage |
|---:|---|---|
| 1 | Receipt request | `follow-up-apply:receipt-request:v1|<lower(request UUID)>` |
| 2 | Source event | `follow-up-apply:source:v1|<lower(source UUID)>` |
| 3 | Owner/idempotency | `follow-up-apply:owner-idempotency:v1|<lower(owner UUID)>|<key>` |
| 4 | Owner/lead | `follow-up-apply:owner-lead:v1|<lower(owner UUID)>|<lower(lead UUID)>` |

This is the single total advisory-lock namespace rank. For every rank, deduplicate exact preimages,
then sort ascending with PostgreSQL text `COLLATE "C"`, which is bytewise for these ASCII preimages.
Rank 1 has one request preimage and is acquired before receipt lookup. Receiptless execution later
acquires all candidate preimages at ranks 2, 3, and 4 in rank order and then bytewise preimage order
within that rank. It MUST NOT recombine or reacquire rank 1, compare under locale-dependent collation,
or use any alternate namespace rank.

The adapter passes exactly:
```ts
type ApplyRpcArgs = { p_request_id_text: string; p_expected_actor_id: string };
```
The RPC validates lowercase UUID grammar/cast roundtrip and uses the `0065` 16-hex SHA-256 advisory
conversion for the request. Every timestamp in a preimage is deterministic UTC RFC3339 text with
exactly six fractional digits and a trailing `Z` (PostgreSQL `to_char(timestamptz AT TIME ZONE 'UTC',
'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`). Receipt lookup follows the request lock and branches before
approval lookup: self-validate receipt request/result equations using only input plus stored receipt
values (approval fingerprint is not recomputed), then compare exact request, actor, approval identity,
fingerprints/hashes, ordered IDs, count, result, result hash, and byte count;
any mismatch, including failed receipt self-validation, is `APPLY_IDEMPOTENCY_CONFLICT`. A valid
receipt therefore replays after approval purge.
Only receiptless execution computes/validates approval-derived fingerprint and proceeds to
approval-not-found, integrity, live, occupancy, and bounds checks in precedence order.

For a receiptless apply, validate the stored versions, cutoffs, canonical plan and projection,
ordinality, counts, UTF-8 equations, and hashes at the integrity step. Each candidate owner must be
active with a nonempty role set and no role outside exactly `admin|manager|asesor`; its lead must be
present, non-deleted, non-archived, and assigned to that owner. Build only the four domain-separated
preimages and use only the rank and `COLLATE "C"` ordering in the table above. The stable row locks
listed above are `FOR UPDATE`; live validation follows those locks, then candidate occupancy
preimages at ranks 2 through 4 are deduplicated and locked once, then matching Task rows are locked
`FOR UPDATE` sorted by Task UUID, occupancy and bounds are validated, and inserts occur in stored
projection ordinal order. Any receiptless match in any namespace is `TASK_OCCUPANCY_CONFLICT`;
never adopt Tasks.

## Receipt / Canonical Contracts

The exact table/object set is `public.follow_up_task_apply_receipts`, unique index
`follow_up_task_apply_receipts_request_id_key`, policy `follow_up_task_apply_receipts_admin_select`,
trigger `follow_up_task_apply_receipts_immutable`, and trigger function
`public.reject_follow_up_task_apply_receipt_mutation()`. It has no foreign keys, is append-only, and
has forced RLS.
columns in this order: `id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY`; `request_id uuid
NOT NULL UNIQUE`; `approval_id uuid NOT NULL`; `actor_id uuid NOT NULL`; `approval_fingerprint text
NOT NULL`; `request_fingerprint text NOT NULL`; `canonical_plan_hash text NOT NULL`; `projection_hash
text NOT NULL`; `status text NOT NULL CHECK (status='applied')`; `task_ids uuid[] NOT NULL`; `task_count integer NOT NULL`; `result jsonb NOT NULL`;
`result_hash text NOT NULL`; `result_byte_count integer NOT NULL`; `created_at timestamptz NOT NULL
DEFAULT now()`. Fingerprints/hashes are lowercase 64-hex. `task_ids uuid[]` is the ordered Task-ID
array; its position is the projection ordinal (`1..task_count`), and
`task_count = cardinality(task_ids) = count(inserted eligible Tasks)`, bounded `0..2000`.
Column types and CHECKs enforce UUID-typed identities, count/cardinality, lowercase hash formats,
nonnegative byte count, and the explicit 1MiB result bound; the helper/trigger enforces non-null and
distinct Task-ID elements, projection order, top-level/nested equality, and exact result shape.

`approvalPreimage` is exactly canonical JSON of
`["follow-up-task-approval.v1",id,request_id,actor_id,actor_role,schema_version,rule_version,event_cutoff_created_at,event_cutoff_id,task_cutoff_created_at,task_cutoff_id,reader_snapshot_hash,canonical_plan_hash,request_fingerprint,projection_hash,canonical_plan,eligible_projections,eligible_count,invalid_date_no_task_count,manual_review_unassigned_owner_count,excluded_lead_not_operational_count,excluded_non_selected_history_count,already_converted_count,collision_manual_review_count,total_count,row_count,projection_count,canonical_plan_byte_count,projection_byte_count,request_byte_count]`; `approval_fingerprint=lowerhex(SHA-256(convert_to(canonical_json(approvalPreimage),'UTF8')))`.
`requestPreimage=["follow-up-task-apply-request.v1",requestText,actorText]`;
`request_fingerprint=lowerhex(SHA-256(convert_to(canonical_json(requestPreimage),'UTF8')))`.
Both fingerprints are recomputed while the approval exists and must equal stored values; receipt
replay never recomputes an approval fingerprint. Define
`type ApplyTaskId=string` and `type ApplyResult={schema:"follow-up-task-apply-result.v1";requestId:string;approvalId:string;actorId:string;taskIds:ApplyTaskId[];taskCount:number}`; SQL `result` is exactly the JSON object with those five keys and no others; task-ID position is the projection ordinal.
`resultPreimage=["follow-up-task-apply-result.v1",requestText,approvalIdText,actorIdText,taskIds,taskCount]`;
`resultCanonical=canonical_json(resultPreimage)`; `resultBytes=convert_to(resultCanonical,'UTF8')`;
`result_hash=lowerhex(SHA-256(resultBytes))`; `result_byte_count=octet_length(resultBytes) <= 1048576`.
Canonical UUID text means exact lowercase
`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` plus SQL
`value::uuid::text=value`. Receipt identity columns and top-level `task_ids` are UUID typed. The SQL
helper `public.validate_follow_up_task_apply_result(jsonb,text,text,text,uuid[],integer,text,integer) RETURNS boolean`
is `IMMUTABLE`, `STRICT`, and returns true only when the nested value has exactly the five
`ApplyResult` keys and exact schema value; all nested request/approval/actor/Task UUID texts are
canonical; nested `requestId`, `approvalId`, and `actorId` equal the corresponding top-level receipt
identities; all top-level and nested Task IDs are non-null and distinct; nested `taskIds` exactly
equals top-level `task_ids` element-for-element and in order; and
`task_count=result.taskCount=cardinality(task_ids)=cardinality(result.taskIds)`. It also requires the
exact `resultPreimage`/`resultCanonical`, UTF-8 bytes, supplied SHA-256, supplied byte count, and bound.
Malformed, duplicate, reordered, missing, extra, or mismatched IDs/counts return false. The table
CHECKs enforce scalar nullability/status/hash/byte/count invariants. The
`BEFORE INSERT OR UPDATE OR DELETE` trigger uses
`public.reject_follow_up_task_apply_receipt_mutation() RETURNS trigger`; INSERT returns `NEW` only
after the complete helper validation passes, while UPDATE/DELETE raises
`FOLLOW_UP_TASK_APPLY_RECEIPT_IMMUTABLE`. The RPC repeats the same complete helper validation before
its receipt insert; table CHECKs do not replace trigger/RPC assertions.
Zero candidates store `taskIds=[]`, `taskCount=0`, and the same canonical result equations. Stored
`result` is exactly `ApplyResult`; replay requires exact equality of every receipt field except
`created_at`, including both fingerprints, all hashes, IDs, count, result, result hash, and bytes.
Update/delete triggers raise
`FOLLOW_UP_TASK_APPLY_RECEIPT_IMMUTABLE`; direct receipt/Task writes are revoked.

Only stored `eligible` rows emit the exact 14 fields
`owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,
source_event_type,source_event_created_at,source_due_at,source_payload,metadata`, with approved
values, null quote, `Follow up with lead`, `pending`, `follow_up`, and follow-up-v1 provenance.
Noneligible dispositions remain in the approval. Plan/projection/request canonical UTF-8 limits are
row 512, item 2048, plan 1MiB, projection 4MiB, request 5MiB.

## Interfaces / Files / Work Units

`lib/admin/follow-up-task-approved-plan-apply.ts` defines `ApplyDeps` with injected
`requireAdminRole?: typeof requireAdminRole`, `createClient?: typeof createClient`, and
`invokeRpc?: (client: Awaited<ReturnType<typeof createClient>>, args: ApplyRpcArgs) => Promise<{data:unknown;error:null|{code?:string;message?:string}}>`.
Auth is called before client creation and its throws propagate unchanged. Private `RpcResult` is
exactly the snake success `{ok:true,status:'applied'|'replayed',id,request_id,approval_id,actor_id,
approval_fingerprint,request_fingerprint,canonical_plan_hash,projection_hash,task_ids,task_count,
result,result_hash,result_byte_count,created_at}` or `{ok:false,error:{code:ApplyDomainCode,message:ApplyDomainCode}}`.
`ApplyDomainCode` is exactly `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|
APPLY_IDEMPOTENCY_CONFLICT|APPROVAL_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|STALE_LIVE_CONTEXT|TASK_OCCUPANCY_CONFLICT|LIMIT_EXCEEDED`.
RPC precedence is exactly auth (required, inactive, not-admin, actor-mismatch), invalid request,
receipt mismatch, approval missing, approval integrity, stale context, occupancy, then limits;
`PERSISTENCE_FAILURE` is adapter-only.
Public camel success has the same fields (`receiptId,requestId,approvalId,actorId,approvalFingerprint,
requestFingerprint,canonicalPlanHash,projectionHash,taskIds,taskCount,result,resultHash,resultByteCount,
createdAt`) plus `status:'success'` and `replayed`; public failure adds adapter-only
`PERSISTENCE_FAILURE`. The adapter's strict decoder validates canonical UUID grammar for top-level
`id`, `request_id`, `approval_id`, `actor_id`, every `task_ids` item, and nested `result.requestId`,
`result.approvalId`, `result.actorId`, and every `result.taskIds` item. It rejects null, arrays where
objects are required, wrong/missing/extra keys or types, nested request/approval/actor identity drift,
duplicate Task IDs, any reordered/missing/extra/mismatched top-level versus nested Task ID, and any
inequality among top-level `task_count`, nested `result.taskCount`, and both array cardinalities. Only
then may it construct public success, whose camel fields preserve the same exact identity and ordered
equality. Provider errors/throws/malformed data close as `PERSISTENCE_FAILURE`, never provider text.

| Stacked-to-main behavior-complete slice (each ≤400 additions+deletions unless noted) | Ships co-located tests, evidence, rollback |
|---|---|
| 1. Receipt/security foundation (250 additions+deletions) | `0066_follow_up_task_apply_receipt_foundation.sql`: receipt, complete result-integrity helper/trigger, RLS/grants, co-located schema proof/evidence, and migration-1 rollback. |
| 2. Apply RPC/atomic behavior (650 estimated additions+deletions; maintainer `size:exception`, hard cap 800) | `0067_follow_up_task_apply_rpc.sql`: RPC, projections, total locks, atomicity, replay/concurrency, stale/occupancy, purge proof, co-located runtime/static evidence, and migration-2 rollback. |
| 3. Manual database type boundary (220 additions+deletions) | Exact receipt Row/Insert/Update/Relationships and apply RPC Args/Returns plus compile-time contract proof and isolated type rollback. |
| 4. Adapter/strict decoding (380 additions+deletions) | `{requestId}` adapter plus every strict RPC success/failure and nested-result decoder it needs, closed mapping, auth-before-client, malformed-success cases, final static/runtime proof, allocation/immutability/rollback evidence, durable docs, and adapter/verification rollback. |

The automatic forecast is exactly 1,500 additions+deletions across four serial stacked-to-main PRs.
Slice 2 preserves the maintainer-approved 650 estimate and hard 800 `size:exception`; it requires no
new approval. `main → Slice 1 📍 → refreshed main → Slice 2 → refreshed main → Slice 3 → refreshed
main → Slice 4`; each slice starts only after its prerequisite merges, targets `main`, is independently
buildable/testable and behavior-complete, ships its own tests/evidence and isolated rollback, and is
not a file-type, test-later, or decoder-later split. Slice 3 delivers the compile-time Supabase
database boundary as its complete contract behavior. Slice 4 delivers the adapter and all runtime
decoders together; neither may be split from the other.

## Proof Matrix

| Case | Required assertion |
|---|---|
| Invalid request | exact `INVALID_REQUEST`; no approval/DML |
| Auth and actor mismatch | exact auth code; adapter throw unchanged before client/RPC; no DML |
| Exact receipt replay | concurrent calls converge to one receipt; replay precedes approval lookup |
| Receipt mismatch | exact `APPLY_IDEMPOTENCY_CONFLICT`; no approval lookup/DML |
| Advisory namespace order | rank 1 receipt-request, rank 2 source, rank 3 owner/idempotency, rank 4 owner/lead; exact preimages are deduplicated and bytewise `COLLATE "C"` sorted within rank; no alternate order |
| Approval absent/tamper | exact not-found/integrity; no DML |
| Zero candidates | empty ordinal IDs, count 0, valid result hash/bytes/receipt |
| Mixed dispositions/14 fields | eligible-only ordinal Tasks; retained rows; all 14 exact fields |
| Stale-before-conflict/live locks | stale wins; profiles, leads, profile_roles/roles remain locked through insert |
| Source occupancy | receiptless source UUID conflicts; no adoption |
| Owner/idempotency occupancy | receiptless owner+key conflicts; no adoption |
| Owner/lead occupancy | receiptless owner+lead conflicts; no adoption |
| Second-row failure | first Task and receipt roll back |
| Malformed provider/limits | adapter `PERSISTENCE_FAILURE` or RPC `LIMIT_EXCEEDED`; zero unrelated DML |
| Canonical success UUIDs | malformed top-level receipt/request/approval/actor/Task UUID or nested request/approval/actor/Task UUID is rejected as adapter `PERSISTENCE_FAILURE` |
| Task-ID/result integrity | exact schema, identity equality, and ordered distinct IDs pass; identity drift, duplicate, reordered, missing, extra, or mismatched top-level/nested IDs and every count/cardinality mismatch are rejected by SQL receipt validation and adapter decoding |
| RLS/grants/append-only | Admin SELECT only; direct writes/update/delete rejected |
| Purge | privileged disposable source+approval purge only; self-validating receipt replay, exact IDs/counts/bytes, and source UUID survive unchanged |
| Allocation/rollback/0065 | read-only allocation gate; unknown remote blocks; exact rollback; `0065` unchanged |

Use the existing local PostgreSQL helper and lexical migrations `0057`–`0067`. Purge is
privileged disposable setup only; no production purge API. ACTIVE routing update is a separate parent
planning record, not an implementation blocker.

## Migration / Rollback

Unknown remote history blocks allocation and all remote operations. Local allocation is read-only;
no remote apply, parity, cutover, rollout, or production claim. Exact rollback SQL/object order is:
`REVOKE ALL ON FUNCTION public.apply_approved_follow_up_task_plan(text,uuid) FROM PUBLIC,anon,authenticated,service_role`;
`REVOKE ALL ON TABLE public.follow_up_task_apply_receipts FROM PUBLIC,anon,authenticated,service_role`;
`DROP FUNCTION public.apply_approved_follow_up_task_plan(text,uuid)`;
`DROP POLICY follow_up_task_apply_receipts_admin_select ON public.follow_up_task_apply_receipts`;
`DROP TRIGGER follow_up_task_apply_receipts_immutable ON public.follow_up_task_apply_receipts`;
`DROP FUNCTION public.reject_follow_up_task_apply_receipt_mutation()`;
`DROP FUNCTION public.validate_follow_up_task_apply_result(jsonb,text,text,text,uuid[],integer,text,integer)`;
`DROP TABLE public.follow_up_task_apply_receipts` (which drops its owned UNIQUE index; never drop that index independently).
Then remove only adapter, manual types, and focused proof. No existing Task/source DML and no changes
to `0061`–`0065`.

## Open Questions

None.
