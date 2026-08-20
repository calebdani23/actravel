# Tasks: Week 01 Operational Gate Closure

## Review Workload Forecast

| Field | Value |
|---|---|
| Authored changed lines | 250–450 |
| Generated changed lines | ~2,238 (`lib/supabase/database.types.ts`: 1,105 additions/765 deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 evidence/recovery; PR 2 isolated types/validation; PR 3 guarded generated types/docs/gate |
| Delivery strategy | stacked-to-main; slice 1 explicitly authorized as `size:exception` with hard cap 900 authored lines |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Declaration, read-only observations, dispositions, review | PR 1 | manifest/red-test suite | exact-ref MCP read-only packet | packet only; no tracked files |
| 2 | Local A/B backup, restore, invariants, cleanup, recovery sign-off | PR 1 | rehearsal/red-test suite | pinned CLI + Docker A/B | disposable roots/volumes/backup |
| 3 | Exact-ref isolated type compatibility | PR 2 | `tsc --noEmit`, lint, build, relevant tests | clean exact-HEAD worktree | temporary worktree/type copy |
| 4 | Guarded tracked output, links, final gate | PR 3 | full validation and gate checks | guarded main-worktree harness | type/docs preimages; preserve image |

## Phase 1: Declaration and Production Evidence

- [x] 1.1 RED-test identity, privilege, query, secret, unexpected-path, dirty-worktree, image, and `0061+` failures; safe result is no production contact/change and `BLOCKED`.
- [x] 1.2 Create execution declaration/preimages and fixed-hash allowlist for exact repo/HEAD/ref/URL, read-only role, actors, UTC evidence, tools, credential names, and protected `docs/about/helps/intakes/image.png`.
- [x] 1.3 Capture allowlisted MCP observations in read-only transactions, including current user/read-only assertions, raw/normalized hashes, and migration/schema/catalog definitions.
- [x] 1.4 RED-test missing/duplicate identity, privilege, query, actor, UTC, hash, classification, role-independence, and secret evidence; record maintainer dispositions and independent provider review.

## Phase 2: Isolated Recovery

- [x] 2.1 RED-test CLI/version/hash, migration drift/byte alteration, shared A/B identity, failed migration/backup/restore, and missing backup/role/grant evidence.
- [x] 2.2 Provision pinned CLI/Postgres clients in isolated HOME/cache/config; verify migration bytes/manifest; apply all migrations to disposable A and capture full custom-format backup plus roles/grants.
- [x] 2.3 Restore into fresh distinct B with matching `pg_restore`; compare every required migration, schema, RLS, routine, trigger, policy, constraint, ownership, grant, and data invariant.
- [x] 2.4 RED-test every invariant omission/mismatch and incomplete cleanup; always stop/reset A/B, remove volumes, credentials, backup, worktrees, and record absence.
- [x] 2.5 Obtain independent recovery verifier sign-off — combined retained/supplemental manifest `6b88c8f1433068f2b0f5b9db2f7ffa8e08b2642172ea284ac398f16a80d369a0`; signoff `d87c91cc0592780c09230d9ac8b396823a6d676d16b2e35f935eb97ea454faee`; local prepared-target limitation explicit.

## Phase 3: Isolated Types and Validation

- [x] 3.1 RED-test network/tsc fallback, foreign/dirty worktree, unauthorized type copy, app/schema change, and type incompatibility; failure remains `BLOCKED`.
- [x] 3.2 In an exact-ref isolated worktree, hash and inject remote types; run project-local TypeScript, lint, build, quote tests, and smoke assertions with external boundaries disabled.
- [x] 3.3 After clean preliminary gates and maintainer HEAD+payload authorization only, conditionally copy `lib/supabase/database.types.ts`; exact target already matched the authorized generated SHA, so no copy/regeneration occurred.

## Phase 4: Cleanup and Final Gate

- [x] 4.1 RED-test stale-link, image-change, duplicate-gate, secret, and final-gate failures; preserve the image and reject unlisted paths.
- [x] 4.2 Correct only bounded stale links in `docs/DECISIONS.md`, `docs/PROGRESS.md`, and `docs/implementation/ACTIVE.md`; update no migrations, app files, lockfiles, or `0061+`.
- [x] 4.3 Publish one evidence manifest with preimages, hashes, command IDs, sign-offs, cleanup receipt, and exactly one `PASS`, `PASS WITH FOLLOW-UP`, or canonical `BLOCKED` record.
- [x] 4.4 Obtain independent final verification and one final gate; production recovery is proven by manifest `24a882a7158383c946b99c1ea55374f6c2f7b038fd30441f56e39f8510e10fe3`, but the pre-amendment verdict is `BLOCKED` because historical `0057` execution provenance is unproven; `0061+` remains separately gated.
- [x] 4.5 Apply maintainer-approved amendment token `sha256:10f4ad85c10c004edab347f07603c0465d29bd7f812d54fc6025c262e592232d`: record `0057` as `ABSENT_WITH_EFFECT_EQUIVALENCE` (not executed), bind the canonical 59-row ledger, exact LF-normalized local/production `0060`, live durable effects, category aggregate `45f3a8...b394`, production recovery `24a882...0fe3`, provider/recovery/type/prior receipts, and publish a proposed `PASS` pending fresh independent verification; do not allocate or auto-run `0061+`.
