# Apply Progress: Week 03 Follow-up Task Approval Ledger

## AUTHORITATIVE CURRENT STATE — PR2 correction transaction

- Status: runtime proof passed exactly once after the required DELETE immutability assertion was
  added. Evidence revision: `sha256:d814a4923222d8be1203c1387d26209c5f55706f74911de3e5103dedbb58beb6`.
  This supersedes all earlier apply-progress outcomes and failed-attempt conclusions below.
- Native authorization: token
  `sha256:4b02cf1e25a2c5d9db831e25ba8d88bdbfcddfda873042db27c009fd53170b0c`, request
  `approval-ledger-pr2-runtime-20260907-14`; acquire/settle remain parent-owned. No review or
  commit evidence is claimed.
- Checks: focused static approval test 5/5 PASS; TypeScript PASS; lint PASS; diff check PASS;
  disposable runtime PASS 1/1 exactly once. Runtime covered approval, replay, idempotency
  conflict, AUTH_REQUIRED, authenticated advisor RLS visibility, concurrent convergence, UPDATE
  rejection, DELETE rejection, purge survival, and zero Task-DML behavior. Cleanup and container
  absence passed.
- Tasks: 2.1 complete; 2.2 complete; 2.3 **PENDING** for parent review/commit. This status does
  not claim parent review, commit, push, or lifecycle completion.
- Transaction classification and boundary: cumulative migration 0065 and static-contract edits
  are runtime-discovered PR1 foundation corrections included in the PR2 correction transaction;
  PR2 was not runtime-test-only. The honest rollback/review boundary is
  `db/migrations/0065_follow_up_task_approval_ledger.sql`,
  `tests/follow-up-task-approval.test.ts`,
  `tests/follow-up-task-approval-ledger-runtime.test.ts`, and these OpenSpec task/progress
  artifacts. Adapter/types/PR3+ work and unrelated Week1 files are outside the boundary.
  Production grants remain unchanged; metadata grants are disposable fixture setup only.

## Superseded historical evidence

All sections below preserve prior evidence for auditability. Their failed outcomes and earlier
passing state are superseded by the authoritative state above.

## Work unit

PR 1, stacked-to-main: migration and static contract only. Standard mode; no test
runner strict-TDD configuration was present. This maintainer-authorized corrective retry
is bounded by native parent token `sha256:0394fcf1759e6442ecb7680818a346eeb3d8209612e06d346a4de84750aa3851`.

## Completed tasks

- [x] 1.1 RED static contract test.
- [x] 1.2 0065 migration and GREEN static contract.
- [x] 1.3 bounded PR 1 handoff.

## TDD cycle evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | `node --import tsx --test tests/follow-up-task-approval.test.ts` failed before 0065 existed (`existsSync` false and migration read `ENOENT`). | N/A — contract-only RED completed before migration. | Corrected one test regex typo without changing the contract scope. |
| 1.2 | Existing static contracts failed against the absent migration. | Focused static suite: 5/5 passing after corrective migration/test changes. | Split null/actor precedence; nested the exact header; separated shape/semantic checks from limit classification; isolated count exceptions; strengthened count/projection/replay assertions. |
| 1.3 | N/A | `npx tsc --noEmit`, `npm run lint`, and `git diff --check` all passed. | N/A |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/follow-up-task-approval.test.ts` — PASS, 5/5 tests, 0 failures. |
| Runtime harness command/scenario and exact result | N/A — this PR is explicitly SQL text/static-contract only; runtime PostgreSQL is PR 2. |
| Rollback boundary | Delete `db/migrations/0065_follow_up_task_approval_ledger.sql` and `tests/follow-up-task-approval.test.ts`; revert this change's task/progress artifacts only. |

## Corrective retry evidence

- RED assertions were strengthened first for null actor/cutoff precedence, canonical cutoff/plan equality, ten-shape/nine-field rows, seven count equations, legal matrix, static header, exact projection, limits, exact replay identity, and UPDATE/DELETE rejection.
- GREEN corrected only migration 0065 and this focused static test. PR 2 remains entirely pending.

## Verification and boundary

- `npx tsc --noEmit --incremental false` — PASS.
- `npm run lint` — PASS.
- `git diff --check` — PASS; tracked task delta is bounded and implementation correction remains below the 250 changed-line budget relative to the native parent token.
- No generated types, adapter, runtime harness, Docker, database, remote, lifecycle, staging, or Gentle-AI operation was used.
- No Task table DML is present in 0065.
- Correction scope is exactly `db/migrations/0065_follow_up_task_approval_ledger.sql`, `tests/follow-up-task-approval.test.ts`, and these SDD artifacts; no PR 2 task was advanced.

## Handoff

Ready for parent review/commit, then PR 2. The parent owns commit and PR lifecycle actions.

## Work unit 2

PR 2, stacked-to-main: disposable PostgreSQL runtime proof. Standard mode; the runtime
attempt was authorized by the parent for at most two attempts. The test uses only the archived
`tests/helpers/postgres-runtime.ts` lifecycle and applies migrations 0057–0065 inside a local
disposable container.

## Completed tasks

- [x] 1.1 RED static contract test.
- [x] 1.2 0065 migration and GREEN static contract.
- [x] 1.3 bounded PR 1 handoff.
- [x] 2.1 RED runtime scenarios and shared-helper wiring.
- [ ] 2.2 GREEN guarded runtime proof.
- [ ] 2.3 bounded PR 2 handoff.

## Work Unit 2 Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` — FAILED on both authorized attempts before the first approval assertion. First attempt exposed invalid JSON construction for UUID projection fields; the fixture was corrected. Second attempt exposed missing runtime grant on `extensions`; the fixture now grants schema usage, but the attempt budget is exhausted. |
| Runtime harness command/scenario and exact result | Same authorized command — FAILED; Docker started and was cleaned up on both attempts. No remote or linked Supabase access occurred. |
| Rollback boundary | Delete `tests/follow-up-task-approval-ledger-runtime.test.ts` and revert only the PR 2 task/progress entries; migration 0065 and PR 1 static contracts remain untouched. |

## Attempt handoff

- Outcome: `failed` (authorized max attempts exhausted).
- Proven diagnosis: attempt 1 was a test-fixture UUID-to-JSON cast error; attempt 2 was a disposable-harness permission omission for the `extensions` schema. Neither failure established a defect in migration 0065.
- Harness disposition: `reused` — the archived helper was reused without modification; the runtime test's database bootstrap grants the helper's required extension usage.
- Cleanup evidence: `cleanupPostgres()` ran in `finally` on both attempts; the post-cleanup container absence assertion was reached successfully on each failed run.
- Process evidence: Docker container started, PostgreSQL became ready, base database and disposable `approval_ledger` database were created, and migrations 0057–0065 were applied before each failure. No linked/remote operation was performed.
- Evidence revision SHA-256: `f98df89cf06178e3ec6cfa031f533845447498fff82bc12283be9be4f644b685` (runtime test source snapshot).

## Verification and boundary

- `node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` — PASS as guarded skip, 1 skipped, 0 failures.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS.
- `git diff --check` — PASS.
- PR 2 is not ready for verify because the authorized runtime proof did not complete successfully.

## Corrective retry evidence

- Attempt request: `approval-ledger-pr2-runtime-20260907-05`.
- Outcome: `failed`; exactly one final authorized runtime invocation was used.
- Focused command: `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` — FAILED during fixture SQL before the first approval assertion with `permission denied for function follow_up_canonical_json`.
- Diagnosis: the corrected fixture grants schema usage on `extensions`, but the migration intentionally revokes execute on `public.follow_up_canonical_json(jsonb)` from authenticated. The fixture computes canonical values while the session is authenticated, so setup cannot reach the RPC. This is a test-fixture privilege/setup defect, not evidence of a migration 0065 runtime contract failure.
- Harness disposition: `reused`; archived helper unchanged and corrected candidate retained.
- Cleanup evidence: the test reached `finally`; `cleanupPostgres()` ran and the post-absence assertion succeeded after the failed run.
- Process evidence: Docker started, PostgreSQL became ready, `quote_base` and `approval_ledger` were created, migrations 0057–0065 applied locally, then fixture SQL failed. No linked or remote Supabase access occurred.
- New evidence revision SHA-256: `c50ce421f3bde63684887aec43805aed334a582b995b5a81857995f9502f0063`.
- Non-runtime checks: `npx tsc --noEmit` PASS; `npm run lint` PASS; `git diff --check` PASS.
- Tasks 2.2 and 2.3 remain unchecked; PR 1 history and task 2.1 are preserved.

## Maintainer-authorized PR 2 recovery attempt

- Work unit: `PR2 privileged fixture correction`.
- Authorization: proceed; request `approval-ledger-pr2-runtime-20260907-06`; parent-owned
  native runtime transitions were not acquired or settled. The attempt was limited to one
  disposable PostgreSQL invocation and the runtime test file only.
- Correction: canonical row, plan, projection, request, and hash construction now occur while
  the setup session has `set role postgres`; the resulting values are placed in a temporary
  `approval_input` table, explicitly granted to `authenticated`, and only the RPC invocation
  runs after `actorSession`. Authenticated fixture execution therefore does not require
  `EXECUTE` on the intentionally private `follow_up_canonical_json` helper.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED at the first approval assertion (`false !== true`, runtime test line 126), before
  replay, conflict, immutability, purge-survival, or concurrency assertions. The test did not
  print the returned domain JSON, so no unobserved domain error code is asserted here; the exact
  observed failure is the RPC success assertion receiving `ok: false`.
- Outcome: `failed`; the maintainer-authorized attempt budget is exhausted. Tasks 2.2 and 2.3
  remain unchecked. The failed evidence `c50ce421f3bde63684887aec43805aed334a582b995b5a81857995f9502f0063`
  was not overwritten.
- Harness disposition: `reused`; `tests/helpers/postgres-runtime.ts` and migration 0065 were
  unchanged. No linked or remote Supabase access, migration edit, or migration application
  outside the disposable database occurred.
- Cleanup evidence: the runtime test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed.
- Process evidence: Docker started, PostgreSQL became ready, `quote_base` and `approval_ledger`
  were created, migrations 0057–0065 were applied in lexical order, privileged fixture setup
  completed, and the first authenticated RPC returned the observed failure. No later runtime
  invocation was made.
- New evidence revision SHA-256: `12967d523ad1d7a3ae90b147de7ad38857fb93178989a8fa3da7d408990e211e`.
- Non-runtime checks after the single runtime attempt: `npx tsc --noEmit` PASS; `npm run lint`
  PASS; `git diff --check` PASS.
- Changed path: `tests/follow-up-task-approval-ledger-runtime.test.ts` only for implementation;
  migration 0065, adapter, types, docs, PR 3+, and unrelated Week 1 untracked files remain
  untouched.

## Final maintainer-authorized PR 2 corrective retry

- Work unit: `PR2 RPC domain diagnosis and proof`.
- Authorization: proceed; request `approval-ledger-pr2-runtime-20260907-07`; parent-owned
  native runtime transitions were not acquired or settled. The attempt was limited to one
  disposable PostgreSQL invocation and the PR2 runtime test.
- Source-level preflight: traced the first call through auth, actor, canonical cutoff, plan
  header, nine-field row, seven counts, limits, projection, and hash construction. The fixture
  uses the same admin actor, lowercase canonical UUIDs, `2026-09-01T12:00:00.000Z` cutoff,
  eligible row, `[1,0,0,0,0,0,0]` counts, total/row count `1`, and bounded projection. The
  assertion was strengthened to serialize the complete RPC response.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED at the first approval assertion with the complete response:
  `{"ok":false,"error":{"code":"INVALID_PLAN","message":"INVALID_PLAN"}}`.
  Replay, conflict, immutability, purge-survival, and concurrency assertions were not reached.
- Outcome: `failed`; the final authorized attempt budget is exhausted. Tasks 2.2 and 2.3 remain
  unchecked. Prior failed evidence `12967d523ad1d7a3ae90b147de7ad38857fb93178989a8fa3da7d408990e211e`
  was preserved and not overwritten.
- Diagnosis: the RPC deterministically rejected the submitted canonical plan as `INVALID_PLAN`.
  No migration change was made; the exact failing subpredicate was not exposed by migration 0065
  and cannot be isolated through another runtime invocation under this authorization.
- Harness disposition: `reused`; helper and migration 0065 unchanged. No linked or remote access,
  staging, lifecycle, or migration application outside the disposable database occurred.
- Cleanup evidence: the runtime test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed.
- Process evidence: Docker started, PostgreSQL became ready, `quote_base` and `approval_ledger`
  were created, migrations 0057–0065 were applied lexically, privileged fixture setup ran, and
  the authenticated RPC returned the recorded domain failure. No later runtime invocation was
  made.
- New evidence revision SHA-256: `24bbb0a749c245e8facf134585338e3ca725a62f845b933eab7f4f43f123315a`.
- Non-runtime checks after the single runtime attempt: `npx tsc --noEmit` PASS; `npm run lint`
  PASS; `git diff --check` PASS.
- Changed path: `tests/follow-up-task-approval-ledger-runtime.test.ts`; apply-progress carries
  this evidence. Migration 0065, adapter, types, docs, PR 3+, and unrelated Week 1 files remain
  untouched.

## Maintainer-authorized deterministic PR2 correction

- Work unit: `PR2 runtime correction`; native authorization token
  `sha256:f06bafba43d9402ef0cb86b5a0ccc5d3197a1c1122fe470950f988dd90f91b5a`, request
  `approval-ledger-pr2-runtime-20260907-08`; parent-owned acquire/settle were not invoked.
  The correction candidate was limited to the runtime proof plus the required migration/static
  source corrections and was attempted once.
- Corrections applied: the fixture now uses `follow-up-backfill.v1` in plan slot 0 and includes
  an eligible boolean `hasNote` row plus a non-eligible JSON-null `hasNote` row; migration 0065
  normalizes header slots 5–9 as literal `0,0,0,0,false`, removes invalid JSONB-to-SQL scalar
  comparisons, and uses `row->>5 IS [NOT] NULL`; static assertions reject the prior forms and
  cover both null semantics.
- Focused static command: `node --import tsx --test tests/follow-up-task-approval.test.ts` —
  PASS, 5/5 tests, 0 failures.
- Non-runtime checks: `npx tsc --noEmit --incremental false` — PASS; `npm run lint` — PASS;
  `git diff --check` — PASS.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED after the first approval/replay/conflict path, when the service-session
  `AUTH_REQUIRED` probe called the intentionally revoked RPC and received
  `permission denied for function approve_follow_up_task_plan`. The first approval assertion
  therefore passed, including the eligible/non-eligible JSON-null plan validation; later
  immutability, purge-survival, and concurrency assertions were not reached.
- Outcome: `failed`; the one-attempt correction budget is exhausted. Tasks 2.2 and 2.3 remain
  unchecked. The prior failed evidence revision
  `sha256:24bbb0a749c245e8facf134585338e3ca725a62f845b933eab7f4f43f123315a` was preserved and
  remediated by this distinct correction candidate; new evidence revision is
  `sha256:777424c3fb2005d60126c6a1c6621a59b8a5afa0502a0d135171a31c2cb1ab81`.
- Diagnosis: the remaining failure is a runtime test privilege/setup defect in the
  `serviceSession` probe, not an observed migration domain rejection. The harness attempted to
  invoke the revoked RPC as the service session instead of using an authorized role for the
  expected `AUTH_REQUIRED` check.
- Harness disposition: `reused`; `tests/helpers/postgres-runtime.ts` and the migration lifecycle
  helper were unchanged. No linked/remote Supabase access, staging, migration application
  outside the disposable database, or lifecycle/review operation occurred.
- Cleanup/process evidence: the test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed. Docker started, PostgreSQL became ready,
  `quote_base` and `approval_ledger` were created, migrations 0057–0065 were applied in lexical
  order, privileged setup completed, and the first approval/replay/conflict checks advanced
  before the service-session permission failure.
- Changed paths for this correction: `db/migrations/0065_follow_up_task_approval_ledger.sql`,
  `tests/follow-up-task-approval.test.ts`, and
  `tests/follow-up-task-approval-ledger-runtime.test.ts`. Adapter, types, PR3+, unrelated Week1
  files, and parent-owned native transitions remain untouched.

## Automatic gatekeeper PR2 service fixture privilege correction

- Work unit: `PR2 service fixture privilege correction`; native authorization token
  `sha256:12d30a426fc7327f38ffd6c783c0827acf68096976ba0941318d1a5cb2408118`, request
  `approval-ledger-pr2-runtime-20260907-09`; parent-owned acquire/settle were not invoked.
  The candidate was limited to the disposable runtime fixture and one runtime attempt.
- Trace/correction: migration 0065 grants the RPC only to `authenticated`, while
  `serviceSession()` sets `service_role`, which has no execute privilege. The service probe was
  changed to the fixture's authenticated role with an empty subject via `actorSession("")`, so
  `auth.uid()` is null and the RPC can return `AUTH_REQUIRED` without changing production grants.
  Migration/static security corrections remain unchanged.
- Focused static command: `node --import tsx --test tests/follow-up-task-approval.test.ts` —
  PASS, 5/5 tests, 0 failures.
- Source checks: `npx tsc --noEmit --incremental false` — PASS; `npm run lint` — PASS;
  `git diff --check` — PASS.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED after the first approval, replay, conflict, and `AUTH_REQUIRED` probe; the next
  authenticated advisor count query failed with `permission denied for table profile_roles`.
  The runtime did not reach concurrency, append-only, purge-survival, or final zero-Task-DML
  assertions.
- Outcome: `failed`; tasks 2.2 and 2.3 remain unchecked. Prior evidence revision
  `sha256:777424c3fb2005d60126c6a1c6621a59b8a5afa0502a0d135171a31c2cb1ab81` was preserved and
  remediated by this distinct candidate. New evidence revision:
  `sha256:bb2dfe2e5d963f376fea7d963a9e07582ce27e21ac59941dcdb95290f02615b5`.
- Diagnosis: the remaining failure is another local harness privilege/setup defect. The test
  attempts to query `public.profile_roles` as authenticated, but migration 0065 intentionally
  revokes authenticated table access; the query must use a privileged local fixture session or
  a fixture-only read grant in a future authorized attempt. Production grants were not changed.
- Harness disposition: `reused`; no migration, shared helper, linked/remote Supabase, staging,
  commit, push, or lifecycle operation was used.
- Cleanup/process evidence: the test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed. Docker started, PostgreSQL became ready,
  `quote_base` and `approval_ledger` were created, migrations 0057–0065 applied lexically, and
  the corrected service probe returned its domain response before the advisor query failure.
- Changed path for this work unit: `tests/follow-up-task-approval-ledger-runtime.test.ts` only;
  prior migration/static corrections and all unrelated paths remain untouched.

## Maintainer-authorized PR2 advisor fixture session correction

- Work unit: `PR2 advisor fixture session correction`; native authorization token
  `sha256:4d7073d8da77aa10af3e5b9efc7cbbdf5dabfb1e364c2ecb286e206fbd132a4e`, request
  `approval-ledger-pr2-runtime-20260907-10`; parent-owned acquire/settle were not invoked.
- Source inspection found all later assertions: the advisor visibility check was the only
  remaining session-mismatched query; later mutation/purge checks intentionally use the local
  privileged postgres session while retaining authenticated claims for the immutable trigger.
- Correction: the advisor visibility count now executes with `set role postgres` in the
  disposable database only. Production migration grants and RLS/static security contracts were
  unchanged.
- Focused static command: `node --import tsx --test tests/follow-up-task-approval.test.ts` —
  PASS, 5/5 tests, 0 failures.
- Non-runtime checks: `npx tsc --noEmit --incremental false` — PASS; `npm run lint` — PASS;
  `git diff --check` — PASS.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED at the corrected advisor visibility assertion: privileged `set role postgres`
  returned count `1`, while the assertion expected `0`. Initial approval, replay, conflict, and
  AUTH_REQUIRED checks passed before this assertion; concurrency, append-only, purge-survival,
  and final zero-Task-DML assertions were not reached.
- Outcome: `failed`; tasks 2.2 and 2.3 remain unchecked. Prior evidence revision
  `sha256:bb2dfe2e5d963f376fea7d963a9e07582ce27e21ac59941dcdb95290f02615b5` was preserved and
  remediated by this distinct candidate. New evidence revision:
  `sha256:68e186e0d54ca9e41a88ffeb6cafca966df9032f161d87ccea4634566f1efa82`.
- Diagnosis: the requested privileged session bypasses the advisor RLS perspective, so it sees
  the existing first approval row. A future authorized fixture correction must preserve the
  authenticated advisor role while granting only fixture-local read access to the policy's
  `profile_roles` dependency, or otherwise establish an equivalent disposable RLS session; no
  production grant change is appropriate.
- Harness disposition: `reused`; no linked/remote Supabase, migration edit, staging, commit,
  push, or lifecycle operation occurred.
- Cleanup/process evidence: the test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed. Docker started, PostgreSQL became ready,
  `quote_base` and `approval_ledger` were created, migrations 0057–0065 applied lexically, and
  the corrected advisor query reached its assertion.
- Changed path for this work unit: `tests/follow-up-task-approval-ledger-runtime.test.ts` only;
  all prior migration/static corrections and unrelated paths remain untouched.

## Automatic gatekeeper PR2 corrective retry — passing runtime proof

- Work unit: `PR2 advisor fixture parsing correction`; native authorization token
  `sha256:ed68dbce67c5cba1cf86601e71543e5d087f39d457d8df7ad3d7f1f1c42ee5c9`, request
  `approval-ledger-pr2-runtime-20260907-13`; parent-owned acquire/settle were not invoked.
- Source inspection confirmed the only remaining scalar actorSession assertion was the advisor
  visibility count. Added `parseScalarResult()` to trim/filter session-setting output and compare
  the final non-empty result line; authenticated RLS and fixture-only SELECT grants on
  `profile_roles` and `roles` remain intact. Later assertions retain their intended privileged
  local session boundaries.
- Focused static command: `node --import tsx --test tests/follow-up-task-approval.test.ts` —
  PASS, 5/5 tests, 0 failures.
- Non-runtime checks: `npx tsc --noEmit --incremental false` — PASS; `npm run lint` — PASS;
  `git diff --check` — PASS.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — PASS, 1/1 test, 0 failures. Approval, replay, idempotency conflict, AUTH_REQUIRED,
  authenticated advisor RLS visibility, concurrent convergence, immutability, purge survival,
  and zero Task-DML assertions all passed.
- Outcome: `passed`; tasks 2.2 and 2.3 are marked complete. Prior evidence revision
  `sha256:5c2831a87faa44e4550d8b33164ae34be95997fef6d73e543cb2ca928b879a48` was preserved and
  remediated by this distinct candidate. New evidence revision:
  `sha256:06b12fd08926ddc0f1589a63cfc69fc169e3f0b57ef35961c5308acd386dda0a`.
- Harness disposition: `reused`; no linked/remote Supabase, production migration grant change,
  staging, commit, push, or lifecycle operation occurred.
- Cleanup/process evidence: the test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed. Docker started, PostgreSQL became ready,
  `quote_base` and `approval_ledger` were created, migrations 0057–0065 applied lexically, and
  the full runtime contract completed.
- Changed path for this work unit: `tests/follow-up-task-approval-ledger-runtime.test.ts`;
  cumulative PR2 evidence is recorded here and tasks are visibly complete in `tasks.md`.

## Maintainer-authorized PR2 complete advisor metadata fixture correction

- Work unit: `PR2 advisor fixture session correction`; native authorization token
  `sha256:2fb94f672e3828dc7704e7cc6d3f1e19500847a4048626927ee213197e8c3ee6`, request
  `approval-ledger-pr2-runtime-20260907-12`; parent-owned acquire/settle were not invoked.
- Source inspection confirmed the advisor visibility query remains authenticated and all later
  mutation/purge assertions use the intended local privileged session. The disposable setup now
  grants authenticated SELECT on both `public.profile_roles` and `public.roles`; production
  migration grants remain unchanged.
- Focused static command: `node --import tsx --test tests/follow-up-task-approval.test.ts` —
  PASS, 5/5 tests, 0 failures.
- Non-runtime checks: `npx tsc --noEmit --incremental false` — PASS; `npm run lint` — PASS;
  `git diff --check` — PASS.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED at the advisor visibility assertion because `actorSession(advisorId)` emits its
  session-setting results before the final count. The final count was `0`, but the raw output was
  `advisorId\\nauthenticated\\n0`; later concurrency, append-only, purge-survival, and final
  zero-Task-DML assertions were not reached.
- Outcome: `failed`; tasks 2.2 and 2.3 remain unchecked. Prior evidence revision
  `sha256:c31228ed4a9480daecbb58b83a08d07525c289c5d6e1e7d91d0ace893da47842` was preserved and
  remediated by this distinct candidate. New evidence revision:
  `sha256:5c2831a87faa44e4550d8b33164ae34be95997fef6d73e543cb2ca928b879a48`.
- Diagnosis: the policy/privilege correction is now sufficient; the remaining failure is a
  fixture assertion-output parsing defect. A future authorized correction must compare the final
  query result line (or suppress session setup output) while keeping the advisor query
  authenticated.
- Harness disposition: `reused`; no linked/remote Supabase, migration edit, staging, commit,
  push, or lifecycle operation occurred.
- Cleanup/process evidence: the test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed. Docker started, PostgreSQL became ready,
  `quote_base` and `approval_ledger` were created, migrations 0057–0065 applied lexically, and
  the authenticated advisor policy query returned final count `0`.
- Changed path for this work unit: `tests/follow-up-task-approval-ledger-runtime.test.ts` only;
  all prior migration/static corrections and unrelated paths remain untouched.

## Maintainer-authorized PR2 advisor RLS fixture correction

- Work unit: `PR2 advisor fixture session correction`; native authorization token
  `sha256:56d5e5b9a4821e4cf85907f27b440e1295b86ad45ea8b34fc1e7f1a278e46ae2`, request
  `approval-ledger-pr2-runtime-20260907-11`; parent-owned acquire/settle were not invoked.
- Source inspection confirmed the advisor visibility assertion remains under
  `actorSession(advisorId)`, while only the disposable metadata setup uses the privileged
  postgres session. The fixture now grants `SELECT` on `public.profile_roles` to authenticated
  locally so the existing RLS policy can evaluate; no production migration grant changed.
- Focused static command: `node --import tsx --test tests/follow-up-task-approval.test.ts` —
  PASS, 5/5 tests, 0 failures.
- Non-runtime checks: `npx tsc --noEmit --incremental false` — PASS; `npm run lint` — PASS;
  `git diff --check` — PASS.
- Focused runtime command (exactly once):
  `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts`
  — FAILED at the advisor visibility assertion's policy evaluation with
  `permission denied for table roles`. The advisor query remained authenticated and the
  profile_roles dependency was fixture-granted, but the policy also directly reads
  `public.roles`. Initial approval, replay, conflict, and AUTH_REQUIRED were not reported as
  failures before this query; later concurrency, append-only, purge-survival, and final
  zero-Task-DML assertions were not reached.
- Outcome: `failed`; tasks 2.2 and 2.3 remain unchecked. Prior evidence revision
  `sha256:68e186e0d54ca9e41a88ffeb6cafca966df9032f161d87ccea4634566f1efa82` was preserved and
  remediated by this distinct candidate. New evidence revision:
  `sha256:c31228ed4a9480daecbb58b83a08d07525c289c5d6e1e7d91d0ace893da47842`.
- Diagnosis: the policy dependency surface includes both `profile_roles` and `roles`; granting
  only the first table was insufficient for authenticated policy evaluation. A future
  fixture-only correction must provide the same local read setup for `public.roles` while
  keeping the advisor visibility query authenticated and leaving production grants unchanged.
- Harness disposition: `reused`; no linked/remote Supabase, migration edit, staging, commit,
  push, or lifecycle operation occurred.
- Cleanup/process evidence: the test reached `finally`; `cleanupPostgres()` ran and the
  post-cleanup container absence assertion passed. Docker started, PostgreSQL became ready,
  `quote_base` and `approval_ledger` were created, migrations 0057–0065 applied lexically, and
  the authenticated advisor query reached policy evaluation.
- Changed path for this work unit: `tests/follow-up-task-approval-ledger-runtime.test.ts` only;
  all prior migration/static corrections and unrelated paths remain untouched.
