## Exploration: week-01-recovery-harness

### Purpose

Normalize this change to one utility/guard micro-slice. The change establishes deterministic, dependency-free inputs for later recovery work. It does not execute recovery and does not prove recovery readiness or Week 01 closure.

### Executable Reality

- Node 22 and `node:test` are already available.
- The repository has no authoritative implementation of the utility/guard contract yet.
- The current planning artifacts disagree on export names, result unions, config keys, port order, hash representation, error codes, sanitizer schemas, and guard behavior.
- Those disagreements are resolved by the closed contract in `specs/recovery-harness/spec.md`; the other artifacts summarize that contract without adding variants.

### Exact Scope

Only these implementation paths belong to the change:

- `scripts/recovery-harness-lib.mjs`
- `tests/recovery-harness.test.mjs`
- `package.json`, limited to exactly `"test:recovery-harness": "node --test tests/recovery-harness.test.mjs"`

The library surface is exactly:

- `REQUIRED_PORTS`
- `renderTemporarySupabaseConfig({projectId, ports = REQUIRED_PORTS})`
- `parseTemporarySupabaseConfig(text)`
- `createConfigArtifact(input)`
- `canonicalJson(value)`
- `sha256Hex(input)`
- `sanitizeArgv(argv, options)`
- `sanitizeEnv(env, options)`
- `sanitizeText(text, options)`
- `scanSecrets(input)`
- `assertRuntimeToken(token)`
- `assertLocalUrl(url, options)`
- `assertAllowedFlags(argv)`
- `assertContainedPath({repoRealPath, candidateRealPath})`
- `validateWorktreeEntries(entries, {allowedPaths, protectedPaths})`

Every invalid call throws `RecoveryHarnessError`; there is no success/error result union. Every error has `message === code`. Its `details` keys and the `field`, `reason`, and `findingCode` value enums are closed; optional paths are sanitized POSIX paths and optional indexes are nonnegative integers. A valid scanner call that detects a candidate returns `{ok:false,findings}` rather than throwing.

### Selected Approach

Use one dependency-free Node ESM pure-function library and one deterministic `node:test` file. The implementation uses only Node built-ins and performs no process, filesystem, clock, socket, network, database, Docker, Supabase, Postgres, provider, migration, application, type-generation, lockfile, image, cleanup, receipt, manifest, SQL, or recovery-lifecycle work.

The temporary config renderer emits one exact LF/final-LF TOML template. The narrow parser accepts only the documented presentation variations and exact project/port domain. Canonical JSON accepts a deliberately smaller domain than JavaScript or general JSON. Sanitization returns copies plus safe redaction metadata. A sensitive split/inline argv value is replaced once as a whole by `<redacted:FLAG_VALUE>`, before content detection, and a non-allowed sensitive env value is replaced once as a whole by `<redacted:ENV_VALUE>`. In other argv/text contexts, and in env values that reach shared detection, an exact-scheme maximal non-whitespace/control URL candidate is parsed with the WHATWG URL parser and, only when parsed username or password is nonempty, replaced once as a whole by `<redacted:URL_CREDENTIAL>`. The PEM detector accepts only the four specified same-label, line-bounded private-key blocks with LF/CRLF and at least one base64 body line. Scanning accepts all exact placeholders, including the three above, while returning findings for unredacted candidates. Sanitizer success requires a clean post-scan; an internal breach may use `ERR_SANITIZE_INPUT` with safe fixed `field`/`reason` details but adds no fault-injection-only public branch. Guards validate already-supplied values without I/O and make no filesystem or symlink claims.

### Rejected Alternatives

1. Broad recovery runner or lifecycle planning is rejected for this change because process execution, receipts, invariants, cleanup, manifests, SQL, and integration belong to follow-up slices.
2. A permissive TOML or canonicalization dependency is rejected because it would enlarge the runtime and lockfile surface while weakening the closed grammar.
3. Result unions are rejected because the authoritative failure model requires `RecoveryHarnessError` exceptions with one closed code enum and secret-safe details.
4. Config aliases, alternate export names, configurable sensitive-flag defaults, and broad hostname normalization are rejected because they create conflicting contracts or unsafe ambiguity.

### Boundary Risks

- Parser permissiveness can make rendered identity ambiguous. Mitigation: one exact render template and a closed parser grammar with deterministic error precedence.
- JavaScript reflection can execute accessors or proxy traps. Mitigation: reject accessors and convert inspection failures to `ERR_CANONICAL_TYPE` without including inspected values.
- Redaction metadata can itself leak secrets. Mitigation: returned redactions contain only fixed codes and an argv index, env name, or UTF-16 text index; error details use only closed labels and positions. Sanitizer success is withheld unless post-scan is clean, and any internal `ERR_SANITIZE_INPUT` invariant diagnostic uses only a fixed field and reason, never a secret, env name, env value, or matched text.
- URL parsers normalize alternate numeric loopback forms. Mitigation: validate the raw authority and permit only literal `localhost`, `127.0.0.1`, or `[::1]`.
- Path containment can be mistaken for a symlink guarantee. Mitigation: require already-realpath canonical POSIX inputs and explicitly make no I/O or symlink claim.
- A passing core suite can be mistaken for recovery evidence. Mitigation: baseline reconciliation states that core PASS does not satisfy recovery readiness or Week 01 closure.

### Stacked Review Boundaries

Line caps count only physical authored lines introduced against the immediate predecessor stack commit: P1 against current `main`, P2 against the P1 tip, P3 against the P2 tip, Code A against the P3 tip, and Code B against the Code A tip. Predecessor content is never charged again, and planning artifacts are not charged to Code A or Code B.

- Planning P1, with its pre-normalization incremental size measured at 152 physical lines and capped at 300: allow only `exploration.md` and `proposal.md`. Its planning-document consistency checks pass. Rollback reverts the complete P1 commit.
- Planning P2, with its pre-normalization incremental size measured at 526 physical lines and capped at 650: allow only `specs/recovery-harness/spec.md` and `specs/baseline-reconciliation/spec.md`. Its specification validation against P1 passes. Rollback reverts the complete P2 commit.
- Planning P3, with the incremental `design.md` size measured at 151 physical lines before this correction and `tasks.md` not yet authored, is capped at 400: allow only `design.md` and the future `tasks.md`. Full planning validation and requirement-to-task traceability pass. Rollback reverts the complete P3 commit.
- Code A, capped at 750: allow only `scripts/recovery-harness-lib.mjs` and `tests/recovery-harness.test.mjs`, limited to config/artifact, canonical JSON/SHA, guards, and focused tests. The then-present subset passes with `node --test tests/recovery-harness.test.mjs`. Rollback reverts the complete Code A commit.
- Code B, capped at 500 incremental physical lines introduced only by Code B: allow only `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`, and `package.json`, limited to sanitizer/scanner hunks, remaining tests, and the exact package script. The complete suite passes directly and through `npm run test:recovery-harness`. Rollback reverts the complete Code B commit, preserving the Code A parent state.

Every boundary is independently reviewable and rollback-safe. Every executable subset is deterministic and external-system-free, and no boundary exceeds 800 authored physical lines.

### Conclusion

The authoritative direction is the utility/guard micro-slice only. Follow-up changes own all execution, recovery lifecycle, evidence, database, provider, and integration concerns.
