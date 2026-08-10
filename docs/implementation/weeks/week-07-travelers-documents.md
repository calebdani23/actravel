# Week 07 — Travelers + Documents

## Outcome
Model the people traveling and expose only the right documents/data to the right staff/customer identities.

## Dependencies
Trip foundation and portal identity.

## Primary work
- `travelers` model under Trip;
- guardian/responsible linkage for minors;
- `trip_access_grants` for buyer/traveler/guardian access;
- extend Documents with Trip/Traveler context and visibility/publication state;
- secure signed document access in staff and portal.

## Required context
Volume I traveler/privacy rules; Volume II portal/Operations/Documents; Volume III Travelers/Documents + Security/RLS.

## Suggested Changes
1. `traveler-foundation`
2. `trip-access-grants`
3. `trip-document-visibility`

## Completion gate
Sensitive traveler data is least-privilege; minors have no independent initial account; customer sees only authorized/published documents; quote PDFs remain immutable evidence.
