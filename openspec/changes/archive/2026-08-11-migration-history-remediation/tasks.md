# Tasks: Migration History Remediation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 650–780 across 6 tracked artifacts |
| 800-line budget risk | Medium; dominant lens is safety/evidence traceability |
| Chained PRs recommended | No |
| Suggested split | Single PR: evidence packet plus task-plan evidence |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception only if measured diff exceeds 800 |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
800-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Freeze identity and evidence contract | Single | `git diff --check`; reviewer checklist | N/A: documentation-only | Revert packet files |
| 2 | Collect and reconcile provenance | Single | deterministic manifest/hash comparison | N/A: archived/read-only evidence | Revert register/ledger |
| 3 | Rehearse isolated recovery and gate | Single | lint/build/quote test | Disposable local stack only | Remove packet/temp rehearsal |

## Phase 1: Safety and Evidence Contract

- [x] 1.1 Freeze clean Git HEAD, branch, repository identity, allowed paths (`openspec/changes/migration-history-remediation/**` plus ignored temp workspace); prohibit migrations, types, app/config, DB, remote, `0061+`, commits/PRs; validate with read-only `git status --short`, `git rev-parse`; record hashes; stop on dirty/identity mismatch.
- [x] 1.2 Name owners for provenance, environment, behavior/RLS, recovery, and final approval in `environment-identity.md`; create that artifact with sanitized ref/role/time only; validate redaction; fail closed on secrets or unknown owner.
- [x] 1.3 Write RED threat checks before collection: allowlisted-shell failure/timeout, mutation-shaped DB request, and unknown executable rejection; allowed paths are packet/temp only; validate with safe fixture/dry-run or official-doc lookup; capture nonzero/timeout/rejection, otherwise BLOCKED.

## Phase 2: Deterministic Reconciliation

- [x] 2.1 Create `evidence-ledger.md` and `migration-register.md`; allowed inputs are `db/migrations/` inventory and authorized archived remote evidence; prohibit remote statement fabrication/schema inference; validate sorted filenames, byte SHA-256, stable sanitized hashes; record source/time/status or `unavailable`.
- [x] 2.2 Map exact rows: remote `0051` and `drop_public_rate_limits_write_policy` = `remote-only/untracked`/provenance-blocked; local `0020` and remote `0044`–`0049` = `ambiguous/manual-review`; local `0057` = `local pending`, absorbed by `0060`, not replayed; include represented legacy/name variants; reject duplicates/missing fields and classify `ambiguous/manual-review`.
- [x] 2.3 Preserve authorized remote names/statements/hashes only, never bodies unless authorized; preserve byte-for-byte type-drift evidence and reference behavior/RLS/helper, CRM/quote/purge/archive/data-integrity evidence without protected-file edits; validate each row’s evidence IDs; missing/contradictory proof blocks.

## Phase 3: Isolated Rehearsal

- [x] 3.1 Create `local-rehearsal.md`; first use official current Supabase CLI docs to validate commands/flags at task time, then prove disposable non-linked/non-production identity; allowed paths are temp workspace and packet; prohibit linked/remote targets; capture command labels/time/input hashes; unavailable or uncertain target = fail closed.
- [x] 3.2 Run only the repository-supported local stack backup/restore rehearsal against disposable isolated targets, with external boundaries disabled; verify protected contracts; record exclusive `verified|failed|unavailable`, cleanup, and the explicit non-production limitation; timeout, mismatch, mutation, or secret exposure = BLOCKED.
- [x] 3.3 Remove disposable targets/temp secrets/logs; prove no migration/schema/type/application/config/remote mutation using read-only status/diffs and identity checks; retain only sanitized deterministic evidence; any residue or drift blocks completion.

## Phase 4: Gate and Verification

- [x] 4.1 Create `final-gate.md` with exactly one `PASS|BLOCKED|PASS WITH FOLLOW-UP`, blockers/owners/approvals, register-to-evidence traceability, and explicit safe/unsafe `0061+` answer; missing provenance, target, recovery, rehearsal, or authorization makes `0061+` unsafe.
- [x] 4.2 Update `tasks.md` checkboxes/apply-progress evidence references only within the change directory; run `npm run lint`, `npm run build`, and `npm run test:quote-notifications` with external boundaries disabled; record exit status/hash; any failure remains BLOCKED.
- [x] 4.3 Perform independent final verification: inspect all normative scenarios, threat RED results, five artifacts, redaction, exclusive rows, rollback boundary, and protected-path diff; no commits, migration allocation, review lifecycle, PR, or database command; missing evidence prevents approval.

## Cleanup and Rollback

- [x] 5.1 Rollback only deletes/reverts the five packet artifacts and sanitized task evidence plus disposable rehearsal outputs; never claim or execute database rollback; re-run read-only clean-state checks and record the result.
