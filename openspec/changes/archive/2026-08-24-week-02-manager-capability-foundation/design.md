# Design: Manager and Capability Foundation

Add governed `manager` semantics and an explicit, fail-closed capability catalog without replacing roles or RLS. `manager` is storage; `Gerencia` is presentation, while the deterministic persisted description is `Management staff for approvals and operational visibility`.

## Maintainer-authorized contract amendment — 2026-08-21

This packet intentionally stops at Manager persistence, Admin-only assignment, the typed eight-key matrix/evaluator, fail-closed role semantics, and safe Manager route/navigation foundations. `canCapability()` has no production callers. No newly implemented sensitive business action is governed by these keys. Production action/RPC/RLS capability enforcement and audit integration are deferred to `week-02-sensitive-capability-enforcement`; that change must bind every real action to server plus RPC/RLS before delivery. Existing Admin/role route enforcement remains authoritative and is not capability enforcement.

## Technical Approach

Extend role vocabulary, session loader, seed, and identity/RLS migration. Add a typed registry containing eight actions and the matrix below. Keep `requireAdminRole` unless a named seam is migrated. `canCapability` denies unknown keys/roles, inactive sessions, and unmapped combinations.

## Architecture Decisions

| Decision | Choice | Alternatives / rationale |
|---|---|---|
| Role identity | Persist `manager`; render `ROLE_LABELS.manager = "Gerencia"`. | Do not persist the label or rename roles; stable keys drive persistence, sessions, and RLS. |
| Capability model | Static TypeScript union plus explicit `Record<RoleName, readonly CapabilityKey[]>`. | No database matrix or generic RBAC rewrite: bounded and reviewable. |
| Authorization boundary | Existing Admin/role checks precede work; capability action/RPC/RLS binding is deferred to the named follow-up. | Navigation is discoverability, never authorization. |
| Governance | `admin` remains the sole role allowed to mutate `roles` and `profile_roles`. | Manager is never substituted into staff governance, including combined non-Admin roles. |

### Role-to-capability grant matrix

`Grant` is explicit; `—` is deny. The mapping follows Admin governance, Manager approvals, Finance payment/refund, Operations execution, Marketing content, and the advisor discount restriction. Identity merge is human-reviewed and has no Manager grant pending policy.

| Capability | Admin | Manager | Asesor | Operaciones | Finanzas | Marketing |
|---|---:|---:|---:|---:|---:|---:|
| `discount:approve` | Grant | Grant | — | — | — | — |
| `handoff:accept` | Grant | Grant | — | Grant | — | — |
| `payment:verify` | Grant | Grant | — | — | Grant | — |
| `refund:approve` | Grant | Grant | — | — | Grant | — |
| `traveler:sensitive-read` | Grant | Grant | — | Grant | — | — |
| `identity:merge` | Grant | — | — | — | — | — |
| `content:publish` | Grant | — | — | — | — | Grant |
| `incident:escalate` | Grant | Grant | — | Grant | — | — |

No capability is inferred from a role name or combined role.

## Data Flow

`auth.getUser()` → `getAdminSession()` → active roles → `RoleName[]` → server decision → action/RPC → RLS/helper → audit/event.

Preserve the loader’s unknown-role filtering, active-profile check, role-read policy, and Admin-only profile-role writes. The shared protected layout performs generic authentication only. Concrete pages and actions are authoritative for their own role allowlists and reads; authorization must settle before target operations begin. The Admin-only staff UI remains the assignment UI: its role catalog/validation must accept `manager` and display `Gerencia`; server checks and RLS deny Manager assignment mutations.

## Manager Landing and Navigation Contract

The deterministic Manager post-login target is `/admin/dashboard`. A Manager-only session may render only `/admin/dashboard` and `/admin/account`; the shell must not expose staff, catalog, CRM, payments, operations, logs, data-quality, or other links. A combined Manager session retains every existing non-Manager route grant (for example, Manager plus `asesor` retains advisor routes); Manager contributes no unrelated route access. `admin` retains its existing behavior.

The dashboard entry is conditional: its concrete page boundary must authorize the session before starting any dashboard read, then complete every authorized dashboard read, including `getDashboardMetrics()` and `getDuplicateAuditSnapshot()`, without an authorization or data-integrity error. Any failed required read redirects to `/admin/account`, which is the only fallback landing route and must not load dashboard data. Direct requests to every other `/admin/*` route are denied by the applicable concrete page/action boundary before target operations; hidden navigation is never treated as authorization. The login redirect may point to `/admin/dashboard`, but the dashboard page boundary owns the fail-closed redirect. Other protected pages must resolve their existing role allowlist before starting target reads. The prior conservative claim that every non-Admin combined session is limited to dashboard/account is superseded: valid additive combinations retain their existing grants.

The next implementation slice must preserve existing non-Manager route authorization and must not broaden `leads` policies. The verified migration seam is limited to the next local/remote identifier (`0061`), the `roles_name_check` vocabulary, and the `roles staff read` compatibility predicate. `has_role(text)` remains the active-profile/security-definer helper and `is_admin()` remains its `admin` delegate; `roles` and `profile_roles` writes remain Admin-only. Sensitive RPC/table seams are named for the follow-up capability-enforcement change only: `crm_accepted_quote_handoff(uuid)`, payments/payment_methods, operational incident state, and account/lead/quote event/audit tables. No generic capability table/RPC or broad RLS rewrite is in scope.

## File Changes

| File | Action | Description |
|---|---|---|
| `lib/supabase/roles.ts` | Modify | Add `manager` and `Gerencia`; retain additive helpers. |
| `lib/admin/capabilities.ts` | Create | Typed bounded catalog, explicit mappings, fail-closed evaluator. |
| `lib/admin/auth.ts` | Modify | Expose normalized active roles; never grant on partial/unknown data. |
| `components/admin/admin-nav.ts` | Modify | Preserve visibility; no Manager-specific nav/control addition. |
| `db/seed/seed.sql` | Modify | Idempotently seed `manager`. |
| `db/migrations/0061_manager_capability_foundation.sql` | Implemented locally; not applied remotely | Add only the verified role vocabulary, deterministic Manager seed, and existing role-catalog read compatibility predicate. Preserve `leads`, quote, CRM, audit, helpers, and Admin-only writes; production capability action/RPC/RLS enforcement belongs to `week-02-sensitive-capability-enforcement`. |
| `lib/supabase/database.types.ts` | Regenerate after schema verification | Generate and verify `roles.name` remains `string`; CHECK/seed literals cannot become TypeScript literals. Never hand-edit. `RoleName` remains authoritative; captured-type/build checks verify compatibility. |
| `tests/roles-capabilities.test.ts`, admin/RLS tests | Create/modify | Cover matrix, unknown/inactive/combined roles, direct denial, Admin governance, and invariants. |

## Interfaces / Contracts

```ts
export type CapabilityKey =
  | "discount:approve" | "handoff:accept" | "payment:verify" | "refund:approve"
  | "traveler:sensitive-read" | "identity:merge" | "content:publish" | "incident:escalate";
export function canCapability(roles: readonly string[] | null | undefined, key: string): boolean;
```

Unknown strings/roles contribute no grants; combined roles receive only the explicit union. Preserve existing audit payloads/events; add no audit table.

## Testing Strategy

Unit-test the matrix and fail-closed evaluator. Use one executable server/page-boundary test surface with the same production composition seams for dashboard, account, quotes, and staff: prove authorization-before-read, additive Manager+asesor access, Admin-only staff denial, account zero dashboard reads, exactly-once dashboard read families/result reuse, and metric/thrown-read fallback. Contract-test `manager`/`Gerencia`, active profiles, regeneration, Admin mutation, and unchanged Manager UI. SQL/RPC tests cover Manager-only, Manager+asesor, inactive, unknown, and direct denial before mutation/read, preserving CRM, quote, audit, RLS, and `leads`. Playwright evidence is assigned only to tasks 4.2/4.3. Run lint/build and relevant suites; no external traffic.

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable classification, or process-integration boundary; navigation visibility changes do not authorize or alter route handlers.

## Migration / Rollout

After Week 01 remote-history/schema verification and confirmation of the migration ID and sensitive seams, apply the role/catalog migration, regenerate types, run captured-type checks, then deploy. Roll back bounded code/policy additions; do not delete role history, audit rows, or CRM/quote data. Inconsistent migration/type state remains deny-by-default. Tasks, `staff_notifications`, notifications, and generic RBAC/RLS rewriting are deferred.

## Open Questions

- [x] `0061_manager_capability_foundation.sql` is allocated and implemented locally as the bounded role compatibility migration. It is not applied remotely; exact helper, role-policy, `leads`-policy, dashboard-read, and sensitive seams remain recorded above for the named follow-up.
