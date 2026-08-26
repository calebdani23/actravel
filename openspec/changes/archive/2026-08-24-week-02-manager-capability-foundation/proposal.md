# Proposal: Manager and Capability Foundation

## Intent

Give Gerencia governed visibility and approval authority while establishing explicit, fail-closed capability semantics. This is a foundation only; no newly implemented sensitive business action is governed by the registry in this slice.

## Maintainer-authorized contract amendment — 2026-08-21

The implemented foundation is the source of truth for this bounded change: Manager persistence, Admin-only assignment, the typed eight-capability registry/evaluator, fail-closed role semantics, and safe Manager route/navigation foundations. `canCapability()` has no production callers in this slice. Production action/RPC/RLS capability enforcement and associated audit integration are deferred to `week-02-sensitive-capability-enforcement`, which must bind each real action to server plus RPC/RLS enforcement before delivery. Existing Admin/role route enforcement remains authoritative and is not capability enforcement.

## Scope

### In Scope
- Add persisted role `manager` (label `Gerencia`) without breaking active-profile or multirole behavior.
- Define a typed registry for blueprint-sensitive actions: discount approval, handoff acceptance, payment verification, refund approval, sensitive traveler read, identity merge, content publish, and incident escalation.
- Add the typed registry/evaluator and preserve authoritative existing server/RLS seams; test unknown, inactive, and combined-role denial without claiming production capability callers.

### Out of Scope
- Tasks, `staff_notifications`, Mi día, task generation/idempotency, and notification delivery; these belong to `week-02-task-schema-foundation`.
- Generic RBAC/RLS rewrite, MFA/session redesign, Portal, Trips, Finance redesign, or physical rename of `leads`.
- New audit schema; preserve existing audit/event contracts.

## Capabilities

### New Capabilities
- `manager-capability-authorization`: Manager semantics, typed registry, role mapping, and fail-closed evaluation foundation.

### Modified Capabilities
- None.

## Approach

Use `manager` as the stable identifier and `Gerencia` as its label, matching current role conventions. Keep definitions static and typed in TypeScript; extend role compatibility/RLS only at newly sensitive seams. Admin retains user/access governance; Manager does not administer staff roles. Existing checks remain until explicitly replaced.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/supabase/roles.ts`, `lib/admin/auth.ts` | Modified | Role vocabulary, registry, and session seam. |
| `components/admin/admin-nav.ts` | Modified | Capability-aware visibility; never authorization. |
| `db/migrations/*` identity/RLS | Modified | Manager compatibility only; preserve `leads`; capability enforcement is deferred. |
| `tests/` | Modified | Role, multirole, inactive, unknown, and denial contracts. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| App/database role drift | Med | Expand contracts together; verify migration/type/RLS reality first. |
| Registry becomes generic RBAC | Med | Limit it to blueprint actions and named seams. |
| UI implies authority | Low | Require server checks, RLS, and adversarial denial tests. |

## Rollback Plan

Revert the bounded slice: remove Manager migration/policy additions and the capability seam, restore prior checks/navigation, and leave existing roles, RLS, audit history, and `leads` data untouched. No destructive cleanup or history repair.

## Dependencies

- Week 01 gates; current `profiles`/`roles`/`profile_roles`/`has_role` contracts.
- Generated types, migration discipline, session loader, navigation, and authorization tests.
- Fresh remote schema/migration verification before implementation.

## Success Criteria

- [x] `manager`/`Gerencia` is consistent across TypeScript, persistence, sessions, and existing authoritative role authorization.
- [x] The registry distinguishes access, edit, approve, and delete without broad fallback grants.
- [x] Existing roles/multirole flows remain compatible; inactive and unknown roles fail closed.
- [x] Sensitive capability enforcement is explicitly deferred to the named follow-up, which must bind server/RPC/RLS and audit contracts; this foundation records the matrix and denial contract only. Tasks/notifications are absent.
