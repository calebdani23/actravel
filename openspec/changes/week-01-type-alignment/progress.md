# Apply Progress: Week 01 Type Alignment Remediation

## Status

Bounded remediation implemented. Generated snapshot preserved exactly. Parent
Week 01 operational gate remains `BLOCKED`.

## Completed

- Added the minimum nullable currency overlay for `crm_quote_page` and
  `crm_quote_detail` in `lib/admin/quotes.ts`.
- Moved quote currency nullability assertion to the overlay boundary.
- Removed only the stale generated-comment assertion from the registration
  contract; trusted-byte and service-role checks remain.
- Recorded strict-TDD RED/GREEN evidence and bounded validation results in
  `tasks.md`.

## Validation

- Generated target and fixed snapshot both SHA-256
  `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`; target
  mode `100644`, 113159 bytes, 3697 LF lines.
- `npx tsc --noEmit --incremental false`: PASS.
- `npm run lint`: PASS.
- Direct ten-file differential suite: 61 pass, 3 identical pre-existing
  server-only harness failures in `catalog-admin.test.ts`,
  `quote-pdf-storage-contract.test.ts`, and `quote-transaction-rpc-contract.test.ts`;
  warning only, no new failures.
- `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build`: PASS; command rewrite of
  `next-env.d.ts` was restored to SHA-256
  `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`.
- `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run test:quote-notifications`: 15/15
  PASS.
- Captured diagnostic returned expected `PREIMAGE_CHANGED` because the tracked
  target is already the captured postimage; its contract suite had one unrelated
  pre-existing test failure.

## Protected Scope

No provider, migration, package, lockfile, generated-type, image, parent, or
adapter edit was made. Existing unrelated dirty paths remain unchanged.
