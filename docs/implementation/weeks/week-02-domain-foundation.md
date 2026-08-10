# Week 02 — Domain Foundation

## Outcome
Establish the minimum domain/authorization foundation needed by the rest of the program without a big-bang refactor.

## Dependencies
Week 01 baseline gates must be complete.

## Primary work
- add/normalize **Manager/Gerencia** role semantics;
- introduce a TypeScript capability registry for new sensitive actions while preserving existing role/RLS contracts;
- create the first modular domain boundaries only where touched;
- introduce `tasks` and `staff_notifications` foundations with RLS;
- define idempotent task-generation contracts.

## Required context
- Volume I: actors/ownership and non-negotiable rules;
- Volume III: target modules, data architecture, roles/capabilities, Tasks;
- current `lib/supabase/roles.ts`, admin navigation/auth guards, role migrations/RLS;
- current follow-up/event contracts only as needed.

## Suggested Changes
1. `manager-capability-foundation`
2. `task-schema-foundation`
3. `staff-notification-foundation` if it cannot be kept safely with Tasks

## Do not do
No portal, Trips, Finance redesign, generic permissions rewrite, or physical rename of `leads`.

## Completion gate
New role/capability behavior is tested; Tasks can represent pending work with owner/due/status/context/idempotency; all new tables have RLS; existing staff flows remain compatible.
