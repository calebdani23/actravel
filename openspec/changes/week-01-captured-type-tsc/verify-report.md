```yaml
schema: gentle-ai.verify-result/v1
change: week-01-captured-type-tsc
mode: strict-tdd
attempt_token: sha256:bfe880ab01a32e18185bff37e30e9251f5b0886d131651d9ec3fd30c2ec5fdd5
target: local commit a39e24a88e4199f482ecff671ed12d7ca745c969
review_lineage: review-b3db546851eba888
review_status: approved
tasks: {completed: 15, total: 15}
requirements: {verified: 8, total: 8}
scenarios: {verified: 8, total: 8}
tests:
  focused: {command: "node --test tests/captured-type-tsc.test.mjs", exit_code: 0, passed: 19, failed: 0, test_output_hash: sha256:e5d4f2d8b44ed591fc8b2cab2aadc01cfdeb32156ee788a18c35135d7b8d6f6b}
  package: {command: "npm run test:captured-type-tsc", exit_code: 0, passed: 19, failed: 0, test_output_hash: sha256:b5cafd2b190cf93add3233a92b0d8dfa3154ca513f29ac56d152a247691617f0}
  lint: {command: "npm run lint", exit_code: 0, test_output_hash: sha256:27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf}
  quote_notifications: {command: "npm run test:quote-notifications", exit_code: 0, passed: 15, failed: 0, test_output_hash: sha256:691818b0f26367badede8bb5a18f24f757fb784dd386043a11af9e5a17aa1208}
  build: {command: "not run: excluded by exact interpretation", exit_code: null, build_output_hash: null}
cli:
  command: "node scripts/captured-type-tsc.mjs"
  exit_code: 0
  stderr_bytes: 0
  stdout_bytes: 792
  stdout_hash: sha256:e2d16fed6568f8de17712e346011b8a022d9b493ddf615c5f3ec8fc36266e16f
  status: TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT
  blocker: null
preimage:
  snapshot_sha256: b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637
  snapshot_bytes: 113159
  head: a39e24a88e4199f482ecff671ed12d7ca745c969
  manifest_sha256: a7e7793b98aa34431bf3f7a06463e24fa778980e5b8762ffae5de3dadacf90c2
  file_count: 283
  tsconfig_sha256: d225314272ea5de70d00ba508137529103761550e4f779abeddc551f77339b17
  typescript_version: 6.0.3
  compiler_api_sha256: 569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39
protected:
  database_types_sha256: 3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436
  package_lock_sha256: 3b175f0c194a4b8d9e8f0f6328ab15e3b305937ff3bcdee8d6ca67639ebb512f
  authored_lines: 237
  diff_check_exit_code: 0
verdict: PASS WITH WARNINGS
delivery_warning: push externally blocked by missing GitHub credentials; not an implementation failure
```

## Verification Report

### Completeness

| Dimension | Result |
|---|---|
| Tasks | 15/15 complete |
| Requirements | 8/8 verified |
| Scenarios | 8/8 verified |
| Review lineage | Approved: `review-b3db546851eba888` |
| Implementation target | `a39e24a88e4199f482ecff671ed12d7ca745c969` |

### Runtime evidence

- Focused and package suites passed 19/19 each; quote notifications passed 15/15.
- Lint passed with exit 0. `git diff --check` passed.
- The direct CLI emitted exactly one compact JSON line, empty stderr, exit 0, fixed snapshot identity, zero baseline/candidate diagnostics, and the compatible status. A snapshot argument was rejected with exit 1 and no output.
- Exact result key order, nested shapes, status/blocker coherence, snapshot bytes/hash, source preimage values, and deterministic hashes were validated.

### Compliance matrix

| Requirement / scenarios | Evidence | Result |
|---|---|---|
| Three-file implementation boundary / scope inspection | Implementation changes are limited to the exact package script plus the two implementation/test files; OpenSpec artifacts are documentation, while lockfile and tracked types are unchanged | PASS |
| Fixed snapshot and source identities / identity changes | CLI and pre/post fake-provider tests prove fixed snapshot, HEAD/blob/worktree checks, and fail-closed preimage behavior | PASS |
| Git/compiler boundary / hostile input | 19 strict tests cover exact argv, cwd, environment, `shell:false`, bounds, paths, provider errors, and no spawning in tests | PASS |
| Config and database/route isolation / generated or unrelated reads | Root filtering and exact route virtualization tests pass; other generated requests block | PASS |
| Baseline-zero diagnostics and no writes / diagnostics exist | Compiler diagnostic tests pass; noEmit/no-write assertions pass; baseline and candidate diagnostics are empty in CLI run | PASS |
| Closed result contract / blocker mapping and compatibility run | Exact schema/order/hash checks and all eight blocker mappings pass; CLI is compatible with blocker `null` | PASS |
| Strict bounded tests / budget | Runtime isolation suite passes; 237 authored lines is below 600 target and 650 ceiling | PASS |

### Design coherence

Implementation matches the design: one narrow local Git provider, in-memory TypeScript programs, canonical database override distinct from route virtualization, pre/post source preimages, deterministic diagnostic normalization, and closed semantic results. No build, fresh provenance, tracked-type regeneration/alignment, recovery readiness, or Week 01 closure was evaluated or claimed, per the exact change interpretation.

### Issues

#### WARNING

- Delivery push is externally blocked by missing GitHub credentials. This does not affect implementation or verification of the local committed target.
- Build was intentionally not run because build verification is explicitly outside this change’s interpretation.

## Final verdict

**PASS WITH WARNINGS** — the 15-task captured-snapshot compatibility diagnostic is independently verified at the approved local commit; only external delivery credentials and intentionally excluded broader Week 01 gates remain warnings.
