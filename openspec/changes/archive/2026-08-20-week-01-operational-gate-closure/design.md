# Design: Week 01 Operational Gate Closure

## Technical Approach

Run a serialized, fail-closed evidence pipeline: declaration and identity → fixed read-only inspection → reviewed dispositions → amended `0057` absence/effect-equivalence decision → local A/B recovery → isolated exact-ref types → authorized validation → stale-link inventory → proposed gate → fresh independent final gate. Production is never mutated. `0061+` remains separately gated and prohibited from automatic execution; Week 02 may become the next planning cycle only after the amended proof is independently confirmed.

## Architecture Decisions

| Decision | Choice | Rejected / rationale |
|---|---|---|
| Authority | `ExecutionDeclaration` binds absolute repo, HEAD, index/worktree digest, production ref/URL, manifest, tools, actors, timestamps, temp A/B IDs/roots/ports, credential variable **names**, network boundary, and cleanup deadline. Missing/mismatch blocks before production contact. | Human prose is not reproducible authority. |
| Production | Exact ref-pinned Supabase MCP only; allowlisted `SELECT`/catalog queries in `BEGIN READ ONLY`, local timeout, ON_ERROR_STOP equivalent, and captured `transaction_read_only/current_user`. Type generation is a separate allowlisted read-only operation. | Application functions, unrestricted CLI/psql, DDL/DML, restore, replay, repair, and provider mutation are prohibited. |
| Rehearsal | CLI `v2.101.0` and matching PostgreSQL clients in isolated temp HOME/cache/config/package root; byte-identical migrations and manifest verified; distinct sequential A/B Docker projects, identities, volumes, and ports. | Hosted branches and shared state cannot prove disposable recovery. |
| Types/gate | Exact-ref types are hashed in temp, injected only into clean exact-HEAD worktree, then copied to tracked file only after all preliminary gates and maintainer authorization bind HEAD+payload hash. The amended absence/effect-equivalence decision is explicit and does not rewrite history. One state only: `PASS`, `PASS WITH FOLLOW-UP`, or `BLOCKED`. | Network fallback, app/schema edits, fabricated `0057` provenance, or ambiguous statuses force `BLOCKED`. |

## Execution and Data Flow

`declaration → MCP read-only packet → dispositions → A migrations/invariants → full custom-format backup + roles/grants → fresh B restore/invariants → cleanup/recovery sign-off → temp types/validation → guarded docs/type update → cleanup → independent final sign-off → GateRecord`.

`ExecutionDeclaration` roles: operator=`apply executor`; authorizer=`calebdani`; production read-only role explicitly declared; recovery verifier and final verifier are fresh, independent agents, each distinct from operator/authorizer. It records absolute repo path, HEAD SHA, index/worktree digest, exact production ref/URL identity rule, UTC timestamps, pinned executable absolute paths, versions/SHA-256, Docker/Postgres/`pg_dump`/Node/npm versions, migration-manifest hash, A/B project IDs/temp roots/ports, network boundary, and cleanup deadline. Credential variable names only—never values. Any missing or mismatched field blocks before production contact.

Production SQL is a fixed, content-hashed allowlist of migration metadata, schemas/tables/data counts, columns/defaults/nullability, extensions, functions/triggers, policies, constraints, ownership, and grants; each query is wrapped in read-only transaction/timeout and captures read-only/current-user assertions without unsafe identity/secret storage. Raw bytes remain authoritative; normalized SQL is UTF-8, LF, whitespace-trimmed, deterministically ordered, quoted-identifier-safe review material.

## Interfaces / Contracts

```text
Observation = {id, raw_sha256, normalized_sha256?, source_locator, captured_utc,
  authorized_utc, verified_utc, actor, verifier, manifest_sha256, classification}
Disposition = {observation_id, classification, disposition, owner, authorizer,
  verifier, reviewed_utc, manifest_sha256}
Review = {subject_hash, actor, role, captured_utc, authorized_utc, verified_utc}
GateRecord = {state: PASS|PASS WITH FOLLOW-UP|BLOCKED, payload_hash, HEAD,
  observation_hash, invariant_A_hash, invariant_B_hash, cleanup_receipt,
  recovery_signoff, final_signoff, blockers}
```

Local A applies every repository migration fail-on-error and captures canonical stable ordered invariants. A creates a full custom-format logical backup of explicitly listed application-owned schemas/data (not schema-only), with matching PostgreSQL client, explicit DB URL, and `--no-owner` where required; roles/ownership/grants excluded by custom dump are captured separately and backup hash recorded. Fresh B is prepared by stopping/resetting only its disposable stack, dropping/recreating the explicitly listed application-owned schemas, and confirming an empty target; it never touches production. B restores with matching `pg_restore`, fail-on-error and single transaction where supported, then compares **all** mandatory invariants above—no “where feasible” omissions. Any omission/mismatch blocks. Always-run success/error/signal cleanup stops both IDs without a new backup, removes containers/networks/volumes, HOME/cache/config, credentials, backup, workspaces/worktrees, and records filesystem/Docker absence; retain only redacted/hash evidence. Recovery sign-off binds backup, invariant, and cleanup hashes and is local-only.

## File Plan and Changed-Line Rules

| Path | Action | Guard |
|---|---|---|
| `packet/` ignored evidence | Create | Sanitized/hash-only manifest, reviews, sign-offs, receipts; command tracing disabled; secret finding deletes raw evidence and blocks. |
| `lib/supabase/database.types.ts` | Conditional modify | Preserve/verify byte preimage and rollback; exact payload only after authorization. |
| `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/implementation/ACTIVE.md` | Conditional modify | Deterministic stale-link inventory and exact archive paths; only bounded lines. Preserve `docs/about/helps/intakes/image.png`. |
| `db/migrations/**`, tracked Supabase config, root manifests/lockfiles, app files | Prohibited | Reject any change; `0061+` prohibited regardless of gate outcome. |

Pinned tooling uses temporary package root and captures npm integrity/package-lock, absolute executable, version, and SHA-256. Reject any path outside the explicit docs/type allowlist. Types use `npm ci` from lockfile, project-local `./node_modules/.bin/tsc --noEmit` (no network fallback), lint, build, quote tests, and relevant smoke assertions with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`. Clean validation requires maintainer authorization bound to HEAD+payload hash, guarded main-worktree validation, and rollback verification.

The evidence manifest records command IDs, exact sanitized argv/query hashes, tool versions, raw/normalized hashes, UTC start/end, exit status, and actors. Command tracing is disabled. Raw secret-bearing output is scanned/redacted/deleted before packet inclusion; any secret finding deletes the affected evidence and forces `BLOCKED`. The final verifier reviews only after types, docs, cleanup, and the gate candidate exist; recovery sign-off and final sign-off remain separate.

## State Machine, Rollback, and RED Tests

`UNDECLARED → BLOCKED`; `DECLARED → IDENTITY_PROVED → DISPOSITIONS_COMPLETE → ABSENT_EFFECT_AMENDMENT_BOUND → RECOVERY_SIGNED → COMPATIBLE → VALIDATED → CLEANED → PROPOSED_FINAL → FINAL_VERIFIED → PASS|PASS WITH FOLLOW-UP`; any missing, mismatch, failure, secret, unexpected path, cleanup defect, fabricated provenance, or verifier self-overlap transitions to `BLOCKED` (terminal). Roll back partial docs/types from preimages as appropriate, but never reverse provider history.

RED tests must cover wrong ref/URL/role, non-read-only or non-allowlisted SQL, function/CLI/psql invocation, missing actor/UTC/hash/classification, migration drift, altered migration bytes, CLI/tool/version/hash mismatch, shared A/B identity, failed migration/backup/restore, every invariant omission/mismatch, incomplete cleanup, secret leakage, network/tsc fallback, dirty or foreign worktree, unauthorized type copy, app/schema change, stale-link/image change, duplicate gate, and `0061+` attempt. Safe behavior is no production contact or tracked change; failure is `BLOCKED`.

## Threat Matrix

| Boundary | Applicability, safe/failure behavior, RED |
|---|---|
| Documentation-like paths | **Applicable**: classify docs/type allowlist; reject executable or unlisted paths. RED `README.sh`, MDX, `requirements.txt`, and path escape. |
| Git repository selection | **Applicable**: absolute exact repo/worktree only; reject relative/foreign/changed HEAD. RED `git -C`/relative selector. |
| Commit state | **Applicable**: inspect HEAD/index/worktree digest; preserve image and stage only allowlist. RED staged image/unexpected diff/empty-index ambiguity. |
| Push state | **N/A**: no push or destination resolution exists; RED not required. |
| PR commands | **N/A**: no PR automation or composed PR command exists; RED not required. |

## Migration / Rollout

No migration is created, allocated, replayed, or edited. Week 02 can advance only on complete verified proof; `0061+` is prohibited in this change even on `PASS` or `PASS WITH FOLLOW-UP`. Any later migration allocation is a separate change.

## Open Questions

None. All inputs are mandatory declaration fields; absent, stale, unverifiable, or conflicting inputs fail closed.
