# Baseline Reconciliation Report

**Change:** `baseline-reconcile`  
**Work unit:** `baseline-evidence-and-report`  
**Evidence date:** 2026-08-10  
**Scope:** Read-only repository and Supabase evidence; no database or provider mutation.

## Executive decision

**Final gate: PASS WITH FOLLOW-UP**

**Safe to allocate the next migration identifier? No.** The quote end state is explainable, but remote-only `0051`, absent `0057` history, the ambiguous `0044`–`0049` provenance signal, unverified environment separation/recovery, and proven generated-type drift require follow-up before allocating `0061`. Type drift is proven; tracked regeneration is required but deferred because alignment is unproven.

## Evidence safety and repository state

- Current branch: `main`.
- Current HEAD: `ea2b828b0d65390f95bd2dcd06c8d26acb50339e`.
- HEAD is the merge of the documentation-archive change; the current executable baseline is not inferred from the older Blueprint SHA.
- Pre-existing unrelated paths remain untouched and unstaged: modified `opencode.json`; untracked `docs/AC_Travel_Prompt_Maestro_Opcion_2.md`; untracked `openspec/changes/ac-travel-internal-system-audit/**`.
- The target OpenSpec directory was already untracked before this work unit. No files were staged, committed, branched, pushed, or sent for PR.
- No `.env*` contents or secret values were printed, copied, hashed, or committed. Environment evidence contains names only.
- No `0061+` migration was created. No migration `0053`–`0060` was rewritten.

The complete local and authoritative remote ordered inventories, checksum algorithms, and discrepancy mapping are in [`migration-inventory.md`](./migration-inventory.md). The local source manifest, including SHA-256 checksums and byte sizes, is also stored outside the repository at `/tmp/opencode/baseline-reconcile-20260810/local-migrations.json`.

## Local migration inventory

The repository contains 59 numbered SQL files for the range `0001`–`0060`. Version `0051` is absent locally. The local quote chain is complete: `0053`, `0054`, `0055`, `0056`, `0057`, `0058`, `0059`, `0060`.

Documentation-only commits were treated as documentation evidence, not database application evidence. In particular, `docs/PROGRESS.md` says no remote migrations were applied; that statement was not used to infer the current remote history. The report's complete inventory is maintained separately to keep this narrative reviewable.

## Remote identity and history

- Read-only remote evidence identifies Supabase project ref `bdyhakpmxegoipbmbtjb`.
- The remote history list API exposed versions and names, but not checksums. A later supplied metadata SQL result exposed `statement_md5`; it is MD5 of stored remote statement text and is not comparable to local-file SHA-256. Therefore checksum equality remains unverified, not assumed.
- Direct remote-history evidence proves `0053`–`0056` and `0058`–`0060` entries, no `0057` entry, a remote-only `0051_crm_resolver_advisor_visibility_hotfix` entry, and a remote-only `drop_public_rate_limits_write_policy` entry.
- Remote package version `20260528235729` is semantically equivalent to local `0019_packages_catalog_rls.sql`: the stored DDL covers the same package columns, RLS, grants, trigger, and three policies despite different naming, dynamic/direct DDL spelling, and hash values.
- Legacy remote-name prefix variants are one `represented/applied` group: local `0013`–`0016`, `0030`–`0041`, and `0050` pair exactly by ordered semantic suffix with remote names that omit the numeric prefix. This excludes remote-only `drop_public_rate_limits_write_policy`, absent remote `0020`, remote-only `0051`, local-pending `0057`, and ambiguous `0044`–`0049`; prefix spelling differences do not justify history rewrite.
- Remote versions `20260728214241` through `20260728214620` are named `0044`–`0049`, but parent-collected read-only statement retrieval returns exactly `select 1;` for all six with one distinct statement hash. Their rows therefore do not prove that the substantive local `0044`–`0049` SQL was applied.
- Branch-list evidence is unavailable: the read-only branch query returned `Project reference is missing when validating permissions`. This proves unverified separation, not that staging does not exist.

### Explicit dispositions for 0053–0060

| Version | Local evidence | Remote evidence | Exactly one classification | Disposition |
|---|---|---|---|---|
| 0053 | `0053_quotes_header_foundation.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |
| 0054 | `0054_quote_pdf_documents_and_uploads.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |
| 0055 | `0055_quote_transactional_rpc_contracts.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |
| 0056 | `0056_quote_operations_traceability.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |
| 0057 | `0057_quote_rpc_cutover.sql`; checksum in local manifest | No direct history entry | `local pending` | Do not apply retroactively. `0060` repeats the required table cutover. |
| 0058 | `0058_fix_legacy_quote_document_link_ambiguity.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |
| 0059 | `0059_quote_registration_intents.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |
| 0060 | `0060_quote_pdf_creation_cutover.sql`; checksum in local manifest | Direct history entry | `represented/applied` | Retain; no repair. |

The complete history discrepancy set is: represented/applied semantic equivalence for local `0019`; represented/applied legacy remote-name prefix variants for local `0013`–`0016`, `0030`–`0041`, and `0050`; remote-only `drop_public_rate_limits_write_policy`; ambiguous/manual-review local `0020_catalog_media_columns_fix.sql`; remote-only `0051`; local-pending `0057`; ambiguous/manual-review remote `0044`–`0049` identical-statement history rows; checksum algorithm mismatch; and environment/recovery uncertainty. The supplemental catalog result shows the final public-rate-limit state has only authenticated `public rate limits staff read` for SELECT and no write policy, while all eight expected `hero_image_url`/`thumbnail_image_url` columns exist across destinations, services, packages, and promotions. These final-state matches do not prove migration provenance. No history repair or synthetic local migration is authorized.

## Targeted schema, RLS, helpers, and Storage comparison

Read-only catalog evidence was limited to the history conflicts and quote/CRM boundary. It shows the target quote tables and registration columns exist remotely, including `quotes.registration_intent_id`, quote/version/document relationships, accepted quote traceability columns, and registration intent lifecycle fields. Supplemental catalog evidence confirms the final public-rate-limit policy state and all eight expected catalog media columns; neither result establishes migration provenance.

Remote function inventory includes the final quote RPCs (`crm_begin_quote_registration`, `crm_register_quote_with_pdf`, `crm_transition_quote`, `crm_accept_quote`, quote read pages), CRM helpers, and integrity triggers. Remote catalog evidence shows `quote_versions` has an authenticated SELECT policy and no compatibility `crm_accept_quote_version` function. This matches the final cutover. It does not resolve whether local CRM migrations `0044`–`0049` were applied, because their remote history statements are placeholders.

Remote policy evidence shows authenticated-only scoped policies for quote headers, versions, events, request links, registration intents, documents, CRM tables, and quote PDF Storage paths. Storage evidence includes private quote-PDF insert/read/failed-cleanup policies and registration-object insert/read/cleanup policies.

Local `0060` explicitly repeats the `0057` direct-write revocation, drops `crm_accept_quote_version`, and removes the direct quote creation/linking compatibility writers. Therefore the missing `0057` history row is a history discrepancy, not evidence of an unexplained final quote schema gap. The remote-only `0051` remains a narrow CRM provenance discrepancy; no critical quote/RLS/helper mismatch was found in the targeted evidence.

## Generated types

Authenticated read-only Supabase MCP generation succeeded. The complete tool result is retained at `.opencode-runtime/data/opencode/tool-output/tool_fedb1ad230016QRzjG3fScCZaC`; only its generated `types` string was extracted to the ignored temporary artifact `/tmp/opencode/baseline-reconcile-20260810/remote-generated.types.ts`. JSON parsing and declaration checks passed (`export type Json` and `export type Database`).

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| Temporary remote-generated types | 113,159 | `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637` |
| Tracked `lib/supabase/database.types.ts` | unchanged source; 3,357 lines | `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436` |

Deterministic comparison: byte-equal **No**; remote has 3,697 lines versus tracked 3,357, with a unified diff of 2,238 lines (1,112 additions and 772 deletions). Both artifacts contain the same 35 table names, with no table-name additions or removals. The remote artifact contains 10 additional function definitions: `crm_bulk_mutate`, `crm_delete_lead_guarded_unchecked`, `crm_is_valid_accepted_quote_scope`, `crm_next_quote_number`, `crm_normalize_email`, `crm_normalize_identity_ascii`, `crm_normalize_phone`, `crm_record_quote_mutation`, `crm_transition_quote`, and `crm_validate_quote_commercial_input`; no tracked-only function names were found. The full diff is retained outside the repository at `/tmp/opencode/baseline-reconcile-20260810/database-types.diff` and is not copied here.

**Regeneration decision:** Tracked generated types need regeneration to reflect the observed remote schema drift, but regeneration is **required but deferred**. Remote-only `0051`, unresolved environment identity, and unproven backup/recovery alignment mean the strict alignment gate is not met. `lib/supabase/database.types.ts` remains byte-for-byte untouched. Task 3.1 is complete because generation, hashes, and trustworthy comparison evidence exist; completion does not imply alignment or authorize regeneration.

## Verification results

| UTC window | Exact command/scenario | Exit/result; sanitized output summary |
|---|---|---|
| `2026-08-10T22:13:37Z`–`22:13:38Z` | `timeout 1s sh -c 'sleep 2'` | 124; expected controlled timeout, gate failed closed. |
| `2026-08-10T23:09:05Z`–`23:09:05Z` | `node -e 'const request = "delete from public.contacts"; if (/\b(insert|update|delete|alter|drop|truncate|create)\b/i.test(request)) { console.log("REJECTED_BEFORE_NETWORK_OR_DATABASE_CALL"); process.exit(1); }'` | 1; rejected before any network/database call. |
| `2026-08-10T22:13:38Z`–`22:13:38Z` | `sh -c 'exit 7'` (unallowlisted check) | 7; nonzero check failed closed. |
| `2026-08-10T23:09:05Z`–`23:09:05Z` | `node -e 'const executable = "curl"; const allowed = new Set(["npm", "node", "sh"]); if (!allowed.has(executable)) { console.log("REJECTED_UNALLOWLISTED_EXECUTABLE"); process.exit(1); }'` | 1; rejected before execution. |
| `2026-08-10T22:13:38Z`–`22:14:02Z` | `npm run lint` | 0; PASS, sanitized output withheld. |
| `2026-08-10T22:14:02Z`–`22:14:48Z` | `npm run build` | 0; PASS, sanitized output withheld. |
| `2026-08-10T22:14:48Z`–`22:14:50Z` | `npm run test:quote-notifications` | 0; PASS, 15/15. |
| `2026-08-10T22:14:50Z`–`22:14:51Z` | `node --conditions react-server --import tsx --test tests/quotes-foundation-contract.test.ts tests/quote-transaction-rpc-contract.test.ts tests/quote-registration-intents-contract.test.ts tests/quote-pdf-creation-cutover-contract.test.ts tests/quote-pdf-storage-contract.test.ts` | 0; PASS, sanitized output summary. |
| `2026-08-10T22:14:51Z`–`22:14:52Z` | `node --conditions react-server --import tsx --test tests/crm-governance-contract.test.ts tests/crm-contact-360-rpc-contract.test.ts tests/crm-final-correctness.test.ts tests/crm-quote-version-rpc-security.test.ts` | 0; PASS, sanitized output summary. |
| `2026-08-10T22:14:52Z`–`22:14:52Z` | `node --conditions react-server --import tsx --test tests/quote-pdf-storage-contract.test.ts tests/storage-uploads.test.ts` | 0; PASS, sanitized output summary. |

The append-only sanitized log is `/tmp/opencode/baseline-reconcile-20260810/verification-evidence.log`. No remote mutation-shaped command was executed.

- **E2E/runtime provider traffic:** Not run; this work unit made no application/schema change and no external traffic was permitted.

Runtime harness evidence is the read-only Supabase catalog/history path and local contract test harness. No Resend, Meta, Storage upload, production smoke, migration push, repair, reset, or DDL/DML was run.

## Environment, staging, rehearsal, and recovery

The safe variable-name inventory is documented by `.env.example`; values were not read. Names only: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CONVERSIONS_API_ACCESS_TOKEN`, `META_CONVERSIONS_TEST_EVENT_CODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ASESOR_EMAIL`, `BOOTSTRAP_ASESOR_PASSWORD`, `BOOTSTRAP_ASESOR_NAME`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `NEXT_PUBLIC_WHATSAPP_PHONE`, `WHATSAPP_CLICK_HASH_SALT`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN`, `E2E_DISABLE_EXTERNAL_BOUNDARIES`, `NEXT_PUBLIC_DEFAULT_LOCALE`, and `NEXT_PUBLIC_DEFAULT_CURRENCY`. The linked project ref is known, but its role as production, staging, or rehearsal is not proven. The failed branch-list permission query is recorded as **ambiguous/manual-review**, not as proof that no staging exists.

| Capability | Evidence status |
|---|---|
| Supabase backup capability | Not independently verified in this work unit. |
| Backup coverage/configuration | Not proven. |
| Tested restore target | Not proven; no restore was attempted. |
| Staging environment | Not proven; branch query unsupported. |
| Migration rehearsal | Not run; no safe staging/rehearsal target was verified. |
| Application rollback | Repository report/doc additions can be reverted; database rollback is not assumed. |
| Database recovery | Requires a verified backup/restore procedure before future migration allocation. |

## Discrepancy register and remediation

| Subject | Classification | Impact | Disposition / remediation | Approval required |
|---|---|---|---|---|
| Local `0019_packages_catalog_rls.sql` versus remote package row `20260528235729` | `represented/applied` | Naming, DDL spelling, and hash differ, but stored remote DDL is semantically equivalent | Retain both records as equivalent representations; do not require byte/hash equality or create a duplicate migration. | No for this classification; yes for any history change. |
| Legacy remote-name prefix variants for local `0013`–`0016`, `0030`–`0041`, and `0050` | `represented/applied` | Remote names omit numeric prefixes but match local versions by ordered semantic suffix | Retain the ordered representations; prefix spelling differences do not justify history rewrite. | No for this classification; yes for any history change. |
| Remote `drop_public_rate_limits_write_policy` has no local file | `remote-only/untracked` | Applied history cannot be reproduced from a distinct local file | Preserve the row and catalog final state; obtain approved provenance if local history completeness is required. | Yes, for any history/local-file change. |
| Local `0020_catalog_media_columns_fix.sql` has no distinct remote row | `ambiguous/manual-review` | Proven columns do not establish whether the change was bundled or manually applied | Obtain authoritative provenance; do not replay or synthesize a migration from final state. | Yes, for any provenance/history change. |
| Remote `0051` has no local file | `remote-only/untracked` | CRM provenance cannot be reproduced locally | Obtain authoritative migration SQL/checksum or an approved provenance record; do not synthesize or repair history. | Yes, for any history/local-file change. |
| Remote lacks `0057` history row | `local pending` | History differs from local sequence | Leave history unchanged; use `0060` as the final cutover evidence. | Yes, before any retroactive application. |
| Remote `0044`–`0049` rows contain identical `select 1;` statements | `ambiguous/manual-review` | History names exist, but stored statements do not prove application of the distinct local SQL bodies | Do not repair or replay history. Obtain separate provenance and live-contract evidence before any next migration or tracked type regeneration. | Yes, for any provenance/history or type change. |
| Environment role and branch separation | `ambiguous/manual-review` | Production/staging targeting is not independently proven | Confirm project role and a disposable rehearsal target through approved access. | Yes, for access/configuration changes. |
| Generated type comparison | `ambiguous/manual-review` | Drift is proven, but remote/local alignment is not proven | Preserve hashes/diff; verify history, environment, and recovery alignment before regenerating tracked output. | No for read-only evidence; yes for tracked regeneration. |
| Backup coverage and restore test | `ambiguous/manual-review` | Recovery readiness is unproven | Verify backup policy, coverage, and perform a non-production restore rehearsal. | Yes, for restore rehearsal/access. |

### Seven-part approval packet for any risky remediation

1. **Evidence:** Semantically equivalent local/remote package DDL; represented/applied prefix-variant group for local `0013`–`0016`, `0030`–`0041`, and `0050`; remote-only `drop_public_rate_limits_write_policy`; ambiguous local `0020`; remote-only `0051`; local-pending `0057`; six remote `0044`–`0049` rows whose stored statements are all `select 1;`; unavailable branch query; generated-type drift with alignment still unproven; unproven backup/restore.
2. **Exact problem:** Local history and remote history cannot yet be reproduced as one checksum-verifiable baseline, and final-state catalog matches or placeholder history rows do not prove provenance or environment/recovery boundaries.
3. **Proposed action:** Obtain provenance for the two remote-only rows, local `0020`, and the six placeholder CRM rows; verify environment separation and backups; validate the retained temporary type diff only against an approved non-production alignment target before any tracked regeneration. Do not repair/replay history or apply `0057` retroactively.
4. **Expected impact:** Improved auditability and recovery confidence; no production schema change is required by this report.
5. **Rollback/recovery:** Revert only evidence/report additions. Any rehearsal uses its own disposable target and is discarded per approved procedure; no production rollback is proposed.
6. **Exact command/change:** Parent-collected read-only provenance query: `select version, name, statements, md5(array_to_string(statements, E'\n')) as statement_md5 from supabase_migrations.schema_migrations where version in ('20260528235729','20260728214241','20260728214307','20260728214345','20260728214433','20260728214531','20260728214620') order by version;` It returned semantically equivalent package DDL and six exact `select 1;` statements with one distinct hash. Existing single-row metadata retrieval proposal remains `select version, name, statements from supabase_migrations.schema_migrations where version = '20260728215934';` (not executed in this rerun). Future tracked type regeneration proposal: `npm run db:types`, gated on proven alignment (not executed). No safe exact non-production branch/rehearsal/restore command can be proposed until a target exists; that missing target blocks execution. No `supabase migration repair`, push, reset, DDL, DML, or history mutation is authorized here.
7. **Specific approval required:** Maintainer approval for access to verify project role/backups/rehearsal and separate approval for any future tracked type regeneration or history-affecting change. The read-only metadata evidence is distinct from all mutation proposals, which require separate approval.

## Rollback boundary and final scope check

Rollback boundary is limited to `openspec/changes/baseline-reconcile/migration-inventory.md`, `openspec/changes/baseline-reconcile/reconciliation-report.md`, `openspec/changes/baseline-reconcile/apply-progress.md`, and checkbox changes in `tasks.md`. No unrelated workspace path, living documentation, generated type file, migration, schema object, provider boundary, or remote history is part of this work unit.

The work unit did not create `0061+`, rewrite `0053`–`0060`, clean schema, expose secrets, send provider traffic, mutate Supabase, stage/commit/push, open a PR, or begin another change.

**PASS WITH FOLLOW-UP**
