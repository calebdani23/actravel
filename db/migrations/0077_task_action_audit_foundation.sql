begin;

create table public.task_action_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  request_key text not null unique,
  request_fingerprint text not null,
  task_id uuid not null,
  actor_kind text not null,
  actor_id uuid,
  owner_id uuid not null,
  action text not null,
  from_status text not null,
  target_status text not null,
  cancel_reason text,
  completion_outcome text,
  note text,
  source_kind text,
  source_id uuid,
  source_key text,
  source_order bigint,
  outcome text not null,
  result jsonb not null,
  result_hash text not null,
  result_byte_count integer not null,
  created_at timestamptz not null default date_trunc('microseconds', now()),
  constraint task_action_receipts_hashes_check check (
    request_key ~ '^[0-9a-f]{64}$' and request_fingerprint ~ '^[0-9a-f]{64}$'
    and result_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint task_action_receipts_closed_values_check check (
    actor_kind in ('human','automation') and action in ('start','complete','cancel')
    and from_status in ('pending','in_progress','completed','canceled')
    and target_status in ('in_progress','completed','canceled')
    and outcome in ('applied','already_at_target','not_applicable_terminal')
    and (cancel_reason is null or cancel_reason in ('no_longer_needed','duplicate','source_invalidated','other'))
    and (completion_outcome is null or completion_outcome in ('first_contact_completed','work_completed'))
  ),
  constraint task_action_receipts_note_bounds_check check (
    note is null or (note = btrim(note) and octet_length(convert_to(note,'UTF8')) between 1 and 2000)
  ),
  constraint task_action_receipts_source_bounds_check check (
    source_kind is null or (source_kind ~ '^[a-z][a-z0-9_]{0,63}$' and source_key ~ '^[0-9a-f]{64}$' and source_order between 0 and 2147483647)
  ),
  constraint task_action_receipts_actor_source_check check (
    (actor_kind='human' and request_id is not null and actor_id is not null
      and source_kind is null and source_id is null and source_key is null and source_order is null
      and outcome in ('applied','already_at_target'))
    or
    (actor_kind='automation' and request_id is null and actor_id is null
      and source_kind is not null and source_id is not null and source_key is not null and source_order is not null
      and action='cancel' and target_status='canceled' and cancel_reason='source_invalidated'
      and completion_outcome is null and note is null)
  ),
  constraint task_action_receipts_action_metadata_check check (
    (action='start' and target_status='in_progress' and cancel_reason is null and completion_outcome is null and note is null)
    or (action='complete' and target_status='completed' and cancel_reason is null)
    or (action='cancel' and target_status='canceled' and cancel_reason is not null and completion_outcome is null)
  ),
  constraint task_action_receipts_outcome_check check (
    (outcome='applied' and ((from_status='pending' and target_status in ('in_progress','completed','canceled')) or (from_status='in_progress' and target_status in ('completed','canceled'))))
    or (outcome='already_at_target' and from_status=target_status)
    or (outcome='not_applicable_terminal' and actor_kind='automation' and from_status='completed' and target_status='canceled')
  ),
  constraint task_action_receipts_result_bounds_check check (result_byte_count between 1 and 16384),
  constraint task_action_receipts_created_at_check check (isfinite(created_at) and created_at = date_trunc('microseconds', created_at))
);

create or replace function public.enforce_task_action_receipt_integrity()
returns trigger language plpgsql security invoker set search_path = '' as $function$
declare
  v_created_at text;
  v_preimage text;
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = 'P0001', message = 'TASK_ACTION_RECEIPT_IMMUTABLE';
  end if;
  new.created_at := date_trunc('microseconds', new.created_at);
  v_created_at := to_char(new.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  new.result := jsonb_build_object(
    'schema','task-action-result.v1','receiptId',new.id::text,'requestId',new.request_id::text,
    'taskId',new.task_id::text,'actorKind',new.actor_kind,'actorId',new.actor_id::text,
    'ownerId',new.owner_id::text,'action',new.action,'fromStatus',new.from_status,
    'targetStatus',new.target_status,'cancelReason',new.cancel_reason,
    'completionOutcome',new.completion_outcome,'note',new.note,'sourceKind',new.source_kind,
    'sourceId',new.source_id::text,'sourceKey',new.source_key,'sourceOrder',new.source_order,
    'outcome',new.outcome,'createdAt',v_created_at
  );
  v_preimage := public.follow_up_canonical_json(jsonb_build_array(
    'task-action-result.v1',new.id::text,new.request_id::text,new.task_id::text,new.actor_kind,
    new.actor_id::text,new.owner_id::text,new.action,new.from_status,new.target_status,
    new.cancel_reason,new.completion_outcome,new.note,new.source_kind,new.source_id::text,
    new.source_key,new.source_order,new.outcome,v_created_at
  ));
  new.result_hash := lower(encode(extensions.digest(convert_to(v_preimage,'UTF8'),'sha256'),'hex'));
  new.result_byte_count := octet_length(convert_to(v_preimage,'UTF8'));
  if new.result_byte_count > 16384 then
    raise exception using errcode = 'P0001', message = 'TASK_ACTION_RECEIPT_INTEGRITY_FAILURE';
  end if;
  return new;
end;
$function$;

create trigger task_action_receipts_integrity
before insert or update or delete on public.task_action_receipts
for each row execute function public.enforce_task_action_receipt_integrity();

alter function public.enforce_task_action_receipt_integrity() owner to postgres;
revoke all on function public.enforce_task_action_receipt_integrity() from public, anon, authenticated, service_role;
revoke all on table public.task_action_receipts from public, anon, authenticated, service_role;
alter table public.task_action_receipts enable row level security;
alter table public.task_action_receipts force row level security;
grant select on table public.task_action_receipts to authenticated;
create policy "task action receipts authenticated read scoped" on public.task_action_receipts
for select to authenticated
using (public.task_actor_can_manage(owner_id));

/* Rollback may revoke SELECT and drop this policy; retain every receipt after any row exists. */
commit;
