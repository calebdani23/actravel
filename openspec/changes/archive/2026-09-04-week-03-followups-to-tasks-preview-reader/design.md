# Design: Admin Follow-up Tasks Preview Reader

## Technical Approach

Build a server-only, read-only adapter behind injected dependencies. It authorizes first, constructs the
Supabase read source second, acquires one event cutoff and one task cutoff, then performs up to four
bounded keyset passes. Each pass decodes closed DTOs, resolves deterministic joins, builds occupancy and
exact existing-follow-up facts, digests the canonical snapshot, and compares paired passes. The injected
classifier runs exactly once only after P2 or P4 converges.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Exact Supabase chains and cursors | Existing fluent order or offset pagination | `.or(rawPostgrestExpression)` receives validated canonical strings unchanged; Supabase encodes them. Events use `.from('lead_events').select(columns).eq('event_type','follow_up_registered').or(cutoffExpr)`, optionally `.or(cursorExpr)`, then `.order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200|1)`. Tasks use the same chain on `.from('tasks').select(columns).or(cutoffExpr)`, optionally the cursor, with no event filter. |
| Event cutoff is required; empty task cutoff is `null` | Shared cutoff; empty cutoff error for both | Events define the bounded source; task absence is a valid empty population. |
| Pure owner classifier is injected with a default; digest is injected with SHA-256 default | Direct calls only | Enables exact invocation/failure tests without changing production behavior. |
| All Tasks create occupancy; only canonical follow-up Tasks create equality facts | Filter Tasks by kind/source | Manual and unrelated Tasks must still participate in collisions. |
| Four fixed paired passes | Unbounded retries; one pass | Bounds work while detecting snapshot churn without claiming isolation. GET transport retries are provider-level one logical read and do not change page accounting. |
| Separate physical/logical diagnostics | Counting retries as pages | An injected/custom fetch wrapper increments `physicalAttempts` for every underlying HTTP fetch attempt; each reader method call increments `logicalReads` once. Retries never create pages, cursors, sentinels, or chunks; safe diagnostics expose aggregate counts only. |

## Data Flow

`auth → client → cutoffs once → P1..P4 pages → closed rows/joins → canonical digest → classifier`

Pages are ascending `(created_at,id)`, 200 rows, with an eleventh `limit(1)` sentinel request. The
first page has only `.or(cutoffExpr)`; subsequent pages add `.or(cursorExpr)`; the sentinel repeats
the applicable chain with `.limit(1)`. Cutoff is `created_at.lt.<cutoffAt>,and(created_at.eq.<cutoffAt>,id.lte.<cutoffId>)`;
cursor is `created_at.gt.<afterAt>,and(created_at.eq.<afterAt>,id.gt.<afterId>)`. Joins use exact
chains `.from(table).select(columns).in(idColumn,chunk).order('id',{ascending:true})`, except
`profile_roles`, which additionally orders `.order('role_id',{ascending:true})` after
`.order('profile_id',{ascending:true})`, all in sorted unique chunks of 200. Owner mapping is deterministic: malformed `profile_roles`
(`profile_id`/`role_id`) or roles (`id`/`name`) → `MalformedRow`; a requested valid role ID absent from
the role result → `IncompleteJoin`; absent profile → `missing-profile`; inactive profile →
`inactive-profile`; and active profiles with zero mappings or a well-formed unsupported role name →
`OwnerFact` `invalid-role`. Identical duplicate mappings dedupe; conflicting duplicates are
`MalformedRow`; otherwise roles are sorted, unique, nonempty exact `admin|manager|asesor` values.

## File Changes

| File | Action | Description |
|---|---|---|
| `lib/admin/follow-up-backfill-preview-reader.ts` | Create | Auth, exact queries, cutoff/paging, joins, owner mapping, digest, convergence, envelope. |
| `lib/admin/follow-up-backfill-preview.ts` | Modify | Consume occupancy and canonical owner facts without changing dispositions. |
| `tests/follow-up-backfill-preview-reader.test.ts` | Create | Contract, boundary, role, convergence, dependency and no-write tests. |
| `tests/follow-up-backfill-preview.test.ts` | Modify | Occupancy and classifier vectors. |

## Interfaces / Contracts

`ReaderDeps` adds `classify`, defaulting to `classifyFollowUpBackfillPreview`, and `digest`, defaulting to
lowercase SHA-256 over canonical UTF-8 snapshot JSON, plus the injected/custom fetch wrapper used by the
production data source. The wrapper records `physicalAttempts` per underlying HTTP attempt; each reader
method call records one `logicalReads`. `EventRow` does not select or expose `actor_id`.
Digest or classifier failure happens after authorized reads, so the reader stops immediately: zero
additional logical reads and zero DML, schema, UI, or remote mutation; prior authorized production reads
are acknowledged. Only injected local verification asserts zero linked transport calls;
production provider retries remain within one logical GET read. Safe diagnostics may expose aggregate
`physicalAttempts`/`logicalReads` only, never URLs, provider text, or PII.
All query/provider errors, including cutoff errors and internal digest failures, map to `QueryFailed`;
only a successful error-null empty event cutoff maps to `CutoffUnavailable`.

## Testing Strategy

Injected deterministic transports assert authorization order, exact select/filter ordering and literal
cutoff/strict `.or` strings, one-time cutoffs, page/sentinel limits unaffected by provider retry metadata,
sorted chunked joins, role precedence/deduplication, canonical ordering, P1/P2 then P3/P4, classifier
exactly once/zero, zero reads after digest/classifier failure, digest failure mapping, stable code-only
errors, no PII, and zero writes. Include the exact retry assertion: one logical page with four fetch
attempts yields `logicalReads +1` and `physicalAttempts +4`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable classification, or process boundary.

## Migration / Rollout

No migration required; no UI, DML, schema, or remote test execution.

## Open Questions

None.
