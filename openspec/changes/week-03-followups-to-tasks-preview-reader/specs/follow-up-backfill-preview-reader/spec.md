# Follow-up Backfill Preview Reader Specification

## Purpose

Define an Admin-gated, server-only, read-only, convergent snapshot reader for the pure classifier.

## Requirements

### Requirement: Auth and one response envelope

The module MUST export `readFollowUpBackfillPreview(deps): Promise<ReaderResult>` and a read-only
`PreviewReadDataSource`. Authorization MUST finish before client construction or any source read. Auth
throws map to `Unauthorized`; factory throws map to `ClientUnavailable`. Provider text, raw payloads, and
PII MUST never be returned. The only response shapes are `{ok:true,plan,readerSnapshotHash,eventCutoff,taskCutoff}`
and `{ok:false,error:{code,message}}`, with `message` equal to `code`.

```ts
type ReaderDeps = {
  requireAdminRole?: (allowed: readonly ["admin"]) => Promise<unknown>
  createReadDataSource?: () => Promise<PreviewReadDataSource>
  classify?: typeof classifyFollowUpBackfillPreview
  digest?: (snapshot: unknown) => string
}
```

#### Scenario: Unauthorized auth
- **WHEN** the guard throws
- **THEN** return only `Unauthorized`, without constructing a client or reading

#### Scenario: Authorized success and dependency hooks
- **WHEN** auth succeeds and a bounded snapshot converges
- **THEN** call injected `classify` once and injected `digest` per pass, returning no PII

### Requirement: Exact DTOs and Supabase query contracts

Closed DTOs MUST contain only selected fields. Event rows are exactly `id,lead_id,created_at,event_type,
follow_up_at:payload->>followUpAt,has_note:payload->hasNote` (no `actor_id`). Task rows are exactly
`id,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,
metadata,status,owner_id,lead_id,quote_id,description,due_at,idempotency_key,created_at`. Leads select
`id,assigned_to,deleted_at,archived_at`; profiles `id,is_active`; profile_roles `profile_id,role_id`;
roles `id,name`.

Every query MUST call `.select(columns)` then filters, then
`.order("created_at",{ascending:false|true}).order("id",{ascending:false|true}).limit(n)` where
applicable, with no wildcards, nested selects, or actor selection. Event cutoff is exactly
`.select('created_at,id').eq('event_type','follow_up_registered').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1)`;
task cutoff is exactly `.select('created_at,id').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1)`.
Pages use these exact chains (the sentinel is the 11th request):
```ts
eventFirst      = .from('lead_events').select(columns).eq('event_type','follow_up_registered').or(cutoffExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200)
eventSubsequent = .from('lead_events').select(columns).eq('event_type','follow_up_registered').or(cutoffExpr).or(cursorExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200)
eventSentinel   = .from('lead_events').select(columns).eq('event_type','follow_up_registered').or(cutoffExpr).or(cursorExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(1)
taskFirst       = .from('tasks').select(columns).or(cutoffExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200)
taskSubsequent  = .from('tasks').select(columns).or(cutoffExpr).or(cursorExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200)
taskSentinel    = .from('tasks').select(columns).or(cutoffExpr).or(cursorExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(1)
```
Values passed to `.or(rawPostgrestExpression)` are
validated canonical strings and MUST remain raw, never pre-encoded; Supabase encodes them. The
inclusive cutoff literal is `created_at.lt.<cutoffAt>,and(created_at.eq.<cutoffAt>,id.lte.<cutoffId>)`;
later pages use `created_at.gt.<afterAt>,and(created_at.eq.<afterAt>,id.gt.<afterId>)`. Joins are
exact `.from(table).select(columns).in(idColumn,chunk).order('id',{ascending:true})` chains in sorted
chunks ≤200; `profile_roles` uses `.order('profile_id',{ascending:true}).order('role_id',{ascending:true})`.

#### Scenario: Query contract and PII
- **WHEN** any source query is built
- **THEN** select is first, allowlists are exact, actor_id is absent, and unexpected/extra returned fields are `MalformedRow`

#### Scenario: Query failure
- **WHEN** any query throws or returns non-null `error`, including either cutoff query
- **THEN** return `QueryFailed` with no provider text

### Requirement: Fixed cutoffs, pages, and sentinel

After auth/client and before P1, read each cutoff exactly once and reuse them for every pass. A successful
error-null empty event cutoff is the sole `CutoffUnavailable` case. A successful empty task cutoff is valid
`null`; malformed successful cutoff data is `MalformedRow`. Cutoffs use inclusive `(created_at,id)` and
later pages use strict-after cursor predicates. Ascending pages are 200 rows; ten pages cover 2,000 rows
and the eleventh `limit(1)` row is a `LimitExceeded` sentinel. Empty or partial pages terminate.
The production data source MUST use an injected/custom fetch wrapper. The wrapper increments
`physicalAttempts` for every underlying HTTP fetch attempt. Each reader method call increments
`logicalReads` exactly once. Provider retries add physical attempts only and MUST NOT add logical pages,
cursors, sentinels, or join chunks. Safe diagnostics MAY expose aggregate `physicalAttempts` and
`logicalReads`, but MUST NOT expose URLs, provider text, or PII.

#### Scenario: Fixed cutoffs and complete page chains
- **WHEN** an authorized read returns first pages, subsequent pages, and an 11th sentinel for both
  events and Tasks
- **THEN** each cutoff is read once; first chains have only `cutoffExpr`, subsequent chains add
  `cursorExpr`, all use ascending `(created_at,id)`, limits are `200` then `1`, and raw `.or` values
  are not pre-encoded

#### Scenario: Provider retries do not change logical paging
- **WHEN** one logical page requires four underlying HTTP fetch attempts
- **THEN** report `logicalReads +1` and `physicalAttempts +4`, and do not add a page, cursor, sentinel,
  cutoff, or join chunk

### Requirement: Joins, occupancy, and owner decoding

Derive sorted unique lead/profile/role IDs from bounded rows and query joins in chunks ≤200. Operational
leads are exactly `deleted_at IS NULL AND archived_at IS NULL`. Missing leads are `IncompleteJoin`;
unassigned leads produce `unassigned`.

Role precedence is exact: malformed `profile_roles.profile_id`/`role_id` or roles `id`/`name` →
`MalformedRow`; a requested valid role ID missing from returned roles → `IncompleteJoin`; absent profile →
`missing-profile`; `is_active:false` → `inactive-profile`; `is_active:true` with zero mappings or a
well-formed unsupported role name → an `OwnerFact` with `invalid-role`; otherwise emit sorted unique
nonempty exact roles `admin|manager|asesor`. Identical duplicate mappings dedupe; conflicting duplicate
mappings are `MalformedRow`. Malformed IDs/types, duplicate primary rows, or extra rows not requested are
`MalformedRow`. Every Task produces occupancy; only an exact complete follow-up representation produces
`ExistingTaskFact`.

#### Scenario: Chunked joins and owner role mapping
- **WHEN** bounded rows produce more than 200 unique IDs, duplicate IDs, and owner profiles with
  active, inactive, missing, unsupported, and duplicate role mappings
- **THEN** issue sorted ≤200-ID chunks with the exact join orders; dedupe identical mappings, reject
  conflicting/malformed rows, map owners by the stated precedence, produce occupancy for every Task,
  and produce `ExistingTaskFact` only for exact follow-up matches

### Requirement: Classifier, digest, convergence, and errors

Normalize facts, exclude Task `created_at` from classifier equality, and digest exactly
`canonicalJson(["preview-reader-snapshot.v1",eventCutoff,taskCutoff,events,existingTasks,taskOccupancies])`.
Sort events `(createdAt,id)`, existing Tasks `(created_at,id)`, occupancies `id`; hash lowercase SHA-256
of UTF-8 JSON. Compare P1/P2, then P3/P4 only if needed; accept P2 or P4 only. Invoke classifier once
after acceptance, or zero times on any error. Classifier throws map to `ClassifierFailed`; digest throws
map to `QueryFailed`; nonconvergence maps to `SnapshotNotConverged`; no error categories overlap.
Digest/classifier failure occurs after authorized reads and MUST cause zero additional logical reads and zero
DML, schema, UI, or remote mutation; prior authorized production reads are acknowledged. Only injected local
verification asserts zero linked transport calls. Tests MUST inject a deterministic transport.

#### Scenario: Convergence and classifier count
- **WHEN** P1/P2 match or differ and P3/P4 match
- **THEN** accept P2/P4 and invoke the classifier exactly once; otherwise after four passes return `SnapshotNotConverged` and invoke it zero times

#### Scenario: Digest/classifier failures and privacy
- **WHEN** digest or classifier fails, or any boundary has provider/PII text
- **THEN** map to `QueryFailed` or `ClassifierFailed` respectively, return code-only errors, and perform zero writes, mutations, or additional linked transport activity
