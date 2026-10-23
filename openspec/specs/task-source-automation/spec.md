# Task Source Automation Specification

## Purpose

Define future-only first-contact and exact quote-version Task generation and cancellation.

## Requirements

### Requirement: First-contact occurrence and ownership

An Opportunity MUST have at most one `first_contact` Task. Its immutable anchor MUST be the later of Opportunity creation and first valid assignment to an active `admin|manager|asesor`. A valid reassignment MUST transfer the active Task and preserve due time and origin. Unassignment, archive, or terminal Opportunity status MUST cancel only that origin-linked active Task through audited automation.

#### Scenario: Assignment, transfer, and invalidation
- GIVEN an unassigned Opportunity receives a valid owner, is reassigned, then archived
- WHEN those changes commit in order
- THEN one Task is created, transferred with identity/due unchanged, then audited as canceled

### Requirement: Mexico City business calendar

Due time MUST use versioned IANA `America/Mexico_City`, Monday–Friday 09:00 inclusive–18:00 exclusive, and closed Mexican federal-holiday dates. An open-interval anchor MUST receive `+15m`; another anchor MUST receive the next opening at 09:15. IANA and holiday data MUST be pinned for deterministic UTC-microsecond replay.

#### Scenario: Inside business hours
- GIVEN a non-holiday weekday anchor at 10:00 Mexico City time
- WHEN due time is projected
- THEN it is exactly 10:15 local normalized to UTC microseconds

#### Scenario: Closed-day rollover
- GIVEN an anchor at Friday 18:00 before a Monday federal holiday
- WHEN due time is projected
- THEN it is Tuesday 09:15 Mexico City time under the stored rule version

### Requirement: First-contact completion proof

Only an authorized audited completion with `completionOutcome=first_contact_completed` MUST complete this Task. Notes, internal follow-ups, quote activity, and generic outcomes MUST NOT prove contact or terminate it.

#### Scenario: Note is not contact
- GIVEN an active first-contact Task
- WHEN a note or `follow_up_registered` event is committed
- THEN the Task remains active and no completion receipt exists

### Requirement: Quote-version generation

Each version's first committed transition to `sent` MUST create at most one pending `quote_follow_up` linked to that version and occurrence, due exactly 48 elapsed hours after persisted `sent_at`. Replay, repeated sent writes, and concurrency MUST produce zero duplicates and never adopt another Task.

#### Scenario: First sent transition
- GIVEN a quote version has never been sent
- WHEN its first sent transition commits
- THEN one version-linked Task is due at `sent_at + 48h`

### Requirement: Exact quote cancellation sources

Only these sources MUST cancel that version's active Task with `cancelReason=source_invalidated`: a durable exact-version response, including acceptance; `whatsapp_inbound_received` when exactly one active sent version exists for the Opportunity; a `verified` payment with that `accepted_quote_version_id`; or transition to `rejected|expired|cancelled|superseded`. `received` payment, broad matching, and unrelated versions MUST NOT cancel it.

#### Scenario: Exact verified payment
- GIVEN two sent versions and a verified payment linked to one accepted version
- WHEN payment commits
- THEN only the linked version's Task is audited as canceled

#### Scenario: Ambiguous WhatsApp response
- GIVEN an Opportunity has multiple active sent versions
- WHEN inbound WhatsApp is recorded without exact version identity
- THEN no Task is canceled and an immutable ambiguous-source outcome is recorded

### Requirement: Unresolved sources, `0080`, and local boundary

Invalid owner or ambiguous context MUST preserve the source action, append immutable `unresolved`, and create no invalid ownership or broad cancellation. `0080` SHALL attach only future first-assignment, first-sent, approved response/payment/status, transfer, and invalidation sources to `0079`. It MUST add no app-side second write, pre-`0077` bootstrap, initial-quote SLA, Mi día, notification, or event rewrite. Historical automation requires a separate approved preview/apply change before Mi día. Destructive reversal and legacy `task_transition` restoration MAY occur only when no persisted state created or governed by `0077`–`0080` exists—not Tasks, origins, outcomes, tombstones, receipts, events, or terminal action state. Once any exists, rollback MUST only forward-disable hooks/new execution; it MUST retain all listed state, preserve compatible audited adapter behavior, and keep legacy `task_transition` revoked. Proof MUST remain local-only and claim no rollout or closure.

#### Scenario: Future-only admission
- GIVEN eligible assigned Opportunities or sent versions predate `0080`
- WHEN `0080` is enabled locally
- THEN no historical Task is created until a separate preview/apply change is approved
