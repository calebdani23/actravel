# Tasks: Week 01 Recovery Harness Utility/Guard Micro-Slice

## Review Workload Forecast

| Scope | Estimate | Risk | Boundary |
|---|---:|---|---|
| Planning P1/P2/P3 | 151–526 lines by design | High | Separate planning boundaries; exclude from code caps |
| Code A | ≤750 incremental lines | High | `scripts/recovery-harness-lib.mjs`, `tests/recovery-harness.test.mjs` |
| Code B | ≤500 incremental lines | High | Code A allowlist plus `package.json` |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Stacked-to-main is already approved; no chained decision remains. Planning P1 = `exploration.md`, `proposal.md` (cap 300); P2 = both specs (cap 650); P3 = `design.md`, this `tasks.md` (cap 400). Record these boundaries only; do not create commit/push tasks.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| Code A | Core config, canonical, hash, and guards | PR 1 | `node --test tests/recovery-harness.test.mjs` (Code A cases only) | N/A: pure built-in tests; no external systems | Revert whole Code A commit; exact two-file allowlist |
| Code B | Sanitizers, scanner, sole package script | PR 2 | `npm run test:recovery-harness && npm run lint` | N/A: pure built-in tests; no process/external harness behavior | Revert whole Code B commit, preserving Code A |

## Phase 1: Planning and Safety Boundaries

- [x] 1.1 Validate proposal/spec/design traceability and preserve the P1/P2/P3 caps, allowlists, evidence rules, and complete-commit rollback boundaries.
- [x] 1.2 Confirm protected-path and image checks: no protected entry is accepted, no image behavior changes, and no files outside the declared allowlists are touched.

## Phase 2: Code A — Core Utilities and Guards (strict TDD)

- [x] 2.1 RED in `tests/recovery-harness.test.mjs`: exact exports, `RecoveryHarnessError` name/code/message/details safety, config render/parser/artifact, canonical JSON, SHA-256, and input immutability (Reqs: Exact module surface; Closed failure; Config; Artifact; Canonical; SHA).
- [x] 2.2 RED: runtime-token, literal local-URL, denied-flag, strict contained-path, and exact worktree/protected-path guard branches, including safe diagnostics and no I/O (Reqs: Guard requirements; Core-only boundary).
- [x] 2.3 GREEN in `scripts/recovery-harness-lib.mjs`: implement Code A exports and the closed internal error contract; use Node 22 built-ins only, with no side effects or lifecycle/provider/filesystem/network/Docker/Supabase/Postgres/SQL/migration/dependency/lockfile/image behavior.
- [x] 2.4 Verify Code A with `node --test tests/recovery-harness.test.mjs`; stop on failure, unsafe diagnostic, mutation, external-system access, allowlist violation, or incremental diff over 750 lines; retain passing output and diff evidence.

> Focused authorized remediation revalidated Code A under the active remediation token: 9 focused tests pass; Code B and interpretation tasks remain pending.

> Four-branch remediation revalidated config precedence, trap-safe closed errors, exact dense-array ownership, and absolute containment; Code B remains unchecked.

> Final trap-hardening revalidated adversarial injected-error paths across Code A APIs and exact config precedence; Code B remains unchecked.

> Bounded maintainer remediation revalidated canonical array traps, final config precedence, closed URL options, and deterministic clock-free tests; Code B remains unchecked.

> Authorized bounded remediation revalidated revoked-array handling, descriptor-first config precedence, closed worktree options, and ordered flag classification; Code B remains unchecked.

> Single-branch worktree remediation revalidated entry-order policy short-circuiting, including protected/not-allowed entry 0 before malformed later entries; Code B remains unchecked.

> Single-guard remediation revalidated canonical relative-path and duplicate rejection for both worktree policy lists before entry evaluation; Code B remains unchecked.

## Phase 3: Code B — Sanitizers and Scanner (strict TDD)

- [x] 3.1 RED: contextual precedence and no-mutation tests for `sanitizeArgv`, `sanitizeEnv`, `sanitizeText`, and `scanSecrets`, covering exact flags/names, allowNames, placeholders, UTF-8 limits, hashes, and post-scan cleanliness.
- [x] 3.2 RED: URL/PEM/JWT/known-key boundaries, overlap precedence, punctuation/label negatives, UTF-16 indexes, ordinary hex/SHA cleanliness, array findings, and safe-error/no-secret cases (Baseline deterministic inventory).
- [x] 3.3 GREEN in `scripts/recovery-harness-lib.mjs`: implement shared detectors, contextual redaction precedence, sanitizers, scanner, postconditions, and closed errors without mutation or external systems.
- [x] 3.4 Add exactly `"test:recovery-harness": "node --test tests/recovery-harness.test.mjs"` to `package.json`; make no lockfile, dependency, alternate-script, or other package change.
- [x] 3.5 Run `npm run test:recovery-harness && npm run lint`; stop on failure, secret-bearing diagnostics, mutation, external/lifecycle scope, image/protected-path violation, package drift, or Code B incremental diff over 500 lines. Capture full-test evidence and rollback to Code A tip if needed.

## Phase 4: Interpretation Gate

- [x] 4.1 Verify only utility/guard core PASS is reported; do not claim recovery readiness or Week 01 closure, and defer execution, receipts, invariants, cleanup, manifests, SQL, A/B lifecycle, and provider evidence.
