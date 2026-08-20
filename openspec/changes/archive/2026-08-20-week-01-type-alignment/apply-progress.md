# Apply Progress: Week 01 Type Alignment Remediation

## Final Status

**Complete bounded remediation.** The tracked generated Supabase snapshot is
already exact and was preserved byte-for-byte. The application nullable overlay
and the two authorized contract-test corrections are complete. Parent Week 01
remains `BLOCKED` on historical/provenance gates.

## Scope and generated identity

- Remediation token: `sha256:0764a8d1c682fa8da20c6cf46eeb096ea68f33f0917ea9fa99a72bf402568844`.
- Target: `lib/supabase/database.types.ts`.
- Target and fixed snapshot SHA-256:
  `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`.
- Target mode: `100644`; bytes: `113159`; LF lines: `3697`.
- Certified semantic ledger: `1105` additions, `765` deletions, `2238`
  unified-diff lines; binary patch hash:
  `4b8386f12185f0c8d81896f8434a603666aa32a0ff612b93dad1f2ff5eec1a50`.
- No generated file copy, regeneration, normalization, or mode change occurred.

## Authorized changes

- `lib/admin/quotes.ts`: added `QuoteCurrencyNullabilityOverlay` and applied it
  to `crm_quote_page` and `crm_quote_detail` row aliases.
- `tests/quotes-foundation-contract.test.ts`: moved semantic currency
  nullability assertions to the overlay boundary.
- `tests/quote-registration-intents-contract.test.ts`: removed only the stale
  generated-comment assertion; trusted-byte and service-role checks remain.
- Planning artifacts updated only under this change directory.

## Validation evidence

| Command | Result |
|---|---|
| Focused two-file contract suite | **21/21 PASS** after GREEN; RED failure recorded before overlay. |
| Exact ten-file differential suite | **61/64 PASS**; same three pre-existing server-only failures, no new failures. |
| `npx tsc --noEmit --incremental false` | **PASS**, exit 0 |
| `npm run lint` | **PASS**, exit 0 |
| `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build` | **PASS**, exit 0; 95 pages generated |
| `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run test:quote-notifications` | **15/15 PASS**, exit 0 |

### Differential warnings

The unchanged server-only harness failures are:

- `tests/catalog-admin.test.ts`
- `tests/quote-pdf-storage-contract.test.ts`
- `tests/quote-transaction-rpc-contract.test.ts`

They retain the same failure identity and are warnings only. The captured-type
diagnostic returned expected `PREIMAGE_CHANGED` because the tracked target is
already the captured postimage; its contract suite had one unrelated
pre-existing failure.

## next-env and rollback

- Captured `next-env.d.ts` preimage SHA-256:
  `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`.
- Guarded build command-owned postimage SHA-256:
  `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.
- The exact command-owned rewrite was restored and preimage re-verified.
- Rollback boundary is limited to `lib/admin/quotes.ts` and the two named test
  files. The generated snapshot and unrelated dirty paths must not be touched;
  no rollback mutation was required for this remediation.

## Protected scope

No provider, migration, package, lockfile, generated-type, image, parent,
adapter, config, lifecycle, staging, commit, or push mutation was performed.
Existing unrelated dirty paths remain unchanged.

## Recommendation

Ready for verification. Retain the three identical server-only failures as
pre-existing warnings. Do not claim Week 01 closure or fresh provenance.
