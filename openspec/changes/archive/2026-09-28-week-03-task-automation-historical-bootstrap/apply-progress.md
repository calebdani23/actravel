# Apply Progress: Week 03 Task Automation Historical Bootstrap

## Gate 0 — Local Allocation and Path Receipt

**Task:** 0.1

**State:** Complete

**Mode:** Strict TDD capability detected; Gate 0 is a documentation/local preflight and is explicitly not an implementation slice.

**Observed repository root:** `/home/calebdani/srv/projects/actravel`

**Observed HEAD:** `50c82a05d5516320f514be43714e032484ac6eda`

### Action Context and Allowed Roots

The workspace is local-only. The only allowed write paths for Gate 0 were:

1. `openspec/changes/week-03-task-automation-historical-bootstrap/tasks.md`
2. `openspec/changes/week-03-task-automation-historical-bootstrap/apply-progress.md`
3. `docs/implementation/ACTIVE.md`

Product code, tests, migrations, schema, operational data, remotes, delivery state, and every proposal/design/spec authority artifact were read-only. The preflight used no Supabase MCP/CLI, linked type generation, network access, deployment, migration application, commit, push, or PR operation.

### Scoped Working-Tree Receipt

Before Gate 0 documentation edits, scoped status was:

```text
MM docs/implementation/ACTIVE.md
?? db/migrations/0077_task_action_audit_foundation.sql
?? db/migrations/0078_task_action_rpc.sql
?? db/migrations/0079_task_automation_foundation.sql
?? db/migrations/0080_task_automation_sources.sql
?? openspec/changes/week-03-task-automation-historical-bootstrap/
```

The repository was already dirty outside the allowed roots. Those unrelated changes were not edited, staged, reverted, cleaned, committed, or delivered. The untracked planning packet and untracked protected migrations are expected local inputs named by the assigned task; no unexpected ownership or target allocation was found.

### Authority and Allocation Checks

- Authority artifacts: **6/6 present and read-only** — proposal, design, and all four capability specifications.
- Protected current migrations: **4/4 present and untracked** — `0077` through `0080`.
- Planned migration identifiers and exact paths: **8/8 free** — no local `0081` through `0088` migration path or prefix is allocated.
- Current dependency file: **1/1 present** — `lib/supabase/database.types.ts`.
- Required current symbol groups: **8/8 present**:
  1. `public.follow_up_canonical_json(jsonb)` and `extensions.digest` usage;
  2. `public.task_action_receipts`, `public.task_action`, `public.task_action_automation_cancel`, and authenticated `task_transition` revocation;
  3. `public.task_automation_origins` and `public.task_automation_outcomes`;
  4. `public.task_automation_project` and `public.task_automation_due_at`;
  5. `public.task_automation_source_cutoffs` and `public.task_automation_tombstones`;
  6. the current first-contact and quote generation/invalidation functions in `0080`;
  7. the exact raw `source_key` and `origin_key` first-16-hex advisory-bigint expressions in `0079`/`0080`;
  8. current action/automation table and RPC entries in `lib/supabase/database.types.ts`.

### Direct Working-Tree SHA-256 Receipt

The four protected migrations are untracked, so these direct working-tree digests, not a HEAD comparison, are the preservation authority. All **4/4** match the design-time manifest exactly:

```text
9d34d3006bbd73080ca2f89cdde12fd80f53d347a19ccd9fcd0294d741ff3d26  db/migrations/0077_task_action_audit_foundation.sql
74497f963022a442bcde5c30b2976f35ea26dc851c06547b0f8be11239d5d7e3  db/migrations/0078_task_action_rpc.sql
918d7117f53f6665209fbdfccefe0613be1dadb57b4015386c42f322d167428b  db/migrations/0079_task_automation_foundation.sql
28baa3d2f0f7f4c8699cfcf7eb57b20111b7d8edb6217299192dfeea05741447  db/migrations/0080_task_automation_sources.sql
```

Gate 0 does not create `0077-0080.sha256`; that artifact remains owned by S1.

### Universe Lock Constant Receipt

Independent local recomputation from canonical UTF-8 bytes confirmed both design constants:

```text
canonical=["task-automation-historical-universe-lock.v1"]
sha256=351876aaee4d45dd88e14b005db35a01d06307eab7d62787b72ff1dc0500d1a0
signed_first_8_bytes=3825938359965795805
```

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 0.1 | N/A — Gate 0 is a fail-closed local preflight with no production behavior or implementation permitted. | PASS — authority/path, allocation, direct digest, dependency-symbol, lock-constant, and scope assertions all matched the design. | N/A — only the required documentation/artifact-coherence updates were made. |

### Focused Local Check Commands

```bash
set -eu
test -f openspec/changes/week-03-task-automation-historical-bootstrap/proposal.md
test -f openspec/changes/week-03-task-automation-historical-bootstrap/design.md
test -f openspec/changes/week-03-task-automation-historical-bootstrap/specs/task-automation-historical-classification/spec.md
test -f openspec/changes/week-03-task-automation-historical-bootstrap/specs/task-automation-historical-preview/spec.md
test -f openspec/changes/week-03-task-automation-historical-bootstrap/specs/task-automation-historical-approval/spec.md
test -f openspec/changes/week-03-task-automation-historical-bootstrap/specs/task-automation-historical-apply/spec.md
test -f db/migrations/0077_task_action_audit_foundation.sql
test -f db/migrations/0078_task_action_rpc.sql
test -f db/migrations/0079_task_automation_foundation.sql
test -f db/migrations/0080_task_automation_sources.sql
test -f lib/supabase/database.types.ts
test ! -e db/migrations/0081_task_automation_historical_preview_boundary.sql
test ! -e db/migrations/0082_task_automation_historical_approval_foundation.sql
test ! -e db/migrations/0083_task_automation_historical_approval_rpc.sql
test ! -e db/migrations/0084_task_automation_historical_apply_receipt.sql
test ! -e db/migrations/0085_task_automation_historical_apply_validation.sql
test ! -e db/migrations/0086_task_automation_historical_apply_writers.sql
test ! -e db/migrations/0087_task_automation_historical_apply_rpc.sql
test ! -e db/migrations/0088_task_automation_historical_readiness.sql
sha256sum db/migrations/0077_task_action_audit_foundation.sql db/migrations/0078_task_action_rpc.sql db/migrations/0079_task_automation_foundation.sql db/migrations/0080_task_automation_sources.sql
node -e 'const {createHash}=require("node:crypto"); const d=createHash("sha256").update("[\"task-automation-historical-universe-lock.v1\"]").digest(); if(d.toString("hex")!=="351876aaee4d45dd88e14b005db35a01d06307eab7d62787b72ff1dc0500d1a0"||d.readBigInt64BE(0)!==3825938359965795805n) process.exit(1)'
git diff --check
```

The path/hash/lock command group exited `0`. Dedicated static content checks supplied the eight symbol-group results above. The final tracked and untracked artifact diff checks emitted no whitespace errors.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | Local `set -eu` path assertion over 11 required files and 8 exact absent migration targets: exit `0`; **11/11 PRESENT**, **8/8 FREE**. Direct `sha256sum` returned **4/4 exact design digests**; Git index checks returned **4/4 UNTRACKED**. Static symbol checks returned **8/8 required groups present**. Independent Node `crypto` assertion returned the exact lock digest and signed bigint with exit `0`. |
| Runtime harness command/scenario and exact result | **N/A** — Gate 0 has no runtime boundary and explicitly forbids database, schema, migration, remote, and product execution. |
| Rollback boundary | Delete this uncommitted receipt and revert only task `0.1`'s checkbox plus the S1 routing sentence in `docs/implementation/ACTIVE.md`; no product, migration, schema, data, test, or remote state exists to roll back. |

### Workload / PR Boundary

- Delivery mode: local preflight only; no Git delivery or PR operation.
- Authored change count: **143 additions + 2 deletions = 145 changed lines**.
- Review-budget headroom: **255 lines** against the 400-line native-slice ceiling.
- P1 implementation cumulative: **0 lines** because Gate 0 is not one of S1–S20.
- Autonomous boundary: starts from the existing local planning packet and ends with path/byte receipts plus S1 routing; no implementation behavior is included.

### Result Contract and Coverage Counts

- Gate 0 tasks: **1/1 complete**.
- Implementation slices: **0/20 complete**; S1 is next.
- Whole task plan: **1/21 checkboxes complete**.
- Specifications remain unchanged at **34 requirements / 62 scenarios**: classification **9/18**, preview **7/13**, approval **7/11**, apply/readiness **11/20**.
- Gate 0 implements **0 requirements / 0 scenarios** and makes no product implementation claim.

### Preservation and Next Boundary

`0077`–`0080` remain byte-identical to the design manifest. `0081`–`0088` remain absent and free. No implementation, schema change, operational-data mutation, remote access, delivery, rollout, production-readiness, Mi día, or Week 03 closure claim was made. The next permitted work unit is **S1 only**.

## S1 — Canonical Primitives and Preservation Foundation

**Task:** 1.1
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Pure TypeScript/static only; no `0081` boundary, database access, classification branch, preview, approval, apply, or readiness behavior.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | Exact focused command exited `1`: **0 passed, 3 failed, 0 skipped** because the contract module and SHA manifest did not exist. A follow-up byte-limit RED exited `1`: **4 passed, 1 failed, 0 skipped** because `assertCanonicalByteLimit` was absent. | Exact focused command exited `0`: **5 passed, 0 failed, 0 skipped**. Canonical/hash/validator/limit/DTO/UUID and direct preservation assertions pass. | Hardened arrays against holes and non-index properties, rejected proxies/accessors without reading them, corrected the static purity assertion, and passed TypeScript/lint. |

### Preservation Receipt

Pre- and post-S1 `sha256sum --check` results are identical:

```text
db/migrations/0077_task_action_audit_foundation.sql: OK
db/migrations/0078_task_action_rpc.sql: OK
db/migrations/0079_task_automation_foundation.sql: OK
db/migrations/0080_task_automation_sources.sql: OK
```

The manifest is now persisted at `0077-0080.sha256`; no protected migration byte changed.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-preservation.test.ts` → exit `0`; **5 tests passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | **N/A** — S1 is pure/static, performs no I/O, and introduces no runtime/database boundary. |
| Rollback boundary | Remove `lib/admin/task-automation-historical-contract.ts`, both S1 tests, and `0077-0080.sha256`; revert only task 1.1, this S1 receipt, the ACTIVE S2 route, and the S1 decision. Protected migrations remain untouched. |

### Verification and Scope

- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → exit `0`, **4/4 OK**.
- `npx tsc --noEmit` → exit `0`.
- `npm run lint` → exit `0`.
- `git diff --check` → exit `0` with no output.
- No database harness applies: S1 has no database/runtime boundary. No test was skipped.
- Only task `1.1` is newly checked; task `1.2`/S2 is next.

### Workload / PR Boundary

- Delivery mode: autonomous local stacked-to-main slice; no Git delivery operation was performed.
- Authored change count: **375 additions plus deletions**; **25-line headroom** to the 400-line native-slice ceiling.
- P1 cumulative authored count: **375 lines** across S1 only, below the 1,200-line packet boundary.
- No `size:exception` is required. The rollback boundary is pure files plus coherent local documentation only.

### Cumulative Status

- Gate 0: complete.
- Implementation slices: **1/20 complete**.
- Whole task plan: **2/21 checkboxes complete**.
- Next permitted work unit: **S2 only**.

## S1 Correction — Fail-Closed Disposition Count Vector

**Task:** 1.1 correction only; no new task or documentation ownership.
**State:** Complete after GREEN and final verification.
**Mode:** Strict TDD.
**Boundary:** `isDispositionCounts`, its exact focused tests, S1 DTO type-equality assertions, and this correction receipt only.

### Result Contract

- `isDispositionCounts` accepts only a non-proxy Array with the exact own keys `0` through `7` plus `length`, exactly eight own enumerable data elements, integer elements in `0..4000`, and a total no greater than `4000`.
- Sparse vectors, wrong lengths, extra own string or symbol keys, non-enumerable elements, accessor elements, ordinary proxies, and revoked proxies fail closed.
- Validation uses own property descriptors and does not invoke an element getter or any proxy trap.
- Exact compile-time equality assertions cover every exported S1 DTO/closed union. No DTO byte or type contract changed.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 correction | After adding the exact sparse/extra-key/accessor/proxy/length/element and DTO equality tests, the focused command exited `1`: **6 passed, 1 failed, 0 skipped**. The first sparse-hole assertion observed `true !== false` at the expected validator boundary. | After descriptor-only fail-closed hardening, the same focused command exited `0`: **7 passed, 0 failed, 0 skipped**. | Replaced all expected composite DTO references with standalone expected shapes so equality checks are structurally closed; focused tests, TypeScript, and lint remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-preservation.test.ts` → exit `0`; **7 tests passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | **N/A** — the corrected S1 boundary remains pure/static, performs no I/O, and introduces no runtime or database boundary. |
| Rollback boundary | Revert only the descriptor-based `isDispositionCounts` body, the added count-vector/DTO assertions, and this correction receipt. No migration, schema, data, remote, or unrelated S1 contract is part of the rollback. |

### Verification and Preservation

- `npx tsc --noEmit` → exit `0`, no output.
- `npm run lint` → exit `0`.
- `git diff --check` → exit `0`, no output.
- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → exit `0`, **4/4 OK**.
- Pre/post hashes are unchanged for `tests/task-automation-historical-preservation.test.ts` (`7b40d981...295ecbc`), `0077-0080.sha256` (`3a3f276e...52d5`), `tasks.md` (`1dcb03de...e89444a`), and `docs/implementation/ACTIVE.md` (`3639cb40...14ffc`).
- Only the intended contract/test hashes changed: contract `1e032a94...bf6038` → `deaeab3c...fef57c`; focused test `afb76f1a...636b2` → `84695697...2a249f`.
- Task `1.1` remains the only checked implementation slice after the correction tests passed; S2 remains next.

### Correction Line Delta and Scope

- Production contract: **18 additions + 3 deletions = 21 authored changed lines**, net `+15`.
- Focused tests and exact type assertions: **155 additions + 0 deletions**, net `+155`.
- Correction implementation/test total: **173 additions + 3 deletions = 176 authored changed lines**, net `+170`.
- Apply-progress correction evidence: **47 additions**. Total correction delta: **220 additions + 3 deletions = 223 authored changed lines**, net `+217`.
- No task, ACTIVE, decision, `docs/PROGRESS.md`, migration, schema, or remote ownership was added.
- Treat this as a separately reviewable corrective follow-up to S1: its 223-line delta remains below 400 and requires no exception. Squashing it into the prior 375-line S1 review delta would produce 592 authored lines and require `size:exception`; no Git delivery operation was performed.

## S2 — Provable First-Contact Evidence and Deterministic Projection

**Task:** 1.2
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Pure first-contact classification only; no quote branch, preview, migration, database I/O, approval, apply, or readiness behavior.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.2 | Exact focused command exited `1`: **5 passed, 1 failed, 0 skipped** because the required classifier module did not exist. | Exact focused command exited `0`: **8 passed, 0 failed, 0 skipped**. Frozen census, assignment proof, all eight dispositions, due/identity/order formulas, accounting, and purity pass. | Fact validation, evidence grouping, calendar due, projection construction, ordering, and accounting remain separate pure helpers; focused tests and TypeScript stayed green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts` → exit `0`; **8 passed, 0 failed, 0 skipped**. `npx tsc --noEmit` → exit `0`. |
| Runtime harness command/scenario and exact result | **N/A** — classification is referentially transparent, performs no I/O, and introduces no runtime/database boundary. |
| Rollback boundary | Remove only `lib/admin/task-automation-historical-classification.ts`, its focused test, this S2 receipt/decision, task `1.2`, and the ACTIVE S3 route; S1 and protected migrations remain untouched. |

### Preservation, Scope, and Workload

- Pre/post `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → exit `0`, **4/4 OK**.
- S1 contract/preservation regression → exit `0`, **7 passed, 0 failed, 0 skipped**; no S1 contract or manifest byte changed.
- S1 SHA-256 values remain `deaeab3c...fef57c` (contract), `84695697...2a249f` (contract test), `7b40d981...295ecbc` (preservation test), and `3a3f276e...b52d5` (manifest).
- `npx tsc --noEmit`, `npm run lint`, and tracked/staged `git diff --check` exited `0`; normalized untracked no-index checks emitted no whitespace errors.
- Delivery mode: autonomous local stacked-to-main slice; no Git delivery or remote operation was performed.
- Authored change count: **350 additions plus deletions**; **50-line headroom** to 400. P1 cumulative is **725** lines across S1 and S2, below 1,200.
- Only task `1.2` is newly checked. Implementation slices are **2/20 complete** and the whole plan is **3/21 complete**.
- Next permitted work unit: **S3 only**.

## S2 Correction — Assignment Tuple Ordering and Calendar Parity

**Task:** 1.2 correction only; no new task or documentation ownership.
**State:** Complete after GREEN and final verification.
**Mode:** Strict TDD.
**Boundary:** Assignment proof identity, strict invalidation tuple ordering, protected `0079` due parity, focused S2 tests/type assertions, and this correction receipt only.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.2 correction | After adding equal-time lower/higher event-ID, protected due-parity, and exact proof-type regressions, the focused command exited `1`: **7 passed, 3 failed, 0 skipped**. The failures proved `21:15Z` instead of `15:15Z` and acceptance of a same-time lower-ID terminal invalidation. `npx tsc --noEmit` also failed with **3 diagnostics** because `FirstContactAssignmentProof` did not yet expose `assignmentEventId`. | The exact focused command exited `0`: **10 passed, 0 failed, 0 skipped**. The assignment proof now retains canonical `assignmentEventId`, invalidations require a strictly greater `(occurredAt,eventId)` tuple, and next-business-opening due is `15:15Z`. | Reused the existing strict tuple comparator for assignment-boundary filtering; no broader classifier, S1, state, or task changes were needed. Final focused, type, lint, calendar, preservation, and diff gates remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts` → exit `0`; **10 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | `RUN_TASK_AUTOMATION_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-calendar.test.ts` → exit `0`; protected disposable PostgreSQL calendar parity **2 passed, 0 failed, 0 skipped**; cleanup completed. |
| Rollback boundary | Revert only the proof identity/tuple comparison/due line in `lib/admin/task-automation-historical-classification.ts`, the correction regressions/type assertions in `tests/task-automation-historical-classification.test.ts`, and this receipt. No task state, migration, schema, operational data, remote state, or unrelated classifier behavior belongs to this rollback. |

### Correction Result and Preservation

- Assignment proof is exactly `{assignmentAt,assignmentEventId,anchorAt}`; `assignmentEventId` comes only from a previously validated canonical evidence event.
- Unassignment and terminal evidence count only when `(occurredAt,eventId)` is strictly after the proved assignment tuple; equal-time lower IDs do not suppress and equal-time higher IDs do.
- The fixed UTC−06 next-business-opening branch now emits `09:15` local as `15:15Z`, matching protected `public.task_automation_due_at` and its runtime vectors.
- S1 regression/preservation command → exit `0`; **7 passed, 0 failed, 0 skipped**. S1 contract/test/preservation/manifest hashes remain `deaeab3c...fef57c`, `84695697...2a249f`, `7b40d981...295ecbc`, and `3a3f276e...b52d5`.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged plus scoped untracked `git diff --check`, and the direct SHA manifest all exited `0`; protected migrations remain **4/4 OK**.
- `tasks.md` remains `234d316f...9df2`; task `1.2` stays checked, no checkbox changed, and S3 remains next. `docs/implementation/ACTIVE.md` remains `de0ac1cc...9ab`; no living document was edited.

### Correction Line Delta and Scope

- Production classifier: **6 additions + 5 deletions = 11 authored changed lines**, net `+1`.
- Focused S2 regressions and exact type assertions: **48 additions + 2 deletions = 50 authored changed lines**, net `+46`.
- Correction implementation/test total: **54 additions + 7 deletions = 61 authored changed lines**, net `+47`.
- Apply-progress correction evidence: **38 additions**. Total correction delta is **92 additions + 7 deletions = 99 authored changed lines**, net `+85`; it remains below 400 and requires no `size:exception`.
- No new task, ACTIVE, decision, progress document, migration, schema, database, remote, quote/S3, or Git-delivery ownership was added.

## S3 — Quote First-Send and Exact Invalidation Reconstruction

**Task:** 1.3
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Pure quote-version classification only; no preview, migration, database I/O, approval, apply, readiness, or remote behavior.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.3 | After adding the exact quote fixture and assertions first, the focused command exited `1`: **10 passed, 2 failed, 0 skipped** because `classifyHistoricalQuotes` did not exist. | The same command exited `0`: **12 passed, 0 failed, 0 skipped** after adding closed quote evidence DTOs and the pure quote classifier. | Kept first-send proof, exact invalidation reconstruction, due/identity projection, disposition precedence, ordering, and accounting as pure helpers/branches; aggregate P1, type, lint, calendar, hash, and diff gates remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts` → exit `0`; **12 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | **N/A** — S3 remains referentially transparent and introduces no runtime/database boundary. The protected disposable PostgreSQL calendar regression separately passed **2/2** with zero skips. |
| Rollback boundary | Remove only the quote DTO/branch/tests, this S3 receipt/decision, task `1.3`, and the ACTIVE S4 route; S1/S2 and protected migrations remain untouched. |

### Verification, Preservation, and Scope

- Aggregate S3+S2+S1/static command → exit `0`; **14 passed, 0 failed, 0 skipped**.
- `RUN_TASK_AUTOMATION_DB_TESTS=1 ... tests/task-automation-calendar.test.ts` → exit `0`; **2 passed, 0 failed, 0 skipped** with cleanup complete.
- Pre/post `sha256sum --check .../0077-0080.sha256` → exit `0`; **4/4 OK** and protected bytes unchanged.
- `npx tsc --noEmit`, `npm run lint`, and scoped tracked/staged/untracked diff checks exited `0`.
- No preview, migration, schema, operational-data, `docs/PROGRESS.md`, remote, rollout, or Git-delivery action occurred.

### Workload / PR Boundary

- Delivery mode: autonomous local stacked-to-main S3 slice; no Git delivery operation was performed.
- Authored change count: **319 additions plus deletions**; **81-line headroom** to 400.
- P1 cumulative authored count: **1,044 lines** across S1–S3, below 1,200.
- Implementation slices are **3/20 complete**; the whole plan is **4/21 complete**.
- Next permitted work unit: **S4 only**.

## S3 Correction — Exact Cross-Scope Quote Evidence Ownership

**Task:** 1.3 correction only; no new task or living-document ownership.
**State:** Complete after GREEN and final verification.
**Mode:** Strict TDD.
**Boundary:** Wrong-scope `quote_sent` ownership, verified-payment version/Opportunity linkage, two focused regressions, and this correction receipt only.

### TDD Cycle Evidence

| Task | Test file / layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| 1.3 correction | `tests/task-automation-historical-classification.test.ts` / unit | Focused baseline exited `0`: **12 passed, 0 failed, 0 skipped**. | After adding both probes first, the focused command exited `1`: **12 passed, 2 failed, 0 skipped**. Wrong-scope `quote_sent` returned `FIRST_SENT_EVENT_MISSING`; mismatched verified payment returned `apply/generate`. | Minimal evidence-indexing changes made the same command exit `0`: **14 passed, 0 failed, 0 skipped**. | Existing exact-scope send/payment cases remain the positive paths; the two new cross-scope cases prove the distinct fail-closed branches. | Rebuilt test inputs without mutating readonly evidence after TypeScript reported two readonly-array diagnostics; focused tests remained **14/14** and final TypeScript passed. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts` → exit `0`; **14 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | **N/A** — the corrected classifier remains pure and has no runtime/database boundary. The protected disposable PostgreSQL calendar parity regression separately passed **2 passed, 0 failed, 0 skipped** with cleanup complete. |
| Rollback boundary | Revert only the two evidence-linkage branches in `lib/admin/task-automation-historical-classification.ts`, the two focused probes in `tests/task-automation-historical-classification.test.ts`, and this receipt. No task state, S1/S2 behavior, migration, schema, operational data, living document, or remote state belongs to this rollback. |

### Correction Result

- A `quote_sent` event that names an exact frozen version but disagrees with its quote or Opportunity now belongs to that version's contradictory first-send evidence and yields `FIRST_SENT_EVENT_CONTRADICTORY`, never missing evidence.
- A verified payment that names an exact frozen version now validates both the named version and its Opportunity; a mismatch marks the named root `SOURCE_AMBIGUOUS` with no action instead of generating.
- Null/unknown accepted-version payment handling, exact-scope payment suppression, response/terminal/WhatsApp logic, S1/S2 behavior, accounting, and task state remain unchanged.

### Verification and Preservation

- Aggregate contract/classification/static preservation command → exit `0`; **16 passed, 0 failed, 0 skipped**.
- `RUN_TASK_AUTOMATION_DB_TESTS=1 ... tests/task-automation-calendar.test.ts` → exit `0`; **2 passed, 0 failed, 0 skipped** with cleanup complete.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged plus scoped untracked diff checks, and the direct SHA manifest exited `0`; protected migrations remain **4/4 OK**.
- `tasks.md` and `docs/implementation/ACTIVE.md` retain their pre-correction SHA-256 values; task `1.3` stays checked, task `1.4` stays pending, and S4 remains next.

### Correction Line Delta and Scope

- Production classifier: **9 additions + 2 deletions = 11 authored changed lines**, net `+7`.
- Focused regressions: **30 additions + 0 deletions**, net `+30`.
- Correction implementation/test total: **39 additions + 2 deletions = 41 authored changed lines**, net `+37`.
- Apply-progress correction evidence: **42 additions**. Total correction delta: **81 additions + 2 deletions = 83 authored changed lines**, net `+79`.
- This separately reviewable corrective follow-up remains below 400 lines and requires no `size:exception`; no task checkbox, ACTIVE/decision/progress document, migration, schema, database, remote, or Git-delivery ownership was added.

## S4 — Closed Precedence, Accounting, Ordering, Limits, and Plan Hash

**Task:** 1.4
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Pure integrated classification only; no auth, preview source/database boundary, approval, apply, migration, schema, DML, or remote behavior.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.4 | After adding the two-source integration and closed-matrix tests first, the exact focused command exited `1`: **14 passed, 3 failed, 0 skipped** because the canonical builder and reason matrix did not exist. | The same command exited `0`: **17 passed, 0 failed, 0 skipped** after adding the shared finalizer, integrated builder, limits, and closed failure selection. | Reused one finalizer for S2, S3, and integrated plans; moved family limits after fact validation so lower-precedence canonical overflow cannot mask malformed facts. Final focused/static/calendar/type/lint/hash/diff gates remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts` → exit `0`; **17 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | **N/A for S4** — classification remains pure and introduces no runtime/database boundary. The separately requested protected calendar harness passed **2 passed, 0 failed, 0 skipped** against disposable PostgreSQL with cleanup complete. |
| Rollback boundary | Revert only the integrated builder/shared finalizer, closed reason matrix, S4 focused tests, task `1.4`, this receipt/decision, and the ACTIVE S5 route. S1–S3 and protected migrations remain untouched. |

### Verification and Preservation

- Aggregate S1–S4 plus static preservation command → exit `0`; **19 passed, 0 failed, 0 skipped**.
- Protected disposable PostgreSQL calendar command → exit `0`; **2 passed, 0 failed, 0 skipped**; cleanup completed.
- `npx tsc --noEmit` → exit `0`, no output.
- `npm run lint` → exit `0`.
- Direct pre/post `sha256sum --check .../0077-0080.sha256` → exit `0`; **4/4 OK**.
- Tracked, staged, and scoped untracked diff checks → exit `0`, no whitespace errors.

### Workload / PR Boundary

- Delivery mode: autonomous local stacked-to-main S4 slice; no Git delivery or remote operation was performed.
- Authored change count: **239 additions + 25 deletions = 264 changed lines**; **136-line headroom** to 400.
- P2 cumulative authored count: **264 lines** across S4 only, below 1,200.
- Only task `1.4` is newly checked. Implementation slices are **4/20 complete** and the whole plan is **5/21 complete**.

### Preservation and Next Boundary

The canonical result is exactly `{plan,planHash}`; repeated equal inputs are byte-stable, all roots are counted once, and closed failures contain no plan, rows, or diagnostics. S1–S3 outputs and `0077`–`0080` bytes remain unchanged.
The next permitted work unit is **S5 only**. No auth (S7), preview reader/client, approval/apply, migration, schema, operational-data, `docs/PROGRESS.md`, remote, rollout, production-readiness, Mi día, or Week 03 closure work was performed.

## S5 — Immutable Cutoffs, Census, Keysets, and Sentinels

**Task:** 2.1
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Local `0081` boundary, root keyset primitive, exact manual types, and declared runtime/static proof only; no S6 joins, S7 auth/source adapter, S8 convergence/preview assembly, approval/apply, universe guard, operational DML, or remote work.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.1 | Focused command exited `1`: **2 passed, 1 failed, 1 skipped** because the declared preview source did not exist. The opt-in runtime RED exited `1`: **2 passed, 1 failed, 0 skipped** because `0081` did not exist; `finally` cleanup completed. | Aggregate focused/runtime command exited `0`: **23 passed, 0 failed, 0 skipped**. The standalone disposable boundary command exited `0`: **3 passed, 0 failed, 0 skipped**. | Replaced locale collation with direct ASCII string comparison and kept the SQL boundary to its exact helper/RPC inventory; TypeScript and all tests remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-contract.test.ts tests/task-automation-historical-classification.test.ts tests/task-automation-historical-preview.test.ts tests/task-automation-historical-preservation.test.ts` → exit `0`; **23 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preservation.test.ts` → exit `0`; disposable PostgreSQL 16 boundary/auth/cutoff/census/cursor/hash/UUID/grant/immutability/limit/cleanup proof **3 passed, 0 failed, 0 skipped**. |
| Rollback boundary | Revoke/drop `read_task_automation_historical_boundaries(uuid)` and the two private `0081` helpers; remove the S5 source/types/tests and coherent task/progress/ACTIVE/decision edits. No table, historical DML, approval, Task, origin, outcome, tombstone, receipt, or remote state exists. |

### Verification, Preservation, and Workload

- Protected calendar parity → exit `0`; **2 passed, 0 failed, 0 skipped** with disposable cleanup complete.
- `npx tsc --noEmit`, `npm run lint`, direct SHA manifest, and tracked/staged/untracked diff hygiene exited `0`.
- Pre/post `sha256sum --check .../0077-0080.sha256` → **4/4 OK**; classifiers and all prior S1–S4 scenarios remain unchanged.
- Delivery mode: autonomous local stacked-to-main S5 slice; no Git delivery or remote operation was performed.
- Authored change count: **322 additions + 2 deletions = 324 changed lines**; **76-line headroom** to 400. P2 cumulative is **588 lines** across S4–S5, below 1,200.

### Preservation and Next Boundary

`0081` returns only the exact snake-case success/code-only failure union, keeps helper execution private, grants only the exact boundary to `authenticated`, leaves source RLS unchanged, and performs no migration-time historical DML. The fixed shared universe writer guard remains owned by S13/`0085`; no `0080` function or byte changed. Only task `2.1` is newly checked. Implementation slices are **5/20 complete**, the whole plan is **6/21 complete**, and **S6 only** is next.

## S6 — Bounded Source, Evidence, Context, and Occupancy Joins

**Task:** 2.2
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Read-only source reconstruction behind the unchanged S5 boundary; no S7 auth/source adapter, S8 convergence/preview assembly, approval/apply, operational DML, guard, or remote work.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.2 | New disposable source-join runtime test exited `1`: **0 passed, 1 failed, 0 skipped** because `read_task_automation_historical_sources(uuid,jsonb)` did not exist; `finally` cleanup proved no container remained. | Focused runtime exited `0`: **1 passed, 0 failed, 0 skipped**. Aggregate S1–S6/runtime then passed **26/26** with zero skips. | Replaced broad row transport with explicit allow-listed fields and canonical UTC timestamps; strict decoding rejects missing, extra, duplicate, or out-of-root facts. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preview-source-runtime.test.ts` → exit `0`; **1 passed, 0 failed, 0 skipped**. Aggregate contract/classification/preview/source-runtime/preservation → **26 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | Disposable PostgreSQL 16 proved assignment tuples, first `quote_sent`, invalidation, live owner/context/status, Task/origin/outcome/tombstone occupancy, exact boundary agreement, malformed/incomplete/duplicate-evidence failures, and cleanup: **1/1 passed**, zero skips, container absent. |
| Rollback boundary | Revoke/drop only `read_task_automation_historical_sources(uuid,jsonb)`, remove S6 decoder/type/runtime proof and coherent docs; retain the S5 boundary/helpers and all S1–S5 behavior. No retained data exists. |

### Verification, Preservation, and Workload

- Protected calendar parity: **2 passed, 0 failed, 0 skipped**. `npx tsc --noEmit`, `npm run lint`, SHA manifest, and diff hygiene exited `0`.
- Pre/post `sha256sum --check .../0077-0080.sha256`: **4/4 OK**; S1–S5 aggregate behavior remains green.
- Authored S6 change: **379 additions + 6 deletions = 385 changed lines**; **15-line headroom** to 400. P2 cumulative is **973 lines**, below 1,200. No Git delivery or remote operation occurred.
- Only task `2.2` is newly checked. Implementation slices are **6/20 complete**, whole plan **7/21 complete**, and **S7 only** is next.

## S6 Correction — Exact Decoding and Ambiguity-Complete Payment Freeze

**Task:** 2.2 correction only; no checkbox or living-document ownership.
**State:** Complete after GREEN and final aggregate verification.
**Mode:** Strict TDD.
**Boundary:** S6 source-result decoding, payment evidence freeze/query parity, focused adversarial/runtime tests, and this receipt only.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.2 correction | After adding the adversarial decoder and payment-cursor probes first, the focused TypeScript command exited `1`: **5 passed, 2 failed, 0 skipped**; malformed booleans and missing owner joins were accepted. The disposable runtime command exited `1`: **0 passed, 1 failed, 0 skipped** because the later same-Opportunity verified payment with null accepted-version ID was absent after the earlier exact-version payment cursor. Cleanup left no container. | Exact typed collection decoders, descriptor-only object/array reads, root/join closure, and aligned payment high-water membership made the adversarial command pass **7/7** and the disposable runtime pass **1/1**, both with zero skips. | Returned fresh decoded rows, centralized scalar validators, retained wrong-scope exact-version evidence for classifier ambiguity, and kept null/out-of-root accepted-version payments only when their Opportunity is in the frozen quote universe. |

### Correction Result

- Every collection now has an exact exported row type and field-specific decoder for booleans, strings/enums, integers, nullable values, canonical UUIDs/hashes, timestamps, and role arrays.
- Plain own enumerable data descriptors are required. Accessor rows and proxied objects/arrays fail `MALFORMED_ROW` without invoking getters or proxy traps.
- Root counts and assignment/quote evidence membership are closed; required owner facts missing for assigned Opportunity or quote roots return `INCOMPLETE_JOIN`; foreign owner/evidence rows and invalid cross-field matrices return `MALFORMED_ROW`.
- Quote events require a frozen version, while exact-version wrong-scope evidence remains available to the classifier as contradictory/ambiguous evidence. WhatsApp and verified broad payments require a frozen quote Opportunity; payment accepted-version IDs may be null or outside the frozen version set so ambiguity is not erased.
- The `quoteSourceEvidence` high-water now uses the same exact-version-or-same-Opportunity verified-payment predicate as the source query. The bounded evidence count therefore includes a later broad payment instead of truncating it behind an earlier exact-version cursor.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preview.test.ts` → **7 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preview-source-runtime.test.ts` → disposable PostgreSQL 16 **1 passed, 0 failed, 0 skipped**; exact payment plus later same-Opportunity/null-version payment were both frozen/read and final container absence passed. |
| Rollback boundary | Revert only the typed/descriptor S6 decoder changes, the single `0081` payment high-water predicate, both correction test deltas, and this receipt. S1–S5, all S1–S6 task state, protected `0077`–`0080`, and unrelated working-tree behavior remain intact. |

### Aggregate Verification and Preservation

- S1–S6 DB/adversarial aggregate command with historical DB opt-in → **28 passed, 0 failed, 0 skipped**; both disposable PostgreSQL scenarios cleaned up.
- Protected calendar parity command → **2 passed, 0 failed, 0 skipped**; cleanup completed.
- `npx tsc --noEmit` and `npm run lint` exited `0`; TypeScript emitted no diagnostics and ESLint emitted no findings.
- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → **4/4 OK**.
- `tasks.md` remains `305b3bd0...ea1386df` and `docs/implementation/ACTIVE.md` remains `ab6ae03...1d8991c`; tasks Gate 0 and S1–S6 stay checked, S7 stays pending, and routing remains S7.

### Correction Line Delta and Scope

- Production decoder: **138 additions + 62 deletions = 200 authored changed lines**, net `+76`.
- `0081` payment freeze: **1 addition + 1 deletion = 2 authored changed lines**, net `0`.
- Focused adversarial/runtime tests: **78 additions + 2 deletions = 80 authored changed lines**, net `+76`.
- Implementation/test correction total: **217 additions + 65 deletions = 282 authored changed lines**, net `+152`; correction evidence adds **45 lines**, for **327 authored changed lines** total and no `size:exception`.
- No task checkbox, ACTIVE, decision, `docs/PROGRESS.md`, migration identifier, schema object/signature, operational data, remote state, or Git-delivery ownership changed.

## S7 — Bootstrap Auth and Strict `0081` Source Adapter

**Task:** 2.3
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Bootstrap-only auth plus separate-client boundary/source RPC wiring. Per the assigned S7 boundary, no paired-pass convergence/preview assembly, `0082`, approval/apply, DML, or remote work is included.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.3 | Declared focused command exited `1`: **1 passed, 1 failed, 0 skipped** because the bootstrap auth module did not exist. | The same command exited `0`: **11 passed, 0 failed, 0 skipped** after adding exact auth and strict two-RPC source behavior. | Corrected distributive exact-type assertions; TypeScript, aggregate/runtime, calendar, lint, hashes, and diff hygiene stayed green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preview.test.ts tests/task-automation-historical-adapters-types.test.ts` → **11 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | **N/A for new S7 behavior** — both clients/transports are injected and read-only. S1–S6 disposable PostgreSQL regression in the aggregate command passed **2 runtime scenarios** within **32 passed, 0 failed, 0 skipped**; protected calendar parity passed **2/2**, zero skips, with cleanup complete. |
| Rollback boundary | Remove only `task-automation-historical-auth.ts`, the new source-adapter exports/decoders and S7 tests/evidence; retain S1–S6, local `0081`, and protected `0077`–`0080`. |

### Verification, Preservation, and Workload

- S1–S7 static/runtime aggregate → **32 passed, 0 failed, 0 skipped**; focused → **11/11**; calendar → **2/2**.
- `npx tsc --noEmit`, `npm run lint`, direct SHA manifest, and tracked/staged/scoped-untracked diff hygiene exited `0`.
- Pre/post `sha256sum --check .../0077-0080.sha256` → **4/4 OK**; S1–S6 behavior and `0081` SQL remain unchanged.
- Authored S7 change: **265 additions + 3 deletions = 268 changed lines**; **132-line headroom** to 400. P3 cumulative is **268 lines** across S7 only, below 1,200.
- Delivery mode is local stacked-to-main slice metadata only; no commit, push, PR, remote, migration application, or linked type generation occurred.
- Only task `2.3` is newly checked. Implementation slices are **7/20 complete**, whole plan **8/21 complete**, and **S8 only** is next.

## S8 — Bounded Paired-Pass Convergence and Exact Preview Assembly

**Task:** 2.4
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Read-only preview orchestration only; no `0082`, approval/apply, DML, migration application, or remote behavior.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 2.4 | Existing focused S7 suite: **11 passed, 0 failed, 0 skipped**. | Declared module RED: **1 passed, 1 failed**; later malformed/accessor RED: **13 passed, 1 failed**. Both had zero skips. | Final focused command: **14 passed, 0 failed, 0 skipped**. | P2 and P4 convergence, four-pass exhaustion, stale boundary, retry accounting, closed/accessor-safe source failures, malformed classifier output, and exact type/envelope paths all ran. | Centralized normalization, automation-state closure, exact plan validation, and code-only failure construction; tests and TypeScript remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preview.test.ts tests/task-automation-historical-adapters-types.test.ts` → **14 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | Aggregate with `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1` → **35 passed, 0 failed, 0 skipped**, including both disposable `0081` boundary/source scenarios and cleanup. Preview itself remains injected/read-only. |
| Rollback boundary | Remove `lib/admin/task-automation-historical-preview.ts`, only the S8 preview/type tests and this evidence/routing/decision; retain S1–S7, local `0081`, and protected `0077`–`0080`. |

### Verification, Preservation, and Workload

- Protected calendar parity → **2 passed, 0 failed, 0 skipped**; focused and aggregate totals above also have zero skips.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged diff hygiene, and direct SHA manifest checks exited `0`; `0077`–`0080` are **4/4 OK**.
- Authored S8 change: **371 additions plus deletions**; **29-line headroom** to 400. P3 cumulative is **639 lines** with S7, below 1,200.
- Only task `2.4` is newly checked. Implementation slices are **8/20 complete**, whole plan **9/21 complete**, and **S9/3.1 only** is next.

### Preservation and Next Boundary

S8 freezes actor plus exact source/snapshot boundaries, accepts only equal adjacent canonical bytes and hashes, invokes S4 exactly once, and revalidates the exact success envelope. S1–S7, `0081`, and protected hashes remain unchanged. No storage, approval, apply, operational mutation, Git delivery, remote, rollout, production-readiness, Mi día, or Week 03 closure claim was made.

## S8 Correction — Fail-Closed Boundary and Classifier Result Decoding

**Task:** 2.4 correction only; no checkbox or living-document ownership.
**State:** Complete after GREEN and final aggregate verification.
**Mode:** Strict TDD.
**Boundary:** S8 boundary canonicalization, closed S1 plan-row decoding, focused adversarial tests, and this correction receipt only.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 2.4 correction | Pre-change focused command: **14 passed, 0 failed, 0 skipped**. | After adding both adversarial tests first, the focused command exited `1`: **14 passed, 2 failed, 0 skipped**. A nested boundary accessor escaped as `CanonicalizationFailure`; a self-hashed row with an invalid disposition was returned as preview success. | Guarded boundary canonicalization plus the closed row decoder made the same command pass **16 passed, 0 failed, 0 skipped**. | Centralized scalar-domain, disposition/reason, action, canonical-order, ordinal, count, and hash checks in the S8 result validator; focused, aggregate, type, lint, manifest, and diff gates remained green. |

### Correction Result

- Nested plain-object accessors and nested proxies in the boundary now return the exact `CANONICALIZATION_FAILURE` code-only envelope with diagnostics; their getters and proxy traps are never executed.
- Boundary canonicalization is fully inside guarded fail-closed handling, before any nested boundary value is consumed.
- Classifier plans are canonicalized before decoding, then every row is copied from exact own enumerable data descriptors and checked against the closed S1 domains for identifiers, timestamps, hashes, enums, nullable fields, source order, disposition/reason, and action.
- Accepted rows must be in strict canonical `(sourceKind,anchorAt NULLS LAST,sourceId NULLS LAST,rootId)` order with contiguous zero-based ordinals, unique ordered roots, exact per-disposition counts, exact total/root census, and an exact canonical plan hash.
- Rehashed plans with an invalid disposition, mismatched reason, malformed field, reordered rows, bad ordinal, or shifted count vector fail as `CANONICALIZATION_FAILURE` with no partial plan.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-preview.test.ts tests/task-automation-historical-adapters-types.test.ts` → **16 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | Historical aggregate with `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1` → **37 passed, 0 failed, 0 skipped**, including both disposable PostgreSQL `0081` boundary/source scenarios and final cleanup. Protected calendar parity with `RUN_TASK_AUTOMATION_DB_TESTS=1` → **2 passed, 0 failed, 0 skipped**, with cleanup complete. |
| Rollback boundary | Revert only the guarded boundary canonicalization and closed result decoder in `lib/admin/task-automation-historical-preview.ts`, the two adversarial tests in `tests/task-automation-historical-preview.test.ts`, and this receipt. S1–S7, S8 convergence, all task state, local `0081`, and protected `0077`–`0080` remain intact. |

### Aggregate Verification and Preservation

- Historical contract/classification/preview/type/source-runtime/preservation aggregate → **37 passed, 0 failed, 0 skipped**.
- Protected disposable PostgreSQL calendar parity → **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit` and `npm run lint` exited `0` with no diagnostics or findings.
- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → **4/4 OK**.
- Tracked, staged, and scoped untracked diff hygiene exited `0` with no whitespace errors.
- `tasks.md`, `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, and `docs/PROGRESS.md` retain their pre-correction SHA-256 values. Task 2.4 remains checked, task 3.1 remains pending, and S9 remains the routed next slice.

### Correction Line Delta and Scope

- Production preview: **49 additions + 10 deletions = 59 authored changed lines**, net `+39`.
- Focused adversarial tests: **55 additions + 0 deletions**, net `+55`.
- Correction implementation/test total: **104 additions + 10 deletions = 114 authored changed lines**, net `+94`.
- Apply-progress correction evidence: **46 additions**. Total correction delta: **150 additions + 10 deletions = 160 authored changed lines**, net `+140`.
- This separately reviewable corrective follow-up remains below 400 lines and requires no `size:exception`. No checkbox, ACTIVE/decision/progress document, migration, schema, operational data, remote state, or Git-delivery ownership changed.

## S9 — Immutable Approval Storage, Integrity, RLS, and Runtime Safety

**Task:** 3.1
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Local unapplied `0082` storage/types only; no approval RPC/S10, adapter/S11, apply, operational DML, migration application, remote, or Git delivery.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1 | Declared focused runtime exited `1`: **4 passed, 1 failed, 0 skipped** because `0082` was absent; cleanup left no container. `npx tsc --noEmit` emitted **4** missing-table diagnostics. | Final focused disposable command: **5 passed, 0 failed, 0 skipped**. Exact storage/types, forced RLS, immutability, purge survival, concurrent uniqueness, and threat-safe cleanup pass. | Consolidated exact manual types without optionality drift and kept canonical timestamp/type validation in one fail-closed row scan; aggregate, type, lint, hash, and diff gates stayed green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → **5 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | The focused command used disposable `postgres:16-alpine`; exact columns/defaults/checks/count/hash/byte/projection/plan-row integrity, no FKs, active-Admin-only RLS, denied DML/helper access, mutation rejection, real source purge, concurrent one-row storage, argv-only execution, malicious database text, and final container absence all passed. |
| Rollback boundary | Remove `0082`, its exact manual table types/runtime proof, and coherent S9 docs only while storage is empty and no downstream state exists; after any approval exists, retain the ledger and disable future execution. |

### Verification, Preservation, and Workload

- Historical aggregate: **39 passed, 0 failed, 0 skipped**; protected calendar: **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged/scoped-untracked diff hygiene, and direct SHA checks passed; protected `0077`–`0080` are **4/4 OK**.
- Authored S9 change: **377 additions + 2 deletions = 379 changed lines**; **21-line headroom** to 400 with no exception. P3 closes below 1,200; S10 opens P4.
- Only task `3.1` is newly checked. Implementation slices are **9/20 complete**, whole plan **10/21 complete**, and **S10/3.2 only** is next.

## S9 Correction — Row-Derived Integrity and Deterministic Subprocess Cleanup

**Task:** 3.1 correction only; no checkbox or living-document ownership.
**State:** Complete after GREEN and repeated final verification.
**Mode:** Strict TDD.
**Boundary:** `0082` approval validation, the shared disposable-PostgreSQL subprocess safety boundary, S9 adversarial/runtime proof, and this correction receipt only.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 3.1 correction | Pre-change focused runtime/preservation command: **5 passed, 0 failed, 0 skipped**. | The self-consistent false count-vector probe exited `1`: **1 passed, 1 failed, 0 skipped**, because the expected integrity exception was absent. Before helper production changes, the deterministic subprocess command exited `1`: **1 passed, 1 failed, 1 skipped**, because the safety API was absent; the skip was the deliberately non-opted database scenario. | The final exact focused command passed twice consecutively at **10 passed, 0 failed, 0 skipped** per run. The adversarial approval is rejected and all four deterministic subprocess cases pass. | Centralized bounded argv-only execution, unique names, three-check readiness, and awaited `try/finally` cleanup with an exact post-cleanup absence query; valid S9 storage and all prior runtime behavior remained green. |

### Correction Result

- `validate_task_automation_historical_approval` now derives all eight disposition counts from actual plan rows and independently checks row/total, generate/suppress action, apply-count, and projection equations before accepting canonical hashes/fingerprints.
- A plan containing one generate row and one suppress row but self-consistently storing/hashing `[2,0,0,0,0,0,0,0]` now fails with `HISTORICAL_APPROVAL_INTEGRITY`.
- Disposable subprocesses use argument arrays only, a maximum `120000ms` timeout with `SIGKILL`, process/sequence-unique container names, bounded readiness attempts/delays, awaited cleanup, and a final exact-name absence query.
- Deterministic injected cases prove spawn, readiness, psql, and timeout failures all attempt cleanup, leave zero modeled containers, preserve the original failure when cleanup succeeds, and pass every configured `25ms` bound without sleeps or real Docker races.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → two consecutive final runs, each **10 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | The focused command used a unique disposable `postgres:16-alpine` container for real `0082` integrity/RLS/purge/concurrency proof; deterministic injected spawn/readiness/psql/timeout cases used no real subprocess delay. Both repeated runs completed cleanup, and the final `docker ps -aq --filter name=^actravel-` assertion was empty. |
| Rollback boundary | Revert only the row-derived `0082` tally/equations, S9 runtime adversarial/safety assertions, shared helper timeout/unique-container/awaited-wrapper changes, and this receipt. Retain original S9 storage/types, S1–S8, task state, `0081`, and protected `0077`–`0080`. |

### Aggregate Verification and Preservation

- Final historical aggregate with database opt-in → **44 passed, 0 failed, 0 skipped**.
- Final protected calendar parity with database opt-in → **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged/scoped-untracked diff hygiene, and final cleanup assertion exited `0`.
- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → **4/4 OK**.
- `tasks.md`, `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, and `docs/PROGRESS.md` retain pre-correction hashes `a42bc2d1...dce0b94`, `e86b4a09...47ec78f`, `952962c0...192913d`, and `1cb0f239...a189488`; task 3.1 remains checked, task 3.2 remains pending, and S10 routing is unchanged.

### Correction Line Delta and Scope

- `0082` validator: **13 additions + 2 deletions = 15 authored changed lines**, net `+11`.
- Shared subprocess helper: **81 additions + 6 deletions = 87 authored changed lines**, net `+75`.
- S9 adversarial and deterministic safety tests: **86 additions + 12 deletions = 98 authored changed lines**, net `+74`.
- Correction implementation/test total: **180 additions + 20 deletions = 200 authored changed lines**, net `+160`.
- Apply-progress correction evidence: **45 additions**. Total correction: **225 additions + 20 deletions = 245 authored changed lines**, net `+205`; no `size:exception`.
- No task checkbox, ACTIVE/decision/progress document, public schema, RPC, adapter, approval/apply behavior, operational data, remote state, or Git-delivery ownership changed.

## S10 — Approval Validation, Request Lock, Replay, and Conflict

**Task:** 3.2
**State:** Complete
**Mode:** Strict TDD
**Boundary:** Local unapplied `0083` database RPC only; no server adapter/S11, apply, operational DML, universe guard, migration application, remote, or Git delivery.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.2 | New static focused test exited `1`: **0 passed, 1 failed, 0 skipped** because `0083` was absent. The exact disposable runtime RED exited `1`: **10 passed, 1 failed, 0 skipped** because migration inventory ended at `0082`; cleanup completed. | Static focused proof passed **1/1**. Exact focused disposable approval/preservation command passed **11 passed, 0 failed, 0 skipped**. | Closed malformed-plan exceptions behind `INVALID_PLAN` and added exact request-byte, count-vector, and hash assertions; focused/runtime, aggregate, type, lint, manifest, diff, and cleanup gates remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval.test.ts` → **1 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → disposable PostgreSQL 16 **11 passed, 0 failed, 0 skipped**; auth precedence, canonical derivation/revalidation, hashes/counts/bytes/limits, exact signature/result, request serialization, replay/conflict/concurrency, zero operational mutation, and cleanup passed. |
| Rollback boundary | Revoke `approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb)` and remove only `0083` plus S10 proof/docs while no approvals exist; after any approval exists, disable execution and retain immutable `0082` rows and integrity/RLS objects. |

### Verification, Preservation, and Workload

- Historical database aggregate → **46 passed, 0 failed, 0 skipped**; protected calendar parity → **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged/scoped-untracked diff hygiene, direct SHA manifest, and final container cleanup exited `0`.
- Pre/post `sha256sum --check .../0077-0080.sha256` → **4/4 OK**; local `0081`–`0082`, all S1–S9 behavior, and their hashes remain unchanged.
- Authored S10 change: **250 additions plus deletions**; **150-line headroom** to 400 with no exception. P4 cumulative is the same S10 total and remains below 1,200.
- Delivery mode is autonomous local stacked-to-main slice metadata only; no commit, push, PR, remote, migration application, linked type generation, server adapter, or apply occurred.
- Only task `3.2` is newly checked. Implementation slices are **10/20 complete**, whole plan **11/21 complete**, and **S11/3.3 only** is next.

## S10 Correction — Canonical Success Timestamp and Failure Precedence

**Task:** 3.2 correction only; no checkbox or living-document ownership.
**State:** Complete after GREEN and final aggregate verification.
**Mode:** Strict TDD.
**Boundary:** `0083` success timestamp serialization, projection-versus-limit precedence, focused runtime assertions, and this correction receipt only.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.2 correction | The timestamp RED exited `1`: **10 passed, 1 failed, 0 skipped**, observing `2026-09-26T18:47:39.131275+00:00` instead of exact six-microsecond `Z` text. The combined invalid-projection/over-limit RED separately exited `1`: **10 passed, 1 failed, 0 skipped**, observing `LIMIT_EXCEEDED` instead of `INVALID_PROJECTION`. | Static focused proof passed **1/1** and the exact disposable focused runtime/preservation command passed **11 passed, 0 failed, 0 skipped**. Fresh and replay success timestamps are canonical, and the combined failure returns `INVALID_PROJECTION`. | Excluded only `created_at` from row JSON and rebuilt that key with the existing canonical UTC formatter; moved only the inherited count/family-limit block behind projection equality, retaining `LIMIT_EXCEEDED` before `HASH_MISMATCH` and persistence. |

### Correction Result

- Fresh and replayed `0083` successes return `created_at` as finite UTC RFC3339 text with exactly six fractional digits and `Z`; replay returns the byte-identical original timestamp.
- Caller projection equality is checked before count, family, projection-byte, and request-byte limits, so a canonical over-limit plan with mismatched projections returns `INVALID_PROJECTION`.
- Auth, request, preview, plan, limit, hash, lock, replay/conflict, insert, grants, signature, source-mutation, and all later precedence behavior remain unchanged.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval.test.ts` → **1 passed, 0 failed, 0 skipped**; `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → **11 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | The focused command used unique disposable PostgreSQL 16 containers and proved exact fresh/replay timestamps, combined failure precedence, S9/S10 integrity/auth/replay/conflict/concurrency, protected preservation, and cleanup with **zero skips**. |
| Rollback boundary | Revert only the two explicit `created_at` return expressions and relocated count/family-limit block in `0083`, the four focused test additions/one expectation replacement, and this receipt. Retain original S10, all task state, S1–S9, `0081`–`0082`, and protected `0077`–`0080`. |

### Aggregate Verification and Preservation

- Historical aggregate with database opt-in → **46 passed, 0 failed, 0 skipped**.
- Protected calendar parity with database opt-in → **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit` and `npm run lint` exited `0` with no diagnostics or findings.
- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → **4/4 OK**.
- Tracked, staged, and scoped untracked diff hygiene exited `0`; the final exact-name `actravel-*` container query was empty.
- `tasks.md`, `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, and `docs/PROGRESS.md` retain pre-correction hashes `ddddf767...f0034c4`, `b54de741...0add05`, `8ee9a1a1...3d499`, and `1cb0f239...a189488`; task 3.2 remains checked, task 3.3 remains pending, and S11 routing is unchanged.

### Correction Line Delta and Scope

- `0083` RPC: **10 additions + 8 deletions = 18 authored changed lines**, net `+2`.
- Focused runtime proof: **4 additions + 1 deletion = 5 authored changed lines**, net `+3`.
- Implementation/test correction total: **14 additions + 9 deletions = 23 authored changed lines**, net `+5`.
- Apply-progress correction evidence: **44 additions**. Total correction: **58 additions + 9 deletions = 67 authored changed lines**, net `+49`; no `size:exception`.
- No task checkbox, ACTIVE/decision/progress document, migration identifier/signature/grant, public type, operational data, remote state, or Git-delivery ownership changed.

## S11 — Approval Projection Derivation, Strict Adapter, and Exact Manual Types

**Task:** 3.3 | **State:** Complete | **Mode:** Strict TDD
**Boundary:** Server-only approval adapter and exact `0083` RPC type only; no `0084`+, apply, operational DML, migration application, remote, or Git delivery.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.3 | Declared focused command exited `1`: **1 passed, 1 failed, 0 skipped** because the approval adapter module did not exist. | Final focused command exited `0`: **5 passed, 0 failed, 0 skipped**; exact auth/input/projection/equation/RPC/result/type behavior passes. | Closed row/family/count/byte validation, recomputed the private fingerprint without public leakage, and retained exact code-only provider suppression; TypeScript and lint stayed green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval.test.ts tests/task-automation-historical-adapters-types.test.ts` → **5 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → disposable PostgreSQL 16 **11 passed, 0 failed, 0 skipped**; exact `0082`/`0083` integrity, auth, replay/conflict, concurrency, zero source mutation, preservation, and cleanup passed. |
| Rollback boundary | Remove only `lib/admin/task-automation-historical-approval.ts`, the exact manual `0083` RPC type, S11 tests/evidence, task `3.3`, decision, and ACTIVE route if unused; retain immutable approvals and disable `0083` execution after any persisted approval. |

### Verification and Preservation

- Historical aggregate with database opt-in: **49 passed, 0 failed, 0 skipped**; protected calendar: **2 passed, 0 failed, 0 skipped**; `npx tsc --noEmit`, `npm run lint`, diff hygiene, direct SHA manifest, and final container absence passed.

### Workload / PR Boundary

- Autonomous local stacked-to-main S11/P4 slice: **398 authored additions plus deletions**, **2-line headroom** to 400; P4 cumulative with S10 is **648**, below 1,200. Only task `3.3` is newly checked; implementation slices are **11/20**, whole plan **12/21**, and **S12/4.1 only** is next.

## S11 Correction — Exact Snapshot Cursor Identity Domains

**Task:** 3.3 correction only; no checkbox or living-document ownership.
**State:** Complete after GREEN and final aggregate verification.
**Mode:** Strict TDD.
**Boundary:** Approval-adapter snapshot cutoff validation, focused cursor-family regressions, and this correction receipt only.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.3 correction | After adding the valid three-hash-cursor and eight cross-family probes first, the exact focused command exited `1`: **5 passed, 2 failed, 0 skipped**. The valid hash preview made **0** persistence/RPC calls instead of one, while a UUID in `automationOrigins` reached persistence and returned `PERSISTENCE_FAILURE` instead of failing as `INVALID_PREVIEW`. | The same focused command exited `0`: **7 passed, 0 failed, 0 skipped**. All eight families now enforce their exact identity domain, null remains valid, invalid input performs zero persistence calls, and the valid three-hash preview reaches `approve_task_automation_historical_plan` with exact `0083` arguments. | Replaced the shared UUID check with one explicit closed validator map for the five UUID-keyed and three SHA-256-keyed families; no adapter result, type, RPC, or task contract changed. |

### Correction Result

- `opportunityRoots`, `quoteVersionRoots`, `assignmentEvidence`, `quoteSourceEvidence`, and `taskOccupancy` accept only canonical lowercase UUID cursor identities.
- `automationOrigins`, `automationOutcomes`, and `automationTombstones` accept only canonical 64-lowerhex SHA-256 cursor identities.
- Every family still accepts `null`. UUID/hash cross-family identities return code-only `INVALID_PREVIEW` before persistence-client construction or RPC execution.
- A preview with all eight non-null valid cursors reaches the exact `approve_task_automation_historical_plan` boundary and forwards the unchanged cutoff object.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval.test.ts tests/task-automation-historical-adapters-types.test.ts` → exit `0`; **7 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-approval-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → exit `0`; disposable PostgreSQL 16 **11 passed, 0 failed, 0 skipped** with approval integrity/auth/replay/conflict/concurrency, exact preservation, and cleanup green. |
| Rollback boundary | Revert only the snapshot identity-validator map/call in `lib/admin/task-automation-historical-approval.ts`, the two cursor-family tests and fixtures in `tests/task-automation-historical-approval.test.ts`, and this receipt. Retain all S11 adapter/types/task state, `0081`–`0083`, S1–S10, and protected `0077`–`0080`. |

### Aggregate Verification and Preservation

- Historical aggregate with database opt-in → **51 passed, 0 failed, 0 skipped**.
- Protected calendar parity with database opt-in → **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit` and `npm run lint` exited `0` with no diagnostics or findings.
- `sha256sum --check openspec/changes/week-03-task-automation-historical-bootstrap/0077-0080.sha256` → **4/4 OK**.
- Tracked, staged, and correction-scoped untracked diff hygiene exited `0`; the final local historical-test container query was empty.
- `tasks.md`, `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, and `lib/supabase/database.types.ts` retain their pre-correction hashes. Task `3.3` remains checked, S12 remains next, and no type or living-document state changed.

### Correction Line Delta and Scope

- Production adapter: **11 additions + 1 deletion = 12 authored changed lines**, net `+10`.
- Focused adapter regressions: **47 additions + 0 deletions**, net `+47`.
- Correction implementation/test total: **58 additions + 1 deletion = 59 authored changed lines**, net `+57`.
- Apply-progress correction evidence: **45 additions**. Total correction: **103 additions + 1 deletion = 104 authored changed lines**, net `+102`; no `size:exception`.
- No task checkbox, ACTIVE/decision/progress document, migration, public type, RPC shape, operational data, remote state, apply behavior, or Git-delivery ownership changed.

## S12 — Self-Validating Purge-Independent Apply Receipt

**Task:** 4.1 | **State:** Complete | **Mode:** Strict TDD
**Boundary:** Local unapplied `0084` receipt storage/integrity/RLS and exact manual table types only; no apply writer/coordinator, approval revalidation, universe guard, operational DML, migration application, remote, or Git delivery.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 4.1 | Database-focused command exited `1`: **4 passed, 2 failed, 0 skipped** because `0084` was absent; `npx tsc --noEmit` separately failed with four missing receipt-table type references. | Final focused database command exited `0`: **6 passed, 0 failed, 0 skipped**; exact schema, integrity, RLS, immutability, purge, concurrency, preservation, and type behavior passes. | Added explicit multidimensional/null/duplicate/order/cardinality and private-helper probes; a test-only expectation was corrected to admit CHECK rejection before trigger rejection, then focused, aggregate, type, lint, manifest, diff, and cleanup gates remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-apply-receipt.test.ts tests/task-automation-historical-adapters-types.test.ts tests/task-automation-historical-preservation.test.ts` → disposable PostgreSQL 16 **6 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | The focused command directly exercised the storage boundary without an apply coordinator: exact columns/types/defaults, no FKs, explicit empty arrays/zero counts, malformed dimensions/nulls/distinctness/order/cardinality, result/hash/bytes, active-Admin RLS, append-only rejection, purge survival, same-request concurrency, private helper ownership/search path/revocation, and cleanup all passed. Public receipt commit/replay remains S17. |
| Rollback boundary | Drop only `0084`, its empty receipt table, private helpers/policy/trigger, manual receipt types, S12 tests/evidence, task `4.1`, decision, and ACTIVE route while all bootstrap state is empty; after any receipt exists, disable future apply execution and retain immutable receipts. |

### Verification, Preservation, and Workload

- Historical aggregate with database opt-in: **53 passed, 0 failed, 0 skipped**; protected calendar: **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`, `npm run lint`, tracked/staged/scoped-untracked diff hygiene, direct SHA manifest, and final historical-container absence exited `0`.
- Pre/post `sha256sum --check .../0077-0080.sha256` → **4/4 OK**; S1–S11 and local unapplied `0081`–`0083` were not edited and remain green in the aggregate.
- Autonomous local stacked-to-main S12/P4 slice: **260 authored additions plus deletions**, **140-line headroom** to 400; P4 cumulative with S10/S11 is **908**, below 1,200. No `size:exception` is required.
- Only task `4.1` is newly checked. Implementation slices are **12/20 complete**, whole plan **13/21 complete**, and **S13/4.2 only** is next.

## S13 — Universe Guard, Exact Revalidation Foundation, and Phantom Prevention

**Task:** 4.2 | **State:** Complete | **Mode:** Strict TDD
**Boundary:** Local unapplied `0085` private no-write guard/revalidation only; no apply writer/coordinator, source-order/occupancy completion, operational bootstrap DML, migration application, remote, or Git delivery.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| 4.2 | Pre-slice SHA manifest: **4/4 OK**; S1–S12 were retained. | Declared focused command exited `1`: **3 passed, 2 failed, 0 skipped** because `0085` and its runtime boundary were absent; both disposable containers cleaned up. | Final focused/runtime command exited `0`: **5 passed, 0 failed, 0 skipped**. | Proved prior shared-writer drain; later Opportunity, assignment evidence, sent-version/event, future invalidation/tombstone, and profile writers block through exclusive commit/rollback; raw source/origin/Task locks collide exactly; cutoff, evidence, context, approval, and root drift return closed failures. | Kept the statement guard, root/evidence integrity, live context, and ranked advisory acquisition in separate private helpers; final focused proof remained green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-apply-concurrency.test.ts tests/task-automation-historical-preservation.test.ts` → disposable PostgreSQL 16 **5 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | Two-session runtime proves all eleven statement guards exist; prior shared writers drain; later root/evidence/context and existing `0080` source paths wait through exclusive commit/rollback; exact raw source/origin/Task identities interoperate; cutoff/evidence/context/approval/root drift fail closed; helpers leave Task/origin/outcome/tombstone/receipt counts unchanged; cleanup leaves no test container. |
| Rollback boundary | Disable dependent apply first. While no bootstrap execution/state exists, drop only the eleven `0085` statement triggers and three private functions plus S13 proof/docs; otherwise retain immutable/Task state and use a forward disable. Protected `0077`–`0080` and `0081`–`0084` are outside this rollback. |

### Verification, Preservation, and Workload

- Historical aggregate with database opt-in: **55 passed, 0 failed, 0 skipped**.
- The first aggregate invocation reached the runner's 600-second command timeout after 34 passing tests; its known disposable container was removed, and the complete 1,200-second rerun produced the final 55/55 result above.
- Protected disposable PostgreSQL calendar parity: **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit` and `npm run lint` exited `0` with no diagnostics or findings.
- Tracked/staged/scoped-untracked diff hygiene, post-slice SHA manifest **4/4 OK**, and final exact-name `actravel-*` container absence all exited `0`.
- Autonomous local stacked-to-main S13/P5 slice: **250 authored additions plus deletions**, **150-line headroom** to 400; P5 cumulative is **250**, below 1,200. No `size:exception` is required.
- No exact manual TypeScript type is owned by S13: all `0085` functions are private, ungranted PostgreSQL helpers and expose no Supabase RPC/table contract.
- Only task `4.2` is newly checked. Implementation slices are **13/20 complete**, whole plan **14/21 complete**, and **S14/4.3 only** is next.

## S14 — Private Deterministic Generate/Suppress Writer Primitives

**Task:** 4.3 | **State:** Complete | **Mode:** Strict TDD
**Boundary:** Local unapplied `0086` private writers and their declared runtime proof only; no public apply coordinator/S15, receipt finalization/S16, adapter, migration application, operational bootstrap execution, remote, or Git delivery.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 4.3 | Declared focused/runtime command exited `1`: **3 passed, 2 failed, 0 skipped** because `0086` and both writer primitives were absent; both disposable containers cleaned up. A later exact quote-context probe exited `1`: **1 passed, 1 failed, 0 skipped** before null-context rejection. | Final focused/runtime command exited `0`: **5 passed, 0 failed, 0 skipped**. Exact first-contact/quote generation, suppression, source order, occupancy, privacy/RLS, fixed failures, rollback, preservation, and cleanup pass. | Added quote-generation parity, canonical context closure, ordinal bounds, and full native identity assertions; writers remain lock-free private primitives after S13 revalidation, and final focused proof stayed green. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-automation-historical-apply-writers-runtime.test.ts tests/task-automation-historical-preservation.test.ts` → disposable PostgreSQL 16 **5 passed, 0 failed, 0 skipped**. |
| Runtime harness command/scenario and exact result | The focused command applies local migrations through `0086`, then proves exact deterministic first-contact and quote Tasks/origins/outcomes, exact suppress tombstone/outcome, no suppress Task/origin, frozen-order rejection, exact-retry rejection without adoption/convergence, current RLS/grants, a forced later-failure rollback, zero receipts, and final container absence. |
| Rollback boundary | Disable dependent apply first. Before any bootstrap writer use, remove only unused private `0086` plus its S14 test/evidence; after any native state exists, retain every Task/origin/outcome/tombstone and forward-disable execution. S1–S13 and `0077`–`0085` are outside this rollback. |

### Verification, Preservation, and Workload

- Historical aggregate with database opt-in: **57 passed, 0 failed, 0 skipped**.
- Protected disposable PostgreSQL calendar parity: **2 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit` and `npm run lint` exited `0` with no diagnostics or findings.
- Pre/post `sha256sum --check .../0077-0080.sha256` → **4/4 OK**; tracked/staged/scoped-untracked diff hygiene and final exact-name `actravel-*` container absence exited `0`; S1–S13 and local unapplied `0081`–`0085` remain preserved.
- Authored S14 change: **260 additions plus deletions**, **140-line headroom** to 400. P5 cumulative with S13 is **510 lines**, below 1,200; no `size:exception`.
- Only task `4.3` is newly checked. Implementation slices are **14/20 complete**, whole plan **15/21 complete**, and **S15 only** is next.

### Preservation and Next Boundary

`0086` exposes no public RPC and changes no RLS policy or grant. Its private fixed-search-path helpers consume approved projections after the S13 lock/revalidation order, insert exact native state once, return only ordered identity JSON, and reduce every failure to one code without partial writes. Public coordination, receipt finalization, adapters, operational bootstrap execution, remote work, rollout, production readiness, Mi día, and Week 03 closure remain absent.
