## Exploration: week-01-operational-gate-closure

### Current State

The repository is `main` at `39f7943` with one pre-existing unrelated worktree modification: `docs/about/helps/intakes/image.png` (must remain untouched). The local migration chain has 59 SQL files through `0060`; `0051` is absent and `0057` is present locally. The linked Supabase project is ref `bdyhakpmxegoipbmbtjb` (`https://bdyhakpmxegoipbmbtjb.supabase.co`), but repository/provider evidence still cannot establish whether it is production, staging, or disposable. The provider reports no development branches. Docker 29.4.1 is available, but the Supabase CLI and `supabase/config.toml` are absent.

Fresh read-only ledger evidence materially narrows the discrepancies:

- `0051_crm_resolver_advisor_visibility_hotfix` exists remotely with its full stored statement and MD5 `52ebf436c0371ddcdc7aa3acb3d27dac`; no local body exists.
- `drop_public_rate_limits_write_policy` exists remotely with the full statement `drop policy if exists "public rate limits staff write" on public.public_rate_limits;` and MD5 `97dfbe984b72acc69cf6a41621f807ad`; the live policy inventory corroborates the resulting read-only policy but not provenance.
- Remote `0044`–`0049` rows each store exactly `select 1;`, MD5 `ccb5b4481bced39454dca6d845601d54`, while local bodies are substantive and have distinct SHA-256 hashes. Live routines/triggers/policies corroborate many effects but cannot convert placeholder ledger rows into proof that local bodies ran.
- Remote `0057` is absent. Remote `0060` exists with stored statements; local `0060` deliberately repeats the relevant `0057` table cutover and removes compatibility writers. This supports a maintainer-approved no-replay disposition, not history repair or retroactive provenance.
- Remote generated types are present in ignored storage at `tmp/audit-evidence/baseline-reconcile-remote-types.ts`, SHA-256 `b6e3ea...92637`, 3,697 lines; tracked `lib/supabase/database.types.ts` is unchanged, SHA-256 `3ed53c...93436`, 3,357 lines. The deterministic diff is 1,105 additions and 765 deletions (2,238 unified-diff lines). Both artifacts expose 35 tables, but remote types expose 57 functions versus 47 tracked functions, so regeneration is mechanically possible but application/type-test compatibility is not yet proven.

#### Exact additional read-only provider queries

Run only after the exact ref/URL guard, and retain the responses with UTC capture time and hashes. These queries compare provider-stored statements and final behavior without mutation:

```sql
select column_name, data_type, ordinal_position
from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
order by ordinal_position;
```

```sql
select version, name, statements, created_by, idempotency_key, rollback
from supabase_migrations.schema_migrations
where name in (
  '0051_crm_resolver_advisor_visibility_hotfix',
  'drop_public_rate_limits_write_policy',
  '0044_crm_bulk_mutation_rpcs', '0045_crm_resolver_soft_delete_review',
  '0046_crm_governance_remediation', '0047_crm_archive_restore_controls',
  '0048_crm_test_purge_and_blocked_outbound', '0049_crm_contact_aggregate_filters',
  '0057_quote_rpc_cutover', '0060_quote_pdf_creation_cutover'
)
order by version, name;
```

```sql
select version, name,
  md5(coalesce(array_to_string(statements, E'\n'), '')) as statements_md5,
  md5(coalesce(array_to_string(rollback, E'\n'), '')) as rollback_md5,
  created_by, idempotency_key
from supabase_migrations.schema_migrations
where name in (
  '0051_crm_resolver_advisor_visibility_hotfix',
  'drop_public_rate_limits_write_policy',
  '0044_crm_bulk_mutation_rpcs', '0045_crm_resolver_soft_delete_review',
  '0046_crm_governance_remediation', '0047_crm_archive_restore_controls',
  '0048_crm_test_purge_and_blocked_outbound', '0049_crm_contact_aggregate_filters',
  '0057_quote_rpc_cutover', '0060_quote_pdf_creation_cutover'
)
order by version, name;
```

For behavior comparison, collect deterministic definitions (not just existence) for targeted routines, triggers, policies, columns, constraints, and grants:

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_get_functiondef(p.oid) as definition, md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'crm_resolve_opportunity_lead', 'crm_bulk_mutate',
  'crm_bulk_archive_opportunities', 'crm_contact_aggregate_page',
  'crm_quote_data_quality_page', 'crm_create_quote',
  'crm_link_legacy_quote_document', 'crm_accept_quote_version',
  'crm_enforce_new_quote_registration_complete'
)
order by p.proname, identity_args;
```

```sql
select tg.tgname, n.nspname, c.relname,
  pg_get_triggerdef(tg.oid) as trigger_definition,
  md5(pg_get_triggerdef(tg.oid)) as definition_md5
from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not tg.tgisinternal and n.nspname = 'public'
  and c.relname in ('quotes','quote_versions','contacts','leads','public_rate_limits')
order by c.relname, tg.tgname;
```

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (tablename in ('public_rate_limits','quote_versions') or policyname ilike '%rate%')
order by tablename, policyname;
```

These queries are necessary for comparison, not sufficient to prove local-byte provenance. The authoritative decision must explicitly say “accepted/no replay” for each discrepancy, preserve the exclusive classification, identify owner and authorizer, and avoid ledger mutation.

### Affected Areas

- `openspec/specs/baseline-reconciliation/spec.md` — defines exclusive classifications, role-based authority, read-only inspection, type preservation, recovery proof, and the single final gate.
- `docs/implementation/ACTIVE.md` and `docs/implementation/weeks/week-01-baseline-safety.md` — keep Week 01 active and prohibit `0061+` until every gate is proven.
- `db/migrations/0020_catalog_media_columns_fix.sql`, `0044`–`0049`, `0057_quote_rpc_cutover.sql`, `0060_quote_pdf_creation_cutover.sql` — local comparison bytes only; do not apply, repair, renumber, or edit.
- `lib/supabase/database.types.ts` and `tmp/audit-evidence/baseline-reconcile-remote-types.ts` — preserved drift comparison; tracked output must not be regenerated in this change.
- `supabase/.temp/linked-project.json`, `docs/ENVIRONMENT.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` — identity, environment-role, durable blocker, and stale-link evidence.
- `docs/about/helps/intakes/image.png` — unrelated pre-existing dirty path; explicitly protected.

### Feasibility and Blockers

1. **Discrepancy dispositions:** Feasible without ledger mutation. Current statements/hashes plus local bodies, live read-only definitions, and the maintainer’s authority can support explicit accepted/no-replay dispositions. They cannot honestly relabel missing local provenance as `represented/applied`; `0051`, the policy row, `0020`, `0044`–`0049`, and `0057/0060` remain `ambiguous/manual-review` or `remote-only/untracked` until the authoritative review is recorded. A maintainer declaration can close the decision gate while preserving those labels only if the specification’s “missing proof remains manual review” rule is respected.
2. **Environment role:** The exact ref, URL, project name, and empty branch list prove identity only. They do not prove production/staging/disposable role. Required declaration: “I, [named maintainer/role], confirm Supabase ref `bdyhakpmxegoipbmbtjb` is [role], is/is not production, and is approved/not approved for [read-only inspection or disposable rehearsal], with separation from production confirmed as [basis].”
3. **Generated types:** Mechanical regeneration is plausible because the remote artifact is a generated TypeScript payload and table sets match, but the 10 additional remote functions and signature/relationship changes mean compatibility is unverified. A disposable copy/worktree must first replace the tracked file temporarily, run TypeScript/build/lint and relevant tests, then discard it. No tracked regeneration belongs in this change.
4. **Recovery rehearsal:** No executable approved path exists now. Docker is installed, but no Supabase CLI/configuration, approved target, cost confirmation, credentials, backup identity, restore procedure, invariant checklist, cleanup proof, or independent sign-off is available. A Supabase development branch is not currently available and would require explicit cost confirmation and branch/target approval. Local Docker becomes viable only after the native CLI/configuration/tooling and a known backup source are supplied; Docker alone is not recovery evidence.

### Recovery Rehearsal Options

1. **Supabase development branch** — preferred if the maintainer confirms cost, target identity, credentials, backup source, and authorization. Restore/import the approved backup, verify migration/schema/RLS/quote invariants read-only, record start/end and hashes, delete the branch, verify cleanup, and obtain independent sign-off.
   - Pros: provider-like disposable target and closest operational rehearsal.
   - Cons: currently no branches; cost and provider authorization are external blockers; branch creation/deletion are provider mutations and out of this exploration.
   - Effort: Medium.

2. **Local Supabase/Docker** — viable only after installing/using the supported Supabase CLI and creating repository configuration outside this change, with an approved backup source and reproducible restore command.
   - Pros: avoids provider cost and production ambiguity.
   - Cons: current environment lacks the CLI/configuration; local behavior may not reproduce hosted provider state; Docker availability alone proves nothing.
   - Effort: High.

3. **No rehearsal; record unavailable** — the only safe current option.
   - Pros: no mutation, credential, cost, or production-risk exposure.
   - Cons: final operational gate remains BLOCKED.
   - Effort: Low.

### Recommended Sequence

1. **Parallel, read-only/local:** preserve the dirty image; capture current Git identity; compute local migration hashes; retain the ignored type artifact; compare local bodies to provider statement text/hashes; collect targeted provider definitions after the exact URL guard; inventory package/lockfile and safe validation capability.
2. **Parallel, maintainer input:** obtain the environment-role declaration, named owners/authorizers for each discrepancy, explicit accepted/no-replay decisions, independent reviewer identity, and recovery target/tool/cost/credential/backup authorization.
3. **Critical path:** resolve provider statement comparison and authoritative dispositions, then prove environment separation and execute the approved disposable rehearsal with restore/invariant/cleanup evidence and independent sign-off. Type compatibility verification can run in an isolated disposable copy, but tracked regeneration waits for a later authorized change.
4. **Bounded cleanup:** correct the stale durable references in `docs/DECISIONS.md`, `docs/PROGRESS.md`, and `docs/implementation/ACTIVE.md` that point to the non-existent unarchived packet path; point them to the archived packet or the new active change only after it exists. This is documentation-only and should not be mixed with migration/type/provider work.
5. Publish exactly one gate. `PASS WITH FOLLOW-UP` is defensible only if all blocking operational gates are proven and the follow-up is explicitly bounded (for example, later mechanical type regeneration with compatibility evidence). Otherwise retain `BLOCKED`; never advance Week 01 or allocate `0061+`.

### Estimated Work

| Slice | Estimate | Can parallelize? | Completion condition |
|---|---:|---|---|
| Fresh local/provider comparison packet | 2–4 hours | Yes | Stored statements, hashes, definitions, timestamps, and protected-path checks are reproducible. |
| Maintainer disposition and role review | 30–60 minutes of maintainer time | With packet collection | Every finding has one classification, disposition, owner, authorizer, and review timestamp. |
| Isolated type compatibility check | 1–2 hours | Yes, after remote artifact is available | TypeScript/build/lint/relevant tests pass or changes are explicitly identified; tracked type remains unchanged. |
| Disposable recovery rehearsal | 2–6 hours once prerequisites exist | No; critical path | Backup/restore/invariants/cleanup and independent sign-off are complete. |
| Bounded durable-link cleanup | 15–30 minutes | Yes | Only stale paths are corrected; no archive content or unrelated image is changed. |

### Risks

- The linked project may be production; no live inspection beyond explicitly approved read-only scope or any mutation should occur until role is declared.
- Placeholder remote statements for `0044`–`0049` and the absent `0057` cannot be repaired or made equal by creating a new migration.
- Schema, routines, policies, generated types, archived packets, or local tests can corroborate behavior but cannot independently prove migration provenance.
- Regenerating types may expose application/test incompatibilities despite matching table sets; tracked types must remain unchanged here.
- Recovery status must be `unavailable` when any target, cost, credential, backup, restore, cleanup, authorization, or independent-sign-off prerequisite is missing; it is not a failed or verified rehearsal.
- The existing dirty `docs/about/helps/intakes/image.png` must not be staged, restored, or otherwise modified.

### Recommendation

Proceed with a bounded evidence-and-decision proposal, not implementation. Use the fresh read-only statement queries and exact local hashes to prepare maintainer review; record explicit no-replay decisions without mutating the provider ledger. In parallel obtain the environment declaration and recovery prerequisites. Keep the final gate `BLOCKED` until the recovery rehearsal and independent sign-off are real. Include stale durable-document links as a separate, documentation-only cleanup slice.

### Ready for Proposal

Yes — for a fail-closed proposal covering read-only reconciliation, role/disposition review, isolated type compatibility assessment, and a separately gated recovery rehearsal. No — for Week 01 closure or `0061+`: environment role, independent review, full authoritative dispositions, tracked-type alignment, and verified disposable recovery are not all proven. Stop for user/provider input on environment role, cost/credentials/backup/target authorization, and independent sign-off.
