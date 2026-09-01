```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1e783f05c9635d45504a04a9c922b46b477e3858a3e556beafe0eaeddd61a67b
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 9/9
test_command: node --conditions react-server --import tsx --test tests/staff-notifications-contract.test.ts tests/staff-notifications-runtime.test.ts tests/staff-notifications-types.test.ts
test_exit_code: 0
test_output_hash: sha256:75d012e2946342f10dd0e3596875fc0773312c98f997a342a328d1e663ea88d7
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:d48f0e861b621b73a5844a8c1217613ded829bcec5e5d2ce482d3d20604a5cba
```

## Verification Report

### Scope and completeness

The report covers `week-02-staff-notifications-foundation`. All 12 implementation tasks were
checked complete in the supplied apply progress. The six requirements and nine scenarios were
counted directly from the active specification.

### Test and build evidence

| Check | Command | Result |
|---|---|---|
| Focused notifications | `node --conditions react-server --import tsx --test tests/staff-notifications-contract.test.ts tests/staff-notifications-runtime.test.ts tests/staff-notifications-types.test.ts` | exit 0, 7/7 |
| TypeScript | `npx tsc --noEmit` | exit 0; output SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Lint | `npm run lint` | exit 0; output SHA `27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf` |
| Build | `npm run build` | exit 0; `next-env.d.ts` restored |
| Quote notifications | `npm run test:quote-notifications` | exit 0, 15/15 |

### Independent shadow evidence

Supabase CLI `2.115.0` was applied to a clean minimal disposable shadow using actual Docker
container discovery and container `psql`. Migrations `0001`–`0063` were applied once; the catalog
reported 62 migration rows because the accepted repository disposition omits `0057`.

Catalog evidence SHA: `21da9716e3683fdc828a91f9add6ed1c9d4b86ccc6e29966284a81281875e459`.
It proved the table, FKs and `SET NULL`/`RESTRICT` actions, checks, unique and partial indexes,
RLS policy, client DML grants, RPC execute grants, PostgreSQL ownership, `SECURITY DEFINER`, and
`search_path=public`.

Runtime evidence SHA: `5a5a46a5895174e75166b31f9fc3c27b3a841eb9196d20f3f838106348abdfa9`.
Trusted creation, exact replay with one row, active-recipient listing, mark-read idempotence, and
inactive-recipient hiding passed under proper SQL roles. Generated types completed successfully;
output SHA: `3d6d529435f4775b1b666fd893ed1f42954db0cf7c326dbeca466b99f92d5d4d`.

The shadow root and matching Docker resources were removed with no remote mutation. The supplied
parent evidence was validated against SHA
`1e783f05c9635d45504a04a9c922b46b477e3858a3e556beafe0eaeddd61a67b`.

### Compliance matrix

| Requirement | Scenarios | Result |
|---|---:|---|
| Persist constrained records | 2 | PASS |
| Trusted creation seam | 1 | PASS |
| Deterministic replay safety | 2 | PASS |
| Recipient-only visibility/read state | 2 | PASS |
| History and descriptive context | 1 | PASS |
| Fail closed and independent verification | 1 | PASS |

### Warnings

- The SQL immutable-fields check is tautological (`id IS NOT NULL`); absent client DML
  privileges/policies and unchanged returned rows provide the concrete protection.
- Generated Supabase Args widen nullable `p_quote_id` and `p_task_id`; the adapter uses a local
  narrow seam without editing generated output.
- The canonical SHA input is delimiter-based without escaping. Every concrete normalization and
  replay scenario passes, and the contract defines those exact bytes.
- The full no-external glob regression was 418 passed, 1 failed, 1 skipped out of 420. The single
  failure is the known base-only quote transaction type assertion for nullable
  `p_expected_accepted_quote_id`/`superseded_quote_id`; notification changes do not touch those
  fields or that test.

Final assessment: PASS with the warnings above; no blocker or critical finding.
