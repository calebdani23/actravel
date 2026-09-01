# Proposal: Follow-up Task Representation

## Intent

Add an additive, representation-only model for follow-up Tasks. It preserves immutable
source identity after CRM purge without foreign-key retention and captures bounded provenance
for the successor backfill, without classifying or mutating historical data.

## Scope

### In Scope
- Add nullable follow-up representation fields and bounded provenance to Tasks; no classification
  or backfill logic runs in this change.
- Enforce source uniqueness and provenance immutability while preserving Task, deletion, RLS,
  lifecycle, quote, and CRM invariants.
- Update types and adapter reads; add contract/security tests.
- Add the local migration after `0063`, subject to read-only reconciliation and shadow prerequisites
  from remote `0060_quote_pdf_creation_cutover`.

### Out of Scope
- Historical Task insertion or update of any kind; CRM event-derived reads remain unchanged.
- Successor `week-03-followups-to-tasks-backfill`: all classification, latest-valid selection,
  backfill, preview/approve/apply, hashes, RPCs, ledgers, legacy-event Task creation,
  cancellation/rollback, conversion, and parity validation.
- Automation, SLA, Staff Notifications, Mi día/UI, CRM cutover, action rewrite, future follow-ups,
  future Task creation, and remote application.

## Capabilities

### New Capabilities
- `follow-up-task-representation`: Additive follow-up representation fields and bounded provenance
  identity only; classification is deferred to the successor backfill change.

### Modified Capabilities
- `tasks-foundation`: Support additive follow-up metadata and immutable source identity without
  changing manual Task creation, ownership, lifecycle, deletion, quote, or RLS requirements.

## Approach

Use an additive schema/type/adapter change with nullable representation fields for existing rows,
bounded provenance, and immutable logical source identity without an FK. Preserve context
`ON DELETE SET NULL` behavior and current read paths. Validate local order
`0061 → 0062 → 0063 → new`; the linked remote project ended at `0060` on 2026-09-01, and no
remote mutation occurred.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `db/migrations/0061`–`0063` | Prerequisite | Order only; do not alter. |
| New follow-up migration | New | Representation constraints, uniqueness, and immutability. |
| `lib/admin/tasks.ts`, generated types | Modified | Additive reads. |
| Task/CRM/security tests | Modified | Representation, ACL/RLS, deletion, and regression coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dependency/remote drift | High | Reconcile read-only; require `0060` shadow prerequisites; fail closed. |
| Weakened Task invariants | Med | Additive fields plus constraints, immutability, RLS, and manual-row tests. |

## Rollback Plan

Before rollout, revert the new migration and generated/adapter changes through normal rollback.
No historical Tasks, events, notes, parents, or remote state are mutated.

## Dependencies

- Read-only reconciliation and authorized shadow from remote `0060`.
- Local verification of `0061 → 0062 → 0063 → new`.

## Success Criteria

- [ ] Follow-up fields, provenance, source uniqueness, and immutability are enforced.
- [ ] Manual Tasks and context deletion, lifecycle, quote, CRM, RLS, and security contracts remain unchanged.
- [ ] Types/adapters and contract tests pass; no historical Task data is inserted or updated.
- [ ] Dependency/shadow evidence is read-only; remote application remains gated.
