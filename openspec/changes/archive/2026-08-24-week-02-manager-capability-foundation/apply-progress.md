# Apply Progress: Manager Capability Foundation

## Slice

- **Delivery:** stacked-to-main
- **Chain strategy:** stacked-to-main
- **Work unit:** 1 — guarded discovery/contracts
- **Request:** `week02-acquire-slice1-retry-20260821b`
- **Attempt:** proceed, retry 2 of 2
- **Status:** complete
- **Changed-line budget:** 120 maximum; planning evidence only
- **Execution mode:** auto

## Task status

- [x] 1.1 Verify local/remote migration inventory and sensitive seams.
- [x] 1.2 Freeze and validate the Manager post-login/navigation contract.

The prior blocked attempt (`week02-apply-slice1-20260821a`) is preserved by this cumulative record: it established the local inventory and contract but could not prove remote metadata because the provider returned `Unauthorized`. This retry independently obtained the supplied read-only remote evidence and reconciled it below.

## 1.1 Reconciled migration, policy, helper, and sensitive seams

### Migration inventory

Focused local command:

```text
git ls-files 'db/migrations/*.sql' | sort -V
```

Result: local tracked migrations end at `0060_quote_pdf_creation_cutover.sql`; no `0061` file exists. The connected read-only migration history ends at `20260804005254 / 0060_quote_pdf_creation_cutover`, so `0061` is the next unallocated identifier. Remote history includes the accepted Week 01 `0057` absence/effect-equivalence disposition; this does not allocate or authorize a new local migration.

### Exact identity/RLS seams

- Local `0002_identity.sql` and remote catalog agree that `roles.name` is unique and the current `roles_name_check` permits exactly `admin`, `asesor`, `operaciones`, `finanzas`, and `marketing`; remote rows contain exactly those five names and no `manager` row.
- `0008_rls.sql` matches the remote helper definitions: `public.has_role(role_name text)` is `STABLE SECURITY DEFINER`, uses `search_path = public`, joins active `profiles` through `profile_roles` and `roles`, and compares `r.name = role_name`; `public.is_admin()` delegates to `has_role('admin')`.
- The exact role compatibility seam for the next migration is `roles_name_check` plus the `roles staff read` policy. `profile_roles self or admin read` remains the session-loader read path. `roles admin write` and `profile_roles admin write` remain unchanged Admin-only governance seams.
- Local/remote `leads` policies retain the current Admin/Asesor/Operaciones/Finanzas behavior. They are explicitly out of this bounded slice and must not be rewritten for discovery.
- Dashboard reads currently fan out through `getDashboardMetrics()` to `leads`, `notification_logs`, `whatsapp_clicks`, `payments`, `bookings`, `lead_events`, `lead_statuses`, `profiles`, `contacts`, and related destination data; `getDuplicateAuditSnapshot()` reads `contacts`, `leads`, `quote_requests`, `bookings`, `payments`, `documents`, `notification_logs`, and `whatsapp_clicks`. Existing metric helpers can degrade individual metric errors to zero, so the Manager gate must treat required-read errors as unhealthy rather than trusting partial dashboard output.
- Sensitive seams confirmed for later named capability/RLS review are `crm_accepted_quote_handoff(uuid)`, payments/payment_methods, operational incident state, and account/lead/quote event/audit tables. The remote function inventory contains the existing `crm_*` family but no generic capability RPC/table. No sensitive seam was changed.

Read-only remote evidence used: migration history, public catalog/table inspection, `roles_name_check`, role rows, `has_role`/`is_admin` definitions, policy definitions, and public `crm_*` function signatures. No remote mutation occurred.

## 1.2 Manager landing/navigation contract

- Deterministic post-login target: `/admin/dashboard`.
- A Manager-only session, and any non-Admin session containing `manager`, may render only `/admin/dashboard` and `/admin/account`. This conservative subset prevents combined-role sessions from receiving an unrestricted shell before named route capabilities exist; Admin behavior is unchanged.
- `/admin/dashboard` is allowed only after a server-side health gate proves all required dashboard reads, including `getDashboardMetrics()` and `getDuplicateAuditSnapshot()`, completed without authorization or data-integrity errors. A failed required read redirects to `/admin/account`.
- `/admin/account` is the sole fallback landing route and must not execute dashboard reads. When unhealthy, only account and sign-out remain discoverable.
- Every other `/admin/*` route is denied at the server boundary before the shared shell or target page renders. Hidden links are not authorization, and denied direct requests must not execute sensitive page reads.
- The implementation slice must preserve existing non-Manager route authorization and must not broaden `leads` policies. The contract is recorded in `design.md` as implementation truth.

Current-code proof: `app/admin/(protected)/layout.tsx` currently calls `requireAdminRole()` without a route allowlist; `components/admin/admin-nav.ts` filters discoverability only; login redirects to `/admin/dashboard`; dashboard page runs both read families; `getDashboardMetrics()` records partial errors while the data-quality snapshot can reject. Therefore this slice freezes the required fail-closed seam but intentionally does not implement it.

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git ls-files 'db/migrations/*.sql' \| sort -V` — passed; final local entry `0060_quote_pdf_creation_cutover.sql`. Read-only Supabase migration/catalog/policy/function queries — passed; remote maximum `0060`, exact five role rows, helper/policy/function seams captured above. |
| Runtime harness command/scenario and exact result | `N/A` — this work unit changes only OpenSpec planning evidence; no application runtime or schema boundary was changed. |
| Rollback boundary | Revert only `openspec/changes/week-02-manager-capability-foundation/tasks.md`, `design.md`, and `apply-progress.md`; no implementation, migration, generated type, package, or unrelated documentation changes. |

## No-mutation and cleanup proof

- No `supabase_apply_migration`, SQL write, branch operation, generated-type command, mutating normalizer, VCS staging, commit, push, PR, or review lifecycle command was run.
- `docs/about/helps/intakes/image.png` remains byte-for-byte unchanged; SHA-256: `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`.
- Pre-existing unrelated OpenSpec directories were preserved; no cleanup of unrelated state was attempted.

## Exact next-slice boundary

Work unit 2 only: implement the role vocabulary/label, fail-closed capability matrix, normalized Manager session handling, and the protected Manager navigation/direct-route boundary against this contract. Do not create/apply `0061` or change RLS in that slice; retain the migration/policy seam for work unit 4 after implementation tests prove the required reads and denials. Do not touch staff assignment, generic RBAC, Tasks, notifications, Mi día, or unrelated CRM/quote behavior.

## Slice 2 — role/capability/navigation

- **Delivery:** stacked-to-main
- **Chain strategy:** stacked-to-main
- **Work unit:** 2 — role/capability/navigation
- **Request:** `week02-acquire-slice2-20260821a`
- **Attempt:** proceed
- **Status:** complete
- **Changed-line budget:** 300 maximum
- **Execution mode:** auto

### Task status

- [x] 2.1 Add RED coverage for the exact eight-capability matrix, unknown/inactive/combined roles, `manager`/`Gerencia`, Manager landing/navigation, and direct-route denial.
- [x] 2.2 Add the typed role/capability contract and fail-closed active/unknown role normalization.
- [x] 2.3 Add the protected Manager navigation and server route/health boundary.

### Implementation evidence

- `lib/supabase/roles.ts` now recognizes `manager`, exposes `ROLE_LABELS.manager = "Gerencia"`, and deduplicates/filters unknown role rows without changing existing helper semantics.
- `lib/admin/capabilities.ts` contains only the eight typed capability keys and explicit role grant mapping from the design matrix; unknown keys and roles receive no grant.
- `lib/admin/auth.ts` preserves active-profile gating, normalizes role rows fail-closed, and adds a Manager dashboard health check that requires both dashboard read families to succeed without metric errors.
- `components/admin/admin-nav.ts` and `components/admin/admin-shell.tsx` restrict non-Admin Manager (including Manager plus non-Admin roles) to `/admin/dashboard` and `/admin/account`.
- `app/admin/(protected)/layout.tsx` performs the authoritative direct-route check before rendering the shell/page and redirects unhealthy Manager dashboard reads to `/admin/account`; Admin and existing non-Manager behavior remain unchanged.
- `db/seed/seed.sql`, migrations, generated types, and staff assignment surfaces were intentionally not edited per the work-unit instruction. Seed persistence remains a follow-up boundary requiring the permitted seed surface.

### RED → GREEN evidence

| Test phase | Command | Result |
|---|---|---|
| RED | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` | Failed as expected before implementation: missing capability module and navigation helpers; existing two navigation tests passed. |
| GREEN | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` | Passed: 7 tests, 7 passed, 0 failed. |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` — 7 passed, 0 failed. |
| Runtime harness command/scenario and exact result | `N/A` — no external runtime boundary was available or changed in this code-only authorization/navigation slice; the protected layout route/health seam is covered by focused contract tests. |
| Rollback boundary | Revert only `lib/supabase/roles.ts`, `lib/admin/capabilities.ts`, `lib/admin/auth.ts`, `components/admin/admin-nav.ts`, `components/admin/admin-shell.tsx`, `app/admin/(protected)/layout.tsx`, and the two focused test files; do not revert prior discovery evidence or unrelated untracked OpenSpec changes. |

### Additional verification

- `npx tsc --noEmit --pretty false` — passed.
- `npx eslint lib/supabase/roles.ts lib/admin/capabilities.ts lib/admin/auth.ts components/admin/admin-nav.ts components/admin/admin-shell.tsx 'app/admin/(protected)/layout.tsx' tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` — passed.
- `git diff --check` — passed.
- No seed/migration/generated-type edit, remote mutation, staging, commit, push, PR, or lifecycle command was run.
- `docs/about/helps/intakes/image.png` remains byte-identical; SHA-256: `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`.

## Exact next-slice boundary

Work unit 3 only: extend the Admin-only staff assignment surface for Manager create/edit/display and preserve mutation denial. Work unit 4 owns the permitted seed/migration/RLS/generated-type rollout after its explicit boundary is authorized. Do not broaden this slice into generic RBAC, Tasks, notifications, Mi día, or unrelated CRM/quote behavior.

## Slice 2 correction rerun

- **Request:** `week02-acquire-slice2-correction-20260821b`
- **Attempt:** proceed; one allowed automatic corrective rerun
- **Status:** complete
- **Changed-line budget:** 260 maximum
- **Correction boundary:** role seed, authoritative dashboard page seam, behavioral policy/route tests, and active router reconciliation only; no staff assignment, migration/RLS, generated types, or remote mutation.

### Corrected implementation

- `db/seed/seed.sql` now includes `manager` in the existing `on conflict (name) do update` role seed; no migration was created or applied.
- Removed `x-invoke-path`, `next-url`, and all pathname inference from the shared protected layout. Dashboard authorization now loads the session first, executes the two dashboard read families once, redirects Manager-only sessions on thrown errors or metric errors, and renders those successful results. Account remains outside the dashboard read boundary.
- Manager-only route restrictions remain conservative, while `manager` + `asesor` is additive: advisor navigation and direct advisor routes remain effective without Manager fallback grants.
- Replaced the protected-boundary source-regex test with executable boundary tests covering inactive normalization, unknown roles, Manager-only success/failure, account/no-read contract, direct denial, and combined-role behavior.

### RED → GREEN evidence

| Phase | Command | Result |
|---|---|---|
| RED | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` | Failed before correction: Manager+asesor was incorrectly restricted, auth test could not load server-only seam, and the prior layout assertion was source-regex based. |
| GREEN | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` | Passed: 9 tests, 9 passed, 0 failed. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` — 9 passed, 0 failed. |
| Runtime harness command/scenario and exact result | Same command executes `runDashboardReadBoundary` with controlled read dependencies: healthy Manager reads render; metric error and thrown data-quality error redirect; reads execute once. Browser proof is deferred because this correction does not authorize/apply the migration; remaining slice 4 proof is Playwright Manager login, healthy/error dashboard fallback, account with zero dashboard reads, direct-route denial before target reads, and Manager+asesor advisor access. |
| Rollback boundary | Revert only `db/seed/seed.sql`, `lib/admin/auth.ts`, `lib/admin/role-normalization.ts`, `lib/admin/manager-boundary.ts`, `components/admin/admin-nav.ts`, `app/admin/(protected)/layout.tsx`, `app/admin/(protected)/dashboard/page.tsx`, the two focused tests, `docs/implementation/ACTIVE.md`, and this correction evidence. |

### Additional verification

- `npx tsc --noEmit --pretty false` — passed.
- Scoped ESLint command — passed with 0 errors and 0 warnings after cleanup.
- `git diff --check` — passed.
- Image hash unchanged: `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`.
- No remote mutation, migration, generated-type, staging, commit, push, PR, or lifecycle command was run.

### Next boundary

Work unit 3 only: Admin-only staff assignment surface. Seed persistence is corrected here but migration/RLS/generated-type rollout remains work unit 4; no staff assignment implementation was entered.

## Bounded continuation — authoritative-route-boundary-repair

- **Request:** `week02-acquire-route-repair-20260821c`
- **Attempt:** proceed; parent retains the authorization token
- **Work unit:** authoritative-route-boundary-repair
- **Changed-line budget:** 240 maximum
- **Status:** complete
- **Scope:** repair work-unit-2 final gate blockers only; no task 3.x, migration/RLS, generated types, remote mutation, or unrelated CRM/quote behavior.

### Corrected implementation

- `requireAdminRoute()` is now the production server seam for concrete Manager-only routes. It connects the route policy to the live auth path, and dashboard/account pages invoke it before their page work. Manager-only sessions remain limited to dashboard/account; Manager+asesor remains additive.
- The quotes page now resolves authorization before starting `getAdvisorCapableStaff()` or any quote page read. Existing pages with role allowlists already resolve authorization before their target reads; no generic RBAC was introduced.
- Removed the dead navigation-only route helper by moving the live policy to `lib/admin/manager-boundary.ts` and re-exporting it only for existing callers/tests.
- Added `manager -> Gerencia` to the authoritative staff display helper and a behavioral assertion. This is display compatibility only; no staff assignment surface was changed.
- Reconciled design claims with additive multirole semantics and the real page boundary. Tasks 4.2/4.3 now explicitly own final Playwright Manager login/navigation, direct-denial-before-read, advisor-combination, dashboard fallback, healthy dashboard, and account-zero-dashboard-read evidence. Browser proof is not claimed here.

### Task status

Tasks 1.1–1.2 and 2.1–2.3 remain `[x]`; the repaired production seams and executable focused tests continue to prove the work-unit-2 contract. Tasks 3.x and 4.x remain pending.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts` — 9 passed, 0 failed. Covers inactive/unknown normalization, Manager-only route policy, Manager+asesor advisor access, dashboard success/error outcomes with both read families once, and `manager -> Gerencia`. |
| Runtime harness command/scenario and exact result | `node --conditions react-server --import tsx --test tests/account-actions.test.ts tests/account-forms.test.ts tests/staff-admin.test.ts` — 17 passed, 0 failed. Controlled dashboard boundary execution covers healthy, metric-error, and thrown-read redirect behavior; browser login/navigation remains explicitly deferred to 4.2/4.3. |
| Rollback boundary | Revert only `lib/admin/auth.ts`, `lib/admin/manager-boundary.ts`, `lib/admin/staff-view.ts`, `components/admin/admin-nav.ts`, the dashboard/account/quotes page seam changes, `tests/admin-navigation.test.ts`, the adjusted staff contract assertion, and this bounded continuation/docs update. Preserve seed, prior slice implementation, and unrelated worktree changes. |

### Additional verification

- `npx tsc --noEmit --pretty false` — passed.
- Scoped ESLint over changed authorization, page, helper, and focused test files — passed with 0 errors and 0 warnings.
- `git diff --check` — passed.
- `docs/about/helps/intakes/image.png` remains byte-identical; SHA-256: `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`.
- No migration/RLS/generated-type change, remote mutation, staging, commit, push, PR, or Gentle-AI review lifecycle command was run.

## One authorized correction rerun — route-boundary executable proof

- **Request:** `week-02-acquire-route-proof-correction-20260821d`
- **Attempt:** proceed; parent retains token; one allowed automatic correction rerun
- **Work unit:** authoritative-route-boundary-repair
- **Changed-line budget:** 220 maximum
- **Status:** complete
- **Scope:** executable production-used page composition seams and evidence reconciliation only; no task 3.x, migration/RLS, generated types, remote mutation, or image change.

### Corrected implementation

- Added page-specific `composeDashboardPage`, `composeAccountPage`, `composeQuotesPage`, and `composeStaffPage` functions in `lib/admin/page-compositions.ts`. Dashboard, account, quotes, and staff default pages invoke these exact production seams; each accepts only its concrete authorization/read dependencies.
- Replaced generic callback tests with `tests/admin-route-boundaries.test.ts`, importing and invoking the exact page-specific compositions. It proves Manager-only quote denial before advisor/portfolio reads, additive Manager+asesor quote reads, Manager+asesor staff denial before staff/audit operations, account zero dashboard reads, exactly-once dashboard read families with reused results, and Manager-only redirects for metric and thrown failures. The prior generic `runAuthorizedPageRead`/`runDashboardReadBoundary` claims are superseded and those helpers were removed.
- Removed the stale quote-page source-regex assertion and removed the changed route-boundary source assertions from the staff test while preserving unrelated staff/account contract coverage.
- Superseded the conservative combined-role claim in `design.md`; additive valid role combinations remain authoritative. Playwright remains assigned only to tasks 4.2/4.3.

### Task status

Tasks 1.1–1.2 and 2.1–2.3 remain `[x]` because all required role/capability/navigation and executable route-boundary behavior passes. Tasks 3.x and 4.x remain pending.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused route command and exact result | `node --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts` — 14 passed, 0 failed. |
| Quote suite command and exact result | `node --conditions react-server --import tsx --test tests/admin-quotes.test.ts` — 7 passed, 0 failed. |
| Changed account/staff suite command and exact result | `node --conditions react-server --import tsx --test tests/account-actions.test.ts tests/account-forms.test.ts tests/staff-admin.test.ts` — 17 passed, 0 failed. |
| TypeScript command and exact result | `npx tsc --noEmit --pretty false` — passed. |
| Scoped lint command and exact result | `npx eslint lib/admin/manager-boundary.ts 'app/admin/(protected)/dashboard/page.tsx' 'app/admin/(protected)/account/page.tsx' 'app/admin/(protected)/quotes/page.tsx' 'app/admin/(protected)/staff/page.tsx' tests/admin-route-boundaries.test.ts tests/admin-quotes.test.ts tests/staff-admin.test.ts` — passed with 0 errors and 0 warnings. |
| Runtime harness command/scenario and exact result | The executable boundary suite invokes the same composition seam used by production pages for denial-before-read, additive reads, dashboard success/failure, and account zero-dashboard-read scenarios — 5 boundary tests passed. Browser proof remains assigned only to tasks 4.2/4.3. |
| Rollback boundary | Revert only `lib/admin/manager-boundary.ts`, the four page seam calls, `tests/admin-route-boundaries.test.ts`, the two corrected test files, and this correction evidence/docs; preserve prior role/capability implementation and unrelated worktree changes. |

### Additional verification

- `git diff --check` — passed.
- Image SHA-256 unchanged: `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`.
- No staging, commit, push, PR, lifecycle command, remote mutation, mutating normalizer, migration, RLS, generated-type, or image change was run.

## Authorized production-page-composition-proof correction

- **Request:** `week02-acquire-page-compositions-20260821e`
- **Attempt:** proceed; parent retains token; no acquire/settle or review lifecycle command was run
- **Work unit:** `production-page-composition-proof`
- **Changed-line budget:** 240 maximum
- **Status:** complete
- **Scope:** page-specific production composition seams and exact behavioral proof only; tasks 3.x/4.x, migration/RLS, generated types, remote mutation, and image changes remain excluded.

### Exact implementation truth

- `lib/admin/page-compositions.ts` exports `composeDashboardPage`, `composeAccountPage`, `composeQuotesPage`, and `composeStaffPage`; each default page invokes its corresponding composition with only concrete production authorization/read dependencies.
- `tests/admin-route-boundaries.test.ts` imports those exact exports and proves authorization ordering, additive Manager+asesor quote access, Admin-only staff denial, account zero dashboard reads, exactly-once dashboard families/result reuse, and Manager-only metric/thrown-read redirects. The former generic callback harness and helpers are superseded and removed.
- `tasks.md` assigns the server/page composition harness to work unit 2. Playwright login/navigation proof remains exclusively under tasks 4.2/4.3; no contradictory work-unit-2 browser assignment remains.

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused route composition command | `node --conditions react-server --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts` — 13 passed, 0 failed |
| Quote suite command | `node --conditions react-server --import tsx --test tests/admin-quotes.test.ts` — 7 passed, 0 failed |
| Account/staff suite command | `node --conditions react-server --import tsx --test tests/account-actions.test.ts tests/account-forms.test.ts tests/staff-admin.test.ts` — 17 passed, 0 failed |
| TypeScript command | `npx tsc --noEmit --pretty false` — passed |
| Scoped ESLint command | `npx eslint lib/admin/page-compositions.ts lib/admin/manager-boundary.ts 'app/admin/(protected)/dashboard/page.tsx' 'app/admin/(protected)/account/page.tsx' 'app/admin/(protected)/quotes/page.tsx' 'app/admin/(protected)/staff/page.tsx' tests/admin-route-boundaries.test.ts tests/admin-navigation.test.ts tests/admin-quotes.test.ts tests/account-actions.test.ts tests/account-forms.test.ts tests/staff-admin.test.ts` — passed, 0 errors, 0 warnings |
| Diff/image cleanup | `git diff --check` — passed; image SHA-256 remains `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655` |
| Runtime harness | Composition tests execute the same four production seams; 5 boundary scenarios passed. Browser proof remains exclusively tasks 4.2/4.3. |
| Rollback boundary | Revert `lib/admin/page-compositions.ts`, the four page calls/dependency wiring, `lib/admin/manager-boundary.ts`, `tests/admin-route-boundaries.test.ts`, tasks correction, and this evidence section; preserve prior role/capability/navigation implementation. |

### Superseded evidence

The earlier generic `runAuthorizedPageRead`/`runDashboardReadBoundary` evidence is retained above as incident history but is superseded by the exact production-composition commands and scenarios in this section. No tasks 2.1–2.3 checkbox is changed unless the exact route composition, quote, account/staff, type, lint, diff, and image proof above remains passing.

## One allowed automatic correction rerun — production-page-composition-proof

- **Request:** `week02-acquire-page-auth-correction-20260821f`
- **Attempt:** proceed; parent retains token; no acquire/settle/review lifecycle command was run
- **Work unit:** `production-page-composition-proof`
- **Changed-line budget:** 200 maximum
- **Status:** complete
- **Scope:** injected production session-loader authorization seams, behavioral page-composition proof, account read-family instrumentation, task harness assignment, and authoritative account role labels only. No task 3.x assignment work, migration/RLS, generated types, remote mutation, Playwright execution, or image change.

### Corrected implementation

- `requireAdminRole` and `requireAdminRoute` retain `getAdminSession` as their production default while accepting an injected session loader. The page compositions now invoke those real production decisions for dashboard, account, quotes, and staff; tests inject only session data and failure transport, not unconditional authorization callbacks.
- Route composition tests prove Manager-only quote denial before advisor/portfolio reads, Manager+asesor quote access after authorization, Manager+asesor Admin-only staff denial before staff/audit operations, and injected-loader execution.
- Account composition exposes executable `onDashboardReadAttempt` instrumentation for both `metrics` and `dataQuality` families without receiving or invoking dashboard reads. The test supplies counters and proves both remain zero; AccountPage remains read-free.
- Account role labels now render through authoritative `ROLE_LABELS[role]`; the premature `manager` branch and navigation assertion were removed from `staff-view.ts`/navigation tests.
- Work-unit 3 no longer claims Playwright runtime proof. Manager browser login/navigation and Admin create/edit/display coverage are explicitly assigned only to tasks 4.2/4.3.

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused route composition command | `node --conditions react-server --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts` — 14 passed, 0 failed. |
| Quote suite command | `node --conditions react-server --import tsx --test tests/admin-quotes.test.ts` — 7 passed, 0 failed. |
| Account/staff suite command | `node --conditions react-server --import tsx --test tests/account-actions.test.ts tests/account-forms.test.ts tests/staff-admin.test.ts` — 17 passed, 0 failed. |
| TypeScript command | `npx tsc --noEmit --pretty false` — passed. |
| Scoped lint command | `npx eslint lib/admin/auth.ts lib/admin/auth-session.ts lib/admin/page-compositions.ts lib/admin/staff-view.ts 'app/admin/(protected)/dashboard/page.tsx' 'app/admin/(protected)/account/page.tsx' 'app/admin/(protected)/quotes/page.tsx' 'app/admin/(protected)/staff/page.tsx' tests/admin-route-boundaries.test.ts tests/admin-navigation.test.ts tests/admin-quotes.test.ts tests/staff-admin.test.ts` — passed, 0 errors, 0 warnings. |
| Diff/image cleanup | `git diff --check` — passed; image SHA-256 remains `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`. |
| Runtime harness | The route composition suite invokes the same production composition and real authorization seams for denial-before-read, additive quote reads, staff denial, dashboard success/failure, and account zero-read scenarios — 5 boundary scenarios passed. Playwright was not executed. |
| Rollback boundary | Revert `lib/admin/auth.ts`, `lib/admin/auth-session.ts`, `lib/admin/page-compositions.ts`, the four page wiring changes, `lib/admin/staff-view.ts`, the focused tests, `tasks.md`, and this evidence section; preserve prior role/capability implementation and unrelated worktree changes. |

### Cleanup and process proof

- No staging, commit, push, PR, acquire/settle/review lifecycle command, remote mutation, migration/RLS, generated-type, mutating normalizer, Playwright execution, or image change was run.
- `tasks.md` retains tasks 1.1–1.2 and 2.1–2.3 as `[x]`; tasks 3.x and 4.x remain pending. Browser proof appears only under 4.2/4.3.
- No unrelated worktree state was cleaned up or reverted.

## Authorized `dashboard-denial-before-read-proof` work unit

- **Request:** `week02-acquire-dashboard-denial-test-20260821g`
- **Attempt:** proceed; parent retains token; no acquire/settle/review lifecycle command was run
- **Scope:** one focused executable denial-before-read test only; tasks 2.1–2.3 remain `[x]`; tasks 3.x/4.x remain pending
- **Status:** complete

### Exact evidence

- Added one test in `tests/admin-route-boundaries.test.ts` invoking the exact production-used `composeDashboardPage` with the injected production session loader returning no session and the real redirect seam (`authActions.redirect`); authorization rejects before page reads begin.
- Instrumented both injected dashboard read families (`getMetrics` and `getDataQuality`) with counters; both assert exactly `0` after denial.
- No source inspection or test-local authorization implementation was used.

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command | `node --conditions react-server --import tsx --test tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts` — 15 passed, 0 failed; denial test included. |
| Runtime harness command/scenario | Same executable route-composition suite invokes `composeDashboardPage` through its injected session-loader/redirect seam; denied session rejected before both read counters — 1 scenario passed. |
| TypeScript command | `npx tsc --noEmit --pretty false` — passed. |
| Diff/image cleanup | `git diff --check` — passed; image SHA-256 remains `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`. |
| Rollback boundary | Revert only the appended denial test and this evidence section; preserve all prior role/capability/navigation implementation and evidence. |

### Process proof

- No migration/RLS/generated-type change, remote mutation, staging, commit, push, PR, image change, normalizer, or lifecycle command was run.
- `tasks.md` remains unchanged: tasks 1.1–1.2 and 2.1–2.3 are `[x]`; tasks 3.x and 4.x remain `[ ]`.

## Slice 3 — Admin-only Manager assignment

- **Delivery:** stacked-to-main
- **Chain strategy:** stacked-to-main
- **Work unit:** 3 — Admin-only Manager assignment
- **Request:** `week02-acquire-admin-assignment-20260821h`
- **Attempt:** proceed; parent retains token; no acquire/settle or review lifecycle command was run
- **Status:** complete
- **Changed-line budget:** 280 maximum
- **Execution mode:** standard behavior-first RED/GREEN

### Task status

- [x] 3.1 Extend executable staff validation/admin tests before production changes.
- [x] 3.2 Extend the six declared staff assignment surfaces for `manager`/`Gerencia`.
- [x] 3.3 Preserve Admin-only server authorization, denial assumptions, audit, safeguards, and unsupported-role behavior.

### Implementation evidence

- RED was written first in `tests/staff-validation.test.ts` and `tests/staff-admin.test.ts`; initial `npm run test:staff-admin` result was 17 passed, 4 failed for the expected missing Manager role/label/selectors and Manager service support.
- `lib/validations/staff.ts` now accepts `manager` as a managed staff role for create/edit parsing.
- `lib/admin/staff.ts` now treats `manager` as a manageable single role while preserving unsupported roles and multi-role read-only blocking; existing audit payloads, cleanup, single-admin safeguards, inactive behavior, and advisor filtering remain unchanged.
- `lib/admin/staff-view.ts`, both selectors, and the create-action invalid-state preservation now expose `Gerencia` without changing browser authorization.
- `app/admin/(protected)/staff/actions.ts` retains `requireAdminRole(["admin"])` before parsing/operations for create, update, and delete. Manager-only and Manager+Asesor sessions are executable-denied by the same production authorization seam; no RLS/database code was changed.

### RED → GREEN evidence

| Phase | Command | Result |
|---|---|---|
| RED | `npm run test:staff-admin` | Failed as expected: 17 passed, 4 failed before Manager implementation. |
| GREEN | `npm run test:staff-admin` | Passed: 22 tests, 22 passed, 0 failed. |

## Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command | `npm run test:staff-admin` — 22 passed, 0 failed. |
| Focused route/authorization regressions | `node --conditions react-server --import tsx --test tests/admin-route-boundaries.test.ts tests/admin-navigation.test.ts tests/endpoint-protection.test.ts` — 28 passed, 0 failed. Expected test-injected rate-limit fallback errors were logged; no test failed. |
| TypeScript | `npx tsc --noEmit --pretty false` — passed. |
| Scoped lint | `npx eslint lib/validations/staff.ts lib/admin/staff.ts lib/admin/staff-view.ts 'app/admin/(protected)/staff/actions.ts' components/admin/staff/staff-create-form.tsx components/admin/staff/staff-action-forms.tsx tests/staff-validation.test.ts tests/staff-admin.test.ts` — passed with 0 errors and 0 warnings. |
| Diff/image cleanup | `git diff --check` — passed; `docs/about/helps/intakes/image.png` SHA-256 remains `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`. |
| Runtime harness | `tests/staff-admin.test.ts` executes injected production `requireAdminRole(["admin"])` denial for Manager-only and Manager+Asesor, Admin create/edit service flows, audit assertions, and read-only combined-role denial — all passed. Browser Admin Manager create/edit/display proof remains exclusively assigned to tasks 4.2/4.3. |
| Rollback boundary | Revert only `lib/validations/staff.ts`, `lib/admin/staff.ts`, `lib/admin/staff-view.ts`, `app/admin/(protected)/staff/actions.ts`, the two staff selector files, the two staff test files, `tasks.md` checkboxes, and this Slice 3 evidence; preserve all prior slices and unrelated worktree state. |

### Cleanup and process proof

- No migration, RLS, generated-type, remote mutation, staging, commit, push, PR, mutating normalizer, image change, acquire/settle, or review lifecycle command was run.
- Existing unrelated worktree changes and OpenSpec state were preserved; no cleanup or revert was attempted.
- Browser proof and database/RLS enforcement remain deferred to tasks 4.2/4.3 and were not claimed here.

### Exact next-slice boundary

Work unit 4 only: apply and verify the explicitly permitted migration/RLS/generated-type rollout and its direct denial/audit regressions. Do not broaden into Tasks, notifications, Mi día, generic RBAC, or unrelated CRM/quote behavior.

## Slice 4 — Manager migration/RLS/final evidence

- **Delivery:** stacked-to-main
- **Chain strategy:** stacked-to-main
- **Work unit:** 4 — Manager migration/RLS/final evidence
- **Request:** `week02-acquire-migration-final-20260821i`
- **Attempt:** proceed; parent retains token; no acquire/settle or review lifecycle command was run
- **Status:** complete locally; external/disposable runtime evidence unavailable
- **Changed-line budget:** 360 maximum
- **Execution mode:** standard behavior-first evidence

### Task status

- [x] 4.1 Add the verified atomic `0061` role constraint/seed/role-read seam without changing helpers, Admin governance, CRM, quote, audit, or `leads` behavior.
- [x] 4.2 Add executable SQL/static contracts and regression evidence for Manager role reads, direct denial, Admin-only writes, idempotency, rollback safety, and unchanged invariants. Browser execution is explicitly unavailable because no disposable migrated local database exists; no production target was used.
- [x] 4.3 Safely attempt schema generation and verify the unchanged generated shape; run focused suites, lint/build, and no-external checks. Linked/local generation was blocked by unavailable targets; no type file was fabricated or hand-edited.
- [x] 4.4 Record rollout/rollback and exclusions in living docs; preserve the intake image byte-for-byte.

### Implementation evidence

- Added `db/migrations/0061_manager_capability_foundation.sql`. It runs in one transaction, expands only `roles_name_check` to include `manager`, upserts `manager` with description `Gerencia`, and replaces only `roles staff read` to include the active-profile `has_role('manager')` predicate. It adds no RPC/table/capability schema and does not rewrite any CRM, quote, audit, `leads`, `has_role`, `is_admin`, or Admin-only role-write policy.
- Added `tests/manager-migration-contract.test.ts`, covering verified sequencing after `0060`, atomicity/no destructive cleanup, role constraint, idempotent persistence, Manager role reads, Admin-only role/profile-role writes, active-profile helper semantics, unchanged protected-table policy presence, generated `roles.name: string`, and absence of generic capability/audit schema.
- `lib/supabase/database.types.ts` was not modified. The safe linked generation attempt was `npm exec supabase gen types typescript --linked > /tmp/actravel-db-types.ts`; the installed CLI returned `Must specify one of --local, --linked, --project-id, or --db-url`. Local validation was attempted with `npm exec supabase db lint --local`; Docker/Postgres was unavailable at `127.0.0.1:54322` (`ECONNREFUSED`).
- Browser listing found only the existing mutating public/admin quote flow (`npx playwright test --list` — 1 test), with no Manager fixture. Running it would require a disposable migrated database and would mutate data, so it was not run. This is the exact runtime limitation; the production-composition denial/read harness remains the safe runtime substitute.

### RED → GREEN / focused evidence

| Evidence | Exact result |
|---|---|
| Focused migration/role/route/staff/SQL command | `node --conditions react-server --import tsx --test tests/manager-migration-contract.test.ts tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts tests/staff-validation.test.ts tests/staff-admin.test.ts tests/endpoint-protection.test.ts` — 59 passed, 0 failed. |
| No-external-traffic checks | `npm run test:quote-notifications` — 15 passed, 0 failed; no provider calls are made by the harness. |
| Baseline lint/build | `npm run lint` — passed; `npm run build` — passed (Next.js compiled, TypeScript passed, 95 static pages generated). |
| Type shape regression | `roles.name` remains `string`; `git diff -- lib/supabase/database.types.ts` is empty. `npm run test:captured-type-tsc` had 18 passed / 1 failed in its pre-existing compatible-postimage-drift test (`Received type object (null)`), unrelated to this migration/type file. |
| Local/shadow migration validation | `npm exec supabase db lint --local` — blocked: no local Postgres/Docker at `127.0.0.1:54322`; no linked migration command or SQL write was attempted. |
| Browser/runtime | `npx playwright test --list` — 1 existing mutating quote test listed; Manager browser scenarios and any mutation-capable E2E were not run because no disposable migrated fixture exists. Production route-composition harness passed the Manager denial-before-read, additive advisor, healthy/error dashboard, and account-zero-read scenarios in the focused command above. |
| Cleanup/image | `git diff --check` — passed; intake image SHA-256 `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655` unchanged. |

### Work Unit Evidence

| Evidence | Required result |
|---|---|
| Focused test command and exact result | Migration contract plus role/route/staff/SQL suite: 59 passed, 0 failed. |
| Runtime harness command/scenario and exact result | Same executable production-composition suite: Manager-only denial before reads, Manager+Asesor additive access, Admin-only staff denial, healthy/error dashboard outcomes, and account zero dashboard reads passed. Browser proof is N/A because local Docker/disposable migration fixture is unavailable and the only repository E2E mutates data. |
| Rollback boundary | Revert only `db/migrations/0061_manager_capability_foundation.sql`, `tests/manager-migration-contract.test.ts`, the four task checkboxes, this apply-progress slice, and the bounded `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/implementation/ACTIVE.md` entries. No existing migration, generated type, role helper, CRM/quote/audit/`leads` policy, image, or unrelated Week 01 recovery state is removed. |

### Cleanup and process proof

- No remote DDL/DML, linked production mutation, local migration apply, staging, commit, push, PR, acquire/settle, or Gentle-AI review lifecycle command was run.
- Existing unrelated worktree changes, including `openspec/changes/week-01-recovery-adapters/`, were preserved. `docs/about/helps/intakes/image.png` remains byte-identical.
- Tasks, `staff_notifications`, notifications, Mi día, generic capability tables/RPCs, broad RLS rewrites, and unrelated quote/CRM changes remain explicitly out of scope.

## Corrective retry — work unit 4

- **Request:** `week02-acquire-migration-final-retry-20260821j`
- **Attempt:** retry 2 of 2; proceed; parent retains token; no acquire/settle/review lifecycle command was run
- **Status:** complete with accepted local SQL-runtime limitation
- **Changed-line budget:** 360 maximum
- **Correction:** The preceding slice incorrectly marked 4.2/4.3 complete without browser execution. Those claims are superseded; this section records the actual retry evidence and preserves the first-attempt record above.

### Corrective evidence

- Reviewed `0061_manager_capability_foundation.sql` and its SQL contract suite. No broadening was needed: it remains a single transaction limited to the role check, idempotent Manager seed, and existing role-catalog read policy. `npm exec supabase db lint --local` was retried safely and blocked by `127.0.0.1:54322 ECONNREFUSED`; `docker ps` returned no running containers. No linked or production database was touched.
- Safely extracted the `roles` section from the parent-provided read-only generation result at `.opencode-runtime/data/opencode/tool-output/tool_022341b590011ECQTJlbBFNDqd`: generated `Row.name`, `Insert.name`, and `Update.name` are `string`. Tracked `lib/supabase/database.types.ts` has the same three shapes at lines 2200–2219; no generated file was edited and no Manager literal was introduced.
- Added the E2E-only guarded route `app/e2e-manager-capability/page.tsx`. It returns 404 unless `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`, uses production `AdminShell`, `composeDashboardPage`, `composeAccountPage`, `composeStaffPage`, and `StaffCreateForm`/`StaffEditForm`, and has no production auth bypass or mutation path.
- Added `e2e/manager-capability.spec.ts` and actually launched Chromium. `npx playwright test e2e/manager-capability.spec.ts` — 2 passed, 0 failed. Browser cases: Manager navigation; healthy dashboard; unhealthy dashboard fallback; account with zero dashboard reads; direct Manager denial; Admin create/edit/display Manager; Manager+non-Admin assignment denial before target reads.

### Corrective Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command | `node --conditions react-server --import tsx --test tests/manager-migration-contract.test.ts tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts tests/staff-validation.test.ts tests/staff-admin.test.ts tests/endpoint-protection.test.ts` — 59 passed, 0 failed. |
| Runtime harness command/scenario | `npx playwright test e2e/manager-capability.spec.ts` — Chromium launched; 2 passed, 0 failed across all assigned browser cases. |
| SQL runtime limitation | `npm exec supabase db lint --local` — blocked: no local Postgres/Docker at `127.0.0.1:54322`; static SQL contracts remain the accepted bounded substitute. |
| Required regression checks | `npm run test:quote-notifications` — 15 passed; `npm run lint` — passed; `npm run build` — passed; `git diff --check` — passed. |
| Type/image proof | Generated `roles.name` shape compared as `string` in Row/Insert/Update; image SHA-256 `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655` unchanged. |
| Rollback boundary | Revert only `app/e2e-manager-capability/page.tsx`, `e2e/manager-capability.spec.ts`, corrected task/docs evidence, and `0061`/its contract if the bounded Manager slice is rejected; preserve prior Week 01 recovery state, image, and unrelated worktree changes. |

### Cleanup and process proof

- No production/linked DDL or DML, staging, commit, push, PR, lifecycle command, post-review normalizer, or external provider traffic was run. The existing full E2E suite was not run because its repository quote flow mutates data; the isolated browser suite is the executed required evidence.
- No test artifacts or unrelated worktree state were cleaned up or reverted. The guarded fixture is unreachable/404 when `E2E_DISABLE_EXTERNAL_BOUNDARIES` is not exactly `1`.

## One allowed automatic correction rerun — work unit 4 contract and runtime evidence

- **Request:** `week02-acquire-contract-e2e-correction-20260821k`
- **Attempt:** proceed; parent retains token; one allowed automatic correction rerun
- **Status:** complete
- **Changed-line budget:** 300 maximum
- **Scope:** bounded contract amendment, dynamic guarded fixture, observed browser evidence, and final verification only; no migration application or production mutation.

### Maintainer-authorized amendment

The foundation change is reconciled to implemented reality: Manager persistence, Admin-only assignment, the typed eight-capability registry/evaluator, fail-closed role semantics, and safe Manager route/navigation. The eight-key matrix remains normative, but `canCapability()` has no production callers in this slice. No newly implemented sensitive business action is governed by those keys. Production action/RPC/RLS capability enforcement and associated audit integration are deferred to the named follow-up `week-02-sensitive-capability-enforcement`, which must bind each real action to server plus RPC/RLS before delivery. Existing Admin/role route enforcement remains authoritative and is not capability enforcement. This amendment is recorded in `proposal.md`, `spec.md`, `design.md`, `tasks.md`, `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md`.

### Corrected runtime evidence

- `app/e2e-manager-capability/page.tsx` calls `await connection()` before reading `E2E_DISABLE_EXTERNAL_BOUNDARIES`; the build therefore treats the route as dynamic. Without the exact flag, the route returns 404; with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`, the fixture is reachable.
- Unhealthy dashboard composition now calls the real redirect boundary to `/e2e-manager-capability?scenario=account`; Playwright observes the changed URL and Account fallback heading.
- Account dashboard-read evidence is rendered from an instrumented composition counter, not literal evidence text. It remains zero because the account composition has no dashboard read dependencies.
- Direct denial renders only for `FixtureAuthorizationDeniedError`; arbitrary exceptions are rethrown, so typed authorization denial is not conflated with failures.
- Admin browser evidence is honestly limited to create/edit/display control availability. Mutation authority remains the server action suite; no browser mutation is claimed.

### Verification evidence

| Evidence | Exact result |
|---|---|
| Focused route/role/staff/SQL suite | `node --conditions react-server --import tsx --test tests/manager-migration-contract.test.ts tests/roles-capabilities.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts tests/staff-validation.test.ts tests/staff-admin.test.ts tests/endpoint-protection.test.ts` — 59 passed, 0 failed |
| Browser runtime harness | `npx playwright test e2e/manager-capability.spec.ts` — Chromium, 2 passed, 0 failed; redirect URL, observed zero counter, typed denial, and Admin control availability observed |
| Route boundary proof | Built route without flag returned HTTP 404; built route with exactly `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` returned HTTP 200 |
| Required regression checks | `npm run lint` — passed; `npm run build` — passed with the fixture reported dynamic; `npm run test:quote-notifications` — 15 passed; `git diff --check` — passed |
| SQL/runtime limitation | `npm exec supabase db lint --local` — blocked by `127.0.0.1:54322 ECONNREFUSED`; static SQL contracts remain the honest substitute; `0061` was not applied remotely |
| Image/cleanup | Intake image SHA-256 remains `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655`; no unrelated state cleaned |

### Rollback and process boundary

Revert only the guarded fixture/test and this amendment/evidence plus the explicitly reconciled living docs if rejected; preserve the existing Manager role, assignment, migration, and Week 01 recovery state. No staging, commit, push, PR, acquire/settle/review lifecycle command, post-review normalizer, migration application, linked/production data mutation, external traffic, or image change occurred.

## Final bounded remediation — verify-report-contract-reconciliation

- **Request:** `week02-acquire-verify-reconciliation-20260824b`; approved review lineage: `review-9fc146ce79bae86b`.
- Reconciled the foundation boundary: production capability action/RPC/RLS enforcement and audit integration belong exclusively to `week-02-sensitive-capability-enforcement`; this packet retains only role compatibility, static capability contracts, and existing Manager/Admin RLS behavior.
- Reconciled `0061_manager_capability_foundation.sql` as allocated and implemented locally but not applied remotely. Migration and seed use the deterministic persisted description `Management staff for approvals and operational visibility`; `Gerencia` remains presentation-only.
- Replaced the failed verification record with the current schema-valid PASS evidence. The captured-type fixture failure is pre-existing/outside changed paths and non-blocking based on build/type compatibility evidence; generated types and the unrelated test were not edited.
