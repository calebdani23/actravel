# Week 12 — Hardening & Release

## Outcome
Prove the first AC Travel Business OS vertical slice is secure, recoverable, understandable, and releasable.

## Dependencies
All selected Week 01–11 scope completed or explicitly deferred.

## Primary work
- adversarial RLS review across staff/customer/Trip resources;
- end-to-end Playwright flow from public intake through CRM/quote/portal/Trip/finance/document path;
- migration rehearsal from production-like baseline;
- mobile and accessibility review on critical surfaces;
- external-boundary failure/retry observability;
- backup/rollback/runbook validation;
- release checklist, smoke checks, and post-release monitoring.

## Required context
Volume III Testing/Release/Security; active changes' acceptance criteria; current `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/ENVIRONMENT.md`, operations/runbooks.

## Suggested Changes
Create narrow hardening changes from evidence; do not bundle unrelated bugs into one giant cleanup.

## Completion gate
Critical E2E/RLS suites pass; migration rehearsal is repeatable; rollback/recovery is documented; known risks/deferred work are explicit; `PROGRESS.md` reflects verified reality; the initial Business OS release can be rolled out safely.
