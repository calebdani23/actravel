# Captured-Type TypeScript Compatibility Specification

## Requirements

### Requirement: Preserve the three-file boundary

The change MUST modify only `scripts/captured-type-tsc.mjs`,
`tests/captured-type-tsc.test.mjs`, and this exact `package.json` script:
`"test:captured-type-tsc": "node --test tests/captured-type-tsc.test.mjs"`.
No dependency, lockfile, generated artifact, tracked type, or other script MAY change.

#### Scenario: Scope is inspected
- GIVEN the final diff
- WHEN paths are checked
- THEN only permitted files/script exist; lockfile/types are unchanged

### Requirement: Bind exact snapshot and source identities

The diagnostic MUST require path
`tmp/audit-evidence/baseline-reconcile-remote-types.ts` and SHA-256
`b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`.
The runtime CLI MUST accept no snapshot argument and MUST use that contract-fixed
snapshot.
It MUST derive tracked `*.ts`/`*.tsx` paths and blob hashes from `HEAD`, validate
every HEAD blob with `git cat-file --batch`, and compare each blob's exact
working-file bytes before and after diagnostics, independent of index flags.
Any nonignored untracked TS/TSX reported by the exact `ls-files` operation MUST
block. Ignored-file enforcement MUST use parsed compiler roots: after excluding
`node_modules/**`, exact `next-env.d.ts`, `.next/types/**`,
`.next/dev/types/**`, and the exact snapshot, every remaining parsed root MUST
be tracked in `HEAD`. Thus arbitrary ignored TS/TSX included by `tsconfig.json`
MUST block, while ignored dependency/generated files outside parsed roots MUST
NOT participate. Missing, added, changed, or path-set mismatch MUST fail.

#### Scenario: Identity changes
- GIVEN snapshot, HEAD manifest, or worktree preimage differs
- WHEN the diagnostic runs
- THEN status is `BLOCKED` with no compatibility claim

### Requirement: Restrict Git and compiler inputs

Production MUST use one read-only Git provider that executes `git` with
`cwd` bound to canonical `repoRoot`, `shell:false`, and only these exact argv
arrays:

```text
['rev-parse','--verify','HEAD^{commit}']
['ls-tree','-r','-z','--full-tree','HEAD']
['diff','--no-ext-diff','--no-textconv','--name-only','-z','HEAD']
['ls-files','--others','--exclude-standard','-z']
['cat-file','--batch']
```

`createGitProvider` MUST bind a canonical `repoRoot` and an injected executor.
The host-compatible full-tree enumeration MUST filter canonical regular `.ts`/`.tsx`
paths in JavaScript before applying the same bounds; `diff` and `ls-files` MUST
similarly filter their NUL-delimited enumerations while retaining the required
`--no-ext-diff` and `--no-textconv` flags. The `cat-file` call MUST receive only validated `ls-tree` OIDs as
newline-delimited bounded stdin and MUST use an 80 MiB maximum buffer. Tracked Git
blobs MUST be bounded to at most 1024 `*.ts`/`*.tsx` files, at most 2 MiB per
blob, and at most 64 MiB in aggregate. Tests MUST inject a fake provider and
spawn nothing.
Path guards MUST require canonical repository-relative paths and reject absolute,
traversal, or non-normalized paths.

#### Scenario: Hostile input
- GIVEN an unallowlisted command, shell, unsafe path, or provider error
- WHEN encountered
- THEN execution stops `BLOCKED` with no compiler, network, or write

### Requirement: Isolate TypeScript configuration and database replacement

The diagnostic MUST parse `tsconfig.json` in memory and, before tracked-root
enforcement, exclude `node_modules/**`, exact
`tmp/audit-evidence/baseline-reconcile-remote-types.ts`, exact `next-env.d.ts`,
and `.next/types/**` plus `.next/dev/types/**`. The snapshot MUST never be a root
and MUST be used only as the canonical database-types override. Every remaining
parsed root MUST be tracked in `HEAD` under the ignored-file semantics above.

Database replacement and route virtualization MUST be distinct host exceptions.
Only canonical `lib/supabase/database.types.ts` MAY return tracked baseline or
captured candidate text. Only exact normalized `.next/types/routes.d.ts` and
`.next/dev/types/routes.d.ts` MAY return `fileExists:true`, `readFile:''`, and an
empty in-memory `SourceFile`, without disk reads. All other reads MUST delegate,
except that any request for another generated root MUST block with
`GENERATED_REQUEST`. Generated diagnostics MUST NOT be ignored.

#### Scenario: Generated or unrelated reads
- GIVEN roots include generated declarations or a route is requested
- WHEN a program is constructed
- THEN authorized generated inputs are excluded/virtualized, any other generated-root request blocks with `GENERATED_REQUEST`, generated diagnostics are retained, and unrelated reads delegate

### Requirement: Gate diagnostics without writes

Baseline options, global, and pre-emit diagnostics MUST be zero first. Programs
MUST use `noEmit`; neither MAY emit or
call `writeFile`. Diagnostics MUST contain exactly
`{code,path,line,character,messageHash}`, canonical relative paths, one-based
positions when available, lowercase SHA-256 flattened-message hashes, and no
text or absolute paths.

#### Scenario: Diagnostics exist
- GIVEN baseline or candidate diagnostics exist
- WHEN classified
- THEN status is `BLOCKED` without alignment/readiness claim

### Requirement: Publish one closed result

Stdout MUST contain one compact JSON object with schema literal
`actravel.captured-type-tsc-result/v1` and exactly these seven ordered top-level
keys: `{schema,snapshot,sourcePreimage,baselineDiagnostics,candidateDiagnostics,blocker,status}`.
`snapshot` MUST contain exactly `{path,expectedSha256,observedSha256,bytes}` in
that order. `path` MUST be
`tmp/audit-evidence/baseline-reconcile-remote-types.ts`, `expectedSha256` MUST be
`b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`, and
`observedSha256:null` plus `bytes:0` MUST remain until successful snapshot
validation. `sourcePreimage` MUST contain exactly
`{head,manifestSha256,fileCount,tsconfigSha256,typescriptVersion,compilerApiSha256}`
in that order; string values MUST be `null` and `fileCount` MUST be `0` before
their validations succeed. Diagnostics MUST contain exactly
`{code,path,line,character,messageHash}` in that order. `blocker` MUST exist only
at the top level; no nested-blocker alternative is valid. Result JSON MUST be
built entirely from validated primitives before writing.

The implementation MUST import the committed `canonicalJson` and `sha256Hex`
from `./recovery-harness-lib.mjs` and MUST define no substitute canonical/hash
helper. Every hash MUST use `sha256Hex`; `canonicalJson` MUST be used for
structured hash preimages, not result serialization. The manifest hash preimage MUST be the exact array of
`{path,oid,bytesSha256}` records sorted by path, and `manifestSha256` MUST equal
`sha256Hex(canonicalJson(records))`. `tsconfigSha256` MUST hash the raw
`tsconfig.json` bytes. `compilerApiSha256` MUST hash the raw
`node_modules/typescript/lib/typescript.js` bytes.
Hashes MUST be lowercase 64-hex, arrays deterministic, and `status` MUST be
`TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT` or `BLOCKED`. Every unsafe semantic
condition MUST produce a `BLOCKED` JSON result. Result serialization or stdout
transport failure itself is outside semantic JSON, MUST exit nonzero, and MUST
NOT invent a semantic JSON result.

### Requirement: Report exact blocker causes

`blocker` MUST be one of `SNAPSHOT_IDENTITY`, `GIT_BOUNDARY`,
`CONFIG_ROOT`, `GENERATED_REQUEST`, `BASELINE_DIAGNOSTIC`,
`CANDIDATE_DIAGNOSTIC`, `PREIMAGE_CHANGED`, `COMPILER_FAILURE`,
or `null`. Mapping MUST be: snapshot path/hash/bytes →
`SNAPSHOT_IDENTITY`; command, shell, path, provider, or index-independent Git
failure → `GIT_BOUNDARY`; root filtering → `CONFIG_ROOT`; any generated-root
request other than the two exact virtualized route declarations →
`GENERATED_REQUEST`; baseline/candidate diagnostics, including generated
diagnostics, → matching values;
before/after bytes or paths → `PREIMAGE_CHANGED`; compiler exception or
compiler/input I/O → `COMPILER_FAILURE`. Other unsafe semantic failures MUST
produce the applicable `BLOCKED` JSON result; result serialization and stdout
transport failures are handled outside semantic JSON as specified above.
`blocker` MUST be `null` only when compatible.

#### Scenario: Blocker mapping
- GIVEN one failure cause is encountered
- WHEN the result is produced
- THEN status is `BLOCKED` with the exact mapped enum
- AND compatible has blocker `null`

#### Scenario: Compatibility run
- GIVEN identities, guards, filtering, baseline-zero, and post-run checks pass
- WHEN candidate diagnostics are empty
- THEN the closed JSON result has the compatibility status

### Requirement: Keep tests strict and bounded

Tests MUST use strict TDD with fake Git and virtual compiler hosts, assert no
process/network/write/emit, and cover hostile inputs, virtualization,
identity, deterministic diagnostics, and both statuses. The two code files MUST
target at most 600 authored lines and MUST NOT exceed 650. No build, lint,
runtime, contract, fresh-provenance, recovery, alignment, or closure test MAY be
added.

#### Scenario: Budget
- GIVEN the test suite and authored-line count are reviewed
- WHEN tests execute in-process
- THEN no external boundary is touched and the 650-line ceiling is met
