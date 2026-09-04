# Delta for Follow-up Task Representation

## MODIFIED Requirements

Representation tests MUST cover exact future Task mapping, source-namespaced idempotency, exact-match conversion, source/owner-idempotency/owner-lead collision algorithm, closed reasons, row nullability, precedence, accounting, canonicalization, limits, and purity. Equality compares every deterministic proposed value using recursive canonical JSON (ASCII-sorted object keys, ordered arrays, exact primitives), excluding generated `id`, `created_at`, and `updated_at`. Existing Task IDs are identity/reporting only.

Invalid raw dates always produce null raw and due fields. Rows use `[eventId,leadId,ownerId,eventCreatedAt,dueAt,hasNote,rawFollowUpAt,disposition,reason]`; non-selected decision fields are all null. The cutoff and sort are exact and inclusive as specified by the preview contract. Enforce 2,000 rows, 512-byte rows, 4,096-byte header/count/constants, and defensive 1MiB serialization limits without measured byte catalogs, padding, or exact-size builders.

Required behavior coverage includes parser boundaries, selection, all dispositions and closed reasons, nullability, duplicate IDs as `InvalidFact`, distinct source matches as `DUPLICATE_SOURCE`, mutually exclusive owner collision branches, selected/non-selected accounting, error precedence, Task equality/idempotency, count/limit behavior, and no live seam. Tests construct legal facts; exact fixtures are owned by tasks.

## NON-GOALS

Reader boundaries, Supabase queries, cutoff acquisition, pagination, convergence, decoding, execution, approval, DML, ledger, cancellation, cutover, automation, SLA, notifications, UI, schema, and CRM remain excluded.
