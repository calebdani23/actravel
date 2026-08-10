# Week 04 — Customer Portal Identity

## Outcome
Create secure customer authentication/authorization without turning customers into staff users.

## Dependencies
Verified baseline and stable role/RLS foundation.

## Primary work
- `customer_accounts` linked to canonical Contact;
- `portal_invitations` / passwordless access path;
- `/mis-viajes` protected shell;
- initial customer RLS helpers/policies;
- explicit separation from staff `profiles/profile_roles`;
- adversarial cross-customer tests.

## Required context
Volume I privacy/portal policy; Volume II Customer Portal; Volume III customer identity + Security/RLS. Inspect current Supabase auth/proxy/admin guards and identity migrations only as needed.

## Suggested Changes
1. `customer-identity-foundation`
2. `portal-invitation-flow`
3. `portal-auth-shell`

## Completion gate
Customer A cannot access Customer B data by changing URL/IDs/RPC params; customer authentication never grants staff access; invite/access lifecycle is auditable.
