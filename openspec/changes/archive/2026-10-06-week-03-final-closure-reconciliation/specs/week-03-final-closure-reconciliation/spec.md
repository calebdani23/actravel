# Week 03 Final Closure Reconciliation Specification

## Purpose

Define the passive, local-only evidence and documentation contract for reconciling the ten completed Week 03 archives, their promoted or composed canonical capabilities, preserved qualifications, current role-aware Mi día route, and final milestone handoff. This capability records closure only after fresh unchanged local evidence passes; it does not modify product behavior or establish remote parity, rollout, or production readiness.

## Requirements

### Requirement: Exact ten-archive inventory and terminal completion

The closure record MUST inventory exactly these ten Week 03 archive packets and MUST identify each by its dated archive directory, archived outcome, requirement/scenario receipt, completed task ledger, and terminal verification status:

| Archive directory | Archived outcome | Requirement/scenario receipt | Required task receipt |
|---|---|---:|---:|
| `2026-09-01-week-03-followups-to-tasks` | Follow-up Task representation | 9 / 18 | 9/9 |
| `2026-09-04-week-03-followups-to-tasks-backfill` | Classifier/backfill preview | 5 / 0 | 12/12 |
| `2026-09-04-week-03-followups-to-tasks-preview-reader` | Preview reader | 11 / 18 | 10/10 |
| `2026-09-06-week-03-postgres-integration-harness` | PostgreSQL helper | 4 / 5 | 8/8 |
| `2026-09-08-week-03-followup-task-approval-ledger` | Approval ledger | 7 / 7 | 12/12 |
| `2026-09-13-week-03-followup-task-approved-plan-apply` | Approved-plan apply | 12 / 12 | 23/23 |
| `2026-09-14-week-03-followups-to-tasks-cutover` | Follow-ups-to-Tasks cutover | 24 / 24 | 14/14 |
| `2026-09-24-week-03-task-automation-and-action-audit` | Task automation and action audit | 22 / 31 | 14/14 |
| `2026-09-28-week-03-task-automation-historical-bootstrap` | Historical automation bootstrap | 34 / 62 | 19/19 |
| `2026-10-06-week-03-role-aware-mi-dia` | Role-aware Mi día | 21 / 81 | 11/11 |

Every archive directory MUST exist, its former active source directory MUST be absent, every task ledger MUST be complete, and every terminal verdict MUST be `PASS` or `PASS WITH WARNINGS` with zero unresolved blocker or critical finding. The closure MUST NOT rewrite an archive, task ledger, verification report, archive report, failed-attempt record, or terminal verdict.

#### Scenario: All ten archive packets reconcile

- GIVEN all ten named dated archive directories exist and their former active source directories are absent
- WHEN the archive inventory is compared with each packet's task and terminal verification records
- THEN all ten outcomes have the exact recorded requirement/scenario and completed-task receipts
- AND every terminal verdict is `PASS` or `PASS WITH WARNINGS` with zero unresolved blocker or critical finding

#### Scenario: An archive or completion receipt is missing

- GIVEN a named archive directory is missing, a former active source directory remains, or a task ledger or terminal verdict is incomplete
- WHEN local closure is assessed
- THEN Week 03 remains locally open
- AND no living document may claim closure or route the active cycle to Week 04

#### Scenario: Historical archive bytes remain immutable

- GIVEN the archive inventory has been reconciled
- WHEN the closure packet and living-document delta are reviewed
- THEN the ten historical packets remain unchanged
- AND the closure evidence references rather than normalizes or rewrites their records

### Requirement: Canonical capability presence and composition

The closure record MUST verify the presence of `follow-up-task-representation`, `follow-up-backfill-preview`, `follow-up-backfill-preview-reader`, `postgres-integration-harness`, `follow-up-task-approval-ledger`, `follow-up-task-approved-plan-apply`, `follow-up-task-disposition-readiness`, `follow-up-task-future-write`, `follow-up-task-read-contracts`, `follow-up-task-application-cutover`, `task-action-audit`, `task-automation-foundation`, `task-source-automation`, `task-automation-historical-classification`, `task-automation-historical-preview`, `task-automation-historical-approval`, `task-automation-historical-apply`, and `role-aware-mi-dia`. It MUST also verify the composed Week 03 amendments in `tasks-foundation`.

The record MUST identify later canonical composition and replacement of modified requirement blocks without treating overlapping archive receipts as unique global coverage. It MUST NOT sum the ten packet requirement or scenario counts into a deduplicated Week 03 total.

#### Scenario: Complete canonical set is present

- GIVEN the ten archive outcomes have been inventoried
- WHEN their promotion and composition targets are compared with the canonical specification tree
- THEN every named canonical capability exists
- AND the composed Week 03 amendments are present in `tasks-foundation`

#### Scenario: Later composition preserves earlier authority

- GIVEN more than one archived packet contributes to a canonical capability or later replaces a complete modified requirement block
- WHEN the canonical lineage is recorded
- THEN the later composition is identified as the current canonical form
- AND the earlier archive remains immutable provenance rather than a competing current specification

#### Scenario: Missing or incoherent canonical composition fails closure

- GIVEN a named canonical capability is absent, duplicated incompatibly, or does not contain an expected composed amendment
- WHEN local closure is assessed
- THEN Week 03 remains locally open
- AND packet counts are not used to conceal the canonical mismatch

### Requirement: Qualification and incident provenance preservation

The closure record MUST preserve, without upgrading or erasing them, the classifier packet's zero-scenario-heading warning; the preview-reader operational/readability and baseline-only aggregate advisories; the PostgreSQL-helper advisories; the approval-ledger unmanaged-compatibility review qualification; the approved-plan runtime-duration and unavailable-coverage warnings; and the historical-bootstrap Docker-readiness incident that was resolved by an unchanged complete rerun. Preserved non-blocking qualifications MAY coexist with local closure only when their archived terminal verdict remains authoritative and no unresolved blocker or critical finding exists.

#### Scenario: Classifier structural warning remains explicit

- GIVEN the classifier/backfill packet records five requirements and zero scenario headings
- WHEN the final reconciliation matrix is written
- THEN the zero-scenario-heading warning remains explicit
- AND the packet is not restated as if it had conventional scenario coverage

#### Scenario: Preview-reader and helper advisories remain explicit

- GIVEN the preview-reader and PostgreSQL-helper terminal records contain non-blocking advisories
- WHEN their outcomes are summarized
- THEN the operational/readability, baseline-only aggregate, and helper advisories remain attributable to their source packets
- AND they are not collapsed into an unqualified uniform `PASS`

#### Scenario: Review and coverage qualifications remain explicit

- GIVEN the approval-ledger verdict depends on its recorded unmanaged-compatibility review interpretation and approved-plan apply records runtime and unavailable-coverage warnings
- WHEN local closure is reported
- THEN each qualification remains visible with its originating packet
- AND the closure does not claim stronger compatibility or coverage than the archive established

#### Scenario: Resolved Docker incident remains historical provenance

- GIVEN the historical-bootstrap packet records an initial Docker-readiness incident and a later unchanged complete rerun
- WHEN the packet is reconciled
- THEN both the incident and its successful resolution are retained
- AND only the unchanged complete rerun supports the terminal pass

#### Scenario: Omitted or altered qualification fails closure

- GIVEN any required warning, advisory, review qualification, failed attempt, or resolved incident is omitted or materially recharacterized
- WHEN living documents and closure evidence are compared with the archive authorities
- THEN the reconciliation fails
- AND Week 03 remains locally open until provenance is restored accurately

### Requirement: Current role-aware Mi día route reconciliation

The closure MUST verify read-only that current `/admin/dashboard` behavior remains consistent with the archived role-aware Mi día capability. Active role unions containing `admin`, `manager`, or `asesor` MUST use the bounded Mi día route, MUST avoid the legacy fetch-all follow-up queue, and MUST mutate Tasks only through the canonical audited Task action. Active role unions containing only `operaciones`, `finanzas`, or `marketing` MUST retain the legacy Dashboard and `Resumen` presentation without invoking Mi día. The Home route MUST remain `/admin/dashboard`, with `Mi día` labeling only for supported role unions. This reconciliation MUST NOT authorize a product correction.

#### Scenario: Supported role unions retain Mi día

- GIVEN a current active Admin, Manager, or Asesor role union
- WHEN the Dashboard route, navigation, read boundary, and action boundary are inspected
- THEN `/admin/dashboard` presents bounded Mi día before preserved non-Task content
- AND the legacy fetch-all follow-up queue is not its work source
- AND Task mutations use the canonical audited action boundary

#### Scenario: Other staff roles retain Dashboard

- GIVEN a current active role union containing only Operations, Finance, or Marketing
- WHEN `/admin/dashboard` and the Home navigation item are inspected
- THEN the legacy Dashboard behavior remains available without a Mi día read or action setup
- AND the Home label remains `Resumen` at `/admin/dashboard`

#### Scenario: Current behavior contradicts the archived route

- GIVEN current route evidence differs from the archived supported-role or unsupported-role behavior
- WHEN local closure is assessed
- THEN Week 03 remains locally open
- AND this passive change MUST NOT edit product, schema, migration, generated-type, fixture, or test files to make the documentation true

### Requirement: Fresh unchanged aggregate and preservation evidence

The closure MUST run the existing action/automation/source/historical aggregate and the existing follow-up/Task/CRM preservation aggregate serially, unchanged, and with sufficient timeout against local or disposable infrastructure. The first aggregate MUST pass exactly 97/97 tests with zero skips, and the second MUST pass exactly 81/81 tests with zero skips. A retry MAY occur only when its cause is disclosed and an unchanged complete rerun of the affected command subsequently passes; partial reruns or altered suites MUST NOT satisfy closure.

#### Scenario: Action and automation aggregate passes

- GIVEN the current repository bytes and the unchanged action/automation/source/historical command
- WHEN the aggregate is run to completion
- THEN exactly 97/97 tests pass
- AND zero enabled tests are skipped

#### Scenario: Follow-up and CRM preservation passes

- GIVEN the 97-test aggregate has completed and the unchanged follow-up/Task/CRM preservation command is run serially
- WHEN that aggregate completes
- THEN exactly 81/81 tests pass
- AND zero enabled tests are skipped

#### Scenario: Altered, incomplete, failed, or skipped suite fails closure

- GIVEN a required aggregate is changed, not run, only partially rerun, fails any test, reports an unexpected count, or skips an enabled test
- WHEN local closure is assessed
- THEN the fresh evidence gate fails
- AND archived success MUST NOT substitute for the missing current result

#### Scenario: Transient failure is followed by a complete rerun

- GIVEN a required aggregate encounters a disclosed transient local-infrastructure failure
- WHEN the evidence is retried
- THEN the retry uses the unchanged complete command and expected count
- AND closure proceeds only if that complete rerun passes with zero skips and final cleanup succeeds

### Requirement: TypeScript, lint, and production-build gates

The closure MUST require successful execution of `npx tsc --noEmit`, `npm run lint`, and `npm run build` against unchanged product and test bytes. The production build MUST preserve the current 96/96-page baseline. A static-check error, lint error, build error, missing page, unexpected additional page, or materially different route baseline MUST fail closure unless separately explained and authorized as a new change outside this passive scope.

#### Scenario: TypeScript and lint pass unchanged

- GIVEN the fresh aggregates have passed and no product or test file has been edited by closure
- WHEN TypeScript and lint are run
- THEN both commands exit successfully
- AND no ignored error or warning is reclassified as a pass by changing configuration

#### Scenario: Production build retains the route baseline

- GIVEN static checks pass
- WHEN the production build runs
- THEN the build exits successfully
- AND its route receipt reports the current 96/96-page baseline

#### Scenario: Static or build drift fails closure

- GIVEN TypeScript, lint, or build fails, or the build route count differs unexpectedly from 96/96
- WHEN local closure is assessed
- THEN Week 03 remains locally open
- AND the closure packet MUST NOT modify application or build configuration to force a pass

### Requirement: Protected migration hash verification

The closure MUST validate the archived `0061`–`0088` protected manifest through `openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/0061-0088.sha256` and MUST obtain 28/28 successful checks. It MUST independently prove that current `0089_mi_dia_read_contract.sql` has SHA-256 `8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc`. It MUST NOT recreate the removed active Mi día directory, rewrite a migration, or substitute a new manifest path.

#### Scenario: Archived protected manifest passes

- GIVEN migrations `0061` through `0088` and the dated archived Mi día manifest
- WHEN the manifest is checked from its archive path
- THEN all 28/28 entries pass
- AND no protected migration byte is changed

#### Scenario: Current Mi día migration hash passes

- GIVEN current `0089_mi_dia_read_contract.sql`
- WHEN its SHA-256 is calculated
- THEN the value is exactly `8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc`
- AND the file remains unchanged

#### Scenario: Hash mismatch or obsolete path fails closure

- GIVEN any protected hash differs, a manifest entry is missing, the archived manifest is not used, or a removed active-change path is recreated
- WHEN local closure is assessed
- THEN the hash gate fails
- AND no migration or archive is edited to manufacture agreement

### Requirement: Mixed-worktree baseline and no-unexpected-drift proof

Before running closure actions, the evidence MUST capture the current HEAD, staged/modified/untracked inventory, phase-owned paths, relevant content hashes, exact `next-env.d.ts` bytes, and verification-runtime state. Because the repository may already be mixed, HEAD cleanliness MUST NOT be treated as the preservation authority. After the gates and allowed documentation updates, the evidence MUST compare equivalent receipts and MUST distinguish the exact closure-owned delta from pre-existing unrelated work without staging, cleaning, normalizing, discarding, or claiming ownership of that work.

#### Scenario: Mixed baseline is captured before action

- GIVEN a repository with pre-existing staged, modified, or untracked paths
- WHEN the closure begins
- THEN HEAD, path status, phase-owned paths, relevant hashes, generated-file bytes, and runtime state are recorded before mutation
- AND the record identifies unrelated pre-existing work without altering it

#### Scenario: Pre-existing unrelated work is preserved

- GIVEN the baseline contains unrelated mixed-worktree changes
- WHEN closure evidence and the documentation-only delta are complete
- THEN those unrelated paths retain their pre-action content and status
- AND no clean, reset, checkout, stage, unstage, or normalization operation is used on them

#### Scenario: Unexpected path or content drift fails closure

- GIVEN a post-action receipt shows an unexplained code, migration, generated-type, fixture, test, archive, staged, or unrelated-worktree difference
- WHEN the receipt is compared with the baseline
- THEN Week 03 remains locally open
- AND the unexpected difference MUST be investigated or restored before closure can pass

### Requirement: Diff hygiene, generated-file restoration, and cleanup

The closure MUST perform tracked, staged, and path-scoped diff checks that prove the final owned delta is limited to the closure packet and, only after all gates pass, `docs/implementation/weeks/week-03-tasks-my-day.md`, `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md`. If the build rewrites `next-env.d.ts`, the file MUST be restored byte-for-byte to its exact pre-build state before final receipts. The closure MUST leave no `actravel-*` verification container and no closure-owned temporary artifact or baseline. It MUST NOT clean unrelated user work.

#### Scenario: Build leaves the generated file unchanged

- GIVEN the exact pre-build bytes of `next-env.d.ts` were captured
- WHEN the build completes without changing those bytes
- THEN no restoration is needed
- AND the final receipt proves byte identity

#### Scenario: Build rewrite is restored exactly

- GIVEN the build rewrites `next-env.d.ts`
- WHEN post-build restoration occurs
- THEN the file is restored to its exact pre-build bytes
- AND the final diff and hash receipts show no generated-file drift

#### Scenario: Tracked, staged, and scoped diffs are bounded

- GIVEN all evidence commands and allowed documentation updates are complete
- WHEN tracked, staged, and closure-path diffs are inspected
- THEN no unexpected product, schema, migration, generated-type, fixture, test, archive, or unrelated path change is attributable to closure
- AND the allowed documentation/evidence delta is completely enumerated

#### Scenario: Verification resources are cleaned up

- GIVEN the database-backed verification commands may have created disposable containers or temporary artifacts
- WHEN final cleanup is checked
- THEN no `actravel-*` verification container remains
- AND no closure-owned temporary artifact or baseline remains

#### Scenario: Restoration, diff, or cleanup failure blocks closure

- GIVEN `next-env.d.ts` is not restored exactly, a diff is unexplained, or a verification resource remains
- WHEN local closure is assessed
- THEN Week 03 remains locally open
- AND the closure claim MUST NOT be recorded while the failure persists

### Requirement: Gate-ordered living-document alignment

Only after every archive, canonical, qualification, route, aggregate, static, build, hash, drift, restoration, diff, and cleanup gate passes, the change MAY update `docs/implementation/weeks/week-03-tasks-my-day.md`, `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md`. Those four documents MUST agree on the exact local closure result, complete ten-archive chain, preserved qualifications, fresh 97/97 and 81/81 evidence, static/build/hash result, explicit exclusions, and next route. No other living product or implementation document MAY be changed by this closure.

#### Scenario: Four living documents align after all gates pass

- GIVEN every required fresh and reconciliation gate has passed
- WHEN the Week 03 brief and three living status/history documents are updated
- THEN all four state that Week 03 is closed locally under the same evidence and qualifications
- AND their archive links, counts, exclusions, and next route do not contradict one another

#### Scenario: Living documents are not advanced early

- GIVEN any required gate has not run or has not passed
- WHEN an update would declare closure or route Week 04 as active
- THEN that update is prohibited
- AND the existing local-open route remains authoritative

#### Scenario: Late verification invalidates a closure edit

- GIVEN the four living documents were updated after apparent gate success but independent verification later finds a failure
- WHEN the failure is confirmed
- THEN the four documents are restored to their exact pre-change bytes
- AND the closure packet retains the failure evidence while Week 03 remains locally open

#### Scenario: Archive and canonical authorities remain read-only

- GIVEN the living documents require clarification to agree with terminal history
- WHEN the clarification is made
- THEN only the allowed living documents and current closure packet are changed
- AND historical archives and canonical product specifications remain unchanged

### Requirement: Local-only closure wording and remote exclusions

Every closure statement MUST use wording equivalent to **closed locally** or **locally verified milestone closure**. The same status context MUST state that current remote migration, schema, data, RLS, historical-bootstrap execution, and deployed application state remain unknown; no remote inspection or mutation, migration application, operational bootstrap execution, deployment, rollout, or production-readiness determination occurred. Unknown remote state MUST NOT fail this local result, but it MUST require separate explicit authorization and fresh current-state inspection before any remote or rollout claim.

#### Scenario: Local closure is stated without deployment inference

- GIVEN all local closure gates and independent verification pass
- WHEN closure is recorded
- THEN the status says Week 03 is closed locally
- AND it explicitly denies remote parity, migration application, operational bootstrap execution, deployment, rollout, and production-readiness claims

#### Scenario: Unknown remote state remains an exclusion

- GIVEN no remote environment was inspected during closure
- WHEN the local result is evaluated
- THEN unknown remote state does not convert a local pass into a failure
- AND no current remote fact is inferred from local migrations, disposable tests, archives, or prior dated observations

#### Scenario: Overbroad wording fails the documentation gate

- GIVEN a closure artifact uses unqualified `closed`, `shipped`, `deployed`, `production-ready`, or equivalent wording that implies remote delivery
- WHEN the four living documents and closure evidence are reviewed
- THEN the documentation gate fails
- AND the wording MUST be corrected before local closure can pass

### Requirement: Bounded Week 04 planning route and future-work preservation

After successful local closure, `ACTIVE.md` MUST route the next action only to a separate bounded Week 04 `customer-identity-foundation` planning change. This closure MUST NOT implement Week 04 product, schema, migration, generated-type, fixture, or test behavior. It MUST retain Weeks 04–12 as future program work and MUST NOT absorb portal identity, quote acceptance, Trips, Travelers, payment plans, Suppliers, incidents, notifications, Marketing Studio, release hardening, or other future capability delivery into the Week 03 result.

#### Scenario: Successful closure routes only to Week 04 planning

- GIVEN Week 03 has passed every local closure gate and independent verification
- WHEN the active implementation route advances
- THEN it points to bounded `customer-identity-foundation` planning
- AND it does not point to remote rollout, operational bootstrap, deployment, or direct Week 04 implementation

#### Scenario: Future program remains explicitly future

- GIVEN the Week 03 closure record enumerates the remaining roadmap
- WHEN Weeks 04 through 12 are described
- THEN their product and release capabilities remain future work
- AND none is represented as delivered or authorized by this closure

#### Scenario: Failed closure preserves the Week 03 route

- GIVEN any required closure condition fails
- WHEN `ACTIVE.md` is evaluated
- THEN Week 03 final closure reconciliation remains the current route
- AND Week 04 planning is not treated as active or complete

### Requirement: Conjunctive fail-closed result contract

The final closure verdict MUST be conjunctive: it MAY be `PASS — Week 03 closed locally` only when every requirement in this specification is satisfied and independent verification confirms the complete documentation-only delta. Any missing archive or canonical capability; active source packet; incomplete task ledger or terminal verdict; unresolved blocker or critical finding; lost qualification; route contradiction; failed, skipped, altered, or unrun required test; failed static, build, hash, diff, restoration, cleanup, or independent-verification gate; unexpected owned or unrelated drift; unauthorized product or remote action; premature living-document edit; overbroad closure wording; or incorrect Week 04 route MUST produce `FAIL — Week 03 remains locally open`. The final result MUST report requirement and scenario verification counts and MUST identify every failed condition without masking it behind aggregate success.

#### Scenario: Every condition passes

- GIVEN all requirements and scenarios have current evidence, the allowed delta is documentation-only, and independent verification reports no failure condition
- WHEN the final verdict is issued
- THEN the verdict is `PASS — Week 03 closed locally`
- AND it reports complete requirement/scenario counts, fresh gate counts, preserved qualifications, and explicit remote non-claims

#### Scenario: One required condition fails

- GIVEN any single required condition is false or lacks evidence
- WHEN the final verdict is issued
- THEN the verdict is `FAIL — Week 03 remains locally open`
- AND passing aggregate results MUST NOT override the failed condition

#### Scenario: Unauthorized product or remote action invalidates closure

- GIVEN the change edits product/schema/test behavior or performs an unauthorized remote inspection or mutation
- WHEN scope compliance is reviewed
- THEN the local closure result fails
- AND the out-of-scope action is disclosed rather than incorporated into the closure claim

#### Scenario: Independent verification is required before archive

- GIVEN the authoring/apply evidence reports all gates passing
- WHEN the change is considered for archive and Week 04 handoff
- THEN an independent verifier checks every success and failure clause against the final bytes
- AND archive and handoff remain blocked until that verification passes with complete requirement/scenario counts
