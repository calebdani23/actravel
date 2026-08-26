# Proposal: Week 02 Gate 0 Factual Baseline

## Intent

Establish current Gate 0 facts in one concise `baseline-report.md`, then require native
`sdd-verify` to independently rerun and check them. An external parent must then perform
the native bounded review/post-apply gate before archive. This change does not authorize
itself.

## Authority Model

Authority is the agreement of:

1. factual `baseline-report.md`;
2. independent native `sdd-verify` report;
3. external-parent native bounded review receipt and post-apply gate.

There is no `gate0-approved.json`, custom authority receipt/manifest, approval pointer, canonical
self-authority, or reusable child execution engine. Disposable command capture and factual
manifests are evidence inputs only. Prior authority artifacts remain provenance only.

## In Scope

- Fresh parent-owned, read-only remote capture binding the complete canonical 59-object
  version/name table and hash from R002 to the complete SQL ledger, Manager effects, and
  absence of deferred tables.
- Exact local 60-file filename/hash manifest through `0061`, its complete ledger equality,
  and the required `0061` hash.
- One isolated temporary Supabase CLI `2.115.0` start/reset over all local migrations.
- Fixed read-only local ledger, catalog, role, policy, deferred-table, quote-function, and
  temporary generated-type assertions.
- Bounded collision-free project-ID allocation; exact observed ownership before any stop or
  removal; exact scoped cleanup.
- Byte/mode/path preservation manifests for all pre-existing tracked/untracked entries,
  dirty paths, the index, explicit protected sets, packages, active packet, and migrations.
- One disposable capture directory binding every numbered block's canonical command bytes,
  stdout, stderr, exit, hashes, and aggregate hash without retaining secrets/full types.
- A factual report of all required hashes/results; a fresh `sdd-verify` rerun; then the
  required external-parent native review/post-apply authority.

## Out of Scope

- Product schema, migration allocation, Tasks/Notifications implementation, package or
  application code, tracked generated types, remote mutation, or persistent local state.
- Generic protocols, schemas, runners, authority receipts/manifests, pointers, validators,
  or child tooling.
- Git mutation or review lifecycle from either apply or verify executor. External-parent
  native review/post-apply after verification is required delivery scope, but is outside
  Harness implementation scope.

## PASS Criteria

- Remote identity is ref `bdyhakpmxegoipbmbtjb` and URL
  `https://bdyhakpmxegoipbmbtjb.supabase.co`.
- Fresh R002 evidence is exactly 59 canonical `{version,name}` objects through `0060`; its
  exact table/hash equals the complete SQL ledger, includes remote-only `0051`, accepts
  missing `0057`, and has no `0061+`, deferred table, or Manager effect.
- Local inventory is exactly 60 canonical filename/hash rows through `0061`; source, copy,
  post-run source, and complete local ledger agree; `0061` SHA-256 is
  `979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`.
- The selected short project ID has zero pre-start label/name/container/volume/network and
  project-directory collisions; bounded regeneration otherwise ends `BLOCKED`.
- Isolated Supabase CLI `2.115.0` start and reset apply all local migrations successfully.
- Local catalog has a 60-row ledger ending at `0061`, one Manager role row,
  `roles_name_check` including Manager, `roles staff read` including Manager, no deferred
  tables, and the exact expected five-function quote state.
- Temporary generated types prove `roles.Row.name` is `string` and both deferred tables
  are absent; no tracked install occurs.
- Stop/removal follows exact ownership observation only. Scoped resources are zero after
  cleanup; temporary roots, command streams, secrets, and full generated types are absent.
  Complete path/mode/byte manifests preserve every pre-existing tracked/untracked entry,
  dirty path, index, package, active-packet file, migration, generated type, next-env, and
  protected image; only planned `baseline-report.md`, `apply-progress.md`, and `tasks.md`
  changes are allowed. Every pre-existing Docker image ID remains; additions are allowed.
- `baseline-report.md`, independent `verify-report.md`, and native review/post-apply gate
  all PASS for the same change revision.

## Size Exception

Untouched failed-run and incident provenance has a maintainer size exception. Newly
authored active Harness planning plus `baseline-report.md` targets at most 800 physical
lines, and `baseline-report.md` itself MUST be at most 177 lines. Native `verify-report.md`
is a separate delivery-review artifact outside that active-report budget.

## Downstream Boundary

After verification, native review, post-apply PASS, and archive, Tasks and Notifications
may consume the archived baseline facts. Each child still owns fresh migration/schema
verification in its own design and tasks; no protocol, tooling, or receipt is reused.

## Rollback

Remove only the new factual report and temporary resources before verification, or revert
the planning/report changes through normal review. Preserve incident reports and all prior
evidence as non-authoritative provenance. No database or product rollback applies.
