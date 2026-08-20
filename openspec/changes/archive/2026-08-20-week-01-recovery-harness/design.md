# Design: Recovery Harness Utility/Guard Micro-Slice

## Design Boundary

Implement one dependency-free Node 22 ESM pure-function library, one `node:test` file, and one exact package script. `specs/recovery-harness/spec.md` is the authoritative API/failure contract and `specs/baseline-reconciliation/spec.md` is the authoritative test/interpretation delta. This design introduces no alternate names, types, error model, or domain.

No process, filesystem, clock, signal, socket, network, Docker, Supabase, Postgres, provider, SQL, runner, receipt, invariant category, cleanup, manifest, A/B lifecycle, `recovery:local`, migration, application, generated-type, dependency, lockfile, or image behavior belongs here.

## Architecture Decisions

| Choice | Rejected alternative | Reason |
|---|---|---|
| Direct returns plus `RecoveryHarnessError` throws | ok/error result unions | One closed failure model with testable safe diagnostics. |
| Hand-written closed TOML subset | permissive TOML parser | Exact identity bytes and no dependency/lockfile change. |
| Node `crypto` and UTF-8 primitives | third-party canonical/hash package | Existing runtime is sufficient and deterministic. |
| Reflection-limited canonicalization | generic `JSON.stringify` over arbitrary objects | Reject accessors, exotic shapes, unsafe numbers, and cycles deliberately. |
| Collect spans, replace without mutation, then post-scan | in-place or log-time masking | Stable source indexes, safe metadata, and no caller mutation. |
| Raw-authority loopback validation | trust URL hostname normalization | Reject alternate numeric and encoded host forms. |
| Already-realpath POSIX containment contract | filesystem/symlink claims | Keeps the guard pure and its guarantee precise. |
| Exact worktree allow/protect equality | prefix/path-normalizing policy | Prevent traversal and overbroad allowlisting. |

## Module Contract

The module exports exactly:

```js
REQUIRED_PORTS
renderTemporarySupabaseConfig({projectId, ports = REQUIRED_PORTS})
parseTemporarySupabaseConfig(text)
createConfigArtifact(input)
canonicalJson(value)
sha256Hex(input)
sanitizeArgv(argv, options)
sanitizeEnv(env, options)
sanitizeText(text, options)
scanSecrets(input)
assertRuntimeToken(token)
assertLocalUrl(url, options)
assertAllowedFlags(argv)
assertContainedPath({repoRealPath, candidateRealPath})
validateWorktreeEntries(entries, {allowedPaths, protectedPaths})
```

`RecoveryHarnessError` is the internal class used for every rejection; it is not an additional named export. Successful helpers return their direct documented value. Assertions return `true`. `scanSecrets` returns its domain `{ok, findings}` object. No helper returns an error union.

Errors use only the closed codes:

```text
ERR_CONFIG_PROJECT_ID, ERR_CONFIG_SYNTAX, ERR_CONFIG_DUPLICATE,
ERR_CONFIG_UNKNOWN, ERR_CONFIG_MISSING, ERR_CONFIG_PORT,
ERR_CANONICAL_TYPE, ERR_CANONICAL_CYCLE, ERR_HASH_INPUT,
ERR_SANITIZE_INPUT, ERR_SANITIZE_LIMIT,
ERR_TOKEN, ERR_URL, ERR_FLAG, ERR_PATH, ERR_WORKTREE
```

Every error has `message === code`. Error `details` keys are restricted to `field`, `reason`, `path`, `index`, and `findingCode`. `field` is one of `projectId|text|value|input|argv|env|url|path|entries|ports`; `reason` is one of `invalid|duplicate|unknown|missing|out_of_range|unsupported|cycle|sensitive|outside|protected|not_allowed`; and `findingCode` is one of `URL_CREDENTIAL|PEM_PRIVATE_KEY|JWT_LIKE|KNOWN_KEY_PREFIX|SENSITIVE_ENV`. An optional index is a nonnegative integer. An optional path is an already-sanitized canonical POSIX absolute path for containment or relative path for worktree diagnostics; raw invalid paths are omitted. No other detail key/value, actual secret, dynamic env name/value, URL text, or inspected input enters diagnostics.

## Configuration Design

`REQUIRED_PORTS` is a frozen flat object with exact keys and values:

```js
{
  api: 54321,
  db: 54322,
  dbShadow: 54320,
  dbPooler: 54329,
  studio: 54323,
  inbucket: 54324,
  inbucketSmtp: 54325,
  inbucketPop3: 54326,
  analytics: 54327,
}
```

The renderer accepts project IDs matching `[a-z0-9][a-z0-9-]{0,47}` and only exact-value port objects. It emits LF/final-LF bytes in this order: top-level `project_id`; `api.port`; `db.port`; `db.shadow_port`; `db.pooler.port`; `studio.port`; `inbucket.port`; `inbucket.smtp_port`; `inbucket.pop3_port`; `analytics.port`. Blank lines are exactly those shown in the specification template.

The parser is a line-state parser, not a general TOML parser. It strips only recognized comments outside the project-ID string, permits only U+0020 layout spaces, records semantic statements, and then applies deterministic validation precedence: syntax, duplicate, unknown, missing, order, project ID, port. It returns `{projectId, ports}` and never consults another config.

`createConfigArtifact` renders, UTF-8 encodes, parses for the same identity/ports, hashes the exact bytes, and returns exactly:

```js
{
  schema: 'actravel.recovery-config/v1',
  projectId,
  ports,
  bytes,
  sha256,
}
```

`bytes` is a fresh `Uint8Array`; `sha256` is raw 64-character lowercase hex with no prefix.

## Canonical JSON And SHA Design

Canonical traversal has an ancestor `WeakSet`, adding on entry and deleting on exit. This rejects cycles while allowing repeated acyclic references. Arrays require every index as an own data property and no extra/symbol keys. Objects require exactly `Object.prototype` or null, enumerable own string data properties, and no symbols/accessors. Reflective failures throw `ERR_CANONICAL_TYPE` with fixed labels only.

Object keys use JavaScript's default UTF-16 code-unit sort. Arrays preserve order. Safe integers are the only numbers; `-0` becomes `0`. Compact JSON has no newline.

`sha256Hex` accepts only primitive string or `Uint8Array`, hashes UTF-8 strings or the exact byte view, and returns raw lowercase 64-hex. The `sha256:` prefix belongs only to the runtime-token guard.

## Sanitization And Scanning Design

All sanitizers return `{value, redactions}` without mutation. A redaction is exactly `{code,indexOrName}` and a placeholder is exactly `<redacted:CODE>`.

Shared content detection uses the specification's exact four classes and grammars: `PEM_PRIVATE_KEY`, `URL_CREDENTIAL`, `JWT_LIKE`, and `KNOWN_KEY_PREFIX`. A URL candidate is a delimiter-bounded maximal non-whitespace/control substring beginning with an exact lowercase supported scheme. It becomes `URL_CREDENTIAL` only after successful WHATWG parsing with nonempty parsed username or password; replacement consumes the complete candidate. An invalid candidate is not a URL finding unless another detector independently matches. PEM matching is line-bounded and accepts only the four exact private-key labels, a matching END label, LF/CRLF separators, and one or more valid padded-base64 body lines; replacement consumes only the complete marker/body block. Matches are collected against the original source, overlap is resolved by fixed precedence, and replacements are applied from the end of the string so source indexes remain stable. Ordinary hex and exact lowercase `sha256:<64hex>` are not secret classes.

`sanitizeArgv` accepts only an empty options object. Its exact case-sensitive sensitive flags are `--token`, `--password`, `--db-url`, `--access-token`, and `--service-role-key`; split and equals values use one whole-value `FLAG_VALUE` redaction before shared detection, even when the value contains URL credentials. Other content receives shared detection. Numeric metadata is the argv index.

`sanitizeEnv` accepts only optional `{allowNames: []}`. Name sensitivity uses the specification's four exact database URL names and two case-insensitive boundary patterns. A non-allowed sensitive value receives one whole-value `ENV_VALUE` redaction before shared detection, even when it contains URL credentials. An exact case-sensitive allow name bypasses only this outer replacement, not shared content detection. Output is a fresh null-prototype object; returned redaction metadata may use env names. The postcondition scans properties in UTF-16-sorted name order, verifies all required whole-value replacements, and shared-scans all remaining values.

`sanitizeText` accepts only optional `{maxBytes}`, defaulting to 16384. It replaces the full string first, hashes the full sanitized UTF-8 bytes, and then retains the longest prefix fitting the byte bound at a code-point boundary. It returns exactly `{value,fullSha256,truncated,retainedBytes,redactions}` and adds no marker.

`scanSecrets` accepts a string or dense string array. It reports only `{code,index}` for the four shared classes. String indexes are UTF-16 match starts; array indexes are element indexes. Exact placeholders, including `<redacted:FLAG_VALUE>`, `<redacted:ENV_VALUE>`, and `<redacted:URL_CREDENTIAL>`, are clean. An unredacted exact-grammar candidate returns `{ok:false,findings}` rather than throwing. Sanitizers return success only after post-scan reports `ok:true`; text scans the complete sanitized pre-truncation value, and env also enforces its name-based `SENSITIVE_ENV` replacement postcondition. An internal invariant breach may use `ERR_SANITIZE_INPUT` with details exactly `{field,reason:"sensitive"}` and the affected fixed sanitizer field, but no fault-injection-only public branch is part of the contract.

## Guard Design

- Runtime token: primitive string exactly `sha256:[0-9a-f]{64}`.
- Local URL: explicit lowercase `http`, `https`, `postgres`, or `postgresql`; raw literal `localhost`, `127.0.0.1`, or `[::1]`; no fragment; credentials only with exact `{allowCredentials:true}`; no normalized alternate host forms.
- Flags: deny only exact `--linked`, `--project-ref`, `--remote`, `--include-linked`, plus each exact equals form; reject non-string args.
- Containment: exactly two canonical absolute already-realpath POSIX strings; candidate must be a strict descendant. The pure result makes no existence or symlink claim.
- Worktree: exact `{path,status,tracked}` entries; statuses `M,A,D,R,C,U,?,!`; tracked consistency; canonical POSIX relative paths; unique entries/lists; protected exact match always rejects; every entry must exactly match `allowedPaths`.

All guards return `true` on success and the one assigned closed error code on rejection.

## File Changes

| File | Contract |
|---|---|
| `scripts/recovery-harness-lib.mjs` | Exact exports and no side effects. |
| `tests/recovery-harness.test.mjs` | Deterministic accepted/rejected branch inventory only. |
| `package.json` | Add exactly `"test:recovery-harness": "node --test tests/recovery-harness.test.mjs"`. |

No other implementation path changes.

## Test Design

The exact deterministic case inventory is in `specs/baseline-reconciliation/spec.md`. Tests use direct values and `assert.throws`; they assert `message === code`, publicly reachable legal detail values and illegal-detail rejection, sanitizer `ok:true` postconditions, contextual redaction precedence, exact URL/PEM grammar and scanner results, complete local-URL guard branches, sanitizer option/limit failures, UTF-8 truncation, no secret-bearing diagnostics, source immutability, and fresh output containers. They do not require fault injection for an internal sanitizer invariant error. There are no mocks for external systems because no external boundary exists in this slice.

## Stacked Review Boundaries

Caps count physical authored lines only against the immediate predecessor stack commit: P1 against current `main`, P2 against the P1 tip, P3 against the P2 tip, Code A against the P3 tip, and Code B against the Code A tip. Predecessor content is not counted again, and planning artifacts are not counted in Code A or Code B.

| Boundary | Exact allowlist and cap | Passing subset | Exact rollback |
|---|---|---|---|
| Planning P1 | `exploration.md`, `proposal.md`; pre-normalization incremental size 152 lines against current `main`, cap 300 | P1 planning consistency checks | Revert the complete P1 commit. |
| Planning P2 | `specs/recovery-harness/spec.md`, `specs/baseline-reconciliation/spec.md`; pre-normalization incremental size 526 lines against the P1 tip, cap 650 | Specification validation against P1 | Revert the complete P2 commit. |
| Planning P3 | `design.md`, future `tasks.md`; pre-normalization incremental design size 151 lines against the P2 tip, tasks not yet authored, cap 400 | Full planning validation and requirement-to-task traceability | Revert the complete P3 commit. |
| Code A | `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`; cap 750 against the P3 tip | Config/artifact, canonical JSON/SHA, guards, and focused tests via `node --test tests/recovery-harness.test.mjs` | Revert the complete Code A commit. |
| Code B | `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs`, `package.json`; cap 500 counting only incremental Code B hunks against the Code A tip | Sanitizer/scanner and remaining tests directly and via `npm run test:recovery-harness` | Revert the complete Code B commit, preserving the Code A parent state. |

Every boundary is independently reviewable and rollback-safe; every executable subset is external-system-free. No boundary exceeds 800 authored physical lines. Code A adds no package script, and Code B adds no other script. Code B rollback reverts its complete commit and preserves Code A as the predecessor state.

## Rollback And Interpretation

Rollback reverts the complete boundary commits listed above; each commit touches only its exact allowlist. No runtime or external state exists to clean up.

A full core PASS verifies only this utility/guard contract. It does not satisfy recovery readiness and does not close Week 01; follow-up slices own every execution, evidence, lifecycle, database, and provider concern.
