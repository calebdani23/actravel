```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e1a00e3293890e507cf17fb66a4a6d635dea8c54c895156cda8e352de511c30d
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 11/11
test_command: node --import tsx --test tests/quotes-foundation-contract.test.ts tests/quote-registration-intents-contract.test.ts
test_exit_code: 0
test_output_hash: sha256:2c60fd0ab98567b3ca2801a3360fbfbd5c07a7c316454c94805fdd5c18aa38ae
build_command: E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build
build_exit_code: 0
build_output_hash: sha256:7e5e26a69941b96b9b4e50b1318f511d34093f4c72aca5730baca0ad4134a69d
```

## Verification Report

**Change:** `week-01-type-alignment`
**Attempt:** `sha256:e1a00e3293890e507cf17fb66a4a6d635dea8c54c895156cda8e352de511c30d`
**Implementation:** `b08c3a2` (`b08c3a2675ecbf39993c5d71a7fc5dfef5cbd10c`)
**Review:** native `review-652f86237c0aabc7`, approved
**Verdict:** **PASS WITH WARNINGS**

### Completeness

| Dimension | Result |
|---|---:|
| Tasks | 14/14 checked complete |
| Requirements | 5/5 verified |
| Scenarios | 11/11 covered |
| Scope | Protected paths unchanged; only the four-path implementation allowlist is present in the target commit |

### Runtime evidence

| Command | Exit | Result | Output hash |
|---|---:|---|---|
| `node scripts/captured-type-tsc.mjs` | 0 | Fixed snapshot identity, empty baseline/candidate diagnostics, `TSC_COMPATIBLE_WITH_CAPTURED_SNAPSHOT` | `sha256:b9ce91f83be4f562d70eb9ec0a020706a11795977ef2c1d9e988ff225e01fa5d` |
| Focused two-file contract suite | 0 | 21/21 passed | `sha256:2c60fd0ab98567b3ca2801a3360fbfbd5c07a7c316454c94805fdd5c18aa38ae` |
| Exact ten-file differential suite | 1 | 61/64 passed; the same three server-only harness failures remain pre-existing | `sha256:3d732cd01e2f29dacaab028ddc184700a4a550f6c405cea2edec0c131b120776` |
| `npx tsc --noEmit --incremental false` | 0 | Passed with empty output | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `npm run lint` | 0 | Passed | `sha256:27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf` |
| Guarded build | 0 | Build passed; command-owned `next-env.d.ts` rewrite restored and re-verified | `sha256:7e5e26a69941b96b9b4e50b1318f511d34093f4c72aca5730baca0ad4134a69d` |
| `npm run test:quote-notifications` | 0 | 15/15 passed | `sha256:1695427aa377e24b46e246349f3a534c63d32b8775ff66c9e458d5d6f98e50c7` |

The three differential warnings are `tests/catalog-admin.test.ts`,
`tests/quote-pdf-storage-contract.test.ts`, and
`tests/quote-transaction-rpc-contract.test.ts`. Their server-only import
failures match the recorded pre-alignment identity; no new or changed failure
was observed.

### Generated identity and nullable overlay

`lib/supabase/database.types.ts` is mode `100644`, 113159 bytes, 3697 LF
lines, and SHA-256
`b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`. The fixed
snapshot has the same bytes and hash. No regeneration, copy, normalization, or
mode change occurred. The certified semantic ledger is 1105 additions, 765
deletions, and 2238 unified-diff lines; binary patch hash
`4b8386f12185f0c8d81896f8434a603666aa32a0ff612b93dad1f2ff5eec1a50`.

`QuoteCurrencyNullabilityOverlay` explicitly maps `current_currency` and
`accepted_currency` to `string | null` for both `crm_quote_page` and
`crm_quote_detail`. Focused contract assertions pass at that overlay boundary.

### Build ownership and rollback boundary

The captured `next-env.d.ts` preimage is
`sha256:7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`.
The guarded build produced the exact command-owned postimage
`sha256:7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`;
it was restored and the captured preimage was re-verified. No unknown or
colliding bytes were overwritten.

Rollback is limited to `lib/admin/quotes.ts`,
`tests/quotes-foundation-contract.test.ts`, and
`tests/quote-registration-intents-contract.test.ts`. Existing unrelated dirty
paths (`docs/about/helps/intakes/image.png`, `docs/implementation/ACTIVE.md`,
and the two pre-existing untracked operational change directories) remained
untouched. No provider, migration, package, lockfile, generated-type,
configuration, lifecycle, staging, commit, or push operation was performed.

### Compliance matrix

| Requirement | Evidence | Result |
|---|---|---|
| Preserve generated snapshot and nullable quote consumers | Exact target/snapshot identity plus focused overlay contracts | PASS |
| Record generated semantic identity | Certified counts and stable binary patch hash | PASS |
| Capture bounded validation diagnostics | Captured diagnostic, compiler, lint, guarded build, differential, and quote tests | PASS WITH WARNING |
| Gate risky actions and preserve scope | Commit and worktree inspection show only authorized implementation changes; unrelated dirty paths unchanged | PASS |
| Preserve generated-type and historical boundaries | Report makes only narrow alignment claim; parent Week 01 remains `BLOCKED` | PASS |

All eleven scenarios are covered: exact preservation, fail-closed identity,
semantic diff review, safe validation, deferred consumer remediation,
pre-existing differential warning isolation, exact `next-env.d.ts` cleanup,
unsafe cleanup handling, protected scope, narrow alignment reporting, and
continued historical/provenance blocking.

### Warnings

- The differential command exits 1 because of the three identical pre-existing
  server-only harness failures; this is a differential warning, not an
  alignment failure.
- Push/delivery remains externally blocked by missing credentials.
- This report does not prove fresh provider provenance, recovery readiness,
  authorization for `0061+`, or Week 01 closure. The parent remains
  `BLOCKED`.

## Final verdict

**PASS WITH WARNINGS** — the bounded generated-type alignment, nullable overlay,
consumer validation, guarded build cleanup, and protected-scope requirements
are independently verified at the approved local commit.
