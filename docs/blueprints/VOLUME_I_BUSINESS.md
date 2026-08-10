# AC Travel Business Blueprint — Volume I
## Agent mirror: definitive operating model

This is the implementation-facing mirror of the approved Business Blueprint. It defines **how AC Travel must operate as a company** before software details. When implementation behavior conflicts with these business rules, stop and resolve the conflict rather than silently inventing policy.

## Vision and North Star

AC Travel operates as one continuous relationship with a customer across multiple travel intentions and trips. The business is not a set of disconnected forms.

**North Star:** maximize trips sold, correctly operated, and satisfactorily completed each month while delivering a reliable, personalized, accompanied experience end-to-end.

Service promise: **Listen → Recommend → Explain → Accompany → Follow up.** Never promise provider-dependent results that AC Travel cannot evidence or control.

## Core business vocabulary

- **Contact:** canonical person in AC Travel's commercial history. Persists across years/trips.
- **Prospect:** contact expressing real travel/service interest.
- **Customer:** contact with at least one confirmed purchase/reservation.
- **Opportunity:** one concrete travel-buying intention. A contact can have several concurrent/historical opportunities.
- **Request:** an inbound/customer request. It may create a new opportunity or attach to an existing one for the same trip.
- **Quote:** AC Travel's commercial proposal tied to an opportunity.
- **Quote version:** immutable snapshot of a proposal. Material commercial changes create a new version.
- **Trip:** complete experience AC Travel must operate after sale/handoff. Groups travelers, reservations, payments, documents, tasks, and incidents.
- **Booking / Reservation:** one provider/service reservation inside a Trip.
- **Traveler:** person traveling; may differ from the buyer and may have no account.
- **Payment plan:** expected obligations.
- **Payment:** actual verified money movement applied to obligations.
- **Task:** work someone must perform.
- **Follow-up:** commercial task to advance/revisit an opportunity.
- **Notification:** an event worth surfacing; not necessarily work.
- **Activity:** historical fact that already happened.
- **Incident:** support case affecting a traveler, service, supplier, or trip.

## Identity and contact policy

Phone/WhatsApp normalized identity is the primary lookup signal; normalized email is secondary. If phone and email point to different contacts, **never auto-merge**. Require human review.

Do not encode prospect/customer/recurrent/VIP/blocked as one overloaded lifecycle. Keep relationship stage separate from attributes and governance/access state.

## Actors and ownership

- **Admin:** platform governance, users, access, integrations, audits, exceptional admin actions.
- **Advisor / Asesor:** discovery, qualification, quote, negotiation, follow-up, commercial relationship.
- **Operations:** turn a sold trip into correctly reserved, documented, coordinated travel.
- **Finance:** payments, balances, reconciliation, refunds, costs/provider payments under permissions.
- **Marketing:** demand, public content, campaigns, attribution.
- **Manager / Gerencia:** business health, approvals, bottlenecks, exceptions.
- **Customer / Traveler:** view authorized information, accept terms, supply allowed data, request changes, follow trip.
- **Supplier:** external source of availability, rates, confirmations, references, vouchers, conditions.

Staff users may have multiple roles. Access, edit, approve, and delete are separate capabilities.

A Contact may have a long-term relationship owner. Every Opportunity has one primary commercial owner. Reassignment must be auditable. After handoff, advisor keeps the commercial relationship while Operations owns execution.

## End-to-end business lifecycle

1. **Discovery & acquisition:** campaign/content/referral/search/direct contact; preserve attribution when identifiable.
2. **CRM & qualification:** identify/reuse Contact, create/reuse Opportunity, assign advisor, collect enough information to quote.
3. **Advisory & quote:** prepare, version, share, negotiate, follow up.
4. **Acceptance & close:** customer accepts; economic condition and handoff checklist determine formal operational transition.
5. **Trip preparation & operations:** Trip, travelers, bookings, payments, documents, checklists, suppliers.
6. **During travel:** support, incidents, supplier coordination, escalation.
7. **Post-trip & recurrence:** close operation, measure satisfaction, review request when appropriate, retain relationship for next Opportunity.

## Commercial and operations transition rules

### Opportunity states
Target business flow: New → Qualifying → Quoting → Proposal sent → Negotiation → Pending close → Won. Alternatives: Lost, Future follow-up, Discarded.

Do not mix quote/payment/booking/trip states into Opportunity state.

### Quote states
Draft → Ready → Sent → Viewed → Changes requested → Accepted. Alternatives: Rejected, Expired, Superseded/Replaced, Cancelled.

Rules:
- A sent version is never silently edited.
- Price/date/service/traveler changes that materially affect commercial terms create a new version.
- Web and PDF are commercially equivalent but may use different presentation.
- Acceptance must be attributable to a verified identity and explicit terms acceptance.
- Advisor cannot apply discretionary discounts; exceptional discounts require Admin/Manager approval and audit.

### Acceptance vs handoff vs won
These are distinct:
- **Quote accepted:** customer accepted a specific version/terms.
- **Operations pre-alert:** acceptance may notify Operations/preparation.
- **Formal Sales → Operations handoff:** requires accepted quote + minimum economic condition + required handoff data/checklist.
- **Opportunity Won:** minimum required payment/advance + at least one principal service confirmed.
- **Trip Ready to travel:** all critical services, required payments, traveler documents/vouchers/checklist complete and no blocking incident.

### Trip / reservation rules
A Trip can contain multiple Bookings and Travelers. A Booking is confirmed only with verifiable supplier evidence. Each reservation must be able to preserve supplier, provider reference, internal cost, customer price, currency, relevant deadlines, status, and evidence.

Operations validates traveler documentation; advisor may help collect it. Minors are travelers tied to a guardian/responsible person and do not receive independent accounts in the initial version.

Changes after confirmation are **requests/cases**, not direct edits. Evaluate supplier policy, penalty, price difference, payment/refund, and reconfirmation.

## Finance rules

Expected obligation and actual payment are separate concepts. Support deposits, installments, final payment, partial payment, over/underpayment, adjustments, refunds, balances, and multi-currency obligations without silently converting currencies.

Manual payments require evidence/Finance verification. Future electronic payments are confirmed only through a trustworthy server-side provider signal. Provider cost, commission, fee, and margin are internal and never customer-visible.

## Communication policy

- WhatsApp Business is the primary commercial channel initially and is **assisted**, not fully integrated.
- Opening WhatsApp does not mean sent; sent does not mean delivered/read.
- Email outbound is integrated and traceable; inbound mailbox sync may come later.
- Website/form is integrated intake.
- Instagram/Facebook/Messenger can remain assisted/external with recorded origin.
- Calls/referrals can be manually registered.
- Portal `Mis viajes` is an integrated authenticated channel.

AC Travel must never claim an external event it cannot prove.

## SLA

Initial operating targets:
- New lead during business hours: first response target ≤ 15 minutes.
- Initial quote: typically 24–48 hours depending on complexity.
- Change request: same day / ≤ 24 hours when possible.
- Payment issue: 1–4 business hours depending on severity.
- P1 travel incident: immediate / target ≤ 15 minutes.
- Normal travel incident: target ≤ 1 hour.

SLA breach creates visibility/escalation; it does not disappear silently.

## Customer portal policy

The same customer account can move from prospect to buyer to traveler and later recurrent customer. The account must not be recreated per trip.

Customer can view authorized requests, quotes, payments, trips, bookings, documents, travelers, and support information. Critical contractual/operational changes create reviewable **Customer Requests** rather than direct destructive mutation.

Contact CRM identity and authenticated customer account are distinct concepts.

## Support and incidents

Travel incidents use objective severities P1–P4. P1, health/safety risk, high financial impact, or high reputational impact escalate to Management. Supplier-dependent incidents remain open until resolution is verified.

## Marketing and content policy

Marketing should be measurable from campaign/content → identified request/opportunity → quote → accepted/won value where attribution exists. Engagement is secondary.

Public catalog includes destinations, services, packages, promotions, editorial/SEO content. Archived content can stop appearing as new/public while historical references remain valid.

## Non-negotiable business rules

- One canonical Contact can have many Opportunities and Trips.
- Never auto-merge conflicting identities.
- Sent quote versions are immutable/superseded, not overwritten.
- Quote acceptance, Opportunity Won, and Trip Ready are different events.
- No payment is `paid` without trustworthy evidence.
- No booking is `confirmed` without supplier evidence.
- Expected payment ≠ actual payment.
- Internal costs/commission/margin are never customer-visible.
- Provider/integration failure never erases the principal business record.
- Customer critical changes become requests for human review.
- Activity, audit, technical logs, and travel incidents are separate concepts.
- AI may suggest/summarize/draft but never autonomously confirm payments, bookings, refunds, merges, discounts, or contractual decisions.
- Critical business records use archive/soft-delete; audit is not deleted casually.

## Privacy and governance

Sensitive data includes passport/ID, birth date, minors, visas, banking proofs, fiscal data, health/special needs. Apply least privilege: Marketing should not see traveler-sensitive data; Finance sees financial need-to-know; Operations sees trip-sensitive need-to-know; customer sees only own/authorized resources.

Staff sensitive roles require stronger auth/MFA/session controls. Customer starts passwordless (magic link/OTP) where feasible. Private files use controlled MIME/size, unpredictable paths, signed URLs, and retention policies. Exact legal retention durations remain a non-blocking policy decision.

## Deliberately outside the initial core

No OTA-scale real-time inventory engine, supplier marketplace/portal, full ERP/accounting, Canva-like editor, automatic provider payouts, generalized automation builder, autonomous AI travel agent, or unnecessary microservices in the initial program.
