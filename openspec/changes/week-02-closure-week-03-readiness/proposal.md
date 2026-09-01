# Proposal: Week 02 Closure / Week 03 Readiness Tracker

## Intent

Track three independently reviewable, dependent children. This tracker performs no schema
or code implementation and grants no readiness by itself.

## Scope

### In Scope
- Track the concise factual Gate 0 baseline through independent `sdd-verify`, native
  bounded review/post-apply approval, and archive.
- Track Tasks after the archived Harness baseline, then Notifications after archived
  verified Tasks.
- Require Tasks and Notifications to define and execute their own candidate-specific
  migration/schema verification in their own designs and tasks.
- Close only after all children are independently verified, natively approved, archived,
  and living docs route to Week 03.

### Out of Scope
- Any implementation, migration allocation/application, database mutation, protocol or
  receipt reuse, or readiness claim.
- Follow-up migration, automation, SLA, Mi dia, UI, or generic RBAC work.

## Relationships

- This tracker supersedes the implementation scope of the combined proposal; its failed
  combined design/specs remain history only.
- Child order is Harness -> Tasks -> Notifications. The tracker is incomplete while any
  child is unverified, unapproved, or unarchived.

## Child Sequence

| Order | Change | Gate |
|---|---|---|
| 1 | `week-02-gate0-shadow-harness` | Factual `baseline-report.md`; independent `sdd-verify`; native review/post-apply; archive |
| 2 | `week-02-tasks-foundation` | Consume archived Harness facts; own fresh Tasks migration/schema verification; review/archive |
| 3 | `week-02-staff-notifications-foundation` | Consume archived Harness and Tasks facts; own fresh Notifications migration/schema verification; review/archive |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `openspec/changes/week-02-*` | Planning only | Tracker and three child packets |
| Tracker/Harness `history/` and Harness `evidence/` | Preserved | Failed planning, protocols, incidents, and runs are provenance only |

## Rollback Plan

Revert only current planning changes through normal review; do not delete history or prior
evidence. No database or application rollback is applicable.

## Success Criteria

- [ ] Harness has a factual PASS, independent verification PASS, native review/post-apply
  approval, and archive; no custom pointer or receipt is used.
- [ ] Tasks and Notifications each pass their own fresh migration/schema verification,
  independent verification, native review/post-apply gate, and archive.
- [ ] Living docs route to Week 03 only after all three archived children pass.
