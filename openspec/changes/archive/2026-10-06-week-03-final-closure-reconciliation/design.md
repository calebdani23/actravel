# Design: Week 03 Final Closure Reconciliation

## Technical Approach

Implement the closure as exactly two passive, local-only slices, each capped at 400 changed text lines under the accounting contract below. Neither slice may edit product code, schema, migrations, generated types, fixtures, tests, canonical specifications, archives, Git index/history, or a remote system.

S1 owns only candidate living-document bytes and durable evidence beneath `openspec/changes/week-03-final-closure-reconciliation/`. It seals the mixed-worktree baseline, including an explicit `present` or `absent` state for every non-owned tracked path in a NUL-delimited manifest; reconciles the exact ten archives, nineteen canonical specifications, qualifications, and current route; runs the unchanged 97-test and 81-test aggregates plus TypeScript, lint, build, hash, restoration, diff, and runtime-cleanup gates; and writes hash-sealed candidates for the four living documents. S1 must not edit an authoritative living document or make Week 04 authoritative. A fresh process independent of the S1 author must return `PASS` against the exact S1 evidence and candidate hashes before S2 can start.

S2 revalidates the unchanged S1 seal and retained pre-S1 baseline, transactionally publishes all four living documents from the passed candidates, proves all four published hashes match, and obtains fresh independent post-publication verification. Any S2 failure—including interruption recovery, a hash mismatch, partial replacement, preservation drift, or verifier failure—restores all four living documents from retained preimages and proves the rollback. S1 evidence and the task ledger are never rolled back. Candidate working bytes and the baseline remain available through publication PASS or verified rollback; terminal cleanup starts only afterward.

The 13-requirement/46-scenario specification remains conjunctive. S1 PASS means only “verified candidates awaiting publication”; Week 03 remains locally open until S2 publication and independent verification pass.

## Architecture Decisions

### Decision: Split evidence/candidate preparation from authoritative publication

**Choice**: Use S1 for evidence and exact candidate bytes only, then S2 for four-document publication, independent verification, rollback, and terminal cleanup.

**Alternatives considered**: One slice that edits the living documents before independent review; publishing `ACTIVE.md` as soon as tests pass; rerunning product work in S2.

**Rationale**: The corrected proposal requires an independent decision over exact candidate bytes before the Week 04 route can become authoritative. Separation also gives S2 a fixed, hash-addressed input and prevents a passing test run from masking premature documentation publication.

### Decision: Represent absence as data in a sealed NUL manifest

**Choice**: Build the preservation inventory from the union of `git ls-files --cached -z` and `git ls-files --others --exclude-standard -z`. Every non-owned tracked path receives an explicit `present` or `absent` row. An absent row has no content hash and is distinct from a present zero-byte file.

**Alternatives considered**: Hashing only files found by a filesystem walk; omitting deleted worktree paths; representing absence with the SHA-256 of empty bytes; relying only on porcelain status text.

**Rationale**: Index-known paths can be absent from the worktree. The current baseline specifically has these tracked non-owned paths absent:

- `openspec/changes/week-03-followup-task-approved-plan-apply/design.md`
- `openspec/changes/week-03-followup-task-approved-plan-apply/exploration.md`
- `openspec/changes/week-03-followup-task-approved-plan-apply/proposal.md`
- `openspec/changes/week-03-followup-task-approved-plan-apply/specs/follow-up-task-approved-plan-apply/spec.md`

Omission or empty-file substitution would lose this mixed-state distinction and could falsely report preservation.

### Decision: Use terminal-state atomic publication with a durable journal

**Choice**: Copy each passed candidate to a publish staging file beneath the change root, verify its length/hash, and replace the four destinations with same-filesystem atomic `rename(2)` operations in this order: Week 03 brief, `PROGRESS.md`, `DECISIONS.md`, and `ACTIVE.md` last. A fsynced NUL journal records `planned`, each replacement, `published`, verification, or rollback. No successful terminal state exists until all four match and the independent verifier passes.

**Alternatives considered**: Four direct writes; moving the only candidate copies; a Git commit/index transaction; replacing the entire `docs/` tree; claiming POSIX offers one cross-directory four-file rename.

**Rationale**: POSIX has no single atomic rename spanning four files. A retained candidate set, exact preimages, durable journal, `ACTIVE.md`-last ordering, and mandatory recovery provide fail-closed all-or-nothing terminal semantics without staging Git state or taking ownership of the whole documentation tree. A detected or recovered partial state is always failure and restores all four preimages before cleanup.

### Decision: Keep S1 evidence immutable after its independent PASS

**Choice**: S1 writes `apply-progress.md`, the two sealed NUL manifests, candidates, and `evidence/s1-verification.md`. S2 writes separate publication/final receipts and may advance only the S2 checkboxes in `tasks.md`; it never rewrites S1 evidence.

**Alternatives considered**: Append S2 receipts to the hash-sealed S1 evidence; regenerate candidates after review; delete failure evidence during rollback.

**Rationale**: An independent PASS is meaningful only while its exact inputs remain addressable. Separate receipts preserve the evidence chain and let S2 rollback authoritative documents without erasing tasks, failures, or S1 results.

### Decision: Reuse unchanged serial verification commands

**Choice**: Run the 97-test aggregate before the 81-test preservation aggregate with their exact environments and 2,700,000 ms outer timeouts, then TypeScript, lint, and build. Run protected hashes before execution and after build/restoration.

**Alternatives considered**: Parallel suites; partial/focused substitutions; edited commands; archived evidence only; unbounded execution.

**Rationale**: The specification requires fresh unchanged evidence, and prior runtimes need bounded headroom. Serial execution avoids shared Docker/PostgreSQL contention. Any retry remains disclosed and must be followed by the identical complete command.

### Decision: Count authored deltas once and temporary mirrors separately

**Choice**: Each slice has a hard 400 changed-text-line cap. A candidate mirror is compared to its corresponding sealed living-document preimage, so unchanged copied lines are not misreported as authored changes. Publication uses the same preimage-to-published delta. Creation/deletion of exact temporary mirrors is separately byte-bounded and hash-accounted, not counted again as authored text.

**Alternatives considered**: Count every unchanged line in full candidate copies; ignore candidate size; compress or encode candidates merely to evade the cap; move work into product/tests.

**Rationale**: Full `PROGRESS.md` and `DECISIONS.md` candidates necessarily contain substantial unchanged history. Semantic before/after line accounting captures the actual documentation change, while explicit mirror byte caps prevent unbounded temporary state or budget gaming.

## Data Flow

```text
pre-S1 HEAD/index/worktree + four living-doc preimages
                         |
                         v
       sealed NUL preservation manifest (present | absent)
                         |
            archives/canonicals/qualifications/route
                         |
       hashes -> 97 -> cleanup -> 81 -> cleanup
                         |
          tsc -> lint -> build -> restore -> hashes
                         |
             S1 evidence + four exact candidates
                         |
              fresh independent S1 verifier
                   | FAIL              | PASS
                   v                   v
          Week 03 remains open   S1 seal frozen
                                         |
                              S2 preflight revalidation
                                         |
                          journaled four-file publication
                                         |
                              independent S2 verification
                              | failure          | PASS
                              v                  v
                   restore all four preimages   local closure
                              |                  |
                       prove rollback      prove four hashes
                              +---------+--------+
                                        |
                        terminal-only temporary cleanup
```

## Exact Reconciliation Inputs

### Ten immutable archives

| Archive | Requirements / scenarios | Tasks | Terminal contract |
|---|---:|---:|---|
| `2026-09-01-week-03-followups-to-tasks` | 9 / 18 | 9/9 | PASS |
| `2026-09-04-week-03-followups-to-tasks-backfill` | 5 / 0 | 12/12 | PASS with structural warning |
| `2026-09-04-week-03-followups-to-tasks-preview-reader` | 11 / 18 | 10/10 | PASS with advisories |
| `2026-09-06-week-03-postgres-integration-harness` | 4 / 5 | 8/8 | PASS with advisories |
| `2026-09-08-week-03-followup-task-approval-ledger` | 7 / 7 | 12/12 | PASS under recorded compatibility interpretation |
| `2026-09-13-week-03-followup-task-approved-plan-apply` | 12 / 12 | 23/23 | PASS WITH WARNINGS |
| `2026-09-14-week-03-followups-to-tasks-cutover` | 24 / 24 | 14/14 | PASS |
| `2026-09-24-week-03-task-automation-and-action-audit` | 22 / 31 | 14/14 | PASS |
| `2026-09-28-week-03-task-automation-historical-bootstrap` | 34 / 62 | 19/19 | PASS; Docker incident resolved by unchanged rerun |
| `2026-10-06-week-03-role-aware-mi-dia` | 21 / 81 | 11/11 | PASS; zero unresolved findings |

For each row, `openspec/changes/archive/<archive>/` exists, the former active source is absent, `tasks.md` is complete, and `verify-report.md` plus `archive-report.md` support the terminal contract with no unresolved blocker/critical finding. All archive bytes are read-only.

### Nineteen canonical specifications

The fixed set is `follow-up-task-representation`, `follow-up-backfill-preview`, `follow-up-backfill-preview-reader`, `postgres-integration-harness`, `follow-up-task-approval-ledger`, `follow-up-task-approved-plan-apply`, `follow-up-task-disposition-readiness`, `follow-up-task-future-write`, `follow-up-task-read-contracts`, `follow-up-task-application-cutover`, `task-action-audit`, `task-automation-foundation`, `task-source-automation`, `task-automation-historical-classification`, `task-automation-historical-preview`, `task-automation-historical-approval`, `task-automation-historical-apply`, `role-aware-mi-dia`, and the composed `tasks-foundation`.

Every path is `openspec/specs/<name>/spec.md`. The evidence records lineage and later complete-block composition, including Mi día's three-requirement/seven-scenario amendment to `follow-up-task-application-cutover`; packet-local counts are never summed as deduplicated Week 03 coverage.

### Qualification ledger

The final candidates and evidence retain: classifier zero scenario headings and corrected failed-verification history; preview-reader operational/readability and baseline-only aggregate advisories; PostgreSQL-helper advisories; approval-ledger unmanaged-compatibility review interpretation; approved-plan runtime/coverage and corrected finding history; and the historical-bootstrap Docker-readiness incident resolved by an unchanged complete rerun.

## Sealed Baseline and Manifest Contract

The implementation obtains the root with `git rev-parse --show-toplevel`, requires `/tmp/opencode`, and creates exactly one mode-`0700` root matching `/tmp/opencode/actravel-week-03-closure-XXXXXX`. That root contains four exact preimages, raw Git receipts, `next-env.d.ts.before`, helper source/hash, publication recovery state, and no project source edits. It is retained through the S2 terminal decision.

The durable baseline is `openspec/changes/week-03-final-closure-reconciliation/evidence/preservation-baseline.nul`. Each row has these NUL-separated fields and ends with a NUL:

```text
path, tracked|untracked, owned-s1|owned-s2|non-owned|tool-runtime, present|absent,
regular|symlink|other|none, mode|-, byte-length|-, sha256|-, symlink-target|-,
index-stage-count, repeated(stage,mode,oid)
```

Rules:

- sort by raw repository-relative path bytes; preserve spaces and newlines byte-for-byte; reject duplicate, empty, absolute, `..`, out-of-root, directory-owned, device, socket, or followed-symlink entries;
- enumerate tracked paths from the index even when `lstat` returns `ENOENT`;
- write `absent,none,-,-,-,-` for absence; never open it, hash empty bytes, or omit the row;
- include all index stages so staged state is independent from worktree presence;
- record present untracked non-owned files separately with exact type/mode/content or symlink target;
- classify only untracked `.codegraph/**` and `.opencode-runtime/**` as mutable `tool-runtime` namespaces, record each exact exclusion prefix as one marker in the normalized manifest, and exclude internal cache/database bytes from comparison; raw status remains sealed, while status comparison collapses only these exact prefixes; this exception never applies to a tracked path or project source;
- SHA-256 seal the manifest and raw `status --porcelain=v2 -z`, `ls-files --stage -z`, tracked, and untracked receipts;
- compare phase-equivalent manifests before S1 PASS, before S2 publication, after publication, and after rollback when applicable.

The S1 owned set is the candidate/evidence/task paths listed below. The S2 owned set is exactly the four living documents, S2 receipts, allowed S2 task-checkbox updates, publication staging/journal paths, and terminal candidate removal. Every other tracked path—including an absent tracked path—is non-owned and must retain the same state and index entries.

## Exact Commands and Ordering

All commands run from the resolved repository root as separate serial processes. “Timeout” is the outer runner wall timeout and does not alter arguments.

| Order | Exact command | Environment | Timeout | Required result |
|---:|---|---|---:|---|
| 1 | `sha256sum -c openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/0061-0088.sha256` | inherited | 120,000 ms | 28/28 OK |
| 2 | `printf '%s  %s\n' '8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc' 'db/migrations/0089_mi_dia_read_contract.sql' \| sha256sum -c -` | inherited | 120,000 ms | 1/1 OK |
| 3 | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/task-action-*.test.ts tests/task-actions-*.test.ts tests/task-automation-*.test.ts tests/task-source-*.test.ts` | `RUN_TASK_AUTOMATION_DB_TESTS=1 RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS=1` | 2,700,000 ms | 97/97; zero fail/cancel/skip/todo |
| 4 | `test -z "$(docker ps -aq --filter 'name=^actravel-')"` | inherited | 120,000 ms | zero IDs |
| 5 | `node --conditions react-server --import tsx --test --test-concurrency=1 tests/tasks-*.test.ts tests/follow-up-task-*.test.ts tests/crm-contact-*-task-read-runtime.test.ts tests/lead-events-append-only-runtime.test.ts` | `FOLLOW_UP_TASK_CUTOVER_REQUEST_ID=03c07000-0000-4000-8000-000000000001 RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 RUN_FOLLOW_UP_CUTOVER_DB_TESTS=1` | 2,700,000 ms | 81/81; zero fail/cancel/skip/todo |
| 6 | `test -z "$(docker ps -aq --filter 'name=^actravel-')"` | inherited | 120,000 ms | zero IDs |
| 7 | `npx tsc --noEmit` | inherited | 600,000 ms | exit 0, no diagnostics |
| 8 | `npm run lint` | inherited | 600,000 ms | exit 0, no findings |
| 9 | `npm run build` | inherited | 1,200,000 ms | exit 0, 96/96 pages |
| 10 | restore/compare `next-env.d.ts` exactly as below | inherited | 120,000 ms | byte-identical |
| 11 | repeat orders 1 and 2 | unchanged | 120,000 ms each | 28/28 and 1/1 OK |
| 12 | `git diff --check && git diff --cached --check` | inherited | 120,000 ms | exit 0 |
| 13 | `test -z "$(docker ps -aq --filter 'name=^actravel-')"` | inherited | 120,000 ms | zero IDs |

The pipe in order 2 is shell syntax, not a literal escaped character. Capture `next-env.d.ts` before execution and restore only that file after build:

```bash
cp --preserve=mode,timestamps -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"
if ! cmp -s -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"; then
  cp -- "$closure_tmp/next-env.d.ts.before" next-env.d.ts
fi
cmp -s -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"
sha256sum -- next-env.d.ts "$closure_tmp/next-env.d.ts.before"
```

Preflight requires zero `actravel-*` containers. On failure, remove only exact IDs captured after that preflight, never prune broadly, then prove zero. This runtime cleanup is part of S1; it does not authorize removal of the retained baseline/candidates. A disclosed transient retains its failed receipt and requires the identical complete command to rerun.

Current route readback is hash-sealed and inspection-only at `lib/admin/mi-dia-scope.ts`, `lib/admin/page-compositions.ts`, `app/admin/(protected)/dashboard/actions.ts`, `lib/admin/task-actions.ts`, `components/admin/admin-nav.ts`, and `components/admin/admin-shell-client.tsx`. A contradiction fails S1; no product/test correction is allowed.

## File Changes and Ownership

| Path | Slice | Action / contract |
|---|---|---|
| `openspec/changes/week-03-final-closure-reconciliation/apply-progress.md` | S1 | Create immutable reconciliation and command evidence. |
| `openspec/changes/week-03-final-closure-reconciliation/tasks.md` | S1/S2 | Create the two-slice ledger; S2 may only advance its own rows and must preserve S1 rows. |
| `openspec/changes/week-03-final-closure-reconciliation/evidence/preservation-baseline.nul` | S1 | Create durable present/absent/index baseline. |
| `openspec/changes/week-03-final-closure-reconciliation/evidence/s1-seal.nul` | S1 | Create candidate/evidence byte length and SHA-256 seal. |
| `openspec/changes/week-03-final-closure-reconciliation/evidence/s1-verification.md` | S1 verifier | Fresh independent verdict bound to exact S1 hashes. |
| `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/implementation/weeks/week-03-tasks-my-day.md` | S1; cleanup S2 | Exact temporary candidate. |
| `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/implementation/ACTIVE.md` | S1; cleanup S2 | Exact temporary candidate; not authoritative in S1. |
| `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/PROGRESS.md` | S1; cleanup S2 | Exact temporary candidate. |
| `openspec/changes/week-03-final-closure-reconciliation/candidates/docs/DECISIONS.md` | S1; cleanup S2 | Exact temporary candidate. |
| `docs/implementation/weeks/week-03-tasks-my-day.md` | S2 only | Publish exact passed candidate. |
| `docs/implementation/ACTIVE.md` | S2 only, last | Publish exact passed candidate and bounded Week 04 planning route. |
| `docs/PROGRESS.md` | S2 only | Publish exact passed candidate. |
| `docs/DECISIONS.md` | S2 only | Publish exact passed candidate. |
| `openspec/changes/week-03-final-closure-reconciliation/evidence/s2-publication.md` | S2 | Preserve journal/hash/rollback receipts. |
| `openspec/changes/week-03-final-closure-reconciliation/verify-report.md` | S2 verifier | Independent publication PASS or failure plus verified rollback. |
| `openspec/changes/week-03-final-closure-reconciliation/evidence/terminal-cleanup.md` | S2 | Prove cleanup occurred only after PASS/rollback. |

Existing `proposal.md`, `design.md`, `exploration.md`, `specs/**`, all archives/canonical specs, and every product/schema/test path are read-only during S1/S2.

## Slice Budgets

Changed lines are additions plus deletions against the sealed corresponding preimage, with `git diff --no-index --no-renames --numstat -z`. Exit 0 or diff exit 1 is accepted; binary `-`, rename inference, unknown paths, or a ceiling breach fails. Candidate and published deltas are each compared to the same pre-S1 living-document preimage. Temporary mirror cleanup is byte-accounted and cannot hide an authored delta.

### S1 — evidence and candidate verification

| Accounted path/content | Maximum changed text lines |
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

### S2 — publication, independent verification, and terminal receipts

| Accounted path/content | Maximum changed text lines |
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

The four candidate mirrors together are capped at 2 MiB, all durable NUL receipts per slice at 8 MiB, and the validated temporary root at 32 MiB. These byte caps supplement rather than replace line accounting. A breach stops the slice; work may not move into product/tests, omit qualifications, compress candidates, or broaden ownership to fit.

## Interfaces / Contracts

### S1 seal

`evidence/s1-seal.nul` binds schema version, HEAD, preservation-manifest hash, `apply-progress.md` hash, S1 task-ledger hash, each candidate repository-relative destination, candidate byte length/hash, exact command-receipt hashes, and S1 line/byte totals. Any bound-byte change invalidates `evidence/s1-verification.md` and requires a complete fresh S1 verification; changed executable inputs require the complete S1 command gate to rerun.

### Publication transaction

S2 verifies the retained preimages, baseline manifest, S1 report, and all candidate hashes before writing. Publish staging remains under the change root and candidates are copied, never moved. The journal names exactly four destination/candidate/preimage hashes. Every replacement uses a regular-file, no-symlink, same-device precondition and parent-directory fsync. `ACTIVE.md` is replaced last.

On any S2 failure, recovery replaces all four destinations—not only changed ones—from the retained exact preimages, fsyncs them, verifies four byte lengths/hashes, rechecks the Week 03 route and preservation manifest, and records failure. S1 evidence/tasks remain. If rollback proof fails, cleanup is prohibited and the result remains a blocking failure requiring manual local recovery.

### Independent verification

- S1 verifier: fresh process, independent of the S1 author, rehashes all bound inputs, checks 13/13 requirements and 46/46 scenarios against candidate—not authoritative—bytes, and returns PASS or FAIL.
- S2 verifier: fresh process independent of the publisher, rehashes the S1 seal/report, four published files, preservation/index state, publication journal, exclusions, and task/evidence retention. It returns publication PASS or failure with verified four-file rollback.
- A verifier must not repair inputs. Any repair returns control to the responsible slice and invalidates the prior verdict.

### Result Contract

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

Any false, missing, altered, skipped, unrun, unexplained, over-budget, prematurely cleaned, or unauthorized condition returns `FAIL — Week 03 remains locally open`. S1 PASS alone never satisfies this result. If S2 fails, the required terminal state is four verified preimages restored, S1/S2 evidence and tasks retained, temporary cleanup completed only after rollback proof, and the Week 03 route authoritative.

## Testing Strategy

| Layer | What to verify | Approach |
|---|---|---|
| Structural | Ten archives, absent active packets, tasks/verdicts, nineteen canonicals, composition, qualifications | Exact read-only matrices against archived and canonical authorities. |
| Route | Supported Mi día and unsupported legacy Dashboard | Read-only source/call-flow inspection and hashes; contradiction fails without correction. |
| Integration | Task action/automation/source/historical composition | Exact serial 97-test command; zero skips. |
| Preservation | Follow-up/Task/CRM/history | Exact serial 81-test command; zero skips. |
| Static/build | Types, lint, 96-page baseline | Exact commands after aggregates. |
| Integrity | Protected migrations, generated file, index/worktree, containers | 28/28, exact `0089`, byte restoration, NUL manifests, zero runtime residue. |
| S1 | Exact candidate/evidence seal and no authoritative edits | Fresh independent 13/46 verification tied to hashes. |
| S2 | Four-file exact publication or complete rollback | Fault-injected temporary transaction probes plus fresh independent final verification. |

## Threat Matrix

| Boundary | Status | Safe/failure behavior | Planned RED evidence |
|---|---|---|---|
| Application routing | N/A — no application route change | Current route is inspected only; contradiction fails S1. The Week 04 route is documentation planning only. | No new routing test; archived evidence and current readback remain authorities. |
| Shell command construction | Applicable | Fixed literals, NUL path handling, root checks, no `eval`, and no input-derived wildcard deletion. Invalid/duplicate/escaping paths fail before access. | Temporary fixture rejects absolute, `..`, duplicate, symlink, and device paths while accepting space- and newline-containing regular paths. |
| Subprocess/process integration | Applicable | Serial bounded commands; timeout/signal/nonzero stops progression and triggers exact-ID runtime cleanup. S2 journal recovery restores all four preimages on any failure. | Temporary probes fail each command boundary and each of four publication steps; sentinel Week 04 authority must remain absent or all four preimages must be restored. |
| VCS/PR automation | Applicable only to read-only local accounting | Only `rev-parse`, `status`, `ls-files`, and `diff` are allowed. No add/restore/checkout/reset/clean/stash/branch/commit/fetch/push/PR. | Mixed-state fixture proves staged/unstaged/untracked/present/absent/space- and newline-containing rows and exact unchanged index OIDs. |
| Executable-file classification | N/A | No file is selected for execution by extension, mode, or content; helper source/hash and command are fixed. | None. |
| Remote process/file transfer | N/A | No endpoint, credential/session discovery, transfer, hosted database, deployment, or remote Git operation. | Command/evidence review contains no remote operation. |

Applicable RED probes exist only under the validated temporary root, create no repository test/product file, are hash-receipted in S1 evidence, and are removed only by terminal cleanup.

## Migration / Rollout

No migration, data migration, feature flag, remote operation, deployment, or rollout is authorized. Existing migrations are read/hash/execute inputs only in local or disposable verification. A future remote or rollout activity requires separate explicit authorization and fresh current-state inspection.

## Rollback and Cleanup

1. **S1 failure**: do not start S2; leave all four living documents and Week 03 route unchanged, restore `next-env.d.ts`, clean only captured runtime resources, retain failure evidence, and then remove S1 temporary candidates/baseline after the failure state is verified.
2. **S2 preflight or publication failure**: restore all four living documents from retained preimages even if none or only some were replaced; preserve every S1/S2 evidence and task path.
3. **S2 verifier failure**: perform the same four-file rollback, verify hashes/route/index/non-owned states, and record `FAIL — Week 03 remains locally open`.
4. **Terminal cleanup**: only after independent publication PASS or verified rollback, remove publication staging/journal working copies, candidate mirrors, and the validated `/tmp/opencode/actravel-week-03-closure-*` root; prove absence. Durable manifests, hashes, evidence, tasks, and verifier receipts remain.
5. **Never rollback unrelated state**: do not rewrite archives, canonical specs, product/tests, migrations, Git state/history, non-owned present/absent paths, or a remote environment.

## Open Questions

None. The corrected proposal, 13/46 specification, current repository state, and this two-slice transaction contract define the implementation boundary.
