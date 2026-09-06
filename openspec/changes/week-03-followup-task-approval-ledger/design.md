# Design: Follow-up Task Approval Ledger

## Technical Approach

Keep the classifier and Admin-gated reader unchanged. A server-only adapter validates the closed
preview, reconstructs eligible projections in canonical row order, computes exact UTF-8 SHA-256
values, and invokes one authenticated RPC. The RPC repeats validation, derives the actor, takes the
prescribed request lock, and inserts or replays exactly one immutable
`public.follow_up_task_approvals` row. No child relations, read API, Task DML, remote/database
operation, lifecycle action, Docker setup, or downstream apply is added.

## Architecture Decisions

| Decision | Alternative | Rationale |
|---|---|---|
| One immutable row | Abandoned three-table snapshot | The approved boundary is self-contained, bounded, purge-surviving, and has no child relations. |
| TypeScript plus PostgreSQL validation | Trust one layer | Independent byte and predicate checks prevent transport and serialization drift. |
| RPC-only write | Direct authenticated insert | One transaction owns authorization, replay, conflict, and append-only behavior. |
| Manual local types | Generated or remote-linked types | Current remote state is unknown; the contract must remain local and explicit. |
| Archived PostgreSQL helper | New full-Supabase harness | The approved local proof already provides guarded skip, cleanup, and absence checks. |

## Data Flow

`requireAdminRole(["admin"]) → actor → validate/construct → canonical hashes → RPC → predicates → lock/replay or insert → public decoder`

Authorization occurs before `createClient`, with `p_expected_actor_id=session.user.id`. The RPC
uses the exact UUID-derived advisory lock and returns code-only domain failures. Exact replay returns
the stored row; differing immutable identity fails closed. The adapter maps unexpected SQL/transport
errors to `PERSISTENCE_FAILURE` and exposes no provider text.

The lock remains exactly
`PERFORM pg_catalog.pg_advisory_xact_lock((('x' || pg_catalog.substr(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_request_id::text, 'UTF8'), 'sha256'), 'hex'), 1, 16))::bit(64)::bigint));`
after request validation and cast. Each eligible canonical row emits the exact 14
`FutureFollowUpTask` fields: owner/lead IDs, null quote, `"Follow up with lead"`, due timestamp,
`pending`, deterministic lowercase event idempotency key, `follow_up`, source event ID/type,
source event timestamp/due timestamp, the exact `{followUpAt:row.rawFollowUpAt,hasNote:row.hasNote}`
payload, and the exact five-key metadata. Noneligible rows emit none.

## File Changes

| File | Action | Description |
|---|---|---|
| `db/migrations/0065_follow_up_task_approval_ledger.sql` | Create later | One-row DDL, checks, archived helper, RPC, trigger, RLS, and grants. |
| `lib/admin/follow-up-task-approval.ts` | Create later | Auth-first adapter, canonical projection, strict decoder, and public result. |
| `lib/supabase/database.types.ts` | Modify later | Manually add exact table and RPC contract types; no generation command. |
| `tests/follow-up-task-approval.test.ts` | Create later | RED unit contracts for canonicalization, precedence, replay, and decoding. |
| `tests/follow-up-task-approval-ledger-runtime.test.ts` | Create later | Guarded local PostgreSQL proof using the archived helper. |

## Interfaces / Contracts

Private RPC names are `RpcApprovalSuccess`, `RpcApprovalFailure`, and `RpcApprovalResult`.
Exported public names are `ApprovalSuccess`, `ApprovalFailure`, and `ApprovalResult`; no type-name
collision is permitted. Public fields are camel-cased, include `status:"success"` and the derived
`replayed` flag, and reject extra or missing fields. Provider, malformed, null, array, wrong-type,
SQL, and transport failures become the code-only persistence failure.

## Testing Strategy

Unit RED tests cover the exact predicate order, equations, limits, projection shape, closed unions,
auth-before-client, replay/conflict, and decoder. The runtime proof covers RLS, append-only,
concurrency, purge survival, and zero Task DML. The archived helper must skip before Docker and
finally clean up with post-absence verification.

## Threat Matrix

Routing, VCS/PR automation, and executable classification: N/A. Shell/process integration is
Applicable only to the archived bounded local PostgreSQL helper: skip precedes Docker, cleanup is
mandatory, and absence is checked. SQL/auth/replay integration is Applicable: fixed search path,
grants/RLS, exact lock, closed errors, and zero-row domain failures require RED coverage.

## Migration / Rollout

No migration is applied. Remote state remains unknown. No rollout, Docker setup, lifecycle work,
read API, type regeneration, or database operation is required.

## Open Questions

None.
