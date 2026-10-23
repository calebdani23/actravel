begin;

create table public.follow_up_task_apply_receipts (
  id uuid not null default gen_random_uuid() primary key,
  request_id uuid not null unique, approval_id uuid not null, actor_id uuid not null,
  approval_fingerprint text not null, request_fingerprint text not null,
  canonical_plan_hash text not null, projection_hash text not null,
  status text not null check (status = 'applied'), task_ids uuid[] not null,
  task_count integer not null, result jsonb not null, result_hash text not null,
  result_byte_count integer not null, created_at timestamptz not null default now(),
  check (id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  check (request_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  check (approval_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  check (actor_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  check (approval_fingerprint ~ '^[0-9a-f]{64}$' and request_fingerprint ~ '^[0-9a-f]{64}$'
    and canonical_plan_hash ~ '^[0-9a-f]{64}$' and projection_hash ~ '^[0-9a-f]{64}$'
    and result_hash ~ '^[0-9a-f]{64}$'),
  check (task_count between 0 and 2000 and task_count = cardinality(task_ids)
    and result_byte_count between 0 and 1048576)
);

create or replace function public.validate_follow_up_task_apply_result(
  p_result jsonb, p_request_text text, p_approval_text text, p_actor_text text,
  p_task_ids uuid[], p_task_count integer, p_result_hash text, p_result_byte_count integer
) returns boolean language plpgsql immutable strict security invoker set search_path = '' as $function$
declare
  v_ids uuid[]; v_canonical text; v_count integer;
begin
  if pg_catalog.jsonb_typeof(p_result) <> 'object'
     or (select count(*) from pg_catalog.jsonb_object_keys(p_result)) <> 6
     or not (p_result ?& array['schema','requestId','approvalId','actorId','taskIds','taskCount']) then return false; end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(p_result)) <> 6 then return false; end if;
  if p_result->>'schema' <> 'follow-up-task-apply-result.v1'
     or p_result->>'requestId' <> p_request_text or p_result->>'approvalId' <> p_approval_text
     or p_result->>'actorId' <> p_actor_text or pg_catalog.jsonb_typeof(p_result->'taskIds') <> 'array'
     or pg_catalog.jsonb_typeof(p_result->'taskCount') <> 'number' then return false; end if;
  if p_request_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_approval_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_actor_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_result->>'taskCount' !~ '^[0-9]+$' then return false; end if;
  begin
    if p_request_text::uuid::text <> p_request_text or p_approval_text::uuid::text <> p_approval_text
       or p_actor_text::uuid::text <> p_actor_text then return false; end if;
    select coalesce(pg_catalog.array_agg(value::uuid order by ord), '{}'::uuid[]), count(*)
      into v_ids, v_count from pg_catalog.jsonb_array_elements_text(p_result->'taskIds') with ordinality as e(value, ord)
      where value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and value::uuid::text = value;
    if v_count <> pg_catalog.jsonb_array_length(p_result->'taskIds') or exists (select 1 from unnest(v_ids) x group by x having count(*) > 1)
       or p_task_ids is null or exists (select 1 from unnest(p_task_ids) x where x is null)
       or v_ids <> p_task_ids or p_task_count <> (p_result->>'taskCount')::integer
       or p_task_count <> cardinality(p_task_ids) or p_task_count <> v_count then return false; end if;
    v_canonical := public.follow_up_canonical_json(pg_catalog.jsonb_build_array('follow-up-task-apply-result.v1', p_request_text, p_approval_text, p_actor_text, to_jsonb(p_task_ids), p_task_count));
    if p_result_hash !~ '^[0-9a-f]{64}$' or p_result_byte_count <> octet_length(convert_to(v_canonical, 'UTF8'))
       or p_result_byte_count > 1048576 or p_result_hash <> lower(encode(extensions.digest(convert_to(v_canonical, 'UTF8'), 'sha256'), 'hex')) then return false; end if;
    return p_result = pg_catalog.jsonb_build_object('schema','follow-up-task-apply-result.v1','requestId',p_request_text,'approvalId',p_approval_text,'actorId',p_actor_text,'taskIds',to_jsonb(p_task_ids),'taskCount',p_task_count);
  exception when others then return false;
  end;
end;
$function$;

create or replace function public.reject_follow_up_task_apply_receipt_mutation()
returns trigger language plpgsql immutable security invoker set search_path = '' as $function$
begin
  if tg_op <> 'INSERT' then raise exception using errcode = 'P0001', message = 'FOLLOW_UP_TASK_APPLY_RECEIPT_IMMUTABLE'; end if;
  if not public.validate_follow_up_task_apply_result(new.result, new.request_id::text, new.approval_id::text, new.actor_id::text, new.task_ids, new.task_count, new.result_hash, new.result_byte_count) then
    raise exception using errcode = 'P0001', message = 'FOLLOW_UP_TASK_APPLY_RECEIPT_INTEGRITY_FAILURE';
  end if;
  return new;
end;
$function$;
create trigger follow_up_task_apply_receipts_immutable before insert or update or delete on public.follow_up_task_apply_receipts
for each row execute function public.reject_follow_up_task_apply_receipt_mutation();

alter function public.validate_follow_up_task_apply_result(jsonb,text,text,text,uuid[],integer,text,integer) owner to postgres;
alter function public.reject_follow_up_task_apply_receipt_mutation() owner to postgres;
revoke all on function public.validate_follow_up_task_apply_result(jsonb,text,text,text,uuid[],integer,text,integer) from public, anon, authenticated, service_role;
revoke all on function public.reject_follow_up_task_apply_receipt_mutation() from public, anon, authenticated, service_role;
revoke all on table public.follow_up_task_apply_receipts from public, anon, authenticated, service_role;
grant select on table public.follow_up_task_apply_receipts to authenticated;
alter table public.follow_up_task_apply_receipts enable row level security;
alter table public.follow_up_task_apply_receipts force row level security;
create policy follow_up_task_apply_receipts_admin_select on public.follow_up_task_apply_receipts for select to authenticated
using (exists (select 1 from public.profile_roles pr join public.roles r on r.id = pr.role_id where pr.profile_id = auth.uid() and r.name = 'admin'));

/* Slice rollback, in dependency order; the future RPC revoke is intentionally guarded. */
do $block$ begin
  if to_regprocedure('public.apply_approved_follow_up_task_plan(text,uuid)') is not null then
    execute 'revoke all on function public.apply_approved_follow_up_task_plan(text,uuid) from public,anon,authenticated,service_role';
  end if;
end $block$;
-- exact rollback when the later RPC exists:
-- revoke all on function public.apply_approved_follow_up_task_plan(text,uuid) from public,anon,authenticated,service_role;
-- revoke all on table public.follow_up_task_apply_receipts from public,anon,authenticated,service_role;
-- drop function public.apply_approved_follow_up_task_plan(text,uuid);
-- rollback: drop policy follow_up_task_apply_receipts_admin_select on public.follow_up_task_apply_receipts;
-- rollback: drop trigger follow_up_task_apply_receipts_immutable on public.follow_up_task_apply_receipts;
-- rollback: drop function public.reject_follow_up_task_apply_receipt_mutation();
-- rollback: drop function public.validate_follow_up_task_apply_result(jsonb,text,text,text,uuid[],integer,text,integer);
-- rollback: drop table public.follow_up_task_apply_receipts;
commit;
