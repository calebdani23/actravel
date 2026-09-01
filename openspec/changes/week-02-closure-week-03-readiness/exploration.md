## Exploration: Week 02 closure and Week 03 readiness

### Current State

Week 02 is not honestly complete at the milestone level, although the archived
`week-02-manager-capability-foundation` change is complete within its amended
boundary. The archived packet delivered and verified:

- `manager` / `Gerencia` role vocabulary, normalization, labels, Admin-only
  assignment, and safe Manager navigation/route behavior;
- the typed eight-key capability registry and fail-closed evaluator;
- the narrow local migration `0061_manager_capability_foundation.sql`, which
  expands the role constraint, upserts Manager, and extends the existing role
  catalog read policy without changing `has_role`, `is_admin`, CRM, quote,
  audit, `leads`, or broad RLS behavior;
- focused role, navigation, staff, SQL-contract, lint, build, and isolated
  Playwright evidence. The archive report records 5/5 requirements, 10/10
  scenarios, and 12/12 tasks.

That change explicitly deferred production capability action/RPC/RLS and audit
binding to the named `week-02-sensitive-capability-enforcement` follow-up. It
also explicitly deferred Tasks, `staff_notifications`, notifications, Mi día,
and generic RBAC/RLS rewriting. Therefore `canCapability()` currently has no
production callers and must not be represented as enforcement.

The active Week 02 brief still defines the milestone as Domain Foundation and
requires both a Tasks foundation and a staff-notification foundation (with the
notification split optional if it can safely remain with Tasks). Its completion
gate requires Tasks to represent pending work with owner, due, status, context,
and idempotency, all new tables to have RLS, and existing staff flows to remain
compatible. Week 03 depends specifically on the Tasks foundation and then
requires migration of active follow-ups, SLA projections, idempotent generation,
and a role-aware `Mi día` queue.

Executable reality has no `tasks` or `staff_notifications` table/migration,
module, or first-class task test surface. Follow-ups are still reconstructed
from `lead_events.payload.followUpAt` in `lib/admin/dashboard.ts` and related
CRM code. The dashboard remains a generic operational dashboard rather than a
role-specific work queue. The Manager migration is local only. Read-only
remote migration evidence shows production history through the equivalent of
local `0060`, with no remote `0061`; the remote table listing was unauthorized,
so current remote schema/RLS parity is not proven.

The worktree contains the archived packet and the existing Week 02 changes as
uncommitted state, plus preserved Week 01 recovery adapters and other known
unrelated paths. This exploration does not authorize touching any of them.

#### Mandatory closure versus deferrable work

| Item | Before Week 02 can close | Before Week 03 can begin | Authority/disposition |
|---|---:|---:|---|
| Manager foundation | Complete | No further work | Archived and verified |
| `tasks` schema/foundation with RLS, ownership, status, context, due, idempotency | Yes | Yes | Explicit Week 02 gate and Week 03 dependency |
| `staff_notifications` foundation with RLS | Yes for literal Week 02 completion; can remain in the Tasks packet | No, unless the chosen Tasks design depends on it | Week 02 primary work; suggested split only if unsafe to keep together |
| Follow-up migration/automation and SLA projections | No | No; this is Week 03 work | Explicit Week 03 primary work |
| `Mi día` role-aware UI/queue | No | No; this is Week 03 work | Explicit Week 03 primary work |
| Production capability action/RPC/RLS/audit binding | No for this foundation; named future change | No roadmap dependency for Week 03 | Explicitly deferred by archived amendment/spec |
| Applying `0061` remotely | Not a prerequisite to the archived change’s disposition | Not a product prerequisite, but migration history/schema reconciliation is required before allocating another migration | ACTIVE.md forbids automatic application; Gate 0 requires read-only reconciliation |
| Generic RBAC/RLS rewrite, portal, Trips, finance, etc. | No | No | Explicit non-goals |

The narrow decision for the proposal phase is whether `staff_notifications`
ships in the same schema foundation as `tasks` (the safer default because the
Week 02 brief names both and the technical blueprint places both in
`modules/tasks`) or is explicitly recorded as a separate bounded child. A
Tasks-only implementation would make Week 03 technically startable but would
not support an honest literal Week 02 closure without a documented amendment.

### Affected Areas

- `db/migrations/` — add the next safely allocated migration for `tasks` and,
  if retained in this packet, `staff_notifications`; both require explicit RLS,
  indexes/constraints, and idempotency-safe contracts.
- `lib/admin/` and a future `modules/tasks/` boundary — introduce the smallest
  task domain/types/repository seam without replacing existing compatibility
  façades in Week 02.
- `lib/admin/dashboard.ts` and `app/admin/(protected)/dashboard/page.tsx` —
  current follow-up reconstruction and generic dashboard are the consumers to
  preserve now and evolve only in Week 03; do not claim them converted during
  closure.
- `app/admin/(protected)/leads/[id]/actions.ts` and related CRM tests — current
  `followUpAt` event writes are the source contract for the Week 03 migration;
  closure should preserve history and define, but not yet execute, conversion.
- `types/supabase.ts` or the repository’s generated-type path — regenerate and
  verify only after migration/schema alignment; do not hand-edit generated
  output.
- `tests/` — add migration/constraint/RLS contracts, task status/ownership/
  idempotency tests, and notification visibility tests. Week 03 will add
  automation, SLA, and queue behavior tests.
- `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md`
  — required only during implementation/closure, not in this exploration;
  they must reconcile the chosen Week 02 boundary and remote migration
  disposition.
- `openspec/changes/archive/2026-08-24-week-02-manager-capability-foundation/`
  and `openspec/specs/manager-capability-authorization/spec.md` — authority
  for what the Manager packet did and did not deliver; do not modify them.

### Approaches

1. **Combined Week 02 foundation (recommended if it fits the review budget)** —
   add `tasks` and `staff_notifications` schema/RLS/idempotency foundations in
   one independently reviewable change, with no automation or Mi día UI.
   - Pros: satisfies the literal Week 02 completion gate; leaves Week 03 a
     clean consumer/automation phase; keeps notification ownership with the
     technical `modules/tasks` boundary.
   - Cons: migration/RLS review is larger; migration-number reconciliation is
     a hard prerequisite; likely needs stacked delivery slices under 800
     authored lines.
   - Effort: High

2. **Tasks foundation only, notification child** — implement the minimum Tasks
   table/RLS/idempotency contract now and create a separately reviewable
   notification foundation child before declaring Week 02 closed.
   - Pros: smallest technical prerequisite for Week 03; lower first-slice
     blast radius and clearer rollback boundary.
   - Cons: Week 02 remains open between slices; notification semantics may need
     coordination with task ownership and read policies; requires an explicit
     closure decision rather than silently treating the week as complete.
   - Effort: Medium, then Medium

3. **Capability enforcement before Tasks** — implement the named sensitive
   capability action/RPC/RLS/audit follow-up first.
   - Pros: closes an explicit future authorization gap.
   - Cons: not a Week 03 dependency; increases security/RLS blast radius; does
     not satisfy the missing Tasks foundation; contradicts the current
     dependency order and should not block task readiness.
   - Effort: High

### Recommendation

Use this change as a bounded Week 02 closure/readiness packet centered on the
Tasks foundation and its RLS/idempotency contract, keeping notification
foundation in the same packet only if the design remains within the 800-line
review budget. Forecast two stacked slices: (1) migration/schema/types/RLS and
focused contracts, then (2) notification table/read contracts and integration
evidence if needed. If the combined packet forecasts above the budget, use the
Tasks slice as the first child and make the notification slice an explicit
Week 02 closure blocker rather than deferring it silently.

Do not include follow-up conversion, task automation, SLA calculations,
role-specific Mi día UI, or sensitive capability enforcement. Week 03 should
start only after the task schema is applied/rehearsed or its approved local
equivalent is evidenced, its RLS contracts pass, and the migration path is
resolved.

Before any implementation proposal allocates a migration, perform read-only
Gate 0 evidence: local inventory/checksums, remote migration history, remote
schema/RLS/helper metadata, and classification of local-pending/remote-only
items. The observed remote history currently lacks `0061`, but the unauthorized
schema listing means that migration history alone cannot prove the role-table
state. Do not apply `0061`, create a presumed `0062`, or mutate Supabase in
this phase.

### Risks

- **Authority contradiction:** the Week 02 brief requires Tasks and
  notifications, while the archived Manager amendment and current ACTIVE.md
  describe them as deferred. Proposal must resolve this by treating the
  foundation packet as the remaining closure work, not by reopening the
  archived Manager packet.
- **Migration sequencing:** local `0061` is pending remotely and remote naming
  is not identical to local filenames. A new migration identifier cannot be
  safely chosen until authorized remote history/schema evidence is available.
- **RLS/data integrity:** new tables must ship with owner/context policies and
  adversarial denial tests; UI visibility cannot substitute for RLS.
- **Idempotency ambiguity:** task generation keys and completion/audit outcome
  semantics must be fixed before Week 03 automation, or duplicate work and
  false SLA state can result.
- **Legacy follow-up drift:** existing `lead_events` history and
  `followUpAt`-based dashboard behavior must remain intact during later task
  conversion; closure must not perform an unsafe backfill.
- **Review budget:** combined Tasks plus notification schema/RLS/tests likely
  exceeds a single comfortable 800-line review unless deliberately sliced.
- **Environment:** remote schema inspection and disposable PostgreSQL/rehearsal
  evidence are currently incomplete; local migration application was already
  unavailable and must not be implied as passed.

### Ready for Proposal

Yes, after one narrow maintainer decision: confirm that the remaining Week 02
closure packet owns both `tasks` and `staff_notifications`, or explicitly
approve a two-child closure sequence. The proposal should reserve the first
slice for read-only migration reconciliation and the Tasks schema/RLS contract,
state that `0061` remains unapplied unless separately authorized, and define
Week 03 entry as dependent on verified Tasks foundation evidence rather than on
capability enforcement, follow-up migration, or Mi día UI.
