# Apply Progress: Week 02 Tasks Foundation

## Work unit

- Change: `week-02-tasks-foundation`
- Slice: 1 — `schema-rls-rpc-foundation`
- Delivery: `auto-chain`, `stacked-to-main`
- Review budget: 800; slice maximum: 500 changed lines
- Status: **COMPLETE for slice 1; ready for parent review**

## Gate and local inventory

- Archived Gate 0 facts were read from `baseline-report.md` and `verify-report.md`.
- Local inventory confirmed migrations through `0061_manager_capability_foundation.sql`,
  with local `0051` absent and local `0057` present as recorded by Gate 0.
- No linked or production migration was run.
- Failed attempt state: no checkbox was marked complete; tasks 1.1–1.4 remained pending before the corrective retry.

## Corrective retry

- Authorization: `tasks-foundation-slice1-retry-20260830c` (attempt 2 of 2); parent retained token `sha256:961fecb5f2e95da71e026a1e8bd612f7165f6d9289c9951b1cca062ce61bb3a8`.
- Fresh collision-free shadow: `/tmp/opencode/actravel-tasks-shadow-retry-20260830c`.
- `npx --yes supabase@2.115.0 start --help` confirmed official `--exclude/-x` support. The retry excluded `gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`.
- The minimal disposable database reached healthy state; `0061` applied exactly once during reset, then `0062_tasks_foundation.sql` applied exactly once. No linked or remote mutation occurred.
- RED tests were written before the candidate migration and initially failed because `0062` was absent. After implementation, the focused suite passed 3/3.
- Generated types came from the healthy local shadow via `gen types typescript --local`; only exact additive `tasks` table and three function definitions were retained in the tracked type file.

## Commands and exact results

| Command | Result |
|---|---|
| `npx --yes supabase@2.115.0 --version` | PASS — `2.115.0` |
| `npx --yes supabase@2.115.0 start --help` | PASS — official `--exclude/-x` available |
| `npx --yes supabase@2.115.0 init --workdir /tmp/opencode/actravel-tasks-shadow` | PASS — disposable project initialized |
| `npx --yes supabase@2.115.0 start --workdir /tmp/opencode/actravel-tasks-shadow` | BLOCKED — initial migration load reached `0062`, but command timed out; restart health checks reported Vector, Storage, pg-meta, and Studio unhealthy |
| `npx --yes supabase@2.115.0 status --workdir /tmp/opencode/actravel-tasks-shadow` | BLOCKED — local database container was not running |
| `npx --yes supabase@2.115.0 db reset --workdir /tmp/opencode/actravel-tasks-shadow --local --no-seed` | BLOCKED — `supabase start is not running` |
| `node --import tsx --test tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts` | PASS — GREEN, 3/3 tests |
| `npx --yes supabase@2.115.0 stop --workdir /tmp/opencode/actravel-tasks-shadow --no-backup` | PASS — stopped disposable setup |
| `npx --yes supabase@2.115.0 start --workdir /tmp/opencode/actravel-tasks-shadow-retry-20260830c --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes` | PASS — healthy minimal disposable database |
| `npx --yes supabase@2.115.0 db reset --workdir /tmp/opencode/actravel-tasks-shadow-retry-20260830c --local --no-seed` | PASS — migrations through `0062` applied exactly once |
| `npx --yes supabase@2.115.0 gen types typescript --local --workdir /tmp/opencode/actravel-tasks-shadow-retry-20260830c` | PASS — generated 3831-line local schema types |
| `supabase db query --local` catalog/policy/privilege checks | PASS — RLS enabled; one SELECT policy; postgres ownership and fixed search path; anon/service_role execution denied; authenticated execution and SELECT granted |

## Failed-attempt cleanup and preservation

- Temporary shadow root `/tmp/opencode/actravel-tasks-shadow` was removed.
- Failed attempt left no durable migration, tests, generated types, application code, or task checkbox changes.
- The transient CLI cache change to `supabase/.temp/cli-latest` was restored to its pre-run
  byte (`v2.101.0`, no newline).
- Failed-attempt durable changed-line count for implementation: `0`.
- No remote, linked, staging, production, or unrelated data mutation occurred.

Retry durable implementation is now retained in the migration, focused tests, and additive generated type definitions. The prior failed-attempt record above is preserved.

## Work-unit evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | PASS — `node --import tsx --test tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts`; 3/3 passed |
| Runtime harness command/scenario and exact result | PASS — healthy disposable shadow; reset applied 0001–0062; catalog/RLS/grants queries confirmed the ledger and privilege boundary |
| Rollback boundary | Revert only `0062_tasks_foundation.sql`, additive Tasks blocks in `lib/supabase/database.types.ts`, and the two Tasks tests; retain unrelated work |

## Next slice boundary

Slice 1 tasks 1.1–1.4 are complete. Slice 2 begins at `tests/tasks-runtime.test.ts` and
`lib/admin/tasks.ts`; it remains out of scope for this apply.

## Fresh parent pre-allocation gate

- Fresh parent-owned read-only evidence was captured at `2026-08-31T01:34:16Z` and is bound
  to `.opencode-runtime/tasks-parent-preallocation-gate.json` (ignored, nonsecret, no credentials
  or raw user data).
- The evidence uses project URL `https://bdyhakpmxegoipbmbtjb.supabase.co` and ref
  `bdyhakpmxegoipbmbtjb`; operations were `get_project_url`, `list_migrations`,
  `list_tables(public)`, the fixed read-only SQL complete ledger, and read-only security and
  performance advisor fetches.
- `list_migrations` count and complete SQL ledger count are both exactly 59, with verified row-for-row
  equality of their complete ordered `{version,name}` sets; history tails at `20260804005254 / 0060_quote_pdf_creation_cutover`;
  named 0051 is remote-only, 0057 is absent under the accepted Week 01 disposition, and no 0061
  or later migration exists. `tasks` and `staff_notifications` are absent; physical `leads` and
  other tables were unchanged by these reads.
- The complete ledger reports `manager_count=0`, exactly the pre-Manager five roles, the same
  five role predicates for authenticated `SELECT` on roles, and null `tasks`/`staff_notifications`.
  `has_role` and `is_admin` retain postgres ownership, STABLE SECURITY DEFINER,
  `search_path=public`, and unchanged active-profile/delegation semantics.
- Local inventory reaches committed `0061_manager_capability_foundation.sql`; candidate `0062`
  is collision-free against local inventory and fresh remote history. No remote allocation or
  application was performed. The SDD runtime objective remains complete and was not acquired,
  reset, or settled. This correction changes evidence only; implementation is unchanged.

## Changed-line accounting

- Native SDD attempt changed lines: **110** (tracked delta reported by `git status`/diff;
  generated types only).
- Authored retained implementation: **302** lines = migration `0062_tasks_foundation.sql`
  **140** + `tests/tasks-foundation-contract.test.ts` **36** + `tests/tasks-rls.test.ts`
  **16** + tracked generated-type delta **110**.
- SDD evidence/planning artifacts: **400** lines = `proposal.md` **57** + `design.md` **86** +
  `history/README.md` **15** + `specs/tasks-foundation/spec.md` **91** + `tasks.md` **44** +
  final physical `apply-progress.md` **107** lines (including this correction).
- Total review candidate currently attributable to Tasks foundation: **702** lines
  (**302** authored retained implementation + **400** SDD evidence/planning artifacts; the
  ignored parent evidence record is excluded).
- The authorized slice maximum applies to authored slice implementation: **302 ≤ 500**, so this
  evidence correction is not blocked by the slice maximum. The 702-line review candidate is
  reported transparently and remains within the recorded 800-line review budget.

## Bounded ordinary-review correction

- Fixed `R3-hard-delete-context`: storage now permits zero or one context after parent deletion while `create_task` still requires exactly one; contract coverage asserts both boundaries. Correction: **8 changed lines**.
