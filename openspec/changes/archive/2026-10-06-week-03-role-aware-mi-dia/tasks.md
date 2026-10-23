# Tasks: Week 03 Role-Aware Mi día

## Source Authority and Scope

These tasks translate the final proposal, the two change specifications, and the design into five dependency-ordered behavior slices plus a local Gate 0. The specification structure remains exactly **21 requirements / 81 scenarios**. Delivery is local/disposable only: no remote inspection or mutation, linked type generation, deployment, rollout, production-readiness claim, or Week 03 closure is authorized.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Up to 1,979 authored additions plus deletions across five native slices |
| Native-slice budgets | S1 399; S2 390; S3 400; S4 400; S5 390 |
| 400-line budget risk | High overall; hard-bounded per slice |
| Chained PRs recommended | Yes; five serial native slices in three review packets, each strictly below 1,200 lines |
| Suggested split | P1 `S1–S2` (≤789) → P2 `S3–S4` (≤800) → P3 `S5` (≤390) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Auto-chain order is strictly `Gate 0 -> S1 -> S2 -> S3 -> S4 -> S5`. Each native slice starts from its integrated predecessor and remains behavior-complete, independently testable, and reversible within its stated boundary. This chain metadata does not authorize branch creation, commits, pushes, fetches, PR creation, remote inspection, or file transfer.

### Three Review Packets (<1,200 Changed Lines Each)

| Packet | Native slices | Hard maximum | Base boundary |
|---|---|---:|---|
| P1 | S1–S2 | 789 | S1 uses the current local worktree baseline; S2 starts only after S1 completion and independent accounting |
| P2 | S3–S4 | 800 | S3 starts after S2; S4 starts after S3 |
| P3 | S5 | 390 | S5 starts after S4 and owns final routing, preservation, and local documentation evidence |

A packet MUST close before adding a slice when its realized cumulative changed lines would reach or exceed 1,200. A native slice above 400 lines or above any owned-file ceiling MUST stop and split at a complete behavior boundary; test-later, docs-later, proof-only, and compressed-proof splits are forbidden.

### Suggested Work Units

| Unit | Goal | Likely PRs | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| P1 | Constrained `0089` read boundary plus strict server adapter | S1 → S2 | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-adapter.test.ts` | `RUN_MI_DIA_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-read-runtime.test.ts`; disposable PostgreSQL 16, serial, bounded, final container-absence proof | Remove the unused adapter/types, then revoke/drop only the unused local Mi día RPC/index; preserve `0061`–`0088` and all canonical rows |
| P2 | Isolated Dashboard queue plus audited action behavior | S3 → S4 | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-actions.test.ts tests/task-actions-adapter.test.ts tests/follow-up-task-dashboard-cutover.test.ts tests/admin-route-boundaries.test.ts` and `node --import tsx --test --test-concurrency=1 tests/mi-dia-page.test.tsx` | `RUN_TASK_AUTOMATION_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-lifecycle.test.ts tests/task-action-races.test.ts tests/task-action-receipt-integrity.test.ts tests/task-action-receipt-visibility.test.ts`; disposable PostgreSQL 16 | Remove forms/actions first, then restore the legacy Dashboard composition; retain every Task and immutable receipt |
| P3 | Role-aware shell routing, safe route error, browser proof, preservation, and local docs | S5 | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-adapter.test.ts tests/mi-dia-actions.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts tests/follow-up-task-dashboard-cutover.test.ts` | `npm run test:e2e -- e2e/manager-capability.spec.ts` plus the exact S5 disposable PostgreSQL preservation commands below; external E2E boundaries remain disabled | Revert S5 docs/fixtures/routing/error first, then S4 → S1; never delete Tasks, receipts, origins, outcomes, tombstones, or events |

## Result Contract and Coverage Counts

| Specification | Public boundary covered | Slice ownership | Requirements / scenarios |
|---|---|---|---:|
| `role-aware-mi-dia` | Supported scope, authorized read page, strict adapter, Dashboard states, audited actions, revalidation, navigation, accessibility, preservation, rollback | S1–S5 | 18 / 74 |
| `follow-up-task-application-cutover` delta | Bounded Dashboard Task queue, unchanged Task-RLS authority, no deferred expansion | S1, S3, S5 | 3 / 7 |
| **Total preserved** | Two unchanged specification files | **S1–S5** | **21 / 81** |

- Read request is exactly `{cursor}`, where first page uses `null` and later pages use exactly `{referenceTime,afterDueAt,afterId}`. The internal RPC input is exactly `{referenceTime,limit,afterDueAt,afterId}`, with application limit `20`.
- Read success is exactly `{ok:true,referenceTime,todayStart,tomorrowStart,scope,counts,items,pageInfo}`; counts are exactly `{overdue,today,upcoming,total}` and each item has exactly `{taskId,ownerId,ownerLabel,kind,status,description,dueAt,bucket,leadId,quoteId,navigationHref}`.
- Read failure is code-only `AUTH_REQUIRED|AUTH_INACTIVE|AUTH_ROLE_UNSUPPORTED|AUTH_ACTOR_MISMATCH|INVALID_REQUEST|PERSISTENCE_FAILURE`, with `message=code`, no partial items, provider text, PII, second source, or event fallback.
- Action form input is exactly `{requestId,taskId,intent,taskKind,cancelReason}`. The wrapper denies unsupported actors before lookup/action; supported actions reuse `performTaskAction`/`task_action` unchanged, preserve retry identity, treat `already_at_target` as success, and expose only the specified safe Spanish copy.
- `/admin/dashboard` remains stable. Supported Admin/Manager/Asesor unions receive Mi día; unsupported-only Operations/Finance/Marketing retain the complete legacy Dashboard and `Resumen` presentation without a Mi día read or action setup.

## Shared Slice Baseline, Completion, Preservation, and Ownership Contract

### Mixed-worktree-safe snapshot and accounting

Every S1–S5 RED task MUST complete this protocol before its GREEN task:

1. Resolve the repository root with `git rev-parse --show-toplevel`; freeze the complete owned-path budget table as a sorted, duplicate-free, NUL-delimited manifest. Reject empty, absolute, parent-traversing, out-of-root, symlink, directory, device, and unowned entries. Adding an owned path requires discarding the baseline and restarting the slice.
2. Create a unique baseline beneath `/tmp/opencode` outside the worktree. Copy each current regular file to `before/`; record an explicit absent marker otherwise. Record byte length, SHA-256, local `git status --porcelain=v2 -z` classification, and `git ls-files --stage -z` entries, then seal the manifest hash. Existing tracked, staged, unstaged, and untracked bytes are baseline, not slice work.
3. Edit only frozen owned paths. After final code, evidence, checkbox, and `ACTIVE.md` bytes exist, create the matching `after/` snapshot; re-hash every `before/` copy and fail if the baseline changed.
4. Count with `git diff --no-index --no-renames --numstat -z -- "$baseline/before" "$baseline/after"`; accept only exits 0/1 and reject binary counts, rename inference, parse ambiguity, missing paths, or paths outside the manifest. Record additions and deletions for every path, including zero, create, and delete transitions.
5. A second process/operator independently reconstructs the final snapshot from the sealed pre-slice manifest, recomputes every count, verifies the budget table and report, reruns protected checks, and proves the accounting command left worktree bytes, porcelain-v2 status, and index stage OIDs unchanged.
6. Remove only the unique temporary baseline in `finally` and prove absence. Retain manifest hashes, per-file counts, total, verifier result, and cleanup result in `apply-progress.md`; never commit temporary copies.

S1's accounting RED fixture MUST first demonstrate that a HEAD-relative count is wrong, then prove the snapshot method across tracked, staged, unstaged, untracked, absent-created, deleted, and space-containing paths; reject `../`, symlinks, binary numstat, `exec`, `shell:true`, interpolation into shell strings, and commands outside the read-only Git allowlist. Injected snapshot/diff/verifier/spawn/readiness/scenario failures MUST still clean up. Every later slice reruns this fixture against its frozen manifest.

### Completion, preservation, and documentation ownership

1. Write the named failing behavior/threat tests and record the expected RED result before production edits; then implement GREEN and run the exact focused/runtime/type commands for that slice.
2. Gate 0 records direct working-tree SHA-256 values for exactly migration numbers `0061`–`0088`; S1 materializes `0061-0088.sha256` from that receipt, and S1–S5 verify it after behavior while S2–S5 also verify it before behavior. A missing/extra number or byte mismatch stops the chain; never bless changed historical bytes.
3. Preserve canonical Task RLS/action/automation/cutover/history behavior. Never modify `lib/admin/task-actions.ts`, migrations `0061`–`0088`, existing CRM readers, notification code, Tasks, action receipts, historical apply receipts, origins, outcomes, tombstones, or events.
4. Each GREEN task records RED/GREEN commands, runtime result or explicit N/A, exact per-file and total counts, headroom to 400, packet cumulative count, baseline/verifier hashes, cleanup proof, preservation result, and rollback boundary in `apply-progress.md`; it checks off only its own RED/GREEN tasks and atomically advances `docs/implementation/ACTIVE.md`.
5. S5 alone owns `docs/DECISIONS.md` and `docs/PROGRESS.md`. S5 also exclusively owns role-aware shell navigation and `dashboard/error.tsx`; S1–S4 must not claim their delivery.
6. No slice may use Supabase MCP/CLI, linked type generation, network access, remote credentials/sessions, branch mutation, staging, commit, fetch, push, PR creation, deployment, or rollout.

### Applicable threat cases and RED ownership

| Applicable boundary | RED ownership |
|---|---|
| Application routing | S1/S2 prove helper-gated nullable links and strict cursor/path shape; S4 proves no form-controlled path or denied revalidation; S5 proves fixed prefixes, stale/inaccessible null links, unsupported no-work branching, safe route reset, and the `Mi día`/`Resumen` matrix before routing production changes |
| Shell command construction | S1 creates the NUL-safe mixed-state fixture and read-only command allowlist; every slice reruns it before GREEN |
| Subprocess lifecycle/process integration | S1 proves snapshot and disposable-PostgreSQL cleanup under injected failures; S4 and S5 rerun serial bounded database scenarios with mandatory final absence |
| VCS/PR automation | S1 proves HEAD-relative accounting fails, snapshot accounting succeeds, index/status/OIDs stay unchanged, and only the read-only local Git allowlist is used; every slice independently re-verifies this |

## Phase 0: Gate 0 — Local Allocation, Current Helpers, and Protected Receipts

- [x] 0.1 **Gate 0 (preflight; not an implementation slice).** Inspect only the local mixed worktree: record root/current HEAD/scoped status; verify `openspec/changes/week-03-role-aware-mi-dia/proposal.md` (read-only), `openspec/changes/week-03-role-aware-mi-dia/design.md` (read-only), `openspec/changes/week-03-role-aware-mi-dia/specs/role-aware-mi-dia/spec.md` (read-only), and `openspec/changes/week-03-role-aware-mi-dia/specs/follow-up-task-application-cutover/spec.md` (read-only) exist and still count 21/81; prove `db/migrations/0089_*.sql` (read-only) is unallocated; inspect exact current helpers/policies in `db/migrations/0052_crm_contact_360_rpc_contracts.sql` (read-only), `db/migrations/0053_quotes_header_foundation.sql` (read-only), and `db/migrations/0062_tasks_foundation.sql` (read-only), plus the unchanged canonical adapter `lib/admin/task-actions.ts` (read-only); verify protected receipt boundaries in `db/migrations/0077_task_action_audit_foundation.sql` (read-only), `db/migrations/0078_task_action_rpc.sql` (read-only), `db/migrations/0084_task_automation_historical_apply_receipt.sql` (read-only), `db/migrations/0087_task_automation_historical_apply_rpc.sql` (read-only), and `db/migrations/0088_task_automation_historical_readiness.sql` (read-only), plus `openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap/archive-report.md` (read-only) and `openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap/verify-report.md` (read-only); inventory and directly hash exactly `db/migrations/0061_*.sql` through `db/migrations/0088_*.sql` (read-only); then create the opening local receipt in `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`. Stop and replan on any allocation, helper/policy drift, missing/extra migration, receipt-integrity mismatch, authority-artifact mismatch, or unexpected owner; perform no remote or Git-mutating operation.

## Phase 1: S1 — Authorized `0089` Page Boundary (399 Lines)

| Owned file | Maximum additions + deletions |
|---|---:|
| `db/migrations/0089_mi_dia_read_contract.sql` | 180 |
| `lib/supabase/database.types.ts` | 10 |
| `tests/mi-dia-read-contract.test.ts` | 45 |
| `tests/mi-dia-read-runtime.test.ts` | 100 |
| `openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256` | 28 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 18 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 8 |
| `docs/implementation/ACTIVE.md` | 10 |
| **S1 hard maximum** | **399** |

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts
RUN_MI_DIA_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-read-runtime.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

- [x] 1.1 **S1 RED (depends on Gate 0).** In `tests/mi-dia-read-contract.test.ts` and `tests/mi-dia-read-runtime.test.ts`, add failing proof for the exact sole `STABLE SECURITY DEFINER` identity/owner/empty search path/no defaults or overloads/closed ACL order/fully qualified body; index, auth precedence, scope, per-row `task_actor_can_manage`, supported-role complete-pagination direct-RLS Task-ID parity, non-vacuous unsupported self-owned `AUTH_ROLE_UNSUPPORTED` before lookup/projection, labels, exact `crm_advisor_can_access_live_opportunity` and `crm_can_read_quote` link authority with stale/inaccessible nulls, context/count/time/keyset/limit+1 behavior, direct profile denial, no DML/policy/grant broadening, protected hashes, and the shell/process/read-only-VCS threat fixture. Freeze the S1 snapshot first and capture the expected failures from the commands above before production work.
- [x] 1.2 **S1 GREEN and completion (depends on 1.1).** Create `db/migrations/0089_mi_dia_read_contract.sql` and `openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256`, modify only the exact RPC block in `lib/supabase/database.types.ts`, satisfy the RED/runtime cases, and finalize S1 evidence in `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, and `docs/implementation/ACTIVE.md`. Complete only after disposable PostgreSQL 16 applies the local chain through `0089` serially, all commands pass, the container and baseline are absent, independent accounting is ≤399 and within every file ceiling, and `0061`–`0088` match Gate 0. Rollback: revoke/drop only the unused local RPC/index and remove the manual type/manifest/evidence; no operational row changes or protected-byte edits.

## Phase 2: S2 — Auth-First Strict Adapter and Cursor Contract (390 Lines)

| Owned file | Maximum additions + deletions |
|---|---:|
| `lib/admin/mi-dia-scope.ts` | 28 |
| `lib/admin/mi-dia.ts` | 190 |
| `tests/mi-dia-adapter.test.ts` | 130 |
| `tests/mi-dia-read-contract.test.ts` | 8 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 17 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 7 |
| `docs/implementation/ACTIVE.md` | 10 |
| **S2 hard maximum** | **390** |

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-adapter.test.ts tests/mi-dia-read-contract.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

- [x] 2.1 **S2 RED (depends on S1).** In `tests/mi-dia-adapter.test.ts` and `tests/mi-dia-read-contract.test.ts`, add failing cases for exact auth/profile/role precedence, recognized multirole scope, no read-client construction before auth and request validation, first-page microsecond time, exact/partial/extra/array cursor handling, exact RPC args, Mexico City boundaries, hostile objects/arrays/accessors/proxies/symbols/sparse arrays, exact key sets and closed values, uniqueness/order/count/cursor equations, provider redaction, null-preserving navigation, and non-null Admin or Asesor-self role/owner/kind/context/fixed-prefix coherence. Prove stale/inaccessible/helper-false links remain null and Task ownership never upgrades them; freeze and verify the S2 mixed-worktree snapshot before implementation.
- [x] 2.2 **S2 GREEN and completion (depends on 2.1).** Create `lib/admin/mi-dia-scope.ts` and `lib/admin/mi-dia.ts`, satisfy the strict two-client adapter and decoder contract, and finalize S2 evidence in `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, and `docs/implementation/ACTIVE.md`. Runtime is N/A because clients and clock are injected; S1 retains SQL integration proof. Complete only after focused/type/hash commands pass, independent accounting is ≤390 and P1 is <1,200, and cleanup/preservation receipts pass. Rollback: remove adapter/scope and tests while leaving the unused local RPC disabled or present; do not alter historical migrations or canonical state.

## Phase 3: S3 — Read-Only Dashboard Queue and Complete Read States (400 Lines)

| Owned file | Maximum additions + deletions |
|---|---:|
| `lib/admin/dashboard.ts` | 35 |
| `lib/admin/page-compositions.ts` | 40 |
| `app/admin/(protected)/dashboard/page.tsx` | 60 |
| `app/admin/(protected)/dashboard/loading.tsx` | 18 |
| `components/admin/tasks/mi-dia-task-list.tsx` | 110 |
| `tests/mi-dia-page.test.tsx` | 65 |
| `tests/follow-up-task-dashboard-cutover.test.ts` | 18 |
| `tests/admin-route-boundaries.test.ts` | 12 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 20 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 10 |
| `docs/implementation/ACTIVE.md` | 12 |
| **S3 hard maximum** | **400** |

```bash
node --import tsx --test --test-concurrency=1 tests/mi-dia-page.test.tsx
FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test --test-concurrency=1 tests/follow-up-task-dashboard-cutover.test.ts tests/admin-route-boundaries.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

- [x] 3.1 **S3 RED (depends on S2).** In `tests/mi-dia-page.test.tsx`, `tests/follow-up-task-dashboard-cutover.test.ts`, and `tests/admin-route-boundaries.test.ts`, add failing composition/render proof that supported roles stop the legacy queue, unsupported-only roles perform zero Mi día setup/read and preserve byte-for-behavior Dashboard content, existing Manager fallback remains independent, auth precedes read, and Mi día renders first with isolated loading, self/team/all empty, safe local read failure, complete counts, contiguous bucket/list order, Mexico City `<time>`, and issued-cursor pagination states. Freeze S3 accounting before production; do not test or claim shell-navigation labels or the route-level error boundary here.
- [x] 3.2 **S3 GREEN and completion (depends on 3.1).** Modify `lib/admin/dashboard.ts`, `lib/admin/page-compositions.ts`, and `app/admin/(protected)/dashboard/page.tsx`; create `app/admin/(protected)/dashboard/loading.tsx` and `components/admin/tasks/mi-dia-task-list.tsx`; satisfy the RED cases; and finalize S3 evidence in `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, and `docs/implementation/ACTIVE.md`. Runtime is N/A because proof is server/static markup and injected composition only. Complete only after all commands pass, independent accounting is ≤400 with no file over ceiling, preserved content remains visible on Mi día failure, and S5 ownership is untouched. Rollback: remove read UI and restore the default legacy composition call; S1/S2 may remain unused.

## Phase 4: S4 — Audited Actions, Retry Identity, and Authorized Revalidation (400 Lines)

| Owned file | Maximum additions + deletions |
|---|---:|
| `app/admin/(protected)/dashboard/action-state.ts` | 28 |
| `app/admin/(protected)/dashboard/actions.ts` | 100 |
| `components/admin/tasks/mi-dia-task-actions.tsx` | 85 |
| `components/admin/tasks/mi-dia-task-list.tsx` | 20 |
| `lib/admin/mi-dia.ts` | 20 |
| `tests/mi-dia-actions.test.ts` | 85 |
| `tests/mi-dia-page.test.tsx` | 20 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 20 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 10 |
| `docs/implementation/ACTIVE.md` | 12 |
| **S4 hard maximum** | **400** |

```bash
node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-actions.test.ts tests/task-actions-adapter.test.ts
RUN_TASK_AUTOMATION_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-lifecycle.test.ts tests/task-action-races.test.ts tests/task-action-receipt-integrity.test.ts tests/task-action-receipt-visibility.test.ts
npx tsc --noEmit
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
```

- [x] 4.1 **S4 RED (depends on S3).** In `tests/mi-dia-actions.test.ts` and `tests/mi-dia-page.test.tsx`, add failing cases proving wrapper auth precedes parsing-dependent Task lookup and every mutation/revalidation dependency; unauthenticated, inactive, Operations-only, Finance-only, Marketing-only, recognized unsupported-only, and unknown-only actors return exact wrapper code/copy with zero Task lookup, CRM helper, canonical action, receipt mutation, or revalidation. Every unsupported role submits a self-owned active admitted Task ID that the lookup spy would return. Also prove exact five-key parsing, actual-kind tie, helper-gated current Lead/Quote context, stale/inaccessible null context, start/kind-aware complete/cancel mapping, closed safe-copy mapping, replay/already-target success, stable/replaced request IDs, pending/no optimistic state, focus/live feedback, Dashboard plus authorized-context revalidation, forged path rejection, zero failure revalidation, and no `AUTH_ROLE_UNSUPPORTED` change to the canonical union. Freeze S4 accounting before production.
- [x] 4.2 **S4 GREEN and completion (depends on 4.1).** Create `app/admin/(protected)/dashboard/action-state.ts`, `app/admin/(protected)/dashboard/actions.ts`, and `components/admin/tasks/mi-dia-task-actions.tsx`; modify only the allocated action hooks in `components/admin/tasks/mi-dia-task-list.tsx` and `lib/admin/mi-dia.ts`; satisfy RED and unchanged canonical receipt/lifecycle runtime suites; and finalize S4 evidence in `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, `openspec/changes/week-03-role-aware-mi-dia/tasks.md`, and `docs/implementation/ACTIVE.md`. Complete only after commands pass serially, the disposable container/baseline are absent, accounting is ≤400 and P2 is <1,200, and no direct Task update or receipt read exists. Rollback: remove forms/action state/server action first; retain every Task and receipt and keep `performTaskAction`/`task_action` unchanged.

## Phase 5: S5 — Routing, Route Error, Browser Accessibility, Preservation, and Local Docs (390 Lines)

| Owned file | Maximum additions + deletions |
|---|---:|
| `app/admin/(protected)/dashboard/error.tsx` | 19 |
| `components/admin/admin-nav.ts` | 6 |
| `components/admin/admin-shell-client.tsx` | 4 |
| `tests/admin-navigation.test.ts` | 20 |
| `tests/admin-route-boundaries.test.ts` | 28 |
| `app/e2e-manager-capability/page.tsx` | 36 |
| `app/e2e-manager-capability/actions.ts` | 13 |
| `app/e2e-manager-capability/route-error-fixture.tsx` | 12 |
| `e2e/manager-capability.spec.ts` | 90 |
| `tests/task-automation-cutover-preservation.test.ts` | 12 |
| `tests/task-automation-historical-preservation.test.ts` | 2 |
| `docs/DECISIONS.md` | 6 |
| `docs/PROGRESS.md` | 16 |
| `docs/implementation/ACTIVE.md` | 16 |
| `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md` | 30 |
| `openspec/changes/week-03-role-aware-mi-dia/design.md` | 38 |
| `openspec/changes/week-03-role-aware-mi-dia/tasks.md` | 40 |
| Unallocated correction reserve | 2 |
| **S5 hard maximum** | **390** |

```bash
FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-contract.test.ts tests/mi-dia-adapter.test.ts tests/mi-dia-actions.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts tests/follow-up-task-dashboard-cutover.test.ts
node --import tsx --test --test-concurrency=1 tests/mi-dia-page.test.tsx
npm run test:e2e -- e2e/manager-capability.spec.ts
```

```bash
RUN_MI_DIA_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/mi-dia-read-runtime.test.ts
RUN_TASK_AUTOMATION_DB_TESTS=1 RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-*.test.ts tests/task-actions-*.test.ts tests/task-automation-*.test.ts tests/task-source-*.test.ts
FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/tasks-*.test.ts tests/follow-up-task-*.test.ts tests/crm-contact-*-task-read-runtime.test.ts tests/lead-events-append-only-runtime.test.ts
sha256sum -c openspec/changes/week-03-role-aware-mi-dia/0061-0088.sha256
npm run lint
npx tsc --noEmit
npm run build
```

- [x] 5.1 **S5 RED (depends on S4).** In `tests/admin-navigation.test.ts`, `tests/admin-route-boundaries.test.ts`, and `e2e/manager-capability.spec.ts`, add failing routing/browser proof for supported `Mi día` versus unsupported `Resumen`, unchanged `/admin/dashboard`, active Home title derivation, safe focused route-error/reset with no provider text, fixed-prefix links, direct Manager CRM denial, exact current Asesor Lead/Quote helper authority, stale/inaccessible/helper-false null links, unsupported self-owned Task no-read/no-action, keyboard order, busy/disabled behavior, live regions, failure focus, semantic time/lists, and complete unsupported Dashboard/navigation preservation. Freeze S5 accounting first and cover every application-routing threat case before production routing/error edits.
- [x] 5.2 **S5 GREEN, aggregate preservation, and local completion (depends on 5.1).** Create `app/admin/(protected)/dashboard/error.tsx` and `app/e2e-manager-capability/actions.ts`; modify `components/admin/admin-nav.ts`, `components/admin/admin-shell-client.tsx`, `tests/admin-navigation.test.ts`, `tests/admin-route-boundaries.test.ts`, `app/e2e-manager-capability/page.tsx`, and `e2e/manager-capability.spec.ts`; satisfy focused browser/routing proof; then record only the durable definer rationale in `docs/DECISIONS.md`, verified local state in `docs/PROGRESS.md`, and final evidence/status in `docs/implementation/ACTIVE.md`, `openspec/changes/week-03-role-aware-mi-dia/apply-progress.md`, and `openspec/changes/week-03-role-aware-mi-dia/tasks.md`. Complete only after all focused, E2E, disposable runtime, regression, hash, lint, type, and build commands pass with zero enabled-suite skips; independent accounting is ≤390 and P3 <1,200; all baselines/containers are absent; 21/81 remains unchanged; and reports explicitly deny remote parity, rollout, production readiness, and Week 03 closure. Rollback: revert S5 routing/error/fixtures/docs, then S4 → S1 caller-first; preserve `0061`–`0088` and all Tasks, receipts, origins, outcomes, tombstones, and events.

## Explicit Exclusions and Rollback Guard

- No new Task kinds, policies, role capabilities, lifecycle transitions, broad CRM/profile grants, notifications, automation rules, receipt timeline, event fallback, reassignment, rescheduling, bulk action, rollout, or closure behavior belongs to these tasks.
- Unapplied local rollback is caller-first: remove S5/S4/S3 presentation and action callers, then S2 adapter/types, then only the unused S1 migration/index/function.
- Any future applied rollback requires separate authorization and a new forward migration after callers are removed. Never edit historical migrations, delete canonical state, restore `task_transition`, rewrite events, weaken authorization, or infer remote readiness.
