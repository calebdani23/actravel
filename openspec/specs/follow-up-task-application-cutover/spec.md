# Follow-up Task Application Cutover Specification

## Purpose

Cut Dashboard, lead, and Contact pending work to Tasks while preserving history and DTO names.

## Requirements

### Requirement: Dependency-ordered local admission

Cutover MUST occur only after one selected applied request returns `ready=true`, the future-write boundary is active, and Task-backed compatibility reads are available. A missing prerequisite MUST block cutover rather than enable dual-read or event fallback. Admission is local only.

#### Scenario: Readiness blocker prevents cutover

- GIVEN selected-request readiness contains an unresolved owner or collision disposition
- WHEN local cutover admission is evaluated
- THEN readers remain unchanged and no remote-readiness claim is made

### Requirement: Dashboard Task queue

For active sessions whose recognized role union contains `admin`, `manager`, or `asesor`, the Dashboard pending-work section MUST use the bounded role-aware Mi día Task source instead of the legacy fetch-all follow-up queue. The source MUST include only authorized `follow_up|first_contact|quote_follow_up` Tasks in `pending|in_progress`, MUST order and keyset-page them by `due_at ASC,id ASC`, MUST use a fixed application page size of `20`, and MUST classify them with the fixed Mexico City reference-time contract. The legacy `followUps` list, eight-item truncation, and `counts.overdueFollowUps` queue source MUST NOT drive Mi día. Sessions containing only `operaciones`, `finanzas`, or `marketing` MUST retain the existing Dashboard without invoking Mi día. Non-Task Dashboard content MUST remain unchanged.

(Previously: Dashboard used every visible nonterminal `follow_up` Task, exhausted 1,000-row pages, built legacy follow-up items and `counts.overdueFollowUps`, and rendered the queue in due/ID order.)

#### Scenario: Multiple kinds use bounded deterministic pages

- GIVEN authorized active follow-up, first-contact, and quote-follow-up Tasks include equal due timestamps and a terminal Task is earlier
- WHEN a supported Dashboard loads Mi día
- THEN active admitted Tasks appear in `due_at,id` order through the bounded page contract
- AND the terminal Task and legacy fetch-all queue are absent

#### Scenario: Complete counts replace legacy queue counting

- GIVEN authorized admitted work spans more than one page and all Mi día buckets
- WHEN any unchanged page is read
- THEN Mi día counts describe the complete authorized set at the fixed reference time
- AND legacy eight-item truncation and `counts.overdueFollowUps` do not determine those counts

#### Scenario: Other staff Dashboard remains unchanged

- GIVEN an active Operations-only, Finance-only, or Marketing-only session
- WHEN Dashboard loads
- THEN no Mi día read occurs
- AND the pre-change Dashboard content, ordering, counts, fallbacks, and navigation presentation remain unchanged

### Requirement: Lead projections use earliest visible Task

Lead list, overdue quick view, lead detail, related opportunities, and Contact 360 models MUST use Tasks. `nextFollowUpAt` MUST be the earliest visible active Task by `due_at,id`; `followUpOverdue` MUST mean any is overdue. Limits MUST remain 100 leads, 20 related opportunities, and 1–100 Contact RPC rows. DTO names, nullability, filters, and presentation MUST remain compatible.

#### Scenario: Completion removes pending work

- GIVEN the selected earliest Task is completed and another active Task remains
- WHEN lead and Contact projections refresh
- THEN scalars advance to the remaining Task; when none remains they become null/false

### Requirement: Task RLS is the visibility authority

For supported Admin, Manager, and Asesor actors, Dashboard Mi día MUST consume only active admitted Tasks authorized by the existing `task_actor_can_manage` decision, and only for those supported actors its Task-ID set MUST equal the corresponding Task RLS-visible set for the same actor and predicates. Admin MUST see all admitted active work; an owning Asesor MUST see self work; Manager MUST see active non-Admin-owned team work; and Admin-owned work MUST remain Admin-only. Operations, Finance, Marketing, and unknown-role actors MUST remain outside the Task-ID parity claim and MUST receive no Mi día projection; ownership of an otherwise admitted Task MUST NOT bypass their unsupported-role denial. Lead, related-opportunity, and Contact compatibility readers MUST continue using their existing Task RLS and live-lead predicates. No reader MAY reconstruct hidden work from events, service-role reads, broad profile/CRM grants, or cross-context inference. A Task read failure MUST use its closed error channel, fabricate no pending value, and never fall back to events.

(Previously: Dashboard, lead, and Contact readers shared the visible Task and live-lead authority statement, with Dashboard limited to follow-up Tasks and no separate role-aware page projection.)

#### Scenario: Hidden Mi día Task is not inferred

- GIVEN a supported Admin, Manager, or Asesor actor can read a historical event or related CRM record but `task_actor_can_manage` denies its active Task
- WHEN Mi día loads
- THEN the Task contributes no item, count, label, cursor, or navigation link
- AND no event or broad CRM fallback is used

#### Scenario: Existing CRM compatibility visibility remains intact

- GIVEN identical lead and Contact Task/event fixtures before and after Mi día
- WHEN lead, related-opportunity, and Contact compatibility readers run
- THEN their existing Task RLS, live-lead predicate, limits, DTOs, and event-backed history remain unchanged

### Requirement: Historical activity remains event-backed

Lead and Contact timelines, event search, `lastActivityAt`, and follow-up history labels MUST continue reading immutable `lead_events`. History-only future writes MUST appear in history but MUST create no pending projection. Event dates that disagree with Task due dates MUST never override Task-backed pending values.

#### Scenario: History-only action

- GIVEN a successful follow-up write without a date
- WHEN the affected screens refresh
- THEN its note/event appears in history and all pending Task projections remain unchanged

### Requirement: No deferred product expansion

This cutover extension MAY add only the bounded role-aware Mi día read, presentation, navigation, and reuse of the existing audited Task action boundary specified by `role-aware-mi-dia`. It MUST NOT add new SLA or automation policy, Task kinds, Task lifecycle transitions, receipt timelines, direct Task updates, notifications, reassignment, rescheduling, bulk actions, broad role capability, CRM/profile grants, event fallback, remote rollout, or final closure behavior. Non-Mi día Dashboard and CRM metrics MUST remain unchanged.

(Previously: The cutover prohibited role-aware Mi día and Task action receipts entirely while preserving all non-follow-up Dashboard and CRM metrics.)

#### Scenario: Existing metrics remain stable

- GIVEN identical non-Mi día Dashboard and CRM fixtures before and after the extension
- WHEN Dashboard and CRM readers run
- THEN every out-of-scope count, filter, DTO, fallback, and ordering result is unchanged

#### Scenario: Audited action reuse adds no new lifecycle

- GIVEN a Mi día user starts, completes, or cancels an admitted Task
- WHEN the action is submitted
- THEN it uses the canonical audited action and immutable receipt contract unchanged
- AND no direct update, legacy transition, new result contract, or receipt timeline is introduced
### Requirement: Reverse-order rollback and local boundary

Rollback MUST restore readers before read contracts; it MUST NOT delete persisted rows or edit `0061`–`0067`. Disposable PostgreSQL tests prove local behavior only and MUST NOT imply hosted parity, remote rollout, production readiness, or final Week 03 closure.

#### Scenario: Local verification is not rollout

- GIVEN all local cutover scenarios pass
- WHEN status is reported
- THEN the result states local verification only and remote operations remain separately blocked
