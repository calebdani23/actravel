# Tasks: Week 03 PostgreSQL Runtime Helper Extraction

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220–320 authored lines |
| 400-line budget risk | Low |
| 800-line budget risk | Low |
| Chained PRs recommended | Yes — requested two focused units |
| Suggested split | PR 1: shared helper; PR 2: quote-test extraction |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low
800-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Add exact fixture-neutral helper exports | PR 1 | `npx tsc --noEmit`; `npm run lint`; `git diff --check` | N/A: helper is unreferenced until PR 2 | Review only `tests/helpers/postgres-runtime.ts`; revert that file only |
| 2 | Replace quote-test duplicates with imports | PR 2 | `node --import tsx --test tests/quote-registration-intents-runtime.test.ts`; `RUN_QUOTE_REGISTRATION_DB_TESTS=1 node --import tsx --test tests/quote-registration-intents-runtime.test.ts`; `npx tsc --noEmit`; `npm run lint`; `git diff --check` | Docker opt-in quote test; stop/report unverified if Docker/image unavailable | Review only consumer extraction plus its helper imports; revert consumer diff only |

## Phase 1: Shared Helper (PR 1)

- [x] 1.1 **RED:** In a temporary extraction state, add the intended helper import and run `npx tsc --noEmit`; capture the missing-module/type failure, then discard the temporary state (no dependency or behavior change).
- [x] 1.2 **GREEN:** Create `tests/helpers/postgres-runtime.ts` with only the listed infrastructure exports; preserve exact argv/options, constants, bootstrap SQL, readiness (60 attempts/3 successes/250 ms), and cleanup behavior.
- [x] 1.3 Verify PR 1 with `npx tsc --noEmit`, `npm run lint`, and `git diff --check`; capture command output, symbol/source hash mapping, changed-line count, zero consumer diff, review boundary, and helper-only rollback.

## Phase 2: Consumer Refactor (PR 2)

- [x] 2.1 **RED:** Validate the import/type contract while retaining `prepareDatabase`, 0057/0058/0059/0060 order, `beginSql`/`insertObject`, fixtures, flag, timeout, concurrency, and assertions; record the expected pre-GREEN failure if applicable.
- [x] 2.2 **GREEN:** Modify only `tests/quote-registration-intents-runtime.test.ts`: import helper symbols, remove duplicates, and replace readiness/cleanup blocks at the same call sites; retain all quote ownership and behavior.
- [x] 2.3 Run `node --import tsx --test tests/quote-registration-intents-runtime.test.ts` and expect pass/skip; run `RUN_QUOTE_REGISTRATION_DB_TESTS=1 node --import tsx --test tests/quote-registration-intents-runtime.test.ts` and capture full output, assertions, and 240000 timeout. If Docker/image is unavailable, stop and report unverified—never claim pass.
- [x] 2.4 Run `npx tsc --noEmit`, `npm run lint`, and `git diff --check`; capture source/hash mapping, changed-line count, consumer-only review boundary, container cleanup evidence, and proof of no host/remote access. Rollback only the consumer refactor.

## Boundaries

- [x] 3.1 Confirm the final diff contains only the two permitted files; record evidence that no packages, scripts, docs, business logic, synthetic/approval tests, migrations, remote databases, host ports, Docker network/pull changes, or threat-matrix cases (all N/A in design) were added.
