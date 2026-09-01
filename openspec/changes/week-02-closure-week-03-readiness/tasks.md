# Tasks: Week 02 Closure / Week 03 Readiness

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 80–140 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Reconcile archived child evidence and dated migration claims | PR 1 | `git diff --check` | N/A — documentation-only | Revert closure evidence edits |
| 2 | Update living implementation records for the controlled Week 03 route | PR 1 | `git diff --check` | N/A — no runtime behavior | Revert `ACTIVE/PROGRESS/DECISIONS` edits |
| 3 | Prove approved-path-only delta and unrelated-file preservation | PR 1 | `git diff --name-only` plus `git diff --check` | N/A — path-scoped repository check | Revert only approved documentation paths |

## Phase 1: Evidence Reconciliation

- [x] 1.1 Cross-check archived Gate 0, Tasks, and Notifications `archive-report.md`/`verify-report.md` records; identify each archive, review allowance, independent PASS, and child-specific receipt without reuse.
- [x] 1.2 Record authoritative archive counts (Tasks 8/8, Notifications 11/11), the non-authoritative “12 tasks” discrepancy, dated 0061–0063 snapshots, stale-remote qualification, warnings, failed attempts, and explicit no-rollout/non-claims.

## Phase 2: Living Documentation Edits

- [x] 2.1 Edit `docs/implementation/ACTIVE.md` to route Week 03 only to the first independently reviewable `followups-to-tasks` change after the conjunctive closure evidence passes.
- [x] 2.2 Edit `docs/PROGRESS.md` with shipped local facts, dated unapplied-remote snapshots, preserved warnings/failed attempts, and deferred rollout/follow-up boundaries.
- [x] 2.3 Edit `docs/DECISIONS.md` with the documentation-only closure boundary, evidence-preservation rule, stale snapshot treatment, and separately authorized Week 03 follow-up/rollout.

## Phase 3: Path-Scoped Preservation Checks

- [x] 3.1 Capture tracked changes and every untracked path before edits; retain the inventory as review evidence without removing or staging unrelated files.
- [x] 3.2 Compare the after-state using the exact five phase-owned paths (closure `spec.md`, `apply-progress.md`, `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md`) and confirm the tasks ledger, child archives, code, schema, generated types, and unrelated untracked files are unchanged.
- [x] 3.3 Run `git diff --check` and verify the final diff contains no implementation, migration, remote-state, lifecycle, or other-path edits.

## Post-Task Gates

1. Independent verification reviews the reconciled evidence and exact path-scoped delta.
2. Native bounded review/allow and post-apply approval occur outside this checklist.
3. Archive only after verification and review pass; preserve all child packets and provenance unchanged.
