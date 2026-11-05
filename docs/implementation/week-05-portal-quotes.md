# Week 05 implementation — customer proposals

Scope authority: `weeks/week-05-portal-quotes.md`; live task/evidence log:
`odd/tasks/week-05-portal-quotes.md`. Hosted rollout is not included.

## Approved policy

- Only sent/accepted history is customer-visible; unshared draft/ready proposals
  and internal notes stay private. Historical versions are read-only.
- Acceptance requires the current unexpired sent version, its immutable ready PDF,
  explicit consent and a current Admin-published terms revision. The implementation
  supplies no production legal text. Publication must be approved by the business.
- No customer action silently replaces an already accepted commercial proposal.
- Acceptance/handoff and change-request tasks are due in 24 elapsed hours and go
  to the active assigned advisor. Missing/inactive ownership produces Admin intake.
- Quote acceptance is not Opportunity Won, Trip creation, or an economic gate.

## Current implementation

Migration `0091` adds immutable terms publication and narrow authenticated quote
read/PDF metadata RPCs. Customer identity is derived from the current active account
and Contact; direct quote/document/storage access remains denied. Version history
supports price/deposit/validity comparison without exposing staff DTOs or notes.

`/mis-viajes/cotizaciones` and its detail page use session-scoped RPCs. The PDF route
accepts only a version UUID, authorizes canonical metadata first, downloads through
a server-only client, verifies exact size/hash/PDF signature, and returns an
attachment with private/no-store headers. No public or browser-supplied storage
path is signed. Admins manage approved revisions at `/admin/portal-terms`.

Migration `0092` adds immutable acceptance and change-request evidence, exact
customer guards and compatible parent-to-child quote locks under the shared
historical universe guard. Acceptance records approved terms, exact version,
PDF and financial snapshot, customer/Contact identity and server time. It cannot
replace an existing accepted proposal. Requests are capped at ten per customer
per hour, with exact retries replayed before the cap is considered.

Acceptance events (staff or customer) create a prepare-handoff pre-alert/work
item. Customer requests cancel exact-version follow-up through the existing
automation primitive and create review work. Active assigned advisors receive
compatible manual Tasks due in 24 elapsed hours; unresolved ownership goes to
Admin intake. Admin claiming preserves the original deadline; staff completion
uses the existing audited `task_action` boundary. No Opportunity/Trip/economic
state is advanced by this work.

Deferred Task parity triggers now execute privately with sufficient authority to
read protected origin rows at customer transaction commit. Their bodies remain
byte-identical and public execution remains revoked; integrity is not disabled.
The staff response validator is retained; null-actor customer responses require
a matching immutable request row instead of a fabricated staff profile.

Own database and Node checks pass, including concurrent replay, zero-write
denials, legacy staff acceptance/replacement and late-failure rollback.

## Customer and staff interactions (T3)

The quote detail page displays preserved acceptance receipts and accepted terms,
distinguishes staff-recorded acceptance, and lists the ten most recent customer
requests. Only eligible current versions expose explicit consent and change-request
controls. Requests are trimmed and limited to 2,000 Unicode codepoints / 8,000
UTF-8 bytes. Failed submissions preserve input and retry identity; a successful
change request clears its text and receives a new server-generated request UUID.
Both submissions are disabled while pending. Each result announces feedback and
moves focus, including consecutive identical failures and transport errors. A
changed viewed lock, terms revision/hash or PDF hash requires consent again;
rerendering does not carry a checked consent box onto different proposal facts.

`/admin/customer-quote-work` is available to Admin, Asesor and Operations. The
database filters Operations to acceptance pre-alerts. Missing-owner work remains
Admin intake with its original deadline. Claiming refreshes the assignment without
promising ownership after a race; management uses the existing audited Task action
RPC and closed cancellation reasons. No customer/staff profile impersonation,
direct customer DML, Opportunity Won transition or Trip creation is introduced.

Only confirmed successful mutations revalidate customer quotes, staff quotes,
the work queue and dashboard. Failed/unknown RPC responses remain closed and
never display provider details. Independent feature-wide runtime verification,
including positive browser fixtures, remains T4; the bounded browser regression
source covers anonymous routes and malformed PDF inputs without hosted actions.

## Compatibility and rollout

Existing migrations through `0090` and staff quote RPCs are unchanged. Public
customer APIs deliberately have stricter visibility/acceptance rules than staff.
Never create a staff profile for a customer or put a customer ID into the
staff-profile `quote_events.actor_id` column. Preserve source-universe and quote
parent-to-child lock ordering for new mutations.

No production legal copy, hosted migration, real Auth/Storage/SMTP execution,
deployment, main merge, push, or Week 06 behavior is claimed.
