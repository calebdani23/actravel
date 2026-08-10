# AC Travel Technical Blueprint — Volume III
## Agent mirror: target architecture and initial 12-week roadmap

Baseline used when this Blueprint was approved: `main@01d5a6b0bea066a0ea87943de922e39d18eb4dac`. **Always inspect current HEAD and remote Supabase reality before acting.**

## Architectural decision

Do not rewrite AC Travel. Evolve the existing repository into a **modular monolith**:

- one Next.js/TypeScript repository;
- Supabase PostgreSQL/Auth/Storage/RLS as operational source of truth;
- Vercel deployment;
- server-only adapters for external providers;
- three product surfaces: Public Web, `Mis viajes`, Staff Panel;
- modules/domains create boundaries; microservices do not.

## Baseline repository strengths to preserve

- bilingual public site and dynamic catalog;
- quote intake with Zod/normalization/dedupe/attribution;
- Contact + physical `leads` hierarchy and Contact 360;
- strong CRM governance/soft-delete/data-quality patterns;
- RLS and server-side role guards;
- standalone `quotes` + immutable `quote_versions` + private canonical PDF chain;
- accepted quote traceability into bookings/payments;
- private Storage/signed-file patterns;
- Resend email boundary, WhatsApp tracking/assisted launch;
- broad contract/admin/Playwright test base;
- Supabase as source of truth, Google Sheets removed from active operations.

## Gate 0: baseline reconciliation

Before allocating any migration after the existing local chain, prove repository migration history and the **actual remote Supabase migration/schema state** are aligned. Documentation is not evidence of remote state.

Required result:
- local migration inventory/checksums/names;
- remote migration history;
- remote-only / local-pending / ambiguous classifications;
- schema/RLS/helper drift investigation;
- regenerated DB types after alignment;
- build/test baseline;
- staging/rehearsal and rollback assumptions documented.

Never use destructive cleanup merely to make histories appear equal.

## Target module boundaries

Progressively move domain rules behind modules; do not perform a big-bang refactor.

- `modules/identity` — staff/customer identity, roles/access.
- `modules/crm` — contacts, opportunities, intake, ownership, activity.
- `modules/tasks` — tasks, SLA, staff notifications, Mi día projections.
- `modules/quotes` — headers/versions, acceptance, change requests, PDFs.
- `modules/trips` — trips, travelers, bookings, handoff, readiness/checklists.
- `modules/finance` — obligations, actual payments, allocations, balances.
- `modules/documents` — visibility/publication/private access.
- `modules/communications` — templates/adapters/outbound evidence.
- `modules/catalog` — catalog + editorial workflow.
- `modules/marketing` — campaigns/publications/attribution.
- `modules/suppliers` — suppliers/contacts/reservation sourcing.
- `modules/support` — travel incidents/escalations.
- `modules/analytics` — business/product projections.
- `modules/automation` — outbox/domain-event handlers/retries.

Existing `lib/admin/*`, `lib/leads/*`, etc. may remain compatibility façades while logic moves incrementally.

## Data architecture

### Preserve/evolve
- `contacts` — canonical identity; extend relationship ownership/lifecycle dimensions.
- `leads` — preserve physical table, expose as Opportunity in new domain/UI.
- `lead_statuses`, `lead_events`, `lead_notes` — preserve history; stop using event payloads as the primary pending-work queue.
- `quote_requests` — inbound request.
- `quotes`, `quote_versions` — preserve and extend; do not rebuild.
- `profiles`, `roles`, `profile_roles` — staff identity/multirole; add Manager and capability evolution.
- `destinations`, `services`, `packages`, `promotions` — evolve editorial/SEO/scheduling.
- `bookings` — preserve; evolve to individual reservation/service under Trip.
- `payments` — preserve as actual money movements.
- `documents` — add trip/traveler/visibility/publication context.
- `message_templates`, technical logs — preserve/evolve.

### New first-class entities
- `trips`
- `travelers`
- `customer_accounts`
- `portal_invitations`
- `trip_access_grants`
- `customer_requests`
- `tasks`
- `staff_notifications`
- `quote_acceptances`
- `payment_obligations`
- `payment_allocations`
- `suppliers`
- `supplier_contacts`
- `incidents` (travel support, not technical-log incident status)
- `marketing_campaigns`
- `marketing_publications`
- `attribution_touchpoints`
- `outbox_events`
- `business_events` gradually for cross-domain activity

Core relationship: Contact 1—N Opportunity(`leads`) 1—N Quote 1—N QuoteVersion. A sold/handoff Opportunity produces a Trip. Trip 1—N Bookings, Travelers, PaymentObligations, Documents, Tasks, Incidents. Payments apply to obligations through PaymentAllocations.

## Migration strategy

Use **expand → backfill → compatibility/dual-read → validate → cutover → contract**.

- No physical rename of `leads` in the initial three months.
- No destructive conversion of `bookings` into Trip.
- New tables ship with RLS in the same change set.
- Backfills must be deterministic, idempotent, rerunnable, and classify ambiguous rows for review.
- Prefer transactional RPCs for critical multi-table state transitions.
- Add constraints after data is ready; use staged validation when appropriate.
- Application deploys should remain compatible across migration windows; rollback app without requiring destructive DB rollback.

## CRM evolution

- New code/domain says Opportunity while physical table remains `leads`.
- Add Contact relationship owner independent from Opportunity `assigned_to`.
- Separate relationship stage/flags/governance instead of overloading lifecycle.
- Normalize source/campaign relationships without erasing legacy `source`/snapshots.
- Require close reasons for Lost/Discarded/Future follow-up.
- Replace pending follow-up reconstruction from `lead_events.payload.followUpAt` with first-class `tasks`; keep events as history.

## Tasks, SLA and automation

`tasks` is the core of `Mi día`. Minimum model: contextual entity IDs, type/title/status/due_at, assigned_to/created_by, idempotency/automation key, completion outcome/audit.

Initial event rules:
- new assigned Opportunity → first-contact task, SLA target 15 min;
- quote sent → follow-up +48 h, cancel on response/acceptance/payment;
- quote accepted → pre-alert + prepare-handoff task;
- economic gate met → formal Sales→Operations handoff checklist/task;
- payment due/overdue → Finance task/notification;
- booking pending deadline → Operations task;
- Trip 30/14/7/2 days → idempotent pre-trip checklist tasks;
- P1 incident → immediate notification/escalation task;
- Trip completed → post-trip task 1–3 days.

Never automate identity merge, non-trivial refund, penalty acceptance, booking confirmation without evidence, payment confirmation without authority, exceptional discount, or critical incident closure by AI.

## Customer identity and portal

Use the same Supabase Auth project but keep **customer identity separate from staff profile identity**.

- Staff: `auth.users` → `profiles` → `profile_roles`.
- Customer: `auth.users` → `customer_accounts` → canonical `contacts`.
- `portal_invitations` securely provisions access.
- `trip_access_grants` determines buyer/traveler/guardian access per Trip.
- Initial UX can use magic link / OTP email.

Do not create a staff `profiles` row for a customer. Customer RLS must deny cross-contact/trip reads even if IDs/URLs/RPC parameters are manipulated.

Portal resources: own Contact fields, permitted Quotes/Versions, accessible Trips, authorized Travelers, customer-visible Documents, payment obligations/payments without internal cost, and own Customer Requests.

## Quotes and verified acceptance

Preserve the current quote subsystem. Extend with:
- `quote_acceptances` bound to quote/version/customer account/contact/time/terms/source;
- RLS/RPC acceptance verifying current valid version/status/PDF and identity;
- `customer_requests` for quote changes;
- version comparison view model;
- handoff/pre-alert task creation.

`Quote accepted` ≠ `Opportunity Won` ≠ `Trip Ready`.

## Trip aggregate

Introduce `trips` after the commercial gate. A Trip stores operational identity/owners/lifecycle/dates/context and references accepted commercial evidence.

Evolve `bookings` by adding `trip_id`, supplier/service type, provider reference, request/confirm timestamps, deadlines, supplier cost/currency, customer price/currency, and confirmation evidence.

Legacy strategy: create Trip records around existing booking scopes deterministically, assign `bookings.trip_id`, link payments/documents when unambiguous, classify ambiguous rows, validate FKs, then update UI semantics. Do not destroy legacy traceability (`contact_id`, `lead_id`, `accepted_quote_version_id`).

## Travelers and documents

`travelers` belong to Trip; optional Contact link. Minimize sensitive fields. Minors use guardian/responsible linkage and no independent initial account. Critical traveler changes after confirmation become requests.

Extend Documents with `trip_id`, optional `traveler_id`, `visibility` (`staff_only`, `customer_shared`, `customer_owned`), publish metadata, and signed access. Quote PDFs stay read-only evidence.

## Finance model

Keep `payments` as actual verified movements. Add:
- `payment_obligations` — deposit/installment/final/fee/adjustment expected amount/currency/due date/status/source;
- `payment_allocations` — amount of an actual Payment applied to an obligation.

Balance = valid obligations − confirmed allocations. Support partial/excess/short payments. Do not auto-convert obligations across currencies. Payment webhooks become authoritative only when server-verified.

## Suppliers

Add minimum `suppliers` + `supplier_contacts` and Booking relationships for provider reference, cost, currency, deadlines, evidence. Supplier portal/marketplace/live inventory stay deferred.

## Travel support incidents

Current technical `incident_status` fields in notification/sync logs are not customer travel incidents. Add a separate `incidents` domain tied to Trip/Booking/Traveler with category, P1–P4 severity, status, owner/escalation, supplier reference, SLA, resolution, evidence, and safe customer-visible summary.

## Marketing and attribution

Minimum first program:
- `marketing_campaigns`;
- `marketing_publications`;
- `attribution_touchpoints`;
- asset references / controlled templates, not a full editor.

Keep raw attribution snapshots for traceability but normalize known campaign/publication relationships. Measure to Opportunity/Quote/Accepted/Won value when identifiable.

## Public web and CMS

The current public home/catalog is functional. Evolve toward controlled caching/invalidation after pinning framework versions and verifying the exact Next behavior. Separate public cached reads from private operational reads. Add editorial review/schedule/expiry/SEO incrementally. Do not build a generic page builder.

## Event/log separation

Maintain separate concepts/stores/views for:
- product analytics;
- business activity;
- audit log;
- technical provider/system logs/incidents;
- travel support incidents.

## Roles and capabilities

Add Manager/Gerencia. Preserve existing multirole/RLS while introducing a TypeScript capability registry and targeted capability checks/RPCs. Do not big-bang rewrite every existing RLS policy into generic permissions in the initial phase.

Sensitive capabilities include quote discount approval, handoff acceptance, payment verification, refund approval, sensitive traveler read, identity merge, content publish, incident escalation.

## Security and RLS

RLS is authoritative; UI visibility is not authorization. Every new table ships with explicit RLS and adversarial tests.

Priorities:
- stronger auth/MFA/session revocation for sensitive staff;
- passwordless customer access/invitations;
- least privilege around traveler/finance data;
- private Storage + signed URLs + MIME/size/path controls;
- configurable retention policy;
- pinned dependencies and advisory review;
- CSP only after inventorying required scripts/integrations.

No portal phase is complete without cross-customer RLS tests that deliberately attempt unauthorized access.

## Reliability / external effects

For side effects that must not be lost, introduce `outbox_events` with idempotency key, status, attempts, and next attempt. Transaction saves business state + outbox; worker executes provider with retries/backoff. Provider failure should not erase principal business data. After max attempts: technical incident + human Task when business is blocked.

## Testing and release

Layers:
- domain/unit;
- DB migration/constraint/RPC contract;
- RLS adversarial security;
- integration adapters/webhooks/Storage;
- Playwright end-to-end;
- migration rehearsal from production-like baseline;
- post-deploy smoke.

Deployment approach: expand schema first, app compatibility, backfill/validate, feature flag/cutover where useful, avoid DB rollback requirements for ordinary app rollback.

## Initial 12-week roadmap

1. **Baseline & Safety:** remote/repo migrations, staging, DB types, deterministic dependencies, CI gates.
2. **Domain Foundation:** Manager/capability registry, modular boundaries, Tasks/notifications foundation.
3. **Tasks + Mi día:** migrate active follow-ups to Tasks, SLA queues, role-specific work dashboard.
4. **Portal Identity:** customer accounts/invitations/auth shell/RLS.
5. **Portal Quotes:** quote read/PDF, verified acceptance, customer quote-change request.
6. **Trip Foundation:** Trips, accepted-quote handoff, legacy Booking backfill/linkage, Trip workspace core.
7. **Travelers + Documents:** traveler model, guardians/access grants, document visibility/publication.
8. **Reservations + Suppliers + Support:** booking-as-service extension, minimum suppliers, incidents P1–P4, checklists.
9. **Payment Plan:** obligations/allocations/balances/due tasks.
10. **Operational Portal:** payments, travelers, documents, requests, next action/countdown.
11. **Marketing + Public Efficiency:** campaigns/publications/attribution, CMS caching/publish/expiry basics.
12. **Hardening & Release:** E2E/RLS audit, mobile/a11y, migration rehearsal, observability/runbooks/rollout.

If schedule slips, reduce depth before breaking dependency order or integrity/security gates.

## Agent execution contract

A Week is a planning milestone; an SDD/OpenSpec Change is the implementation unit. Never implement an entire week as one giant task.

Every change should specify:
- Change ID;
- problem/outcome;
- in scope / out of scope;
- existing repository contracts/invariants;
- migration/cutover plan;
- acceptance criteria;
- required tests/security checks;
- rollback/recovery;
- docs to update.

Recommended lifecycle: **Explore → Spec/Design → Implement → Verify → Review → Staging/Rehearsal → Release → Archive/Progress update.**

Before changing a domain, locate the smallest current contracts (code, migration, tests) that implement it. Never assume a target Blueprint entity replaces an existing physical table without the compatibility plan described above.
