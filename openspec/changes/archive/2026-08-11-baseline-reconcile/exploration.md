## Exploration: baseline-reconcile

### Current State

The repository is on `main` at `ea2b828b0d65390f95bd2dcd06c8d26acb50339e`, with `origin/main` at the same commit and zero ahead/behind divergence. The working tree is not clean because of the pre-existing modified `opencode.json`, untracked `docs/AC_Travel_Prompt_Maestro_Opcion_2.md`, and untracked `openspec/changes/ac-travel-internal-system-audit/**`; these paths are explicitly excluded from this change.

Git evidence classifies the commits after the executable baseline `01d5a6b0bea066a0ea87943de922e39d18eb4dac` as context/documentation-only: `379f162` adds Business OS context, `224cc37` merges it, `365cff6` archives legacy documentation, and `ea2b828` merges that archive. A path-scoped comparison found no changes to application code, migrations, package manifests/lockfile, tests, or runtime configuration between the executable baseline and current HEAD.

The local migration directory contains 59 numbered SQL files, from `0001` through `0060`, with a single numeric gap at `0051`; the exact maximum is `0060`. Migrations `0053`–`0060` are present locally. Their local SHA-256 values are recorded below for later comparison where the remote history mechanism exposes checksums:

| Version | Local file | SHA-256 |
|---:|---|---|
| 0053 | `quotes_header_foundation.sql` | `59d9006f76ae1952281d96f24cc2d9a59cb3cb9b0f7f058f524a94494612660f` |
| 0054 | `quote_pdf_documents_and_uploads.sql` | `485771fdae6c50639461d0019cff393fac8613ca02f8b31c711dbc3a8a75e6fd` |
| 0055 | `quote_transactional_rpc_contracts.sql` | `61cea8c210985190af72a9efb8c571485c0bdeeea5c1f91e260827ee7f71c8cf` |
| 0056 | `quote_operations_traceability.sql` | `bbb07de4c793944c070264ab982ed06ef2ce31df0f29d672c513be4bddc488b9` |
| 0057 | `quote_rpc_cutover.sql` | `213de32c102081e4538c80e89c71370409077e65b3976846f059bb3776b95c33` |
| 0058 | `fix_legacy_quote_document_link_ambiguity.sql` | `02dda6c6f9c0e2b545e1d949bdd296c9e880fc7f1e1877c6742dd205003b456b` |
| 0059 | `quote_registration_intents.sql` | `c0ed043b02c2f6a2b64773f947e97d95a4ba99b667e55803d1a6bf8e3b1b534b` |
| 0060 | `quote_pdf_creation_cutover.sql` | `8793e832b80922e93797f96db466371ac4ada1c4d6ac02609399afdf707e0ce2` |

The linked Supabase project metadata identifies ref `bdyhakpmxegoipbmbtjb` and project name `Base de Datos AcTravel`. This is local CLI linkage metadata, not proof of production/staging role or of applied migrations. No remote migration history, live schema, RLS, helper state, or backup capability was queried in this read-only exploration.

The current application uses Supabase as the operational source of truth and has generated types at `lib/supabase/database.types.ts`. The package exposes `npm run db:types` (`supabase gen types typescript --linked > ...`), but type regeneration is intentionally deferred until remote/local alignment is proven. Critical contract surfaces include CRM `contacts`/`leads` and Contact 360 RPCs, quote tables and PDF/registration-intent cutover, RLS/helper functions, Storage policies, and booking/payment traceability. The existing tests read both migration bodies and generated types, so stale types or a changed quote chain would be material drift signals.

The executable baseline commands are `npm run lint`, `npm run build`, focused Node tests such as `npm run test:quote-notifications`, and Playwright `npm run test:e2e`. Playwright builds and starts a local server with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`, preventing real Resend and Meta Conversions traffic while retaining local application behavior. The full baseline was not run in exploration, per scope; it belongs to the apply/verification plan. Relevant contract/security suites include CRM/RLS, data quality, quote transaction/PDF/operations contracts, Storage, endpoint protection, and E2E.

Production is documented as Vercel + Supabase + Resend, while the repository provides no confirmed separate staging Supabase project, branch, rehearsal database, or tested backup/restore artifact. The documented operational path is production-oriented; local E2E has an explicit external-boundary safety switch. Ordinary application rollback is safer than database rollback under the documented expand/compatibility approach, but actual backup, restore, and point-in-time recovery availability remain unverified. No destructive cleanup, migration repair, type regeneration, provider call, or remote mutation is authorized by this exploration.

### Affected Areas

- `db/migrations/` — inventory and checksum comparison are required before any migration identifier is allocated; `0051` is a local sequence gap and `0053`–`0060` are the critical quote chain.
- `supabase/.temp/linked-project.json` — identifies the linked Supabase ref, but does not establish environment role or migration application state.
- `lib/supabase/database.types.ts` — generated schema contract to compare after alignment; do not regenerate during exploration.
- `db/migrations/0053`–`0060` — quote header, PDF/document, RPC, operations traceability, cutover, registration intent, and mandatory PDF creation contracts to inspect only against evidence of drift.
- CRM/RLS contract tests and migrations — `contacts`, `leads`, Contact 360, helper functions, ownership policies, and quote authorization must be checked only if remote evidence shows schema/RLS divergence.
- `package.json`, `playwright.config.ts`, `.env.example`, `docs/ENVIRONMENT.md`, `docs/OPERATIONS.md` — define safe local verification, secret-name boundaries, external traffic suppression, and deployment assumptions.
- `openspec/changes/baseline-reconcile/` — this exploration artifact only; no proposal, design, tasks, code, schema, or migration is created in this phase.

### Evidence Required Before Proposal/Application

1. Read-only authoritative remote migration history for linked ref `bdyhakpmxegoipbmbtjb`, including version, name, order, and checksums when available. The planned tool is the Supabase CLI migration-history command against the linked project (or an approved read-only SQL query against the migration-history table if CLI output is insufficient). It must run in a controlled environment without printing environment values.
2. A read-only remote schema inventory for migration-expected tables, functions/RPCs, policies, triggers, constraints, and Storage buckets. Compare it to local migrations, not to documentation alone.
3. A read-only generated-type comparison. Run `npm run db:types` only after alignment approval; capture a diff/hash without committing or overwriting an unreviewed type file during evidence collection.
4. Safe environment identity evidence: variable names and linked project identity only. Secret values, database URLs, tokens, credentials, cookies, and provider payloads must never be printed or copied.
5. Explicit environment separation evidence: identify whether the linked ref is production, staging, or a rehearsal branch; confirm any separate staging target before applying anything. If no separate target exists, classify rehearsal as unavailable rather than treating local as staging.
6. Backup/recovery evidence from the Supabase plan/project: backup availability, retention/PITR, restore target, and approval boundary. A documented claim is not a restore proof.

### Drift Classification

Every migration/object mismatch must receive exactly one of these classifications:

| Classification | Meaning for this change |
|---|---|
| `represented/applied` | Local migration identity and remote history/schema evidence agree. |
| `local pending` | Local migration is absent from authoritative remote history and its objects are not already explained by another approved source. |
| `remote-only/untracked` | Remote history/schema contains an object or migration identity not represented by the local repository. |
| `ambiguous/manual-review` | Evidence is incomplete, checksums/names disagree, or schema state cannot be attributed safely. |

At exploration completion, `0053`–`0060` are **not classified as applied**: their local presence is verified, but remote evidence was deliberately not collected. They therefore remain `ambiguous/manual-review` pending the authoritative remote query. The `0051` local gap is a repository inventory fact, not proof of remote drift; it also requires history comparison before any repair decision.

### Approaches

1. **Evidence-first linked-project reconciliation (recommended)** — query remote migration history and schema read-only, compare against local filenames/checksums and generated types, then classify every discrepancy before any mutation.
   - Pros: preserves production history, distinguishes migration history from live schema, supports a safe remediation proposal, and honors the no-destructive-cleanup gate.
   - Cons: requires privileged read-only access and explicit environment identification; cannot finish if remote access or backup evidence is unavailable.
   - Effort: Medium.

2. **Documentation/inventory-only reconciliation** — rely on local files, prior docs, and linked-project metadata without remote queries.
   - Pros: no remote access risk and minimal execution.
   - Cons: cannot prove applied state, schema drift, RLS/helper alignment, or staging separation; directly fails Gate 0.
   - Effort: Low, but insufficient.

3. **History normalization or speculative repair** — force local/remote history to look equal or allocate a new migration.
   - Pros: superficially simple.
   - Cons: unsafe, potentially destructive, can corrupt sequencing and conceal remote-only schema; prohibited by the active scope.
   - Effort: High and disallowed.

### Recommendation

Proceed to a proposal only for a non-destructive evidence and reconciliation slice. Its acceptance criteria should require authoritative remote history, schema/RLS/helper comparison where indicated, classification using the four exact labels above, environment separation, generated-type alignment after approval, and a documented backup/rollback boundary. Remediation should be reporting-first: produce a mismatch register and a separately approved, additive/idempotent plan. Do not create `0061+`, repair history, drop objects, regenerate types, or mutate production in this phase.

### Risks

- The linked Supabase ref may be production, but repository linkage does not prove that; querying the wrong environment could expose or alter the wrong operational target if safeguards are bypassed.
- Remote migration history may not expose checksums or may disagree with live schema, requiring `ambiguous/manual-review` rather than inference.
- The missing local `0051` identifier and the optional presence of `0057` documented for the quote cutover may represent intentional history or drift; neither can be resolved locally.
- Generated types may reflect a different schema snapshot; overwriting them before reconciliation would destroy useful evidence.
- No separate staging/rehearsal or tested backup/restore capability is established in the inspected repository; write-enabled remediation must stop until the approval boundary is explicit.
- Production-oriented smoke procedures can send real external traffic; only the Playwright boundary switch is locally verified as protective, so production smoke remains planned-only.

### Ready for Proposal

Yes, for a read-only reconciliation proposal only. The proposal should authorize identity-safe remote evidence collection and local comparison, not schema repair or feature work. It should state that remote evidence for `0053`–`0060`, environment role, staging/rehearsal, backup/recovery, and live RLS/schema remains pending and must be gathered before any migration allocation or type regeneration.
