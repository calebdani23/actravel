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

Dashboard follow-up items MUST use the visible nonterminal follow-up Task predicate. Each Task MUST produce one item with `id=task.id`, `leadId=task.lead_id`, `followUpAt=task.due_at`, `overdue=(due_at<referenceTime)`, and existing presentation fields. Items MUST order by `due_at ASC,id ASC`; `counts.overdueFollowUps` MUST count overdue items. Reads MUST exhaust 1,000-row pages without truncating or deduplicating by lead.

#### Scenario: Multiple Tasks and deterministic order

- GIVEN two visible active Tasks for one lead share a due date and one terminal Task is earlier
- WHEN Dashboard loads
- THEN two items appear in Task-ID order, the terminal Task is absent, and overdue count counts work items

### Requirement: Lead projections use earliest visible Task

Lead list, overdue quick view, lead detail, related opportunities, and Contact 360 models MUST use Tasks. `nextFollowUpAt` MUST be the earliest visible active Task by `due_at,id`; `followUpOverdue` MUST mean any is overdue. Limits MUST remain 100 leads, 20 related opportunities, and 1–100 Contact RPC rows. DTO names, nullability, filters, and presentation MUST remain compatible.

#### Scenario: Completion removes pending work

- GIVEN the selected earliest Task is completed and another active Task remains
- WHEN lead and Contact projections refresh
- THEN scalars advance to the remaining Task; when none remains they become null/false

### Requirement: Task RLS is the visibility authority

Readers MUST consume only Tasks visible under existing Task RLS and live-lead visibility. They MUST NOT reconstruct hidden work from events, service-role reads, or cross-opportunity inference. Task read failure MUST use the existing error channel, fabricate no pending value, and never fall back to events.

#### Scenario: Hidden Task is not inferred

- GIVEN an actor can read a historical event but cannot read its Task
- WHEN Dashboard, lead, and Contact screens load
- THEN the Task contributes no pending item, count, date, or overdue flag

### Requirement: Historical activity remains event-backed

Lead and Contact timelines, event search, `lastActivityAt`, and follow-up history labels MUST continue reading immutable `lead_events`. History-only future writes MUST appear in history but MUST create no pending projection. Event dates that disagree with Task due dates MUST never override Task-backed pending values.

#### Scenario: History-only action

- GIVEN a successful follow-up write without a date
- WHEN the affected screens refresh
- THEN its note/event appears in history and all pending Task projections remain unchanged

### Requirement: No deferred product expansion

Cutover MUST NOT add SLA/automation, Task action receipts, notifications, role-aware Mi día, or role policy. Non-follow-up Dashboard and CRM metrics MUST remain unchanged.

#### Scenario: Existing metrics remain stable

- GIVEN identical non-follow-up fixtures before and after cutover
- WHEN Dashboard and CRM readers run
- THEN every non-follow-up count, filter, and ordering result is unchanged

### Requirement: Reverse-order rollback and local boundary

Rollback MUST restore readers before read contracts; it MUST NOT delete persisted rows or edit `0061`–`0067`. Disposable PostgreSQL tests prove local behavior only and MUST NOT imply hosted parity, remote rollout, production readiness, or final Week 03 closure.

#### Scenario: Local verification is not rollout

- GIVEN all local cutover scenarios pass
- WHEN status is reported
- THEN the result states local verification only and remote operations remain separately blocked
