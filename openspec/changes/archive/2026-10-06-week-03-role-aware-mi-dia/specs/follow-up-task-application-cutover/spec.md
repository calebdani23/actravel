# Delta for Follow-up Task Application Cutover

## MODIFIED Requirements

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
