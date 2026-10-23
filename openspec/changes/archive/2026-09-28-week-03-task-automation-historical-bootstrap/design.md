# Design: Week 03 Task Automation Historical Bootstrap

**Result: READY FOR TASKS.** The change is an additive local `0081`–`0088` preview/approval/apply/readiness pipeline, decomposed into **18 dependency-ordered, behavior-complete native implementation slices plus Gate 0, for 19 task checkboxes total**. Every implementation slice includes its own RED/GREEN proof, applicable types, task/apply-progress evidence, preservation receipt, and required living-document update and is forecast or realized at no more than 400 authored additions plus deletions. Gate 0 is a local preflight, not an implementation slice. There is no proof-only or test-later slice. The slices auto-chain in the order declared below.

## Technical Approach

Reuse the archived pure-classifier, convergent-reader, immutable-approval, and receipt-first apply architecture, but compose it with the native Task automation state introduced by `0077`–`0080`. A pure TypeScript classifier receives a complete normalized snapshot and produces one canonical row for every pre-`0080` Opportunity or sent quote-version root. A bootstrap-specific server auth helper resolves the authenticated user, active profile, and Admin role without using redirect/not-found control flow; only then may an adapter construct its separate source/persistence client. The Admin-only reader freezes the immutable `0080` source cutoffs plus eight snapshot high-water cursors, performs bounded keyset reads until two adjacent passes converge, and runs the classifier exactly once. Approval derives, hashes, and stores only the plan's `generate|suppress` projections. Apply revalidates the approval and complete live universe while holding an exclusive universe advisory lock that interoperates with additive shared statement guards on every source/evidence/context writer, then takes the byte-identical `0079`/`0080` source/origin locks, writes exact deterministic native state atomically, and appends a self-validating receipt. Readiness is a separate read-only accounting RPC.

The current schema is authoritative: `0077` provides immutable action receipts, `0078` the sole audited Task action boundary, `0079` native Task origins/outcomes and due helpers, and `0080` immutable source cutoffs/tombstones plus future-only source hooks. None of those migrations or hooks is edited. In particular, the historical path cannot call `task_automation_project` for generation because that helper allocates a random Task UUID and may append unresolved outcomes; the approved historical contract instead requires a frozen deterministic UUID and atomic fail-closed behavior.

## Result Contract

All public objects reject extra or missing keys. UUIDs are lowercase canonical text, hashes are 64 lowercase hexadecimal characters, and timestamps are finite UTC RFC3339 with exactly six fractional digits and `Z`. Database/domain failures are code-only with `message=code`; only server adapters add `PERSISTENCE_FAILURE`, and no result exposes provider text, SQL, URLs, raw payloads, contact data, or notes.

The new `lib/admin/task-automation-historical-auth.ts` helper does **not** call the existing navigation-oriented `requireAdminRole`, because that helper collapses missing/inactive sessions and throws `redirect()`/`notFound()`. Its exact result is:

```ts
type BootstrapAuthSuccess = {
  ok: true
  actorId: string
  actorRole: "admin"
}

type CodeOnlyFailure<TCode extends string> = TCode extends string ? {
  ok: false
  error: {
    code: TCode
    message: TCode
  }
} : never

type BootstrapAuthResult<TDependencyCode extends "CLIENT_UNAVAILABLE" | "PERSISTENCE_FAILURE"> =
  | BootstrapAuthSuccess
  | CodeOnlyFailure<"AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | TDependencyCode>
```

For every failure, `message` equals `code`. The helper constructs only one injected cookie-scoped **auth client**, calls `auth.getUser()`, then reads exact `profiles(id,is_active)` state, and only after an active profile reads exact `profile_roles(roles(name))` state. It does not call `getAdminSession`, `getUserRoles`, or any helper that constructs a hidden second client. No user yields `AUTH_REQUIRED`; a missing or inactive profile yields `AUTH_INACTIVE`; an active profile without `admin` yields `AUTH_NOT_ADMIN`. Auth-client construction, transport, provider, or malformed auth/profile/role data maps to the caller-supplied dependency code: `CLIENT_UNAVAILABLE` for preview and `PERSISTENCE_FAILURE` for approval/apply/readiness. No provider detail is retained. A successful helper call returns only canonical `actorId` and `actorRole`.

The **auth client** is not the source/persistence client named by the specifications' auth-first rule. It may access only `auth.getUser`, the caller's profile, and the caller's role join. After auth success, each adapter constructs a distinct injected **source/persistence client** for preview reads or RPC execution. An auth failure constructs no source/persistence client, performs no business-source read, invokes no bootstrap RPC, and returns the exact code-only envelope. The database RPC still repeats active-profile/Admin/expected-actor checks, so a session change between the two clients returns the database's declared auth code, including `AUTH_ACTOR_MISMATCH`.

```ts
type DispositionCounts = readonly [
  applyGenerate: number,
  applySuppress: number,
  alreadyProjected: number,
  alreadySuppressed: number,
  excludedNotActionable: number,
  manualReviewOwnerInvalid: number,
  manualReviewContextInvalid: number,
  collisionManualReview: number,
]

type SourceCutoffs = {
  opportunityAssignment: string
  quoteSent: string
}

type SnapshotCursor = readonly [createdAt: string, identity: string]
type SnapshotCutoffs = {
  opportunityRoots: SnapshotCursor | null
  quoteVersionRoots: SnapshotCursor | null
  assignmentEvidence: SnapshotCursor | null
  quoteSourceEvidence: SnapshotCursor | null
  taskOccupancy: SnapshotCursor | null
  automationOrigins: SnapshotCursor | null
  automationOutcomes: SnapshotCursor | null
  automationTombstones: SnapshotCursor | null
}
```

Preview success is exactly:

```ts
{
  ok: true,
  schema: "task-automation-historical-preview.v1",
  ruleVersion: "task-automation-historical.v1",
  sourceCutoffs: SourceCutoffs,
  snapshotCutoffs: SnapshotCutoffs,
  snapshotHash: string,
  plan: HistoricalPlan,
  planHash: string,
  counts: DispositionCounts,
  totalCount: number,
  diagnostics: {
    passes: number,
    logicalReads: number,
    physicalAttempts: number,
    opportunityRootCount: number,
    quoteVersionRootCount: number,
  },
}
```

Preview failure is exactly `{ok:false,error:{code,message},diagnostics?}`. `diagnostics` is omitted before **source-client** construction, including every auth-helper outcome. Once source-client construction succeeds, it has the exact success diagnostic keys, with unknown root counts represented as `0`. Codes and precedence are `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|CLIENT_UNAVAILABLE|CUTOFF_UNAVAILABLE|QUERY_FAILED|MALFORMED_ROW|INCOMPLETE_JOIN|LIMIT_EXCEEDED|SNAPSHOT_NOT_CONVERGED|CLASSIFICATION_FAILED|CANONICALIZATION_FAILURE`.

Approval input is exactly `{requestId,preview}`. Approval success is exactly `{ok:true,status:"success",replayed,approvalId,requestId,actorId,actorRole,schema,previewSchema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,plan,planHash,projections,projectionHash,requestFingerprint,counts,totalCount,rowCount,generateCount,suppressCount,projectionCount,planByteCount,projectionByteCount,requestByteCount,createdAt}` with `schema="task-automation-historical-approval.v1"`, `previewSchema="task-automation-historical-preview.v1"`, and `actorRole="admin"`. Failures are the specification's ordered approval code union plus adapter-only `PERSISTENCE_FAILURE`.

Apply input and readiness input are each exactly `{requestId}`. Apply success is exactly `{ok:true,status:"success",replayed,receiptId,requestId,approvalId,actorId,approvalFingerprint,planHash,projectionHash,taskIds,originKeys,outcomeKeys,tombstoneKeys,generatedCount,suppressedCount,projectionCount,result,resultHash,resultByteCount,createdAt}`. Readiness success is exactly `{ok:true,requestId,approvalId,applyReceiptId,ready,counts,rows}`. Their failure unions and precedence are unchanged from the apply specification.

## Architecture Decisions

### Decision: Keep classification pure and database-independent

**Choice**: `lib/admin/task-automation-historical-contract.ts` owns canonical primitives and normalized DTOs; `lib/admin/task-automation-historical-classification.ts` owns classification only. Neither imports Supabase, `server-only`, auth, process APIs, or filesystem APIs.

**Alternatives considered**: Classify inside PostgreSQL; classify while pages arrive.

**Rationale**: A complete immutable fact set is required before disposition precedence, accounting, byte limits, and hash generation can be trusted. A pure boundary also gives identical TypeScript/SQL golden vectors without allowing partial plans.

### Decision: Add a bootstrap auth helper with two explicit client phases

**Choice**: Add `authorizeTaskAutomationHistoricalAdmin`. It uses one narrow auth client to resolve user, profile activity, and Admin role into exact code-only results. Only a successful result permits a separate preview-source or RPC-persistence client to be constructed.

**Alternatives considered**: Reuse `requireAdminRole`; reuse `getAdminSession`; construct one general Supabase client and pass it through the whole adapter.

**Rationale**: Current auth helpers intentionally implement page navigation and collapse missing/inactive state to `null`, so they cannot produce `AUTH_REQUIRED`, `AUTH_INACTIVE`, and `AUTH_NOT_ADMIN` exactly. Separate client phases make the specifications' no-business-access-before-auth guarantee observable and testable without weakening the independent database check.

### Decision: Use one narrow boundary RPC and RLS-backed keyset reads for preview

**Choice**: `public.read_task_automation_historical_boundaries(uuid)` independently verifies the expected active Admin and returns the otherwise unreadable `0080` cutoffs, eight high-water cursors, and two root censuses from one database snapshot. The reader then performs allow-listed authenticated table reads under existing RLS and the frozen cursors.

**Alternatives considered**: One giant snapshot RPC; broad direct grants on `task_automation_source_cutoffs`; offset pagination.

**Rationale**: The cutoff table currently has no authenticated SELECT grant. A narrow RPC avoids broadening it while retaining the archived injected-reader pattern, page/sentinel proof, and two-pass byte convergence. A giant JSON aggregate would hide truncation and pagination behavior.

### Decision: Treat assignment events as evidence, never as a fallback clock

**Choice**: The earliest valid non-null `assigned` occurrence is selected only from the complete durable `lead_events` set by `(created_at,id)`. Opportunity creation participates only through `max(created_at,assignment.created_at)`. Missing or contradictory evidence remains manual review.

**Alternatives considered**: Current `assigned_to`, `updated_at`, Opportunity creation, preview time, approval time, or apply time.

**Rationale**: The current action updates `leads` before inserting `lead_events`, and event failure was historically ignored. Those mutable or execution-time values cannot prove when assignment occurred.

### Decision: Add a historical writer rather than reuse the future projector

**Choice**: Private helpers in `0086` insert approved Task/origin/outcome or tombstone/outcome pairs with the approved deterministic Task UUID. The public `0087` RPC is the only caller.

**Alternatives considered**: Call `task_automation_project`; update it to accept IDs; insert Tasks in the adapter.

**Rationale**: Reusing or changing the future projector would alter `0079`/`0080` behavior, allocate random IDs, permit unresolved outcomes, and weaken one-transaction approval semantics. Adapter-side loops would permit partial writes.

### Decision: Persist self-contained approval and receipt rows without source foreign keys

**Choice**: One immutable approval row and one immutable apply receipt row retain canonical JSON, hashes, ordered identities, equations, and byte counts. They have no source, Task, actor, or approval foreign keys.

**Alternatives considered**: Child projection tables; foreign keys to approval/source/Task rows.

**Rationale**: Bounded JSON is already limited to 4,000 rows/16 MiB, and no-FK ledgers preserve replay/audit after authorized source purge. Append-only triggers and forced RLS retain integrity.

### Decision: Close phantoms with one global writer protocol, not caller-selected isolation

**Choice**: `0085` adds one fixed universe advisory identity plus `BEFORE ... FOR EACH STATEMENT` shared-lock guards to every table that can add, remove, or change a historical root, source/evidence occurrence, or owner/context fact. Receiptless `0087` apply takes the same identity exclusively before recensus/revalidation and holds it through receipt commit. Existing `0080` future hooks therefore execute under the shared guard without editing `0080` itself.

**Alternatives considered**: Row locks after recensus; a namespaced historical-only lock; asking PostgREST callers to start `SERIALIZABLE`; setting transaction isolation inside the RPC.

**Rationale**: Row locks do not cover absent rows and therefore permit backdated pre-cutoff phantoms. An RPC cannot reliably upgrade the already-started PostgREST transaction, and a serializable protocol is ineffective unless every writer participates. The statement guard acquires before row mutation and before existing row triggers, so apply's exclusive lock drains prior writers and blocks new roots/evidence/context changes until commit.

### Decision: Reuse the exact current source/origin advisory identities

**Choice**: Historical apply locks a source with `(('x'||substr(source_key,1,16))::bit(64)::bigint)` and an origin with `(('x'||substr(origin_key,1,16))::bit(64)::bigint)`, exactly as `0079`/`0080` do. The previous `task-automation-historical-lock.v1` source/origin preimages are removed. Request and deterministic-Task locks remain bootstrap-specific because no current writer has an identity to interoperate with there.

**Alternatives considered**: Namespaced hashes for every historical lock; row locks only; altering the old migrations.

**Rationale**: Different advisory identities do not serialize even when they protect the same logical source/origin. Byte-identical raw-key conversion lets current generation/invalidation/tombstone paths and historical apply coordinate while preserving the untracked `0079`/`0080` files byte-for-byte.

### Decision: Allocate local `0081`–`0088` now, without implying remote admission

**Choice**: Use the exact migration names in this design after the current local maximum `0080`.

**Alternatives considered**: Placeholder identifiers; renumbering `0077`–`0080`; remote reconciliation in this change.

**Rationale**: The local inventory establishes the additive sequence and the user requested implementation-exact paths. The documented remote inventory ending at `0060` does not authorize applying any local migration; any future remote action still requires a separately authorized current-state reconciliation.

## Canonical Plan, Hashes, Limits, and Ordering

`C(value)` accepts only null, booleans, strings, bounded integers, arrays, and plain objects. It emits JSON with ASCII-byte-sorted object keys, preserved array order, JSON string escaping, no whitespace, and no coercion. It rejects `undefined`, holes, accessors/proxies, symbols, functions, bigint, non-integers, `NaN`, infinities, and `-0`. `H(value)=lowerhex(SHA-256(UTF-8(C(value))))`. SQL uses the existing `public.follow_up_canonical_json(jsonb)` and `extensions.digest`; cross-language golden tests are mandatory.

Every plan row has exactly:

```text
ordinal,sourceKind,rootId,anchorAt,sourceId,ownerId,opportunityId,quoteId,
quoteVersionId,sentEventId,disposition,reason,action,operationSourceKind,
operationSourceId,sourceKey,sourceOrder,originKey,taskId,taskKind,
dueRuleVersion,dueAt,outcomeKey,tombstoneKey
```

`sourceId` is the root generation source identity: Opportunity ID for first contact and earliest persisted `quote_sent` event ID for quote follow-up. `operationSourceKind/operationSourceId/sourceKey` identify the actual approved generate or invalidation operation. Write identities are non-null only for `apply/*` or exact `already/*` state; excluded and all three manual-review classes have null action/write identities. Owner-invalid rows retain a proved owner UUID for missing/inactive/invalid-role profiles and null for unassigned. Context fields remain non-null only when independently proved.

Rows sort by bytewise `(sourceKind,anchorAt NULLS LAST,sourceId NULLS LAST,rootId)`, then receive contiguous zero-based ordinals. The plan is exactly `{schema:"task-automation-historical-plan.v1",ruleVersion:"task-automation-historical.v1",sourceCutoffs,snapshotCutoffs,snapshotHash,rows,counts,totalCount}`; `planHash=H(plan)`. `counts` is the eight-position vector above, and `sum(counts)=rows.length=totalCount=opportunityRootCount+quoteVersionRootCount`.

The plan limits are exact: 2,000 roots per family, 4,000 total rows, 4,096 UTF-8 bytes per row, 65,536 bytes for the plan with `rows=[]`, 16,777,216 full-plan bytes, and 33,554,432 snapshot-preimage bytes. Supporting evidence is limited to 20,000 normalized rows per family and 40,000 total. Approval repeats those limits and adds 4,096 bytes per projection, 16,777,216 bytes for the projection array, and 33,554,432 bytes for its request preimage. Limit or serialization failures produce no partial artifact.

The closed disposition/reason matrix is exact:

| Disposition | Allowed reason |
|---|---|
| `apply/generate` | `ELIGIBLE_GENERATE` |
| `apply/suppress` | `SOURCE_INVALIDATED` |
| `already/projected` | `ALREADY_PROJECTED` |
| `already/suppressed` | `ALREADY_SUPPRESSED` |
| `excluded/not-actionable` | `OPPORTUNITY_NOT_OPERATIONAL\|QUOTE_NOT_OPERATIONAL` |
| `manual-review/owner-invalid` | `OWNER_UNASSIGNED\|PROFILE_MISSING\|PROFILE_INACTIVE\|ROLE_INVALID` |
| `manual-review/context-invalid` | `ASSIGNMENT_EVIDENCE_MISSING\|ASSIGNMENT_EVIDENCE_CONTRADICTORY\|FIRST_SENT_EVENT_MISSING\|FIRST_SENT_EVENT_CONTRADICTORY\|SOURCE_AMBIGUOUS\|INVALIDATION_EVIDENCE_MISSING\|DUE_UNSUPPORTED` |
| `collision/manual-review` | `IDENTITY_OCCUPIED\|STATE_MISMATCH\|DUPLICATE_SOURCE_STATE\|SOURCE_ORDER_EXHAUSTED` |

Classifier failure precedence is exactly `IncompleteFacts`, `InvalidBoundary`, `InvalidFact`, `InvariantViolation`, then `CanonicalizationFailure`. Those failures have no plan, rows, diagnostics payload, or source values.

The deterministic Task UUID is `U(originKey)`: hash `C(["task-automation-historical-task-id.v1",originKey])`, take digest bytes `0..15`, set byte 6 to `(b6 & 0x0f)|0x50`, set byte 8 to `(b8 & 0x3f)|0x80`, and format lowercase UUID text. For the 64-zero origin key, the required golden value is `0d51288c-8994-5a85-b9d0-18826b6ec18b`. This UUID never authorizes adoption.

## Evidence and Classification

### First contact

An assignment evidence row is normalized to exactly `{eventId,opportunityId,occurredAt,assignedTo}` from `lead_events.event_type='assigned'`. Transport identity/timestamp/type failures fail the preview as `MALFORMED_ROW`. A JSON object other than the exact single key `assignedTo` with canonical UUID or null is retained as domain-invalid evidence without raw payload and makes that root `ASSIGNMENT_EVIDENCE_CONTRADICTORY`.

For each Opportunity, the complete ordered assignment sequence must have unique event IDs, no event before Opportunity creation, no same-microsecond conflicting owner/null values, and its latest value must equal current `assigned_to`. The earliest non-null occurrence is assignment proof. No non-null occurrence yields `ASSIGNMENT_EVIDENCE_MISSING`; any sequence violation yields `ASSIGNMENT_EVIDENCE_CONTRADICTORY`. The generate anchor is `max(opportunity.createdAt,earliestAssignment.occurredAt)`, while the generated owner is the current proved owner.

Current deleted or archived Opportunities and roots permanently outside the operational model are `excluded/not-actionable:OPPORTUNITY_NOT_OPERATIONAL`. Exact durable unassignment is an `assigned` event with `assignedTo:null`. Exact terminal evidence is an append-only `status_changed` event with exact `{statusId}` whose joined status is terminal. Those occurrences may produce `apply/suppress` when no permanent exclusion applies. A current terminal state without that exact event is `manual-review/context-invalid:INVALIDATION_EVIDENCE_MISSING`. The current archive timestamp alone is never synthesized into an `opportunity_archived` occurrence.

Generate formulas are:

```text
sourceKind/sourceId/operationSourceKind/operationSourceId = opportunity_assignment / opportunityId / opportunity_assignment / opportunityId
sourceKey = H(["task-automation-source.v1","opportunity_assignment",opportunityId,ownerId,assignmentOccurredAt])
originKey = H(["task-automation:v1","first_contact",opportunityId])
taskId = U(originKey)
taskKind/description = first_contact / "Complete first contact"
dueRuleVersion = mx-calendar.v1
dueAt = task_automation_due_at("first_contact",anchorAt,"mx-calendar.v1")
```

Suppression uses the exact invalidation kind, Opportunity ID, and occurrence timestamp in `sourceKey=H(["task-automation-source.v1",sourceKind,opportunityId,occurredAt])`; Task/due fields are null.

### Quote versions

Quote evidence is normalized from allow-listed `quote_events`, `lead_events`, and `payments` columns only. The first sent occurrence is the earliest exact append-only `quote_events.event_type='quote_sent'` row by `(created_at,id)` for the same quote/version/Opportunity. Missing evidence is `FIRST_SENT_EVENT_MISSING`; duplicate identity, wrong scope, or inconsistent first evidence is `FIRST_SENT_EVENT_CONTRADICTORY`. The anchor is persisted `quote_versions.sent_at`, never event-read time.

Exact invalidations are: `quote_version_response` with the exact six-key `0080` payload; append-only `quote_accepted|quote_rejected|quote_expired|quote_cancelled|quote_superseded` quote events tied to the exact version; an inbound `whatsapp_inbound_received` event that reconstructs exactly one active sent version at that occurrence; or a `verified` payment with non-null matching `accepted_quote_version_id` and canonical `verified_at`. Current status, `received` payment, `updated_at`, broad Opportunity matching, and cancelled/superseded state without an exact event are not occurrences. A currently terminal version with no exact admitted invalidation is `manual-review/context-invalid:INVALIDATION_EVIDENCE_MISSING`, not excluded and not suppressed.

WhatsApp reconstruction uses all sent roots for the Opportunity. A version is active at the inbound occurrence only after its exact first send and before its earliest exact terminal quote event. Zero active versions affects no root; one yields exact linkage; more than one marks each candidate ambiguous. For a root, the earliest exact invalidation wins by `(occurredAt,sourceKind,operationSourceId)` bytewise. A later exact invalidation may resolve an earlier ambiguous WhatsApp; when no exact invalidation exists, potential ambiguous linkage is `SOURCE_AMBIGUOUS`.

Quote generation formulas are:

```text
sourceKind = quote_sent
sourceId = operationSourceId = sentEventId
sourceKey = H(["task-automation-source.v1","quote_sent",quoteVersionId,sentEventId])
originKey = H(["task-automation:v1","quote_follow_up",quoteVersionId,sentEventId])
taskId = U(originKey)
taskKind/description = quote_follow_up / "Follow up on quote version"
dueRuleVersion = elapsed-48h.v1
dueAt = sentAt + exactly 48 elapsed hours
```

Suppression source keys are exactly the four formulas in the classification specification. Terminal operations use `operationSourceId=quoteVersionId`; response/WhatsApp/payment use their event/payment ID. Suppression has null Task/owner/due fields.

### Disposition precedence and sequence

For each root, classification order is: validate complete root/source proof; recognize exact compatible already-projected or already-suppressed state; reject partial/foreign/duplicate state as collision; recognize permanent exclusion; reject missing/contradictory source context; choose exact invalidation; validate current owner; validate due support; then generate. Exact existing state is accepted only when every retained identity and immutable representation field matches; `pre_cutoff` tombstones, random Task IDs, unresolved outcomes, or partial tuples are collisions, never adoption.

For a planned action, `sourceOrder=1+max(outcomes.source_order,tombstones.source_order)` for its origin, or `1` when empty. Duplicate order/state is `DUPLICATE_SOURCE_STATE`; max `2147483647` is `SOURCE_ORDER_EXHAUSTED`. Approval freezes the value. Apply recomputes it and returns `STALE_SOURCE_ORDER` rather than renumbering.

`outcomeKey=H(["task-automation-outcome.v1",operationSourceKind,operationSourceId,sourceKey,action,originKey])`. Suppression additionally uses `tombstoneKey=H(["task-automation-tombstone.v1",operationSourceKind,operationSourceId,sourceKey,sourceOrder,originKey,"source_invalidated"])`; generation has null tombstone.

## Data Flow

### Preview

```text
createAuthClient
  -> auth.getUser
  -> exact active profile
  -> exact Admin role
  -> createPreviewSourceClient
  -> read boundaries once (0081 RPC)
  -> P1 -> P2 [or P3 -> P4]
       roots, evidence, current joins, occupancy, immutable automation state
       -> normalize/sort -> C(snapshot preimage) -> SHA-256
  -> equal adjacent bytes and hash
  -> classify exactly once
  -> strict preview envelope
```

Root pages are ascending keysets of at most 200. Opportunity keys are `(created_at,id)` with `created_at < opportunityAssignment`; quote keys are `(sent_at,id)` with `sent_at IS NOT NULL AND sent_at < quoteSent`. Every query also enforces `key <= frozenHighWater`; strict-after cursors are used after page one. Ten pages cover 2,000 roots, followed by a `limit(1)` sentinel. Census, pages, and sentinel retain the identical membership predicates.

Supporting reads are sorted/keyset or sorted unique UUID/hash chunks of 200 and restricted to the bounded roots/candidate identities. They select only fields needed for normalized assignment/quote evidence, owner/profile/role facts, native Task occupancy, origins, outcomes, and tombstones. Every Task capable of occupying deterministic Task ID, idempotency/origin key, root uniqueness, or source tuple is represented; only an exact native automation row is decoded as existing state. Missing pages/joins are distinct from authoritative empty sets.

The `0081` boundary RPC success is exactly `{ok:true,source_cutoffs,snapshot_cutoffs,opportunity_root_count,quote_version_root_count}` in snake case; nested cutoff objects already use the canonical plan's camel-case keys. Its domain failures are the exact code-only subset `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|CUTOFF_UNAVAILABLE|LIMIT_EXCEEDED`. It computes each high-water as the greatest canonical `(timestamp,identity)` in the same database statement as the two censuses. The two root counts are range-checked SQL `integer` values, never raw `count(*)` bigint JSON values. `quote_source_evidence` is the greatest cursor over the normalized union of relevant quote events, WhatsApp lead events, and exact verified payments; duplicate normalized identities across providers fail the reader rather than receiving an invented tie-breaker.

The snapshot preimage is exactly `['task-automation-historical-snapshot.v1',sourceCutoffs,snapshotCutoffs,opportunityFacts,quoteFacts,assignmentEvidence,quoteSourceEvidence,ownerFacts,taskOccupancy,automationOrigins,automationOutcomes,automationTombstones]`. Current owner, role, relationship, and operational facts are reread every pass even though they have no append-only cursor. P1/P2 are compared first; only mismatch permits P3/P4. Four unequal passes return `SNAPSHOT_NOT_CONVERGED`. `logicalReads` counts data-source calls; an injected fetch wrapper counts every physical attempt without changing pages or pass count.

### Approval and apply

```text
auth client -> active Admin -> persistence client -> approval RPC
                                              -> immutable approval

auth client -> active Admin -> persistence client -> apply request lock
  -> valid receipt? -> exact replay
  -> approval integrity
  -> exclusive universe lock -> recensus/evidence/live revalidation
  -> raw source locks -> raw origin locks -> deterministic Task locks
  -> generate/suppress writes -> immutable receipt -> commit

source/evidence/context DML -> shared universe statement lock
  -> existing 0080 future hooks -> raw source lock -> raw origin lock
```

No adapter loops over projections. Approval inserts one row in one RPC transaction; apply validates and writes the whole approved projection set plus one receipt in one RPC transaction. The global lock controls universe visibility, while raw source/origin identities preserve interoperability with existing future writers.

## SQL Storage Contracts (`0081`, `0082`, `0084`)

### `0081` boundary counts

`0081` creates no storage table and therefore has no physical count column. Its boundary RPC computes `count(*)` as `bigint`, rejects either family above `2000`, and only then casts the two returned JSON fields `opportunity_root_count` and `quote_version_root_count` to SQL `integer`. Each is non-null and constrained by the function to `0..2000`; their sum is constrained to `0..4000`. No default applies to a computed result field.

### `0082` approval table

`public.task_automation_historical_approvals` has exactly these columns in this order. “No default” means the RPC must supply the value explicitly.

| Column | SQL type | Nullability / default | Exact constraint |
|---|---|---|---|
| `id` | `uuid` | `NOT NULL DEFAULT extensions.gen_random_uuid()` | Primary key; canonical UUID on JSON output. |
| `request_id` | `uuid` | `NOT NULL`, no default | Unique. |
| `actor_id` | `uuid` | `NOT NULL`, no default | No FK; equals authenticated/expected actor at insert. |
| `actor_role` | `text` | `NOT NULL DEFAULT 'admin'` | `actor_role='admin'`. |
| `schema_version` | `text` | `NOT NULL`, no default | Equals `task-automation-historical-approval.v1`. |
| `preview_schema` | `text` | `NOT NULL`, no default | Equals `task-automation-historical-preview.v1`. |
| `rule_version` | `text` | `NOT NULL`, no default | Equals `task-automation-historical.v1`. |
| `source_cutoffs` | `jsonb` | `NOT NULL`, no default | Exact two-key canonical source-cutoff object; finite UTC-microsecond values. |
| `snapshot_cutoffs` | `jsonb` | `NOT NULL`, no default | Exact eight-key cursor object; each value null or exact two-string tuple. |
| `snapshot_hash` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$`. |
| `plan` | `jsonb` | `NOT NULL`, no default | Exact canonical plan object; trigger reserializes and validates all rows. |
| `plan_hash` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$` and equals `H(plan)`. |
| `projections` | `jsonb` | `NOT NULL`, no default | JSON array in ordinal order; trigger validates exact projection keys/values. |
| `projection_hash` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$` and equals `H(projections)`. |
| `request_fingerprint` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$`; equals the approval request preimage hash. |
| `approval_fingerprint` | `text` | `NOT NULL`, no default | Unique, `^[0-9a-f]{64}$`; equals the complete stored approval fingerprint. |
| `apply_generate_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals canonical count vector position 0. |
| `apply_suppress_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 1. |
| `already_projected_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 2. |
| `already_suppressed_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 3. |
| `excluded_not_actionable_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 4. |
| `manual_review_owner_invalid_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 5. |
| `manual_review_context_invalid_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 6. |
| `collision_manual_review_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals position 7. |
| `total_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals the eight-count sum and `plan.totalCount`. |
| `row_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `total_count=jsonb_array_length(plan->'rows')`. |
| `generate_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `apply_generate_count`. |
| `suppress_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `apply_suppress_count`. |
| `projection_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `generate_count+suppress_count=jsonb_array_length(projections)`. |
| `plan_byte_count` | `integer` | `NOT NULL`, no default | `1..16777216`; equals UTF-8 byte length of `C(plan)`. |
| `projection_byte_count` | `integer` | `NOT NULL`, no default | `2..16777216`; equals UTF-8 byte length of `C(projections)`. |
| `request_byte_count` | `integer` | `NOT NULL`, no default | `1..33554432`; equals UTF-8 byte length of `C(requestPreimage)`. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT date_trunc('microseconds',clock_timestamp())` | Finite and equal to its microsecond truncation. |

The table has no foreign keys. SQL CHECKs enforce primitive ranges, hashes, JSON container kinds, the eight-count sum, row/total equality, generate/suppress aliases, projection equation, and timestamp precision. A `BEFORE INSERT OR UPDATE OR DELETE` trigger revalidates all canonical bytes and permits only a complete INSERT; UPDATE/DELETE, including no-op mutation, fail. Forced RLS grants SELECT only to authenticated currently active Admins; all direct DML and public/anon/service-role table access are revoked.

### `0084` apply receipt table

`public.task_automation_historical_apply_receipts` has exactly these columns in this order:

| Column | SQL type | Nullability / default | Exact constraint |
|---|---|---|---|
| `id` | `uuid` | `NOT NULL DEFAULT extensions.gen_random_uuid()` | Primary key. |
| `request_id` | `uuid` | `NOT NULL`, no default | Unique. |
| `approval_id` | `uuid` | `NOT NULL`, no default | No FK; retained after approval purge. |
| `actor_id` | `uuid` | `NOT NULL`, no default | No FK; equals approval/apply actor. |
| `approval_fingerprint` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$`. |
| `plan_hash` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$`. |
| `projection_hash` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$`. |
| `task_ids` | `uuid[]` | `NOT NULL`, no default | One-dimensional, null-free, distinct, canonical output order. |
| `origin_keys` | `text[]` | `NOT NULL`, no default | One-dimensional, null-free, distinct `64`-lowerhex values in projection-filtered order. |
| `outcome_keys` | `text[]` | `NOT NULL`, no default | One-dimensional, null-free, distinct `64`-lowerhex values in full projection order. |
| `tombstone_keys` | `text[]` | `NOT NULL`, no default | One-dimensional, null-free, distinct `64`-lowerhex values in projection-filtered order. |
| `generated_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `cardinality(task_ids)=cardinality(origin_keys)`. |
| `suppressed_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `cardinality(tombstone_keys)`. |
| `projection_count` | `integer` | `NOT NULL`, no default | `0..4000`; equals `generated_count+suppressed_count=cardinality(outcome_keys)`. |
| `result` | `jsonb` | `NOT NULL`, no default | Exact apply-result object and exact ordered arrays/counts. |
| `result_hash` | `text` | `NOT NULL`, no default | `^[0-9a-f]{64}$` and equals `H(result)`. |
| `result_byte_count` | `integer` | `NOT NULL`, no default | `1..16777216`; equals UTF-8 byte length of `C(result)`. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT date_trunc('microseconds',clock_timestamp())` | Finite and equal to its microsecond truncation. |

The receipt has no foreign keys and no array/count defaults: even an empty action set must be supplied as explicit empty arrays and zero counts. CHECKs enforce primitive shape/ranges; the integrity trigger enforces dimensions, null absence, distinctness, order, canonical result equality, hashes, and bytes. UPDATE/DELETE always fail. Forced RLS and grants match approvals.

## Approval Derivation and RPC (`0083`)

Approval derives projections in row ordinal order with exactly `ordinal,action,operationSourceKind,operationSourceId,sourceKey,sourceOrder,originKey,taskId,taskKind,ownerId,opportunityId,quoteId,quoteVersionId,sentEventId,anchorAt,dueRuleVersion,dueAt,outcomeKey,tombstoneKey`. `projectionHash=H(projections)`. Its request preimage is exactly the specification array, and all three byte counts use canonical UTF-8 bytes.

```text
approvalRequestPreimage = [
  "task-automation-historical-approval-request.v1", requestId, actorId, "admin",
  preview.schema, preview.ruleVersion, preview.sourceCutoffs, preview.snapshotCutoffs,
  preview.snapshotHash, preview.planHash, projectionHash, preview.plan, projections
]
requestFingerprint = H(approvalRequestPreimage)
```

The private approval fingerprint is `H(["task-automation-historical-approval-fingerprint.v1",approvalId,requestId,actorId,"admin",schema,previewSchema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,planHash,projectionHash,requestFingerprint,plan,projections,counts,totalCount,rowCount,generateCount,suppressCount,projectionCount,planByteCount,projectionByteCount,requestByteCount,createdAt])` and covers every immutable stored field except itself.

`public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) returns jsonb` receives request text, expected actor, preview schema, rule version, both cutoff objects, snapshot/plan/projection/request hashes, plan, and derived projections. It authenticates, validates independently, acquires `H(["task-automation-historical-lock.v1","approval-request",requestId])`, then replays an exactly equal existing row or returns `APPROVAL_IDEMPOTENCY_CONFLICT`. It never rereads or mutates source/automation state.

## Apply Receipt, Revalidation, and Writes (`0084`–`0087`)

The stored result is exactly `{schema:"task-automation-historical-apply-result.v1",requestId,approvalId,actorId,planHash,projectionHash,taskIds,originKeys,outcomeKeys,tombstoneKeys,generatedCount,suppressedCount,projectionCount}`. Arrays preserve approved projection order after filtering for the relevant identity. `generatedCount=taskIds.length=originKeys.length`; `suppressedCount=tombstoneKeys.length`; `projectionCount=generatedCount+suppressedCount=outcomeKeys.length`; every array is canonical and distinct within its namespace. `resultHash=H(result)` and byte count is `UTF-8(C(result)).length`. `replayed` is return-only.

Receiptless apply recomputes the complete approval fingerprint, plan/projection/request hashes, canonical bytes, row/projection shapes, deterministic Task IDs, source/order/outcome/tombstone identities, limits, cutoff equality, current root census/set, and required immutable evidence. A changed cutoff/root/evidence/disposition is `STALE_PLAN_INTEGRITY`; current owner, role, relationship, or operational mismatch is `STALE_LIVE_CONTEXT`; changed sequence is `STALE_SOURCE_ORDER`; any Task/origin/key/root/source/outcome/tombstone occupancy is `IDENTITY_OCCUPANCY_CONFLICT`.

`0085` creates `public.task_automation_historical_universe_guard()` as a private statement-trigger function. Its canonical identity is `C(["task-automation-historical-universe-lock.v1"])`, whose SHA-256 is `351876aaee4d45dd88e14b005db35a01d06307eab7d62787b72ff1dc0500d1a0`; the advisory bigint is the signed first eight digest bytes, exactly `3825938359965795805`. A `BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE FOR EACH STATEMENT` trigger acquires `pg_advisory_xact_lock_shared(3825938359965795805)` on each of `contacts`, `leads`, `lead_statuses`, `lead_events`, `quotes`, `quote_versions`, `quote_events`, `payments`, `profiles`, `profile_roles`, and `roles`. These are exactly the tables that can change root membership, assignment/sent/invalidation evidence, exact-version relationships, or current owner/role/operational context.

Because statement triggers run before row mutation and before the existing `0080` row triggers, first-contact generation/invalidation, quote generation/response/terminal/WhatsApp/payment cancellation, and their tombstone writes all execute while the transaction holds the shared universe lock. No `0079`/`0080` function body or file is edited, and the additive guard changes none of their eligibility rules, source/origin formulas, result rows, grants, or failure behavior; it adds synchronization only. Receiptless apply acquires `pg_advisory_xact_lock(3825938359965795805)` after approval integrity and before recensus. The exclusive lock waits for prior guarded writers, prevents later guarded writes, and remains held through all revalidation, projection inserts, and receipt commit. Therefore a backdated pre-cutoff root/evidence insert, update, delete, purge, or owner/context change cannot become a phantom through apply commit. Approval-purge-independent receipt replay returns before this global lock because it reads or writes no universe state.

The single lock order is:

1. request advisory;
2. approval/receipt rows (receipt row first, then approval row on the receiptless flow);
3. exclusive universe advisory, using the fixed universe identity on the receiptless flow;
4. raw source advisories, deduplicated and acquired by ascending full 64-byte ASCII `sourceKey` order;
5. raw origin advisories, deduplicated and acquired by ascending full 64-byte ASCII `originKey` order;
6. deterministic Task identity advisories, which work before a Task exists, deduplicated and acquired by ascending lowercase UUID byte order;
7. source/evidence/context rows, including any occupied Task row, in table/UUID order with `FOR UPDATE NOWAIT`;
8. writes/receipt: projection inserts in approved ordinal order, then the receipt.

The request lock remains the signed first-eight-byte hash of `C(["task-automation-historical-lock.v1","request",requestId])`. A source lock is **exactly** `(('x'||substr(source_key,1,16))::bit(64)::bigint)` and an origin lock is **exactly** `(('x'||substr(origin_key,1,16))::bit(64)::bigint)`, including PostgreSQL's two's-complement signed conversion. These expressions are byte-identical to `0079`/`0080`; no additional namespace, source kind, source ID, or operation may enter their advisory identities. Values are deduplicated after converting the sorted full keys because distinct hashes can share the same first 64 bits. The Task lock is the signed first-eight-byte hash of `C(["task-automation-historical-lock.v1","task",taskId])` and coordinates competing historical requests; Task PK/unique constraints remain the final arbiter against any nonparticipating manual writer. `NOWAIT` row contention maps to the relevant stale/occupancy code and commits nothing.

The lock protocol has mandatory RED concurrency proofs: pause apply after recensus while a second transaction attempts (a) a backdated Opportunity insert, (b) a backdated sent-version/event insert, (c) assignment/invalidation evidence insertion, and (d) a current future invalidation/tombstone path. Each writer must block on the shared universe identity until apply commits, and apply must either include a writer committed before exclusive acquisition or exclude a writer that can commit only afterward—never certify a phantom through its own commit. Separate races prove the historical call blocks on the exact raw source/origin advisory bigint already held by a direct `0079`/`0080` path and vice versa; competing source-order allocation yields one winner or one complete rollback, never duplicate order or split state.

Generate inserts one exact deterministic `pending` Task with null legacy provenance, one exact immutable origin, and one applied generate outcome. Suppress inserts one `source_invalidated` tombstone and one applied suppress outcome, with no Task or origin. Existing non-action rows write nothing. All projections and the receipt are one RPC transaction. Identical concurrent apply calls converge on one receipt; another actor under the same request conflicts; different requests racing any namespace allow at most one full winner.

`public.apply_task_automation_historical_plan(text,uuid) returns jsonb` is the only public writer. After request serialization it validates an existing receipt before approval lookup, so exact replay survives approval/source purge. A malformed self-receipt returns `APPLY_RECEIPT_INTEGRITY_FAILURE`; changed actor/identity returns `APPLY_IDEMPOTENCY_CONFLICT`. No replay path locks or writes operational rows.

The exact private helper inventory is: `public.task_automation_historical_hash(jsonb) returns text` and `public.task_automation_historical_task_uuid(text) returns uuid` in `0081`; `public.validate_task_automation_historical_approval(public.task_automation_historical_approvals) returns boolean` and `public.reject_task_automation_historical_approval_mutation() returns trigger` in `0082`; `public.validate_task_automation_historical_apply_receipt(public.task_automation_historical_apply_receipts) returns boolean` and `public.reject_task_automation_historical_apply_receipt_mutation() returns trigger` in `0084`; `public.task_automation_historical_universe_guard() returns trigger`, `public.task_automation_historical_revalidate_plan(public.task_automation_historical_approvals) returns text`, and `public.task_automation_historical_revalidate_live(public.task_automation_historical_approvals) returns text` in `0085`; and `public.task_automation_historical_write_generate(jsonb) returns jsonb` plus `public.task_automation_historical_write_suppress(jsonb) returns jsonb` in `0086`. Validation helpers return null for valid state or the one declared domain code where typed as `text`; writer helpers raise a private integrity exception on any mismatch so the outer transaction rolls back. All helpers are owned by `postgres`, use fixed empty search paths, and are revoked from public, anon, authenticated, and service role.

## Readiness (`0088`)

`public.read_task_automation_historical_readiness(text,uuid) returns jsonb` is Admin-only and read-only. It validates approval and receipt integrity, then emits ordinal rows exactly `{ordinal,sourceKind,rootId,disposition,outcome,taskId,originKey,outcomeKey,tombstoneKey}`. Outcome values are `generated|suppressed|already_projected|already_suppressed|excluded_not_actionable|manual_review_owner_invalid|manual_review_context_invalid|collision_manual_review`.

Its exact count object is `{applyGenerate,applySuppress,alreadyProjected,alreadySuppressed,excludedNotActionable,manualReviewOwnerInvalid,manualReviewContextInvalid,collisionManualReview,receiptGenerated,receiptSuppressed,plannedWrites,receiptWrites,taskBacked,suppressed,intentionalNoWrite,unresolvedManualReview,total}`. It enforces every equation from the apply specification. Generated/already-projected rows require exact retained Task immutable representation plus origin/outcome identity; current Task owner must match current source ownership and status may be any valid lifecycle status. Suppressed/already-suppressed rows require exact immutable tombstone/outcome state. Excluded/manual-review rows require null bootstrap write identities.

`ready=true` only when approval/receipt integrity, all root accounting, receipt parity, retained-state parity, and all equations pass and `unresolvedManualReview=0`. A missing receipt never means zero-write readiness. The RPC performs no repair, apply, or DML.

## Interfaces / Contracts

### Public SQL RPCs and adapters

There are exactly four authenticated public RPCs. None has default or variadic arguments; all return `jsonb`; public/anon/service-role EXECUTE is revoked; authenticated EXECUTE is granted only on the exact signature. Private helpers are not RPCs and remain ungranted.

| Migration / RPC | Exact SQL arguments in order | Exact database success result | Exact database failure result |
|---|---|---|---|
| `0081` `public.read_task_automation_historical_boundaries` | `p_expected_actor_id uuid` | `{ok:true,source_cutoffs,snapshot_cutoffs,opportunity_root_count,quote_version_root_count}`. Nested cutoff keys are the canonical camel-case keys; root counts are JSON numbers produced from guarded SQL `integer`. | `{ok:false,error:{code,message}}`, equal code/message from `AUTH_REQUIRED\|AUTH_INACTIVE\|AUTH_NOT_ADMIN\|AUTH_ACTOR_MISMATCH\|CUTOFF_UNAVAILABLE\|LIMIT_EXCEEDED`. |
| `0083` `public.approve_task_automation_historical_plan` | `p_request_id_text text, p_expected_actor_id uuid, p_preview_schema text, p_rule_version text, p_source_cutoffs jsonb, p_snapshot_cutoffs jsonb, p_snapshot_hash text, p_plan_hash text, p_projection_hash text, p_request_fingerprint text, p_plan jsonb, p_projections jsonb` | `{ok:true,status:"approved"|"replayed",id,request_id,actor_id,actor_role,schema_version,preview_schema,rule_version,source_cutoffs,snapshot_cutoffs,snapshot_hash,plan,plan_hash,projections,projection_hash,request_fingerprint,approval_fingerprint,apply_generate_count,apply_suppress_count,already_projected_count,already_suppressed_count,excluded_not_actionable_count,manual_review_owner_invalid_count,manual_review_context_invalid_count,collision_manual_review_count,total_count,row_count,generate_count,suppress_count,projection_count,plan_byte_count,projection_byte_count,request_byte_count,created_at}`. | `{ok:false,error:{code,message}}`, equal code/message from the ordered approval database union. |
| `0087` `public.apply_task_automation_historical_plan` | `p_request_id_text text, p_expected_actor_id uuid` | `{ok:true,status:"applied"|"replayed",id,request_id,approval_id,actor_id,approval_fingerprint,plan_hash,projection_hash,task_ids,origin_keys,outcome_keys,tombstone_keys,generated_count,suppressed_count,projection_count,result,result_hash,result_byte_count,created_at}`. | `{ok:false,error:{code,message}}`, equal code/message from the ordered apply database union. |
| `0088` `public.read_task_automation_historical_readiness` | `p_request_id_text text, p_expected_actor_id uuid` | `{ok:true,request_id,approval_id,apply_receipt_id,ready,counts,rows}`. `counts` has exactly the 17 camel-case keys in the specification; each row has exactly the nine specified camel-case keys in approved ordinal order. | `{ok:false,error:{code,message}}`, equal code/message from the ordered readiness database union. |

The approval database union is `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|INVALID_PREVIEW|INVALID_PLAN|INVALID_PROJECTION|LIMIT_EXCEEDED|HASH_MISMATCH|APPROVAL_IDEMPOTENCY_CONFLICT`. The apply union is `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|APPLY_IDEMPOTENCY_CONFLICT|APPLY_RECEIPT_INTEGRITY_FAILURE|APPROVAL_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|STALE_PLAN_INTEGRITY|STALE_LIVE_CONTEXT|STALE_SOURCE_ORDER|IDENTITY_OCCUPANCY_CONFLICT|LIMIT_EXCEEDED`. The readiness union is `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_NOT_ADMIN|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|APPROVAL_NOT_FOUND|APPLY_RECEIPT_NOT_FOUND|APPROVAL_INTEGRITY_FAILURE|APPLY_RECEIPT_INTEGRITY_FAILURE|ROOT_ACCOUNTING_FAILURE|WRITE_PARITY_FAILURE|LIMIT_EXCEEDED`. The order shown is failure precedence.

The server adapters strictly decode those database results and map them to the exact camel-case public successes in the Result Contract. The private approval fingerprint is validated but not added to public approval success because the approval specification does not expose it. Database status becomes public `status:"success"` plus `replayed:boolean`; no database snake-case key leaks through.

Each server-only adapter injects `authorizeTaskAutomationHistoricalAdmin`, `createPersistenceClient`, and its RPC transport. Preview instead injects `createPreviewSourceClient` plus its typed data source, classifier, digest, and physical-attempt counter. The auth helper separately injects `createAuthClient`. The exact sequence for approval/apply/readiness is auth helper, closed input validation, persistence-client construction, then RPC; preview has no public input and constructs its source client immediately after auth success. Thus auth always wins over malformed input and neither auth nor invalid input invokes a bootstrap RPC. From source/persistence construction onward, transport, SQL, throw, malformed response, wrong ordering, duplicate identity, or equation mismatch becomes code-only `PERSISTENCE_FAILURE` (or the declared preview read code), never provider text.

`lib/supabase/database.types.ts` is edited manually because linked generation is a remote operation. It adds exact Row/Insert/Update/Relationships contracts for the two no-FK tables and exact Args/`Json` Returns for the four signatures above. `Row` contains every column as required; `Insert` makes only `id`, `actor_role`, and `created_at` optional for approvals and only `id` and `created_at` optional for receipts because those are the only SQL defaults; `Update` follows generated Supabase optional-column convention even though RLS/triggers reject runtime updates; `Relationships` is exactly `[]`. Compile-time equality tests prevent optionality, name, SQL-to-TypeScript type, argument, or signature drift.

## File Changes

| File | Action | Description |
|---|---|---|
| `db/migrations/0081_task_automation_historical_preview_boundary.sql` | Create | Canonical hash/UUID helpers and Admin cutoff/high-water/census RPC. |
| `db/migrations/0082_task_automation_historical_approval_foundation.sql` | Create | Immutable approval table, checks, fingerprint/integrity trigger, RLS/grants. |
| `db/migrations/0083_task_automation_historical_approval_rpc.sql` | Create | Exact approval validation, request lock, replay/conflict RPC. |
| `db/migrations/0084_task_automation_historical_apply_receipt.sql` | Create | Self-validating no-FK receipt, trigger, forced RLS/grants. |
| `db/migrations/0085_task_automation_historical_apply_validation.sql` | Create | Private universe shared-lock guards plus approval, cutoff/census/evidence, live-context, order, and occupancy validation helpers. |
| `db/migrations/0086_task_automation_historical_apply_writers.sql` | Create | Private exact first-contact and quote generate/suppress writers. |
| `db/migrations/0087_task_automation_historical_apply_rpc.sql` | Create | Receipt-first coordinator, total locks, atomic writes, replay/concurrency. |
| `db/migrations/0088_task_automation_historical_readiness.sql` | Create | Read-only exact accounting/parity RPC. |
| `lib/admin/task-automation-historical-contract.ts` | Create | DTOs, canonical JSON/hash, timestamp/UUID validators, deterministic UUID, limits. |
| `lib/admin/task-automation-historical-classification.ts` | Create | Pure evidence validation, disposition precedence, ordering, counts, plan. |
| `lib/admin/task-automation-historical-auth.ts` | Create | Bootstrap-only auth user/profile/Admin resolver with exact code-only outcomes and no navigation throws. |
| `lib/admin/task-automation-historical-preview-source.ts` | Create | Allow-listed Supabase keyset/chunk data source and retry diagnostics. |
| `lib/admin/task-automation-historical-preview.ts` | Create | Auth-first boundaries, convergence, classifier invocation, exact envelope. |
| `lib/admin/task-automation-historical-approval.ts` | Create | Projection derivation, request equations, approval RPC adapter/decoder. |
| `lib/admin/task-automation-historical-apply.ts` | Create | Apply RPC adapter and strict receipt decoder. |
| `lib/admin/task-automation-historical-readiness.ts` | Create | Readiness RPC adapter and strict row/count decoder. |
| `lib/supabase/database.types.ts` | Modify | Manual exact additive tables and four RPC signatures only. |
| `tests/task-automation-historical-contract.test.ts` | Create | Canonical/hash/UUID/timestamp/limit golden vectors. |
| `tests/task-automation-historical-classification.test.ts` | Create | Both source families, evidence, all dispositions/reasons, counts, purity. |
| `tests/task-automation-historical-preview.test.ts` | Create | Auth, queries, pages/sentinels, retries, convergence, no partial plan. |
| `tests/task-automation-historical-approval.test.ts` | Create | Projection/hash/byte/equation/decoder/replay static and adapter proof. |
| `tests/task-automation-historical-approval-runtime.test.ts` | Create | Local PostgreSQL RLS, immutability, concurrency, purge survival. |
| `tests/task-automation-historical-apply-receipt.test.ts` | Create | Receipt schema/helper/trigger/result integrity. |
| `tests/task-automation-historical-apply-writers-runtime.test.ts` | Create | Exact private first-contact/quote generation and suppression, native identities, source order/occupancy rejection, privacy, and atomic rollback. |
| `tests/task-automation-historical-apply-concurrency.test.ts` | Create | Replay, competing requests, stale state, occupancy, second-row rollback, purge replay. |
| `tests/task-automation-historical-adapters-types.test.ts` | Create | Strict public/private envelopes and exact manual database types. |
| `tests/task-automation-historical-readiness-runtime.test.ts` | Create | Complete accounting/equations/parity, ready false/true, read-only behavior. |
| `tests/task-automation-historical-preservation.test.ts` | Create | `0077`–`0080` byte preservation, existing suites/signatures/grants, rollback boundary. |
| `openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` | Create later | Direct working-tree pre/post SHA-256 manifest for currently untracked migrations. |
| `openspec/changes/week-03-task-automation-historical-bootstrap/tasks.md` | Create later | SDD task decomposition and slice checkboxes. |
| `openspec/changes/week-03-task-automation-historical-bootstrap/apply-progress.md` | Create later | Cumulative RED/GREEN, line-count, rollback, and preservation evidence. |
| `docs/implementation/ACTIVE.md` | Modify per slice | Atomically route the exact next slice; never claim rollout/closure. |
| `docs/DECISIONS.md` | Modify per durable decision | Record shipped local contracts and rollback boundary. |
| `docs/PROGRESS.md` | Modify only final verified slice | Record verified local bootstrap state, not production readiness or Week 03 closure. |

### Fixed `0081`–`0088` allocation invariant

The migration allocation is identical to the amended proposal and is not provisional: `0081` owns only canonical hash/UUID helpers and the preview boundary; `0082` owns approval storage/integrity/RLS; `0083` owns approval execution/replay; `0084` owns receipt storage/integrity/RLS; `0085` owns apply guards and all revalidation; `0086` owns private generate/suppress writes; `0087` owns the public receipt-first apply coordinator; and `0088` owns readiness accounting. The global universe trigger function belongs to `0085` because it is part of stale-plan/live-state validation interoperability; the exclusive acquisition belongs to the `0087` coordinator. No approval object moves into `0081`, no receipt object moves into `0083`, no writer moves into `0085`, and no apply mutation moves into `0088`.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Pure unit | Canonicalization, identity formulas, assignment/quote evidence, precedence, all reasons/dispositions, limits, counts | `node:test` vectors with fixed UTC/UUID/hash fixtures; zero I/O imports. |
| Reader/adapter | Exact auth user/profile/Admin distinctions before source/persistence construction; selects/cursors/chunks, retry accounting, convergence, envelopes, provider privacy | Injected auth client and separate source/persistence factories; malformed/adversarial auth and provider shapes. |
| Static SQL/types | Object names, all `0081`/`0082`/`0084` count types/defaults/checks, grants/RLS, every public RPC signature/result, exact manual types | Source assertions plus compile-time `Equal`/`Assert` contracts. |
| PostgreSQL integration | RLS, immutability, approval/apply replay, deterministic writes, global phantom guard, raw `0079`/`0080` source/origin lock interoperability, stale/order/occupancy, atomicity, concurrency, readiness | Serial opt-in disposable PostgreSQL 16 using `tests/helpers/postgres-runtime.ts` and local migrations through `0088`; paused two-session races prove blocking and rollback. |
| Regression | Existing action/automation/source/cutover behavior and current migration bytes | Full existing suites with zero skips plus direct working-tree SHA-256 receipts; never HEAD-only proof. |

Required focused commands are:

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts tests/task-automation-historical-preview.test.ts tests/task-automation-historical-approval.test.ts tests/task-automation-historical-adapters-types.test.ts tests/task-automation-historical-apply-receipt.test.ts tests/task-automation-historical-preservation.test.ts

RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-apply-writers-runtime.test.ts tests/task-automation-historical-apply-concurrency.test.ts tests/task-automation-historical-readiness-runtime.test.ts tests/task-automation-historical-preservation.test.ts

RUN_TASK_AUTOMATION_DB_TESTS=1 RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-*.test.ts tests/task-actions-*.test.ts tests/task-automation-*.test.ts tests/task-source-*.test.ts

FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/tasks-*.test.ts tests/follow-up-task-*.test.ts tests/crm-contact-*-task-read-runtime.test.ts tests/lead-events-append-only-runtime.test.ts

npx tsc --noEmit && npm run lint && E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build && git diff --check
sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256
```

Runtime tests use `skip: process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS !== "1"` before any Docker call, `execFile`/`execFileSync` argument arrays only, fixed `postgres:16-alpine` unless the existing explicit image environment variable is set, `try/finally` cleanup, and a final container-absence assertion. No remote Supabase command or linked type generation is part of proof.

### Working-tree preservation receipts for untracked `0077`–`0080`

Current `0077`–`0080` are untracked at design time, so `git diff`, `git show HEAD:path`, and other HEAD-only comparisons cannot prove preservation. The design-time pre-receipt is the direct SHA-256 of the current working-tree bytes:

```text
9d34d3006bbd73080ca2f89cdde12fd80f53d347a19ccd9fcd0294d741ff3d26  db/migrations/0077_task_action_audit_foundation.sql
74497f963022a442bcde5c30b2976f35ea26dc851c06547b0f8be11239d5d7e3  db/migrations/0078_task_action_rpc.sql
918d7117f53f6665209fbdfccefe0613be1dadb57b4015386c42f322d167428b  db/migrations/0079_task_automation_foundation.sql
28baa3d2f0f7f4c8699cfcf7eb57b20111b7d8edb6217299192dfeea05741447  db/migrations/0080_task_automation_sources.sql
```

S1 must create `openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` with exactly that manifest and first recompute the files; any mismatch stops the chain and requires replanning rather than blessing new bytes. Every implementing slice records direct pre- and post-slice SHA-256 output in `apply-progress.md`, runs the static preservation test, and requires both outputs to equal this manifest. S18 records the final post-receipt and repeats the direct check after aggregate/build cleanup. A Git diff may remain supplemental evidence but can never substitute for those working-tree byte receipts.

## Native Slice Plan

Gate 0 is the separate local preflight checkbox and is not an implementation slice. The implementation chain contains S1–S18, so the task ledger contains exactly 18 implementation-slice checkboxes plus Gate 0, or 19 checkboxes total. Every slice updates its checkbox, `apply-progress.md`, `docs/implementation/ACTIVE.md`, direct pre/post `0077`–`0080` SHA-256 receipts, and any durable `docs/DECISIONS.md` entry in the same diff. Type-bearing slices include type tests; only S18 may update `docs/PROGRESS.md`. Forecasts include implementation, that slice's RED/GREEN proof, types, task/evidence, receipts, and docs.

This amendment is delivery-only: S1–S13 are unchanged; implemented S14 owns both private `0086` first-contact and quote generate/suppress writer families; obsolete pending writer slices are removed; former S17–S20 map one-for-one to current S15–S18. The remap changes only slice labels, dependencies, task paths/commands, rollback references, and packet grouping. It does not change an implementation contract, migration allocation, requirement, scenario, or capability count.

| # | Behavior-complete native slice | Primary files | Forecast | Exact rollback |
|---:|---|---|---:|---|
| 1 | Canonical primitives, closed DTOs, UUID/hash golden vectors, and preservation manifest/assertion | contract + contract/preservation tests + SHA manifest | 320–350 | Remove pure files/evidence only; do not touch `0077`–`0080`. |
| 2 | Provable first-contact evidence and deterministic projection | classifier + classification tests | 320–360 | Remove this pure branch; no state. |
| 3 | Quote first-sent and exact invalidation reconstruction | classifier + classification tests | 340–380 | Remove this pure branch; no state. |
| 4 | Disposition precedence, accounting, ordering, limits, plan hash | classifier/contract + tests | 300–340 | Remove integrated pure behavior; no state. |
| 5 | `0081` boundaries, cutoffs, root census/keyset/sentinels | migration, preview source + tests | 330–370 | Revoke/drop boundary and private helpers; no rows exist. |
| 6 | Bounded evidence/owner/occupancy joins | preview source + tests | 340–380 | Remove reader methods; no DML. |
| 7 | Bootstrap auth distinctions, two-client sequencing, and strict `0081` boundary/source adapter | auth helper, preview source + tests | 268 realized | Remove only S7 auth/source-adapter behavior; retain S1–S6, local `0081`, and existing page auth unchanged. |
| 8 | Bounded paired-pass convergence, one classifier invocation, exact preview envelope, and closed diagnostics/failures | preview adapter + tests | 371 realized | Remove only the S8 preview assembler/tests/evidence; retain S1–S7, local `0081`, and protected `0077`–`0080`. |
| 9 | `0082` immutable approval storage/integrity/RLS | migration + runtime tests/types | 330–370 | Drop only while table empty; otherwise retain. |
| 10 | `0083` approval validation, request lock, replay/conflict | migration + runtime tests | 340–380 | Revoke RPC; retain approvals. |
| 11 | Approval adapter, projections, strict decoder, manual types | adapter/types + tests | 330–370 | Remove caller/types only if unused; retain ledger. |
| 12 | `0084` self-validating apply receipt/RLS | migration + receipt tests | 320–360 | Drop only when receipt table and all bootstrap state are empty. |
| 13 | `0085` universe shared guards/exclusive protocol; approval/cutoff/root/evidence/live-context revalidation; exact raw source/origin/Task interoperability; phantom, stale, and occupancy races | migration + runtime concurrency tests | 250 realized | Revoke dependent apply; guards may be dropped only after apply is disabled. |
| 14 | `0086` private deterministic first-contact and quote generate/suppress writers, exact native identities, source order/occupancy rejection, and atomic rollback | migration + writer runtime tests | 260 realized | Disable dependent apply; remove only unused `0086` before use, otherwise retain every committed write. |
| 15 | `0087` receipt-first coordinator, replay/purge replay, atomic mixed plan, identical/competing concurrency, and second-projection rollback | migration + writer/apply concurrency tests | 370–400 | Revoke apply RPC; retain writes/receipt. |
| 16 | Apply adapter, exact decoder, manual RPC/table types | adapter/types + tests | 330–370 | Remove caller/types only; execution remains revoked. |
| 17 | `0088` readiness accounting/parity/read-only RPC with complete ready false/true and integrity proof | migration + readiness runtime tests | 350–390 | Revoke readiness RPC; retain state. |
| 18 | Readiness adapter/types, strict envelope proof, full aggregate, final post-receipt, rollback evidence, and final local docs | adapter/types/tests/docs | 310–350 | Remove caller; retain immutable state and local evidence. |

Auto-chain is strict `S1 -> S2 -> ... -> S18`; a slice starts from its predecessor and cannot skip a dependency. The seven review packets are fixed **before** the cap as `P1=S1–S3` (maximum `1,090`), `P2=S4–S6` (`1,090`), `P3=S7–S9` (`1,009`, using realized S7/S8 plus the S9 forecast maximum), `P4=S10–S12` (`1,110`), `P5=S13–S14` (`510` realized), `P6=S15–S16` (`770`), and `P7=S17–S18` (`740`). Every declared maximum is strictly below `1,200`; the largest is P4 at `1,110`. Thus the first packet is no longer the invalid `S1–S4` range. A packet whose realized cumulative authored changed lines would reach or exceed `1,200` must close before adding the next native slice; the next slice begins a new packet. Any native slice forecast or actual count above 400 must split by complete behavior before review; test-later, types-later, docs-later, proof-only, or compressed-proof splits are forbidden.

## Threat Matrix

| Boundary | Status | Expected safe/failure behavior | Planned RED test |
|---|---|---|---|
| Application routing | N/A | No route, page, action, middleware, or URL behavior changes. | None required. |
| Shell command construction | Applicable only to the existing disposable PostgreSQL helper | `execFile`/`execFileSync` receive fixed executable plus argument arrays; no shell interpolation, user-controlled command, or remote URL. Failure aborts the test and still cleans up. | Malicious image/database text is never incorporated into a shell command; source assertion forbids `exec`/`shell:true`. |
| Subprocess lifecycle/process integration | Applicable | Opt-in skip occurs before spawn; readiness is bounded; tests run serially; `finally` removes the unique container and proves absence after success/failure/timeout. | Spawn/readiness/psql assertion failure still calls cleanup; post-test container query is empty. |
| VCS/PR automation | N/A | Auto-chain is delivery metadata, not executable Git/GitHub automation; this change performs no commit, push, or PR operation. | None required. |
| Executable-file classification | N/A | No file is classified or executed by extension/content. | None required. |
| Remote process/file transfer | N/A | Remote access, linked type generation, deployment, and file transfer are excluded. | Static command/source review contains no remote tool invocation. |

## Migration / Rollout and Rollback

No migration is applied by this design. Implementation proof is local/disposable only. `0081`–`0088` contain no historical DML at migration time; only the authenticated approved `0087` RPC can create bootstrap operational state. There is no feature UI, notification, Mi día behavior, Dashboard/CRM read change, remote rollout, production-readiness claim, or Week 03 closure.

Before any historical approval, receipt, Task, origin, outcome, or tombstone exists, exact destructive rollback is: revoke authenticated execute on readiness, apply, approval, and boundary RPCs; drop the `0085` universe statement guards from their eleven tables; drop `0088` through `0081` functions in reverse dependency order; drop receipt policy/trigger/table; drop approval policy/trigger/table; remove only the new adapters/manual types/tests/docs; leave `0077`–`0080` and legacy `task_transition` revocation byte-identical and verify the post-receipt against the fixed manifest.

After any approval or bootstrap state exists, rollback is forward-only. A new additive disable migration revokes authenticated execution of `read_task_automation_historical_boundaries`, `approve_task_automation_historical_plan`, `apply_task_automation_historical_plan`, and `read_task_automation_historical_readiness`; callers are disabled, but all approvals, receipts, Tasks, origins, outcomes, tombstones, action receipts, source history, and terminal state remain. RLS-backed audit SELECT may remain. Incorrect Tasks are remediated only through a separately approved audited Task action. DELETE, adoption, receipt rewrite, source rewrite, migration-file edits, legacy writer restoration, and destructive table/function removal are forbidden.

## Contract Coverage and Corrective Closure

The four unchanged specifications remain exactly **34 requirements / 62 scenarios**. Implementation traceability is: classification `9/18` in S1–S4; preview `7/13` in S5–S8; approval `7/11` in S9–S11; and apply/readiness `11/20` in S12–S18. Corrective concurrency, auth, schema, and preservation RED cases strengthen proof of those contracts; they do not add, remove, or rename a specification requirement or scenario.

| Gate finding | Design closure | Implementing slices |
|---|---|---|
| 1. Auth codes were impossible through navigation auth. | New bootstrap helper resolves auth user, then profile activity, then Admin role; exact code-only outcomes and separate auth/source-persistence factories are defined. | S7, then reused by S10/S11/S15–S18. |
| 2. Historical advisory namespaces did not interoperate with `0079`/`0080`. | Source/origin locks now use the exact raw `source_key`/`origin_key` first-16-hex bigint expressions; additive statement guards place all future source hooks under the global shared lock. | S13–S15. |
| 3. Recensus row locks admitted phantoms. | Fixed shared writer guards plus receiptless apply's exclusive universe lock cover new/deleted/changed pre-cutoff roots, evidence, and context through commit, with paused two-session RED races. | S13–S15. |
| 4. `0081`/`0082`/`0084` counts and RPCs were underspecified. | Every count/result field, SQL type, nullability, default, constraint, all four argument lists, and exact database results are enumerated. | S5, S9–S12, S16–S18. |
| 5. HEAD-only preservation could not see untracked `0077`–`0080`. | Direct design-time SHA-256 manifest plus per-slice pre/post and final working-tree receipts; HEAD is supplemental only. | S1 and every slice through S18. |
| 6. A former slice was proof-only/test-later. | Its replay, race, rollback, purge, and preservation proofs are folded into the behavior that implements them; the plan is now 18 slices with no test-only slice. | S13–S15 plus per-slice receipts. |
| 7. First review packet exceeded 1,200 forecast lines. | P1 is S1–S3 at maximum 1,090; every packet is predeclared below 1,200 and closes before reaching the cap. | All packets P1–P7. |
| 8. Migration allocation needed exact cross-artifact parity. | The amended proposal's exact local `0081`–`0088` paths and responsibilities are repeated without placeholders or moved objects. | S5, S9–S10, S12–S15, S17. |

## Open Questions

None. The proposal has resolved the sole product blocker: only provable earliest durable valid assignment evidence is admissible, and missing or contradictory evidence remains context-invalid manual review.
