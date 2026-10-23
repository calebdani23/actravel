# Task Automation Foundation Specification

## Purpose

Define deterministic, immutable projection from admitted source occurrences to native automated Tasks.

## Requirements

### Requirement: Closed native origin identity

Each admitted occurrence MUST use one immutable source tuple and 64-lowerhex SHA-256 key under `task-automation:v1`. `first_contact` MUST be unique per Opportunity; `quote_follow_up` per version's first sent occurrence. One origin MAY reference one Task; origin kind, source identity, anchor, rule version, and Task identity MUST remain immutable and purge-independent.

#### Scenario: One occurrence converges
- GIVEN repeated projections of one unchanged source occurrence
- WHEN projection runs serially or concurrently
- THEN exactly one origin and one Task exist with the same deterministic identity

### Requirement: No adoption and zero duplicates

Projectors MUST create a `pending` native Task only for unoccupied origin identity. They MUST NOT adopt or mutate a manual Task, canonical `follow_up`, foreign origin, or malformed occupancy. Event and separately admitted reconciliation paths MUST share identity and serialization rules.

#### Scenario: Occupied namespace fails closed
- GIVEN a manual, historical follow-up, or foreign automated Task occupies a candidate identity
- WHEN generation is attempted
- THEN no Task is adopted or duplicated and an immutable unresolved outcome is recorded

### Requirement: Deterministic due projection

Every origin MUST retain its source timestamp and due-rule version. Calculation MUST normalize to UTC microseconds and be stable for that source/version. Active work MUST order by `due_at ASC,id ASC`; overdue MUST mean `due_at < referenceTime`, equality MUST not, and no mutable overdue flag MAY exist.

#### Scenario: Fixed-time replay
- GIVEN one source timestamp, calendar version, and reference time
- WHEN due and overdue are recomputed repeatedly
- THEN UTC due time, equality behavior, and ordering remain identical

### Requirement: Immutable projection outcomes

A source action MUST NOT fail for unassigned, inactive, unknown, or non-`admin|manager|asesor` ownership, ambiguous version mapping, or occupied identity. Projection MUST append immutable `unresolved` with reason `owner_unassigned|owner_inactive|owner_unknown|owner_role_invalid|source_ambiguous|identity_occupied`, create no invalid Task, and allow later convergence without erasing history.

#### Scenario: Invalid owner is preserved
- GIVEN an admitted source action resolves to no active valid-role owner
- WHEN projection executes
- THEN the source action commits, no invalid Task is created, and one unresolved ownership outcome persists

#### Scenario: Later resolution remains unique
- GIVEN an unresolved occurrence later obtains valid deterministic context
- WHEN an admitted projection reruns
- THEN at most one Task/origin is created and the unresolved history remains immutable

### Requirement: Canonical race order

Automation MUST serialize source identity before Task identity and action receipt; human requests MUST serialize request identity before Task. All paths touching a Task MUST share its action boundary. Generation races MUST converge to one Task; transfer/completion/cancellation races MUST preserve one origin and first terminal commit.

#### Scenario: Generation races cancellation
- GIVEN the same source occurrence concurrently generates and becomes non-actionable
- WHEN both operations serialize
- THEN no duplicate exists and the final Task/receipt state reflects source order without an unaudited mutation

### Requirement: `0079` and rollback boundary

`0079` SHALL widen kinds only to `manual|follow_up|first_contact|quote_follow_up`, preserve exact `0064` checks, and add typed origins, outcomes, calendar versions, and projectors. It MUST add no source hook, historical DML, or bootstrap. Destructive reversal and legacy `task_transition` restoration MAY occur only when no persisted state created or governed by `0077`–`0080` exists—not Tasks, origins, outcomes, tombstones, receipts, events, or terminal action state. Once any exists, rollback MUST only forward-disable hooks/new execution; it MUST retain all listed state, preserve compatible audited adapter behavior, and keep legacy `task_transition` revoked. Proof MUST remain local-only.

#### Scenario: Foundation alone is inert
- GIVEN `0079` is applied without `0080`
- WHEN ordinary source rows change
- THEN no automation runs and migrations `0061`–`0076` remain unchanged
