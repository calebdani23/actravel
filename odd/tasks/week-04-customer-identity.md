# Week 04 — Customer identity
Objective: complete the authorized Week 04 brief locally without granting customers staff access.
Branch: `feat/week-04-customer-identity`; delivery: auto-chain, stacked-to-main; runner: Node/tsx, disposable PostgreSQL, TypeScript, ESLint, Next build.

## Specs

- S1: "commit and push what we have done already, then continue to start and completely finish week 04 implementation". Existing Week 03 delivery is pushed to `origin/main` at `0b09b60`.
- S2: "`customer_accounts` linked to canonical Contact;". Explicit one-to-one account binding, no email-based Contact merging, no staff-profile creation. Active account, confirmed Auth email, current Contact status, and staff separation are enforced on every access.
- S3: "`portal_invitations` / passwordless access path;". Admin-only issue/revoke, exact Contact/email match, 72-hour random single-use invitation, replacement revokes pending invitations, atomic redemption, and append-only lifecycle audit. Email OTP is delivered by Supabase Auth; invitation acceptance does not trust browser email claims.
- S4: "`/mis-viajes` protected shell;". Separate customer login/verification/logout and a minimal protected shell. No Week 05 quote or acceptance feature is included.
- S5: "initial customer RLS helpers/policies;" and "explicit separation from staff `profiles/profile_roles`;". Customer data access is self-only. Existing authenticated staff-data policies are restricted without weakening existing staff authorization. Only public published catalog data remains public; internal Contact fields are not returned.
- S6: "adversarial cross-customer tests." and "Customer A cannot access Customer B data by changing URL/IDs/RPC params; customer authentication never grants staff access; invite/access lifecycle is auditable." Prove unauthorized, revoked, expired, inactive, staff collision, replay, and cross-customer rejection in disposable PostgreSQL and injected Auth boundary tests.
- S7: Completion is local-only. No remote database changes, real invitation emails, linked type generation, deployment, or Week 05 implementation. Record verification limits rather than claiming production parity.

## Tasks

- T1 [S2,S3,S5,S6] inline — completed locally — independent real PostgreSQL proof passed; SQL/backend unchanged by the UI correction. Risk: items 1,2,3,4; commit `11f2806`.
- T2 [S3,S4,S6] inline — completed locally — invitation retention corrected and independently verified with Alice/Bob login/isolation/logout. Risk: item 2; original commit `aa55cdc`, correction `7512ebe`.
- T3 [S1,S6,S7] inline — local verification completed — independent PostgreSQL scenario, 37 Node tests, types/lint, production build and Chromium 3/3 passed. Evidence commit `a4bb708`; see `docs/implementation/week-04-verification.md`. Hosted Auth/SMTP and main delivery remain excluded.

## Log

- L1: User request verbatim: "commit and push what we have done already, then continue to start and completely finish week 04 implementation".
- L2: Week 03 published through `0b09b60`, including 25 pre-existing and 38 new commits. Runtime/tooling files and stale Week 01 planning were excluded. Native hooks ran; temporary OpenCode snapshot disabling prevents inherited-index contamination. No hooks/config were bypassed or persisted.
- L3: Scope authority is `docs/implementation/weeks/week-04-portal-identity.md`. The user explicitly superseded the prior planning-only handoff and authorized full local Week 04 implementation.
- L4: Under delegated decision authority, use conservative invitation-only onboarding, Admin-only issuance/revocation, no staff/customer identity overlap, one account per Contact, verified exact email, no auto-merge, and immediate denial for blocked/deleted Contacts or disabled accounts. A failed signup may leave an unlinked Auth identity with no application authority or staff profile.
- L5: Forecast approximately 1,000–1,800 authored lines, sliced at coherent behavior boundaries below 1,200. Implementation stays inline because identity, invitation, and shell contracts are dependent; independent verification follows for security/data risk. Existing unrelated dirty tooling remains preserved.
- L6: Supabase official OTP documentation confirms `signInWithOtp`, `shouldCreateUser`, and `verifyOtp({email,token,type:'email'})`. Delivery templates require `{{ .Token }}`. Actual hosted Auth delivery is not exercised by local fixtures.
- L7: Observed RED: missing customer table in disposable PostgreSQL; missing OTP adapter in Node tests. GREEN: complete invitation/account/RLS/role-collision/replay/revocation/expiry/audit/throttling test; 36 focused/legacy-route tests; TypeScript and lint. Test fixtures preserve existing purge guards rather than disabling them.
- L8: Loopback-only Chromium run built successfully and passed anonymous portal/staff isolation. The remaining test hit an ambiguous locator matching Next's route announcer; narrowed to the actual failure message, rerun pending. No hosted Auth or email operation occurred.
- L9: Final own checks: expanded PostgreSQL security test PASS, 37 Node tests PASS with zero skips, TypeScript/lint/diff PASS, loopback Chromium 2/2 plus production build PASS. Generated next-env restored. Private calendar/cutoff tables retain revoked grants and gain deny-by-default RLS. No hosted Auth delivery or remote database test was performed.
- L10: Independent verifier status is explicitly incomplete, not PASS: static/Auth-boundary checks passed but DB/browser were unavailable in its sandbox. Do not call Week 04 closed or advance Week 05 without resolving this missing proof or an explicit human decision accepting its documented limits.
- L11: T1 committed as `11f2806` (467 lines); T2 as `aa55cdc` (444 changed lines), both with the existing Guardian Angel hook enabled. Week 04 commits remain local on the feature branch; only the already-completed Week 03 delivery was pushed. RDD remains user-disabled.
- L12: User decision verbatim: "Keep closure pending (Recommended)". Require independently executed database/browser checks in an appropriately configured verification environment. Do not waive the missing proof, close Week 04, or advance Week 05.
- L13: User request verbatim: "okey perfect, then lets work on the checks or verificarions that are needed to be able to push it to main". User selected "Scoped verifier agent (Recommended)". Only scoped local runtime provisioning was authorized; source/index preservation and no hosted access remain mandatory.
- L14: Independent RED at `f31b9de`: after email entry, invitationToken becomes empty before any OTP/RPC call. User selected "Fix and reverify (Recommended)" for the bounded component/test correction, not merge or main push.
- L15: Correction `7512ebe` passed writer checks and the independent real-SQL/local-Auth browser journey (3/3). Fresh independent focused tests 37/37, TypeScript and lint passed for that candidate; unchanged SQL retains its independent 1/1 composite scenario. No proof was waived. Local readiness is recorded in `docs/implementation/week-04-verification.md`; no main merge/push or production-readiness claim.
