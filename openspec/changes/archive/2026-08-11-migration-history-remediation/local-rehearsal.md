# Local Rehearsal

**Disposition:** `unavailable` (fail closed). The repository has no initialized Supabase project configuration. Official current documentation confirms that `supabase init` creates the required `supabase/config.toml`, but creating tracked config is prohibited by this work unit. `npx supabase --version` resolved `2.113.0`; Docker reported `29.4.1`; neither justifies initialization or a target.

| Item | Result |
|---|---|
| Rehearsal target | None; no stack started |
| Linked/production proof | Not applicable; no target was created or linked |
| Backup input | Unavailable; no backup command was run |
| Restore target | Unavailable; no isolated target was created |
| External boundaries | Application validation used `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` where supported |
| Authorization | No local stack, database, migration, dump, restore, reset, or remote command authorized |
| Cleanup | No disposable target or rehearsal secret/log was created; ignored validation logs retained only as sanitized hash-addressed evidence |
| Limitation | Local proof cannot establish remote or production restore readiness |

## Threat RED checks

Checks were written and executed before collection using harmless classifiers/fixtures, never against a database:

| Threat | Fixture | Exact result | Evidence |
|---|---|---|---|
| Shell/subprocess failure/timeout | `timeout 1s python3` with a 2-second sleep | exit `124`; rejected as timeout | MHR-E-008; `/tmp/opencode/mhr-threat-timeout.log` |
| Mutation-shaped DB request | classifier input `delete from public.contacts` | classifier exit `1`; request not executed | MHR-E-008; `/tmp/opencode/mhr-threat-mutation.log` |
| Unknown executable | classifier input `curl` outside allowlist | classifier exit `1`; executable not run | MHR-E-008; `/tmp/opencode/mhr-threat-executable.log` |

## Repository validation harness

| Command | Exit | Result | Log SHA-256 |
|---|---:|---|---|
| `npm run lint` | 0 | ESLint completed | `27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf` |
| `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build` | 0 | Next.js build completed; 95 static pages generated | `b8a303977bbf89667872c14175316485eadfb521ffe480411b8dc64baa602fc3` |
| `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run test:quote-notifications` | 0 | 15/15 passed, 0 failed | `07f9665d9bbff4ded5d4b582194a438af527ce94ac201cd50d89e967d7b006e3` |

The build temporarily rewrote `next-env.d.ts` from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`; the known generated change was restored and status was rechecked. No protected file was regenerated.
