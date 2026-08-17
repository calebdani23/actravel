# Tasks: Baseline Reconciliation Operational Closure

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines / files | 520–780 lines / 10–14 packet and durable-doc files |
| Dominant risk | Evidence integrity, protected-state restoration, and operator-gated rehearsal |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 evidence packet; PR 2 validation/rehearsal gate; PR 3 durable docs |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception pending approval |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Identity, protected snapshot, read-only evidence, and findings | PR 1 | RED guard tests plus packet schema checks | N/A: no production or provider mutation | Remove `packet/` only |
| 2 | Safe validation, type-preservation, rehearsal state machine, final gate | PR 2 | `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run lint && npm run build && npm run test:quote-notifications` | Disposable target only after every preflight prerequisite | Revert gate/validation artifacts |
| 3 | Verified durable status and operator handoff | PR 3 | Markdown/link and gate-consistency checks | N/A: documentation-only | Revert three durable docs |

## Phase 1: Guards and Baseline Identity (currently executable)

- [x] 1.1 RED: reject README/MDX or `docs/about/helps/intakes/image.png` as executable/ambiguous; test absolute repo selection and reject relative/foreign `-C`.
- [x] 1.2 RED: preserve clean, staged, and dirty index/worktree semantics; fail on protected preimage collision before restoration.
- [x] 1.3 Create append-only `packet/identity.md`, `packet/protected-snapshot.md`, and `packet/dependency-evidence.md` with Git, Node/npm, lockfile, hashes, owners, UTC times, and no dependency changes.

## Phase 2: Read-Only Evidence and Drift (currently executable unless guard refuses)

- [x] 2.1 Implement provider-ref/URL preflight for `bdyhakpmxegoipbmbtjb`; mismatch MUST stop before ledger, catalog, policy, or type collection.
- [x] 2.2 Create `packet/provider-evidence.md` from exact ref-pinned read-only migration/catalog/policy evidence; label catalog as behavior corroboration, never provenance.
- [x] 2.3 RED: prove tracked `lib/supabase/database.types.ts` cannot be overwritten; then write ignored temporary types, normalized SHA-256/diff evidence in `packet/type-diff.md` (never run `db:types`).
- [x] 2.4 Create `packet/findings.md`; classify `0051`, `drop_public_rate_limits_write_policy`, `0020`, `0044–0049`, and `0057/0060` exactly once with source/time/owner/authorizer/review fields.

## Phase 3: Validation and Fail-Closed Gate (currently executable)

- [x] 3.1 RED: reject missing review, duplicate dispositions, invalid rehearsal transitions, prohibited mutation requests, and invalid final-gate values.
- [x] 3.2 Record guarded `lint`, `build`, and quote-notification results with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`; restore only command-owned metadata and stop on collision.
- [x] 3.3 Create `packet/final-gate.md` with exactly one `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`; keep Week 01 and `0061+` blocked unless every gate is proven.

## Phase 4: External / Operator-Gated Work

- [x] 4.1 Record rehearsal preflight in `packet/rehearsal.md`; status is `unavailable` unless target, role, authorization, tooling/cost, credentials, backup, restore/invariants, cleanup, and independent sign-off are supplied.
- [x] 4.2 Only with all prerequisites, run a disposable non-production rehearsal; record terminal outcome and cleanup proof. Never improvise, mutate production, repair history, push/reset, or perform destructive cleanup. Conditional non-execution is recorded as `unavailable` because prerequisites were absent.

## Phase 5: Durable Handoff

- [x] 5.1 Update only `docs/DECISIONS.md`, `docs/PROGRESS.md`, and `docs/implementation/ACTIVE.md` with cited verified facts/blockers; preserve unrelated image and all tracked types/migrations.
- [x] 5.2 Final verification: protected inventory/hash comparison, packet consistency, no external traffic, no database mutation, and explicit prohibition of application changes, `0061+`, and type regeneration.
