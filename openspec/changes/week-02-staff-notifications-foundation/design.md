# Design: Staff Notifications Foundation

Persistence-only ledger; delivery, automation, UI, generic RBAC, audit, and remote application are
out of scope.

## Technical Approach

After read-only Gate 0/dependency reconciliation, allocate a migration after reconciled
`0062_tasks_foundation.sql`. Transaction creates the table, constraints, indexes, RLS, and two
RPC seams. Generated types and typed adapter follow existing factories without changing auth.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Record contract | `staff_notifications(id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete restrict, kind text not null check (kind in ('task','quote','system')), title text not null, body text not null, quote_id uuid references public.quotes(id) on delete set null, task_id uuid references public.tasks(id) on delete set null, read_at timestamptz, idempotency_key text not null, created_at timestamptz not null default now())`; checks require `char_length(trim(title)) between 1 and 200`, `char_length(trim(body)) between 1 and 2000`, and `idempotency_key ~ '^[0-9a-f]{64}$'`. Indexes: `staff_notifications_recipient_created_idx (recipient_id, created_at desc, id desc)`, partial `staff_notifications_unread_idx (recipient_id, created_at desc, id desc) where read_at is null`, and partial non-null `quote_id`/`task_id` indexes; unique `(recipient_id, idempotency_key)`. | Bounded immutable content and nullable context preserve readable history. `created_at` is UTC `timestamptz`; no sender or JSON. |
| Live context | At creation, task context is valid exactly when `exists (select 1 from public.tasks t where t.id = p_task_id and t.status <> 'canceled')`; quote context exactly when `exists (select 1 from public.quotes q join public.leads l on l.id=q.lead_id join public.contacts c on c.id=q.contact_id where q.id=p_quote_id and q.deleted_at is null and l.deleted_at is null and c.deleted_at is null)`. | These are the repository’s live predicates; `SET NULL` later never hides history. |
| Privileges/RLS | `revoke all on table ... from public, anon, authenticated, service_role; grant select ... to authenticated`. RLS has only authenticated recipient `SELECT`, `auth.uid() = recipient_id and exists active profile`; no mutation policies or grants. | Recipient-only read; mark-read is the sole update seam. |
| Trusted seam | `create_staff_notification(p_recipient_id uuid, p_kind text, p_title text, p_body text, p_quote_id uuid, p_task_id uuid, p_idempotency_key text) returns public.staff_notifications`; `mark_staff_notification_read(p_notification_id uuid) returns public.staff_notifications`. Both are `SECURITY DEFINER`, owned by `postgres`, `set search_path = public`; exact-signature `REVOKE ALL` precedes `GRANT EXECUTE` only to `service_role` (create) or `authenticated` (mark). Create requires `auth.role() = 'service_role'`; mark requires `auth.role() = 'authenticated'`, active `auth.uid()`, and recipient match, then sets `read_at = coalesce(read_at, now())`. Both return the stored row. | The shared `service_role` RPC is the designated trusted seam; it cannot distinguish service principals and grants no broader service authority. Existing auth/session behavior remains unchanged. |
| Errors | `SN001`/`STAFF_NOTIFICATION_UNAUTHENTICATED`, `SN002`/`STAFF_NOTIFICATION_INVALID_ARGUMENT`, `SN003`/`STAFF_NOTIFICATION_FORBIDDEN`, `SN004`/`STAFF_NOTIFICATION_CONTEXT_INVALID`, `SN005`/`STAFF_NOTIFICATION_IDEMPOTENCY_CONFLICT`; adapter maps unknown SQLSTATE to `STAFF_NOTIFICATION_UNKNOWN` and never exposes raw detail. | This mapping covers SQL and adapter behavior. Mark’s nonexistent, non-recipient, inactive, unknown, anonymous, and service-role cases all return `SN003` with no disclosure. |
| Idempotency | Caller key is deterministically `hex(SHA-256(UTF-8("staff-notification:v1|recipient=" + lowercase UUID + "|kind=" + kind + "|title=" + normalized title + "|body=" + normalized body + "|quote=" + (lowercase UUID or "null") + "|task=" + (lowercase UUID or "null"))))`; normalization is exactly `trim` for title/body and no kind case conversion. The RPC requires that exact 64-char lowercase key. Unique `(recipient_id,idempotency_key)`, atomic `ON CONFLICT DO NOTHING RETURNING`, then `FOR UPDATE` comparison of every immutable input gives exact replay; any difference raises `SN005` without mutation. | Canonical bytes make retries deterministic, while the unique constraint makes concurrent replay safe. |

## Data Flow

`typed service adapter → service-role create RPC → ledger`; `typed server adapter → RLS SELECT`.
`typed server adapter → authenticated mark-read RPC → recipient-only update`.

## File Changes

| File | Action | Description |
|---|---|---|
| `db/migrations/<next>_staff_notifications_foundation.sql` | Create | Table, FKs, checks, indexes, grants, RLS, RPCs. |
| `lib/supabase/{admin,server,client}.ts` | Modify if required | Add `Database` generics only; preserve existing keys, cookies, and session behavior. |
| `lib/supabase/database.types.ts` | Modify | Add table plus exact `Functions` signatures/returns; generate from candidate, not remote. |
| `lib/admin/staff-notifications.ts` | Create | Normalization/keying, typed RPC adapters, stable error fallback. |
| `tests/staff-notifications-*.test.ts` | Create | Contract, RLS/RPC, race/replay, history, type, and adapter tests. |

## Testing Strategy

Static tests assert each default/check/FK/on-delete/index/unique/grant/policy/function contract.
Shadow runtime tests cover unauthorized and nonexistent behavior, active recipients,
context predicates, exact replay, concurrent conflict, mark-read idempotence, and deletion history;
type assertions compile all factories/adapters. Run existing auth/CRM/quote/Tasks regressions too.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable classification, or process-integration boundary.

## Migration / Rollout

Gate 0 must capture local inventory/checksums and remote migration history/schema read-only,
then reconcile archived Harness and Tasks evidence. Apply the candidate once to a
disposable shadow containing migrations through `0062` plus the candidate; remote mutation is
prohibited. Require independent `sdd-verify`, bounded native review, post-apply approval, and archive
before Week 02 closure. No backfill or feature flag.

## Open Questions

- [ ] Allocate `<next>` only after reconciliation passes; otherwise readiness is denied.
