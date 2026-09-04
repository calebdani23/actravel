---
schema: gentle-ai.verify-result/v1
change: week-03-followups-to-tasks-backfill
evidence_revision: sha256:8019afb0fcc436d6d79df42acaa6c5f1425b1e228a60643c53ecd7873d8d27f6
mode: independent-final-verification
tasks_total: 12
tasks_completed: 12
requirements_total: 5
scenarios_total: 0
verdict: FAIL
next_route: sdd-apply/remediate
---

# Verification Report

## Completeness

All 12/12 tasks are checked in `tasks.md`; `apply-progress.md` records both slices complete. The active packet contains proposal, three specs, design, tasks, and merged apply progress. Direct heading counts found 5 `### Requirement:` headings and 0 `#### Scenario:` headings. The specs are structurally adequate for normative behavior through requirement prose, but contain no scenario headings; runtime evidence was therefore assessed against the stated normative behaviors.

## Commands and evidence

| Check | Command | Exit | Output SHA-256 |
|---|---|---:|---|
| Focused tests | `node --import tsx --test tests/follow-up-backfill-preview.test.ts` | 0 | `12a3afb194527ebc157ca0d60c59ee0a77a3dc83e590c3d6137e364e38aa54d1` |
| Typecheck | `npx tsc --noEmit` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Lint | `npm run lint` | 0 | `27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf` |
| Build | `npm run build` | 0 | `e9d51fb2b23c0df0a62124fa5dfe8ea8742a448908d6df6b68bbba446ad50100` |
| Diff check | `git diff --check` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Build temporarily changed `next-env.d.ts`; it was restored before this report. No repository code was edited.

## Behavioral compliance

| Area | Result | Evidence |
|---|---|---|
| Focused suite | PASS | 8/8 tests passed. |
| Seven dispositions/reasons | FAIL | Targeted probe covered the constructed cases, but collision input returned `already-converted` with `tasks.length === 1`. |
| Entire PreviewResult permutation | FAIL | Canonical bytes were equal, but `tasks` arrays differed when event input order was permuted. |
| Existing-task collision behavior | FAIL | Already-converted/collision rows are appended to `tasks` before classification; they are returned as actionable tasks. |
| 2,000/2,001 and purity | PASS | Targeted probe: 2,000 accepted, 2,001 rejected with `CanonicalizationFailure`, frozen input unchanged. |
| Parser bounds and vectors | PASS | 1970/9999 boundaries and the 70-byte idempotency hash passed; focused golden test passed (362 bytes and canonical hash). |
| Large existingTasks | PASS WITH WARNING | No explicit existing-task cardinality bound is specified; implementation scans the supplied array per eligible event. |

## Blockers / critical issues

1. **CRITICAL / BLOCKER — actionable collision tasks:** `classifyFollowUpBackfillPreview` pushes every eligible projection into `tasks` at line 225 before checking source, owner-idempotency, and owner-lead collisions. Already-converted and collision/manual-review entries therefore remain in the actionable Task vector, contradicting the preview/design collision contract.
2. **CRITICAL / BLOCKER — nondeterministic `PreviewResult.tasks`:** task output preserves input traversal order (`tasks.push`) rather than applying the specified deterministic ordering. Permuting two independent eligible events produced equal canonical bytes but unequal `tasks` arrays.

## Slice advisory follow-ups

Both supplied Slice review advisory sets were considered. Their warnings do not downgrade the above findings: these are demonstrated normative violations, so they are classified as CRITICAL rather than advisory-only.

## Final verdict

**FAIL** — route to `sdd-apply/remediate`. Do not archive until collision filtering and full-result determinism are corrected and independently reverified.
