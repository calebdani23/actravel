# Apply Progress: baseline-reconcile

## Work unit

- **Unit:** `migration-provenance-resolution`
- **Mode:** Standard; strict TDD was not active.
- **Delivery:** Single bounded evidence/report unit; low-risk 180–320 line forecast; no chain required.
- **Status:** Complete; 14 of 14 tasks complete. This bounded correction classifies the local `0019` naming difference and remote `0044`–`0049` placeholder-history signal without inferring application or expanding product/schema scope.

## Completed tasks

- [x] 1.1 Freeze Git identity/status and protected-path exclusions.
- [x] 1.2 Inventory and checksum local migrations; record missing `0051` and quote chain.
- [x] 1.3 Capture variable names, remote ref, and environment uncertainty without values.
- [x] 2.1 Execute controlled fail-closed safety checks; execute no mutation-shaped command.
- [x] 2.2 Reconcile authoritative remote history read-only through `0060`.
- [x] 2.3 Classify each `0053`–`0060` version exactly once.
- [x] 2.4 Compare targeted quote/CRM tables, functions, RLS, triggers, constraints, and Storage policies.
- [x] 3.1 Generate and compare temporary types from authenticated read-only MCP evidence. The generated artifact was extracted safely, hashed, and compared deterministically with tracked types. Drift exists, but regeneration is deferred because remote-only `0051`, environment identity, and recovery alignment remain unproven; tracked output is unchanged.
- [x] 3.2 Run required lint/build/focused tests and relevant quote/CRM/Storage contract suites.
- [x] 3.3 Record environment, staging, backup, recovery, rollback, and rehearsal evidence separately.
- [x] 4.1 Create the sanitized reconciliation report with final gate.
- [x] 4.2 Record the seven-part approval packet; execute no risky action.
- [x] 4.3 Make no living-doc update because no new shipped fact or durable decision was justified; include explicit safe-next-migration answer in report.
- [x] 4.4 Confirm prohibited actions and unrelated workspace paths were untouched.

## Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command | `node --conditions react-server --import tsx --test tests/quote-transaction-rpc-contract.test.ts tests/quote-registration-intents-contract.test.ts tests/quote-pdf-creation-cutover-contract.test.ts tests/quote-pdf-storage-contract.test.ts`; exit 0; 44/44 passed. |
| Runtime harness command/scenario | N/A for application runtime: this corrective unit changes evidence artifacts only. Local fail-closed classifier and contract suites ran with no provider traffic or mutation. |
| Rollback boundary | Revert only `migration-inventory.md`, `reconciliation-report.md`, `apply-progress.md`, and any task wording/checkbox changes; no database, generated type, migration, app, or unrelated workspace state. |

## Corrective evidence

- **Inventory:** Complete 59-row local SHA-256 inventory and complete 59-row authoritative remote `statement_md5` inventory are in `migration-inventory.md`. The list API exposed names/order; later metadata SQL exposed remote MD5. Remote MD5 is derived from stored statement text and is not directly comparable to local SHA-256. Supplemental catalog evidence classifies remote `drop_public_rate_limits_write_policy` as remote-only/untracked and local `0020_catalog_media_columns_fix.sql` as ambiguous/manual-review because final state does not prove provenance.
- **Provenance correction:** Remote package version `20260528235729` is classified `represented/applied` for local `0019_packages_catalog_rls.sql` on semantic DDL evidence, while retaining the name, spelling, and hash differences. Legacy remote-name prefix variants are one `represented/applied` group covering local `0013`–`0016`, `0030`–`0041`, and `0050` by exact ordered semantic suffix; this excludes remote-only `drop_public_rate_limits_write_policy`, absent remote `0020`, remote-only `0051`, local-pending `0057`, and ambiguous `0044`–`0049`. Remote `0044`–`0049` rows remain one explicit `ambiguous/manual-review` group: each stored statement is exactly `select 1;` and all six share MD5 `ccb5b4481bced39454dca6d845601d54`; the substantive local SQL bodies are not thereby proven applied. History repair/replay is forbidden, and separate provenance/live-contract evidence is required before any next migration or tracked type regeneration.
- **Task 1.3:** `.env.example` variable names are listed in the report; no `.env*` values were read or printed.
- **Task 2.1:** `node -e 'const request = "delete from public.contacts"; if (/\b(insert|update|delete|alter|drop|truncate|create)\b/i.test(request)) { console.log("REJECTED_BEFORE_NETWORK_OR_DATABASE_CALL"); process.exit(1); }'` exited 1 before any network/database call; `node -e 'const executable = "curl"; const allowed = new Set(["npm", "node", "sh"]); if (!allowed.has(executable)) { console.log("REJECTED_UNALLOWLISTED_EXECUTABLE"); process.exit(1); }'` exited 1 before execution. Both harmless local classifiers failed closed; prior timeout/nonzero evidence remains unchanged.
- **Verification:** Timestamped exact commands and sanitized summaries are retained in `/tmp/opencode/baseline-reconcile-20260810/verification-evidence.log`; lint, build, quote notifications, quote/CRM/Storage contract suites all exited 0.
- **Approval packet:** The report now includes exact proposed metadata/statement retrieval and `npm run db:types` commands, with execution status and approval boundaries. No safe restore command is invented without a target.
- **Type decision:** Type drift is proven by completed generation/hash/diff evidence; regeneration is required but deferred because alignment is unproven.

### Task 3.1 comparison evidence

- **Source:** Authenticated read-only Supabase MCP result at `.opencode-runtime/data/opencode/tool-output/tool_fedb1ad230016QRzjG3fScCZaC`; only its generated `types` string was extracted to `/tmp/opencode/baseline-reconcile-20260810/remote-generated.types.ts`. The source parsed as JSON and contained valid `export type Json` and `export type Database` declarations.
- **Temporary artifact:** 113,159 bytes; SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`.
- **Tracked artifact:** `lib/supabase/database.types.ts`; SHA-256 `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436`.
- **Deterministic comparison:** byte-equal `No`; tracked 3,357 lines versus remote 3,697; unified diff 2,238 lines (1,112 additions and 772 deletions). Both artifacts contain 35 table names with no table-name additions/removals. The remote artifact contains 10 additional function definitions: `crm_bulk_mutate`, `crm_delete_lead_guarded_unchecked`, `crm_is_valid_accepted_quote_scope`, `crm_next_quote_number`, `crm_normalize_email`, `crm_normalize_identity_ascii`, `crm_normalize_phone`, `crm_record_quote_mutation`, `crm_transition_quote`, and `crm_validate_quote_commercial_input`; no tracked-only function names were found.
- **Diff artifact:** Full unified diff retained outside the repository at `/tmp/opencode/baseline-reconcile-20260810/database-types.diff`; it is not copied into OpenSpec.
- **Regeneration decision:** Tracked generated types need regeneration to reflect the observed remote schema drift, but regeneration is **required but deferred**. Remote-only `0051`, unresolved environment identity, and unproven recovery/alignment mean the strict alignment gate is not met. `lib/supabase/database.types.ts` remains byte-for-byte untouched.

## Required verification

- `npm run lint`: PASS, exit 0.
- `npm run build`: PASS, exit 0.
- `npm run test:quote-notifications`: PASS, 15/15.
- Quote foundation contracts: PASS, 11/11.
- Quote/registration/cutover/Storage contracts: PASS, 44/44.
- CRM correctness/security contracts: PASS, 13/13.
- Controlled shell fail-closed checks: PASS; exit 7 and exit 1 failures did not advance any gate.

## Durable findings

- Remote history directly proves `0053`–`0056` and `0058`–`0060`; remote has no `0057` entry and has remote-only `0051`.
- Legacy remote-name prefix variants are represented/applied as one exact semantic group: local `0013`–`0016`, `0030`–`0041`, and `0050`; prefix spelling differences do not negate ordered representation or justify history rewrite.
- Local `0019` is semantically represented by the remote package row despite naming/text/hash differences; remote `0044`–`0049` names are retained as ambiguous/manual-review because their stored statements are identical placeholders.
- Supplemental history classifications are explicit: remote-only/untracked `drop_public_rate_limits_write_policy`; ambiguous/manual-review local `0020_catalog_media_columns_fix.sql`; remote-only/untracked `0051`; local pending `0057`.
- Supplemental catalog evidence confirms only authenticated `public rate limits staff read` remains for SELECT with no write policy, and all eight expected catalog media columns exist; these final states do not prove provenance.
- Local `0060` explicitly absorbs/repeats the `0057` final table cutover; targeted remote quote catalog state matches the final cutover.
- Environment role, staging/rehearsal separation, backups, restore testing, and generated type equality remain unproven.
- Final gate is `PASS WITH FOLLOW-UP`; safe to allocate next migration identifier is **No**. The placeholder-history ambiguity reinforces the no-allocation gate.

## Task 3.1 completion evidence

- **Attempt:** Authenticated read-only Supabase MCP type generation, captured in `.opencode-runtime/data/opencode/tool-output/tool_fedb1ad230016QRzjG3fScCZaC`.
- **Result:** `PASS` — the JSON result parsed successfully and yielded a complete generated TypeScript artifact with `Json` and `Database` declarations.
- **Safety:** Only the temporary ignored artifact and diff were written. No login/link, remote mutation, migration, DDL, DML, provider traffic, or tracked-file write was attempted. The tracked generated types file remains untouched.
- **Comparison:** Hashes and deterministic structural comparison are recorded above; schema-significant drift is present in remote function definitions while table-name sets match.
- **Type conclusion:** Tracked generated types need regeneration, but it is required and deferred because schema/history/environment/recovery alignment is not proven. This satisfies task 3.1 without assuming alignment.
- **Bounded rerun boundary:** Only the temporary generated artifact/diff and the four baseline-reconcile artifacts were updated. No unrelated tests, exploration, application code, migration, living documentation, or protected path was touched.
