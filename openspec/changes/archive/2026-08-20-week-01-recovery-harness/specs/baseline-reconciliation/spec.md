# Baseline Reconciliation Specification

## Requirements

### Requirement: External-system-free test boundary

`tests/recovery-harness.test.mjs` MUST use Node's built-in `node:test` and `node:assert/strict` only. It MUST import the library directly and perform no process execution, filesystem access, socket access, network access, clock dependence, Docker, Supabase, Postgres, SQL, provider access, or integration setup. Cases MUST be deterministic and MUST assert direct return values or thrown `RecoveryHarnessError` name/code/safe-details shape.

#### Scenario: Direct pure test execution

- GIVEN Node 22 built-ins and the then-present utility/guard exports
- WHEN `node --test tests/recovery-harness.test.mjs` runs
- THEN the suite completes without any process or external system

### Requirement: Deterministic branch inventory

The complete suite MUST enumerate these accepted and rejected branches, using table-driven subtests where cases share one contract:

#### Config and artifact cases

- exact export names and frozen exact `REQUIRED_PORTS`;
- exact renderer bytes, LF/final-LF, default ports, exact-value port clone, round trip, fresh artifact bytes/ports, schema, and byte hash;
- parser acceptance of documented U+0020 spaces, blank lines, and full-line/trailing comments;
- render rejection for invalid call shape, unknown/missing fields, invalid project-ID type/grammar, unknown/missing port keys, port type, unsafe integer, range, and wrong fixed value;
- parser syntax rejection for non-string input, CR/CRLF, missing final LF, tabs, malformed header/line, dotted/quoted key, escape, reordered statements, and trailing garbage;
- duplicate rejection for project ID, table, and fully qualified key;
- unknown rejection for table and assignment key;
- missing rejection for project ID, table, and assignment key;
- parser project-ID rejection for every grammar edge;
- parser port rejection for `+`, leading zero, negative, float, exponent, non-decimal text, range, and wrong fixed value;
- input immutability and error-detail allow-key/no-secret assertions.

#### Exact diagnostic cases

- every publicly reachable error code with exact `name: "RecoveryHarnessError"`, `message === code`, a plain `details` object, and no extra detail key;
- representative publicly reachable diagnostics for legal `field` and `reason` values, plus table tests proving the shared diagnostic assertion rejects an unknown detail key, an out-of-enum label, an unsanitized/wrong-form POSIX path, and a negative, fractional, or non-number index;
- absolute sanitized POSIX path details only for contained-path branches and relative sanitized POSIX path details only for worktree branches, with raw invalid paths omitted;
- every sanitizer's successful-output postcondition through `scanSecrets` with `ok:true`, including exact clean `FLAG_VALUE`, `ENV_VALUE`, and `URL_CREDENTIAL` placeholders;
- env postcondition ordering by lexicographically UTF-16-sorted property names, exact whole-value replacement for every non-allowed sensitive name, and shared scanning of every other returned value, without a fault-injection-only invariant-error case;
- serialization checks over thrown errors from secret-bearing inputs proving no token, credential URL, env value, private-key body, matched secret text, or inspected input value appears in `name`, `code`, `message`, or `details`.

#### Canonical JSON and SHA cases

- accepted null/boolean/string/safe integer/`-0`, nested dense arrays, ordinary and null-prototype objects, UTF-16 key order, array order, JSON escaping, no newline, and repeated acyclic references;
- type rejection for float, unsafe/nonfinite number, undefined, bigint, function, symbol, sparse/extra-property/accessor arrays, non-plain objects, non-enumerable/accessor/symbol-key objects, and throwing proxies;
- cycle rejection distinct from repeated acyclic references;
- equivalent string/byte SHA, Buffer byte-range handling, lowercase 64-hex output, byte immutability, and rejection of every other input class.

#### Sanitization and scanning cases

- argv split and equals forms for every exact sensitive flag, empty values, near-match preservation, missing split value, invalid/sparse/extra-property/non-string arrays, omitted/empty options, and non-object/array/exotic/accessor/symbol/unknown-key options, plus fresh output and source immutability;
- env exact names, both name patterns, case behavior, ordinary names, explicit exact allow names, content scanning after allow, invalid env shapes/values/accessors/symbols, omitted/empty options, non-object/array/exotic/accessor/symbol/unknown-key options, invalid/sparse/extra-property/non-string/duplicate allow names, fresh null-prototype output, source immutability, and sorted-name postcondition traversal;
- contextual precedence proving each sensitive split/inline argv value and each non-allowed sensitive env value receives exactly one whole-value `FLAG_VALUE` or `ENV_VALUE` redaction even when it contains URL credentials, while allowed/ordinary env and non-sensitive argv/text values still receive shared detection;
- credential URL replacement proving an exact lowercase supported scheme at a start/delimiter boundary, maximal non-whitespace/control candidate consumption, WHATWG parsing, nonempty parsed username/password, and disappearance of the entire candidate into exactly `<redacted:URL_CREDENTIAL>` with one redaction; scanner `{ok:false,findings}` for the unredacted candidate and acceptance of all three contextual/URL placeholders; multiple whitespace/control-delimited URLs; and negatives for empty userinfo, `@` only in path/query/fragment, relative or host-only text, unsupported/uppercase scheme, leading non-delimiter adjacency, malformed/invalid WHATWG candidates, and trailing punctuation as part of the candidate;
- every exact PEM label (`PRIVATE KEY`, `RSA PRIVATE KEY`, `EC PRIVATE KEY`, `OPENSSH PRIVATE KEY`) with LF, CRLF, and mixed accepted separators; one or multiple nonempty valid padded-base64 body lines; exact line boundaries and full-block replacement excluding surrounding line separators; plus mismatched/missing delimiters, zero/blank/invalid body lines, inline/extra marker text, lone CR, and unsupported `ENCRYPTED PRIVATE KEY`, public, and certificate labels;
- JWT-like exact minimum segment lengths, one-short segments, punctuation boundaries, adjoining `[A-Za-z0-9_-]` negatives, and malformed/two/four-segment negatives;
- every known-key-prefix family at its exact minimum length, one-short length, accepted punctuation boundaries, adjoining ASCII-token-character negatives, invalid alphabet/case negatives, and family-specific prefix near-matches;
- overlap precedence, exact placeholder spelling, redaction ordering, UTF-16 source indexes, ordinary hexadecimal strings of varied lengths, exact `sha256:<64 lowercase hex>`, uppercase/prefix near-matches that do not independently satisfy a secret class, and no generic long-hex findings;
- text defaults, zero/exact/over limit, full sanitized hash, no marker, retained-byte count, ASCII truncation, 2/3/4-byte UTF-8 boundary truncation without a partial code point, redactions beyond retained output, non-string input, non-object/array/exotic/accessor/symbol/unknown-key options, and negative/fractional/unsafe/non-number `maxBytes`;
- scanner clean string/array, each shared finding class, multiple ordered findings, array element indexes, no matched values, exact `FLAG_VALUE`/`ENV_VALUE`/`URL_CREDENTIAL` and other placeholder/SHA/hex cleanliness, unredacted exact-grammar findings returned as `{ok:false,findings}` without throwing, and invalid/sparse/extra-property/non-string input;
- safe-error checks ensuring no token, credential, env value, private-key body, or secret text appears in thrown data.

#### Guard cases

- runtime token exact acceptance and rejection of uppercase, wrong length/prefix, whitespace, suffix, and non-string input;
- `assertLocalUrl` acceptance for every allowed scheme/literal host, omitted/empty plain or null-prototype options, valid decimal ports, paths, and queries; default/explicit-false rejection of username-only, password-only, and username/password credentials; exact-true credential opt-in with path/query; fragment rejection with and without other components; non-string URL rejection; non-object/array/exotic/accessor/symbol/unknown-key options and non-boolean `allowCredentials`; uppercase/mixed-case scheme or host, trailing-dot host, host-only/remote/percent-encoded host, invalid/empty/out-of-range port, and decimal-short/decimal-integer/hex/octal/mixed numeric-loopback rejection;
- every exact and equals denied flag, allowed values, prefix near-matches, invalid/sparse/extra-property argv, and non-string args;
- contained-path strict-descendant acceptance and rejection of equality, sibling/prefix-confusion, outside, relative, non-normalized, trailing-slash, backslash, NUL, unknown/missing fields, and non-string paths;
- worktree acceptance for every valid status/tracked pair and exact allow match; rejection of outer/options/entry shape, extra/missing/accessor/symbol properties, invalid status/tracked pairing, every relative-path grammar defect, duplicate list/entry paths, protected paths including allowed/protected overlap, prefix-only allow matches, and disallowed paths;
- guard input immutability and error-detail allow-key/no-secret assertions.

#### Scenario: Every documented branch is represented

- GIVEN the authoritative utility/guard specification
- WHEN the test names and table cases are reviewed
- THEN every accepted and rejected branch above has a deterministic assertion

### Requirement: Coherent stacked review boundaries

Physical authored-line caps MUST count only incremental lines against the immediate predecessor stack commit: P1 against current `main`, P2 against the P1 tip, P3 against the P2 tip, Code A against the P3 tip, and Code B against the Code A tip. Predecessor content MUST NOT be charged again, and planning artifacts MUST NOT count inside Code A or Code B.

| Boundary | Exact file allowlist | Cap and passing subset | Exact rollback |
|---|---|---|---|
| Planning P1 | `exploration.md`; `proposal.md` | Pre-normalization incremental size 152 lines against current `main`; cap 300; P1 planning consistency checks pass. | Revert the complete P1 commit. |
| Planning P2 | `specs/recovery-harness/spec.md`; `specs/baseline-reconciliation/spec.md` | Pre-normalization incremental size 526 lines against the P1 tip; cap 650; specification validation against P1 passes. | Revert the complete P2 commit. |
| Planning P3 | `design.md`; future `tasks.md` | Pre-normalization incremental design size 151 lines against the P2 tip; tasks not yet authored; cap 400; full planning validation and requirement-to-task traceability pass. | Revert the complete P3 commit. |
| Code A | `scripts/recovery-harness-lib.mjs`; `tests/recovery-harness.test.mjs` | Cap 750 against the P3 tip; config/artifact, canonical JSON/SHA, guards, and focused tests pass with `node --test tests/recovery-harness.test.mjs`. | Revert the complete Code A commit. |
| Code B | `scripts/recovery-harness-lib.mjs`; `tests/recovery-harness.test.mjs`; `package.json` | Cap 500 counting only incremental Code B hunks against the Code A tip; sanitizer/scanner and remaining tests pass directly and via `npm run test:recovery-harness`. | Revert the complete Code B commit, preserving the Code A parent state. |

Every boundary MUST be independently reviewable and rollback-safe. Every executable subset MUST remain external-system-free. No boundary may exceed 800 authored physical lines. Code A MUST NOT add a package script; Code B MUST NOT add another script.

#### Scenario: Slice-local rollback

- GIVEN any planning or code boundary commit must be withdrawn
- WHEN its rollback is applied
- THEN its complete commit is reverted and, because that commit obeys its exact allowlist, no unrelated file is touched

### Requirement: Exact package script boundary

`package.json` MUST add exactly:

```json
"test:recovery-harness": "node --test tests/recovery-harness.test.mjs"
```

No alternate recovery script, dependency, or lockfile change belongs to this change.

#### Scenario: Sole package change

- GIVEN the final micro-slice diff
- WHEN package files are inspected
- THEN the only package change is the exact script above and the lockfile is unchanged

### Requirement: Baseline delta does not establish recovery readiness

The baseline delta is limited to deterministic utility/guard coverage. A core PASS does not execute a recovery, produce receipts, validate invariant categories, perform cleanup, publish a manifest, run SQL, exercise an A/B lifecycle, or contact Docker, Supabase, Postgres, a network, or a provider. Therefore core PASS does not satisfy recovery readiness and does not close Week 01.

#### Scenario: Passing core suite

- GIVEN every utility/guard case passes
- WHEN baseline status is reconciled
- THEN the result is recorded only as utility/guard core PASS, with recovery readiness unsatisfied and Week 01 still open

#### Scenario: Broader evidence request

- GIVEN a proposed test or conclusion requiring process execution, receipts, invariants, cleanup, manifests, SQL, recovery lifecycle, external systems, or provider evidence
- WHEN evaluated against this change
- THEN it is deferred to a follow-up slice rather than added or inferred here
