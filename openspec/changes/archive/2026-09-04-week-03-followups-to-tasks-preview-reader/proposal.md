# Proposal: Admin Follow-up Tasks Preview Reader

## Intent

Provide a safe, review-only Admin read seam that builds a complete bounded snapshot of historical
follow-up events and Task occupancy, then invokes the existing pure classifier exactly once. This
closes the gap between decoded classifier facts and live data without exposing PII, bypassing
authorization, or implying execution readiness.

## Scope

### In Scope
- Authorize Admin before constructing or invoking the service-role client or any source read.
- Read an immutable cutoff once. Events use explicit columns and ascending `(created_at,id)` keyset
  pages of at most 200 rows, with an 11th page limited to 1 as the 2,001-row sentinel. All Tasks use
  a separate `(created_at,id)` keyset with the same 200/2,001 bounds; `created_at` is read only for
  that allowlist/cursor and remains excluded from classifier equality. Ten full pages represent
  exactly 2,000 rows; an empty page or final partial page terminates normally. `.or(rawPostgrestExpression)`
  receives validated canonical strings unchanged; it is never pre-encoded because Supabase encodes it.
  Event first/subsequent/sentinel chains are respectively
  `.from('lead_events').select(columns).eq('event_type','follow_up_registered').or(cutoffExpr).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(200)`,
  the same chain with `.or(cursorExpr)` before the orders, and the same chain with `.limit(1)`.
  Task chains are the equivalents on `.from('tasks').select(columns).or(cutoffExpr)`, optionally
  `.or(cursorExpr)`, and `.limit(200|1)`, with no event filter. The cutoff expression is
  `created_at.lt.<cutoffAt>,and(created_at.eq.<cutoffAt>,id.lte.<cutoffId>)`; later pages use
  `created_at.gt.<afterAt>,and(created_at.eq.<afterAt>,id.gt.<afterId>)`.
- Resolve unique lead/profile/role IDs from the bounded event/Task population in deterministic sorted
  chunks of at most 200, not by source pagination. Read only leads `{id,assigned_to,deleted_at,archived_at}`;
  profiles `{id,is_active}`; `profile_roles {profile_id,role_id}`; and roles `{id,name}`. Reject
  duplicate, missing, malformed, unexpected, or overflow joins; unique-ID maxima are inherited from
  the bounded events/Tasks.
- Decode closed classifier facts, return stable PII-safe errors, and return only the canonical
  review plan/projections. Add `TaskOccupancyFact` as a separate closed fact for EVERY Task's
  owner+lead and idempotency occupancy; `ExistingTaskFact` remains limited to exact follow-up-source
  equality and must not be used to discard any Task. A malformed `profile_roles` row
  (`profile_id`/`role_id`) or malformed role row (`id`/`name`) is `MalformedRow`; a requested valid
  role ID with no returned role row is `IncompleteJoin`; a well-formed unsupported role name or zero
  mappings for an active profile yields an `OwnerFact` with `invalid-role`. Identical duplicate
  mappings dedupe; conflicting duplicates are `MalformedRow`.
- Update pure classifier tests and contract specs without changing disposition or canonical plan.

### Out of Scope
- Any DML, schema/RPC migration, route/UI, remote mutation, or rollout. Production runtime MAY perform
  Admin-authorized read-only linked-project source reads after authorization and MUST never mutate.
  Digest/classifier failure occurs after authorized reads and MUST perform zero additional logical reads
  and zero DML/schema/UI/remote mutation; prior authorized production reads are acknowledged. Only injected local verification asserts
  zero linked transport calls; provider-level
  GET retries count as one logical read and MUST NOT alter page accounting. Pure classification and
  local injected verification have zero remote activity and MUST never access the linked project. The
  production data source uses an injected/custom fetch wrapper that increments `physicalAttempts` for
  every underlying HTTP fetch attempt, while each reader method call increments `logicalReads` once.
  Retries add physical attempts only and MUST NOT add logical pages, cursors, sentinels, or chunks. Safe
  diagnostics MAY expose aggregate physical/logical counts, but MUST NOT expose URLs, provider text, or PII.
- Approval, execution, ledger, cancellation, revalidation, cutover, operational Task creation,
  automation, SLA, notifications, Mi día, or UI behavior.

## Capabilities

### New Capabilities
- `follow-up-backfill-preview-reader`: Admin-gated bounded live snapshot decoding, convergence, and
  review-only classifier invocation.

### Modified Capabilities
- `follow-up-backfill-preview`: separate occupancy facts from canonical follow-up Task equality.
- `tasks-foundation`: preserve collision semantics for all existing Task occupancy.
- `follow-up-task-representation`: clarify read-only collision coverage; preserve representation.

## Approach

Implement a server-only dependency-injectable adapter using `requireAdminRole(["admin"])` first,
then the existing service client. Apply the inclusive `(created_at,id)` cutoff predicate and separate
keyset ordering to follow-up events and all Tasks, with explicit projections: Task rows are read for
occupancy regardless of `task_kind`/source, while only exact follow-up-source rows become
`ExistingTaskFact`. Use bounded IN joins, strict decoding, deterministic fact digests, and stable
error mapping. Run at most four full passes: compare pass 1/2 and accept pass 2 when equal; if they
differ, compare pass 3/4 and accept pass 4 only when equal; otherwise fail with
`SnapshotNotConverged`. Invoke the pure classifier exactly once only after an accepted pair.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `lib/admin/follow-up-backfill-preview.ts` | Modified | Occupancy fact contract and pure tests. |
| `lib/admin/follow-up-backfill-preview-reader.ts` | New | Auth-gated bounded reader/decoder. |
| `lib/admin/auth.ts`, `lib/supabase/admin.ts` | Modified | Reuse/inject existing seams; no new authority. |
| `tests/` | Modified | Auth order, caps, convergence, decoding, PII, zero-DML tests. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Service client misuse or mixed reads | Med | Auth-before-construction, two-pass digest, fail closed. |
| Incomplete/PII-bearing projections | Med | Explicit columns, closed decoding, stable errors, contract tests. |

## Rollback Plan

Revert the reader, classifier contract/test changes locally; no database, remote project, or Task
data is changed.

## Dependencies

- Existing Admin session/role guard, local Tasks representation, and pure classifier contracts.

## Success Criteria

- [ ] Unauthorized callers cause no service-client construction or source read.
- [ ] Converged snapshots respect cutoff, 200/2,001 bounds, strict decoding, and PII policy.
- [ ] Classifier runs once and returns unchanged dispositions/canonical plan with zero DML/schema/UI/remote mutation.
- [ ] A single logical page with four fetch attempts reports `logicalReads +1` and `physicalAttempts +4`.

## Next Step

Ready for specs (sdd-spec).
