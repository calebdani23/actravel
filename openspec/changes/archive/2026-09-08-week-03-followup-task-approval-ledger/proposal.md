# Proposal: Week 03 Follow-up Task Approval Ledger

## Decision

Create exactly one immutable `public.follow_up_task_approvals` row per approval request. It is a purge-surviving, self-contained snapshot of the reader/classifier result: source identifiers, cutoffs, canonical plan, eligible projections, counts, byte lengths, hashes, and actor snapshot. The operation performs no Task, CRM, source, profile, or quote DML.

## Scope and formal boundary

The seven requirements and seven scenarios in `specs/follow-up-task-approval-ledger/spec.md` are normative: exact one-row DDL/check equations; deterministic TypeScript/SQL canonicalization and UTF-8 SHA-256; typed canonical UUID lock/replay; Admin authentication and immutable security; the server adapter’s closed contracts and precedence; bounded local PostgreSQL proof; and manual generated types. No Task DML/read API, downstream apply, correction/parity, automation, SLA, notifications, UI, remote work, rollout, migration application, lifecycle action, Docker setup, or database operation is part of this change.

## Affected files

| File | Action | Responsibility |
|---|---|---|
| `db/migrations/0065_follow_up_task_approval_ledger.sql` | Create later | One-row schema, exact checks, canonical SQL, RPC, trigger, RLS, grants. |
| `lib/admin/follow-up-task-approval.ts` | Create later | Strict decoder, deterministic projection/request construction, auth-first RPC adapter. |
| `lib/supabase/database.types.ts` | Modify later | Manual table and RPC contract updated from migration; never linked `db:types`. |
| `tests/follow-up-task-approval.test.ts` | Create later | Injected adapter, canonical, validation, envelope, authorization RED tests. |
| `tests/follow-up-task-approval-ledger-runtime.test.ts` | Create later | Disposable PostgreSQL RPC/RLS/replay/concurrency proof. |

## Credible work units

1. **Migration + static contract** (estimate 300–450 lines): DDL/checks, canonical helper, RPC, trigger, RLS/grants, static assertions. Roll back by discarding the disposable schema; verify with SQL text/AST and migration application.
2. **Runtime DB proof** (estimate 220–320 lines): guarded Docker lifecycle, two sessions, RLS, replay, concurrent calls, immutability, purge survival, and zero Task DML. Roll back with `cleanupPostgres`; verify container absence.
3. **Adapter + unit tests** (estimate 260–360 lines): exported contracts, strict no-extra-key decoding, canonical vectors, auth/error precedence, and closed results. Roll back by removing the two new files; verify named unit command.
4. **Manual types + type-contract/docs** (estimate 100–160 lines): exact generated-shape additions and documentation assertions. Roll back the type/doc diff; verify `npx tsc --noEmit --incremental false` and type-contract test.

## Acceptance

Identical actor and request fingerprint replay the original row; actor or fingerprint differences fail without mutation. All seven requirement/scenario contracts, byte/hash/count limits, authorization, RLS, append-only, purge-survival, concurrency, zero-Task-DML, type, and closed-response proofs pass locally. Remote state remains unknown and unclaimed.
