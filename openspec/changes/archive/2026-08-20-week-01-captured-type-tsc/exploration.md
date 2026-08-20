## Exploration: week-01-captured-type-tsc

### Current State
The active Week 01 parent remains blocked, but the prerequisite for this isolated diagnostic is now present. Two user-authorized read-only Supabase MCP generations produced byte-identical transport output at `tmp/audit-evidence/baseline-reconcile-remote-types.ts`: mode `0600`, ignored/untracked, strict UTF-8, 113159 bytes, 3697 LF/lines, and SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`. The payload parsed with zero diagnostics and passed the committed secret scan; no tracked or provider state was mutated. This is transport/identity evidence, not yet an application compatibility result because the compiler diagnostic has not been run.

The repository uses `tsconfig.json` with strict mode, `noEmit`, bundler resolution, and roots covering all `**/*.ts`, `**/*.tsx`, `next-env.d.ts`, and `.next` route declarations. `next-env.d.ts` imports `.next/dev/types/routes.d.ts`; those build-generated declarations must not become compatibility inputs. TypeScript 6.0.3 is pinned by the existing lockfile, and `package.json` already has named Node test scripts but no captured-type diagnostic surface.

The diagnostic can remain in memory: parse the tsconfig with the TypeScript API and construct baseline and candidate programs. Only canonical `lib/supabase/database.types.ts` may return tracked baseline or captured candidate text. Separately, only exact normalized `.next/types/routes.d.ts` and `.next/dev/types/routes.d.ts` return `fileExists:true`, `readFile:''`, and an empty in-memory `SourceFile` without disk reads. All other reads delegate, except that any request for another generated root blocks with `GENERATED_REQUEST`. No emit, compiler write, network/provider contact, worktree creation, or write to `.next`, `node_modules`, or tracked types is required.

### Affected Areas
- `tsconfig.json` — source of compiler options and the broad root set that must be narrowed for generated declarations.
- `next-env.d.ts` — excluded as an exact parsed root because it imports build-generated route types.
- `lib/supabase/database.types.ts` — only compiler-read path allowed to return tracked baseline or captured candidate text; never written.
- `tmp/audit-evidence/baseline-reconcile-remote-types.ts` — required ignored captured candidate, identity-bound by the supplied SHA-256, excluded from parsed roots, and used only as the canonical database-types override.
- `package.json` — future implementation adds exactly `"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`; no package change belongs in exploration.
- `openspec/specs/baseline-reconciliation/spec.md` — preserves tracked types and forbids type regeneration, risky actions, and false readiness claims.
- `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md` — establish the blocked parent and prohibit `0061+`.

### Approaches
1. **One-off temporary helper** — a non-tracked Node/TypeScript API script that reads the snapshot and emits one JSON diagnostic.
   - Pros: smallest diff and no package-surface decision.
   - Cons: no repeatable contract, weak regression coverage, and easy accidental inclusion of the snapshot, `next-env.d.ts`, or `.next` generated roots.
   - Effort: Low

2. **Tracked reusable script plus external-free tests (recommended)** — add a narrow script module/CLI and `node:test` suite; keep the implementation in-memory after reading the fixed inputs and emit closed JSON on stdout.
   - Pros: strict TDD can pin host overrides, generated-root handling, baseline-zero gating, diagnostic classification, hash identity, and no-write behavior.
   - Cons: adds a small tracked surface and the exact package script.
   - Effort: Medium

### Recommendation
Use the reusable `scripts/captured-type-tsc.mjs` plus `tests/captured-type-tsc.test.mjs`, but do not implement them in this exploration. The runtime CLI accepts no snapshot argument and uses only the contract-fixed snapshot path and expected SHA-256. The package script is exactly `"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`. Tests use `node:test`/`node:assert/strict` and injected text/host seams rather than running a compiler command. Stdout is exactly one compact exact-order JSON object for every semantic result; result serialization or stdout transport failure itself is outside the semantic JSON contract and exits nonzero.

The implementation should:

1. Parse `tsconfig.json` with `readConfigFile`/`parseJsonConfigFileContent`, then, before tracked-root enforcement, exclude `node_modules/**`, exact `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, exact `next-env.d.ts`, and every `.next/types/**` plus `.next/dev/types/**` root. The snapshot is never a root. Every remaining parsed root must be tracked in `HEAD`; an arbitrary ignored TS/TSX included by `tsconfig.json` therefore blocks, while ignored dependency/generated files outside parsed roots do not participate. Independently, any nonignored untracked TS/TSX reported by the exact `ls-files` call blocks.
2. Create a baseline program using the tracked database-types text and a candidate program using the captured text. Only canonical `lib/supabase/database.types.ts` may return baseline/candidate text through `readFile` and an in-memory `SourceFile` through `getSourceFile`, with `fileExists:true`. As a distinct exception, only exact normalized `.next/types/routes.d.ts` and `.next/dev/types/routes.d.ts` return `fileExists:true`, `readFile:''`, and an empty in-memory `SourceFile`, without disk reads. All other reads delegate, except that any request for another generated root blocks with `GENERATED_REQUEST`. Generated diagnostics are never ignored. Disable emit and never call `writeFile`.
3. Require baseline pre-emit/options/global diagnostics to be exactly zero before interpreting the candidate. Baseline and candidate diagnostics are closed records containing exactly `{code,path,line,character,messageHash}` in that order, with safe repository-relative paths, one-based positions when available, and a lowercase SHA-256 of the flattened diagnostic message. Do not serialize message text, absolute paths, snapshots, or native error text, and do not ignore generated diagnostics. A zero result makes no claim of remote alignment.
4. Bind the candidate to the exact expected snapshot path and hash, and report a semantic `BLOCKED` JSON result if the snapshot is absent, hash-mismatched, baseline diagnostics are nonzero, host/root filtering is incomplete, the tracked-source preimage guard fails, or any other unsafe semantic condition occurs. Result serialization or stdout transport failure itself is outside semantic JSON and exits nonzero. `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT` is permissible only after an actual run returns baseline-zero and no candidate compatibility diagnostics.

The exact tracked TS/TSX source preimage guard does not require a separately supplied 283-file artifact. Every Git call executes `git` with `cwd` bound to canonical `repoRoot`, `shell:false`, and exactly one of these argv arrays:

```text
['rev-parse','--verify','HEAD^{commit}']
['ls-tree','-r','-z','--full-tree','HEAD','--',':(glob)**/*.ts',':(glob)**/*.tsx']
['diff','--no-ext-diff','--no-textconv','--quiet','HEAD','--',':(glob)**/*.ts',':(glob)**/*.tsx']
['ls-files','--others','--exclude-standard','-z','--',':(glob)**/*.ts',':(glob)**/*.tsx']
['cat-file','--batch']
```

The `cat-file` call receives only validated `ls-tree` OIDs as newline-delimited bounded stdin. Bind the run to the exact current Git `HEAD`, enumerate the tracked TS/TSX path set from that HEAD, and compare exact raw HEAD blobs with working bytes before and after diagnostics. Any nonignored untracked TS/TSX reported by `ls-files` blocks. Ignored files are governed only when they are parsed roots: after the exact exclusions in step 1, every remaining parsed root must be tracked in `HEAD`. Any changed, missing, added, or path-set mismatch blocks. The output includes the manifest hash and file count rather than every blob hash, while implementation/tests prove that the manifest is derived from HEAD blobs and that working bytes match them. This is stronger and more reproducible than trusting a manifest generated only from the current worktree, while avoiding a new tracked artifact or source change.

Expected schema is the literal `actravel.captured-type-tsc-result/v1`, with exactly seven ordered top-level keys `{schema,snapshot,sourcePreimage,baselineDiagnostics,candidateDiagnostics,blocker,status}`. `snapshot` is exactly `{path,expectedSha256,observedSha256,bytes}`: `path` is fixed to `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, `expectedSha256` is fixed to `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`, and `observedSha256:null` plus `bytes:0` remain until successful validation. `sourcePreimage` is exactly `{head,manifestSha256,fileCount,tsconfigSha256,typescriptVersion,compilerApiSha256}`; its string fields are `null` and `fileCount` is `0` before their validations succeed. Each diagnostic contains exactly `{code,path,line,character,messageHash}` in that order; hashes are lowercase 64-hex, paths are canonical relative paths, arrays are deterministic, and status is one of the two requested result tokens. `blocker` remains top-level only. No diagnostic includes source text or dynamic filesystem/provider state.

The implementation directly imports committed `canonicalJson` and `sha256Hex` from `./recovery-harness-lib.mjs` and defines no replacement canonical/hash helpers. Every hash uses `sha256Hex`; `canonicalJson` is used for structured hash preimages, not result serialization. The manifest hash preimage is the exact path-sorted array `{path,oid,bytesSha256}`, hashed as `sha256Hex(canonicalJson(records))`. `tsconfigSha256` hashes raw `tsconfig.json` bytes, and `compilerApiSha256` hashes raw `node_modules/typescript/lib/typescript.js` bytes.

Strict TDD order: export/CLI schema and forbidden I/O tests; snapshot hash/path and exact root filtering; baseline-zero failure; host override isolation; candidate diagnostic classification and deterministic ordering; source preimage mutation detection; no emit/write/network/process assertions; then the clean compatibility case with a fixture snapshot. Forecast: roughly 180–240 authored lines for the script and 220–300 for tests, plus exactly one package-script line, `"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`. Keep the two code files below a 600-line review cap and do not add a dependency or lockfile change.

Rollback is a complete revert of only the script, its tests, and the exact package-script line; it must preserve the captured ignored artifact, tracked types, the pre-existing dirty image, and the blocked parent change. This slice cannot establish remote provenance, schema alignment, build compatibility, recovery readiness, or permission to create `0061+`.

### Risks
- The captured snapshot is now available and identity-bound; the remaining gate is the future run’s exact HEAD/blob-versus-worktree preimage check.
- `parseJsonConfigFileContent` can reintroduce generated roots through imports unless the exact root exclusions, two-path route virtualization, and `GENERATED_REQUEST` handling are explicit.
- A baseline failure, path leakage, or non-deterministic diagnostic ordering could turn a compatibility probe into a misleading readiness claim.
- A current-worktree hash list must not be mistaken for a trusted preimage; compare it to exact HEAD blobs before and after both programs, and fail closed on any tracked TS/TSX diff.

### Ready for Proposal
Yes — the captured snapshot, identity, encoding, size, mode, parse, and secret-scan prerequisites are complete, and no authoritative pre-supplied source manifest is needed. Authorize only the bounded tracked script/tests slice with the exact HEAD/blob preimage guard described above. The parent remains `BLOCKED`; no compiler run or compatibility claim has been made. Implementation must still produce either the safe compatibility token or `BLOCKED` from its closed JSON result.
