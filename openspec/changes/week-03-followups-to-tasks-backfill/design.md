# Design: Follow-up-to-Task Classifier and Canonical Plan

## Technical Approach

Create a dependency-free pure function over immutable, complete facts. Validate boundary and facts, parse dates, apply the inclusive cutoff and latest-valid selection, classify selected and non-selected events, map eligible events to the exact future Task, compare collisions, then sort and canonicalize bounded non-PII rows. It performs no I/O, logging, authorization, or mutation.

## Architecture Decisions

| Decision | Alternative | Rationale |
|---|---|---|
| Canonical plan is exactly `[ruleVersion,cutoffCreatedAt,cutoffId,rows,counts,totalCount,0,0,0,false]`. | Object or padded tuple | Stable byte contract without fabricated padding. |
| Collision checks use exact Task equality plus source, owner-idempotency, and owner-lead keys. | Wholesale row comparison | Generated Task fields are excluded from equality; each collision has explicit meaning. |
| Validate tagged owner facts without coercion. | Normalize malformed tags | Fail closed while preserving legal multi-role active owners. |

## Data Flow

`immutable facts → validate → cutoff/select → classify/map → sort/account → JSON UTF-8/SHA-256`

The cutoff is `createdAt < cutoffCreatedAt OR (createdAt === cutoffCreatedAt AND eventId <= cutoffId)` with lowercase ASCII ID comparison. Selection and output sorting use `(createdAt,eventId)` descending and ascending respectively. Every non-selected row is emitted and included in counts. A duplicate Task ID is `InvalidFact`; multiple distinct Tasks matching one source is `DUPLICATE_SOURCE`. Owner-idempotency and owner-lead branches are mutually exclusive, with deterministic precedence. Counts always use `[eligible,invalid-date/no-task,manual-review/unassigned-owner,excluded/lead-not-operational,excluded/non-selected-history,already-converted,collision/manual-review]`.

## File Changes

| File | Action | Description |
|---|---|---|
| `lib/admin/follow-up-backfill-preview.ts` | Create | Pure contracts, parser, classifier, Task projection/equality, canonical plan/hash. |
| `tests/follow-up-backfill-preview.test.ts` | Create | Required behavior and purity coverage. |

## Interfaces / Contracts

Disposition is exactly: `eligible`, `invalid-date/no-task`, `manual-review/unassigned-owner`, `excluded/lead-not-operational`, `excluded/non-selected-history`, `already-converted`, `collision/manual-review`.

Reasons are closed: manual review `UNASSIGNED_OWNER|PROFILE_MISSING|PROFILE_INACTIVE|ROLE_INVALID`; collision `DUPLICATE_SOURCE|SOURCE_MISMATCH|IDEMPOTENCY_COLLISION|OWNER_LEAD_COLLISION`; other dispositions respectively `ELIGIBLE|INVALID_DATE_NO_TASK|LEAD_NOT_OPERATIONAL|NON_SELECTED_HISTORY|ALREADY_CONVERTED`.

| Disposition | ownerId | dueAt | hasNote | rawFollowUpAt |
|---|---|---|---|---|
| eligible, already-converted, collision | string | string | boolean | string or null |
| invalid-date/no-task, lead-not-operational, non-selected-history | null | null | null | null |
| manual-review | null for unassigned/absent profile; string for inactive/invalid role | null | null | null |

`OwnerFact` is exactly the union `{ tag: "active"; ownerId: string; roles: ("admin"|"manager"|"asesor")[] } | { tag: "unassigned" } | { tag: "missing-profile"; ownerId: string } | { tag: "inactive-profile"; ownerId: string } | { tag: "invalid-role"; ownerId: string }`. Active roles are nonempty, exact, sorted, and unique. These tags map to `ELIGIBLE`, `UNASSIGNED_OWNER`, `PROFILE_MISSING`, `PROFILE_INACTIVE`, and `ROLE_INVALID`; malformed tags are `InvalidFact`.

An eligible future Task is `{status:"pending",task_kind:"follow_up",owner_id,lead_id,quote_id:null,description:"Follow up with lead",due_at,source_due_at,source_event_id,source_event_type:"follow_up_registered",source_event_created_at,source_payload:{followUpAt,hasNote},metadata:{schema:"follow_up_task.v1",source_event_id,source_event_type,owner_id,lead_id},idempotency_key}`. The generic key is `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<lowercaseSourceEventId>")))`; source, owner-idempotency, and owner-lead keys are compared in that order. Equality includes all deterministic fields, excludes `id`, `created_at`, and `updated_at`, and uses recursive canonical JSON (ASCII-sorted object keys, ordered arrays, exact primitives). Existing tasks are already-canonical only when all deterministic fields match.

Dates accept only date-only `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS` plus optional 1–6 fractional digits and `Z|±HH:MM`; Gregorian-valid years are 1970–9999, whitespace, leap seconds, and `24:00` are rejected, offsets are at most 14:00 (14 only `:00`), and `-00:00` is rejected. Pad fractions and normalize to UTC six digits; boundary/event values must already be canonical.

The allow-listed source payload values are exactly `followUpAt: rawFollowUpAt` and `hasNote: boolean`; no other source keys are projected. Metadata values are exactly `schema: "follow_up_task.v1"`, the source event id/type, owner id, and lead id.

Preserve the one complete verified canonical golden preimage (362 bytes, SHA-256 `57826a371b4e8db51258ac6aec3098518a0a8f0255f6d0d2ebcb28ccb93870af`) and the complete Task idempotency vector: the 70-byte UTF-8 preimage `follow-up-task:v1|source_event_id=11111111-1111-4111-8111-111111111111` has lowercase SHA-256 `f44b1020cf8c806af9763f16caa79037358a472a866519467e246c1f59d8e3f5`.

## Testing Strategy

Cover strict parser endpoints/rejections, cutoff ties and sorting, latest-valid fallback, all dispositions/reasons, nullability, collision algorithm and mutual exclusion, selected-event accounting including non-selected rows, error precedence, 2,000/2,001 and 1MiB defenses, canonical repeatability, Task mapping/equality/idempotency, universal invalid-raw null, and purity. Tests construct legal facts and assert count/limit behavior; exact fixtures are owned by tasks, not this design.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable classification, or process-integration boundary.

## Migration / Rollout

No migration required; no remote or operational state changes.

## Open Questions

None.
