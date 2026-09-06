# Specification: Behavior-Preserving Quote Runtime Extraction

This change has no new runtime contract. It moves proven local test helpers into one test-only module and
changes the quote test only to import them. Observable quote-test behavior must remain identical.

## Shared module contract

Create `tests/helpers/postgres-runtime.ts` with these exports, preserving the current implementations:

```ts
export const containerName: string;
export const postgresImage: string;
export function docker(args: string[], input?: string): string;
export function psql(database: string, source: string): string;
export function psqlAsync(database: string, source: string): Promise<string>;
export function sqlLiteral(value: string): string;
export function actorSession(actorId: string, role?: string): string;
export function serviceSession(): string;
export function migrationNames(): string[];
export function applyMigration(database: string, name: string): void;
export function prepareBaseDatabase(): void;
export function waitForPostgres(): Promise<void>;
export function cleanupPostgres(): void;
```

`docker` retains the exact `execFileSync` options and argv. `psql` and `psqlAsync` retain their exact
container-local command argv, search path, input/`-c` behavior, trimming, and errors. Readiness retains 60
attempts, three consecutive successes, and 250 ms sleeps. `prepareBaseDatabase` owns the bootstrap SQL and
its sole direct `psql` invocation. Cleanup retains exact-name `docker rm -f`, the already-removed catch, and
synchronous error behavior.

## Extraction map and ownership

| Current lines/symbols | New owner | Consumer replacement |
|---|---|---|
| 7, 20–44 `execFileAsync`, `docker`, `psql`, `psqlAsync` | helper | import symbols; delete local definitions |
| shared fixture-neutral `sqlLiteral` helper | helper | export `sqlLiteral(value: string): string`; `actorSession` uses it internally; quote consumer imports it for retained `beginSql` and `insertObject` |
| 90–147 `bootstrap` | helper internal | called only by `prepareBaseDatabase` |
| 149–164 migration/base-database functions | helper | import `migrationNames`, `applyMigration`, and `prepareBaseDatabase` |
| 165–170 quote `prepareDatabase` | quote test | retain implementation and 0057/0058/0059 branch sequence |
| 50–64 claim-session functions | helper | import `actorSession`, `serviceSession` |
| 217–233 readiness block; 365–371 cleanup block | helper | call `waitForPostgres()` and `cleanupPostgres()` |
| 215 container start statement | quote test | unchanged `docker(["run", ...])` call using imported constants |
| 12–18 IDs/hash, 66–82 quote SQL, 84 `parseRow`, 177–209 `seed`/`insertObject` | quote test | unchanged ownership and bodies |

The helper owns only `migrationDirectory`, `containerName`, `postgresImage`, the fixture-neutral
`sqlLiteral(value: string): string` helper, and internal bootstrap
infrastructure values. There is no migration array in the current test: `migrationNames()` owns lexical
discovery, while the quote consumer owns the literal 0057/0058/0059/0060 branch order and its
`prepareDatabase`. Quote IDs, SQL, fixtures, and assertions remain in the consumer. The consumer imports
`sqlLiteral(value: string): string` for its retained `beginSql` and `insertObject` functions, and imports no
bootstrap string or unused bootstrap symbol. No shared mutable state or circular import exists: the helper
imports no quote test symbols; its process-derived container name is initialized once as today.

## Acceptance

The RED/type check is `npx tsc --noEmit` before the helper exists and must fail on the new helper import.
Default skip verification is `node --import tsx --test tests/quote-registration-intents-runtime.test.ts` and
must pass/skip before Docker. GREEN is
`RUN_QUOTE_REGISTRATION_DB_TESTS=1 node --import tsx --test tests/quote-registration-intents-runtime.test.ts`
and preserves existing assertions and the 240000 timeout. Then run `npx tsc --noEmit`, `npm run lint`, and
`git diff --check`. No synthetic or approval test is part of this change.
