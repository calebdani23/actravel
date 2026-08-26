# Tasks: Manager Capability Foundation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 650–800 authored lines |
| Dominant risk | Migration/RLS seam discovery plus cross-surface Admin staff compatibility |
| 400-line budget | Exceeds 400; likely within the cached 800-line budget |
| Chained PRs recommended | Yes — independent rollback and high authorization-review burden |
| Proposed slices | PR 1 discovery/contracts; PR 2 role/capability/navigation; PR 3 staff/Admin surface; PR 4 migration/RLS and verification |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No — maintainer selected stacked-to-main for this retry
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| 1 | Verify local/remote seams and freeze contracts | Read-only migration/RPC evidence checks | Supabase metadata/history inspection; N/A for app runtime | Planning evidence only; no migration file |
| 2 | Add role, eight-capability matrix, safe Manager navigation, and production page compositions | `node --conditions react-server --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts` | Executable production dashboard/account/quotes/staff composition harness; no browser proof | Role/catalog/nav and minimal page-composition files only |
| 3 | Extend Admin-only Manager assignment | `npm run test:staff-admin` | Server/page harness only; browser proof is exclusively assigned to tasks 4.2/4.3 | Staff validation/view/forms/actions only |
| 4 | Verify the bounded role migration and foundation contracts | `npm run lint && npm run build` plus static SQL/role suites | Production capability action/RPC/RLS enforcement is deferred to `week-02-sensitive-capability-enforcement`; isolated Manager browser harness | Bounded role/policy compatibility and evidence; retain data/history |

## Phase 1: Guarded Discovery and Contracts

- [x] 1.1 First, read-only inspect local migration inventory and remote migration history/schema; verify the next identifier and exact sensitive RPC/table seams, record evidence, and stop implementation planning if they diverge—do not allocate an ID.
- [x] 1.2 Define the Manager post-login contract: allow only `/admin/dashboard` when its authorized reads are healthy, otherwise redirect to `/admin/account`; expose only those allowed links plus no unrestricted shell, and test denied direct routes.

## Phase 2: Role and Capability Foundation

- [x] 2.1 RED: add matrix, unknown/inactive/combined-role, role-label, Manager landing/navigation, and production page-composition tests in `tests/roles-capabilities.test.ts`, `tests/admin-navigation.test.ts`, and `tests/admin-route-boundaries.test.ts`.
- [x] 2.2 GREEN: add `manager`/`Gerencia` in `lib/supabase/roles.ts`, seed idempotently in `db/seed/seed.sql`, normalize active/unknown roles in `lib/admin/auth.ts`, and create `lib/admin/capabilities.ts` with the exact eight-key matrix.
- [x] 2.3 GREEN: update `components/admin/admin-nav.ts` and protected/login flow for the contract; preserve existing route authorization and ensure Manager cannot see or reach staff governance.

## Phase 3: Admin Assignment Surface

- [x] 3.1 RED: extend staff validation/admin tests for Manager create/edit/display and Manager/combined-role mutation denial before changing the six listed validation, service, view, action, and selector surfaces.
- [x] 3.2 GREEN: extend `lib/validations/staff.ts`, `lib/admin/staff.ts`, `lib/admin/staff-view.ts`, `app/admin/(protected)/staff/actions.ts`, `components/admin/staff/staff-create-form.tsx`, and `components/admin/staff/staff-action-forms.tsx` (both selectors) for `manager`/`Gerencia`.
- [x] 3.3 Preserve server `requireAdminRole(["admin"])`, database denial, audit payloads, single-admin safeguards, and unsupported-role/read-only behavior.

## Phase 4: Migration, Tests, and Rollout Evidence

- [x] 4.1 After 1.1 approval, add only the verified migration seam; update role constraint/RLS/RPC atomically, preserve `leads`, CRM, quote, audit, and existing helpers; capture apply/rollback evidence and no destructive cleanup.
- [x] 4.2 RED/GREEN static SQL contracts and regression tests cover the bounded migration, Admin-only assignment, denial-before-read, and unchanged CRM/quote/RLS/`leads` invariants; the isolated E2E fixture executes Manager navigation, real dashboard fallback redirect, account zero-read counters, typed direct denial, and Admin Manager create/edit/display control availability. Production capability action/RPC/RLS enforcement and audit integration are exclusively deferred to `week-02-sensitive-capability-enforcement`; local SQL application remains blocked by unavailable Docker/Postgres and no production mutation occurred.
- [x] 4.3 Linked type output was safely extracted and compared against the tracked generated shape: `roles.Row.name`, `Insert.name`, and `Update.name` remain `string`, with no Manager literal. The isolated Playwright browser suite passed; no-flag 404 and exact-flag fixture access were proven, and focused suites, lint, build, quote notifications, diff/image/cleanup checks passed. Full repository E2E was not run because its existing quote flow mutates data.
- [x] 4.4 Document rollout/rollback receipts and explicit exclusions: Tasks, `staff_notifications`, notifications, Mi día, and generic RBAC/RLS rewrite. Preserve `docs/about/helps/intakes/image.png` byte-for-byte.

Playwright remains assigned only to tasks 4.2/4.3; work unit 2 uses the executable production page-composition harness and does not claim browser proof.
