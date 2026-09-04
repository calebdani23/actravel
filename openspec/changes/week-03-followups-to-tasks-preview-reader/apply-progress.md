# Apply Progress: Admin Follow-up Tasks Preview Reader

## Scope
- Slice: final preview-reader Slice 3, tasks 5.1–5.2; cumulative tasks 1.1–5.2 (10/10)
- Delivery: auto-chain, stacked-to-main; PR 3 contracts, verification, evidence, and docs
- Token: `sha256:2f4742f6bfcc62d89db680af1239338535efaacf4f401d172c69cfd87ed87b97`
- Mode: Strict TDD, RED → GREEN

## Completed Tasks
- [x] 1.1 Occupancy, exact existing-task, invariant, duplicate, collision, accounting, and canonical-preservation vectors.
- [x] 1.2 Occupancy field/cardinality validation and generated timestamp equality coverage.
- [x] 2.1 Closed `TaskOccupancyFact`, bounded validation, duplicate detection, and exact four-field existing-task matching.
- [x] 2.2 Collision maps derive from occupancy, excluding null leads, with source equality and golden output preserved.
- [x] 3.1 Reader RED tests for authorization order, stable errors, and dependency hooks.
- [x] 3.2 Reader boundary vectors and classifier occupancy ID-map regression coverage.
- [x] 4.1 Server-only Admin-first injected read source with dual cutoffs and bounded keyset paging.
- [x] 4.2 Deterministic joins/decoding, digest convergence, exactly-once classification, and zero-write error handling.
- [x] Slice2 corrective gate fixes: complete 0064 task DTOs are validated before `ExistingTaskFact`; all requested role IDs are globally validated and unsupported roles invalidate mixed mappings; digest occupancies are sorted by task ID; page timestamps must equal canonical input; production fetch retries count physical attempts without adding logical reads; success cutoffs use camelCase and diagnostics are included consistently.
- [x] Final corrective tests-only pass: integrated four-attempt fetch diagnostics, direct missing/inactive profile precedence, identical mapping dedupe, and Task-ID occupancy digest ordering.
- [x] 5.1 Final focused, type, lint, build, diff, and aggregate react-server verification; build-owned `next-env.d.ts` rewrite restored to its exact preimage.
- [x] 5.2 Verified evidence and rollback boundary recorded in `docs/DECISIONS.md` and `docs/PROGRESS.md`.

## TDD Cycle Evidence
| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 | New occupancy/collision vectors failed | Classifier test passed | Canonical assertions unchanged |
| 1.2 | Validation/timestamp assertions failed | Classifier test passed | Reused closed validation helpers |
| 2.1 | Occupancy contract absent | `npx tsc --noEmit` passed | Pure boundary/error taxonomy preserved |
| 2.2 | Maps came from existing follow-up rows | Focused classifier test passed (11/11) | No reader/server/auth/Supabase/I/O/schema/DML changes |
| 3.1 | New reader tests failed before adapter existed | Reader tests passed (5/5) | Injected source keeps auth/read boundary testable |
| 3.2 | Decoder/convergence vectors were initially absent | Reader + classifier tests passed (17/17) | Stable code-only error envelope |
| 4.1 | Reader module absent | `npx tsc --noEmit` passed | Server-only adapter, no UI/schema/DML |
| 4.2 | Classifier invocation and digest seams absent | Reader tests passed (7/7); aggregate reader + classifier passed (19/19) | Four-pass convergence, zero writes, physical fetch-attempt counter |

## Work Unit Evidence
| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test tests/follow-up-backfill-preview-reader.test.ts tests/follow-up-backfill-preview.test.ts` — PASS, 30/30 (reader 18/18, classifier 12/12); additionally covers integrated four-attempt diagnostics with no extra page/chunk, direct missing/inactive precedence, identical profile-role dedupe, and Task-ID-normalized occupancy digest input |
| Runtime harness command/scenario and exact result | N/A — injected local transport only; no remote/runtime boundary permitted |
| Rollback boundary | Revert reader module and reader tests; classifier changes remain the preceding stacked slice |

## Verification
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `git diff --check` — PASS
- `npm run build` — PASS; the build temporarily rewrote `next-env.d.ts` from the preimage SHA-256 `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc` (251 bytes, mode 664) to a 247-byte routes import, and the exact preimage was restored and verified.
- Aggregate react-server tests (`node --conditions react-server --import tsx --test tests/*.test.ts tests/*.test.tsx`) — 454/457 passed, 2 failed, 1 skipped. The exact failures were:
  - `tests/lead-template-actions.test.tsx` — module-load failure: `Error: react-dom/server is not supported in React Server Components` from `tests/lead-template-actions.test.tsx:4:38`.
  - `database types expose expected upload size and every typed RPC result` in `tests/quote-transaction-rpc-contract.test.ts` — assertion at `tests/quote-transaction-rpc-contract.test.ts:239:10` did not match `/crm_accept_quote: \{[\\s\\S]*p_expected_accepted_quote_id: string \| null[\\s\\S]*superseded_quote_id: string \| null/i`.
- Causality proof: both failures were reproduced in a clean temporary detached worktree at baseline `745d6c6` (the pre-documentation parent/current pre-doc tree): the lead-template test failed at module load with `Error: react-dom/server is not supported in React Server Components`, and the quote generated-type test failed at `tests/quote-transaction-rpc-contract.test.ts:239:10` because `crm_accept_quote` did not match the expected parameter ordering/shape. They are pre-existing baseline failures, not candidate-caused regressions; no unrelated fixes were made.
- Reader/classifier focused suite (`node --conditions react-server --import tsx --test tests/follow-up-backfill-preview-reader.test.ts tests/follow-up-backfill-preview.test.ts`) — PASS, 30/30 (reader 18/18, classifier 12/12).
- `npx tsc --noEmit` — PASS after test-only typing correction.
- `npm run lint` — PASS after test-only lint correction.
- `git diff --check` — PASS.
- Boundary confirmation: no UI, schema, DML, linked remote, or production operation was performed. The runtime boundary is read-only by design; verification used injected local transport only, so production readiness is not claimed.
- Review follow-ups: retain timeout/backoff design review for provider retries and readability/complexity review for the bounded reader. The local query-contract test proves the cursor/cutoff predicate is conjunctive and raw; it does not replace those operational reviews.

## Remaining
- None — tasks 10/10 complete; next phase is `sdd-verify`.
