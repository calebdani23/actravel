# Week 04 — independent local verification

## Result

**PASS for the specified local checks**, including the corrected signed-in
customer journey. Ready for main-integration review against local baseline
`0b09b60100ef7ef168917f9fe7a561db55c88559`; no merge or push was performed.

Verified executable candidate: `7512ebe4af12a4f4c09aff4a28826ffcf250ef7a`.
The original database proof used `f31b9dea18a3980cb265cec352d9ab9ebf9104c6`.
Only the login component, its browser regression, and the task log changed
between these commits. Independent manifest comparison confirmed unchanged SQL,
server Auth code, database tests, and other backend inputs.

## Independent execution

A user-authorized `week04-runtime-verifier` ran fixed commands against Git-archive
copies, with sanitized environment variables and no hosted credentials. Its
tools denied source edits, arbitrary shell commands, Git delivery and hosted
database access. PostgreSQL used a cached image, no container network, and a
unique per-run cleanup label. Browser servers listened on loopback only.

| Check | Observed result |
| --- | --- |
| PostgreSQL identity/invitation/RLS scenario | 1/1 composite scenario, zero skips |
| Focused customer/staff route regressions | 37/37, zero skips, refreshed at corrected candidate |
| TypeScript | Exit 0, refreshed at corrected candidate |
| ESLint | Exit 0, refreshed at corrected candidate |
| Committed Chromium tests plus positive journey | 3/3, zero skips |
| Production build | Passed as required Playwright server startup; no page-count claim |
| Original and scratch source, index, worktree status | Preserved |
| Generated `next-env.d.ts` | Restored |
| Run-owned PostgreSQL containers and Auth fixture | Cleanly stopped |

The SQL scenario exercised explicit Contact binding, wrong/unconfirmed customer
denial, duplicate/staff-email rejection, concurrent redemption convergence,
single redemption audit, account isolation, revoked/replaced/expired invitation
denial, blocked/disabled access, direct mutation denial, staff separation,
published-only catalog visibility and request throttling.

The positive browser journey exercised Alice and Bob login, independent portal
identities, Alice-to-Bob URL tampering without identity switching, private-note
omission, staff-route denial, logout access removal, and preservation of Bob's
separate session. It used a **simulated Auth HTTP protocol with real application
SQL/RLS**, not hosted GoTrue or SMTP.

## Defect found and corrected

The original component captured the invitation by mutating hidden-input defaults.
Typing an email triggered a React render that reset the token to an empty string.
The independent positive journey failed before any OTP request, providing RED.

Commit `7512ebe` retains the invitation in a per-form `useSyncExternalStore`
store and controlled inputs. The token is removed from the URL and is not written
to persistent browser storage. Durable browser assertions cover token retention
through input, request, and failed verification; the independent journey passed
after the correction. No backend or migration change was needed.

The first scratch build also failed because Turbopack rejects dependencies linked
outside the project root. Copying the cached dependencies resolved that setup
failure without changing application code or installing packages.

## Evidence hashes

| Receipt/log | SHA-256 |
| --- | --- |
| Original SQL/static receipt | `ece8ac889708dc6f9bdacf98cc6a6a50f024bcdcf8e50cf0cc87e3fdf29dfa01` |
| Original SQL log | `9e6d25bb31746c9b663cb0500f7b9b937d4e6d64c501432bdae26822921150d5` |
| Confirmed token-reset RED receipt | `da430ecdcad2863aabbdb9e356ac0cd76c9f2e4f4c16a1abc4e75ca42768e549` |
| Corrected three-test browser receipt | `62db1755d1dbf5006389b643a05758547ef412f2f5fdab10a0639084f9261d59` |
| Corrected browser log | `5df765de0d2d5abea1b107e2fb63ddf8372ef652a3b44cf2fc718733f552968c` |
| Fresh corrected static receipt | `6d7e66e09a6270a235a6277d8c1143474193dd37319ec6c6409b70a362df35bf` |
| Corrected source-input manifest | `78f7192b04a6890c7083c7bdb9781ac09a3f48a60d9588fd832110b595271ce0` |

Raw local receipts/logs are retained under the ignored
`.opencode/verification/week04/` directory. Agent and runner configuration are
also project-local and ignored; existing agents, hooks and root configuration
were not changed. Rebind the fixed runner explicitly before checking a later
executable candidate.

## Limits and next step

This is bounded local verification, not exhaustive proof of every staff role,
storage policy, daily throttle boundary, or every lifecycle audit combination.
It does not establish live GoTrue/email-template/SMTP integration, hosted schema
parity, operational migration application, deployment or production readiness.
Keep the implementation document's rollout prerequisites. Recheck upstream Git
state at delivery time; main integration and push remain a separate authorized
operation. Do not advance Week 05 from this report.
