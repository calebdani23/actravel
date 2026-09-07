begin;

create or replace function public.follow_up_canonical_json(p_value jsonb)
returns text
language sql immutable strict security invoker set search_path = ''
as $function$
  select case pg_catalog.jsonb_typeof(p_value)
    when 'object' then '{' || coalesce((select pg_catalog.string_agg(pg_catalog.to_jsonb(k)::text || ':' || public.follow_up_canonical_json(p_value -> k), ',' order by k)
      from pg_catalog.jsonb_object_keys(p_value) as e(k)), '') || '}'
    when 'array' then '[' || coalesce((select pg_catalog.string_agg(public.follow_up_canonical_json(v), ',' order by ord)
      from pg_catalog.jsonb_array_elements(p_value) with ordinality as e(v,ord)), '') || ']'
    else p_value::text
  end;
$function$;

create table public.follow_up_task_approvals (
  id uuid not null default gen_random_uuid() primary key,
  request_id uuid not null unique,
  actor_id uuid not null,
  actor_role text not null check (actor_role = 'admin'),
  schema_version text not null check (schema_version = 'follow-up-approval.v1'),
  rule_version text not null check (rule_version = 'follow-up-backfill.v1'),
  event_cutoff_created_at timestamptz not null,
  event_cutoff_id uuid not null,
  task_cutoff_created_at timestamptz,
  task_cutoff_id uuid,
  reader_snapshot_hash text not null,
  canonical_plan_hash text not null,
  request_fingerprint text not null,
  projection_hash text not null,
  canonical_plan text not null,
  eligible_projections jsonb not null,
  eligible_count integer not null,
  invalid_date_no_task_count integer not null,
  manual_review_unassigned_owner_count integer not null,
  excluded_lead_not_operational_count integer not null,
  excluded_non_selected_history_count integer not null,
  already_converted_count integer not null,
  collision_manual_review_count integer not null,
  total_count integer not null,
  row_count integer not null,
  projection_count integer not null,
  canonical_plan_byte_count integer not null,
  projection_byte_count integer not null,
  request_byte_count integer not null,
  created_at timestamptz not null default now(),
  constraint follow_up_task_approvals_cutoff_pair_check check ((task_cutoff_created_at is null) = (task_cutoff_id is null)),
  constraint follow_up_task_approvals_hash_check check (
    reader_snapshot_hash ~ '^[0-9a-f]{64}$' and canonical_plan_hash ~ '^[0-9a-f]{64}$'
    and request_fingerprint ~ '^[0-9a-f]{64}$' and projection_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint follow_up_task_approvals_counts_check check (
    eligible_count between 0 and 2000 and invalid_date_no_task_count between 0 and 2000
    and manual_review_unassigned_owner_count between 0 and 2000
    and excluded_lead_not_operational_count between 0 and 2000
    and excluded_non_selected_history_count between 0 and 2000
    and already_converted_count between 0 and 2000 and collision_manual_review_count between 0 and 2000
    and total_count = row_count
    and total_count = eligible_count + invalid_date_no_task_count + manual_review_unassigned_owner_count
      + excluded_lead_not_operational_count + excluded_non_selected_history_count
      + already_converted_count + collision_manual_review_count
    and row_count between 0 and 2000 and row_count <= 2000 and projection_count = eligible_count
    and projection_count between 0 and 2000
    and canonical_plan_byte_count >= 0 and projection_byte_count >= 0 and request_byte_count >= 0
  ),
  constraint follow_up_task_approvals_size_check check (
    canonical_plan_byte_count <= 1048576 and projection_byte_count <= 4194304 and request_byte_count <= 5242880
    and canonical_plan_byte_count = octet_length(convert_to(canonical_plan, 'UTF8'))
    and projection_byte_count = octet_length(convert_to(follow_up_canonical_json(eligible_projections), 'UTF8'))
  )
);

create or replace function public.prevent_follow_up_task_approval_update()
returns trigger language plpgsql immutable security invoker set search_path = ''
as $function$
begin
  raise exception using errcode = 'P0001', message = 'FOLLOW_UP_APPROVAL_IMMUTABLE';
end;
$function$;

create or replace function public.prevent_follow_up_task_approval_delete()
returns trigger language plpgsql immutable security invoker set search_path = ''
as $function$
begin
  raise exception using errcode = 'P0001', message = 'FOLLOW_UP_APPROVAL_IMMUTABLE';
end;
$function$;

create trigger prevent_follow_up_task_approval_update
  before update on public.follow_up_task_approvals
  for each row execute function public.prevent_follow_up_task_approval_update();
create trigger prevent_follow_up_task_approval_delete
  before delete on public.follow_up_task_approvals
  for each row execute function public.prevent_follow_up_task_approval_delete();

/* The update trigger deliberately rejects even a no-op UPDATE. */
create or replace function public.prevent_follow_up_task_approval_update()
returns trigger language plpgsql immutable security invoker set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception using errcode = 'P0001', message = 'FOLLOW_UP_APPROVAL_IMMUTABLE';
  end if;
  return new;
end;
$function$;

create or replace function public.approve_follow_up_task_plan(
  p_request_id_text text, p_expected_actor_id uuid, p_schema_version text,
  p_rule_version text, p_event_cutoff_created_at text, p_event_cutoff_id uuid,
  p_task_cutoff_created_at text, p_task_cutoff_id uuid, p_reader_snapshot_hash text,
  p_canonical_plan_hash text, p_projection_hash text, p_request_fingerprint text,
  p_canonical_plan text, p_eligible_projections jsonb
) returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_actor_id uuid;
  v_request_id uuid;
  v_existing public.follow_up_task_approvals;
  v_plan jsonb;
  v_projection text;
  v_expected_projection jsonb;
  v_expected_header jsonb;
  v_request text;
  v_code text;
  v_event_cutoff timestamptz;
  v_task_cutoff timestamptz;
  v_counts jsonb;
  v_row_count integer;
  v_projection_count integer;
  v_total integer;
  v_row_limit boolean := false;
  v_header_limit boolean := false;
  v_count_limit boolean := false;
  v_plan_limit boolean := false;
  v_projection_item_limit boolean := false;
  v_canonical_plan_hash text;
  v_projection_hash text;
  v_request_fingerprint text;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    v_code := 'AUTH_REQUIRED';
  elsif not exists (select 1 from public.profiles where id = auth.uid() and is_active = true) then
    v_code := 'AUTH_INACTIVE';
  elsif not exists (select 1 from public.profile_roles pr join public.roles r on r.id = pr.role_id
                    where pr.profile_id = auth.uid() and r.name = 'admin') then
    v_code := 'AUTH_NOT_ADMIN';
  elsif p_expected_actor_id is null or p_event_cutoff_created_at is null or p_event_cutoff_id is null then
    v_code := 'INVALID_REQUEST';
  elsif auth.uid() <> p_expected_actor_id then
    v_code := 'AUTH_ACTOR_MISMATCH';
  elsif p_request_id_text is null or p_schema_version is null or p_rule_version is null
     or p_reader_snapshot_hash is null or p_canonical_plan_hash is null or p_projection_hash is null
     or p_request_fingerprint is null or p_canonical_plan is null or p_eligible_projections is null
     or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_schema_version <> 'follow-up-approval.v1' or p_rule_version <> 'follow-up-backfill.v1'
     or p_reader_snapshot_hash !~ '^[0-9a-f]{64}$' or p_canonical_plan_hash !~ '^[0-9a-f]{64}$'
     or p_projection_hash !~ '^[0-9a-f]{64}$' or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
     v_code := 'INVALID_REQUEST';
  end if;
  if v_code is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', v_code, 'message', v_code));
  end if;

  begin
    v_request_id := p_request_id_text::uuid;
    if v_request_id::text <> p_request_id_text then v_code := 'INVALID_REQUEST'; end if;
  exception when others then v_code := 'INVALID_REQUEST';
  end;
  if v_code is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', v_code, 'message', v_code));
  end if;

  begin
    v_event_cutoff := p_event_cutoff_created_at::timestamptz;
    if to_char(v_event_cutoff at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> p_event_cutoff_created_at
       or p_event_cutoff_id::text <> lower(p_event_cutoff_id::text)
       or ((p_task_cutoff_created_at is null) <> (p_task_cutoff_id is null)) then v_code := 'INVALID_CUTOFF'; end if;
    if p_task_cutoff_created_at is not null then
      v_task_cutoff := p_task_cutoff_created_at::timestamptz;
      if to_char(v_task_cutoff at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> p_task_cutoff_created_at
         or p_task_cutoff_id::text <> lower(p_task_cutoff_id::text) then v_code := 'INVALID_CUTOFF'; end if;
    end if;
  exception when others then v_code := 'INVALID_CUTOFF';
  end;
  if v_code is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', v_code, 'message', v_code));
  end if;

  begin
    v_plan := p_canonical_plan::jsonb;
     v_counts := v_plan->4;
     v_expected_header := pg_catalog.jsonb_build_array(p_rule_version, p_event_cutoff_created_at, p_event_cutoff_id::text, '[]'::jsonb,
       pg_catalog.jsonb_build_array(v_counts->0, v_counts->1, v_counts->2, v_counts->3, v_counts->4, v_counts->5, v_counts->6), 0, 0, 0, 0, false);
     if public.follow_up_canonical_json(v_plan) <> p_canonical_plan
       or pg_catalog.jsonb_typeof(v_plan) <> 'array' or pg_catalog.jsonb_array_length(v_plan) <> 10
       or pg_catalog.jsonb_build_array(v_plan->0, v_plan->1, v_plan->2, '[]'::jsonb, v_plan->4, v_plan->5, v_plan->6, v_plan->7, v_plan->8, v_plan->9) <> v_expected_header
       or pg_catalog.jsonb_typeof(v_plan->3) <> 'array' or pg_catalog.jsonb_typeof(v_plan->4) <> 'array'
       or pg_catalog.jsonb_array_length(v_plan->4) <> 7 or v_plan->6 <> 0 or v_plan->7 <> 0
       or v_plan->8 <> 0 or v_plan->9 <> false then v_code := 'INVALID_PLAN'; end if;
     if v_plan->1 <> to_jsonb(p_event_cutoff_created_at) or v_plan->2 <> to_jsonb(p_event_cutoff_id::text) then v_code := 'INVALID_CUTOFF'; end if;
     if exists (select 1 from pg_catalog.jsonb_array_elements(v_plan->3) row
       where pg_catalog.jsonb_typeof(row) <> 'array' or pg_catalog.jsonb_array_length(row) <> 9
         or pg_catalog.jsonb_typeof(row->0) <> 'string' or pg_catalog.jsonb_typeof(row->1) <> 'string'
         or row->>0 is null or row->>1 is null or row->>3 is null
         or row->>0 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or row->>1 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or (row->>2 is not null and row->>2 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
         or row->>3 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
         or (row->>4 is not null and row->>4 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$')
         or pg_catalog.jsonb_typeof(row->5) not in ('boolean','null')
         or (row->>6 is not null and row->>6 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$')
          or row->>7 is null or row->>8 is null
         or (row->>7, row->>8) not in (
           ('eligible','ELIGIBLE'),('invalid-date/no-task','INVALID_DATE_NO_TASK'),
           ('manual-review/unassigned-owner','UNASSIGNED_OWNER'),('manual-review/unassigned-owner','PROFILE_MISSING'),
           ('manual-review/unassigned-owner','PROFILE_INACTIVE'),('manual-review/unassigned-owner','ROLE_INVALID'),
           ('excluded/lead-not-operational','LEAD_NOT_OPERATIONAL'),('excluded/non-selected-history','NON_SELECTED_HISTORY'),
           ('already-converted','ALREADY_CONVERTED'),('collision/manual-review','DUPLICATE_SOURCE'),
           ('collision/manual-review','SOURCE_MISMATCH'),('collision/manual-review','IDEMPOTENCY_COLLISION'),
           ('collision/manual-review','OWNER_LEAD_COLLISION'))
         or (row->>7 in ('eligible','already-converted','collision/manual-review') and (row->>2 is null or row->>4 is null or row->5 is null or row->>6 is null))
         or (row->>7 = 'manual-review/unassigned-owner' and row->>8 = 'UNASSIGNED_OWNER' and (row->>2 is not null or row->>4 is not null or row->5 is not null or row->>6 is not null))
         or (row->>7 = 'manual-review/unassigned-owner' and row->>8 in ('PROFILE_MISSING','PROFILE_INACTIVE','ROLE_INVALID') and (row->>2 is null or row->>4 is not null or row->5 is not null or row->>6 is not null))
         or (row->>7 in ('invalid-date/no-task','excluded/lead-not-operational','excluded/non-selected-history') and (row->>2 is not null or row->>4 is not null or row->5 is not null or row->>6 is not null))) then v_code := 'INVALID_PLAN'; end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_plan->3) as plan_row
      where (plan_row->>7, plan_row->>8) not in (
        ('eligible','ELIGIBLE'), ('invalid-date/no-task','INVALID_DATE_NO_TASK'),
        ('manual-review/unassigned-owner','UNASSIGNED_OWNER'), ('manual-review/unassigned-owner','PROFILE_MISSING'),
        ('manual-review/unassigned-owner','PROFILE_INACTIVE'), ('manual-review/unassigned-owner','ROLE_INVALID'),
        ('excluded/lead-not-operational','LEAD_NOT_OPERATIONAL'), ('excluded/non-selected-history','NON_SELECTED_HISTORY'),
        ('already-converted','ALREADY_CONVERTED'), ('collision/manual-review','DUPLICATE_SOURCE'),
        ('collision/manual-review','SOURCE_MISMATCH'), ('collision/manual-review','IDEMPOTENCY_COLLISION'),
        ('collision/manual-review','OWNER_LEAD_COLLISION'))) then v_code := 'INVALID_PLAN'; end if;
  exception when others then v_code := 'INVALID_PLAN';
  end;
  if v_code is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', v_code, 'message', v_code));
  end if;

  begin
    v_row_count := pg_catalog.jsonb_array_length(v_plan->3);
    v_counts := v_plan->4;
    v_total := (v_plan->5 #>> '{}')::integer;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_counts) c
       where pg_catalog.jsonb_typeof(c) <> 'number' or c::text !~ '^[0-9]+$') then v_code := 'INVALID_PLAN'; end if;
     if exists (select 1 from pg_catalog.jsonb_array_elements(v_counts) c where (c::text)::numeric > 2000) or v_total > 2000 then v_count_limit := true; end if;
     if v_count_limit = false and ((v_counts->0)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'eligible')
       or (v_counts->1)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'invalid-date/no-task')
       or (v_counts->2)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'manual-review/unassigned-owner')
       or (v_counts->3)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'excluded/lead-not-operational')
       or (v_counts->4)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'excluded/non-selected-history')
       or (v_counts->5)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'already-converted')
       or (v_counts->6)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(v_plan->3) r where r->>7 = 'collision/manual-review')
       or v_total <> v_row_count or v_total <> (select sum((v_counts->i)::integer) from generate_series(0,6) i)) then v_code := 'INVALID_PLAN'; end if;
  exception when others then v_code := 'INVALID_PLAN';
  end;
  if v_code is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', v_code, 'message', v_code));
  end if;

  begin
     v_projection := public.follow_up_canonical_json(p_eligible_projections);
     select coalesce(jsonb_agg(jsonb_build_object(
      'owner_id', r->2, 'lead_id', r->1, 'quote_id', null, 'description', 'Follow up with lead',
      'due_at', r->4, 'status', 'pending', 'idempotency_key', lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id=' || lower(r->>0), 'UTF8'),'sha256'),'hex')),
      'task_kind', 'follow_up', 'source_event_id', lower(r->>0), 'source_event_type', 'follow_up_registered',
      'source_event_created_at', r->3, 'source_due_at', r->4,
      'source_payload', jsonb_build_object('followUpAt', r->6, 'hasNote', r->5),
      'metadata', jsonb_build_object('schema','follow_up_task.v1','source_event_id',lower(r->>0),'source_event_type','follow_up_registered','owner_id',lower(r->>2),'lead_id',lower(r->>1))) order by ord), '[]'::jsonb)
      into v_expected_projection
      from pg_catalog.jsonb_array_elements(v_plan->3) with ordinality e(r,ord) where r->>7 = 'eligible';
      if pg_catalog.jsonb_typeof(p_eligible_projections) <> 'array'
       or public.follow_up_canonical_json(p_eligible_projections) <> public.follow_up_canonical_json(v_expected_projection)
       or exists (select 1 from pg_catalog.jsonb_array_elements(p_eligible_projections) item
         where pg_catalog.jsonb_typeof(item) <> 'object' or (select count(*) from pg_catalog.jsonb_object_keys(item)) <> 14
          ) then
        v_code := 'INVALID_PROJECTION';
     end if;
     v_projection_count := pg_catalog.jsonb_array_length(p_eligible_projections);
     if v_projection_count <> (v_counts->0)::integer then v_code := 'INVALID_PROJECTION'; end if;
     if exists (select 1 from pg_catalog.jsonb_array_elements(p_eligible_projections) item
       where octet_length(convert_to(public.follow_up_canonical_json(item),'UTF8')) > 2048) then v_projection_item_limit := true; end if;
   exception when others then v_code := 'INVALID_PROJECTION';
  end;
  if v_code is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', v_code, 'message', v_code));
  end if;
  if v_row_count > 2000 or v_total > 2000 or v_projection_count > 2000 then v_row_limit := true; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_plan->3) row
    where octet_length(convert_to(public.follow_up_canonical_json(row), 'UTF8')) > 512) then v_row_limit := true; end if;
  if octet_length(convert_to(public.follow_up_canonical_json(v_expected_header), 'UTF8')) > 4096 then v_header_limit := true; end if;
  if octet_length(convert_to(p_canonical_plan, 'UTF8')) > 1048576 then v_plan_limit := true; end if;
  if v_row_limit or v_header_limit or v_count_limit or v_plan_limit or v_projection_item_limit
      or octet_length(convert_to(p_canonical_plan, 'UTF8')) > 1048576
      or octet_length(convert_to(v_projection, 'UTF8')) > 4194304 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'LIMIT_EXCEEDED', 'message', 'LIMIT_EXCEEDED'));
  end if;

  v_canonical_plan_hash := lower(encode(extensions.digest(convert_to(p_canonical_plan, 'UTF8'), 'sha256'), 'hex'));
  v_projection_hash := lower(encode(extensions.digest(convert_to(v_projection, 'UTF8'), 'sha256'), 'hex'));
  v_request := public.follow_up_canonical_json(pg_catalog.jsonb_build_array('follow-up-approval-request.v1', p_request_id_text,
    p_expected_actor_id::text, p_schema_version, p_rule_version,
    pg_catalog.jsonb_build_array(p_event_cutoff_created_at, p_event_cutoff_id::text),
     case when p_task_cutoff_id is null then null else pg_catalog.jsonb_build_array(p_task_cutoff_created_at, p_task_cutoff_id::text) end,
     p_reader_snapshot_hash, p_canonical_plan_hash, p_projection_hash, v_plan, p_eligible_projections));
  if octet_length(convert_to(v_request, 'UTF8')) > 5242880 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'LIMIT_EXCEEDED', 'message', 'LIMIT_EXCEEDED'));
  end if;
  v_request_fingerprint := lower(encode(extensions.digest(convert_to(v_request, 'UTF8'), 'sha256'), 'hex'));
  if v_canonical_plan_hash <> p_canonical_plan_hash or v_projection_hash <> p_projection_hash
     or v_request_fingerprint <> p_request_fingerprint then
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'HASH_MISMATCH', 'message', 'HASH_MISMATCH'));
  end if;

  v_actor_id := auth.uid();
  perform pg_catalog.pg_advisory_xact_lock((('x' || pg_catalog.substr(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_request_id::text, 'UTF8'), 'sha256'), 'hex'), 1, 16))::bit(64)::bigint));
  select * into v_existing from public.follow_up_task_approvals where request_id = v_request_id for update;
   if v_existing.id is not null then
     if v_existing.actor_id = v_actor_id and v_existing.request_fingerprint = p_request_fingerprint
        and v_existing.schema_version = p_schema_version and v_existing.rule_version = p_rule_version
        and v_existing.event_cutoff_created_at = v_event_cutoff and v_existing.event_cutoff_id = p_event_cutoff_id
        and v_existing.task_cutoff_created_at is not distinct from v_task_cutoff and v_existing.task_cutoff_id is not distinct from p_task_cutoff_id
        and v_existing.reader_snapshot_hash = p_reader_snapshot_hash and v_existing.canonical_plan_hash = p_canonical_plan_hash
        and v_existing.projection_hash = p_projection_hash and v_existing.canonical_plan = p_canonical_plan
        and v_existing.eligible_projections = p_eligible_projections
        and v_existing.eligible_count = (v_counts->0)::integer and v_existing.invalid_date_no_task_count = (v_counts->1)::integer
        and v_existing.manual_review_unassigned_owner_count = (v_counts->2)::integer and v_existing.excluded_lead_not_operational_count = (v_counts->3)::integer
        and v_existing.excluded_non_selected_history_count = (v_counts->4)::integer and v_existing.already_converted_count = (v_counts->5)::integer
        and v_existing.collision_manual_review_count = (v_counts->6)::integer and v_existing.total_count = v_total
        and v_existing.row_count = v_row_count and v_existing.projection_count = v_projection_count
        and v_existing.canonical_plan_byte_count = octet_length(convert_to(p_canonical_plan,'UTF8'))
        and v_existing.projection_byte_count = octet_length(convert_to(v_projection,'UTF8'))
        and v_existing.request_byte_count = octet_length(convert_to(v_request,'UTF8')) then
      return pg_catalog.jsonb_build_object('ok', true, 'status', 'replayed') || to_jsonb(v_existing);
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'APPROVAL_IDEMPOTENCY_CONFLICT', 'message', 'APPROVAL_IDEMPOTENCY_CONFLICT'));
  end if;
  insert into public.follow_up_task_approvals(request_id, actor_id, actor_role, schema_version, rule_version,
    event_cutoff_created_at, event_cutoff_id, task_cutoff_created_at, task_cutoff_id, reader_snapshot_hash,
    canonical_plan_hash, request_fingerprint, projection_hash, canonical_plan, eligible_projections,
    eligible_count, invalid_date_no_task_count, manual_review_unassigned_owner_count,
    excluded_lead_not_operational_count, excluded_non_selected_history_count, already_converted_count,
    collision_manual_review_count, total_count, row_count, projection_count, canonical_plan_byte_count,
    projection_byte_count, request_byte_count)
  values (v_request_id, v_actor_id, 'admin', p_schema_version, p_rule_version, v_event_cutoff, p_event_cutoff_id,
    v_task_cutoff, p_task_cutoff_id, p_reader_snapshot_hash, p_canonical_plan_hash, p_request_fingerprint,
    p_projection_hash, p_canonical_plan, p_eligible_projections, (v_counts->0)::integer, (v_counts->1)::integer,
    (v_counts->2)::integer, (v_counts->3)::integer, (v_counts->4)::integer, (v_counts->5)::integer,
    (v_counts->6)::integer, v_total, v_row_count, v_projection_count, octet_length(convert_to(p_canonical_plan, 'UTF8')),
    octet_length(convert_to(v_projection, 'UTF8')), octet_length(convert_to(v_request, 'UTF8')));
  select * into v_existing from public.follow_up_task_approvals where request_id = v_request_id;
  return pg_catalog.jsonb_build_object('ok', true, 'status', 'approved') || to_jsonb(v_existing);
end;
$function$;

alter function public.follow_up_canonical_json(jsonb) owner to postgres;
alter function public.prevent_follow_up_task_approval_update() owner to postgres;
alter function public.prevent_follow_up_task_approval_delete() owner to postgres;
alter function public.approve_follow_up_task_plan(text, uuid, text, text, text, uuid, text, uuid, text, text, text, text, text, jsonb) owner to postgres;
revoke all on function public.follow_up_canonical_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.prevent_follow_up_task_approval_update() from public, anon, authenticated, service_role;
revoke all on function public.prevent_follow_up_task_approval_delete() from public, anon, authenticated, service_role;
revoke all on function public.approve_follow_up_task_plan(text, uuid, text, text, text, uuid, text, uuid, text, text, text, text, text, jsonb) from public, anon, service_role;
grant execute on function public.approve_follow_up_task_plan(text, uuid, text, text, text, uuid, text, uuid, text, text, text, text, text, jsonb) to authenticated;

alter table public.follow_up_task_approvals enable row level security;
alter table public.follow_up_task_approvals force row level security;
revoke all on table public.follow_up_task_approvals from public, anon, authenticated, service_role;
grant select on table public.follow_up_task_approvals to authenticated;
create policy "follow up approval admin select" on public.follow_up_task_approvals
  for select to authenticated using (exists (select 1 from public.profile_roles pr join public.roles r on r.id = pr.role_id
    where pr.profile_id = auth.uid() and r.name = 'admin'));

commit;
