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

## Slice 2 blocked attempt

- Work unit: `runtime-adapter-boundary`; authorization `tasks-foundation-slice2-20260831a`;
  attempt 1 of 2; parent token retained; delivery `auto-chain`, `stacked-to-main`; maximum
  300 changed lines.
- RED evidence: `node --import tsx --test tests/tasks-runtime.test.ts` failed before the
  adapter existed with `MODULE_NOT_FOUND`, as expected.
- Partial GREEN evidence: the focused slice-1 plus slice-2 suite passed **6/6** after adding
  the adapter and pure boundary tests. `npx tsc --noEmit --pretty false` passed and
  `npm run lint -- --no-cache` passed. No build was run.
- Authoritative runtime evidence: a fresh disposable Supabase **2.115.0** shadow applied
  migrations `0001` through `0062` exactly once. The first authenticated `create_task`
  assertion failed at the live RPC with `ERROR: function digest(text, unknown) does not
  exist` in `create_task` line 30. The migration sets `search_path = public`, while
  `digest` is installed in the `extensions` schema. Therefore runtime evidence is
  authoritative and proves the candidate is not executable as written.
- Cleanup: `supabase stop --no-backup` succeeded and the disposable shadow root was removed.
  No linked, remote, staging, production, or unrelated data was mutated. The transient
  `supabase/.temp/cli-latest` value was restored to `v2.101.0`.
- Changed-line accounting for this attempt: **145 authored lines** (101 adapter + 44
  runtime tests); within the 300-line slice maximum. Tasks 2.1–2.3 remain unchecked because
  accepted runtime evidence is unavailable. Rollback boundary is only
  `lib/admin/tasks.ts` and `tests/tasks-runtime.test.ts`; retain slice 1.
- Blocker: do not modify `0062` silently. A bounded migration correction is required (for
  example, schema-qualifying the proven extension dependency), followed by a fresh runtime
  attempt. This attempt stops before task completion per the authorization instructions.

## Slice 2 corrective retry — accepted GREEN

- Work unit: `runtime-adapter-boundary`; authorization `tasks-foundation-slice2-retry-20260831b`;
  attempt 2 of 2; parent token retained; delivery `auto-chain`, `stacked-to-main`; maximum
  300 changed lines. No objective or scope expansion was made.
- Corrective migration: changed exactly one expression in committed local-only
  `db/migrations/0062_tasks_foundation.sql`, from unqualified `digest(...)` to
  `extensions.digest(...)`. This preserves the fixed `search_path = public`, all existing
  function signatures, grants, checks, RLS, replay, and lifecycle contracts. No other slice-1
  behavior was modified.
- Focused verification: `node --import tsx --test tests/tasks-foundation-contract.test.ts
  tests/tasks-rls.test.ts tests/tasks-runtime.test.ts` — PASS, 6/6; `npx tsc --noEmit
  --pretty false` — PASS; `npm run lint -- --no-cache` — PASS; `git diff --check` — PASS.
- Fresh runtime: disposable Supabase 2.115.0 shadow
  `/tmp/opencode/actravel-tasks-shadow-retry-20260831b` was initialized, started with
  non-database services excluded, and reset with migrations 0001–0062 exactly once. A real
  authenticated-role SQL harness passed canonical pending creation, exact replay without
  duplication, conflict replay PT005, inactive actor PT003, Admin transitions, terminal
  immutability PT006, service-role execute denial, historical read after lead deactivation,
  stale-context denial PT004, and DELETE privilege denial. The previously observed digest
  runtime failure did not recur.
- SQLSTATE boundary coverage remains stable: adapter tests assert PT005/PT006 mappings and
  unknown codes map to `TASK_DATABASE_ERROR`; the migration contains PT001–PT006. The adapter
  retains generated `Tables<"tasks">` typing, canonical UUID/description/context validation,
  deterministic 64-hex SHA-256 keys, and six-digit UTC formatting.
- Cleanup: `npx --yes supabase@2.115.0 stop --workdir
  /tmp/opencode/actravel-tasks-shadow-retry-20260831b --no-backup` completed and the shadow
  root was removed. The temporary SQL harness was removed. No linked, remote, staging,
  production, generated types, image, next-env, Manager/CRM/quotes/leads/dashboard/follow-up,
  data, or unrelated state was changed.
- Exact authored implementation delta for this retry slice: 142 physical lines total — migration
  correction 1 added + 1 removed, retained adapter 101 lines, retained runtime test 39 lines.
  This is within the 300-line slice limit. Rollback boundary is exactly
  `db/migrations/0062_tasks_foundation.sql`,
  `lib/admin/tasks.ts`, and `tests/tasks-runtime.test.ts`; retain all slice-1 artifacts.
- Tasks 2.1–2.3 are marked `[x]` only after accepted runtime GREEN. Slice 2 is complete and
  the next boundary is final verification tasks 3.1–3.3: independent fresh evidence review,
  preservation/no-remote checks, and bounded review/approval. Do not run build or any remote
  lifecycle operation in this apply.

## Final implementation-side apply — `tasks-foundation-final-apply-20260831a`

- Authorization: auto/OpenSpec/auto-chain/stacked-to-main; parent-retained token
  `sha256:8b494332c3aec69b751a00df65148cc8321b9d1285f0427c7a3003c44084dc96`; attempt 1 of 2;
  maximum 60 changed lines. No objective or scope expansion; no acquire/settle.
- `node --import tsx --test tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts
  tests/tasks-runtime.test.ts` — PASS, 6/6 tests, 0 failures.
- `npx tsc --noEmit --pretty false` — PASS; generated `Database` types compile.
- `npm run lint -- --no-cache` — PASS.
- `npm run build` — PASS; Next.js 16.2.6 compiled, TypeScript completed, 96/96 static pages
  generated, route optimization completed.
- Build procedural restoration: build rewrote tracked `next-env.d.ts` from the pre-run SHA-256
  `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc` to the `.next/types`
  import. It was explicitly restored to the pre-run tracked bytes (`./.next/dev/types/routes.d.ts`);
  final SHA-256 is `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`.
- Migration/runtime contracts remain passing from the accepted fresh disposable shadow evidence:
  `0061` then `0062` applied exactly once; authenticated create/replay/conflict, PT003/PT004/PT005/
  PT006, transitions, terminal immutability, historical read, service-role denial, and DELETE
  denial all passed. No linked/remote fallback or mutation was used.
- Preservation proof: pre-existing unrelated untracked planning directories were unchanged;
  after restoration the only tracked working-tree edits are this tasks artifact and this
  apply-progress artifact. No migration, application code, generated types, tests, Manager/CRM/
  quotes/leads/dashboard/follow-up, audit, data, intake image, or unrelated state drifted.
- `git diff --check` — PASS. Final implementation-side changed-line count: 47 lines (32
  additions plus 15 deletions; within
  the 60-line attempt maximum; documentation/evidence only). Rollback boundary is exactly
  `openspec/changes/week-02-tasks-foundation/tasks.md` and `apply-progress.md`.
- Task 3.1 is complete only after all checks above passed. Independent SDD verification (3.2)
  and bounded external review/post-apply approval plus archive (3.3) are preserved in the
  non-checkbox `Post-Task Gates` section of `tasks.md`; they are the next verify/review/archive
  boundary and are not claimed complete here.
