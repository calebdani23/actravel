# Proposal: Week 01 Recovery Harness Utility/Guard Micro-Slice

## Intent

Establish one closed, reusable utility/guard contract for later recovery-harness slices. This change is deterministic, provider-free, and limited to pure library behavior. Completion does not prove recovery readiness or Week 01 closure.

## Scope

### In Scope

- `scripts/recovery-harness-lib.mjs` with exactly the exports specified in `specs/recovery-harness/spec.md`.
- Exact temporary Supabase config rendering, narrow parsing, artifact bytes, and artifact SHA-256.
- Closed canonical JSON and SHA-256 helpers.
- Non-mutating argv, env, and text sanitization plus secret scanning.
- Pure runtime-token, local-URL, denied-flag, contained-path, and worktree guards.
- Deterministic external-system-free tests in `tests/recovery-harness.test.mjs`.
- Exactly `"test:recovery-harness": "node --test tests/recovery-harness.test.mjs"` in `package.json`.

### Out of Scope

- Process execution, command adapters, receipts, invariant categories, cleanup, manifests, SQL, runners, or A/B lifecycle.
- Docker, Supabase, Postgres, sockets, network, filesystem operations, or provider access.
- `recovery:local`, migrations, application code, generated types, dependencies, lockfile, or image changes.
- Recovery evidence, recovery-readiness claims, or Week 01 closure claims.

## Authoritative Contract

`specs/recovery-harness/spec.md` is the normative API and failure contract. It defines:

- the exact export list and success schemas;
- `RecoveryHarnessError`, exact `message === code`, its closed code enum, and closed secret-safe detail keys/value enums;
- exact `REQUIRED_PORTS`, TOML bytes, parser grammar, and `ConfigArtifact`;
- the accepted canonical JSON/SHA domains;
- sanitizer options, contextual whole-value precedence, placeholders, redaction metadata, exact detector grammars, and scan findings;
- literal-loopback, token, flag, path, and worktree guards.

`specs/baseline-reconciliation/spec.md` is the normative test and interpretation delta. No other artifact introduces aliases, broader domains, alternate return types, or lifecycle behavior.

## Approach

Implement a dependency-free Node 22 ESM library using built-ins only. All invalid calls throw the same internal `RecoveryHarnessError` shape with `message === code` and closed safe details; functions return direct values, except `scanSecrets`, whose `{ok, findings}` object is a domain scan result rather than an error union. Sensitive flag and env values receive exactly one outer-context whole-value redaction, even when they contain URL credentials. In all remaining shared-detection contexts, a credential-bearing URL candidate is replaced in full after exact-scheme tokenization and successful WHATWG parsing, and a private-key block is detected only by the exact line-bounded same-label grammar. The scanner accepts exact placeholders and returns `{ok:false,findings}` for unredacted candidates. Sanitizers return success only after a clean post-scan; an internal invariant breach may throw `ERR_SANITIZE_INPUT` with safe fixed `field`/`reason` details but requires no public fault-injection branch. The parser, canonicalizer, sanitizers, scanner, and guards fail closed and do not mutate input.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/recovery-harness-lib.mjs` | New/modified | The exact utility/guard exports only. |
| `tests/recovery-harness.test.mjs` | New/modified | Deterministic branch coverage with no external systems. |
| `package.json` | Modified | Add only the exact `test:recovery-harness` script. |

## Stacked Delivery Boundaries

Each cap counts physical authored lines introduced only against the immediate predecessor stack commit: P1 against current `main`, P2 against the P1 tip, P3 against the P2 tip, Code A against the P3 tip, and Code B against the Code A tip. Earlier content is not counted again, and planning artifacts are excluded from both code caps.

| Boundary | Exact allowlist and cap | Passing subset | Exact rollback |
|---|---|---|---|
| Planning P1 | `exploration.md`, `proposal.md`; pre-normalization incremental size 152 lines, cap 300 | P1 planning consistency checks | Revert the complete P1 commit. |
| Planning P2 | `specs/recovery-harness/spec.md`, `specs/baseline-reconciliation/spec.md`; pre-normalization incremental size 526 lines, cap 650 | Specification validation against P1 | Revert the complete P2 commit. |
| Planning P3 | `design.md`, future `tasks.md`; pre-normalization incremental design size 151 lines, tasks not yet authored, cap 400 | Full planning validation and requirement-to-task traceability | Revert the complete P3 commit. |
| Code A | `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`; cap 750 | Config/artifact, canonical JSON/SHA, and guard subset via `node --test tests/recovery-harness.test.mjs` | Revert the complete Code A commit. |
| Code B | `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`, `package.json`; cap 500 counting only Code B incremental hunks | Complete sanitizer/scanner and remaining suite directly and via `npm run test:recovery-harness` | Revert the complete Code B commit, preserving the Code A parent state. |

Every boundary is independently reviewable and rollback-safe, and no boundary exceeds 800 authored physical lines.

## Risks

| Risk | Mitigation |
|---|---|
| Ambiguous config or error classification | Closed grammar, fixed validation precedence, and exact-code tests. |
| Secret leakage through diagnostics | `message === code`; closed detail enums; sanitized POSIX paths; numeric positions; internal sanitizer invariant diagnostics use only fixed safe fields/reasons. |
| JavaScript type ambiguity | Narrow accepted domains and fail-closed reflection. |
| Unsafe URL/path normalization | Raw literal-host checks and already-realpath canonical POSIX path inputs. |
| Core PASS overstated as recovery evidence | Explicit baseline delta denying readiness and Week 01 closure. |

## Rollback

Use the exact complete-commit rollback for each boundary above. Across the complete stack this is limited to `exploration.md`, `proposal.md`, both specs, `design.md`, future `tasks.md` if authored, `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`, and the exact `test:recovery-harness` package-script entry. No process, database, Docker, network, provider, migration, application, dependency, lockfile, image, or production state is touched.

## Success Criteria

- [ ] The module exposes exactly the authoritative export list with no aliases.
- [ ] Every rejection uses the closed `RecoveryHarnessError` contract, has `message === code`, and contains only legal safe details.
- [ ] Sensitive flag/env values receive exactly one whole-value outer-context redaction; all other credential-bearing URL candidates receive exactly one full-candidate `<redacted:URL_CREDENTIAL>` redaction.
- [ ] URL and PEM detection follow the exact boundary, parse, label, body, and negative grammars, while the scanner accepts placeholders and reports unredacted candidates without throwing.
- [ ] Every documented accepted and rejected branch has a deterministic `node:test` case.
- [ ] The suite uses no process or external system.
- [ ] The package change is exactly the one named script and no dependency or lockfile change.
- [ ] PASS is reported only as utility/guard coverage, never recovery readiness or Week 01 closure.
