# Proposal: Week 02 Staff Notifications Foundation

## Intent

Add the smallest staff-notifications persistence and visibility foundation needed to close
literal Week 02 after the Tasks prerequisite is independently verified and archived.

## Scope

### In Scope
- Depend on archived, independently verified Harness baseline facts and the separately
  verified and archived `week-02-tasks-foundation`.
- Define fresh Notifications-specific migration/schema verification in this child's own
  `design.md` and `tasks.md`; do not reuse Harness or Tasks protocol, tooling, commands, or
  receipts.
- `staff_notifications` schema/RLS with trusted, non-automated service-role creation and
  deterministic deduplication.
- Recipient-only read and mark-read behavior; constrained kinds, plain title/body,
  optional descriptive context, and optional Task relation.
- Close literal Week 02 only after independent verification, native review/post-apply
  approval, and archive.

### Out of Scope
- Task automation, delivery scheduler, SLA, Mi dia/UI, arbitrary JSON, sender authority,
  service Task creation, generic RBAC, or remote application by assumption.

## Relationships

- `dependsOn`: archived independently verified `week-02-gate0-shadow-harness` baseline and
  archived verified `week-02-tasks-foundation`.
- This child supersedes only the Notifications implementation scope of the tracker/combined
  proposal; it does not claim tracker completion until all children finish.

## Approach

After Tasks is archived, write the Notifications-specific design and tasks. They must
define fresh remote/dependency capture, pre-allocation acceptance, isolated application of
the exact candidate, Notifications ledger/catalog/RLS/type assertions, cleanup,
independent verification, and native review/post-apply gates. Parent facts are provenance
for the starting point, not executable authority.

## Rollback Plan

If a dependency or verification fails, stop without migration allocation, remote
application, or mutation. Before publication, remove only notification-owned artifacts;
after publication, use a reviewed fix-forward path.

## Success Criteria

- [ ] Archived Harness and Tasks prerequisites are independently verified and natively
  approved.
- [ ] Notification schema, RLS, service-role creation/deduplication, and recipient-only
  read/mark-read contracts pass against the exact child candidate.
- [ ] This child's fresh migration/schema verification and independent/native gates pass.
- [ ] Child is reviewed and archived, enabling literal Week 02 closure only then.
