# Proposal: Week 03 Final Closure Reconciliation

## Intent

Close the stale Week 03 milestone ledger through two bounded, passive, local-only slices that reconcile the ten completed Week 03 archives, their promoted or composed canonical capabilities, preserved qualifications, and current repository behavior. The change must produce fresh evidence against unchanged product bytes, independently verify exact candidate living-document bytes before publication, and only then publish the locally verified closure and bounded Week 04 `customer-identity-foundation` planning route without implying remote parity, rollout, or production readiness.

## Scope

### In Scope
- Reconcile all ten Week 03 archive packets with their complete task ledgers, terminal verification verdicts, promoted/composed canonical capabilities, and preserved warnings or resolved incidents.
- Confirm read-only that current `/admin/dashboard` behavior still matches the archived role-aware Mi día route and that no product correction is required.
- Run unchanged, serial local evidence: the 97-test action/automation/source/historical aggregate, the 81-test follow-up/Task/CRM preservation aggregate, TypeScript, lint, the production build, protected migration hashes, tracked/staged and path-scoped diff hygiene, generated-file restoration, and verification cleanup.
- Execute exactly two separately bounded passive slices. S1 records the inventory and evidence and writes exact candidate bytes for the four living documents inside the change root without modifying those living documents or publishing the Week 04 route. A fresh verifier independent of S1 must PASS those exact candidate bytes and evidence.
- Execute S2 only from the independently passed, hash-sealed S1 candidates: publish all four living documents as one all-or-nothing operation, prove each published file is byte-for-byte identical to its candidate, and otherwise restore all four preimages.
- Record Week 03 as closed locally and route the next action only to bounded Week 04 customer-identity planning after S2 publication and post-publication verification pass. S1 repository writes are confined to evidence, receipts, and candidate working bytes beneath the change root; S2 writes are confined to the four living documents and final receipts beneath the change root. Neither slice may move work outside that ownership to fit.

### Out of Scope
- Product behavior, application code, schema, migrations, generated database types, fixtures, or test changes.
- New or modified Task, Mi día, CRM, authorization, automation, audit, notification, portal, or customer-identity behavior.
- Remote inspection or mutation, migration application, operational historical-bootstrap execution, deployment, rollout, or production-readiness claims.
- Week 04 implementation or any Week 05–12 product work.
- Rewriting archive reports, warnings, failed attempts, review qualifications, or other historical provenance.

## Capabilities

### New Capabilities
- `week-03-final-closure-reconciliation`: passive archive/canonical reconciliation, exact local closure gates, living-document alignment, and bounded Week 04 planning handoff.

### Modified Capabilities
None. Existing canonical product requirements and behavior remain unchanged.

## Approach

Before S1, seal the current HEAD, mixed-worktree inventory, phase-owned paths, relevant content hashes, `next-env.d.ts` bytes, verification-runtime state, index state, and exact preimage bytes of the four living documents without cleaning, staging, or normalizing unrelated work. The preservation manifest must represent every non-owned path with an explicit present/absent state. In particular, a tracked non-owned path that is absent in the worktree must have an `absent` row rather than being omitted or hashed as an empty file. The current baseline includes `openspec/changes/week-03-followup-task-approved-plan-apply/design.md`, `exploration.md`, `proposal.md`, and `specs/follow-up-task-approved-plan-apply/spec.md` as absent tracked non-owned paths; any additional absence observed when sealing receives the same treatment. Preserve each absence exactly through S2. Build a reconciliation matrix for these ten immutable archives:

1. `2026-09-01-week-03-followups-to-tasks`
2. `2026-09-04-week-03-followups-to-tasks-backfill`
3. `2026-09-04-week-03-followups-to-tasks-preview-reader`
4. `2026-09-06-week-03-postgres-integration-harness`
5. `2026-09-08-week-03-followup-task-approval-ledger`
6. `2026-09-13-week-03-followup-task-approved-plan-apply`
7. `2026-09-14-week-03-followups-to-tasks-cutover`
8. `2026-09-24-week-03-task-automation-and-action-audit`
9. `2026-09-28-week-03-task-automation-historical-bootstrap`
10. `2026-10-06-week-03-role-aware-mi-dia`

Cross-check the matrix against `follow-up-task-representation`, `follow-up-backfill-preview`, `follow-up-backfill-preview-reader`, `postgres-integration-harness`, `follow-up-task-approval-ledger`, `follow-up-task-approved-plan-apply`, `follow-up-task-disposition-readiness`, `follow-up-task-future-write`, `follow-up-task-read-contracts`, `follow-up-task-application-cutover`, `task-action-audit`, `task-automation-foundation`, `task-source-automation`, the four `task-automation-historical-*` capabilities, `role-aware-mi-dia`, and the composed amendments in `tasks-foundation`. Treat packet counts as overlapping compositions, not deduplicated Week 03 totals.

Run the two database-backed aggregates serially and unchanged, with sufficient timeout. Then run `npx tsc --noEmit`, `npm run lint`, and `npm run build`; validate the protected migration manifest through its dated archive path with `sha256sum -c openspec/changes/archive/2026-10-06-week-03-role-aware-mi-dia/0061-0088.sha256`; and prove the current `0089_mi_dia_read_contract.sql` hash remains `8c14321412a7287b0312ef47cac78fcc2bdc81c23e58b2c875157903c70562dc`. Restore `next-env.d.ts` to its exact pre-build bytes if rewritten, compare before/after path receipts, run tracked and staged diff checks, and prove no `actravel-*` verification container or execution-owned temporary artifact remains. The sealed rollback baseline and S1 candidate working bytes are the only temporary exceptions and must remain until the S2 terminal path permits cleanup. Any retry must be disclosed and followed by an unchanged complete rerun.

Implement the passive work in exactly two slices:

1. **S1 — evidence and candidate verification.** Run and record every reconciliation, route, aggregate, static, build, hash, restoration, drift, and runtime-cleanup gate. Write the resulting evidence and exact candidate bytes for `docs/implementation/weeks/week-03-tasks-my-day.md`, `docs/implementation/ACTIVE.md`, `docs/PROGRESS.md`, and `docs/DECISIONS.md` beneath the change root, mirroring their repository-relative paths. Seal the evidence and each candidate with byte length and SHA-256. Do not modify the four living documents, and do not publish or treat the Week 04 route as active. A fresh verifier independent of the S1 author/process must check the complete contract against those exact sealed bytes and evidence and issue PASS tied to their hashes. Any candidate or evidence change invalidates that PASS and returns work to S1.
2. **S2 — atomic publication and exact-match proof.** Reconfirm that the sealed baseline, independently passed candidate hashes, and preservation manifest are unchanged. Publish all four candidate files as one fail-closed transaction. Then prove that every living document is byte-for-byte identical to its passed candidate, all non-owned present and absent states and index/staged state remain exact, and the only authoritative route change is bounded Week 04 `customer-identity-foundation` planning. A mismatch, interruption, drift, or failed post-publication check must restore all four exact pre-S1 living-document bytes and prove the Week 03 route is authoritative again.

Retain the sealed rollback baseline and exact S1 candidate working bytes through the S1 verifier verdict and throughout S2. Remove them only after either S2 post-publication verification passes or a failed S2 has completed and verified exact rollback; then prove the baseline, candidate working copies, and other closure-owned temporary artifacts are absent. Durable evidence, candidate hashes/manifests, and verifier receipts remain in the change root. No remote command or product mutation is authorized by either slice.

## Result Contract

### Success

Week 03 local closure succeeds if and only if all of the following are true:

- All ten named archive directories exist, their former active source directories are absent, every archived task ledger is complete, and every terminal verdict is `PASS` or `PASS WITH WARNINGS` with zero unresolved blocker or critical finding.
- Every named promoted/composed canonical capability exists; later compositions and `tasks-foundation` amendments are accounted for without summing overlapping packet counts as unique global coverage.
- Provenance remains explicit: the classifier packet's zero scenario headings; preview-reader operational/readability and baseline-only aggregate advisories; PostgreSQL-helper advisories; approval-ledger compatibility-review qualification; approved-plan runtime/coverage warnings; and the historical-bootstrap Docker-readiness incident resolved by an unchanged complete rerun.
- Current `/admin/dashboard` behavior remains consistent with archived role-aware Mi día: supported Admin/Manager/Asesor unions use bounded Mi día and canonical audited Task actions, while Operations/Finance/Marketing retain the legacy Dashboard; no product change is needed to make the documents true.
- The unchanged action/automation/source/historical command passes **97/97** with zero skips, and the unchanged follow-up/Task/CRM preservation command passes **81/81** with zero skips.
- TypeScript and lint pass; the production build passes with the current **96/96-page** baseline; the archived `0061`–`0088` manifest passes **28/28**; `0089` retains its exact expected SHA-256; and all required checks exit successfully.
- Pre/post receipts prove no unexpected code, migration, generated-type, fixture, test, archive, staged, or unrelated mixed-worktree drift. `next-env.d.ts` is restored byte-for-byte after any build rewrite, diff hygiene passes, and no `actravel-*` verification container or closure-owned temporary artifact remains.
- Every non-owned baseline row, including each tracked path absent from the worktree, has an explicit present/absent state and retains that exact state through final comparison.
- S1 leaves the four living documents and current Week 03 route unchanged, stores hash-sealed candidate bytes and evidence beneath the change root, and receives a fresh independent PASS tied to those exact hashes before S2 starts.
- S2 publishes all four independently passed candidates as one all-or-nothing operation; the Week 03 brief, `ACTIVE.md`, `PROGRESS.md`, and `DECISIONS.md` then match those candidates byte-for-byte, agree that Week 03 is closed **locally**, preserve all qualifications, route only to bounded Week 04 `customer-identity-foundation` planning, and explicitly deny any inference of current remote parity, migration application, operational bootstrap execution, deployment, rollout, or production readiness.
- The sealed rollback baseline and candidate working bytes remain available until S2 exact-match and preservation verification passes, or until a failed S2 has restored and verified every preimage. Cleanup then removes only the temporary baseline, candidate copies, and resources and proves their absence while retaining durable hashes, manifests, closure evidence, and verifier receipts.
- Future Weeks 04–12 remain enumerated as future program work rather than being absorbed into this closure.

### Failure

Week 03 remains locally open if any required archive or canonical capability is missing; an active source packet still exists; a task ledger or terminal verdict is incomplete; a blocker/critical finding or current-route contradiction exists; a required test is failed, skipped, altered, or not run; a static, build, hash, diff, restoration, or cleanup gate fails; an absent non-owned tracked path is omitted or changes state; any unexpected product/schema/test/archive/worktree drift occurs; S1 changes a living document or publishes Week 04; the fresh independent verifier does not PASS the exact sealed S1 candidate/evidence hashes; S2 publishes different bytes, only a subset of the four documents, or cannot prove exact match; rollback cannot restore and verify all four preimages; or the sealed baseline is removed before S2 verification pass or verified failure rollback. Unknown remote state does **not** fail this local result; it remains an explicit exclusion that requires separate authorization and fresh current-state inspection.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/week-03-final-closure-reconciliation/` | New | Durable S1 evidence, candidate hashes/manifests, independent-verifier receipt, tasks, and final verification packet; repository-relative candidate working bytes exist here only through S2 terminal cleanup. |
| `docs/implementation/weeks/week-03-tasks-my-day.md` | Modified in S2 only | Atomically replace stale OPEN/partial status with the independently passed candidate containing the complete locally verified archive chain, qualifications, and non-claims. |
| `docs/implementation/ACTIVE.md` | Modified in S2 only | Publish the passed candidate that records local Week 03 closure and routes to bounded Week 04 customer-identity planning. |
| `docs/PROGRESS.md` | Modified in S2 only | Publish the passed candidate containing exact fresh local closure evidence and exclusions. |
| `docs/DECISIONS.md` | Modified in S2 only | Publish the passed candidate containing local-only closure semantics, preserved provenance, and separation from rollout. |
| `openspec/changes/archive/*week-03*/`, `openspec/specs/` | Read only | Authorities for archive, capability, qualification, and composition reconciliation. |
| Application, `db/migrations/`, generated types, fixtures, and tests | Read/execute only | Confirm unchanged behavior and hashes; no edits are permitted. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mixed-worktree changes are mistaken for closure drift or are accidentally normalized | High | Use exact pre/post path and content receipts; never clean, stage, or modify unrelated work. |
| An absent tracked non-owned path disappears from preservation accounting | High | Record every non-owned path with an explicit present/absent state; treat omission or an absent/present transition as failure. |
| Overlapping packet counts are presented as unique Week 03 coverage | Med | Reconcile by archive and canonical composition; prohibit aggregate requirement/scenario summation. |
| Historical warnings are erased by a uniform PASS narrative | Med | Preserve every named advisory, qualification, failed attempt, and resolved incident verbatim in the matrix. |
| Long-running database suites fail transiently or leak containers | Med | Run serially with sufficient timeout; disclose retries; require an unchanged full rerun and final cleanup proof. |
| Archived commands reference the removed active Mi día path | High | Use the dated archive manifest path and never recreate the old active directory. |
| The build rewrites `next-env.d.ts` | High | Hash/capture it before the build and restore its exact prior bytes before final diff proof. |
| “Locally closed” is interpreted as deployed or production-ready | High | Repeat remote, migration, bootstrap, deployment, rollout, and production non-claims in every changed status artifact. |
| Candidate review accidentally publishes Week 04 before independent PASS | High | Keep all four candidates under the change root during S1; forbid living-document writes until a fresh verifier passes their exact hashes. |
| Partial S2 publication exposes inconsistent living documents | High | Use one fail-closed four-file transaction, exact candidate-to-published byte checks, and immediate four-file preimage rollback on any failure. |
| The rollback baseline is cleaned before late checks finish | High | Retain the sealed baseline until S2 verification passes or failed S2 rollback is verified; cleanup and prove absence only afterward. |
| Week 04 implementation expands the passive closure | Med | Route only to a separate bounded planning change; make no Week 04 product, schema, or test change here. |

## Rollback Plan

If S1 or its fresh independent verification fails, do not run S2: leave all four living documents and the Week 03 route byte-for-byte unchanged, complete and verify any required generated-file/runtime rollback, retain bounded failure evidence and candidate hash receipts, and only then remove the sealed temporary baseline and candidate working copies. If S2 fails or any post-publication check cannot prove exact candidate equality and preservation, restore all four living documents from their exact sealed pre-S1 bytes as one rollback, verify the restored bytes, route, index/staged state, and every non-owned present/absent state, and keep Week 03 locally open. Retain the sealed baseline and candidate working bytes until that rollback proof completes; then remove only the validated temporary baseline/candidates/resources and prove absence. Durable hashes, manifests, evidence, and verifier/failure receipts remain in the change packet. No application, schema, data, test, remote, deployment, or production rollback applies; archives and canonical specifications must never be rewritten or deleted.

## Dependencies

- The ten dated Week 03 archives and their immutable terminal reports, task ledgers, and qualifications.
- The named canonical capabilities plus the composed Week 03 amendments in `tasks-foundation`.
- Current local/disposable database and Docker tooling needed by the unchanged 97-test and 81-test suites.
- The archived Mi día `0061-0088.sha256` manifest and current `0089` migration bytes.
- A fresh verifier independent of S1 that can bind its PASS to exact candidate/evidence hashes before any living-document or Week 04 publication.
- A fail-closed S2 publication mechanism that can restore all four sealed preimages if the four-file exact-match transaction does not pass.

## Success Criteria

- [ ] The ten archives, relevant canonical capabilities, completed task ledgers, terminal verdicts, and all preserved qualifications reconcile exactly without double-counting composed requirements.
- [ ] Current role-aware Mi día routing matches the archived behavior and requires no product correction.
- [ ] Fresh unchanged evidence passes at 97/97 and 81/81 with zero skips; TypeScript, lint, the 96/96-page build, 28/28 manifest, exact `0089` hash, diff/restoration receipts, and cleanup all pass.
- [ ] No product, code, schema, migration, generated-type, fixture, test, archive, remote, rollout, deployment, or production change or claim is introduced.
- [ ] S1 explicitly preserves absent non-owned tracked paths, leaves all four living documents unchanged, and produces hash-sealed candidate bytes/evidence that a fresh independent verifier passes exactly.
- [ ] S2 atomically publishes all four passed candidates, proves byte-for-byte equality and complete preservation, and only then makes bounded Week 04 `customer-identity-foundation` planning authoritative; any failure restores and verifies all four preimages.
- [ ] The sealed rollback baseline and exact candidate working bytes survive until S2 exact-match verification pass or verified failure rollback, after which temporary cleanup succeeds without deleting durable hashes, manifests, evidence, or verifier receipts.
- [ ] Independent verification confirms every success clause and no failure clause before publication/archive, and the final published-byte proof satisfies the Result Contract.
