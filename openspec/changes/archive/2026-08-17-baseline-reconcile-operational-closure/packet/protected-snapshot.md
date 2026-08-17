# Protected Snapshot

Captured `2026-08-17T21:05:21Z` UTC before correction packet edits. `git ls-files -s` supplied mode/index identity; `git status --porcelain=v2` supplied worktree state. Every listed file was compared after the correction and after focused commands. `pre_sha256 == post_sha256` for every row.

| Path | Mode | Index/worktree state | Pre SHA-256 | Post SHA-256 |
|---|---:|---|---|---|
| `lib/supabase/database.types.ts` | 100644 | clean | 3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436 | 3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436 |
| `package.json` | 100644 | clean | 1a07eba3d75a55111bd06f279182427bd61895deb955bd6be7aaad96dc77e0d6 | 1a07eba3d75a55111bd06f279182427bd61895deb955bd6be7aaad96dc77e0d6 |
| `package-lock.json` | 100644 | clean | 3b175f0c194a4b8d9e8f0f6328ab15e3b305937ff3bcdee8d6ca67639ebb512f | 3b175f0c194a4b8d9e8f0f6328ab15e3b305937ff3bcdee8d6ca67639ebb512f |
| `docs/DECISIONS.md` | 100644 | pre-existing worktree modified | 7fad440fb2d1eeedc7a6d0e778c3dbe106a1ac22c37c9d3b3299bde4f61cbd46 | 7fad440fb2d1eeedc7a6d0e778c3dbe106a1ac22c37c9d3b3299bde4f61cbd46 |
| `docs/PROGRESS.md` | 100644 | pre-existing worktree modified | 8c2642488e856163b9b539f6cb12d43f5ba5119b363c021d9fe7e2300d56edc0 | 8c2642488e856163b9b539f6cb12d43f5ba5119b363c021d9fe7e2300d56edc0 |
| `docs/implementation/ACTIVE.md` | 100644 | pre-existing worktree modified | 10c56265ea636151aee590a64b1d2b260a99254f04a52caee8212ec4a6cbea3f | 10c56265ea636151aee590a64b1d2b260a99254f04a52caee8212ec4a6cbea3f |
| `docs/about/helps/intakes/image.png` | 100644 | pre-existing worktree modified; byte-preserved | 1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715 | 1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715 |

## Complete migration inventory

All rows below are mode `100644`, index clean, worktree clean, and have identical pre/post SHA-256. This is the complete `git ls-files -- db/migrations/**` inventory (including `.gitkeep`).

| Path | SHA-256 |
|---|---|
| `db/migrations/.gitkeep` | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| `db/migrations/0001_extensions.sql` | a5013085143b1b5fd0412abaa48485280b5f8e637d1ca351a793edb0a2402cfb |
| `db/migrations/0002_identity.sql` | 6ae3784639a220697dc28674729d36577bf6266f0ecf2496797816cd6029e64f |
| `db/migrations/0003_crm.sql` | 77f67788e679aefd67808242eb87bf917fa8dbbc5305ed0c1586afe783060d89 |
| `db/migrations/0004_catalog.sql` | 072f82d279727fcf3e751bb6bbcf398d54cf55ab2bdb30129d672cd0b74c5fe3 |
| `db/migrations/0005_operations.sql` | 4b9a8782c87df35dfdb94f7208fcc4959e2853b2ebaf86bbca4bee2b30ae0b5f |
| `db/migrations/0006_logs.sql` | e72b120e3ce3535913fa8730fd27d64bcb900d13dfd1bc1733bb73812bcf2791 |
| `db/migrations/0007_storage.sql` | 4be8af137f9fae61313623b80edc6cd640d395b6f4a591df826c744841b20d14 |
| `db/migrations/0008_rls.sql` | 6f1fdb349e05fe63ceff817d226ffd923c2a5e5ae2e5447e11b1e9241cf3887a |
| `db/migrations/0009_security_advisor_fixes.sql` | 96aaa71c02eaa2e063f70592727c7eb728e50f65880c6a5e510b3af01fb0f56d |
| `db/migrations/0010_fk_indexes.sql` | 9b8f6a7263a8087c02a780f12760804212f4b7b5a4fb736f342c14cc194ec6d0 |
| `db/migrations/0011_restrict_helper_function_execute.sql` | 5c72cf490c116953d28703ea85447e6378ba72f9e0932e60574fa48afdde0148 |
| `db/migrations/0012_grant_authenticated_helper_execute.sql` | a9dc69c4217b91036cab8035a2ccecf8f25a5650ee486e2786a16488926a2ae0 |
| `db/migrations/0013_restrict_private_storage_read.sql` | d882a26ac5bb8274495ae23248039ca897653526f6a6011278e1405947f639c7 |
| `db/migrations/0014_notification_log_delivery.sql` | bc5b8d9fbd9c7f039c7fd549fc0ae23ce56902d2be8603b836a0f93fea4c6d8f |
| `db/migrations/0015_public_rate_limits.sql` | 588aca3a312da01486812d83c0436cd7b2956683d1dcb68fa68a7c7249311214 |
| `db/migrations/0016_retry_idempotency.sql` | db9ea7e99291ab1e9049093af936ca42525ba50a38803eb86bab0881812a8742 |
| `db/migrations/0017_narrow_private_storage_roles.sql` | 816526bd33cefd4c360d7a9ce29dba6d8b80d947023da61a3c7cf3223c0dcb6b |
| `db/migrations/0018_template_metadata.sql` | 37e937b04b809fa8864fe327c21458d3f575a7ea659ab4bf59f520cb88164571 |
| `db/migrations/0019_packages_catalog_rls.sql` | 72ca14edc3a6c14b2878606e1715bf1c893d14c2b228272671425c3bbbc1c91a |
| `db/migrations/0020_catalog_media_columns_fix.sql` | 42126f10b4bd70a8640330a349564451fdfa8d4d803ca57e075c767ad9197ba7 |
| `db/migrations/0021_operational_incident_state.sql` | 7a9a4bf53ffa3331d2f19a02b04b9b4040e9387ee8333fcbb8e45c26ae508daa |
| `db/migrations/0022_fix_operational_incident_backfill.sql` | 56508862d24ccabad6e4463876b0b23292a49d3d7d47faa1f507a12e1a632df1 |
| `db/migrations/0023_promotion_relations.sql` | 8e11dbb50c0411e0774dd14f5e2e7955908707e9f9ebd52eb47431a8ec25e05a |
| `db/migrations/0024_catalog_detail_sections.sql` | 3bd05ec9d700f44bdf8413c12a1549f49b11048ada96bbfbbf2ab7a8796a6fe6 |
| `db/migrations/0025_promotion_commercial_sections.sql` | cc97987ce6e4aa56cd0337e53ee5bda73fd466511542a019a1e780800c7bf745 |
| `db/migrations/0026_whatsapp_inbound_leads.sql` | c872b7d5172bdd6db0695279f47cb6c26d3da6d4e81471931e5136b4c89c8343 |
| `db/migrations/0027_admin_account_events.sql` | 275ca82a43d6cb13b741846342ab3daafdb51c66a5e1a6e94c8bcb93d2d3bb09 |
| `db/migrations/0028_admin_account_events_staff_deleted.sql` | 89a10ed812085324b38042ef17b8147be966765e7fad333f856fcf4fba7e7abd |
| `db/migrations/0029_admin_account_events_email_change_requested.sql` | 96b8132dddfb47190f4403e0bb82f24f75dd3d76fbd1c52e0f655af04c32b3f5 |
| `db/migrations/0030_crm_hierarchy_foundation.sql` | 948444bb6a17dbc3201450d079cf3472e74cee25bb3e4b12b8e92d423c08e53d |
| `db/migrations/0031_crm_opportunity_resolution_rpc.sql` | 576162ab265ab8ca8a071626794a57b12a876256af76ffc3a9cb57ce92cf36fd |
| `db/migrations/0032_contact_normalization_trigger.sql` | 85540b227e7c7d6590257bef78109bf36ff027a5b1855bb0f75b5d4878a50c63 |
| `db/migrations/0033_crm_opportunity_resolution_rpc_revoke_public.sql` | d9cb919df77d514938d6d083b097442607a762fca4fae014e175922cae5e29e3 |
| `db/migrations/0034_quote_versions.sql` | 179109f09deecde79b0abd977db37c857d3967bfdf571dd85b298683cc02ea7e |
| `db/migrations/0035_quote_version_integrity.sql` | 54bb605318f311919b2511e8d1501814da6c437191ece96d2b162733c3e85601 |
| `db/migrations/0036_quote_version_hardening_followup.sql` | 6f2e773f204e4221ad78fb04dd5b193d12c048405f490ca54c150724f2eff58b |
| `db/migrations/0037_validate_quote_version_timestamps.sql` | de421d32ab2da30f4ed8b195837d72f884c41961fd34dbb985145d2fae8d7922 |
| `db/migrations/0038_crm_normalization_function_search_path.sql` | 127ce5abdc882eeaa5aecd168955d47411bca73e6e9ebed6144e3a3f8f22a686 |
| `db/migrations/0039_admin_lead_delete_guardrails.sql` | daa55d3754e9b1b3b95d708217e3e745a0430b8fd76f529822cad89309a4d474 |
| `db/migrations/0040_drop_direct_lead_delete_policy.sql` | 60154ea21750e788976ab05d71febd8189746fb50f502da02d747286f73d8f3c |
| `db/migrations/0041_admin_orphan_contact_cleanup.sql` | c50eaf71f276b7eda918de54d4640b82e0cb42718c17c487f515e31a55313c9f |
| `db/migrations/0042_crm_governance_fields_and_advisor_rls.sql` | b3b5b32e9ec243c42dd4d90e94812a4e8c26b43bb094f9270af2f9958a91073a |
| `db/migrations/0043_crm_bulk_mutation_jobs.sql` | cd7b9e0a69695bc347500e5533cf5a17b9e7a7b071804cbabb5bc52bac929f3e |
| `db/migrations/0044_crm_bulk_mutation_rpcs.sql` | 0b5aa1a1a07edb3fcb32cad34433499ed541901a6cb27f4cb5cf1d43ad126caf |
| `db/migrations/0045_crm_resolver_soft_delete_review.sql` | 8dbdbd5f59ac5542d3256c04d0f127646c136e0bfa03b847928f2e580354f08f |
| `db/migrations/0046_crm_governance_remediation.sql` | 69d178099101b964254fd1d09235d425500d6320883b7293477788898bc38f49 |
| `db/migrations/0047_crm_archive_restore_controls.sql` | 363c0423d2f55df1b3922e00794fa187841442b0e25118bc96df38fd0f36deac |
| `db/migrations/0048_crm_test_purge_and_blocked_outbound.sql` | 4ef62506621802fdfa12d433822500c55d222df03a6f14a8add3fc9b18982683 |
| `db/migrations/0049_crm_contact_aggregate_filters.sql` | 887c448a790627e8a3a6c77d2be5177fd879ddb97d9f96702ae6bc5593ee75d6 |
| `db/migrations/0050_harden_crm_trigger_function_grants.sql` | f3692c3bb69bd622bcd60ee8cb11d161a863683826a9daa5317e8a373ce5e9d8 |
| `db/migrations/0052_crm_contact_360_rpc_contracts.sql` | c75a2a6b38d554644981e0f51363654c9f139b27aea5625febe5e8d536b027a0 |
| `db/migrations/0053_quotes_header_foundation.sql` | 59d9006f76ae1952281d96f24cc2d9a59cb3cb9b0f7f058f524a94494612660f |
| `db/migrations/0054_quote_pdf_documents_and_uploads.sql` | 485771fdae6c50639461d0019cff393fac8613ca02f8b31c711dbc3a8a75e6fd |
| `db/migrations/0055_quote_transactional_rpc_contracts.sql` | 61cea8c210985190af72a9efb8c571485c0bdeeea5c1f91e260827ee7f71c8cf |
| `db/migrations/0056_quote_operations_traceability.sql` | bbb07de4c793944c070264ab982ed06ef2ce31df0f29d672c513be4bddc488b9 |
| `db/migrations/0057_quote_rpc_cutover.sql` | 213de32c102081e4538c80e89c71370409077e65b3976846f059bb3776b95c33 |
| `db/migrations/0058_fix_legacy_quote_document_link_ambiguity.sql` | 02dda6c6f9c0e2b545e1d949bdd296c9e880fc7f1e1877c6742dd205003b456b |
| `db/migrations/0059_quote_registration_intents.sql` | c0ed043b02c2f6a2b64773f947e97d95a4ba99b667e55803d1a6bf8e3b1b534b |
| `db/migrations/0060_quote_pdf_creation_cutover.sql` | 8793e832b80922e93797f96db466371ac4ada1c4d6ac02609399afdf707e0ce2 |

Protected collision rule: if any pre-existing dirty path differs after a command, restoration is refused. The unrelated image is separately proven byte-identical above; it was not included in any correction edit.

**Review:** owner `unassigned`; authorizer `task-scoped read-only authorization`; review status `unreviewed`; reviewer role `unassigned`; reviewed_at `unavailable`; evidence refs `identity.md`, `validation.md`.
