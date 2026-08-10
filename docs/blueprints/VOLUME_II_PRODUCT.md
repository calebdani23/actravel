# AC Travel Product Blueprint — Volume II
## Agent mirror: product architecture

This volume translates the operating model into one product with **three connected surfaces** over the same business core:

1. **Public Web** — acquisition, inspiration, discovery, conversion.
2. **`Mis viajes` Customer Portal** — authenticated quote/trip/payment/document/request experience.
3. **AC Travel Staff Panel** — sales, operations, finance, marketing, governance.

Global principle: index/list pages are discovery and work queues; daily work happens in the relevant **Contact, Opportunity, Quote, or Trip context**.

## Product principles

- One platform and one business model; different experiences by actor.
- Contact is the long-term relationship center.
- Opportunity is the commercial center until sale.
- Trip becomes the operational center after handoff.
- Do not build isolated CRUD modules when the workflow needs contextual workspaces.
- Show next action, blockers, SLA, and evidence before decorative KPIs.
- Preserve evidence and history; avoid silent mutation.
- Mobile must support real advisor/customer use, not just responsive shrinking.

## Global information architecture

### Public Web
- Home
- Destinations
- Services
- Packages
- Promotions
- Quote / guided request
- Campaign landing pages
- About
- Contact / FAQ
- Legal
- Login / access to `Mis viajes`

### Customer portal — `Mis viajes`
- Home / next action
- My requests / opportunities
- Quotes
- Trip overview
- Reservations/services
- Travelers
- Payments / balance
- Documents
- Requests / changes
- Support / incidents when relevant
- Profile / security
- Past trips / new trip request

### Staff panel
Target navigation by role/capability:
- **Home:** Mi día
- **Sales:** CRM, Quotes, Conversations/communications (assisted now, richer later)
- **Operations:** Trips, Reservations, Travelers, Documents, Incidents
- **Finance:** Payment plan, Payments, Reconciliation/Refunds within scope
- **Marketing:** Catalog, Campaigns, Publications, Templates
- **Management/Admin:** Analytics, Team, Data quality, Audit, Integrations, Settings

Navigation must be capability-filtered, not just cosmetically hidden.

## Public website

Purpose: convert traffic into qualified commercial intent while representing AC Travel as modern, trustworthy, clear, aspirational, and personalized.

Key product rules:
- WhatsApp remains primary CTA; quote request is structured secondary CTA.
- Catalog is managed from internal CMS and should preserve attribution context.
- A request from a catalog/campaign item should carry stable references when available, not only free text.
- Home should avoid duplicated hero patterns and focus on one strong value proposition + CTA pair.
- Mobile navigation should be a real menu/drawer rather than horizontal overflow.
- Quote request should evolve toward progressive multi-step UX while preserving draft recovery, validation, anti-spam, attribution, and WhatsApp fast path.
- Future Trip Finder is guided inspiration, not an OTA availability engine.

## Customer portal — `Mis viajes`

The portal follows the customer's lifecycle rather than exposing staff terminology.

### Before purchase
Customer can see:
- active request/trip intention;
- assigned advisor;
- quote versions allowed for viewing;
- quote PDF/web representation;
- request changes;
- explicit acceptance flow.

### After acceptance / payment condition
The experience progressively reveals:
- preparing your trip;
- payment schedule and balance;
- required next actions;
- travelers and required data;
- documents;
- reservations as they are confirmed.

### Confirmed / pre-travel
The primary portal home shows, in order:
1. alert / next action;
2. dates and countdown;
3. overall trip status;
4. services/reservations;
5. payments/balance;
6. documents;
7. travelers;
8. advisor/support.

### During travel
Expose useful itinerary/reservation evidence, authorized documents, support channel, and customer-visible incident/request status without exposing internal supplier/cost notes.

### Post-trip
Show history, useful final documents, satisfaction/review flow when appropriate, and a simple way to start a new request.

### Customer actions
Non-critical profile/traveler data may be editable under policy. Critical changes such as dates, names after confirmation, services, cancellation/refund, or contractual terms create `customer_requests` for staff review.

## Staff home — `Mi día`

`Mi día` is a role-specific work queue, not one generic card dashboard.

Advisor:
- new/unhandled opportunities;
- overdue follow-ups;
- quotes to prepare/send/follow up;
- hot opportunities / SLA breaches.

Operations:
- accepted sales awaiting handoff;
- upcoming Trips;
- bookings pending supplier;
- travelers/documents missing;
- incidents/checklists overdue.

Finance:
- due/overdue obligations;
- payments awaiting verification/allocation;
- balance exceptions/refunds.

Marketing:
- content/publications needing work;
- campaigns and attributed funnel signals.

Manager/Admin:
- pipeline/value/conversion;
- workload/SLA;
- trip readiness/incidents;
- cash collection and data quality/system health.

## Staff CRM

### Contact 360
The primary relationship workspace. It should show:
- canonical identity/governance;
- relationship owner;
- active/historical Opportunities;
- quotes;
- Trips/reservations/payments/documents;
- tasks/next actions;
- communication/activity timeline;
- duplicate/data-quality risk;
- customer portal/access status when relevant.

### Opportunity workspace
One travel intent. It should organize:
- qualification data;
- destination/dates/travelers/budget/services;
- owner and SLA;
- inbound requests;
- quote history/current quote;
- tasks/follow-ups;
- attribution;
- close reason/status;
- accepted quote and handoff status.

## Quotes

Global Quotes page is a searchable queue. Quote detail is the commercial workspace:
- header/identity/status;
- immutable versions;
- structured services/pricing/conditions;
- PDF/web representation;
- send/share actions;
- viewed/acceptance evidence where available;
- change requests;
- version comparison;
- accepted-version handoff summary.

Do not edit a sent version in place.

## Operations

### Trip workspace
Trip is the post-sale operational dossier. It should include:
- overview / readiness / countdown;
- accepted commercial source;
- travelers;
- reservations/services;
- payment status summary;
- documents/vouchers;
- tasks/checklists;
- supplier dependencies;
- incidents;
- customer requests;
- timeline/audit links.

### Reservation detail
Represents one service/provider commitment with provider, references, status/evidence, dates/deadlines, customer-facing data, and restricted internal cost/margin data.

### Documents
Global Documents is an index. Contextual document actions belong inside Contact/Opportunity/Trip/Traveler/Quote. Quote PDFs remain read-only commercial evidence.

## Finance

Finance is operational travel finance, not a full accounting ERP.

Views/workspaces should separate:
- expected obligations (deposit/installment/final/fee/adjustment);
- actual verified payments;
- allocations;
- balances and due dates;
- proofs/reconciliation;
- refunds/adjustments under approval policy;
- internal supplier cost/margin access by permission.

## CMS

Catalog domains: destinations, services, packages, promotions. Cross-cutting editorial concerns: language, media, SEO, publish state, schedule/expiry, featured status, campaign relationships.

Target editorial flow: Draft → Review → Approved → Scheduled → Published → Archived. Exact implementation can be incremental.

CMS should use controlled content structures, not a generic page builder.

## Marketing Studio

Core areas:
- campaign entity;
- editorial/publication calendar;
- social publication records (network, format, copy, CTA, assets, status, owner, target/published date);
- content/asset library;
- brand templates / structured output;
- attribution reporting from campaign/publication to Opportunity/Quote/Won value when identifiable.

Do not attempt to replace Canva. AC Travel may generate controlled branded compositions and export/download; manual social publishing remains acceptable initially and must be explicitly recorded.

## Suppliers

Start with a practical supplier directory and relationships to reservations/cost/deadlines. Do not build a marketplace or live supplier portal in the initial program.

## Requests and support

`customer_requests` unify reviewable customer actions such as quote changes, date/traveler/service changes, payment questions, document submissions, cancellation/refund requests, and other structured cases.

Travel `incidents` are a separate urgent support concept with severity, owner, supplier dependency, SLA, resolution, and a customer-visible safe summary.

## Analytics and governance

Keep distinct product surfaces for:
- **Product analytics:** anonymous/aggregate behavior and funnel.
- **Business activity:** what happened in the customer/trip lifecycle.
- **Audit:** who changed sensitive data/state.
- **Technical incidents/logs:** provider/system failures.
- **Travel incidents:** customer trip support.

The current generic `Registro` concept should not remain the only interface for all of these.

## Global search and quick create

Staff should eventually have a global search across contact, WhatsApp/email, opportunity, quote folio, trip/reservation references, and relevant documents. Quick Create should be permission-aware and avoid duplicate identity creation.

## UX standards

- Prioritize actionable status and next step.
- Use tables/lists/saved views for scalable operational density; avoid endless KPI cards.
- Every destructive/sensitive action needs confirmation, explanation, authorization, and audit where applicable.
- Empty states must explain what to do next.
- Error states must distinguish validation, authorization, provider failure, and unknown system failure.
- Customer language should say `Mis viajes`, not expose internal `lead/opportunity` jargon unnecessarily.
