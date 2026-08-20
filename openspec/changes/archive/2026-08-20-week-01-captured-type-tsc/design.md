# Design: Captured-Type TypeScript Compatibility Diagnostic

## Technical Approach

Implement a fixed-input, in-memory TypeScript Compiler API diagnostic. The `.mjs` CLI accepts no snapshot argument and validates the contract-fixed snapshot, parses and narrows `tsconfig.json`, proves the tracked TypeScript HEAD preimage before and after compilation, then runs baseline and captured-type programs. It emits one compact exact-order JSON object only after all semantic values have been validated. Every unsafe semantic condition produces a `BLOCKED` JSON result; result serialization or stdout transport failure itself is outside semantic JSON and exits nonzero. No emit, write, network, compiler subprocess, or provider API is used.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Result contract | Schema literal `actravel.captured-type-tsc-result/v1`; exactly seven ordered keys: `schema`, `snapshot`, `sourcePreimage`, `baselineDiagnostics`, `candidateDiagnostics`, `blocker`, `status`; exact ordered nested shapes; `blocker` is top-level only | Prevents nested ambiguity and keeps semantic failures closed and machine-readable. |
| Failure model | Exactly eight non-null codes: `SNAPSHOT_IDENTITY`, `GIT_BOUNDARY`, `CONFIG_ROOT`, `GENERATED_REQUEST`, `BASELINE_DIAGNOSTIC`, `CANDIDATE_DIAGNOSTIC`, `PREIMAGE_CHANGED`, `COMPILER_FAILURE`; compatible means `blocker: null` | Every unsafe semantic condition produces `BLOCKED`; result serialization or OS stdout transport failure cannot be safely represented and exits nonzero outside semantic JSON. |
| Git boundary | `createGitProvider({repoRoot, executor})` canonicalizes and binds `repoRoot`; it exposes only the five exact allowlisted `shell:false` operations | Keeps command, cwd, environment, and process authority narrow; fake providers can enforce the same contract without spawning. |
| Compiler isolation | Before tracked-root enforcement, exclude `node_modules/**`, exact `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, exact `next-env.d.ts`, and `.next/types/**` plus `.next/dev/types/**`; require every remaining parsed root to be tracked in `HEAD`; keep database replacement and exact route virtualization as distinct host exceptions | Preserves the repository config while preventing dependency/generated declarations and the captured file from becoming accidental roots without authorizing arbitrary ignored roots. |

## Data Flow

`validated fs/config → parsed roots → exact exclusions → tracked-root enforcement + Git HEAD manifest/exact blobs → working-byte preimage → baseline → candidate → working-byte postimage → validated primitives → one exact-order JSON write`

The Git provider executes `git` with `cwd` bound to canonical `repoRoot`, `shell:false`, the isolated environment (`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_OPTIONAL_LOCKS=0`, `GIT_PAGER=cat`, `GIT_EXTERNAL_DIFF=:`, `LC_ALL=C`, inherited `PATH`), and only these exact argv arrays:

```text
['rev-parse','--verify','HEAD^{commit}']
['ls-tree','-r','-z','--full-tree','HEAD']
['diff','--no-ext-diff','--no-textconv','--name-only','-z','HEAD']
['ls-files','--others','--exclude-standard','-z']
['cat-file','--batch']
```

The host-compatible full-tree `ls-tree` enumeration is filtered in JavaScript to safe canonical regular `.ts`/`.tsx` paths before the existing bounds. `diff` and `ls-files` similarly filter NUL-delimited enumerations while retaining `--no-ext-diff` and `--no-textconv`. The `cat-file` call receives only validated `ls-tree` OIDs as newline-delimited bounded stdin. `ls-tree` records require safe canonical relative paths, regular blob modes `100644`/`100755`, type `blob`, and 40-hex OIDs. `cat-file` accepts at most 1024 files, 2 MiB per blob, 64 MiB aggregate, and uses `maxBuffer: 80 MiB`; headers and payload lengths are exact, and truncation, overflow, extra records, or non-blobs block. Raw HEAD blob bytes are compared byte-for-byte and by SHA-256 with working bytes before and after.

Any nonignored untracked TS/TSX reported by the exact `ls-files` call blocks. Ignored-file enforcement occurs at parsed compiler roots: after excluding `node_modules/**`, exact `next-env.d.ts`, `.next/types/**`, `.next/dev/types/**`, and exact `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, every remaining parsed root must be tracked in `HEAD`. Thus an arbitrary ignored TS/TSX included by `tsconfig.json` blocks, while ignored dependency/generated files outside the parsed roots do not participate. The snapshot is never a root and is used only as the canonical database-types override.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/captured-type-tsc.mjs` | Create | Providers, identity/preimage guards, config/root filtering, compiler seams, diagnostics, canonical CLI result. |
| `tests/captured-type-tsc.test.mjs` | Create | Strict fake-provider/virtual-host contract tests and boundary RED coverage. |
| `package.json` | Modify | Add only `"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`. |

## Interfaces / Contracts

Exports: `EXPECTED_SNAPSHOT_PATH`, `EXPECTED_SNAPSHOT_SHA256`, `CANONICAL_DB_TYPES_PATH`, `GENERATED_ROUTE_PATHS`, `runCapturedTypeTsc`, `createGitProvider`, `createCompilerSeams`, `renderResult`, `renderBlockedError`. The runtime CLI accepts no snapshot argument and uses `EXPECTED_SNAPSHOT_PATH` only.

The result schema literal is `actravel.captured-type-tsc-result/v1`, and the keys and order are exactly `{schema,snapshot,sourcePreimage,baselineDiagnostics,candidateDiagnostics,blocker,status}`. `snapshot` is exactly `{path,expectedSha256,observedSha256,bytes}`: `path` and `expectedSha256` are fixed to `tmp/audit-evidence/baseline-reconcile-remote-types.ts` and `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`, while `observedSha256:null` and `bytes:0` remain until snapshot validation succeeds. `sourcePreimage` is exactly `{head,manifestSha256,fileCount,tsconfigSha256,typescriptVersion,compilerApiSha256}`; its string fields are `null` and `fileCount` is `0` before their validations succeed, while validated earlier values survive later blocking. Diagnostics contain exactly `{code,path,line,character,messageHash}` in that order; source-less fields are null, paths are safe relative paths, hashes are lowercase SHA-256 of flattened messages, and records are deduplicated then sorted by path/null, line/null, character/null, code, hash. Status is exactly `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT` or `BLOCKED`, and `blocker` exists only at the top level.

The implementation imports the committed `canonicalJson` and `sha256Hex` from `./recovery-harness-lib.mjs`; it defines no substitute canonical/hash helper. Every hash uses `sha256Hex`; `canonicalJson` is used for structured hash preimages, not result serialization. The manifest hash preimage is the exact array of `{path,oid,bytesSha256}` records sorted by path, and `manifestSha256` is `sha256Hex(canonicalJson(records))`. `tsconfigSha256` hashes the raw `tsconfig.json` bytes, and `compilerApiSha256` hashes the raw `node_modules/typescript/lib/typescript.js` bytes.

Compiler host exceptions are distinct. Only canonical `lib/supabase/database.types.ts` may return the tracked baseline text or captured candidate text. Separately, only exact normalized `.next/types/routes.d.ts` and `.next/dev/types/routes.d.ts` return `fileExists:true`, `readFile:''`, and an empty in-memory `SourceFile`, without disk reads. All other reads delegate, except that any request for another generated root blocks with `GENERATED_REQUEST`.

Stage mapping is deterministic: snapshot path/hash/bytes → `SNAPSHOT_IDENTITY`; Git command/shell/path/provider/index-independent failure → `GIT_BOUNDARY`; parsed-root filtering → `CONFIG_ROOT`; any generated-root request other than the exact virtualized `.next/types/routes.d.ts` and `.next/dev/types/routes.d.ts` paths → `GENERATED_REQUEST`; baseline diagnostics → `BASELINE_DIAGNOSTIC`; candidate diagnostics → `CANDIDATE_DIAGNOSTIC`; compiler/API/options/global/input-I/O exception → `COMPILER_FAILURE`; pre/post HEAD, path, count, manifest, blob, or working-byte mismatch → `PREIMAGE_CHANGED`. Generated diagnostics are not ignored and map to the applicable baseline or candidate diagnostic blocker. Compatible alone has `blocker:null`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Exact exports, seven-key schema/order, blocker mapping, null fields, diagnostics, bounds/parsers | `node:test`, strict assertions, virtual bytes/hosts. |
| Integration | Parsed-root tracked enforcement, ignored/nonignored handling, route virtualization, baseline/candidate override isolation, pre/post preimage | Inject fake Git provider; assert no spawn, disk read for virtual routes, network, write, or emit. |
| CLI | No snapshot argument; contract-fixed snapshot; compact exact-order JSON + one LF, empty stderr, exit 0/2; result serialization or stdout transport failure is nonzero and not JSON | Invoke renderer seams; fake provider remains strict. |

RED cases cover the absence of a CLI snapshot argument, hostile env/cwd/shell, altered argv, unsafe paths, invalid OIDs/headers/counts/payloads, hidden-index byte changes, nonignored untracked TS/TSX, arbitrary ignored parsed roots, ignored dependency/generated files outside roots, source-less and generated diagnostics, dedup/sort, and all eight blocker codes. Implementation and tests target ≤600 authored lines, hard ceiling 650.

## Threat Matrix

| Boundary | Status | Required safe/failure behavior and RED test |
|---|---|---|
| Shell/subprocess | Applicable | Only the five Git operations, canonical cwd, isolated env, `shell:false`; reject altered/extra calls. |
| VCS/worktree | Applicable | Compare HEAD/path/count/manifest/raw blob bytes before and after; additions or changes block. |
| Generated routing | Applicable | Only exact normalized `.next/types/routes.d.ts` and `.next/dev/types/routes.d.ts` virtualize; all other generated-root requests map to `GENERATED_REQUEST`, and generated diagnostics are not ignored. |
| VCS/PR/build/runtime automation | N/A | No such integration exists; no task or test required. |

## Migration / Rollout

No migration or feature flag. Allocate `scripts/captured-type-tsc.mjs` lines 1–300 (target; hard max 330), `tests/captured-type-tsc.test.mjs` lines 1–270 (target; hard max 320), and one `package.json` script line. Task sequence: (1) RED closed-result/renderer and exports, (2) RED provider allowlist and bounded Git parsing, (3) RED snapshot/config/root/route seams, (4) RED compiler and diagnostic normalization, (5) RED pre/post guards and no-I/O assertions, (6) implement in that order, then verify total ≤600/650. No build, lint, regeneration, or other file changes.

## Open Questions

None.
