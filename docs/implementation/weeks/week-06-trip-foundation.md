# Week 06 — Trip Foundation

## Outcome
Introduce Trip as the post-sale operational aggregate while preserving existing Bookings/Payments/accepted-quote traceability.

## Dependencies
Verified quote acceptance and baseline migration safety.

## Primary work
- `trips` schema/RLS;
- formal Sales→Operations handoff contract;
- deterministic legacy Booking→Trip backfill/linkage;
- `bookings.trip_id` compatibility;
- minimum Trip staff workspace/read model.

## Required context
Volume I handoff/won/trip rules; Volume II Trip workspace; Volume III Trip aggregate/migration strategy. Inspect 0053–0060 quote/operation traceability only where necessary.

## Suggested Changes
1. `trip-schema-foundation`
2. `legacy-booking-trip-backfill`
3. `sales-operations-handoff`
4. `trip-admin-workspace`

## Completion gate
A sold/eligible opportunity can produce a Trip without destroying legacy rows; multiple Bookings can belong to one Trip; accepted quote provenance remains enforceable.
