# Exploration: week-03-followup-task-approval-ledger

## Current-state analysis

1. The local Week 03 foundation is deliberately split between a pure classifier and an
   Admin-gated reader.
2. `classifyFollowUpBackfillPreview` performs no I/O or DML.
3. It returns the canonical ten-value plan, ordered nine-value rows, seven counts,
   eligible future-Task projections, canonical bytes, and a lowercase SHA-256 hash.
4. `readFollowUpBackfillPreview` obtains fixed event and Task cutoffs.
5. It reads bounded pages and joins, converges digest passes, and returns only the
   reader snapshot, cutoffs, plan, and safe diagnostics.
6. The classifier and reader are upstream contracts and are not changed here.
7. The relevant bounds remain 2,000 input/canonical rows.
8. Each canonical row is at most 512 UTF-8 bytes.
9. The static header/count/constants portion is at most 4,096 bytes.
10. Serialized canonical plan bytes are at most 1 MiB.
11. Projection items and aggregate limits remain the values fixed by the specification.
12. Existing Task queries include every Task for occupancy.
13. Only complete follow-up representations become existing Task facts.
14. This approval operation must not create, update, delete, or convert a Task.

## Existing repository and environment

15. Local migration history contains the preceding follow-up foundation, including `0064`.
16. The current remote migration and schema state is unknown.
17. Archived evidence is not current remote parity and must not be inferred as such.
18. No remote inspection, migration application, database operation, rollout, or production
   readiness claim belongs to this change.
19. Existing audit tables do not provide the required immutable snapshot boundary.
20. The archived PostgreSQL helper is the approved bounded local proof mechanism.
21. Its guarded command skips before Docker and checks cleanup/post-absence when run.
22. The proof must preserve RLS, replay, concurrency, append-only, purge survival, and
   zero-Task-DML assertions without requiring remote access.

## Correction to the abandoned design direction

23. The earlier three-table approach is explicitly superseded.
24. `follow_up_approval_headers`, `follow_up_approval_items`, and
   `follow_up_approval_projections` are not part of the approved design.
25. There are no child relations, child foreign keys, or separate projection rows.
26. The full-Supabase/generated-types approach is also explicitly superseded.
27. The migration remains a planned artifact only; it is not applied by this correction.
28. Types are added manually to the local `database.types.ts` contract when implementation
   is authorized.
29. No type-regeneration command or linked remote generation is in scope.
30. No read API is added; the write adapter and local proof are the bounded work.
31. No Task DML or downstream apply is included.

## Recommended representation

32. Create exactly one immutable `public.follow_up_task_approvals` row per request.
33. The row is self-contained and purge-surviving.
34. It stores actor snapshot, request identity, schema/rule versions, paired cutoffs,
   reader and canonical hashes, canonical plan, eligible projections, seven counts,
   byte lengths, and creation time.
35. It stores no PII and has no foreign keys to purgable source, CRM, profile, or Task data.
36. `request_id` is the unique replay key.
37. Exact identity replay returns the original row.
38. Any differing immutable identity returns `APPROVAL_IDEMPOTENCY_CONFLICT` without mutation.
39. Append-only triggers reject UPDATE and DELETE.
40. RLS permits Admin reads only; the authenticated RPC is the sole write boundary.
41. The RPC validates the closed request, derives the actor from `auth.uid()`, repeats
   the required predicates, locks the UUID-derived advisory key, and inserts once.
42. Domain failures return code-only JSON and write zero rows.
43. Unexpected SQL or transport failures map to `PERSISTENCE_FAILURE` in the adapter.
44. The adapter authorizes before client construction and preserves authorization throws.
45. Type names distinguish private RPC decoding from the exported public result:
   `RpcApprovalSuccess`, `RpcApprovalFailure`, private `RpcApprovalResult`, and exported
   `ApprovalSuccess`, `ApprovalFailure`, and `ApprovalResult`.

## Affected implementation boundaries

46. The planned migration contains one table, exact checks, immutable enforcement, RLS,
   grants, the archived helper, and the bounded approval RPC.
47. The server-only adapter reconstructs projections in classifier order and computes the
   exact canonical UTF-8 hashes before invoking the RPC.
48. `database.types.ts` receives manual table and RPC Args/Returns `Json` entries only.
49. Focused unit tests cover canonicalization, limits, authorization, replay, closed
   envelopes, privacy, and absence of Task DML.
50. The guarded local runtime proof covers the PostgreSQL helper, RLS, replay, concurrency,
   append-only behavior, purge survival, and zero Task DML.
51. Upstream classifier, reader, representation, and Tasks contracts remain unchanged.
52. Later apply, correction/parity, automation, SLA, notifications, UI, and lifecycle work
   are deferred to separately authorized changes.

## Four work units

53. Work unit 1 is the one-row migration and static contract.
54. Work unit 2 is the guarded local PostgreSQL runtime proof using the archived helper.
55. Work unit 3 is the server adapter and focused unit tests.
56. Work unit 4 is manual local types and type-contract/documentation assertions.
57. These four units match the approved proposal and do not imply execution now.

## Recommendation

58. Proceed only with the exactly-one-row immutable approval ledger described above.
59. Keep canonical validation duplicated at the TypeScript and PostgreSQL boundaries.
60. Keep the RPC authenticated, `SECURITY DEFINER`, tightly granted, and append-only.
61. Preserve the local-only, unknown-remote-state gate.
62. Do not add child relations, a read API, a type-generation command, Task DML, or
   remote/database operations.
63. The design is ready for parent review and later implementation planning, subject to
   the parent restaging the corrected artifacts.

## Contract invariants carried forward

64. The request UUID remains lowercase canonical text with cast/text equality.
65. The actor is derived from the authenticated session and is never trusted from a client.
66. The seven named counts and total/row/projection relationships remain exact.
67. Canonical plan, projection, and request hashes are computed from exact UTF-8 bytes.
68. The signed 64-bit advisory lock continues to use the first 16 SHA-256 hex characters.
69. Exact replay compares all immutable stored values, not only the request fingerprint.
70. Conflicting replay never replaces or updates the original snapshot.
71. Every domain predicate runs before the single insert and writes zero rows on failure.
72. Typed UUID transport failures remain adapter persistence failures, not SQL domain branches.
73. RLS and grants expose no direct authenticated insert, update, or delete path.
74. Append-only enforcement applies regardless of the database role used for a mutation.
75. Snapshot identifiers remain free of foreign keys so source purge cannot rewrite the row.
76. The public result is camel-cased; the private RPC result remains fully snake-cased.
77. `RpcApprovalSuccess` and `RpcApprovalFailure` cannot collide with public result names.
78. The manual type boundary records RPC arguments and returns as the approved local contract.
79. The runtime proof is local evidence only and cannot establish remote parity.
80. Parent review must restage all three corrected artifacts before any implementation work.
