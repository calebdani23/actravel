# Follow-up Task Approval Ledger Specification

Exactly 7 formal requirements and exactly 7 formal scenarios below are normative. This change keeps the one-row
schema, valid 16-hex advisory conversion, PostgreSQL helper runtime, and excludes Task work,
remote/database operations, lifecycle, Docker setup, and downstream apply.

### Requirement: Input and boundary

The adapter consumes exactly `ApprovalInput={requestId:string;preview:Extract<ReaderResult,{ok:true}>}`.
The request ID MUST match `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, and
the validated UUID cast and its text form MUST compare equal. The adapter MUST execute
`const session=await requireAdminRole(["admin"]); p_expected_actor_id=session.user.id` before
`createClient`.
It does not reread sources or mutate Tasks, CRM, quotes, profiles, or Tasks. Eligible projections
are reconstructed in classifier row order.

#### Scenario: A successful reader result supplies only `requestId` and `preview`; diagnostics are ignored.

### Requirement: One-row schema and limits

Migration `0065` creates exactly `public.follow_up_task_approvals`, one row per unique `request_id`,
with columns in this order: `id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY`, `request_id uuid
NOT NULL UNIQUE`, `actor_id uuid NOT NULL`, `actor_role text NOT NULL CHECK (actor_role='admin')`,
`schema_version text NOT NULL CHECK (schema_version='follow-up-approval.v1')`, `rule_version text NOT
NULL CHECK (rule_version='follow-up-backfill.v1')`, event cutoff `timestamptz NOT NULL` plus UUID,
nullable paired task cutoff `timestamptz` plus UUID, `reader_snapshot_hash`, `canonical_plan_hash`,
`request_fingerprint`, `projection_hash`, `canonical_plan text`, `eligible_projections jsonb`, the
seven named counts, `total_count`, `row_count`, `projection_count`, `canonical_plan_byte_count`,
`projection_byte_count`, `request_byte_count`, and `created_at timestamptz NOT NULL DEFAULT now()`.
All text hashes are lowercase `[0-9a-f]{64}`; counts/bytes are nonnegative and each count and row
count is ≤2000. `total_count=row_count=eligible_count+invalid_date_no_task_count+
manual_review_unassigned_owner_count+excluded_lead_not_operational_count+excluded_non_selected_history_count+
already_converted_count+collision_manual_review_count`; `projection_count=eligible_count`.
RLS is enabled/forced, Admin SELECT is the only table access, and UPDATE/DELETE is rejected.

SQL types/nullability are exact: `id uuid NOT NULL`, `request_id uuid NOT NULL`, `actor_id uuid NOT NULL`,
`actor_role text NOT NULL`, `schema_version text NOT NULL`, `rule_version text NOT NULL`,
`event_cutoff_created_at timestamptz NOT NULL`, `event_cutoff_id uuid NOT NULL`,
`task_cutoff_created_at timestamptz NULL`, `task_cutoff_id uuid NULL`, the four hashes and
`request_fingerprint text NOT NULL`, `canonical_plan text NOT NULL`, `eligible_projections jsonb NOT NULL`,
each seven named count `integer NOT NULL`, `total_count integer NOT NULL`, `row_count integer NOT NULL`,
`projection_count integer NOT NULL`, each three byte count `integer NOT NULL`, and `created_at timestamptz NOT NULL`.
The task-cutoff paired CHECK is `(task_cutoff_created_at IS NULL) = (task_cutoff_id IS NULL)`.

#### Scenario: A valid request inserts one complete immutable row; duplicate request IDs cannot add a row.

### Requirement: Exact canonical equations

The canonical row is exactly `[eventId,leadId,ownerId,eventCreatedAt,dueAt,hasNote,rawFollowUpAt,disposition,reason]`, with index mapping `0=eventId`, `1=leadId`, `2=ownerId`, `3=eventCreatedAt`, `4=dueAt`, `5=hasNote`, `6=rawFollowUpAt`, `7=disposition`, and `8=reason`. `planValue=p_canonical_plan::jsonb`; require `follow_up_canonical_json(planValue)=p_canonical_plan`.
`planBytes=convert_to(p_canonical_plan,'UTF8')`; `canonical_plan_hash` is lowercase-hex SHA256 of
those bytes. Every plan row is the classifier’s exact nine-value row and its bytes are exact
`canonicalJson(row)` (≤512 octets). The static plan header is the actual classifier
`[ruleVersion,eventCutoffText,eventCutoffId,[],counts,0,0,0,0,false]` and is ≤4096 bytes; plan bytes
are ≤1MiB.

`projectionCanonical=follow_up_canonical_json(p_eligible_projections)`; each projection item’s exact
`canonicalJson(item)` is ≤2048 octets; aggregate `octet_length(convert_to(projectionCanonical,'UTF8'))`
is ≤4MiB; `projection_hash` is lowercase-hex SHA256 of those bytes.

`requestValue=["follow-up-approval-request.v1",requestIdText,actorIdText,schemaVersion,ruleVersion,
[eventCutoffText,eventCutoffIdText],taskCutoffArrayOrNull,readerSnapshotHash,canonicalPlanHash,projectionHash,
planValue,p_eligible_projections]`. `requestCanonical` is canonical JSON of that array; request bytes
and lowercase SHA256 fingerprint are computed from its exact UTF-8 bytes, ≤5MiB. No derived field is
inside its own preimage. Store every named count, byte, and hash derived value.

The eligible projection constructor consumes each canonical row in order and emits one item only when
`disposition="eligible"`; noneligible rows emit none. It enumerates exactly these 14
`FutureFollowUpTask` fields and values: `owner_id=row.ownerId`, `lead_id=row.leadId`, `quote_id=null`,
`description="Follow up with lead"`, `due_at=row.due`, `status="pending"`,
`idempotency_key=lowerhex(SHA-256(UTF-8("follow-up-task:v1|source_event_id="+lower(row.eventId))))`,
`task_kind="follow_up"`, `source_event_id=lower(row.eventId)`, `source_event_type="follow_up_registered"`,
`source_event_created_at=row.eventCreatedAt`, `source_due_at=row.due`,
`source_payload={followUpAt:row.rawFollowUpAt,hasNote:row.hasNote}`, and
`metadata={schema:"follow_up_task.v1",source_event_id:lower(row.eventId),source_event_type:"follow_up_registered",owner_id:lower(row.ownerId),lead_id:lower(row.leadId)}`.
Projection order is canonical row order and `projection_count` is the eligible-row count. SQL extracts rows with `planValue->3`, counts the seven named columns from `planValue->4`, takes `total_count` from `planValue->5`, and requires `row_count=jsonb_array_length(planValue->3)` and `projection_count=jsonb_array_length(p_eligible_projections)` (with the eligible count from its named column). The stored values equal exactly `canonical_plan_byte_count=octet_length(convert_to(p_canonical_plan,'UTF8'))`, `projection_byte_count=octet_length(convert_to(projectionCanonical,'UTF8'))`, and `request_byte_count=octet_length(convert_to(requestCanonical,'UTF8'))`; table CHECK equations repeat these count relationships.
The exact octet/hash equations are `planBytes=convert_to(p_canonical_plan,'UTF8')`,
`projectionBytes=convert_to(projectionCanonical,'UTF8')`, `requestBytes=convert_to(requestCanonical,'UTF8')`,
`canonical_plan_hash=lowerhex(SHA-256(planBytes))`, `projection_hash=lowerhex(SHA-256(projectionBytes))`,
and `request_fingerprint=lowerhex(SHA-256(requestBytes))`.

#### Scenario: Parse/re-canonicalize equality, equations, byte limits, and hashes all pass before insert or replay.

### Requirement: Exact RPC and mutation

The RPC is exactly:
```sql
public.approve_follow_up_task_plan(p_request_id_text text, p_expected_actor_id uuid, p_schema_version text,
p_rule_version text, p_event_cutoff_created_at text, p_event_cutoff_id uuid, p_task_cutoff_created_at text,
p_task_cutoff_id uuid, p_reader_snapshot_hash text, p_canonical_plan_hash text, p_projection_hash text,
p_request_fingerprint text, p_canonical_plan text, p_eligible_projections jsonb) returns jsonb
```
Task cutoff text/UUID are both nullable and paired; every other argument is non-null. Validate request
text against lowercase UUID grammar and `p_request_id_text::uuid::text=p_request_id_text` before cast/lock;
store the cast UUID. Use the valid 16-hex advisory conversion, then lock an existing row `FOR UPDATE`.
The exact lock SQL is:
`PERFORM pg_catalog.pg_advisory_xact_lock((('x' || pg_catalog.substr(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_request_id::text, 'UTF8'), 'sha256'), 'hex'), 1, 16))::bit(64)::bigint));`
Here `v_request_id` is the validated/cast request UUID; the first 16 lowercase hex characters encode
the first eight SHA-256 bytes as signed `bit(64)->bigint`.
Set `actorIdText=session.user.id` in the adapter, validate it with the lowercase UUID regex, pass
`p_expected_actor_id::text=actorIdText`, and in SQL set `v_actor_id=auth.uid()`, require
`v_actor_id=p_expected_actor_id`, store `actor_id=v_actor_id`, and use `v_actor_id::text` in the
request preimage. The request ID text uses the same regex and cast-roundtrip check; stored
`request_id` is the cast UUID. Exact identity replay returns the original row; any actor/fingerprint/identity difference returns a
domain JSON failure without mutation. New approval performs exactly one insert; any failed validation
performs no mutation. The helper is immutable SQL, STRICT, empty-search-path, postgres-owned, and
revoked from public roles; the RPC is SECURITY DEFINER, similarly owned/configured, executable only by
authenticated.

#### Scenario: Concurrent identical calls converge to one row; conflicting calls fail closed.

### Requirement: Domain precedence and adapter contract

Domain validation errors are JSONB, never SQL errors, with total precedence:
`AUTH_REQUIRED, AUTH_INACTIVE, AUTH_NOT_ADMIN, AUTH_ACTOR_MISMATCH, INVALID_REQUEST, INVALID_CUTOFF,
INVALID_PLAN, INVALID_PROJECTION, LIMIT_EXCEEDED, HASH_MISMATCH, APPROVAL_IDEMPOTENCY_CONFLICT`.
Unexpected SQL/transport is only adapter `PERSISTENCE_FAILURE`.

`ApprovalDeps={requireAdminRole?:typeof requireAdminRole;createClient?:typeof createClient;invokeRpc?:(client:Awaited<ReturnType<typeof createClient>>,args:ApproveRpcArgs)=>Promise<{data:unknown;error:null|{code?:string;message?:string}}>}`.
`ApproveRpcArgs` is exactly:
```ts
type ApproveRpcArgs = {
  p_request_id_text: string; p_expected_actor_id: string; p_schema_version: string; p_rule_version: string;
  p_event_cutoff_created_at: string; p_event_cutoff_id: string; p_task_cutoff_created_at: string | null;
  p_task_cutoff_id: string | null; p_reader_snapshot_hash: string; p_canonical_plan_hash: string;
  p_projection_hash: string; p_request_fingerprint: string; p_canonical_plan: string;
  p_eligible_projections: unknown[];
};
```
`ApprovalDomainCode` is exactly `"AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" |
"AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST" | "INVALID_CUTOFF" | "INVALID_PLAN" |
"INVALID_PROJECTION" | "LIMIT_EXCEEDED" | "HASH_MISMATCH" | "APPROVAL_IDEMPOTENCY_CONFLICT"`.
RPC snake success is exactly one of these two objects, with no `replayed` field:
```ts
{ok:true,status:'approved',id,request_id,actor_id,actor_role,schema_version,rule_version,event_cutoff_created_at,event_cutoff_id,task_cutoff_created_at,task_cutoff_id,reader_snapshot_hash,canonical_plan_hash,request_fingerprint,projection_hash,canonical_plan,eligible_projections,eligible_count,invalid_date_no_task_count,manual_review_unassigned_owner_count,excluded_lead_not_operational_count,excluded_non_selected_history_count,already_converted_count,collision_manual_review_count,total_count,row_count,projection_count,canonical_plan_byte_count,projection_byte_count,request_byte_count,created_at}
{ok:true,status:'replayed',id,request_id,actor_id,actor_role,schema_version,rule_version,event_cutoff_created_at,event_cutoff_id,task_cutoff_created_at,task_cutoff_id,reader_snapshot_hash,canonical_plan_hash,request_fingerprint,projection_hash,canonical_plan,eligible_projections,eligible_count,invalid_date_no_task_count,manual_review_unassigned_owner_count,excluded_lead_not_operational_count,excluded_non_selected_history_count,already_converted_count,collision_manual_review_count,total_count,row_count,projection_count,canonical_plan_byte_count,projection_byte_count,request_byte_count,created_at}
```
RPC success is exactly `{ok:true}` plus
every table field (`id`, `request_id`, `actor_id`, `actor_role`, `schema_version`, `rule_version`,
`event_cutoff_created_at`, `event_cutoff_id`, `task_cutoff_created_at`, `task_cutoff_id`,
`reader_snapshot_hash`, `canonical_plan_hash`, `request_fingerprint`, `projection_hash`, `canonical_plan`,
`eligible_projections`, all seven named counts, `total_count`, `row_count`, `projection_count`,
`canonical_plan_byte_count`, `projection_byte_count`, `request_byte_count`, `created_at`) with table
types and nullability. Internal `RpcApprovalSuccess` lists every snake key/type in that table-field list;
internal `RpcApprovalFailure` is exactly `{ok:false,error:{code:ApprovalErrorCode,message:ApprovalErrorCode}}`, where
`ApprovalErrorCode=ApprovalDomainCode|"PERSISTENCE_FAILURE"`.
Private `RpcApprovalResult` is the union of `RpcApprovalSuccess` and `RpcApprovalFailure`. Exported public `ApprovalSuccess` is exactly the same fields camel-cased (`approvalId`, `requestId`, `actorId`, `actorRole`,
`schemaVersion`, `ruleVersion`, `eventCutoffCreatedAt`, `eventCutoffId`, `taskCutoffCreatedAt`,
`taskCutoffId`, `readerSnapshotHash`, `canonicalPlanHash`, `requestFingerprint`, `projectionHash`,
`canonicalPlan`, `eligibleProjections`, the seven camel-cased counts, `totalCount`, `rowCount`,
`projectionCount`, `canonicalPlanByteCount`, `projectionByteCount`, `requestByteCount`, `createdAt`),
with corresponding string/number/nullable types, plus public `status:"success"` and
`replayed = (status === 'replayed')`; the adapter enumerates both exact RPC objects consistently.
The seven camel-cased count keys are exactly `eligibleCount:number`, `invalidDateNoTaskCount:number`,
`manualReviewUnassignedOwnerCount:number`, `excludedLeadNotOperationalCount:number`,
`excludedNonSelectedHistoryCount:number`, `alreadyConvertedCount:number`, and
`collisionManualReviewCount:number`; all other camel keys have the table-derived types above.
UUID/timestamp values are strings, counts/bytes are numbers, `canonicalPlan` is string, projections is
an array, and task cutoff values are paired `string|null`; no extra or missing keys are valid. Public
failure is exactly `ApprovalFailure={ok:false,error:{code:ApprovalErrorCode,message:ApprovalErrorCode}}`.
Exported `ApprovalResult` is the union of `ApprovalSuccess` and `ApprovalFailure`. `approveFollowUpTask(input,deps?):Promise<ApprovalResult>` calls `requireAdminRole(["admin"])`, whose
throws propagate unchanged before client creation. RPC domain JSON maps field-for-field. Any Supabase
error/throw, SQL error, null/array/extra/missing/wrong-type data maps exactly to
`{ok:false,error:{code:"PERSISTENCE_FAILURE",message:"PERSISTENCE_FAILURE"}}`, never provider text.

#### Scenario: Authorization rejection makes no client/RPC call and preserves the exact throw.

The RPC evaluates these predicates in this exact order; every domain branch returns exactly
`jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code))` and
writes zero rows: `auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'` → `AUTH_REQUIRED`;
missing/inactive profile, exactly `NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_actor_id AND is_active=true)` → `AUTH_INACTIVE`;
absent admin role, exactly `NOT EXISTS (SELECT 1 FROM public.profile_roles pr JOIN public.roles r ON r.id=pr.role_id WHERE pr.profile_id=v_actor_id AND r.name='admin')` → `AUTH_NOT_ADMIN`;
`v_actor_id <> p_expected_actor_id` → `AUTH_ACTOR_MISMATCH`; request regex,
UUID cast/text equality, schema, rule, and hash formats → `INVALID_REQUEST`; cutoff pair/canonical/equality
→ `INVALID_CUTOFF`; plan parse, canonical equality, ten-shape, every row, reason, count, and static header
→ `INVALID_PLAN`; projection array, exact keys/order/values/idempotency → `INVALID_PROJECTION`; row/item/
aggregate limits → `LIMIT_EXCEEDED`; recomputed plan/projection/request hashes → `HASH_MISMATCH`; advisory
lock → lock then existing actor; exact replay fingerprint and all stored values → replay, else conflict
→ `APPROVAL_IDEMPOTENCY_CONFLICT`; finally insert exactly one row. In-function parse failures are handled
only by their named category. PostgreSQL handles the UUID-typed arguments; malformed transport values for
those arguments never enter the function, and the adapter maps the Supabase transport error to
`PERSISTENCE_FAILURE`. Unexpected SQL escapes the RPC and the adapter maps it to `PERSISTENCE_FAILURE`.
Domain errors always return JSONB and perform no mutation. The one-row, seven-count/seven-scenario,
local-helper, no-Task, no-remote, and no-lifecycle constraints remain unchanged.

| Order | Predicate/branch | Result |
|---:|---|---|
| 1 | auth uid | `AUTH_REQUIRED` |
| 2 | auth role | `AUTH_REQUIRED` |
| 3 | active profile | `AUTH_INACTIVE` |
| 4 | Admin role | `AUTH_NOT_ADMIN` |
| 5 | expected actor | `AUTH_ACTOR_MISMATCH` |
| 6 | request regex/cast/schema/rule/hash formats | `INVALID_REQUEST` |
| 7 | cutoff pair/canonical/equality | `INVALID_CUTOFF` |
| 8 | plan parse/canonical/10-shape/row/reason/count/static header | `INVALID_PLAN` |
| 9 | projection array/key/order/value/idempotency | `INVALID_PROJECTION` |
| 10 | row/item/aggregate limits | `LIMIT_EXCEEDED` |
| 11 | recomputed plan/projection/request hashes | `HASH_MISMATCH` |
| 12 | advisory lock; existing actor; exact replay fingerprint/all stored values | replay or `APPROVAL_IDEMPOTENCY_CONFLICT` |
| 13 | insert | exactly one row |

The exact category predicates are:

- `INVALID_REQUEST`: any of the in-function predicates `p_request_id_text IS NULL`, `p_expected_actor_id IS NULL`, `p_schema_version IS NULL`, `p_rule_version IS NULL`, `p_event_cutoff_created_at IS NULL`, `p_event_cutoff_id IS NULL`, `p_reader_snapshot_hash IS NULL`, `p_canonical_plan_hash IS NULL`, `p_projection_hash IS NULL`, `p_request_fingerprint IS NULL`, `p_canonical_plan IS NULL`, or `p_eligible_projections IS NULL` is true; `p_request_id_text` does not match literal lowercase `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` or its validated UUID cast/text roundtrip fails; `p_schema_version` and `p_rule_version` are not exactly `'follow-up-approval.v1'`/`'follow-up-backfill.v1'`; or any of `p_reader_snapshot_hash`, `p_canonical_plan_hash`, `p_projection_hash`, and `p_request_fingerprint` fails lowercase `^[0-9a-f]{64}$`. `p_expected_actor_id` and `p_event_cutoff_id` are UUID-typed by PostgreSQL, as is nullable `p_task_cutoff_id`; malformed non-null transport values never enter the function and the adapter maps the Supabase transport error to `PERSISTENCE_FAILURE`. This category does not catch those typed casts.
- `INVALID_CUTOFF`: paired task cutoff nullness differs; either cutoff timestamp cannot parse or fails canonical timestamp parse/roundtrip; either cutoff UUID is not lowercase canonical UUID text; or event cutoff text/UUID mismatches plan slots 1/2. Timestamp parse failures are handled here; UUID-typed transport casts never enter the function.
- `INVALID_PLAN`: JSON cast or canonical text equality fails; the top-level value is not an array of exactly 10 elements; rows/counts are not arrays of exactly 9/7 elements; the exact tail is not `[totalCount,0,0,0,false]`; any row is not `[lowercaseUuid,lowercaseUuid,lowercaseUuidOrNull,canonicalTimestamp,canonicalTimestampOrNull,booleanOrNull,canonicalTimestampOrNull,disposition,reason]`; the first two IDs, event timestamp, disposition, and reason are not non-null; legal disposition/reason pairs are exactly `(eligible,ELIGIBLE)`, `(invalid-date/no-task,INVALID_DATE_NO_TASK)`, `(manual-review/unassigned-owner,UNASSIGNED_OWNER)`, `(manual-review/unassigned-owner,PROFILE_MISSING)`, `(manual-review/unassigned-owner,PROFILE_INACTIVE)`, `(manual-review/unassigned-owner,ROLE_INVALID)`, `(excluded/lead-not-operational,LEAD_NOT_OPERATIONAL)`, `(excluded/non-selected-history,NON_SELECTED_HISTORY)`, `(already-converted,ALREADY_CONVERTED)`, `(collision/manual-review,DUPLICATE_SOURCE)`, `(collision/manual-review,SOURCE_MISMATCH)`, `(collision/manual-review,IDEMPOTENCY_COLLISION)`, and `(collision/manual-review,OWNER_LEAD_COLLISION)`; for `eligible`, `already-converted`, and `collision/manual-review`, owner, due, hasNote, and rawFollowUpAt are all non-null; for `manual-review/unassigned-owner` with reason `UNASSIGNED_OWNER`, all four are null; for `manual-review/unassigned-owner` with reason `PROFILE_MISSING`, `PROFILE_INACTIVE`, or `ROLE_INVALID`, owner is non-null and due, hasNote, and rawFollowUpAt are null; for `invalid-date/no-task`, `excluded/lead-not-operational`, and `excluded/non-selected-history`, all four are null; totals/counts mismatch; or the static header formula is not exactly `[ruleVersion,eventCutoffText,eventCutoffId,[],counts,0,0,0,0,false]`. Plan parse failures are handled as `INVALID_PLAN`; UUID-typed transport casts are not caught here.
- `INVALID_PROJECTION`: projections is not an array; an item is not an object with exactly the 14 keys; eligible cardinality or canonical row order differs; or any exact field, payload, metadata, lowercase value, or idempotency value differs. Projection parse/cast exceptions are caught here.
- `LIMIT_EXCEEDED`: `row_count > 2000`; any row exceeds 512 UTF-8 bytes; static header exceeds 4096 bytes; plan exceeds 1048576 bytes; any item exceeds 2048 bytes; projection aggregate exceeds 4194304 bytes; request exceeds 5242880 bytes; or any count exceeds 2000.
- `HASH_MISMATCH`: after prior validation, recomputed plan, projection, or request SHA-256 differs from its supplied hash.
- `APPROVAL_IDEMPOTENCY_CONFLICT`: an existing same-request/same-actor row differs in request fingerprint or any explicitly immutable stored field: schema/rule, both cutoffs, reader/plan/projection hashes, canonical plan, projections, seven counts, total/row/projection counts, or three byte counts. Exact equality returns replay.

All run before insert and perform zero mutation on failure. In-function parse failures are handled by the
named category where they are defined; UUID-typed transport casts never enter the function. Unexpected SQL
escapes the RPC.

| Test case | Static assertion | Runtime result | Inserted rows |
|---|---|---|---:|
| `p_expected_actor_id IS NULL` | Literal `INVALID_REQUEST` predicate includes the guard before actor logic | Exact JSONB `{ok:false,error:{code:"INVALID_REQUEST",message:"INVALID_REQUEST"}}` | 0 |
| `p_event_cutoff_id IS NULL` | Literal `INVALID_REQUEST` predicate includes the guard before cutoff logic | Exact JSONB `{ok:false,error:{code:"INVALID_REQUEST",message:"INVALID_REQUEST"}}` | 0 |
| Malformed non-null typed UUID transport | Adapter preserves transport-error mapping | `{ok:false,error:{code:"PERSISTENCE_FAILURE",message:"PERSISTENCE_FAILURE"}}` | 0 |

### Requirement: Formal local proof

The guarded runtime command uses the existing PostgreSQL helper and migrations `0057`–`0065` in lexical
order, with two sessions, RLS, replay, concurrency, append-only, purge survival, and zero Task DML;
default skip occurs before Docker and cleanup is finally/post-absence checked.

#### Scenario: The named local proof is reproducible without remote access.

### Requirement: Manual downstream type boundary

Manually add exact Row/Insert/Update/Relationships and RPC Args/Returns `Json` to `database.types.ts`.
No linked type generation, read API, or downstream apply is added.

#### Scenario: Type-contract assertions reject key, optionality, nullability, or extra-field drift.
