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

T1 own checks passed: three PostgreSQL subtests (four TAP tests including their
parent), 39 Node tests, TypeScript, lint and diff checks. Independent feature-wide
verification is still pending. Acceptance, requests and staff work remain T2/T3.

## Compatibility and rollout

Existing migrations through `0090` and staff quote RPCs are unchanged. Public
customer APIs deliberately have stricter visibility/acceptance rules than staff.
Never create a staff profile for a customer or put a customer ID into the
staff-profile `quote_events.actor_id` column. Preserve source-universe and quote
parent-to-child lock ordering for new mutations.

No production legal copy, hosted migration, real Auth/Storage/SMTP execution,
deployment, main merge, push, or Week 06 behavior is claimed.
