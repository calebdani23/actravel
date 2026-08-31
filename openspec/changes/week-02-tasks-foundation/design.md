# Design: Tasks Foundation

This is an independently verifiable Tasks ledger only. Notifications, UI, audit, CRM changes,
linked/production mutation, and service-created Tasks remain out of scope.

## Technical Approach

After Gate 0, apply one fresh migration in a disposable shadow, after `0061` exactly once. It
creates `public.tasks`, nonrecursive authorization, two authenticated-human RPCs, and read-only
RLS. The dependency is the archived Gate 0 packet/spec at
`openspec/changes/archive/2026-08-26-week-02-gate0-shadow-harness/`.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Record | `owner_id`, nullable `lead_id`/`quote_id`, required bounded `description`, UTC `due_at`, status, deterministic key, and timestamps. Exactly one live context is required at creation; both FKs are `ON DELETE SET NULL`. | Uses only proposal/spec fields; preserves historical context after deletion. No `title`, DELETE, or extra audit schema. |
| Replay | Normalize owner/context/description/due date, derive lowercase `sha256('tasks:v1|owner=' || owner || '|context=' || context)` (64 hex), unique on `(owner_id,idempotency_key)`. In one transaction: `INSERT ... ON CONFLICT DO NOTHING RETURNING`; if no row is returned, `SELECT ... FOR UPDATE` the winner, compare the complete canonical payload and live context, return it only on an exact match, otherwise raise `TASK_IDEMPOTENCY_CONFLICT`. | The unique insert is race-safe; an absent row is never claimed to be lockable. |
| Authority | Active owner manages own; Admin manages all; Manager manages active non-Admin-owned tasks; Admin-owned tasks are Admin-only. | One helper is reused by RPCs and RLS, so decisions are identical. |

## SQL, Interfaces, and Error Contract

`tasks` has `id`, `owner_id`, `lead_id`, `quote_id`, `description text NOT NULL` (1–2000
characters), `due_at`, `status` (default `pending`, one of
`pending|in_progress|completed|canceled`), `idempotency_key`, `created_at`, and `updated_at`.
`owner_id` references `profiles` with `ON DELETE RESTRICT`; context FKs use `ON DELETE SET NULL`.
Creation accepts `(owner_id, lead_id, quote_id, description, due_at)` and returns `public.tasks`;
transition accepts `(task_id, target_status)`.

Canonicalization trims description, rejects empty/over-limit content, lowercases UUID text,
requires exactly one context, and converts `due_at` to a UTC instant formatted with six
fractional digits. The server adapter performs the same checks and passes typed RPC arguments.

Validation/authorization errors are stable SQLSTATE mappings: `PT001` `TASK_UNAUTHENTICATED`
(no human identity); `PT002` `TASK_INVALID_ARGUMENT` (owner, description, due_at, status, or
context argument); `PT003` `TASK_FORBIDDEN` (inactive/unknown actor, owner, or role); `PT004`
`TASK_CONTEXT_INVALID` (missing/non-live lead or quote); `PT005`
`TASK_IDEMPOTENCY_CONFLICT` (winner payload differs or context is stale); `PT006`
`TASK_INVALID_TRANSITION` (disallowed/terminal transition). Adapters map codes, never database
messages.

Every `SECURITY DEFINER` helper/RPC is owned by `postgres`, declares exactly
`SET search_path = public`, and has `REVOKE ALL ON FUNCTION <exact signature> FROM PUBLIC, anon,
authenticated, service_role; GRANT EXECUTE ON FUNCTION <exact signature> TO authenticated`.
Thus `task_actor_can_manage(uuid)`, `create_task(uuid,uuid,uuid,text,timestamptz)`, and
`task_transition(uuid,text)` are executable only by `authenticated`; `anon` and `service_role`
receive no execute. Table DML is revoked from `PUBLIC, anon, authenticated, service_role`; only
`authenticated` gets `SELECT`, through the RLS read policy. Thus service-role Task creation is
disabled by grants, not by RLS bypass behavior.

## File Changes

| File | Action | Description |
|---|---|---|
| `db/migrations/<next>_tasks_foundation.sql` | Create | Table, RPCs, helper, RLS, indexes, grants. |
| `lib/admin/tasks.ts` | Create | Validation and typed RPC adapters. |
| `lib/supabase/database.types.ts` | Modify | Retain only exact additive Tasks-generated definitions from local schema generation; all pre-existing definitions and unrelated bytes remain unchanged. |
| `tests/tasks-foundation-contract.test.ts`, `tests/tasks-rls.test.ts`, `tests/tasks-runtime.test.ts` | Create | SQL, grants, replay, lifecycle, authorization, and preservation tests. |

## Testing and Preservation Gates

RED coverage includes canonicalization, concurrent insert/replay/conflict, all authorization
cells, service denial, history after context deletion, transitions, terminal immutability, and
DELETE denial. Independent verification checks the ledger/catalog, schema, FKs/checks/indexes,
function signatures, fixed search paths, owners/grants/policies, exact additive generated types,
and clean shadow teardown. Exactly-once shadow migration, external bounded review, and post-apply
approval are separate gates.

Preserve Manager auth seams, physical leads, follow-up/dashboard behavior, quotes, audit, physical
data, intake image, generated pre-existing definitions, and unrelated state. No linked/production
mutation is allowed.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable classification, or process-integration boundary.

## Migration / Rollout

Keep `0061` unapplied remotely; allocate the new migration only after Gate 0 and exact-once
shadow checks. Local readiness is distinct from production readiness. No remote application is
authorized; pre-publication rollback removes only child artifacts, and post-publication changes
are reviewed fix-forward.

## Open Questions

- [ ] Allocate the migration number after Gate 0 passes.
