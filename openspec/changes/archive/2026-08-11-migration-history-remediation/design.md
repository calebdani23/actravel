# Design: Migration History Remediation

## Technical Approach

Create a read-only, append-only evidence packet over the existing archived `baseline-reconcile` artifacts. Freeze sanitized identity and repository state, collect local migration bytes/hashes, preserve authorized remote ledger evidence, compare only already-authorized live behavior/RLS/helper evidence, retain the generated-type drift baseline, rehearse backup/restore only against an isolated disposable local Supabase stack, then emit one deterministic gate. No history repair, DDL/DML, type regeneration, `0061+`, or production targeting is possible.

## Architecture Decisions

| Decision | Choice | Alternatives / rationale |
|---|---|---|
| Provenance authority | Ledger statements/names and local file bytes remain separate truth planes; final schema is corroboration only. | Synthesizing `0051`/placeholders or using final state would fabricate history. |
| Artifact ownership | Tracked `design.md` is architecture; later tracked packet files are owned by this change; ignored temporary outputs are disposable evidence only. | A helper script is not required initially; if task-time automation is needed, use a read-only temporary script, not a tracked migration/config change. |
| Remediation | Defer-and-ledger-only; provider-native repair is a later separately authorized change. | Historical/no-op and compensating migrations falsely imply provenance or can alter protected behavior. |
| Gate | Exactly `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`; unresolved provenance/recovery/target/authorization means no `0061+`. | “Best effort” status is not deterministic safety. |

## Data Flow and Artifacts

`identity → local manifest → archived remote ledger → targeted live checks → type drift → local rehearsal → register/evidence ledger → final gate`

Planned ownership:

| Artifact | Role |
|---|---|
| `migration-register.md` | Canonical human register and one disposition per discrepancy. |
| `environment-identity.md` | Sanitized project/ref, role classification, source/time; never values. |
| `evidence-ledger.md` | Evidence IDs, source plane, timestamp, command/query label, result, hash, redaction status. |
| `local-rehearsal.md` | Isolated stack, backup/restore inputs, sequence, cleanup, and limitations. |
| `final-gate.md` | Single gate, allocation answer, blockers, approvals, and reviewer traceability. |
| ignored temporary workspace | Raw/local manifests, temporary remote types/diff, logs, and backup metadata; never tracked or secret-bearing. |

Each discrepancy row has `{id, migration_identity, object_identity, local_name, remote_name, classification, planes[], evidence_ids[], source_timestamps[], owner, blocker, disposition, authorization_state}`. Validation rejects missing fields, duplicate IDs, and any row not having exactly one of `represented/applied | remote-only/untracked | local pending | ambiguous/manual-review`.

Collection is deterministic: sort local filenames numerically; hash file bytes SHA-256; record remote version/name/statements and provider hash only when authorized; hash canonical sanitized evidence with stable key ordering. Never manufacture remote bodies, equate MD5 with local SHA-256, or infer application from schema/RLS or generated types. Preserve the existing tracked/temporary type diff byte-for-byte without regeneration.

Explicit rows: remote `0051` and `drop_public_rate_limits_write_policy` → `remote-only/untracked`, provenance blocker; local `0020` and remote `0044`–`0049` placeholders → `ambiguous/manual-review`, no replay; local `0057` → `local pending`, absorbed by `0060`, not replayed. Prefix/name variants and proven semantic equivalents remain `represented/applied` without rewrite.

## Rehearsal, Safety, and Gates

The local rehearsal first proves target is disposable and not linked/production, snapshots identity, starts the repository-supported local stack using task-time-validated official Supabase semantics, captures migration application/backup metadata, restores into an isolated disposable target, verifies expected protected contracts, records timestamps/outcomes, then destroys/cleans the target and temporary files. `verified`, `failed`, and `unavailable` are exclusive; timeout, identity uncertainty, restore mismatch, or unavailable tooling fails closed. Local proof explicitly cannot establish remote or production readiness.

Redact env values, tokens, URLs containing credentials, cookies, SQL literals with secrets, and provider payloads. Require external-boundary-disabled validation and reject any production-looking target, mutation-shaped command, unallowlisted executable, nonzero/timeout, or scope request touching migrations, schema, database, generated types, or config. Gates assert unchanged migration/type/schema/database state and preserve RLS, CRM, quote, purge, archive/restore, helper grants, authorization, and data-integrity invariants.

Threat matrix: shell/subprocess **Applicable** (allowlist, fixed cwd, fail closed; RED command failure/timeout); database/process **Applicable** (read-only only; RED mutation-shaped request); executable classification **Applicable** (reject unknown executable; RED rejection); routing/VCS/PR automation **N/A** (none designed).

## Verification, Recovery, and Review

Verify schema requirements/scenarios through register-to-evidence IDs; run existing lint/build and relevant CRM/quote/Storage contracts only where evidence declares impact, with external boundaries disabled. Every output records exit status, source time, sanitized summary, and deterministic hash. Resume by evidence ID and immutable input hash; rerun only incomplete collection stages. Rollback removes packet/docs and disposable rehearsal artifacts only—never assumes database rollback.

`dependency-baseline` may run in parallel only for manifest/lockfile inventory and verification; any migration/schema/type/database drift becomes a blocked finding. Forecast: reviewers inspect artifact ownership and threat gates first, then discrepancy rows, then rehearsal/type evidence and final gate; concentrated review is approximately 400–800 lines across the packet, with unresolved rows requiring owner decisions.

## Migration / Rollout

No migration required; no tracked historical/no-op or compensating migration is selected.

## Open Questions

- [ ] Approved non-production rehearsal target and backup/restore capability remain to be verified.
- [ ] Authoritative provenance owners for `0051`, the rate-limit row, `0020`, and `0044`–`0049` remain to be named.
