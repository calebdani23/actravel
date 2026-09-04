# Delta for Follow-up Backfill Preview

## MODIFIED Requirements

### Requirement: Complete immutable input and precedence

Classification MUST reject absent boundary or required fact/property as `IncompleteFacts`; malformed present boundary as `InvalidBoundary`; malformed, out-of-cutoff, duplicate individual fact, or illegal tagged shape as `InvalidFact`; legal cross-fact or accounting contradiction as `InvariantViolation`; and serialization, hashing, row-count, or byte-limit failure as `CanonicalizationFailure`. `taskOccupancies` is required, may be empty, has at most 2,000 unique lowercase UUID IDs, and every `ExistingTaskFact` MUST have exactly one matching occupancy by id, owner, lead, and idempotency key or classification throws `InvariantViolation`. Existing tasks are complete canonical follow-up rows only; occupancy covers every Task. Owner-idempotency and owner-lead maps come from occupancies, with null leads excluded. Pure classification is allowed; no Task mutation is allowed.
(Previously: complete decoded input did not define separate all-Task occupancy coverage.)

#### Scenario: Manual Task is not discarded
- GIVEN a manual Task occupies an owner/lead key
- WHEN classification compares a follow-up candidate
- THEN occupancy is considered for collision semantics and the manual Task is not treated as an existing source match

#### Scenario: Missing fact fails closed
- GIVEN a required fact or join is absent
- WHEN classification runs
- THEN it returns `IncompleteFacts` with no partial plan

### Requirement: Preserve the pure review boundary

The classifier MUST return only the unchanged descriptive canonical plan and dispositions. Approval,
execution, ledger, cancellation, revalidation, cutover, rollout, operational Task creation,
automation, SLA, notifications, Mi día, and UI are deferred and MUST NOT be performed by this
capability.

#### Scenario: Classification has no operational side effect
- GIVEN legal candidate, occupancy, and existing-source facts
- WHEN pure classification runs
- THEN it returns a descriptive result and performs no Task insert/update/delete/convert
