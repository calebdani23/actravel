# Week 08 — Reservations + Suppliers + Support

## Outcome
Turn Trip into a practical multi-service operations dossier with supplier dependencies and travel-support cases.

## Dependencies
Trip + Travelers/Documents foundations.

## Primary work
- evolve `bookings` into individual service/reservation records under Trip;
- minimum `suppliers` + `supplier_contacts` directory;
- provider references, supplier cost/customer price, deadlines, confirmation evidence;
- travel `incidents` with P1–P4 severity/SLA/escalation;
- basic operational readiness/checklists.

## Required context
Volume I reservation/support rules; Volume II Operations/Suppliers/Requests; Volume III Trip, Suppliers, travel incidents.

## Suggested Changes
1. `reservation-service-extension`
2. `supplier-foundation`
3. `travel-incident-foundation`
4. `trip-readiness-checklist`

## Completion gate
One Trip supports multiple independently managed reservations; `confirmed` requires evidence; P1 incidents escalate; technical notification-log incidents remain a separate concept.
