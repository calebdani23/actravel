# Proposal: Captured-Type TypeScript Compatibility Diagnostic

## Intent

Authorize one evidence-only, local TypeScript Compiler API diagnostic for the successful captured snapshot exploration. It determines whether the current tracked TypeScript source is compatible with the exact captured database type bytes without regenerating types, contacting providers, or claiming fresh provenance, alignment, or Week 01 closure.

## Scope

### In Scope
- `scripts/captured-type-tsc.mjs` and `tests/captured-type-tsc.test.mjs` only.
- Exactly one package script: `"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`, which runs the tests only. The runtime CLI is invoked directly, accepts no snapshot argument, and uses the contract-fixed snapshot.
- Strict TDD for schema literal `actravel.captured-type-tsc-result/v1`, the exact ordered result/nested shapes, exact snapshot identity, HEAD-blob/worktree preimage checks before and after, parsed-root tracked enforcement, exact route virtualization, baseline-zero gating, host override isolation, deterministic safe diagnostics, and no-write behavior. Tests inject a fake Git provider and spawn nothing.
- Build baseline and candidate programs in memory, overriding only the canonical database type source; read exact captured snapshot and tracked type bytes.

### Out of Scope
- Worktrees, builds, lint, runtime/contract tests, compiler subprocesses, network/provider access, writes, emit, remote generation, dependencies, lockfiles, or generated artifacts. No spawned process is permitted except the sole local read-only Git provider described below.
- Changes to tracked types, application/core/image/parent/adapter files, migrations, or any package script other than the named one.
- Fresh provenance/alignment evidence, operational recovery evidence, readiness, or Week 01 closure claims.

## Capabilities

### New Capabilities
- `captured-type-tsc`: A fail-closed in-memory compatibility diagnostic with schema literal `actravel.captured-type-tsc-result/v1`, exactly seven ordered top-level keys `{schema,snapshot,sourcePreimage,baselineDiagnostics,candidateDiagnostics,blocker,status}`, snapshot keys `{path,expectedSha256,observedSha256,bytes}`, source-preimage keys `{head,manifestSha256,fileCount,tsconfigSha256,typescriptVersion,compilerApiSha256}`, and diagnostic keys `{code,path,line,character,messageHash}`. Semantic results are `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT` or `BLOCKED`, with deterministic safe diagnostic hashes and no dynamic secret-bearing text.

### Modified Capabilities
- None.

## Approach

Use exactly one local read-only Git provider that executes `git` with `cwd` bound to canonical `repoRoot`, `shell:false`, and only these exact argv arrays:

```text
['rev-parse','--verify','HEAD^{commit}']
['ls-tree','-r','-z','--full-tree','HEAD']
['diff','--no-ext-diff','--no-textconv','--name-only','-z','HEAD']
['ls-files','--others','--exclude-standard','-z']
['cat-file','--batch']
```

Full-tree, diff, and untracked output is filtered in JavaScript to safe canonical `.ts`/`.tsx` paths; the `cat-file` call receives only validated `ls-tree` OIDs as newline-delimited bounded stdin and compares exact `HEAD` blob bytes against working TS/TSX files. No other Git or process command is permitted. Tests inject a fake provider and spawn nothing.

Parse the repository TypeScript configuration in memory and, before tracked-root enforcement, exclude `node_modules/**`, exact `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, exact `next-env.d.ts`, and `.next/types/**` plus `.next/dev/types/**`. Every remaining parsed root must be tracked in `HEAD`: arbitrary ignored TS/TSX included by `tsconfig.json` blocks, while ignored dependency/generated files outside parsed roots do not participate. Independently, any nonignored untracked TS/TSX reported by the exact `ls-files` call blocks. The snapshot is never a root and is used only as the canonical database-types override.

Keep database replacement and route virtualization distinct. Only canonical `lib/supabase/database.types.ts` may return baseline/candidate text. Only exact normalized `.next/types/routes.d.ts` and `.next/dev/types/routes.d.ts` return `fileExists:true`, `readFile:''`, and an empty in-memory `SourceFile` without disk reads. All other reads delegate, except that any request for another generated root blocks with `GENERATED_REQUEST`; generated diagnostics are not ignored. Compare tracked source bytes to exact `HEAD` blobs before and after execution and fail closed on any mismatch.

The result uses fixed snapshot path `tmp/audit-evidence/baseline-reconcile-remote-types.ts` and expected SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`; `snapshot.observedSha256` is `null` and `snapshot.bytes` is `0` until validation succeeds. Source-preimage strings are `null` and `fileCount` is `0` before their validations succeed. Import committed `canonicalJson` and `sha256Hex` from `./recovery-harness-lib.mjs`; every hash uses `sha256Hex`, while `canonicalJson` is used for structured hash preimages, not result serialization. The manifest hash preimage is the exact path-sorted array `{path,oid,bytesSha256}`, `tsconfigSha256` hashes raw tsconfig bytes, and `compilerApiSha256` hashes raw `node_modules/typescript/lib/typescript.js` bytes. Every unsafe semantic condition emits a `BLOCKED` JSON result; result serialization or stdout transport failure itself is outside semantic JSON and exits nonzero. Emit no files and never call `writeFile`. Keep code and tests under 600 authored lines, hard ceiling 650, with the session automatic/OpenSpec/stacked-to-main/review budget capped at 650.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/captured-type-tsc.mjs` | New | Direct CLI and in-memory compiler diagnostic. |
| `tests/captured-type-tsc.test.mjs` | New | Strict TDD contract and isolation coverage. |
| `package.json` | Modified | Add exactly `"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`; no other package change. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Generated or arbitrary ignored roots add misleading diagnostics | Med | Apply the exact root exclusions, require remaining parsed roots in `HEAD`, virtualize only the two route declarations, map other generated requests to `GENERATED_REQUEST`, and retain generated diagnostics. |
| Dirty tracked source produces false evidence | Med | Exact HEAD blob preimage guards before and after. |
| Git inspection escapes the narrow local boundary | Med | Allowlist the five exact `git` operations, require `shell: false`, validate `ls-tree` OIDs before `cat-file --batch`, inject a fake provider in tests, and reject every other Git/process command. |
| Unsafe semantic state implies alignment | Low | Closed schema, hashes only, explicit `BLOCKED`, no readiness claims. |

## Rollback Plan

Revert only the script, test, and exact package-script line. Preserve the captured ignored snapshot, tracked types, unrelated dirty image, and blocked parent change.

## Dependencies

- Existing pinned TypeScript API, repository `HEAD`, tracked source bytes, and the exact captured snapshot.

## Success Criteria

- [ ] Strict TDD passes for all stated boundaries; tests spawn nothing and production uses only the five-operation local read-only Git provider, with no other Git/process command, compiler subprocess, network, provider, write, or emit activity.
- [ ] CLI accepts no snapshot argument, uses the contract-fixed snapshot, and emits exactly one compact exact-order JSON result with the fixed schema literal, exact ordered top-level/nested shapes, the two permitted statuses, and hashes produced with the imported committed helpers; result serialization or stdout transport failure itself exits nonzero outside semantic JSON.
- [ ] No files, tracked bytes, dependencies, migrations, or Week 01 status change.
