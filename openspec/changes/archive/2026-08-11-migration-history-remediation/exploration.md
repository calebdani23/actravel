## Exploration: migration-history-remediation

### Current State

The archived `baseline-reconcile` evidence is a read-only **PASS WITH FOLLOW-UP**, not a migration-allocation gate. Local `db/migrations/` contains 59 numbered files through `0060`, with no local `0051`; authoritative remote history contains 59 rows but a different provenance shape. No history repair, production mutation, tracked type regeneration, backup/restore, or staging rehearsal has been performed or proven.

The discrepancies are not interchangeable:

| Finding | Classification | Safe interpretation |
|---|---|---|
| Remote `0051_crm_resolver_advisor_visibility_hotfix` | `remote-only/untracked` | Remote ledger has a CRM hotfix with no local body. Obtain authoritative provenance; do not synthesize it from final state. |
| Remote `drop_public_rate_limits_write_policy` | `remote-only/untracked` | The final rate-limit policy state is known, but the distinct ledger row is not locally represented. Preserve the remote row. |
| Local `0020_catalog_media_columns_fix.sql` | `ambiguous/manual-review` | All eight media columns exist remotely, but that does not prove whether this file ran, was bundled, or was manually applied. Do not replay it. |
| Remote `0044`–`0049` | `ambiguous/manual-review` | The six named rows store identical `select 1;` placeholders while local files contain substantive CRM RPC/RLS/data-integrity SQL. Their rows do not prove those bodies ran. |
| Local `0057_quote_rpc_cutover.sql` absent remotely | `local pending` | `0060` repeats the critical direct-write revocation and removes compatibility writers. Do not apply `0057` retroactively. |
| Legacy names/prefix variants | `represented/applied` | Numeric-prefix omissions and the remote package name are semantic representations, not reasons to rewrite history or duplicate migrations. |

The system has four separate truth planes: (1) schema behavior and live RLS/functions/policies, (2) the Supabase migration ledger and its stored statements, (3) local migration filenames/bodies/checksums, and (4) generated TypeScript declarations. A matching live object cannot prove ledger provenance; a ledger row cannot prove the local body was used; local presence cannot prove remote application; and generated types are a derived client contract, not migration history. The archived comparison proves tracked type drift, but alignment is unresolved, so `lib/supabase/database.types.ts` must remain untouched.

The substantive placeholder subjects are security- and integrity-sensitive: `0044`–`0049` include bulk mutation RPCs, resolver behavior, CRM governance and RLS, test-data purge guards, archive/restore controls, and aggregate filters. Replaying or replacing any history row could change authorization, deletion, visibility, or data-integrity behavior. The quote chain also depends on the intentional `0057`/`0060` relationship: `0060` is independently safe after the remote `0053`–`0056`, `0058`, and `0059` path, but this is a behavioral conclusion, not permission to repair the ledger.

### Affected Areas

- `openspec/changes/archive/2026-08-11-baseline-reconcile/migration-inventory.md` — authoritative bounded inventory and discrepancy classifications.
- `openspec/changes/archive/2026-08-11-baseline-reconcile/reconciliation-report.md` — seven-part approval packet, recovery gaps, and explicit no-`0061` gate.
- `openspec/changes/archive/2026-08-11-baseline-reconcile/verify-report.md` — independently verified evidence and unchanged-type boundary.
- `openspec/specs/baseline-reconciliation/spec.md` — exclusive classifications and non-destructive/type-regeneration gates to preserve.
- `db/migrations/0020_catalog_media_columns_fix.sql` — unresolved media-column provenance; idempotent syntax does not make replay evidentially safe.
- `db/migrations/0044_crm_bulk_mutation_rpcs.sql` through `0049_crm_contact_aggregate_filters.sql` — substantive local SQL contradicted by remote placeholder statements; inspect only, never assume applied.
- `db/migrations/0057_quote_rpc_cutover.sql` and `db/migrations/0060_quote_pdf_creation_cutover.sql` — missing-ledger-row versus absorbed final behavior.
- `lib/supabase/database.types.ts` and `package.json` — generated schema contract and `npm run db:types`; regeneration remains gated.
- `tests/crm-governance-contract.test.ts`, `tests/admin-quotes.test.ts`, `tests/quote-pdf-creation-cutover-contract.test.ts`, and related contract tests — local behavioral/RLS expectations that can support a rehearsal, but cannot establish provenance alone.
- `.env.example`, `docs/ENVIRONMENT.md`, and Supabase project metadata — identity names and deployment assumptions only; project role, staging separation, backup coverage, and tested restore remain unproven.

### Approaches

1. **Provider-native history repair** — use the provider/CLI history-repair mechanism to reconcile ledger rows or names after obtaining exact authoritative provenance.
   - Pros: preserves the provider's ledger model when the original migration identity is proven; avoids inventing a new schema migration.
   - Cons: history mutation can affect future push/pull behavior without changing schema, and wrong version/name/statements can conceal drift; rollback is ledger-specific and not equivalent to database rollback.
   - Effort: High.
   - Gate: explicit maintainer and production-target authorization, exact SQL/provenance, verified environment, backup/restore evidence, and a disposable staging rehearsal first.

2. **Local historical representation / no-op records** — add repository files that document or no-op historical entries without claiming they reproduce remote SQL.
   - Pros: improves local discoverability and sequence representation; local-only changes are reversible and do not mutate production.
   - Cons: a no-op file cannot prove or repair remote provenance; adding a file under a historical number may falsely imply application and can collide with provider ordering. It is appropriate only when clearly labeled as representation and accepted as non-authoritative.
   - Effort: Medium.

3. **Compensating migration** — create a future additive migration that restores a specifically proven missing schema behavior rather than repairing history.
   - Pros: append-only, reviewable, and can be tested against a disposable target; addresses a real live-contract gap if one is demonstrated.
   - Cons: does not solve provenance, can duplicate or conflict with unknown remote behavior, and could alter RLS, RPC, or data integrity. It must never be used to manufacture evidence for `0051`, `0020`, or `0044`–`0049`.
   - Effort: High.

4. **Defer-and-ledger-only (recommended first slice)** — preserve the remote ledger, create only a reviewed evidence/mapping register, and defer all history/schema mutation until provenance, environment, and recovery are verified.
   - Pros: fail-closed, reversible, no production risk, and cleanly separates audit metadata from database behavior.
   - Cons: leaves local/remote history non-reproducible and continues to block new DB migration allocation; requires maintainer decisions later.
   - Effort: Low to Medium.

### Recommendation

Start with a read-only remediation packet, not repair: verify the linked project's environment role, obtain approved provenance for remote `0051` and `drop_public_rate_limits_write_policy`, investigate whether local `0020` and substantive `0044`–`0049` SQL have authoritative source/rehearsal evidence, and document the `0057`-absorbed-by-`0060` behavior. Separately verify backup coverage, restore target, and a disposable staging/rehearsal path. Preserve all hashes, remote statement text where authorized, schema/RLS comparisons, and type diff; do not regenerate tracked types.

Until that packet is accepted, use defer-and-ledger-only. Provider-native repair is the only candidate for ledger mutation, and only after exact provenance plus explicit authorization. Use a local historical representation only if maintainers want an expressly non-authoritative audit aid. Use a compensating migration only for a proven live behavior gap, never for provenance cleanup.

This blocks `0061+` and all future database/schema migrations. It does **not inherently block `dependency-baseline`** if that change remains manifest/lockfile documentation and verification only; it must not regenerate types, alter migration files, or introduce schema work. The maintainer should explicitly confirm that decoupling before proposal execution because the active Week 01 sequence currently treats baseline reconciliation as the first change.

**Recommended first-slice acceptance evidence:** a sanitized project/environment identity record; complete remote/local ledger comparison; authoritative provenance or explicit unresolved dispositions for every discrepancy; live schema/RLS/helper checks for the CRM and quote boundaries; written backup/restore capability and non-production rehearsal evidence (or an explicit unavailable classification); preserved type diff with no tracked regeneration; and a signed scope gate stating no production mutation, no history repair, and no `0061+`.

### Risks

- Repairing a placeholder or remote-only row with guessed SQL could misrepresent authorization, RLS, helper grants, bulk mutation, purge, or archive behavior and make later migrations unsafe.
- Replaying `0020` or `0057` may be harmless at statement level yet still be wrong at provenance level; idempotence is not proof of historical application.
- A compensating migration could duplicate existing behavior or weaken/strengthen access controls, and database rollback cannot be assumed from application rollback.
- The linked ref may be production; no staging role, backup coverage, restore target, or tested restore is proven. Never claim backup/restore readiness from documentation alone.
- Generated type regeneration before alignment would overwrite a useful drift baseline and could make application typing appear consistent while migration provenance remains unresolved.
- Any remote history repair, DDL/DML, restore, type regeneration, or migration allocation requires separate explicit maintainer/production authorization; none is authorized by this exploration.

### Ready for Proposal

Yes, for a narrowly scoped, read-only provenance and recovery-readiness proposal using the defer-and-ledger-only first slice. The interactive proposal question round must resolve: whether `dependency-baseline` may proceed independently; whether maintainers want local non-authoritative historical files; who can authorize provider-native history repair; what exact production/staging target is approved; whether a disposable rehearsal and restore test are available; and whether any compensating migration is permitted only after a live-contract gap is proven. The proposal must retain the explicit non-goals: no production mutation, no history repair by inference, no `0061+`, no tracked type regeneration, and no claim that backup/restore is proven.
