# Apply Progress: Code B

## Change

`week-01-recovery-harness` — work unit `recovery-core-code-b-sanitizers-scanner`

## Completed Tasks

- [x] 1.1 Planning traceability and stacked boundary validation.
- [x] 1.2 Protected-path/image/allowlist boundary confirmation.
- [x] 2.1 Code A contract tests written first.
- [x] 2.2 Guard contract tests written first.
- [x] 2.3 Code A pure Node built-in implementation.
- [x] 2.4 Focused Code A verification.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.1 | `node --test tests/recovery-harness.test.mjs` exited 1: module not found | 8 tests passed, 0 failed | None required; focused tests retained |
| 2.2 | Included in same genuine RED: module not found | Guard cases pass in 8-test suite | None required; pure guard helpers retained |
| 2.3 | N/A — implementation task covered by 2.1/2.2 RED | `node --test tests/recovery-harness.test.mjs` exited 0 | Fixed parser semantic ordering, IPv6 authority parsing, dense-array checks, and worktree trackedness |
| 2.4 | N/A | 8 tests passed, 0 failed, 0 skipped | Diff/line boundary checked |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --test tests/recovery-harness.test.mjs`; exit 0; 9 passed, 0 failed, 0 skipped; TAP output SHA-256 `05bd8495c202913532292a938ae2bc0aeea1c8ced14ca52f97d910fe6d700bab` |
| Runtime harness command/scenario and exact result | N/A: Code A is pure built-in utility/guard behavior with no runtime or external-system boundary |
| Rollback boundary | Revert Code A changes in `scripts/recovery-harness-lib.mjs` and `tests/recovery-harness.test.mjs`; preserve all unrelated files and image |

## Fresh-validator Correction Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP retained at `/tmp/recovery-harness-validator-red.tap`; SHA-256 `275f8e451fd065c059a37818b9c22fd543f44116f05015b80ceb1dee1ff959ee`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; TAP retained at `/tmp/recovery-harness-validator-green.tap`; 9 passed, 0 failed, 0 skipped; SHA-256 `05bd8495c202913532292a938ae2bc0aeea1c8ced14ca52f97d910fe6d700bab`.
- Exact Code A two-file diff: `/tmp/recovery-harness-code-a-two-file.diff`; SHA-256 `17ca59a578a013a823c810a80092327c780d59e15c69aa9678d15d3d93eed3da`.
- Image proof: `docs/about/helps/intakes/image.png` SHA-256 pre/post `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; unchanged. Existing dirty paths observed and preserved: image, `docs/implementation/ACTIVE.md`, and unrelated OpenSpec/worktree files. Code A touched only its library/test files plus this progress artifact.
- Fixed defects: exact module export assertion and no `node:buffer` import; enumerable `__proto__` canonicalization; closed non-string path rejection; dense/extra-property arrays; enumerable data-only worktree entries; raw-backslash URL rejection; config precedence deferral; diagnostic field/reason/path/index checks.

## Authorized Focused Remediation Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP retained at `/tmp/recovery-harness-remediation-red.tap`; SHA-256 `f2d6ecbde99d138ea125c8a2b7d37f221bee053945832b9705d575b595b07cb1`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 9 tests passed, 0 failed, 0 skipped; TAP retained at `/tmp/recovery-harness-remediation-green.tap`; SHA-256 `197b5727d1fb451dcd33b785f021ebda75faa1966908e7ae8957b058a3e3873c`.
- Exact current Code A two-file diff: `/tmp/recovery-harness-remediation-code-a-two-file.diff`; SHA-256 `ade9ff846d811ebb2c9c8b55fc34a866c058d5e45ae7b3b195c6d78cdaf480e6`.
- Image pre/post SHA-256: `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; unchanged. Package and lockfile remain untouched.
- Current Code A library/test total: 438 lines, below the 750-line cap. `git diff --check` passed. Tasks 3.1–3.5 and 4.1 remain unchecked; no task checkbox changes were needed for this focused remediation.

## Four-Branch Remediation Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP retained at `/tmp/recovery-harness-four-branch-red.tap`; SHA-256 `3a7c1b16557455912dceda6179d1b90e265119f2fc07251eca7ea187870bb818`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 9 tests passed, 0 failed, 0 skipped; TAP retained at `/tmp/recovery-harness-four-branch-green.tap`; SHA-256 `6585da70023433f71082516e66727b48c152fc4f6a67537e348007f96aa92319`.
- Four fixes: invalid project ID now defers behind unknown ports; proxy/accessor inspection is converted to fixed closed errors for config/hash/URL/flags/path/worktree; dense arrays require every own enumerable data index with no compensating extras; containment requires absolute canonical paths while supporting `/` → `/child`.
- Exact current Code A two-file diff: `/tmp/recovery-harness-four-branch-code-a-two-file.diff`; SHA-256 `633f71c350774b3712bebb89ddb99e939f4b643a96836f05e54b01ce1fd94cc8`.
- Current Code A library/test total: 478 lines, below the 750-line cap. Image SHA-256 pre/post remains `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; package/lockfile unchanged; `git diff --check` passed.

## Final Trap-Hardening Evidence

- RED adversarial-trap command: `node --test tests/recovery-harness.test.mjs`; exit `1`; `/tmp/recovery-harness-final-trap-red.tap`; SHA-256 `b2b2393d6a82a26b27363bfcac11dfe9c704b78e6a81de8a749c066e9839c02b`.
- RED precedence recheck with invalid project/multi-defect cases: exit `1`; `/tmp/recovery-harness-four-branch-red.tap`; SHA-256 `3a7c1b16557455912dceda6179d1b90e265119f2fc07251eca7ea187870bb818`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 9 tests passed, 0 failed, 0 skipped; `/tmp/recovery-harness-final-trap-green.tap`; SHA-256 `30ce38f2b8d4986fab9da1744423f789f0d64cbe4135751ea2222da9c8be79b5`.
- Final fixes: exact unknown → missing → project ID → port precedence; reflective catches now construct API-specific errors without trusting caller error instances; typed-array, URL/options, flags, path, config, and worktree trap paths are hardened; dense worktree snapshots are validated before trusted policy checks.
- Exact current Code A two-file diff: `/tmp/recovery-harness-final-trap-code-a-two-file.diff`; SHA-256 `c5ae8b834be1b814da8f9951a4f27f1c78c030aa2aba961832aa639cc2f4093d`.
- Current Code A library/test total: 513 lines, below 750. Image SHA-256 pre/post `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; package/lockfile unchanged; protected/other dirty paths preserved; `git diff --check` passed.

## Bounded Maintainer Remediation Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP `/tmp/recovery-harness-bounded-red.tap`; SHA-256 `40e4e9b7fbdf78e09f071410864d5bc74c35f96cd79165db0d800ae3e79891fc`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 10 tests passed, 0 failed, 0 skipped; TAP `/tmp/recovery-harness-bounded-green.tap`; SHA-256 `a5ebc691056725178dd2e6bad62d12096211b370530efa686b14814002b1b611`.
- Fixes: canonical array length/indices are captured through safe reads; port unknown/missing inspection precedes project ID and port-domain checks; URL options are a closed plain enumerable data object with only optional boolean `allowCredentials`; deterministic clock-call guard added and no no-argument date/clock calls remain in the Code A test.
- Exact current Code A two-file diff: `/tmp/recovery-harness-bounded-code-a-two-file.diff`; SHA-256 `ba36c43ba83a50acf66cb16df80ac7fe1709b75dfb6a636d6dd557840faae863`.
- Current Code A library/test total: 539 lines, below 750. Image SHA-256 pre/post `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; package/lockfile unchanged; protected/other dirty paths preserved; `git diff --check` passed.

## Authorized Bounded Remediation Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP `/tmp/recovery-harness-authorized-red.tap`; SHA-256 `ec11baf153dab654b5ce4f893dc841715f85dc284cb051d4a988f7383b13e3d3`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 10 tests passed, 0 failed, 0 skipped; TAP `/tmp/recovery-harness-authorized-green.tap`; SHA-256 `e63d4ef8c72a5f642fe3717eed028be2f2de324e145803119bf41160b68d0579`.
- Fixes: revoked-array `Array.isArray` is guarded; config key/descriptors are inspected before any port value reads; worktree options require enumerable own data descriptors for exactly the two allowed keys; flags classify values in array order so earlier denied flags win over later invalid values.
- Exact current Code A two-file diff: `/tmp/recovery-harness-authorized-code-a-two-file.diff`; SHA-256 `f83b97361ca95249da275d7b302289a155fda07f2f5a357f1df1041c659cc388`.
- Current Code A library/test total: 569 lines, below 750. Image SHA-256 pre/post `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; package/lockfile unchanged; protected/other dirty paths preserved; `git diff --check` passed.

## Authorized Single-Branch Remediation Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP `/tmp/recovery-harness-single-branch-red.tap`; SHA-256 `3a1df34e12acda4ac35cc804642aad561b6ef19722796953f8e3e4163ac4adc0`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 10 tests passed, 0 failed, 0 skipped; TAP `/tmp/recovery-harness-single-branch-green.tap`; SHA-256 `857ac170934331b7b599b48e6c3f42e910409c87462f9e4679d3cf5810a71741`.
- Fix: worktree entries are now snapshotted and policy-validated one at a time after outer validation; protected/not-allowed/duplicate/path/status/tracked results from entry 0 stop processing before later malformed or trapping entries.
- Exact current Code A two-file diff: `/tmp/recovery-harness-single-branch-code-a-two-file.diff`; SHA-256 `1bd3a19a6ebd4072e21d8e9c08e2465742aeaf8516912e6043c93787e2a41f15`.
- Current Code A library/test total: 592 lines, below 750. Image SHA-256 pre/post `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; package/lockfile unchanged; protected/other dirty paths preserved; `git diff --check` passed.

## Authorized Single-Guard Remediation Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit `1`; ignored TAP `/tmp/recovery-harness-single-guard-red.tap`; SHA-256 `0df8ff4407a5c3dbe0a93957f49b441e1112af8c871f6e78c2ffbdcb4c8a60cc`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit `0`; 10 tests passed, 0 failed, 0 skipped; TAP `/tmp/recovery-harness-single-guard-green.tap`; SHA-256 `df3b474f1bd8e5c560a709ccfc45af7a0e30456c0d15aa968b5a3991797122e8`.
- Fix: existing canonical relative-path and uniqueness validation is now applied to both snapped `allowedPaths` and `protectedPaths` before entry iteration, preserving outer trap-safe and first-invalid behavior.
- Exact current Code A two-file diff: `/tmp/recovery-harness-single-guard-code-a-two-file.diff`; SHA-256 `2bc5e00e491a6c7dd17609f4ccd1bf404ab551ef68f347806b8c851240ca6e47`.
- Current Code A library/test total: 596 lines, below 750. Image SHA-256 pre/post `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; package/lockfile unchanged; protected/other dirty paths preserved; `git diff --check` passed.

## Boundary

- Code A only: config/artifact, canonical JSON/SHA-256, and runtime/local URL/flag/path/worktree guards.
- No package script, sanitizer, scanner, process, filesystem, network, Docker, Supabase, Postgres, provider, lifecycle, migration, lockfile, or image behavior.
- Final export surface remains pending Code B; this batch exports only the coherent Code A subset.
- Incremental cap: within 750 lines for library and tests; no package or image changes.

## Remaining Tasks

- [x] 3.1 Contextual sanitizer/scanner RED tests written first; genuine RED retained.
- [x] 3.2 Detector boundary, placeholder, UTF-8, array, and safe-finding RED coverage added.
- [x] 3.3 Shared PEM/URL/JWT/key detectors and argv/env/text sanitizers implemented with post-scan checks.
- [x] 3.4 Added the sole `test:recovery-harness` package script; package-lock unchanged.
- [x] 3.5 Focused test, npm script, lint, diff, package, and image/protected-state checks passed.
- [x] 4.1 Recorded utility/guard core PASS only; recovery readiness and Week 01 closure remain unproven.

## Code B TDD and Work Unit Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 3.1–3.2 | `node --test tests/recovery-harness.test.mjs` exit 1; TAP SHA-256 `05459f9b42db26b89811f4e1838de0cdb40263c7c32b88c3400a8e96dd12d244` | 13 passed, 0 failed; TAP SHA-256 `85f7b4cd6be180cecc33de276fbfe1269c0eb6919a7dd75bb9642ebc737b3d90` | Removed unused legacy helpers; no behavior change; lint clean |
| 3.3 | Covered by genuine RED above | Focused suite exit 0, 13 passed, 0 failed | Shared detectors and contextual precedence kept dependency-free |
| 3.4–3.5 | N/A — package/lint verification | `npm run test:recovery-harness` exit 0; TAP SHA-256 `f287914ae3f8341a068d05f90923da44624ce1e61c8401a52378fbdf5a57972c`; `npm run lint` exit 0; SHA-256 `a3e9b66d14fa4bb6754ad6ae02b8fbce4a89f69a34d1bff813ba517d296e29b9` | Exact package script only; lockfile unchanged |

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --test tests/recovery-harness.test.mjs`; exit 0; 13 passed, 0 failed, 0 skipped; TAP SHA-256 `85f7b4cd6be180cecc33de276fbfe1269c0eb6919a7dd75bb9642ebc737b3d90` |
| Runtime harness command/scenario and exact result | N/A: pure built-in sanitizer/scanner APIs; no runtime or external-system boundary exists |
| Rollback boundary | Revert Code B hunks in `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`, and the sole `package.json` script; preserve Code A and unrelated dirty paths |

## Boundary and Interpretation

- Code B incremental diff is 145 added / 14 removed lines (159 changed) across the three-file allowlist, below the 500-line cap; `git diff --check` passed.
- `package-lock.json` is unchanged. The image SHA-256 remains `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; protected/unrelated dirty paths were not edited.
- Final module surface is exactly the 15 exports specified by the change.
- Core utility/guard PASS does not establish recovery readiness or close Week 01; execution, receipts, invariants, cleanup, manifests, SQL, lifecycle, and provider evidence remain deferred.

## Code B Phase-Contract Correction Evidence

- RED command: `node --test tests/recovery-harness.test.mjs`; exit 1 with 14 prior tests passing and 3 contract failures; retained TAP SHA-256 `5f85ec6ab36cb89d18e2e6efaf67b506494aad17dbe43ec06b09287dc2e0ffd2`.
- GREEN command: `node --test tests/recovery-harness.test.mjs`; exit 0; 17 passed, 0 failed, 0 skipped; retained TAP SHA-256 `d18c9c6c00d4ae6b0853d48c44dce2bf767624f9f053589ae3431b4630092791`.
- Package-script GREEN: `npm run test:recovery-harness`; exit 0; TAP SHA-256 `d95de116e8a1d64c64cdb81337471fe2f1f44777e85814e55adcdc1d26ae1fe4`.
- Lint GREEN: `npm run lint`; exit 0, no warnings; TAP SHA-256 `27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf`.
- Defects fixed: grouped named PEM label/body grammar now accepts complete padded/unpadded lines and mixed LF/CRLF; sanitizer catches always construct fresh closed errors; env descriptor reads are guarded; unused `denseObjects` and lint issue removed.
- Current Code B allowlist diff: 217 added / 15 removed lines (232 changed), below the 500-line cap; `git diff --check` passed. `package-lock.json` unchanged; exact existing package script preserved.
- Image SHA-256 remains `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; unrelated dirty/protected paths were preserved; no external calls, lifecycle commands, staging, commit, or push performed.
