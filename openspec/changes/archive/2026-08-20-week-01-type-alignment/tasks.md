# Tasks: Week 01 Type Alignment Remediation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated authored changed lines | 8 application/test lines plus planning evidence |
| 400-line budget risk | Low |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No

## Phase 1: Strict TDD boundary corrections

- [x] 1.1 RED: add a failing contract assertion requiring nullable currency at the application overlay/mapper boundary; RED observed before implementation.
- [x] 1.2 RED: remove only the stale generated-comment assertion while retaining trusted-byte and service-role checks; stale assertion was isolated.
- [x] 1.3 GREEN: add the minimum `QuoteCurrencyNullabilityOverlay` for `crm_quote_page` and `crm_quote_detail` in `lib/admin/quotes.ts`.
- [x] 1.4 GREEN: run focused quote foundation and registration contracts; 21/21 passed.

## Phase 2: Exact generated identity and ledger

- [x] 2.1 Verify generated target and fixed snapshot exact SHA-256, mode, byte count, and LF line count.
- [x] 2.2 Confirm generated target remains byte-for-byte unchanged; no regeneration, copy, or normalization performed.
- [x] 2.3 Record certified semantic ledger: 1105 additions, 765 deletions, 2238 unified-diff lines, binary patch hash, and zero mode change.

## Phase 3: Consumer and runtime validation

- [x] 3.1 Run `npx tsc --noEmit --incremental false`; PASS.
- [x] 3.2 Run the exact ten-file differential suite; 61/64 passed and the same three pre-existing server-only failures remained with no new failures.
- [x] 3.3 Run `npm run lint`; PASS.
- [x] 3.4 Run guarded build and quote notifications with external boundaries disabled; build PASS and notifications 15/15 PASS.

## Phase 4: Final evidence, rollback, and scope

- [x] 4.1 Verify build-owned `next-env.d.ts` command postimage and restore/re-verify the captured preimage SHA-256.
- [x] 4.2 Record rollback boundary: revert only the overlay and two named tests; generated snapshot remains untouched; no rollback mutation was needed.
- [x] 4.3 Publish final remediation evidence, protected-scope proof, warnings, and recommendation; parent Week 01 remains `BLOCKED`.

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/quotes-foundation-contract.test.ts tests/quote-registration-intents-contract.test.ts` — 21/21 pass; RED was observed before overlay implementation. |
| Runtime harness command/scenario and exact result | `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build` — exit 0; `npm run test:quote-notifications` — 15/15 pass. |
| Rollback boundary | `lib/admin/quotes.ts` and the two named contract tests only; generated snapshot and unrelated dirty paths are excluded. |

## Strict TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 nullable overlay boundary | Failing assertion before overlay | Focused contracts pass | Boundary assertions name the overlay and both RPC aliases |
| 1.2 stale generated comment | Stale assertion isolated | Trusted-byte/service-role checks retained | No unrelated assertion changes |
