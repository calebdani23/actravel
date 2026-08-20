# Tasks: Captured-Type TypeScript Compatibility Diagnostic

## Review Workload Forecast

| Field | Value |
|---|---|
| Expected authored lines | 430–540 (script 180–240, tests 220–300, package line, progress artifact) |
| Generated lines | 0; no generated artifact or lockfile change |
| 400-line budget risk | High |
| One-PR decision | Yes, one autonomous slice; stop before hard 650-line ceiling and obtain review exception if authored count exceeds 400 |
| Exact focused commands | `node --test tests/captured-type-tsc.test.mjs`; `npm run test:captured-type-tsc`; `node scripts/captured-type-tsc.mjs`; `wc -l scripts/captured-type-tsc.mjs tests/captured-type-tsc.test.mjs` |
| Runtime evidence | Direct CLI output: one compact JSON line, empty stderr, exit 0 for compatibility or 2 for semantic `BLOCKED`; capture in `apply-progress.md` |
| Stop conditions | Any forbidden path/process/write, failed RED/GREEN test, protected hash/status change, nonzero lint/core test, authored lines >650, or CLI result outside the closed contract |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

## Phase 1: RED Contract and Isolation Tests

- [x] 1.1 Add failing `node:test` assertions in `tests/captured-type-tsc.test.mjs` for exports, exact seven-key result/nested order, fixed snapshot identity, both statuses, and every blocker mapping.
- [x] 1.2 Add RED tests for root filtering/virtualization: excluded dependency/snapshot/`next-env.d.ts`/route roots, arbitrary ignored parsed roots blocking, unrelated ignored files ignored, exact route virtualization, and `GENERATED_REQUEST`.
- [x] 1.3 Add RED tests for baseline-zero gating, candidate diagnostics, source-less/generated diagnostics, deterministic dedup/sort, safe relative paths, one-based positions, and hashed messages.
- [x] 1.4 Add RED fake-provider tests for exact Git argv/cwd/env/`shell:false`, validated OID and canonical-path guards, cat-file count/blob/aggregate/maxBuffer bounds, malformed raw-byte records, and provider failures.
- [x] 1.5 Add RED tests for pre/post HEAD/worktree snapshot identity, no emit/write/disk-read route behavior, no network/process spawning, CLI no-argument/fixed-snapshot behavior, exact stdout/stderr, and exit statuses.

## Phase 2: GREEN Implementation

- [x] 2.1 Create `scripts/captured-type-tsc.mjs` with fixed constants, safe result renderer, blocker results, and imports of `canonicalJson`/`sha256Hex` from `./recovery-harness-lib.mjs`.
- [x] 2.2 Implement the bounded five-operation `createGitProvider`, HEAD manifest/blob validation, raw working-byte preimage checks, exact environment/argv guards, and fail-closed mappings.
- [x] 2.3 Implement in-memory tsconfig root narrowing, tracked-root enforcement, snapshot validation, isolated database override, exact route host virtualization, noEmit compiler programs, and diagnostic normalization.
- [x] 2.4 Implement `runCapturedTypeTsc` and direct CLI output with no snapshot argument; make all RED tests pass without writes, emit, network, or compiler subprocesses.

## Phase 3: Wiring and Verification

- [x] 3.1 Add only the exact `test:captured-type-tsc` script to `package.json`; do not change dependencies or lockfiles.
- [x] 3.2 Run `node --test tests/captured-type-tsc.test.mjs` and `npm run test:captured-type-tsc`; record exact 18-test results and failures in `openspec/changes/week-01-captured-type-tsc/apply-progress.md`.
- [x] 3.3 Run `node scripts/captured-type-tsc.mjs` against the fixed captured snapshot; record stdout, stderr, exit status, and whether the result is compatible or safely blocked.
- [x] 3.4 Verify `git diff --check`, `npm run lint`, core tests `npm run test:quote-notifications`, protected hashes/status, allowed paths, and authored line count target ≤600/hard ≤650.

## Phase 4: Rollback and Evidence

- [x] 4.1 Complete `apply-progress.md` with commands, runtime evidence, line counts, protected-state checks, stop-condition outcomes, and rollback boundary.
- [x] 4.2 If any stop condition occurs, do not broaden scope; revert only the script, test, exact package line, and this progress artifact, preserving snapshot, tracked types, dirty image, and parent `BLOCKED` state.
