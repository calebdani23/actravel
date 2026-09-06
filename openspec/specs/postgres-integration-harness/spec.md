# Specification: Behavior-Preserving Quote Runtime Extraction

This change has no new runtime contract. It moves proven local test helpers into one test-only module and
changes the quote test only to import them. Observable quote-test behavior must remain identical.

### Requirement: Fixture-neutral shared helper contract

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

#### Scenario: Helper exports preserve existing mechanics

- GIVEN the shared helper is used by the quote test
- WHEN Docker, SQL, readiness, bootstrap, or cleanup operations run
- THEN `docker` retains the exact `execFileSync` options and argv; `psql` and `psqlAsync` retain their exact container-local command argv, search path, input/`-c` behavior, trimming, and errors
- AND readiness retains 60 attempts, three consecutive successes, and 250 ms sleeps; `prepareBaseDatabase` owns the bootstrap SQL and its sole direct `psql` invocation; cleanup retains exact-name `docker rm -f`, the already-removed catch, and synchronous error behavior

### Requirement: Ownership map remains exact

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

#### Scenario: Quote-owned behavior remains in the consumer

- GIVEN the helper and quote consumer are separated
- WHEN ownership is reviewed
- THEN the helper owns only `migrationDirectory`, `containerName`, `postgresImage`, the fixture-neutral `sqlLiteral(value: string): string` helper, and internal bootstrap infrastructure values
- AND `migrationNames()` owns lexical discovery while the quote consumer owns the literal 0057/0058/0059/0060 branch order, `prepareDatabase`, quote IDs, SQL, fixtures, assertions, retained `beginSql`, and `insertObject`; no shared mutable state or circular import exists

### Requirement: Quote runtime behavior is preserved

The consumer imports `sqlLiteral(value: string): string` for its retained `beginSql` and `insertObject` functions, and imports no bootstrap string or unused bootstrap symbol. Its process-derived container name is initialized once as today.

#### Scenario: Default run skips before Docker

- GIVEN the helper exists and database tests are not opted in
- WHEN `node --import tsx --test tests/quote-registration-intents-runtime.test.ts` runs
- THEN it must pass/skip before Docker

#### Scenario: Opt-in runtime remains green

- GIVEN `RUN_QUOTE_REGISTRATION_DB_TESTS=1`
- WHEN `node --import tsx --test tests/quote-registration-intents-runtime.test.ts` runs
- THEN existing assertions remain preserved with the 240000 timeout

### Requirement: Verification and rollback remain bounded

The RED/type check is `npx tsc --noEmit` before the helper exists and must fail on the new helper import. Then run `npx tsc --noEmit`, `npm run lint`, and `git diff --check`. No synthetic or approval test is part of this change.

#### Scenario: Scope and rollback are exact

- GIVEN this change moves proven local test helpers into one test-only module
- WHEN the change is reviewed or reverted
- THEN only the helper extraction and quote-test imports are in scope, with no new runtime contract
- AND observable quote-test behavior remains identical and no synthetic or approval test is included
