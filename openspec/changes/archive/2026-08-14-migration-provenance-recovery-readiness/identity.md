# Current Identity and Protected Inventory

**Decision:** repository evidence is current as of `2026-08-11T22:48:00Z`; no remote environment was inspected. `0061+` is not safe.

## Repository snapshot

| Field | Value | Source / reproducibility |
|---|---|---|
| Evidence ID | `MPRR-I-001` | Packet-local stable identifier |
| Captured UTC | `2026-08-11T22:48:00Z` | `date -u '+%Y-%m-%dT%H:%M:%SZ'` |
| HEAD | `7e3ba3494e7831630a85fb5d3538d84670dc2118` | `git rev-parse HEAD` |
| Branch | `main` | `git branch --show-current` |
| Worktree | clean except this untracked change directory | `git status --short`; no tracked files changed |
| Local root | `/home/calebdani/srv/projects/actravel` | execution workspace; not an environment secret |
| Local Supabase config | unavailable; no `supabase/config.toml` | repository inventory; no local target started |
| Remote identity / role | unavailable in this packet | no remote inspection or service call authorized |

The change directory is the only untracked path reported before packet creation. Archived identity `5db1ea37…4e7a8` is a valid local ancestor of current HEAD and supports the bounded local changed-path comparison. Its ref `bdyh…btjb` and remote claims remain historical inputs, not current remote proof.

## Migration inventory

The ordered local inventory contains **59** tracked SQL files. `0051` is absent; the numeric sequence otherwise reaches `0060`.

```text
0001_extensions.sql  0002_identity.sql  0003_crm.sql  0004_catalog.sql
0005_operations.sql  0006_logs.sql  0007_storage.sql  0008_rls.sql
0009_security_advisor_fixes.sql  0010_fk_indexes.sql
0011_restrict_helper_function_execute.sql  0012_grant_authenticated_helper_execute.sql
0013_restrict_private_storage_read.sql  0014_notification_log_delivery.sql
0015_public_rate_limits.sql  0016_retry_idempotency.sql
0017_narrow_private_storage_roles.sql  0018_template_metadata.sql
0019_packages_catalog_rls.sql  0020_catalog_media_columns_fix.sql
0021_operational_incident_state.sql  0022_fix_operational_incident_backfill.sql
0023_promotion_relations.sql  0024_catalog_detail_sections.sql
0025_promotion_commercial_sections.sql  0026_whatsapp_inbound_leads.sql
0027_admin_account_events.sql  0028_admin_account_events_staff_deleted.sql
0029_admin_account_events_email_change_requested.sql  0030_crm_hierarchy_foundation.sql
0031_crm_opportunity_resolution_rpc.sql  0032_contact_normalization_trigger.sql
0033_crm_opportunity_resolution_rpc_revoke_public.sql  0034_quote_versions.sql
0035_quote_version_integrity.sql  0036_quote_version_hardening_followup.sql
0037_validate_quote_version_timestamps.sql  0038_crm_normalization_function_search_path.sql
0039_admin_lead_delete_guardrails.sql  0040_drop_direct_lead_delete_policy.sql
0041_admin_orphan_contact_cleanup.sql  0042_crm_governance_fields_and_advisor_rls.sql
0043_crm_bulk_mutation_jobs.sql  0044_crm_bulk_mutation_rpcs.sql
0045_crm_resolver_soft_delete_review.sql  0046_crm_governance_remediation.sql
0047_crm_archive_restore_controls.sql  0048_crm_test_purge_and_blocked_outbound.sql
0049_crm_contact_aggregate_filters.sql  0050_harden_crm_trigger_function_grants.sql
0052_crm_contact_360_rpc_contracts.sql  0053_quotes_header_foundation.sql
0054_quote_pdf_documents_and_uploads.sql  0055_quote_transactional_rpc_contracts.sql
0056_quote_operations_traceability.sql  0057_quote_rpc_cutover.sql
0058_fix_legacy_quote_document_link_ambiguity.sql  0059_quote_registration_intents.sql
0060_quote_pdf_creation_cutover.sql
```

Reproducible inventory checksum: `sha256:3dbd5b3fff96080f1f6e76840797860359e9f2b45b2ce8639db76ad59d56f9aa` over `git ls-files 'db/migrations/*.sql' | sort -V` (newline-delimited paths). Individual file SHA-256 values for provenance-sensitive paths:

| Path | Mode | SHA-256 |
|---|---:|---|
| `db/migrations/0020_catalog_media_columns_fix.sql` | `100644` | `42126f10b4bd70a8640330a349564451fdfa8d4d803ca57e075c767ad9197ba7` |
| `db/migrations/0044_crm_bulk_mutation_rpcs.sql` | `100644` | `0b5aa1a1a07edb3fcb32cad34433499ed541901a6cb27f4cb5cf1d43ad126caf` |
| `db/migrations/0045_crm_resolver_soft_delete_review.sql` | `100644` | `8dbdbd5f59ac5542d3256c04d0f127646c136e0bfa03b847928f2e580354f08f` |
| `db/migrations/0046_crm_governance_remediation.sql` | `100644` | `69d178099101b964254fd1d09235d425500d6320883b7293477788898bc38f49` |
| `db/migrations/0047_crm_archive_restore_controls.sql` | `100644` | `363c0423d2f55df1b3922e00794fa187841442b0e25118bc96df38fd0f36deac` |
| `db/migrations/0048_crm_test_purge_and_blocked_outbound.sql` | `100644` | `4ef62506621802fdfa12d433822500c55d222df03a6f14a8add3fc9b18982683` |
| `db/migrations/0049_crm_contact_aggregate_filters.sql` | `100644` | `887c448a790627e8a3a6c77d2be5177fd879ddb97d9f96702ae6bc5593ee75d6` |
| `db/migrations/0057_quote_rpc_cutover.sql` | `100644` | `213de32c102081e4538c80e89c71370409077e65b3976846f059bb3776b95c33` |
| `db/migrations/0060_quote_pdf_creation_cutover.sql` | `100644` | `8793e832b80922e93797f96db466371ac4ada1c4d6ac02609399afdf707e0ce2` |
| `lib/supabase/database.types.ts` | `100644` | `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436` |

The generated type hash is a preserved drift baseline, not alignment proof. No migration or generated type was modified.

## Roles and authorization

| Role | Boundary | State |
|---|---|---|
| Collector | repository/read-only evidence only | packet collector; cannot authorize mutation |
| Provider/maintainer owner | authoritative ledger and environment evidence | requested, unavailable |
| Recovery operator | disposable backup/restore rehearsal and cleanup | requested, unavailable |
| Decision authority | final gate and future repair authorization | not supplied; gate blocked |
