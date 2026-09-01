# Design: Follow-up Task Representation

This remains a representation-only slice: no historical Task DML, classification, backfill,
automation, SLA, notifications, Mi día/UI, CRM read cutover, or future follow-up creation.

## Technical Approach

Create `db/migrations/0064_follow_up_task_representation.sql` as the new migration. The exact
verification chain is `remote 0060 baseline → local 0061 → 0062 → 0063 →
0064_follow_up_task_representation.sql`; 0064 is the final migration in this change, with no
phantom next migration. Reconcile remote 0060 read-only, then use only a disposable shadow.
0064 adds nullable representation columns, a partial unique source index, an INSERT validation
trigger, and an UPDATE immutability trigger. Existing FKs remain `ON DELETE SET NULL`.

## Architecture Decisions

| Choice | Alternative rejected | Rationale |
|---|---|---|
| No-FK immutable `source_event_id` plus immutable snapshot | FK/live CRM lookup | Identity and provenance survive purge. |
| INSERT-only semantic validation | Persistent parent/snapshot equality checks | Allows authorized lead deletion to null live context. |
| Existing RPC/read seam; `select('*')` | Follow-up RPC or CRM projection rewrite | Prevents creation/cutover drift and preserves callers. |

## Representation Contract

Columns: `task_kind text NOT NULL DEFAULT 'manual'`; `source_event_id uuid NULL`;
`source_event_type text NULL`; `source_event_created_at timestamptz NULL`;
`source_due_at timestamptz NULL`; `source_payload jsonb NULL`; `metadata jsonb NULL`.
Manual rows require all six source fields NULL. A follow-up INSERT requires all six non-NULL,
`source_event_type = 'follow_up_registered'`, `lead_id IS NOT NULL`, `quote_id IS NULL`, and
`source_due_at = due_at`. These are trigger validations, not persistent checks: later authorized
lead deletion may set `lead_id` NULL, and no equality check blocks it. `source_event_id` has a
global partial unique index and is never updateable.

`metadata` is an immutable insertion-time snapshot, not a live mirror. Its exact object keys and
JSON value types are: `schema: string` (`follow_up_task.v1`), `source_event_id: string`,
`source_event_type: string`, `owner_id: string`, and `lead_id: string`. No timestamp is duplicated:
`source_event_created_at` and `source_due_at` are the dedicated snapshot timestamps. Snapshot UUID
strings must equal `lower(uuid::text)` for the corresponding INSERT-time `source_event_id`,
`owner_id`, and `lead_id`; later parent deletion does not rewrite them. All snapshot timestamps are
`timestamptz` instants normalized to UTC at microsecond precision. If a timestamp is serialized at
an external boundary, use exactly `YYYY-MM-DDTHH:MM:SS.ffffffZ`. JSON object validation requires
exactly those five keys, string values, and the schema literal. Inclusive bounds use these exact
SQL expressions: `octet_length(convert_to(metadata::text, 'UTF8')) <= 8192` and
`octet_length(convert_to(source_payload::text, 'UTF8')) <= 65536`.

## Types and Adapter Contract

Generated `Database.public.Tables.tasks` must have these exact public shapes (plus the existing
Relationships block for `lead_id`, `owner_id`, and `quote_id`):

```ts
Row: created_at: string; description: string; due_at: string; id: string;
  idempotency_key: string; lead_id: string | null; owner_id: string; quote_id: string | null;
  status: string; updated_at: string; task_kind: string;
  source_event_id: string | null; source_event_type: string | null;
  source_event_created_at: string | null; source_due_at: string | null;
  source_payload: Json | null; metadata: Json | null
Insert: created_at?: string; description: string; due_at: string; id?: string;
  idempotency_key: string; lead_id?: string | null; owner_id: string; quote_id?: string | null;
  status?: string; updated_at?: string; task_kind?: string;
  source_event_id?: string | null; source_event_type?: string | null;
  source_event_created_at?: string | null; source_due_at?: string | null;
  source_payload?: Json | null; metadata?: Json | null
Update: created_at?: string; description?: string; due_at?: string; id?: string;
  idempotency_key?: string; lead_id?: string | null; owner_id?: string; quote_id?: string | null;
  status?: string; updated_at?: string; task_kind?: string;
  source_event_id?: string | null; source_event_type?: string | null;
  source_event_created_at?: string | null; source_due_at?: string | null;
  source_payload?: Json | null; metadata?: Json | null
```

`FollowUpTaskMetadata` is an exported alias with the five keys above, all `string`; exported
`FollowUpTaskRepresentation = TaskRow & { task_kind: "follow_up"; source_event_id: string;
source_event_type: "follow_up_registered"; source_event_created_at: string; source_due_at: string;
source_payload: Json; metadata: FollowUpTaskMetadata }`. Its `lead_id` and `quote_id` remain the
`TaskRow` types (`string | null`) because deletion may null live context. `TaskRow` remains
`Tables<"tasks">`; `listTasks(): Promise<TaskRow[]>` still returns exact snake_case Row fields
(including the seven additive fields), while `createTask`/`transitionTask` remain
`Promise<TaskRow>`. Thus existing callers are compatible: prior fields and nulls are unchanged,
and new fields are additive; no CRM event-derived read changes.

## File Changes

| File | Action | Description |
|---|---|---|
| `db/migrations/0064_follow_up_task_representation.sql` | Create | Schema, indexes, triggers. |
| `lib/supabase/database.types.ts` | Modify | Exact generated Tasks fields. |
| `lib/admin/tasks.ts` | Modify | Metadata and representation aliases only. |
| `tests/*tasks*` | Modify | Contract, deletion, security, and zero-DML regressions. |

## Testing Strategy

Test disposable-shadow order/dependency, zero Task DML, columns/types/defaults, exact metadata,
UTF-8 bounds, lowercase UUIDs, UTC timestamps, INSERT context rules, uniqueness, immutability,
purge/deletion nulling, RLS/grants, manual RPC/lifecycle compatibility, and adapter/type shape.
Run focused tests, lint, typecheck, and build.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary.

## Migration / Rollout

Local-only rollback before rollout; never contact or mutate remote state. No migration is applied
remotely and no converted rows exist. The successor owns backfill, classification, cutover, and
all excluded behavior.

## Open Questions

None.
