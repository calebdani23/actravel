begin;

create table public.task_automation_historical_apply_receipts (
  id uuid not null default extensions.gen_random_uuid() primary key,
  request_id uuid not null unique,
  approval_id uuid not null,
  actor_id uuid not null,
  approval_fingerprint text not null,
  plan_hash text not null,
  projection_hash text not null,
  task_ids uuid[] not null,
  origin_keys text[] not null,
  outcome_keys text[] not null,
  tombstone_keys text[] not null,
  generated_count integer not null,
  suppressed_count integer not null,
  projection_count integer not null,
  result jsonb not null,
  result_hash text not null,
  result_byte_count integer not null,
  created_at timestamptz not null default date_trunc('microseconds',clock_timestamp()),
  constraint task_automation_historical_apply_receipts_hash_check check (
    approval_fingerprint~'^[0-9a-f]{64}$' and plan_hash~'^[0-9a-f]{64}$' and projection_hash~'^[0-9a-f]{64}$' and result_hash~'^[0-9a-f]{64}$'),
  constraint task_automation_historical_apply_receipts_arrays_check check (
    (cardinality(task_ids)=0 or array_ndims(task_ids)=1) and (cardinality(origin_keys)=0 or array_ndims(origin_keys)=1)
    and (cardinality(outcome_keys)=0 or array_ndims(outcome_keys)=1) and (cardinality(tombstone_keys)=0 or array_ndims(tombstone_keys)=1)
    and array_position(task_ids,null) is null and array_position(origin_keys,null) is null
    and array_position(outcome_keys,null) is null and array_position(tombstone_keys,null) is null),
  constraint task_automation_historical_apply_receipts_counts_check check (
    generated_count between 0 and 4000 and suppressed_count between 0 and 4000 and projection_count between 0 and 4000
    and generated_count=cardinality(task_ids) and generated_count=cardinality(origin_keys)
    and suppressed_count=cardinality(tombstone_keys) and projection_count=generated_count+suppressed_count
    and projection_count=cardinality(outcome_keys)),
  constraint task_automation_historical_apply_receipts_result_check check (jsonb_typeof(result)='object'),
  constraint task_automation_historical_apply_receipts_bytes_check check (
    result_byte_count between 1 and 16777216
    and result_byte_count=octet_length(convert_to(public.follow_up_canonical_json(result),'UTF8'))),
  constraint task_automation_historical_apply_receipts_created_at_check check (
    isfinite(created_at) and date_trunc('microseconds',created_at)=created_at)
);

create or replace function public.validate_task_automation_historical_apply_receipt(p_value public.task_automation_historical_apply_receipts)
returns boolean language plpgsql immutable strict parallel safe security invoker set search_path='' as $function$
declare
  v_expected jsonb;
begin
  if not (p_value.result ?& array['schema','requestId','approvalId','actorId','planHash','projectionHash','taskIds','originKeys','outcomeKeys','tombstoneKeys','generatedCount','suppressedCount','projectionCount'])
    or p_value.result-array['schema','requestId','approvalId','actorId','planHash','projectionHash','taskIds','originKeys','outcomeKeys','tombstoneKeys','generatedCount','suppressedCount','projectionCount']<>'{}'::jsonb
    or p_value.result->>'schema'<>'task-automation-historical-apply-result.v1'
    or p_value.result->>'generatedCount'<>p_value.generated_count::text
    or p_value.result->>'suppressedCount'<>p_value.suppressed_count::text
    or p_value.result->>'projectionCount'<>p_value.projection_count::text then return false; end if;
  if (select count(*)<>count(distinct value) from unnest(p_value.task_ids) value)
    or (select count(*)<>count(distinct value) or not coalesce(bool_and(value~'^[0-9a-f]{64}$'),true) from unnest(p_value.origin_keys) value)
    or (select count(*)<>count(distinct value) or not coalesce(bool_and(value~'^[0-9a-f]{64}$'),true) from unnest(p_value.outcome_keys) value)
    or (select count(*)<>count(distinct value) or not coalesce(bool_and(value~'^[0-9a-f]{64}$'),true) from unnest(p_value.tombstone_keys) value) then return false; end if;
  v_expected:=jsonb_build_object('schema','task-automation-historical-apply-result.v1','requestId',p_value.request_id::text,
    'approvalId',p_value.approval_id::text,'actorId',p_value.actor_id::text,'planHash',p_value.plan_hash,
    'projectionHash',p_value.projection_hash,'taskIds',to_jsonb(p_value.task_ids),'originKeys',to_jsonb(p_value.origin_keys),
    'outcomeKeys',to_jsonb(p_value.outcome_keys),'tombstoneKeys',to_jsonb(p_value.tombstone_keys),
    'generatedCount',p_value.generated_count,'suppressedCount',p_value.suppressed_count,'projectionCount',p_value.projection_count);
  return p_value.result=v_expected and p_value.result_hash=public.task_automation_historical_hash(v_expected)
    and p_value.result_byte_count=octet_length(convert_to(public.follow_up_canonical_json(v_expected),'UTF8'));
exception when others then return false;
end
$function$;

create or replace function public.reject_task_automation_historical_apply_receipt_mutation() returns trigger
language plpgsql security invoker set search_path='' as $function$
begin
  if tg_op<>'INSERT' then raise exception using errcode='P0001',message='HISTORICAL_APPLY_RECEIPT_IMMUTABLE'; end if;
  if not public.validate_task_automation_historical_apply_receipt(new) then raise exception using errcode='P0001',message='HISTORICAL_APPLY_RECEIPT_INTEGRITY'; end if;
  return new;
end
$function$;

create trigger task_automation_historical_apply_receipts_immutable before insert or update or delete on public.task_automation_historical_apply_receipts
for each row execute function public.reject_task_automation_historical_apply_receipt_mutation();
alter function public.validate_task_automation_historical_apply_receipt(public.task_automation_historical_apply_receipts) owner to postgres;
alter function public.reject_task_automation_historical_apply_receipt_mutation() owner to postgres;
revoke all on function public.validate_task_automation_historical_apply_receipt(public.task_automation_historical_apply_receipts) from public,anon,authenticated,service_role;
revoke all on function public.reject_task_automation_historical_apply_receipt_mutation() from public,anon,authenticated,service_role;

alter table public.task_automation_historical_apply_receipts enable row level security;
alter table public.task_automation_historical_apply_receipts force row level security;
revoke all on table public.task_automation_historical_apply_receipts from public,anon,authenticated,service_role;
grant select on table public.task_automation_historical_apply_receipts to authenticated;
create policy "historical apply receipt active admin select" on public.task_automation_historical_apply_receipts for select to authenticated using (
  auth.role()='authenticated' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
  and exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=auth.uid() and r.name='admin'));

commit;
