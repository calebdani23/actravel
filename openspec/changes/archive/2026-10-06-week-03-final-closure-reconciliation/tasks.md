# Tasks: Week 03 Final Closure Reconciliation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Gate 0: 0 repository lines; S1: `<=400`; S2: `<=400` |
| 400-line budget risk | Medium — both writable slices have hard fail-closed ceilings |
| Chained PRs recommended | No — this change is local-only and remote/Git delivery is prohibited |
| Suggested split | Gate 0 → local S1 evidence/candidate review → local S2 publication/terminal review |
| Delivery strategy | `ask-on-risk`; the user already fixed the local two-slice strategy and prohibited remotes |
| Chain strategy | `pending` — not applicable unless a later, separately authorized delivery change exists |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| Gate 0 | Prove scope, seal the mixed baseline/preimages, and RED-test temporary helpers | None; local-only | `node "$closure_tmp/closure-helper.mjs" self-test "$closure_tmp/probes"` | N/A — temporary fixtures only; no repository test file | Remove only Gate 0 temporary state after verified failure; authoritative documents stay untouched |
| S1 | Produce immutable evidence and four hash-sealed candidates without publication | None; local review boundary | `RUN_TASK_AUTOMATION_DB_TESTS=1 RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-*.test.ts tests/task-actions-*.test.ts tests/task-automation-*.test.ts tests/task-source-*.test.ts` | Local/disposable PostgreSQL/Docker; then run the exact 81/81 command in the S1 matrix serially | Living documents remain at all four pre-S1 hashes; S2 is blocked unless an independent S1 verifier returns PASS |
| S2 | Journal, publish, independently verify, or restore all four preimages; then clean temporary state | None; local terminal review boundary | `cmp -s -- openspec/changes/week-03-final-closure-reconciliation/candidates/docs/implementation/weeks/week-03-tasks-my-day.md docs/implementation/weeks/week-03-tasks-my-day.md && cmp -s -- openspec/changes/week-03-final-closure-reconciliation/candidates/docs/implementation/ACTIVE.md docs/implementation/ACTIVE.md && cmp -s -- openspec/changes/week-03-final-closure-reconciliation/candidates/docs/PROGRESS.md docs/PROGRESS.md && cmp -s -- openspec/changes/week-03-final-closure-reconciliation/candidates/docs/DECISIONS.md docs/DECISIONS.md` from the repository root, followed by fresh 13/46 verification | N/A — documentation transaction only; fault probes completed at Gate 0 | Any failure restores and verifies all four preimages, the Week 03 route, index state, and non-owned manifest before cleanup |

## Fixed Scope, Ownership, and Accounting

- **No product/tests/remotes:** do not edit application code, schema, migrations, generated types, fixtures, tests, canonical specifications, archives, Git index/history, or any remote system. Do not inspect credentials/sessions or run migration, bootstrap, deployment, rollout, fetch, push, or PR operations.
- **Allowed local Git operations:** only `git rev-parse`, `git status`, `git ls-files`, and `git diff`. Do not run `git add`, `restore`, `checkout`, `reset`, `clean`, `stash`, branch, commit, fetch, or push.
- **S1 repository ownership:** `openspec/changes/week-03-final-closure-reconciliation/apply-progress.md`, `tasks.md` S1 rows, `evidence/preservation-baseline.nul`, `evidence/s1-seal.nul`, `evidence/s1-verification.md`, and the four temporary candidate files beneath `candidates/`.
- **S2 repository ownership:** the four living documents, `tasks.md` S2 rows, `evidence/s2-publication.md`, `verify-report.md`, `evidence/terminal-cleanup.md`, publication staging/journal working paths, and terminal removal of candidate working bytes.
- Existing `proposal.md`, `design.md`, `exploration.md`, `specs/**`, all archives/canonical specifications, and every product/schema/test path are read-only.
- Count additions plus deletions with `git diff --no-index --no-renames --numstat -z` against the sealed corresponding preimage. Accept diff exit `0` or `1`; reject binary `-`, rename inference, unknown paths, or a ceiling breach. Compare candidate and published deltas to the same pre-S1 preimage.
- Candidate mirrors are capped at 2 MiB total, durable NUL receipts at 8 MiB per slice, and the validated temporary root at 32 MiB. These byte limits supplement the line limits and may not be evaded by encoding, compression, omitted provenance, or moving work into product/tests.

### Slice Line Budgets

| S1 accounted path/content | Maximum changed text lines |
|---|---:|
| `apply-progress.md` | 112 |
| `tasks.md` S1 ledger | 24 |
| `evidence/s1-verification.md` | 44 |
| Week 03 brief candidate delta | 84 |
| `ACTIVE.md` candidate delta | 72 |
| `PROGRESS.md` candidate delta | 24 |
| `DECISIONS.md` candidate delta | 24 |
| Correction reserve | 16 |
| **S1 hard maximum** | **400** |

| S2 accounted path/content | Maximum changed text lines |
|---|---:|
| Published Week 03 brief delta | 84 |
| Published `ACTIVE.md` delta | 72 |
| Published `PROGRESS.md` delta | 24 |
| Published `DECISIONS.md` delta | 24 |
| `tasks.md` S2-only delta | 12 |
| `evidence/s2-publication.md` | 42 |
| `verify-report.md` | 54 |
| `evidence/terminal-cleanup.md` | 24 |
| Correction reserve | 64 |
| **S2 hard maximum** | **400** |

## Gate 0: Scope, Baseline, Preimages, and RED Evidence

- [x] 0.1 Resolve the repository root, require the command working directory to equal it, require the existing closure-temp parent, create exactly one mode-0700 validated closure temporary root using the exact Gate 0 bootstrap below, record the helper source/hash there, and prove zero pre-existing `actravel-*` containers before any mutation. Use a 120,000 ms timeout for the preflight block.
- [x] 0.2 Seal HEAD, raw NUL `status --porcelain=v2`, staged/index entries, tracked paths, untracked paths, runtime state, exact `next-env.d.ts` (read-only) bytes, and the exact four living-document preimages without cleaning, staging, normalizing, or taking ownership of unrelated work. Store these rollback inputs only in the validated temporary root and retain them through S2 PASS or verified rollback.
- [x] 0.3 RED-test the temporary manifest helper before generating durable evidence: reject empty, duplicate, absolute, parent-traversal, out-of-root, directory-owned, device, socket, and followed-symlink entries; accept spaces/newlines and non-followed symlinks; distinguish a present zero-byte regular file from `absent,none,-,-,-,-`; and fail if any tracked path lacks an explicit state.
- [x] 0.4 RED-test mixed VCS preservation in a temporary fixture: cover staged, unstaged, untracked, present, absent, space-containing, and newline-containing paths; preserve every index stage/mode/OID; collapse status differences only beneath untracked `.codegraph/**` (read-only) and `.opencode-runtime/**` (read-only); and prove tracked paths never receive the tool-runtime exception.
- [x] 0.5 RED-test bounded subprocess handling in the temporary root: inject timeout, signal, and nonzero exit at every command-matrix boundary; require progression to stop, retain the failing receipt, clean only exact post-preflight container IDs, and require an unchanged complete rerun rather than a partial substitute.
- [x] 0.6 RED-test all four publication interruption points in the temporary root: retain candidates and preimages, require ACTIVE-equivalent authority to remain last, detect every partial state, restore all four preimages rather than only replaced files, fsync recovery, and prove the Week 04 sentinel is absent after rollback. Hash-receipt these probes for S1 evidence; create no repository test or product file.

### Gate 0 Exact Bootstrap Commands

Run this bootstrap block as one shell process from the repository root with a 120,000 ms outer timeout:

```bash
repo_root="$(git rev-parse --show-toplevel)"
test "$PWD" = "$repo_root"
test -d /tmp/opencode
test -z "$(docker ps -aq --filter 'name=^actravel-')"
closure_tmp="$(mktemp -d /tmp/opencode/actravel-week-03-closure-XXXXXX)"
chmod 0700 "$closure_tmp"
git rev-parse HEAD > "$closure_tmp/head"
git status --porcelain=v2 -z --untracked-files=all > "$closure_tmp/status-before.nul"
git ls-files --stage -z > "$closure_tmp/index-before.nul"
git ls-files --cached -z > "$closure_tmp/tracked-before.nul"
git ls-files --others --exclude-standard -z > "$closure_tmp/untracked-before.nul"
```

Create mirrored preimage directories beneath `$closure_tmp/preimages/`; copy with `cp --preserve=mode,timestamps --`; record byte lengths and `sha256sum` for these exact source/destination pairs and for `$closure_tmp/next-env.d.ts.before`:

- `docs/implementation/weeks/week-03-tasks-my-day.md` → `$closure_tmp/preimages/docs/implementation/weeks/week-03-tasks-my-day.md`
- `docs/implementation/ACTIVE.md` → `$closure_tmp/preimages/docs/implementation/ACTIVE.md`
- `docs/PROGRESS.md` → `$closure_tmp/preimages/docs/PROGRESS.md`
- `docs/DECISIONS.md` → `$closure_tmp/preimages/docs/DECISIONS.md`
- `next-env.d.ts` → `$closure_tmp/next-env.d.ts.before`

## S1: Evidence and Candidate-Only Preparation

**Hard dependency:** Gate 0 must pass. S1 must leave all four authoritative living documents byte-for-byte at their Gate 0 hashes. S1 PASS means only **verified candidates awaiting publication**; Week 03 remains locally open and Week 04 remains non-authoritative.

- [x] 1.1 Create `openspec/changes/week-03-final-closure-reconciliation/evidence/preservation-baseline.nul` with raw-byte-sorted NUL fields for every tracked/untracked path, explicit `present`/`absent` state, type/mode/length/hash or symlink target, and every index stage/mode/OID; seal the manifest and raw Git receipts in `openspec/changes/week-03-final-closure-reconciliation/apply-progress.md`.
- [x] 1.2 Reconcile the exact ten dated Week 03 archive directories and former active-path absence, completed task ledgers, requirement/scenario receipts, terminal `PASS` or `PASS WITH WARNINGS`, and zero unresolved blocker/critical findings; record the source-attributed qualifications without rewriting archive bytes in `openspec/changes/week-03-final-closure-reconciliation/apply-progress.md`.
- [x] 1.3 Reconcile all nineteen canonical specifications, including later complete-block composition and the `tasks-foundation` amendments, without summing overlapping packet counts; inspect and hash-seal the current supported/unsupported `/admin/dashboard` route sources and fail rather than edit product/tests if current behavior contradicts the archive.
- [x] 1.4 Run the exact command matrix below serially against unchanged executable inputs; retain complete stdout/stderr, exit status, elapsed time, environment, expected/actual counts, skip counts, retry disclosure, and receipt hashes in `openspec/changes/week-03-final-closure-reconciliation/apply-progress.md`.
- [x] 1.5 Restore `next-env.d.ts` byte-for-byte after build when needed, repeat both protected hash checks, compare phase-equivalent manifests/raw status/index receipts, run tracked/staged/path-scoped diff hygiene, and prove zero `actravel-*` containers while retaining only the temporary baseline/candidates needed by S2.
- [x] 1.6 Write exact candidates at `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/implementation/weeks/week-03-tasks-my-day.md`, `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/implementation/ACTIVE.md`, `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/PROGRESS.md`, and `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/DECISIONS.md`; preserve all qualifications/non-claims, state only local closure, and route only to bounded Week 04 `customer-identity-foundation` planning.
- [x] 1.7 Create `openspec/changes/week-03-final-closure-reconciliation/evidence/s1-seal.nul` binding schema version, HEAD, preservation-manifest hash, `apply-progress.md` (read-only) hash, S1 task-ledger hash, command-receipt hashes, each candidate destination/byte length/SHA-256, and S1 line/byte totals; fail closed above any per-path, 400-line, or byte ceiling.
- [x] 1.8 From a fresh process independent of the S1 author, rehash every bound input and verify 13/13 requirements and 46/46 scenarios against candidate—not authoritative—bytes; write only `openspec/changes/week-03-final-closure-reconciliation/evidence/s1-verification.md` with `PASS` or `FAIL` tied to exact hashes. Any evidence/candidate change invalidates PASS and returns to S1; S2 is prohibited without independent `PASS`.

### S1 Present/Absent Manifest Contract

Each `preservation-baseline.nul` row ends in NUL and contains:

```text
path, tracked|untracked, owned-s1|owned-s2|non-owned|tool-runtime, present|absent,
regular|symlink|other|none, mode|-, byte-length|-, sha256|-, symlink-target|-,
index-stage-count, repeated(stage,mode,oid)
```

Build the inventory from the union of `git ls-files --cached -z` and `git ls-files --others --exclude-standard -z`; enumerate index-known tracked paths even when `lstat` returns `ENOENT`. The current baseline must include these tracked non-owned paths as explicit absent rows, plus any additional absence observed while sealing:

- `openspec/changes/week-03-followup-task-approved-plan-apply/design.md`
- `openspec/changes/week-03-followup-task-approved-plan-apply/exploration.md`
- `openspec/changes/week-03-followup-task-approved-plan-apply/proposal.md`
- `openspec/changes/week-03-followup-task-approved-plan-apply/specs/follow-up-task-approved-plan-apply/spec.md`

### S1 Exact Read-Only Inputs

Archive directories:

- `openspec/changes/archive/2026-09-01-week-03-followups-to-tasks/`
- `openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-backfill/`
- `openspec/changes/archive/2026-09-04-week-03-followups-to-tasks-preview-reader/`
- `openspec/changes/archive/2026-09-06-week-03-postgres-integration-harness/`
- `openspec/changes/archive/2026-09-08-week-03-followup-task-approval-ledger/`
- `openspec/changes/archive/2026-09-13-week-03-followup-task-approved-plan-apply/`
- `openspec/changes/archive/2026-09-14-week-03-followups-to-tasks-cutover/`
- `openspec/changes/archive/2026-09-24-week-03-task-automation-and-action-audit/`
- `openspec/changes/archive/2026-09-28-week-03-task-automation-historical-bootstrap/`
- `openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/`

Canonical specifications:

- `openspec/specs/follow-up-task-representation/spec.md`
- `openspec/specs/follow-up-backfill-preview/spec.md`
- `openspec/specs/follow-up-backfill-preview-reader/spec.md`
- `openspec/specs/postgres-integration-harness/spec.md`
- `openspec/specs/follow-up-task-approval-ledger/spec.md`
- `openspec/specs/follow-up-task-approved-plan-apply/spec.md`
- `openspec/specs/follow-up-task-disposition-readiness/spec.md`
- `openspec/specs/follow-up-task-future-write/spec.md`
- `openspec/specs/follow-up-task-read-contracts/spec.md`
- `openspec/specs/follow-up-task-application-cutover/spec.md`
- `openspec/specs/task-action-audit/spec.md`
- `openspec/specs/task-automation-foundation/spec.md`
- `openspec/specs/task-source-automation/spec.md`
- `openspec/specs/task-automation-historical-classification/spec.md`
- `openspec/specs/task-automation-historical-preview/spec.md`
- `openspec/specs/task-automation-historical-approval/spec.md`
- `openspec/specs/task-automation-historical-apply/spec.md`
- `openspec/specs/role-aware-mi-dia/spec.md`
- `openspec/specs/tasks-foundation/spec.md`

Current route readback:

- `lib/admin/mi-dia-scope.ts`
- `lib/admin/page-compositions.ts`
- `app/admin/(protected)/dashboard/actions.ts`
- `lib/admin/task-actions.ts`
- `components/admin/admin-nav.ts`
- `components/admin/admin-shell-client.tsx`

### S1 Exact Serial Command Matrix

All commands run as separate processes from the resolved repository root. Timeout is the outer wall timeout and does not alter command arguments.

| Order | Exact command | Environment | Timeout | Required result |
|---:|---|---|---:|---|
| 1 | `sha256sum -c openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/0061-0088.sha256` | inherited | 120,000 ms | 28/28 OK |
| 2 | `printf '%s  %s\n' '8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc' 'db/migrations/0089_mi_dia_read_contract.sql' \| sha256sum -c -` | inherited | 120,000 ms | 1/1 OK |
| 3 | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-*.test.ts tests/task-actions-*.test.ts tests/task-automation-*.test.ts tests/task-source-*.test.ts` | `RUN_TASK_AUTOMATION_DB_TESTS=1 RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1` | 2,700,000 ms | 97/97; zero fail/cancel/skip/todo |
| 4 | `test -z "$(docker ps -aq --filter 'name=^actravel-')"` | inherited | 120,000 ms | zero IDs |
| 5 | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/tasks-*.test.ts tests/follow-up-task-*.test.ts tests/crm-contact-*-task-read-runtime.test.ts tests/lead-events-append-only-runtime.test.ts` | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1` | 2,700,000 ms | 81/81; zero fail/cancel/skip/todo |
| 6 | `test -z "$(docker ps -aq --filter 'name=^actravel-')"` | inherited | 120,000 ms | zero IDs |
| 7 | `npx tsc --noEmit` | inherited | 600,000 ms | exit 0; no diagnostics |
| 8 | `npm run lint` | inherited | 600,000 ms | exit 0; no findings |
| 9 | `npm run build` | inherited | 1,200,000 ms | exit 0; 96/96 pages |
| 10 | Exact `next-env.d.ts` restore/compare block below | inherited | 120,000 ms | byte-identical |
| 11 | Repeat orders 1 and 2 unchanged | unchanged | 120,000 ms each | 28/28 and 1/1 OK |
| 12 | `git diff --check && git diff --cached --check` | inherited | 120,000 ms | exit 0 |
| 13 | `test -z "$(docker ps -aq --filter 'name=^actravel-')"` | inherited | 120,000 ms | zero IDs |

The pipe in order 2 is shell syntax, not a literal backslash. Capture before execution and restore only `next-env.d.ts` after build:

```bash
cp --preserve=mode,timestamps -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"
if ! cmp -s -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"; then
  cp -- "$closure_tmp/next-env.d.ts.before" next-env.d.ts
fi
cmp -s -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"
sha256sum -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"
```

## S2: Atomic Publication, Verification, Rollback, and Terminal Cleanup

**Hard dependency:** start S2 only when `evidence/s1-verification.md` contains an independent `PASS` for the unchanged `evidence/s1-seal.nul` hashes. Revalidate the seal immediately before publication. S2 must not rerun, alter, or repair S1 evidence/candidates.

- [x] 2.1 Revalidate the retained four preimages, HEAD/index/raw-status baseline, explicit present/absent manifest, frozen S1 evidence/task hashes, independent S1 PASS, all four candidate byte lengths/SHA-256 values, S1 `<=400` line total, and zero pre-existing `actravel-*` containers; abort without publishing on any mismatch.
- [x] 2.2 Copy—never move—the four passed candidates to mirrored regular non-symlink staging files beneath `openspec/changes/week-03-final-closure-reconciliation/.publication/staging/`; verify mode, byte length, and SHA-256; fsync files and parents; and create `openspec/changes/week-03-final-closure-reconciliation/.publication/journal.nul` naming exactly four destination/candidate/preimage hashes with state `planned`.
- [x] 2.3 Publish with same-filesystem atomic `rename(2)` and fsync each destination parent in this exact order: `docs/implementation/weeks/week-03-tasks-my-day.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, then `docs/implementation/ACTIVE.md` last. Append/fsync one journal transition after each replacement and never treat a partial state as success.
- [x] 2.4 Prove all four authoritative files are byte-for-byte identical to their independently passed candidates using byte length, SHA-256, and `cmp`; compare preservation/index/raw-status receipts; prove every non-owned present/absent state is unchanged; and record the immutable journal/hash/publication receipt in `openspec/changes/week-03-final-closure-reconciliation/evidence/s2-publication.md`.
- [x] 2.5 From a fresh process independent of the publisher, rehash the S1 seal/report, all four published files, preservation/index state, journal receipt, task/evidence retention, exclusions, and route wording; verify 13/13 requirements and 46/46 scenarios and write `openspec/changes/week-03-final-closure-reconciliation/verify-report.md` with the complete Result Contract.
- [x] 2.6 On any S2 preflight, replacement, exact-match, preservation, budget, or independent-verifier failure, restore all four destinations from retained pre-S1 bytes as one rollback even when none or only some were replaced; fsync, verify four lengths/hashes, Week 03 route authority, index/staged state, explicit absent rows, and non-owned state; retain S1/S2 evidence/tasks and record `FAIL — Week 03 remains locally open`. If rollback proof fails, prohibit cleanup and require manual local recovery.
- [x] 2.7 Only after independent publication PASS or verified four-file rollback, remove publication staging/journal working copies, all four candidate working files, the retained preimage/baseline temporary root, and exact captured runtime resources; prove the exact Gate 0 temporary-root pattern, candidate mirrors, closure-owned temporary artifacts, and `actravel-*` containers are absent in `openspec/changes/week-03-final-closure-reconciliation/evidence/terminal-cleanup.md` while retaining durable manifests, hashes, evidence, journal receipt, tasks, and verifier/failure reports.
- [x] 2.8 Re-run final tracked/staged/path-scoped diff and budget accounting; prove S2 `<=400`, the owned delta is only the change packet plus the four living documents on PASS (or change packet plus verified restored preimages on FAIL), no archive/canonical/product/schema/migration/generated-type/fixture/test/Git-index/remote mutation occurred, and all Result Contract counts are explicit rather than inferred.

### S2 Journal and Recovery Contract

- Journal states are `planned`, one state for each ordered replacement, `published`, independent verification result, and `rolled-back` when applicable; every transition is NUL-delimited and fsynced.
- Candidate files and preimages remain separate and retained until the terminal decision. The journal is recovery authority, not permission to accept partial publication.
- Any interruption or ambiguous journal/destination combination is failure. Restore all four preimages, not only destinations known to have changed.
- `ACTIVE.md` is always last during publication; Week 04 planning is not authoritative until all four hashes and the independent S2 verifier pass.
- S1 evidence and completed S1 task rows are immutable in S2. Rollback applies only to the four living documents, never to durable evidence or unrelated work.

## Result Contract

```yaml
verdict: PASS — Week 03 closed locally
requirements: 13/13
scenarios: 46/46
archives: 10/10
canonical_specifications: 19/19
aggregate_tests: 97/97
preservation_tests: 81/81
test_skips: 0
typescript: pass
lint: pass
build_pages: 96/96
protected_manifest: 28/28
migration_0089_hash: 8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc
non_owned_tracked_states_preserved: true
explicit_absent_rows_preserved: true
unexpected_non_owned_drift: 0
s1_changed_text_lines: <=400
s1_independent_verdict: PASS
published_candidate_hashes: 4/4
s2_changed_text_lines: <=400
s2_independent_verdict: PASS
rollback_preimages_retained_until_terminal: true
verification_containers_remaining: 0
temporary_candidates_and_baselines_remaining: 0
remote_parity: unknown
rollout_or_production_readiness: not_claimed
next_route: bounded Week 04 customer-identity-foundation planning
```

Any false, missing, altered, skipped, unrun, unexplained, over-budget, prematurely cleaned, or unauthorized condition returns `FAIL — Week 03 remains locally open`. S1 PASS alone never satisfies this result. A failed S2 must end with all four verified preimages restored, Week 03 authoritative, S1/S2 durable evidence retained, and terminal cleanup performed only after rollback proof.
