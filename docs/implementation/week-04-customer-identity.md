# Week 04 customer identity implementation

## Scope

Local customer identity, invitation lifecycle, passwordless access, and the
protected `/mis-viajes` shell. Quote/acceptance, traveler, and trip data are not
exposed in this week. Migration `0090` is additive; predecessors remain unchanged.

## Identity and authorization

- Customers use the existing Supabase Auth project but never receive a staff
  `profiles` or `profile_roles` row. A reciprocal profile-insertion guard prevents
  later accidental overlap. Customer and staff emails cannot share an invitation.
- An Admin selects the canonical Contact explicitly. A confirmed Auth email must
  match the invitation and current Contact email. Ambiguous duplicate emails
  require staff reconciliation; normalization never merges Contacts.
- One account belongs to one Contact and one Auth user. Rebinding an account is
  not a self-service operation. No customer can create, update, or delete an
  account directly.
- Every portal read checks active account, current confirmed email, live/unblocked
  Contact, and no staff profile. Disabling an account or blocking/deleting its
  Contact denies an already-issued session immediately at the next data read.
- The shell returns only account identity and bounded display name. No customer
  policy exposes complete Contact rows or private CRM notes.
- A restrictive policy on existing public tables preserves their prior staff
  policy predicates while allowing customer SELECT only where an anonymous
  policy already allows it. Storage receives the same boundary. No new broad
  staff grant is created; published public catalogs remain available.

## Invitation and email flow

1. Admin opens `/admin/portal-invitations`, selects an exact Contact ID, and issues
   a 72-hour invitation. Pending invitations for that Contact are revoked.
2. The database generates 256-bit randomness and stores only its SHA-256 digest.
   The bearer link is shown once for secure manual delivery. Its token is in a
   URL fragment, not a query string; the login form removes the fragment after
   capturing it in its two hidden fields. Do not log or paste invitation links
   into operational logs.
3. Supabase Auth sends an email OTP. Pre-authentication eligibility is resolved
   by a narrowly granted server-only RPC. Browser roles cannot invoke it. Unknown
   email, denied invitation, throttle, and provider errors have the same message.
4. OTP verification proves mailbox control. Atomic redemption binds the verified
   Auth user and Contact once; retries by that user converge. Other users cannot
   redeem it. Existing accounts use OTP with `shouldCreateUser: false`.
5. Admin can revoke invitations or disable accounts. Append-only events record
   issuance, replacement, revocation, redemption, disablement, and access requests.

OTP request limits are one per Contact per minute and twenty per rolling day,
in addition to Supabase Auth's own rate limits. Verification uses Supabase's OTP
expiry/attempt controls. Lifecycle audit records requests, not guaranteed email
delivery. Failed signup may leave an unlinked Auth identity with no application
authority.

## Configuration and rollout boundary

The existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
server-only `SUPABASE_SECRET_KEY` are used. For email OTP, configure Supabase's
Magic Link email template to include `{{ .Token }}` and keep six-digit OTPs.
Use the provider's production SMTP and rate-limit controls before deployment.
Never expose the secret key in a client bundle or put it in source control.

No hosted configuration or migration is changed by local implementation. Real
GoTrue delivery/session exchange requires a separately configured Supabase test
project or local Auth stack; injected boundary tests do not claim live delivery.

## Verification and rollback

Observed local checks: one disposable PostgreSQL scenario covering invitation
creation/replacement/revocation/expiry, concurrent redemption, verified-email and
staff collision rejection, cross-customer isolation, disabled/blocked access,
audit immutability, catalog privacy and request throttling; 37 focused/legacy
Node tests; Chromium 2/2; TypeScript, lint and production build passed.

Independent review found no reproduced application defect in its static and
injected-boundary checks, but could not run PostgreSQL or Chromium under its
scratch-only restriction. Its verdict is incomplete, not a full security PASS.
Week 04 is implemented locally but closure is pending this verification limit.

`RUN_CUSTOMER_IDENTITY_DB_TESTS=1 node --conditions react-server --import tsx --test tests/customer-identity-runtime.test.ts`

`node --conditions react-server --import tsx --test tests/customer-portal.test.ts tests/endpoint-protection.test.ts tests/admin-navigation.test.ts tests/admin-route-boundaries.test.ts`

`npx playwright test e2e/customer-portal.spec.ts --project=chromium`

Tests use disposable PostgreSQL or injected Auth dependencies. Browser tests
submit only malformed invitation tokens, so they never send real emails.
Before any data exists, remove the additive boundary only in reverse dependency
order. Once customer/invitation/audit state exists, disable access and retain
records; do not restore broad authenticated reads while customer sessions exist.
