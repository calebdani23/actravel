# Proposal: Week 03 PostgreSQL Runtime Helper Extraction

## Decision

Perform a behavior-preserving, test-only refactor of the already-proven quote runtime. Extract its
fixture-neutral Docker, readiness, `psql`, bootstrap, migration, database/template, claim-session, and
cleanup primitives into `tests/helpers/postgres-runtime.ts`. Keep quote-specific `prepareDatabase` and its
0057/0058/0059 branch sequence in the quote test. The quote test imports only the helper primitives it calls;
it remains the only consumer and the only approval behavior in this change.

## Exact scope

- Move the existing mechanics without redesign: command argv, `execFile`/`execFileSync` behavior, container
  name/image derivation, readiness loop, `240_000` timeout, migration branches/order, and `finally` removal.
- Keep `RUN_QUOTE_REGISTRATION_DB_TESTS`, all fixtures, SQL, concurrency, and assertions in
  `tests/quote-registration-intents-runtime.test.ts`.
- Keep business IDs, `advisorySha`, `beginSql`, `registerSql`, `seed`, and `insertObject` owned by the quote
  consumer. The helper owns only constants needed by extracted infrastructure and its internal bootstrap SQL.
- Export the fixture-neutral helper `sqlLiteral(value: string): string` from `tests/helpers`; `actorSession`
  uses it internally, and the quote consumer imports it for its retained `beginSql` and `insertObject` functions.
- Move the bootstrap implementation and its sole direct invocation behind `prepareBaseDatabase`; do not
  export or import the bootstrap SQL string.
- Future approval tests may import these exact primitives for 0061–0065 cases; none are added here.

## Exclusions

No generic public framework, lifecycle state machine, persistent session, package script/dependency/config or
docs/ACTIVE change, synthetic test, host port, network pull, secret, Supabase CLI, remote/database change,
application change, Git/lifecycle work, or approval behavior.

## Verification and rollback

Strict TDD verification is: before the helper exists, `npx tsc --noEmit` fails on the new helper import;
`node --import tsx --test tests/quote-registration-intents-runtime.test.ts` passes/skips before Docker;
`RUN_QUOTE_REGISTRATION_DB_TESTS=1 node --import tsx --test tests/quote-registration-intents-runtime.test.ts`
preserves the existing assertions and 240000 timeout; then run `npx tsc --noEmit`, `npm run lint`, and
`git diff --check`. No package script, generic test, package dependency, docs, or harness redesign is added.
Rollback deletes `tests/helpers/postgres-runtime.ts` and restores the moved definitions and call sites in the
quote test; no other files are touched.
