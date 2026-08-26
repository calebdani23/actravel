## Exploration: Week 02 Manager and Capability Foundation

### Current State
AC Travel already has five staff roles (`admin`, `asesor`, `operaciones`, `finanzas`, and `marketing`) represented in `lib/supabase/roles.ts`, the `roles` table constraint, admin navigation filters, and `public.has_role`-based RLS. Staff sessions load active profiles and role rows, while route authorization uses `requireAdminRole` and UI navigation uses role allowlists. There is no Manager/Gerencia role or TypeScript capability registry; sensitive actions therefore remain expressed through broad role checks. The Week 01 baseline is complete, and Week 02 is planning-only.

### Affected Areas
- `lib/supabase/roles.ts` — extend role vocabulary and establish the capability registry/type-level contract without breaking existing role helpers.
- `lib/admin/auth.ts` — preserve current active-profile and multirole session behavior while exposing the smallest capability-aware authorization seam.
- `components/admin/admin-nav.ts` and `components/admin/admin-shell.tsx` — keep existing role-based navigation compatible; capability filtering must not become cosmetic authorization.
- `db/migrations/0002_identity.sql` and later identity/RLS migrations — add Manager role data compatibility and targeted authorization support without rewriting all existing policies.
- `tests/` role/navigation/auth coverage — prove Manager recognition, multirole combinations, unknown-role handling, and sensitive capability decisions.
- `openspec/changes/week-02-manager-capability-foundation/` — this exploration artifact only; proposal, specs, design, and tasks are intentionally not created.

### Approaches
1. **Bounded Manager/capability slice (recommended)** — add Manager/Gerencia semantics, a typed TypeScript capability registry, and only the targeted checks needed for newly sensitive actions. Preserve existing role/RLS contracts and defer Tasks/notifications to a separately reviewable Week 02 change.
   - Pros: smallest safe authorization change; aligns with the Blueprint's “no big-bang” rule; independently testable and reviewable; avoids coupling new task tables to an unfinished capability model.
   - Cons: Week 02 requires a follow-on task-schema foundation change before the full milestone outcome is complete.
   - Effort: Medium

2. **Combined domain foundation** — implement Manager, capability registry, modular boundaries, `tasks`, `staff_notifications`, RLS, and idempotency contracts in one change.
   - Pros: delivers the whole primary-work list in one packet; capability decisions are available immediately to task ownership and notification behavior.
   - Cons: oversized and tightly coupled; increases migration/RLS/test blast radius; conflicts with the repository rule that a week is not one giant change; makes rollback and review less granular.
   - Effort: High

### Recommendation
Use `week-02-manager-capability-foundation` for the first Week 02 change. Its exact boundary is role semantics plus a typed, centralized capability contract and safe route/assignment foundations; production capability action/RPC/RLS enforcement seams belong to the named follow-up `week-02-sensitive-capability-enforcement`. It must not migrate every existing RLS policy or introduce task/notification tables. Plan `week-02-task-schema-foundation` as the next independently reviewable change, keeping `staff_notifications` with Tasks unless schema or ownership constraints prove that split unsafe. This preserves current multirole behavior, treats RLS as authoritative, and leaves the physical `leads` table unchanged.

### Business Scope Summary
- **Business problem:** Managers need governed visibility and approval authority, while staff actions need explicit capability semantics instead of increasingly broad role checks.
- **Target users:** Admins who govern access; Managers who approve or handle exceptions; existing Advisors, Operations, Finance, and Marketing staff whose current access must remain compatible.
- **First-slice boundaries:** Manager role recognition in application/database contracts; typed capability names and role-to-capability mapping; targeted server/RPC authorization seam; focused tests and documentation of preserved contracts.
- **Non-goals:** Tasks, staff notifications, Mi día, follow-up migration, portal, Trips, Finance redesign, generic permissions/RBAC rewrite, physical rename of `leads`, MFA/session redesign, or implementation changes in this exploration phase.
- **Key business rules:** Staff may hold multiple roles; access, edit, approve, and delete are distinct capabilities; exceptional discounts and other sensitive actions require Manager/Admin authority and audit; UI hiding never substitutes for RLS; existing role/RLS behavior remains compatible.
- **Edge cases:** Manager combined with other roles; inactive profiles; empty or unknown persisted role names; legacy rows during migration; navigation showing a link that the server must still deny; capability checks that must not accidentally grant authority through a broad role fallback.
- **Dependencies:** Week 01 baseline gates; current `profiles`/`roles`/`profile_roles` schema and `has_role`; current session loader and route guards; existing migration/type-generation discipline; adversarial authorization tests. Remote schema reality must be checked before implementation.
- **Open product decisions:** Exact Manager label/storage value (`manager` versus a localized variant); initial capability catalog and which actions are enforced in this slice; whether Manager can administer staff roles; whether capability mappings are static TypeScript only or mirrored in database/RPC policy; audit event shape for approvals.

### Risks
- Adding Manager to TypeScript without a coordinated database constraint/seed/RLS contract can leave login, navigation, and authorization inconsistent.
- A capability registry that silently becomes a generic permissions rewrite would exceed Week 02 and create broad regression risk.
- Static capability checks cannot replace database enforcement for sensitive mutations; targeted RPC/RLS boundaries must remain explicit.
- Existing dirty state includes `docs/about/helps/intakes/image.png` and unrelated untracked Week 01 recovery artifacts; implementation must not touch or stage them.

### Ready for Proposal
Yes — proposal can be created for `week-02-manager-capability-foundation` with the bounded authorization scope above. The proposal should explicitly record the follow-on `week-02-task-schema-foundation` change and resolve the Manager storage/value and first capability catalog decisions before implementation.
