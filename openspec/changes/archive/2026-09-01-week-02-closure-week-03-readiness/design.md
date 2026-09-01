# Design: Week 02 Closure / Week 03 Readiness

## Technical Approach

Produce a documentation-only closure record that re-evaluates the archived Gate 0, Tasks,
and Notifications packets after the closure gate failure. The record separates dated historical
evidence from current inspection, reconciles authoritative task counts, preserves warnings and
failed attempts, and makes Week 03 routing conditional on verification, review, and archive.
It grants no implementation or rollout authorization.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Closure status | Treat the prior gate failure as a failed closure assessment requiring corrected evidence prose and scoped inventory controls. | Infer closure from child PASS receipts alone. | A child PASS does not cure an inaccurate aggregate record or an unsafe worktree assumption. |
| Remote evidence | Describe 0061–0063 only through the dated archived snapshots in the Gate 0 (2026-08-26), Tasks (2026-08-31), and Notifications (2026-08-31) packets; make no current remote parity claim without fresh read-only inspection. | Present snapshots as current linked/production state. | Archived observations age and cannot establish present migration history, schema, or RLS parity. |
| Task counts | Use Tasks/archive 8/8 and Notifications/archive 11/11 as authoritative persisted-task counts. Record Notifications verify prose “12 tasks” as a non-authoritative discrepancy. | Reconcile by selecting the larger number. | The archive task ledger is exact; verify prose is inconsistent with it. |
| Worktree proof | Capture a pre-action inventory, then compare an explicit path-scoped before/after delta; preserve unrelated untracked files. | Assume a clean worktree or use an unscoped diff. | Existing uncommitted and unrelated files are part of repository reality and must not be hidden or removed. |

## Evidence and Data Flow

`Captured inventory` → `archived child reports` → `corrected evidence matrix` → `verification`
→ `native review/allow` → `archive` → `Week 03 followups-to-tasks route`

The matrix consumes preserved reports only. A current remote claim is permitted only after a
newly authorized, read-only inspection; otherwise the dated snapshot remains explicitly stale.

| Child | Authoritative result | Closure use |
|---|---|---|
| Gate 0 | Archived PASS/review evidence from `2026-08-26-week-02-gate0-shadow-harness` and preserved failed attempts | Establishes only its recorded, dated snapshot: no remote `0061+`; it is not current parity evidence. |
| Tasks | Archived verify PASS, 7/7 requirements, 11/11 scenarios, and archive 8/8 tasks from `2026-08-31-week-02-tasks-foundation` | Archive count is exact; preserve Tasks date-normalization warning and its dated no-remote-`0061+` snapshot. |
| Notifications | Archived verify PASS, 6/6 requirements, 9/9 scenarios, and archive 11/11 tasks from `2026-08-31-week-02-staff-notifications-foundation` | Archive count is exact; verify prose “12 tasks” is a non-authoritative discrepancy; preserve its dated no-remote-`0061+` snapshot. |

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/week-02-closure-week-03-readiness/design.md` | Modify | Correct this closure design only. |
| `docs/implementation/ACTIVE.md` | Later, exact file | Route to Week 03 `followups-to-tasks` only after closure evidence passes. |
| `docs/PROGRESS.md` | Later, exact file | Record shipped local facts, dated remote snapshots, warnings, failed attempts, and non-claims. |
| `docs/DECISIONS.md` | Later, exact file | Record the closure boundary, preservation rule, and separately authorized follow-up/rollout. |

No application, migration, generated type, test, archive child, or unrelated path is changed by
this design action.

## Interfaces / Contracts

The closure contract is conjunctive: `Gate 0 PASS ∧ Tasks PASS ∧ Notifications PASS ∧
archive/review evidence ∧ scoped before/after delta ∧ no unverified remote claim`. A missing,
stale, contradictory, or failed gate keeps Week 02 open and prevents Week 03 routing.

The pre-action inventory MUST identify tracked changes and all untracked paths. The after-state
MUST compare only the exact approved documentation paths and assert that unrelated untracked
files are byte-for-byte preserved and untouched.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Document | Counts, dated snapshot qualification, warnings, and non-claims | Cross-check archived reports and preserve discrepancy wording. |
| Scope | Only exact documentation paths changed | Record inventory and path-scoped before/after delta; run `git diff --check`. |
| Gate | Review and archive sequence | Independently verify, obtain native review/allow, then archive; route only after both pass. |

## Preserved Warnings and Failed Attempts

- Tasks date normalization remains a non-blocking warning.
- Notifications nullable Args widening, delimiter-based canonical input,
  tautological immutable-fields check, and the base-only quote type failure remain warnings.
- All failed verification attempts and remediation history remain preserved in archived
  `apply-progress.md`/`verify-report.md`; they are not rewritten or collapsed into PASS.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary is changed; the worktree check is documentation scope accounting,
not process integration.

## Migration / Rollout

No migration or rollout is performed. The 0061–0063 remote records are dated archived snapshots,
not current parity evidence. Fresh authorized inspection is required before any remote or migration
decision. Week 03 begins only through the exact `followups-to-tasks` documentation route.

## Review / Archive Sequence

1. Capture the pre-action inventory, including unrelated untracked files.
2. Review the corrected matrix and dated remote/non-authority language.
3. Independently verify the exact path-scoped before/after delta and preserved warnings/failures.
4. Obtain native bounded review/allow; do not treat lifecycle records as implementation work.
5. Archive only after verification and review pass, preserving all child packets unchanged.

## Open Questions

- [ ] None; any current remote parity question is deferred to a separately authorized fresh inspection.
