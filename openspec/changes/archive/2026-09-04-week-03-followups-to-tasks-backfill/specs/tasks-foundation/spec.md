# Delta for Tasks Foundation

## ADDED Requirements

Tests for the Tasks boundary MUST cover only the expected future Task representation: exact source/lead/owner facts, normalized due date, source-namespaced idempotency, exact conversion, eligible mapping, and every collision reason. The projection MUST use `status: "pending"`, `task_kind: "follow_up"`, selected `owner_id`/`lead_id`, `quote_id: null`, description exactly `"Follow up with lead"`, `due_at`/`source_due_at`, source event id/type/created timestamp, allow-listed `source_payload` exactly `{followUpAt,hasNote}`, exact five-key metadata `{schema,source_event_id,source_event_type,owner_id,lead_id}`, and `idempotency_key`. Its generic key is `lowerhex(sha256(UTF-8("follow-up-task:v1|source_event_id=<lowercaseSourceEventId>")))`; source key is `source_event_id`, owner-idempotency key is `(owner_id,idempotency_key)`, and owner-lead key is `(owner_id,lead_id)`. Equality includes every deterministic value, excludes `id`, `created_at`, and `updated_at`, and uses recursive canonical JSON equality. `ExistingTaskFact.id` is identity/reporting only. The plan is descriptive and immutable; no Task row is changed.

Coverage MUST include duplicate Task IDs as `InvalidFact`, multiple distinct source matches as `DUPLICATE_SOURCE`, source mismatch, mutually exclusive owner-idempotency and owner-lead branches, exact Task equality, the complete 70-byte idempotency vector (SHA-256 beginning `f44b1020`), and canonical plan behavior. Tests construct legal facts and assert required counts and limits rather than maintaining pseudo-fixture catalogs.

The counts vector MUST use exactly this order: `[eligible, invalid-date/no-task, manual-review/unassigned-owner, excluded/lead-not-operational, excluded/non-selected-history, already-converted, collision/manual-review]`. Owner facts MUST use the closed discriminated union and exact role/reason mapping in the preview specification; malformed tags are `InvalidFact`.

## NON-GOALS

Admin/session access, Supabase/query/cutoff acquisition, pagination, convergence, source decoding, execution, approval, DML, ledger, cancellation, cutover, automation, SLA, notifications, UI, schema, and CRM remain excluded.
