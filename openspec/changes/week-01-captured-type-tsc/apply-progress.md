# Apply Progress: Captured-Type TypeScript Compatibility Diagnostic

## Status

All 15 tasks are complete under the maintainer-approved single-PR `size-exception`; implementation remains bounded to the requested source/test/package/artifact paths. The final transition fix now covers compatible postimage drift with a freshly constructed blocked result, without changing other behavior. Production uses host-compatible enumeration plus JavaScript `.ts`/`.tsx` filtering.

## TDD Evidence

| Work unit | RED | GREEN | REFACTOR |
|---|---|---|---|
| Contract, provider, compiler seams, diagnostics, CLI | Initial import failed with `ERR_MODULE_NOT_FOUND`; explicit fake-provider, malformed-renderer, route, cat-file, checkpoint, dense-diagnostic, selected-entry, compiler-exception, no-write/no-emit, and compatible-postimage-drift assertions were added | `node --test tests/captured-type-tsc.test.mjs`: 19/19 passed; `npm run test:captured-type-tsc`: 19/19 passed | Tightened exact result validation, copied diagnostics into dense exact-key objects, rejected unsafe diagnostic paths, rejected all nonzero Git statuses, finalized every post-preimage semantic outcome, and constructed blocked results for compatible drift |
| Host-compatible Git enumeration | New enumeration assertion failed with `mod.enumerateTypescriptManifest is not a function` | Enumeration test passes and confirms non-TypeScript entries are filtered while `foo.ts` remains | Retained OID allowlist, path validation, bounds, and pre/post byte proof |
| TS5074 compiler precondition | New option-normalization assertion failed with `mod.normalizeCompilerOptions is not a function`; local TypeScript 6.0.3 table identified code 5074 as incremental-without-tsBuildInfoFile | Focused/package suites pass 8/8; runtime reaches compatibility result | Disabled only `incremental`/`composite`, removed `tsBuildInfoFile`, retained strict/noEmit/module, and used identical options for both programs |
| Contract hardening | RED exposed undeclared helper exports, permissive result fields, inherited Git environment, and unsafe path handling | Focused suite passes after exact export closure, strict result validation, fixed environment, bounds, diagnostic API normalization, and preimage failure mapping | Added blocker matrix and missing-worktree coverage without broadening the public seams |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command | `node --test tests/captured-type-tsc.test.mjs` — PASS, 19 tests; `npm run test:captured-type-tsc` — PASS, 19 tests |
| Runtime harness | `node scripts/captured-type-tsc.mjs` — one compact JSON line, empty stderr, exit 0; semantic result `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT`, blocker `null`, baseline diagnostics 0, candidate diagnostics 0. Snapshot observed SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`, bytes `113159`; HEAD `b9d302a8ea5807e38c9e584f1ca0515b22986e72`; manifest `a7e7793b98aa34431bf3f7a06463e24fa778980e5b8762ffae5de3dadacf90c2`; file count `283`; tsconfig `d225314272ea5de70d00ba508137529103761550e4f779abeddc551f77339b17`; TypeScript `6.0.3`; compiler API `569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39`. |
| Rollback boundary | Revert only `scripts/captured-type-tsc.mjs`, `tests/captured-type-tsc.test.mjs`, the exact `test:captured-type-tsc` package line, and this artifact; preserve snapshot, tracked types, image, parent change, and unrelated docs. |

## Verification

- `npm run lint` — PASS, no errors or warnings.
- `npm run test:quote-notifications` — PASS, 15/15.
- `git diff --check` — PASS.
- Authored line count: script 68, tests 169, combined 237; within ≤600 target and 650 hard ceiling.
- Protected SHA-256 unchanged during this correction: `lib/supabase/database.types.ts` `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436`; `package-lock.json` `3b175f0c194a4b8d9e8f0f6328ab15e3b305937ff3bcdee8d6ca67639ebb512f`.
- Existing unrelated dirty state preserved: `docs/about/helps/intakes/image.png` and `docs/implementation/ACTIVE.md`; no staging performed.

## Deviations / Stop Conditions

The actual CLI now reaches a compatible result after the in-memory TS5074 precondition normalization; no GIT_BOUNDARY remains from unsupported pathspec syntax. No tracked application/types/migrations/core/image/parent/adapter/lockfile/dependency files were changed; no network, compiler subprocess, emit, or write was used.
