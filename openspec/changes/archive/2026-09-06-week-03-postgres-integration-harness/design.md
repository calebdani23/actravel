# Design: Week 03 PostgreSQL Runtime Helper Extraction

## Technical Approach

Mechanically move the proven fixture-neutral infrastructure symbols from
`tests/quote-registration-intents-runtime.test.ts` into `tests/helpers/postgres-runtime.ts`, then replace only
their local definitions/calls with imports. `prepareDatabase` remains in the consumer, including its literal
0057/0058/0059 branch sequence. `prepareBaseDatabase` contains the bootstrap implementation and its sole
direct invocation, so the consumer imports no bootstrap string. The helper is test-only and has no framework
lifecycle or new abstraction. The consumer's opt-in gate, timeout, SQL, fixtures, concurrency, assertions,
and `finally` shape remain unchanged. The shared helper also exports the fixture-neutral
`sqlLiteral(value: string): string`; `actorSession` uses it internally, while the consumer imports it for
the retained `beginSql` and `insertObject` functions.

## Architecture Decisions

| Choice | Alternative rejected | Rationale |
|---|---|---|
| Named exports matching existing helper signatures | Generic harness API | Enables exact future 0061–0065 imports with the smallest diff. |
| Own `sqlLiteral` in shared helpers | Duplicate or quote-specific SQL escaping | Keeps literal escaping fixture-neutral while allowing retained consumer SQL builders to use the same contract. |
| Keep quote setup and 0057/0058/0059 branches in consumer | Move all setup into shared code | IDs, quote migrations, and assertions are business-specific; moving them changes ownership and risk. |
| Hide bootstrap behind `prepareBaseDatabase` | Export/import bootstrap SQL | Prevents an unused consumer import and keeps the bootstrap invocation with its base-database primitive. |
| Preserve sync Docker/psql and async psql exactly | Persistent sessions or new runner | Existing behavior is proven and extraction needs no semantic change. |
| Lifecycle functions own only existing blocks | State machine/ownership redesign | Preserves command argv, naming, errors, and cleanup contract. |

## Data Flow

`quote test → imported docker/start → waitForPostgres → prepareBaseDatabase → consumer prepareDatabase
(0057/0058/0059) → seed/assertions → imported cleanupPostgres in existing finally`

`sqlLiteral(value: string): string` is exported by the helper; `actorSession` calls it internally, and the
consumer's retained `beginSql`/`insertObject` call the imported helper. `actorSession`/`serviceSession` remain
pure SQL-string builders. There is no mutable shared state and no
reverse import, so circular coupling is impossible.

## File Changes

| File | Action | Description |
|---|---|---|
| `tests/helpers/postgres-runtime.ts` | Create | Exact extraction of Docker/psql, sessions, bootstrap/base database, migrations, readiness, cleanup primitives, and exported `sqlLiteral(value: string): string`. |
| `tests/quote-registration-intents-runtime.test.ts` | Modify | Import `sqlLiteral` for retained `beginSql`/`insertObject`; add other imports and replace only extracted definitions/calls. |

No other file is permitted. The helper owns `migrationDirectory`, `containerName`, `postgresImage`, internal
bootstrap SQL, Docker/psql, readiness, migration/base-database, claim-session, and cleanup symbols. The
consumer retains `prepareDatabase`, its 0057/0058/0059 branch order, IDs/hash, `beginSql`, `registerSql`,
`parseRow`, `seed`, `insertObject`, the 0060 call, and business SQL.

## Interfaces / Contracts

Use the exact signatures listed in the specification, including `sqlLiteral(value: string): string`.
`actorSession` uses the helper internally; the consumer imports `sqlLiteral` for retained `beginSql` and
`insertObject`. `waitForPostgres(): Promise<void>` contains the current
60-attempt loop and throws the same readiness error; `cleanupPostgres(): void` contains the current nested
try/catch. The test keeps the existing `docker(["run", ...])` call, now using imported constants, and calls
the readiness/cleanup functions at the same points.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| RED/type | Import/extraction contract | Before the helper exists, `npx tsc --noEmit` fails on the new helper import. |
| Default skip | Existing quote test | `node --import tsx --test tests/quote-registration-intents-runtime.test.ts` passes/skips before Docker. |
| GREEN | Quote runtime | `RUN_QUOTE_REGISTRATION_DB_TESTS=1 node --import tsx --test tests/quote-registration-intents-runtime.test.ts` preserves existing assertions and 240000 timeout. |
| Regression | Tooling | Run `npx tsc --noEmit`, `npm run lint`, and `git diff --check`. |

No synthetic, approval, package, Docker, database, or remote test is introduced. No package script, generic
test, package dependency, docs change, or harness redesign is added. Routing/VCS/PR/executable
classification are N/A.

## Migration / Rollout

No migration or rollout required. Rollback deletes the helper and restores the exact moved code in the quote
test.

## Open Questions

None.
