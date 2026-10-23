# Follow-up Task Read Contracts Specification

## Purpose

Define Task-derived pending-work values while preserving public CRM signatures and event-derived history.

## Requirements

### Requirement: Single pending-work predicate

Every pending-follow-up value MUST derive only from visible Tasks satisfying `task_kind='follow_up'`, `status IN ('pending','in_progress')`, a non-null `lead_id`, and a present lead with `deleted_at IS NULL` and `archived_at IS NULL`. Event payload dates and terminal Tasks MUST NOT contribute. Task ordering MUST be `due_at ASC,id ASC`; `due_at < referenceTime` is overdue and equality is not overdue.

#### Scenario: Task and event disagree

- GIVEN a visible pending Task due tomorrow, an event payload due yesterday, and completed/canceled Tasks
- WHEN pending work is read at a fixed reference time
- THEN only tomorrow's pending Task contributes and it is not overdue

### Requirement: Contact aggregate compatibility

`crm_contact_aggregate_page` MUST retain the exact argument list, defaults, return column names/order/types, grants, security-invoker behavior, and `p_limit` clamp of 1–100 established by `0049`. `overdue_count` MUST count matching overdue Task work items; `next_follow_up_at` MUST be their minimum due date or null. `p_overdue` and quick view `follow_up` MUST use those Task-derived values. All non-follow-up filters, counts, ordering, and pagination MUST remain unchanged.

#### Scenario: Aggregate count and filter

- GIVEN one contact has two overdue and one future visible Tasks and another has only a terminal Task
- WHEN the overdue filter and follow-up quick view run
- THEN the first contact reports `overdue_count=2` and the earliest due date, while the second is excluded

### Requirement: Contact 360 compatibility aliases

`crm_contact_360_summary` and `crm_contact_opportunity_page` MUST retain the exact `0052` signatures, return column names/order/types, grants, validation, cursor pairing, state behavior, and opportunity-page limit of 1–100. Summary `overdue_follow_up_count` MUST count matching Task work items and `next_follow_up_at` MUST be their minimum due date. Per opportunity, compatibility alias `latest_follow_up_at` MUST equal the earliest matching Task due date, and `follow_up_overdue` MUST mean any matching Task is overdue. `latest_follow_up_created_at` MUST remain the latest historical `follow_up_registered` event creation time.

#### Scenario: Terminal transition clears pending aliases

- GIVEN an opportunity's only active Task supplies compatibility values and historical events exist
- WHEN that Task becomes completed or canceled
- THEN Task-derived dates/counts clear while `latest_follow_up_created_at` and activity history remain intact

### Requirement: Existing authorization and visibility

Reads MUST remain security invoker and inherit Task RLS: an active Admin sees all Tasks, an active owner sees their own, and an active Manager sees non-Admin owners' Tasks. The capability MUST NOT add role-aware Mi día rules or broaden contact, lead, or Task visibility. Counts and dates MUST be computed after RLS filtering.

#### Scenario: Different actors see different work

- GIVEN Tasks owned by an Admin and an Asesor
- WHEN the Admin, that Asesor, and a Manager read the same contact
- THEN each result contains exactly the Task rows permitted by existing Task RLS

### Requirement: History and contract preservation

`last_activity_at`, timelines, event search, and historical follow-up creation timestamps MUST remain event-derived. Completing, canceling, or rescheduling a Task MUST NOT rewrite or delete any event. Manual types and strict adapters MUST preserve compatibility names and reject missing, extra, wrongly typed, or reordered contract fields.

#### Scenario: Reschedule preserves history

- GIVEN a Task is rescheduled after multiple follow-up events
- WHEN pending and activity projections are read
- THEN pending dates use the Task, while event order, payloads, and activity timestamps are unchanged

### Requirement: Additive migration and reversible local proof

This capability SHALL follow future-write, use only additive migrations after `0067`, and perform zero historical DML. Rollback MUST restore the `0049`/`0052` definitions only through a new replacement definition and remove only new indexes. Local disposable verification MUST NOT assert remote parity, production readiness, or Week 03 closure.

#### Scenario: Reverse before remote authorization

- GIVEN the local read contract must be rolled back
- WHEN rollback occurs after application readers are reverted
- THEN prior signatures and behavior return without editing `0049`, `0052`, or `0061`–`0067`
