# Follow-up Backfill Classifier and Canonical Plan Specification

## Purpose

Define a pure classifier over a validated immutable boundary and complete decoded facts. It performs no I/O, authorization, query, cutoff acquisition, pagination, source decoding, approval, or mutation.

## Requirements

### Requirement: Complete immutable input and precedence

Classification MUST reject absent boundary or required fact/join/property as `IncompleteFacts`; malformed present boundary as `InvalidBoundary`; malformed, out-of-cutoff, duplicate individual fact, or illegal tagged shape as `InvalidFact`; legal cross-fact or accounting contradiction as `InvariantViolation`; and serialization, hashing, row-count, or byte-limit failure as `CanonicalizationFailure`. This order is exact and no partial plan is returned.

### Requirement: Selection and dispositions

The exact dispositions are `eligible`, `invalid-date/no-task`, `manual-review/unassigned-owner`, `excluded/lead-not-operational`, `excluded/non-selected-history`, `already-converted`, and `collision/manual-review`. Lead lifecycle precedes history; selected invalid date precedes owner and Task decisions. Operational leads select latest valid by `(created_at DESC,event_id DESC)`, or latest event as invalid when none is valid. Every input event is represented once; non-selected rows are included in selected-event accounting.

### Requirement: Parsing and Task mapping

Accept only date-only `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS` with optional 1–6 fractional digits and `Z|±HH:MM`; Gregorian-valid years 1970–9999; offsets through ±14:00 with 14 only `:00`; and reject whitespace, leap seconds, `24:00`, and `-00:00`. Normalize accepted values to six fractional digits and `Z`; boundary and event values must already be canonical. Every invalid raw value outputs null and source text never enters output. Map selected valid events to the exact future Task; equality uses recursive canonical JSON with ASCII-sorted object keys, ordered arrays, exact primitives, excluding generated `id`, `created_at`, and `updated_at`.

Collision algorithm: duplicate Task ID is `InvalidFact`; multiple distinct source matches are `DUPLICATE_SOURCE`; exact source mismatch is `SOURCE_MISMATCH`; otherwise owner-idempotency collision is `IDEMPOTENCY_COLLISION`, otherwise owner-lead collision is `OWNER_LEAD_COLLISION`. The owner collision branches are mutually exclusive. An exact representation is `already-converted`; no match is `eligible`.

### Requirement: Closed reasons and row contract

Reasons are exactly `UNASSIGNED_OWNER|PROFILE_MISSING|PROFILE_INACTIVE|ROLE_INVALID`, `DUPLICATE_SOURCE|SOURCE_MISMATCH|IDEMPOTENCY_COLLISION|OWNER_LEAD_COLLISION`, and `ELIGIBLE|INVALID_DATE_NO_TASK|LEAD_NOT_OPERATIONAL|NON_SELECTED_HISTORY|ALREADY_CONVERTED` for their corresponding dispositions. `OwnerFact` is the closed union of active, unassigned, missing-profile, inactive-profile, and invalid-role tags; active roles are nonempty, exact, sorted, and unique; malformed tags are `InvalidFact`.

Rows are exactly `[eventId,leadId,ownerId,eventCreatedAt,dueAt,hasNote,rawFollowUpAt,disposition,reason]`; non-selected rows use all-null decision fields and rows sort ascending `(eventCreatedAt,eventId)`. Counts are ordered `[eligible, invalid-date/no-task, manual-review/unassigned-owner, excluded/lead-not-operational, excluded/non-selected-history, already-converted, collision/manual-review]`. Canonical bytes are exactly `[ruleVersion,cutoffCreatedAt,cutoffId,rows,counts,totalCount,0,0,0,false]`; enforce rows ≤2,000, row bytes ≤512, header/count/constants ≤4,096, and defensive ≤1MiB serialization.

### Requirement: Verified vectors and behavior tests

Retain exactly one complete verified canonical golden preimage:

```text
["follow-up-backfill.v1","2026-01-31T23:59:59.123456Z","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",[["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333","2026-01-15T10:20:30.123456Z","2026-01-20T00:00:00.000000Z",true,"2026-01-20T00:00:00.000000Z","eligible","ELIGIBLE"]],[1,0,0,0,0,0,0],1,0,0,0,false]
```

It is 362 UTF-8 bytes with SHA-256 `57826a371b4e8db51258ac6aec3098518a0a8f0255f6d0d2ebcb28ccb93870af`. The complete Task idempotency vector is the 70-byte UTF-8 preimage `follow-up-task:v1|source_event_id=11111111-1111-4111-8111-111111111111`, whose lowercase SHA-256 is `f44b1020cf8c806af9763f16caa79037358a472a866519467e246c1f59d8e3f5`. Do not claim additional vectors. Executable tests construct legal facts and cover behavior, counts, limits, precedence, repeatability, equality, and zero side effects.
