# Week 05 — Portal Quotes

## Outcome
Let an authenticated customer securely view the current commercial proposal, its PDF, explicitly accept it, or request changes.

## Dependencies
Week 04 customer identity/RLS.

## Primary work
- portal quote/version read model;
- secure PDF access;
- `quote_acceptances` + transactional acceptance path;
- quote-change `customer_requests`;
- staff visibility/tasks for acceptance/request events.

## Required context
Volume I quote rules; Volume II Quotes + Customer Portal; Volume III Quotes/verified acceptance. Preserve the existing `quotes`/`quote_versions`/PDF/RPC contracts.

## Suggested Changes
1. `customer-quote-read`
2. `verified-quote-acceptance`
3. `quote-change-request`

## Completion gate
Only an authorized account can accept; acceptance is tied to exact quote/version/contact/terms/time; superseded/invalid versions cannot be accepted; existing staff quote workflows remain compatible.
