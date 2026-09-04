# Exploration: Admin Follow-up Tasks Preview Reader

## Current State

The archived Week 03 classifier is intentionally pure: `classifyFollowUpBackfillPreview` accepts a
complete, immutable decoded snapshot, enforces the strict boundary/date/fact rules, limits both
event and existing-task inputs to 2,000, and returns only a canonical review plan plus eligible
future Task projections. It must not acquire a cutoff, query Supabase, authorize a caller, decode
JSON, or mutate data. The exact output is seven ordered counts, nine-field rows, deterministic
Task projections, canonical bytes/hash, and no partial result on error.

The live application authorizes protected reads with the cookie-backed server client. `getAdminSession`
requires an authenticated user, an active profile, and at least one normalized role; `requireAdminRole(["admin"])
` is the established Admin-only boundary and is tested to run before target reads. The service-role
client is available through `createSupabaseAdminClient`, but bypasses RLS and must never substitute
for authentication. Existing Task reads use `select("*")` through the user client and are scoped by
Task RLS; they are not a complete Admin snapshot reader.

The smallest safe live seam is therefore a server-only, dependency-injectable read adapter that
authorizes Admin first, obtains one immutable cutoff, reads bounded source facts with explicit
columns, decodes them into the classifier's closed unions, reads collision facts, runs the pure
classifier, and returns its review-only result. It must not be a route/UI, RPC, migration, action,
write path, approval path, ledger, cancellation path, or remote rollout.

## Affected Areas

- `lib/admin/follow-up-backfill-preview.ts` — pure classifier boundary; do not add I/O or weaken its
  precedence, canonicalization, seven-count order, or `existingTasks <= 2000` contract.
- `lib/admin/auth.ts`, `lib/admin/auth-session.ts` — reuse the established authenticated Admin gate;
  authorization must complete before the service-role client or any source read is created.
- `lib/supabase/admin.ts` — existing server-only secret client is the likely read transport after
  authorization, with injected client/query dependencies for tests; it grants no new capabilities.
- `lib/admin/tasks.ts` — existing Task row/read shape and additive follow-up representation are the
  source for explicit collision projections, not a write or conversion seam.
- `db/migrations/0002_identity.sql`, `0003_crm.sql`, `0062_tasks_foundation.sql`, and local `0064`
  representation — define `profiles`, `profile_roles`/`roles`, `leads.assigned_to`, event payloads,
  Task fields, deletion behavior, and the still-local dependency chain. Remote remains `0060`.
- `tests/admin-route-boundaries.test.ts`, `tests/follow-up-backfill-preview.test.ts`,
  `tests/tasks-runtime.test.ts`, `tests/tasks-rls.test.ts`, and a new reader contract test — prove
  auth-before-read, pagination/convergence, decoding/error mapping, PII projection, classifier
  invocation, caps, and zero DML.

## Proposed Reader Shape and Convergence

1. Call `requireAdminRole(["admin"], injectedSessionLoader, injectedAuthActions)` before constructing
   or invoking any database adapter. A missing/invalid/inactive session is an authorization error;
   never leak database or PII details in that response.
2. Acquire the cutoff once from the newest `lead_events` row using deterministic `(created_at DESC,
   id DESC)`. Normalize and validate the returned timestamp/UUID; absence or malformed data fails
   closed. Every subsequent event page uses the inclusive predicate
   `created_at < cutoffCreatedAt OR (created_at = cutoffCreatedAt AND id <= cutoffId)` and the exact
   ascending keyset order `(created_at ASC, id ASC)`. Filter `event_type = 'follow_up_registered'`.
3. Fetch event pages of **200 rows**, requesting at most **2,001** rows (the 2,001st is an overflow
   sentinel). Any overflow is a typed cap error; never truncate to 2,000 and classify an incomplete
   snapshot. The same page/cap applies to existing Task rows. Do not use offset pagination: inserts
   before the cutoff must not shift pages.
4. From event IDs/lead IDs, fetch only the required lead facts in bounded `IN` batches: lead id,
   `assigned_to`, `deleted_at`, and `archived_at` (or the current operational-equivalent fields).
   Join/resolve profiles by owner ID for `id,is_active`; resolve `profile_roles` with `roles(name)`.
   Decode each owner into exactly `active` with nonempty sorted unique allow-listed roles, or the
   classifier's `unassigned`, `missing-profile`, `inactive-profile`, or `invalid-role` tag. A missing
   lead join is incomplete, not an implicit non-operational lead. Operational means not deleted and
   not archived, matching current CRM projections.
5. Fetch Task collision facts with explicit columns only: identity, status/kind, owner/lead/quote,
   description/due, all follow-up source fields, payload, metadata, and idempotency key. Exclude
   `created_at`/`updated_at` from equality semantics as the classifier does, but preserve `id` for
   duplicate detection. Enforce the 2,001 sentinel and pass no more than 2,000 decoded rows.
6. Use a **two-pass convergence check** with the same cutoff. Repeat the complete bounded read and
   compare the ordered source event identity/timestamps/payload facts, lead operational/owner facts,
   and Task collision facts using a private deterministic digest or deep equality. Return a plan only
   when both passes converge. If they differ, retry the two-pass cycle once; if it still differs,
   return `SnapshotNotConverged` and no plan. This is application-level read consistency, not a
   transaction or a claim of database snapshot isolation.
7. Decode all raw values before calling the classifier, map query/transport failures to stable typed
   reader errors without returning vendor messages, and call the classifier exactly once for the
   converged snapshot. Return the classifier result as review-only data; eligible tasks are
   descriptive projections and are not inserted.

PII minimization is mandatory: do not select contacts, names, email, phone, notes, summaries,
payload keys other than `followUpAt` and `hasNote`, or arbitrary JSON. Logs/metrics may contain only
safe error codes, counts, cutoff metadata, and IDs where operationally necessary.

## Approaches

1. **Admin-gated service-role snapshot reader (recommended)** — authenticate with the existing
   session seam, then use the secret client for complete explicit-column reads, two-pass convergence,
   bounded decoding, and pure classification.
   - Pros: can read all Admin-visible leads/events/profiles/roles/Tasks without RLS truncation; no
     schema/RPC/remote migration; preserves the classifier boundary; easy to inject and test.
   - Cons: service-role misuse would be catastrophic; application-level convergence is weaker than
     a database transaction; requires careful query caps and PII projection.
   - Effort: Medium

2. **Authenticated user-client reader** — use the cookie client for every query and rely on existing
   RLS joins.
   - Pros: least privilege and no secret transport.
   - Cons: current RLS is not a guaranteed complete Admin snapshot contract, nested joins can omit
     facts, and missing rows become indistinguishable from incomplete data; likely cannot safely
     satisfy Admin-wide collision reads.
   - Effort: Medium, high correctness risk

3. **Database RPC/transaction snapshot** — add a read RPC returning the decoded packet.
   - Pros: stronger consistency and fewer round trips.
   - Cons: violates the no-RPC/schema scope, requires migration and remote parity, moves decoding and
     security into a new database contract, and is larger than the smallest live adapter.
   - Effort: High

## Recommendation

Proceed with Approach 1 as a narrowly bounded Admin-only read adapter, retaining all selection,
precedence, collision classification, canonicalization, and output rules in the pure classifier.
Use explicit keyset pagination (200 pages, 2,001 overflow sentinel), a single inclusive cutoff, and
two-pass convergence with one retry. Keep lead/event/profile/role/Task joins as decoded facts only,
minimize PII, fail closed on missing/malformed/overflow/non-converged data, and test that auth occurs
before any client/read. The adapter returns the classifier's review-only plan; execution, approval,
ledger, cancellation, cutover, and any DML remain a successor change. No remote migration or mutation
is implied: the remote baseline remains `0060`.

Before proposal, resolve one classifier contract gap: `ExistingTaskFact` currently validates every
existing row as a follow-up Task, while `OWNER_LEAD_COLLISION` semantically needs occupancy from any
Task (including manual Tasks). The proposal must either add a separate typed occupancy fact to the
pure boundary or explicitly prove that only follow-up rows are in scope; the reader must not silently
drop manual Tasks or pass malformed surrogate facts.

## Risks

- A service-role adapter called before Admin authorization would bypass RLS and expose or mutate data;
  construction and invocation must be gated and zero-DML tested.
- Without a transaction, changing leads/profiles/roles/Tasks can produce a mixed snapshot; two-pass
  convergence must compare all classifier-relevant facts and fail closed after the retry.
- Offset pagination, a missing overflow sentinel, or a moving cutoff can omit events and violate the
  classifier's complete-facts invariant.
- Current schema/remote drift is unresolved; local `0061`–`0064` and generated types do not establish
  remote parity. This adapter must not allocate/apply migrations or infer remote `0060+` state.
- Missing/deleted lead joins and malformed payloads must be typed incomplete/invalid errors, never
  treated as safe exclusions or surfaced with raw PII.
- Manual Task occupancy versus the current `ExistingTaskFact` closed shape can cause false eligibility
  unless resolved in the pure contract first.

## Ready for Proposal

Yes, with the ExistingTaskFact/any-Task occupancy decision made explicit in the proposal. The next
change should specify the injected Admin-gated reader, exact query projections, 200/2,001 bounds,
inclusive keyset cutoff, two-pass retry/convergence behavior, stable errors, PII policy, and no-DML
review-only return. It must preserve remote `0060` and defer execution/approval/ledger/cancellation/
cutover to the successor.
