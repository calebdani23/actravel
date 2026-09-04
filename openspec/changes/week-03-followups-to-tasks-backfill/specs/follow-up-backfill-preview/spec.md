# Follow-up Backfill Classifier and Canonical Plan Specification

## Purpose

Define a pure classifier over a validated immutable boundary and complete decoded facts. It performs no I/O, authorization, query, cutoff acquisition, pagination, source decoding, approval, or mutation.

## Requirements

### Requirement: Complete immutable input and precedence

Classification MUST reject any absent boundary or required fact/join/property as `IncompleteFacts`. A malformed present boundary is `InvalidBoundary`; malformed, out-of-cutoff, duplicate individual fact, or illegal tagged shape is `InvalidFact`; legal cross-fact or accounting contradiction is `InvariantViolation`; serialization, hashing, row-count, or byte-limit failure is `CanonicalizationFailure`. This order is exact and no partial plan is returned.

### Requirement: Selection and dispositions

The exact dispositions are `eligible`, `invalid-date/no-task`, `manual-review/unassigned-owner`, `excluded/lead-not-operational`, `excluded/non-selected-history`, `already-converted`, and `collision/manual-review`. Lead lifecycle precedes history; selected invalid date precedes owner and Task decisions. Operational leads select latest valid by `(created_at DESC,event_id DESC)`, or latest event as invalid when none is valid. Every input event is represented once; non-selected rows are included in selected-event accounting.

### Requirement: Parsing and Task mapping

Accept only the specified date-only and explicit-offset grammar, offsets through ±14:00 (with `14` only `:00`, and `-00:00` rejected), and normalized UTC years 1970..9999. Accepted values normalize to six fractional digits and `Z`; every invalid raw value, regardless of cause, outputs null and source text never enters output. Map selected valid events to the exact future Task. Equality uses recursive canonical JSON with ASCII-sorted object keys, ordered arrays, exact primitives, and excludes generated `id`, `created_at`, and `updated_at`.

Collision algorithm: duplicate Task ID is `InvalidFact`; multiple distinct source matches are `DUPLICATE_SOURCE`; exact source mismatch is `SOURCE_MISMATCH`; otherwise owner-idempotency collision is `IDEMPOTENCY_COLLISION`, otherwise owner-lead collision is `OWNER_LEAD_COLLISION`. The owner-idempotency and owner-lead branches MUST be mutually exclusive. An exact representation is `already-converted`; no match is `eligible`.

Date grammar MUST be date-only `YYYY-MM-DD`, or `YYYY-MM-DDTHH:MM:SS` followed by optional 1–6 fractional digits and `Z|±HH:MM`. Gregorian validation MUST apply for years 1970–9999; whitespace, leap seconds, `24:00`, offsets greater than 14:00, nonzero minutes with offset hour 14, and `-00:00` MUST be rejected. Date-only means UTC midnight. Fractions MUST be padded and accepted timestamps normalized to canonical UTC with six digits. Boundary and event timestamps MUST already be canonical.

`OwnerFact` MUST be the discriminated union of `active(ownerId, roles)`, `unassigned`, `missing-profile(ownerId)`, `inactive-profile(ownerId)`, and `invalid-role(ownerId)`. Active roles MUST be a sorted, unique, nonempty list containing only exact `admin`, `manager`, or `asesor`. These tags map to exact reasons `UNASSIGNED_OWNER`, `PROFILE_MISSING`, `PROFILE_INACTIVE`, and `ROLE_INVALID`; malformed tags are `InvalidFact`.

Every eligible projection MUST use status `pending`, task kind `follow_up`, selected owner and lead, `quote_id: null`, description exactly `Follow up with lead`, `due_at` and `source_due_at`, source event id/type/created timestamp, source payload exactly `{followUpAt,hasNote}`, metadata exactly `{schema,source_event_id,source_event_type,owner_id,lead_id}` with schema `follow_up_task.v1`, and `idempotency_key` `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<lowercaseSourceEventId>")))`. Source key is `source_event_id`; owner-lead key is `(owner_id,lead_id)`. Equality includes all deterministic fields, excludes `id`, `created_at`, and `updated_at`, and uses recursive canonical JSON equality.

### Requirement: Closed reasons and row contract

Reasons MUST be exactly manual-review `UNASSIGNED_OWNER|PROFILE_MISSING|PROFILE_INACTIVE|ROLE_INVALID`; collision `DUPLICATE_SOURCE|SOURCE_MISMATCH|IDEMPOTENCY_COLLISION|OWNER_LEAD_COLLISION`; and single reasons `ELIGIBLE`, `INVALID_DATE_NO_TASK`, `LEAD_NOT_OPERATIONAL`, `NON_SELECTED_HISTORY`, `ALREADY_CONVERTED` for their corresponding dispositions.

Rows are exactly `[eventId,leadId,ownerId,eventCreatedAt,dueAt,hasNote,rawFollowUpAt,disposition,reason]`. IDs are lowercase UUID strings; `eventCreatedAt` is string. Nullability:

| Row class | ownerId | dueAt | hasNote | rawFollowUpAt |
|---|---|---|---|---|
| eligible/already-converted/collision | string | string | boolean | string or null |
| invalid-date/lead-not-operational/non-selected | null | null | null | null |
| manual-review unassigned/profile-missing | null | null | null | null |
| manual-review inactive-profile/invalid-role | lowercase UUID | null | null | null |

Non-selected rows always use the all-null decision fields. Rows sort ascending `(eventCreatedAt,eventId)`. Counts MUST be ordered exactly `[eligible, invalid-date/no-task, manual-review/unassigned-owner, excluded/lead-not-operational, excluded/non-selected-history, already-converted, collision/manual-review]`. Canonical bytes are exactly `[ruleVersion,cutoffCreatedAt,cutoffId,rows,counts,totalCount,0,0,0,false]`; enforce rows ≤2,000, row bytes ≤512, header/count/constants ≤4,096, and a defensive ≤1MiB check.

### Requirement: Verified vectors and behavior tests

Retain exactly one complete verified canonical golden preimage:

```text
["follow-up-backfill.v1","2026-01-31T23:59:59.123456Z","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",[["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333","2026-01-15T10:20:30.123456Z","2026-01-20T00:00:00.000000Z",true,"2026-01-20T00:00:00.000000Z","eligible","ELIGIBLE"]],[1,0,0,0,0,0,0],1,0,0,0,false]
```

It is 362 UTF-8 bytes with SHA-256 `57826a371b4e8db51258ac6aec3098518a0a8f0255f6d0d2ebcb28ccb93870af`. The complete Task idempotency vector is the 70-byte UTF-8 preimage `follow-up-task:v1|source_event_id=11111111-1111-4111-8111-111111111111`, whose lowercase SHA-256 is `f44b1020cf8c806af9763f16caa79037358a472a866519467e246c1f59d8e3f5`. Do not claim additional vectors. Executable tests construct legal facts and cover behavior, counts, limits, precedence, repeatability, equality, and zero side effects. Exact fixture construction belongs to the tasks phase.
