# Proposal: Week 02 Tasks Foundation

## Intent

Provide the smallest independently reviewable Tasks foundation required for Week 03,
without claiming Week 02 closure or implementing downstream workflow behavior.

## Scope

### In Scope
- Depend on the archived, independently verified `week-02-gate0-shadow-harness` factual
  baseline, including its native verification and review/post-apply approval.
- Define fresh Tasks-specific migration/schema verification in this child's own
  `design.md` and `tasks.md`; do not reuse Harness protocol, tooling, commands, or receipts.
- The smallest `tasks` table/RLS/authenticated-human create/transition foundation.
- Tasks-owned isolated fixtures and assertions for SQL/RLS/contracts/server tests.
- Ownership: owner own; Admin all; Manager active non-Admin; Admin-owned tasks Admin-only.
  Use UTC `due_at`; `lead`/`quotes.id` are descriptive context; no DELETE.
- Keep local `0061` unapplied remotely; allocate no migration until this child's fresh Gate
  0 and migration/schema checks pass.

### Out of Scope
- Notifications, automation, SLA, Mi dia, backfill, UI, service Task creation, new audit
  schema, and remote application by assumption.
- Generic RBAC, follow-up conversion, or changes to existing CRM behavior.

## Relationships

- `dependsOn`: archived `week-02-gate0-shadow-harness` with factual baseline report,
  independent `sdd-verify` PASS, and native review/post-apply approval.
- This child supersedes only the Tasks implementation scope of the tracker/combined
  proposal; it does not complete the tracker.
- `week-02-staff-notifications-foundation` depends on this child's verified and archived
  foundation and owns separate Notifications-specific verification.

## Approach

After the Harness baseline is archived, write the Tasks-specific design and tasks. They
must define fresh remote capture, pre-allocation acceptance, isolated application of the
exact candidate, Tasks ledger/catalog/RLS/type assertions, cleanup, independent
verification, and native review/post-apply gates. The archived Harness establishes only
the starting facts; it supplies no executable authority or reusable receipt.

## Rollback Plan

If Gate 0 or verification fails, make no allocation or mutation. Before publication,
remove only child-owned artifacts; after publication, use a separately reviewed
fix-forward migration.

## Success Criteria

- [ ] Archived independently verified Harness baseline is available and `0061` remains
  unapplied remotely.
- [ ] Tasks ownership, UTC due date, descriptive context, lifecycle, no-DELETE, and RLS
  contracts verify against the exact child candidate.
- [ ] This child's fresh migration/schema verification and independent/native gates pass.
- [ ] Evidence is reviewed and archived as the prerequisite for Notifications and Week 03.
