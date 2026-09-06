## Exploration: week-03-postgres-integration-harness

### Current State

The repository has one real disposable PostgreSQL integration test: `tests/quote-registration-intents-runtime.test.ts`. It starts a `postgres:16-alpine` container with `docker run --rm -d --name ...` and no published port, waits with container-local `pg_isready`/`psql`, invokes `psql` through `execFile`/`execFileSync`, bootstraps minimal `anon`, `authenticated`, and `service_role` roles plus `auth.uid()`, `auth.role()`, Storage tables, helpers, grants, and `pgcrypto`, then applies migrations from `db/migrations` in lexical filename order. It creates a <=0056 template and separate live/full databases, tests the 0057/0058/0059/0060 quote cutover, runs RLS and SECURITY DEFINER paths, executes two registrations with `Promise.all`, and removes the named container in `finally`.

The implementation is useful but tightly coupled to quote fixtures, hard-coded database names and IDs, a mutable migration discovery rule, and a process-derived container name. It does not expose a reusable session/claim API, manifest integrity guard, ownership preflight, bounded subprocess policy, barrier primitive, or a package-level integration-test entry point. `package.json` has no database runtime-test script and no dependency is needed for the existing Node `child_process`, filesystem, crypto, and `node:test` approach. No OpenSpec config file is present; the existing change/spec folders are the repository convention.

### Affected Areas

- `tests/quote-registration-intents-runtime.test.ts` — extract only infrastructure and fixture-neutral helpers; retain the quote test and its existing live/full behavioral assertions.
- `scripts/postgres-integration-harness.ts` (new) — smallest reusable Docker lifecycle, shell-free exec, migration manifest, bootstrap, session claims, barriers, timeout, and cleanup boundary.
- `tests/postgres-integration-harness.test.ts` (new) — focused harness contract tests for lifecycle, manifest rejection, roles/claims, RLS/SECURITY DEFINER, transaction isolation, and two-session concurrency.
- `db/migrations/*.sql` — read-only inputs; selected canonical migrations must be declared explicitly rather than inferred from every file.
- `package.json` — add a clearly opt-in script such as `test:postgres-integration`; do not add a dependency or make the normal test/lint/build path start Docker.
- `docs/ENVIRONMENT.md` — document the opt-in variable, local Docker prerequisite, image/cache policy, and explicit absence of secrets/network/host ports.
- `docs/PROGRESS.md` — record verified local harness capability only after implementation verification; do not claim Supabase service parity or production readiness.

### Smallest Reusable Boundary

Use one TypeScript module with dependency injection for command execution and clock/sleep only where necessary. Its public surface should stay narrow:

```ts
type Migration = { name: string; absolutePath: string; sha256: string };
type MigrationManifest = { schema: 'actravel.postgres-migrations/v1'; migrations: Migration[]; sha256: string };
type Harness = {
  containerName: string;
  manifest: MigrationManifest;
  psql(database: string, sql: string, options?: { role?: string }): Promise<string>;
  session(database: string, options?: { role?: 'anon'|'authenticated'|'service_role'; userId?: string }): SqlSession;
  createDatabase(name: string, template?: string): Promise<void>;
  apply(database: string, names: readonly string[]): Promise<void>;
  barrier(count: number, timeoutMs?: number): Barrier;
  cleanup(): Promise<void>;
};
type SqlSession = { query(sql: string): Promise<string>; close(): Promise<void> };
```

`startPostgresHarness({ image, selectedMigrations, timeoutMs, signal })` must return the handle only after the exact container is ready. `docker run` must use a generated, collision-resistant name, `--rm`, `-d`, `--name`, `-e POSTGRES_PASSWORD=...`, and no `-p`/`--publish`; the password is a fixed disposable test value held only in the child environment, never logged or returned. Image input defaults to the exact repository contract `postgres:16-alpine`; an optional override is allowed only when it is an approved immutable digest/tag policy and is never pulled by the helper. Tests should use a pre-cached image; no network-enabled pull, registry login, Supabase CLI, linked project, or remote endpoint is permitted. A missing image fails with a safe setup error explaining how to cache it, without echoing command output that might contain environment values.

All Docker commands must use `execFile`/`execFileSync` argument arrays—never `sh -c`, shell interpolation, or a shell pipe. Container `psql` is invoked as `docker exec -i <exact-name> psql -X -v ON_ERROR_STOP=1 ...`; SQL is passed through stdin or `-c` as one argument. Database names, migration names, roles, and identifiers are validated against closed grammars before insertion; SQL literals use a dedicated literal encoder and identifiers use a dedicated identifier quote function. Capture stdout for assertions, but redact/normalize stderr and return only stable error codes such as `PG_HARNESS_TIMEOUT`, `PG_HARNESS_SIGNAL`, `PG_HARNESS_DOCKER_UNAVAILABLE`, `PG_HARNESS_IMAGE_MISSING`, `PG_HARNESS_SQL_FAILED`, or `PG_HARNESS_CLEANUP_FAILED`.

### Migrations and Bootstrap

Build a committed, explicit manifest from selected names and LF-normalized file bytes. The manifest must reject traversal, duplicates, missing files, non-`NNNN_name.sql` names, non-canonical line endings, and selections not in the repository migration directory. Hash each migration with SHA-256 and hash the canonical manifest (excluding no required fields accidentally); record the manifest hash in test diagnostics. Apply in numeric/filename order supplied by the manifest, with `ON_ERROR_STOP=1`, and fail before running tests if a hash changes. The quote test needs two declared chains: `0001`–`0056` plus `0058`/`0059` for the live-compatible branch, and `0001`–`0060` (including `0057`) for the full branch; its existing assertions around 0060 remain authoritative. Harness integration tests may additionally select `0061`–`0064` in order for the current Week 03 schema.

Bootstrap must be a deterministic, idempotent SQL fixture executed as the superuser before application migrations: create only `anon`, `authenticated`, and `service_role` (`nologin`, with `service_role` `bypassrls`), schemas `auth`, `storage`, and `extensions`, `pgcrypto`, minimal `auth.users`, `storage.buckets`, `storage.objects`, `auth.uid()`, `auth.role()`, and `storage.extension()`, then grants required by the selected migrations. Do not emulate GoTrue rows beyond the minimum schema required by migrations. Seed test users/profiles/roles/lead or task fixtures in a separate named fixture function so generic setup has no business data.

### Roles, Claims, Sessions, and Tests

`session()` must establish claims on every independent connection with `set_config('request.jwt.claim.sub', ..., false)`, `set_config('request.jwt.claim.role', ..., false)`, and `set role ...`; it must support anonymous, authenticated user, and service-role sessions. Claims are session-local, never process-global, and user IDs/roles are validated before SQL generation. The helper must provide explicit reset/transaction methods so tests can prove `auth.uid()`, `auth.role()`, RLS visibility/denial, SECURITY DEFINER privilege boundaries, and rollback/commit behavior without relying on the superuser connection.

Two concurrent independent `psql` sessions must be created as separate `docker exec` child processes. `Promise.all` alone is insufficient for deterministic contention: expose a barrier backed by two promises in TypeScript, release both workers only after both have reached the barrier, and use SQL row locks/advisory locks plus short `lock_timeout`/`statement_timeout` values. Tests should cover one winner/one idempotent replay for quote registration and at least one Week 03 idempotency/RLS transaction case. A barrier timeout must reject all waiters and terminate/await their child processes; it must not leave a blocked backend behind.

The preserved quote runtime test should import the harness, retain its `RUN_QUOTE_REGISTRATION_DB_TESTS=1` opt-in, keep its two database-chain semantics and fixture assertions, and remove only duplicated Docker/psql/bootstrap/claim/migration mechanics. A harness test may use a tiny temporary database/table, but should also exercise the selected canonical `0061`–`0064` chain where that is necessary to prove current integration coverage.

### Timeouts, Signals, Ownership, and Cleanup

Use a whole-test deadline (suggested 240 seconds, matching the existing test), per-command timeout, readiness deadline with bounded polling, and SQL `statement_timeout`/`lock_timeout`. Propagate an `AbortSignal` to every child process; map abort, timeout, non-zero exit, and startup failure to safe typed errors. The cleanup contract is unconditional: `cleanup()` must attempt removal in `finally`, use the exact generated container name only, verify ownership with a Docker label such as `com.actravel.test-harness=<nonce>` before removal, and tolerate an already-removed `--rm` container. Never run broad `docker rm`, prune, or label-free name cleanup. Cleanup errors must fail the test unless the container is proven absent; the original test error remains primary and cleanup is attached only as a stable code.

The opt-in guard must be checked before Docker discovery and must be explicit (`RUN_POSTGRES_INTEGRATION_TESTS=1`, with the quote suite retaining its existing flag or adopting the common flag without changing default skip behavior). Default CI/unit commands remain Docker-free. No environment file loading, Supabase URL/key lookup, `SUPABASE_DB_URL`, production credentials, host port, network call, package install, or external service is allowed.

### Approaches

1. **Extract the existing Docker harness into a shared TypeScript module (recommended)** — move only lifecycle, `psql`, manifest, bootstrap, claims, and concurrency primitives; keep quote-specific setup/assertions in the current test.
   - Pros: smallest change, preserves proven quote coverage, no dependency, no host port, direct PostgreSQL/RLS evidence, supports future Week 03 tests.
   - Cons: still uses Docker CLI and a deliberately incomplete Supabase-compatible surface; SQL fixture maintenance remains local.
   - Effort: Medium.

2. **Add a separate generic test runner or database library** — use a new process runner/`pg` client abstraction and rewrite the quote test around it.
   - Pros: richer connection/session control and potentially cleaner long-lived sessions.
   - Cons: new dependency and connection semantics, larger rewrite, more secret/config risk, and unnecessary divergence from the working container-local `psql` path.
   - Effort: High.

3. **Use Supabase CLI/full local stack** — rejected by the maintainer for this change.
   - Pros: closer Auth/PostgREST/Storage service composition.
   - Cons: larger lifecycle and port surface, dotenv/linked metadata risks, slower and less deterministic, contrary to the selected disposable PostgreSQL scope.
   - Effort: High.

### Recommendation

Proceed with Approach 1. Extract a small, dependency-free harness around the existing test rather than introducing a new client or stack. Keep migration selection explicit and hash-bound, keep sessions as independent container-local `psql` processes, and preserve the current quote runtime test as a regression consumer. The harness proves PostgreSQL, RLS, SECURITY DEFINER, `auth.uid` claim semantics, transactions, and SQL contention; adapter auth/client behavior remains in injected TypeScript tests. It does **not** prove GoTrue, PostgREST, cookie transport, JWT signing/verification, Supabase Storage HTTP behavior, or hosted/production parity.

### Risks

- A generic bootstrap can silently drift from Supabase schemas; keep it minimal, named, and migration-driven, and state the compatibility boundary in docs.
- Hash guards can be defeated by inconsistent newline normalization or auto-discovered files; hash exact LF-normalized bytes and use an explicit allowlisted manifest.
- `set role` and claim GUCs are connection-local; never reuse a session across actors or assume `Promise.all` implies simultaneous entry.
- Docker daemon/image absence, CI resource pressure, and signal races can produce false negatives; bound every wait and make cleanup ownership-checked and observable through safe codes.
- Migration dependencies may make a “selected” chain invalid; fail at bootstrap with the first named migration/error code rather than auto-expanding the selection.
- `postgres:16-alpine` is a mutable tag; cache policy should pin/record the resolved image digest when available while retaining the requested default image contract.

### Rollback

Delete the new harness module/test and package script, restore the quote test’s local helper definitions, and remove only the added environment/documentation entries. No migration or production rollback is required because this change must not alter SQL files, remote databases, secrets, or application behavior.

### Workload

Expected implementation scope is two new test-support files plus the quote-test extraction, one opt-in package script, and small environment/progress documentation updates. No package dependency is needed. A practical budget is roughly 350–550 authored lines for the harness/tests combined, excluding migration SQL and planning artifacts; stop and rescope if the helper becomes a second test framework.

### Ready for Proposal

Yes. The proposal should name the shared harness extraction, explicit migration/hash manifest, preserved quote regression, independent claim-aware sessions, deterministic barrier-based concurrency, and fail-closed Docker ownership/cleanup. It should explicitly exclude Supabase CLI/full stack, HTTP/Auth service parity, host ports, secrets, remote/production access, package installation, and business approval implementation.
