# Baseline Reconciliation Specification

## Purpose

Establish an evidence-first, non-destructive account of repository, Supabase history, live schema, generated types, environments, and recovery readiness before any new migration identifier is allocated.

## Requirements

### Requirement: Capture and classify the repository baseline

The reconciliation report MUST record current Git HEAD, branch, working-tree state, migration filenames/order/checksums where available, and classify documentation-only commits separately from executable application or schema changes. It MUST identify gaps such as the local `0051` gap without treating documentation as database evidence.

#### Scenario: Git evidence is complete
- GIVEN the repository contains code, migrations, and documentation commits
- WHEN the baseline is inspected
- THEN the report records exact Git evidence and identifies documentation-only commits without claiming remote application

### Requirement: Reconcile complete local and authoritative remote history

The report MUST use fresh local and remote evidence, discrepancy classifications, evidence references, times, owners, and authorizers. It MUST classify `0051`, `drop_public_rate_limits_write_policy`, `0020`, `0044`–`0049`, and `0057`/`0060` exactly once. (Previously: it required explicit dispositions for named findings.)

#### Scenario: Findings receive deterministic classifications
- GIVEN local or remote evidence is available, missing, or contradictory
- WHEN reconciliation is completed
- THEN every named finding has exactly one classification, disposition, owner, authorizer, source, and capture time

### Requirement: Use exclusive discrepancy labels

Every discrepancy MUST be classified exactly once as `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`. It MUST NOT infer ledger provenance from schema state or local body provenance from a ledger row; missing proof MUST remain manual review. (Previously: it did not state both inference prohibitions.)

#### Scenario: Proof cannot establish provenance
- GIVEN a final schema or ledger row appears to suggest a migration relationship
- WHEN provenance is evaluated
- THEN no relationship is inferred and the finding remains `ambiguous/manual-review`

### Requirement: Compare history to live schema

The report MUST compare targeted schema, functions/RPCs/helpers, triggers, constraints, and RLS behavior read-only, preserving authorization, CRM governance, quote cutover, purge, archive/restore, helper grants, and data integrity. (Previously: it required reporting live drift without mutation.)

#### Scenario: A protected invariant differs
- GIVEN a targeted live object or authorization behavior differs
- WHEN evidence is compared
- THEN it is blocked and reported without cleanup, repair, DDL, or DML

### Requirement: Detect generated type drift safely

The packet MUST generate a remote type artifact in ignored temporary storage, compare it deterministically with `lib/supabase/database.types.ts`, and report hashes and differences. It MUST leave tracked generated types unchanged and MUST NOT overwrite or regenerate them. (Previously: regeneration could occur after proven alignment.)

#### Scenario: Fresh types differ
- GIVEN remote types are generated for comparison
- WHEN the diff is produced
- THEN only ignored temporary artifacts are written, tracked types remain unchanged, and drift is reported without provenance inference

### Requirement: Verify validation and environment safety

Baseline lint, build, and quote-notification tests MUST be recorded with outcomes and MUST disable external boundaries; no real Resend, Meta, Storage, or production smoke traffic MAY run. Recovery rehearsal MUST be `verified` only with an approved disposable non-production target, role and authorization, cost/tooling/credential confirmation, backup identity, restore and invariant checks, cleanup proof, and independent sign-off. Missing prerequisites MUST be recorded as `unavailable`, not failed or verified. (Previously: validation distinguished local and remote readiness.)

#### Scenario: Safe baseline validation passes

- GIVEN external boundaries are disabled
- WHEN lint, build, and quote tests run
- THEN results are reproducible and no external traffic or database mutation occurs

#### Scenario: Recovery proof is unavailable
- GIVEN target, authorization, tooling, cost, credentials, backup, cleanup, or independent sign-off is missing
- WHEN recovery readiness is evaluated
- THEN rehearsal status is `unavailable` and the final gate is `BLOCKED`

### Requirement: Gate all risky actions and preserve scope

The packet MUST NOT perform DDL, DML, history repair, migration push/reset, provider-native repair, `0061+`, type overwrite, application behavior changes, production smoke, real external traffic, or modification of unrelated paths including `docs/about/helps/intakes/image.png`. A request crossing these boundaries MUST fail closed. (Previously: risky operations and application changes were prohibited.)

#### Scenario: Scope boundary is crossed
- GIVEN an operator requests a prohibited mutation or unrelated file change
- WHEN the request is evaluated
- THEN it is rejected, recorded as blocked, and no action occurs

### Requirement: Publish a bounded final decision

The packet MUST publish exactly one final gate: `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`. Durable `DECISIONS.md`, `PROGRESS.md`, and `ACTIVE.md` updates MUST cite verified facts and blockers, and MUST NOT advance Week 01 unless every completion gate is proven. `0061+` MUST remain unsafe while any provenance, identity, authorization, discrepancy, validation, type-preservation, or recovery gate is missing, unavailable, failed, or unreviewed. (Previously: the report ended with one gate and a safe/not-safe allocation answer.)

#### Scenario: Evidence packet completes before closure
- GIVEN the evidence packet is reproducible but an operational prerequisite is unavailable
- WHEN durable status is updated
- THEN the packet may complete, the sole final gate is `BLOCKED`, and Week 01 remains active

### Requirement: Capture fresh, separated evidence

The packet MUST record fresh Git HEAD, branch, worktree state, migration filenames/order/checksums, protected-path hashes, source, and capture time. It MUST separately identify local bytes, the authoritative remote ledger, live behavior, and generated types. Documentation and archived packets MAY provide historical context but MUST NOT represent current remote proof.

#### Scenario: Identity is reproducible
- GIVEN repository and protected paths are inspected
- WHEN the packet is created
- THEN exact identity, hashes, sources, and timestamps are recorded

### Requirement: Reconcile documentation with executable evidence

The packet MUST deterministically classify changes since the archived identity as documentation-only or as touching executable, schema, or protected paths. The classification MUST cite Git path, mode, and hash evidence. Documentation-only changes MUST NOT be treated as refreshed remote provenance; any executable, schema, or protected-path change MUST invalidate stale assumptions and remain blocking until reassessed.

#### Scenario: Changed paths are classified against archived identity
- GIVEN repository changes exist since the archived identity
- WHEN documentation and executable/protected paths are compared
- THEN the packet records the classification with Git path, mode, and hash evidence
- AND documentation-only changes do not refresh remote provenance, while executable/protected-path changes invalidate stale assumptions and block until reassessed

### Requirement: Classify every discrepancy exclusively

Each named finding—`0051`, `drop_public_rate_limits_write_policy`, `0020`, `0044`–`0049`, and `0057`/`0060`—MUST have exactly one label: `represented/applied`, `remote-only/untracked`, `local pending`, or `ambiguous/manual-review`. It MUST include evidence references, owner, disposition, authorization state, and source-time traceability. Missing or contradictory proof MUST remain manual review.

#### Scenario: Provenance is only implied
- GIVEN schema state or a ledger row appears to suggest a relationship
- WHEN authoritative linkage to local bytes is absent
- THEN no relationship is inferred and the finding blocks readiness

### Requirement: Assign role-based authority

Every evidence item, discrepancy, and gate MUST name a role-based owner, required authorizer, status, and next disposition. Collection, review, and operator sign-off MUST be attributable and distinct; authorization MUST NOT be self-assumed.

#### Scenario: Authorization is incomplete
- GIVEN an item lacks an accountable role or required approval
- WHEN readiness is assessed
- THEN it is blocking and unresolved

### Requirement: Bound approved live inspection and recovery

Live inspection MUST be read-only and limited to an explicitly approved, sanitized target with recorded environment identity and separation. Backup/restore rehearsal MUST use an approved disposable non-production target and record backup identity, restore result, operator sign-off, and cleanup result. Failed, unavailable, or unverified cleanup MUST block. Repository-verifiable evidence MUST remain distinct from external/operator evidence.

#### Scenario: Recovery rehearsal is incomplete
- GIVEN target, backup, restore, authorization, or cleanup evidence is missing or contradictory
- WHEN the gate is evaluated
- THEN the result is deterministically `BLOCKED`, not assumed successful

### Requirement: Preserve generated-type and historical boundaries

The packet MUST preserve the generated-type drift baseline and original evidence unchanged. It MUST NOT regenerate or modify tracked generated types. Archived evidence MAY inform investigation only as labeled historical input and MUST NOT satisfy fresh identity, provenance, target, authorization, or recovery gates.

#### Scenario: Type drift or stale history is found
- GIVEN generated types differ or archived proof conflicts with current evidence
- WHEN readiness is assessed
- THEN drift and contradiction remain recorded and cannot be presented as aligned proof

### Requirement: Bound dependency-baseline parallel work

`dependency-baseline` MAY proceed in parallel only for manifest/lockfile inventory and verification; it MUST fail closed on any migration, schema, generated type, or database scope drift.

#### Scenario: Inventory remains in scope
- GIVEN only manifests and lockfiles are inspected
- WHEN verification completes
- THEN no migration, schema, type, or database artifact is changed

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

### Requirement: Bound captured-type compiler compatibility

The repository MAY publish `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT` only when the
fixed captured snapshot identity, exact `HEAD` TypeScript source preimage, parsed
root boundaries, isolated in-memory compiler hosts, baseline-zero diagnostics,
and candidate-zero diagnostics all pass. The result proves compiler compatibility
with the captured bytes only. It MUST NOT be interpreted as a build result, fresh
remote provenance, tracked generated-type alignment, recovery readiness, Week 01
closure, or authorization to create migration `0061+`. Any unsafe semantic
condition MUST produce `BLOCKED` with its bounded blocker code and MUST NOT modify
tracked types, migrations, application behavior, dependencies, lockfiles, or
other protected paths.

#### Scenario: Captured snapshot compatibility passes

- GIVEN the fixed snapshot and exact tracked-source preimage are validated
- AND baseline and candidate compiler diagnostics are empty
- WHEN the diagnostic publishes its result
- THEN it may publish `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT`
- AND the result is recorded only as compatibility with those captured bytes

#### Scenario: Compatibility is not broader readiness

- GIVEN the diagnostic publishes `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT`
- WHEN baseline status is reconciled
- THEN no build, fresh remote provenance, tracked type alignment, recovery readiness,
  Week 01 closure, or `0061+` authorization is inferred

#### Scenario: Unsafe or changed inputs fail closed

- GIVEN snapshot identity, source preimage, root filtering, compiler isolation, or
  diagnostics are unsafe or changed
- WHEN the diagnostic runs
- THEN it publishes `BLOCKED` with the applicable blocker and performs no protected mutation
