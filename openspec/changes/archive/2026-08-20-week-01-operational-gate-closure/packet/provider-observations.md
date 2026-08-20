# Provider Observations — Read-only

Captured after exact URL assertion, using fixed catalog/SELECT statements in read-only transactions with a 10-second local statement timeout. No application function was invoked.

## Session assertion correction

Strict-final recapture returned `session_role=postgres`, `transaction_read_only=on` on every row across six fixed allowlisted queries. The underlying session is privileged `postgres`, not a dedicated read-only credential; every query remained explicitly transaction-read-only with timeout and no mutation. Provider verifier `provider-signoff.md` SHA `e23b2c7fd39c485f1f0d9135fe7a1bcbaf6e08597902e8b84788b41f54770532` verified the immutable strict-final manifest SHA `7b5e315c55021984d0fdf1dd2f51b758d80648ebdc80fc45c7be8cb2dc555b2e` at `2026-08-19T01:01:10Z`.

| Observation | Finding | Classification |
|---|---|---|
| Migration ledger | 59 rows; remote-only `0051` and `drop_public_rate_limits_write_policy`; no remote `0057`; `0060` present | remote-only/untracked or ambiguous/manual-review |
| Rate-limit policy | authenticated staff read policy; definition hash captured | remote state corroboration, not provenance |
| `0044`–`0049` | CRM routine/trigger catalog hashes captured | ambiguous/manual-review |
| `0057` / `0060` | `0057` absent and `0060` present; quote cutover state exists | ambiguous/manual-review; no replay authorized |
| Catalog/extensions | public/storage catalog and five extensions observed | behavior corroboration only |

The strict-final fixed queries captured complete raw and normalized output for all targeted routines, 18 targeted quote/CRM triggers, and 2 targeted policies. Raw and normalized files are retained under `tmp/audit-evidence/week01-provider-strict-final/` and cross-linked by `provider-evidence-manifest.md`.

## Deterministic anchors

| Subject | Catalog definition hash |
|---|---|
| `0051`-related `crm_advisor_can_access_live_opportunity` | `c149918374c5091b9b1dabd4f70206fb` |
| `0044` bulk mutation (`crm_bulk_mutate`) | `9b10bf2e297b194ecca6bf4747baf1db` |
| `0045` resolver (`crm_resolve_opportunity_lead`) | `9468535d9c1fa62aedf779da2a2c8dcc` |
| `0046` governance (`crm_guard_governance_fields`) | `4abb4329db6fbab4ca228b30b3fd5c60` |
| `0047` archive (`crm_bulk_archive_opportunities`) | `3ab502a004b0fbeff4a78f0d4cc2d99f` |
| `0048` purge (`crm_require_test_data_purge`) | `3739d91054f5a0d91a44a43bf3bdcf70` |
| `0049` aggregate (`crm_contact_aggregate_page`) | `afbe7a7847bf0c9d43159a1df7b99216` |
| rate-limit policy expression | `a50a8bbed2383e0438af16ef9e7dbee9` |
| `0060` registration (`crm_register_quote_with_pdf`) | `fe3429a7cbf71af3eaedb07572baf4c7` |
