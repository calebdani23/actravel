begin;

/* Add the stored immutable approval fingerprint without rewriting prior migration files. */
alter table public.follow_up_task_approvals
  add column if not exists approval_fingerprint text;

create or replace function public.set_follow_up_task_approval_fingerprint()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  new.approval_fingerprint := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
    'follow-up-task-approval.v1',new.id::text,new.request_id::text,new.actor_id::text,new.actor_role,
    new.schema_version,new.rule_version,to_char(new.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    new.event_cutoff_id::text,to_char(new.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    new.task_cutoff_id::text,new.reader_snapshot_hash,new.canonical_plan_hash,new.request_fingerprint,
    new.projection_hash,new.canonical_plan,new.eligible_projections,new.eligible_count,
    new.invalid_date_no_task_count,new.manual_review_unassigned_owner_count,new.excluded_lead_not_operational_count,
    new.excluded_non_selected_history_count,new.already_converted_count,new.collision_manual_review_count,
    new.total_count,new.row_count,new.projection_count,new.canonical_plan_byte_count,new.projection_byte_count,
    new.request_byte_count)),'UTF8'),'sha256'),'hex'));
  return new;
end;
$function$;
drop trigger if exists set_follow_up_task_approval_fingerprint on public.follow_up_task_approvals;
create trigger set_follow_up_task_approval_fingerprint
before insert or update on public.follow_up_task_approvals
for each row execute function public.set_follow_up_task_approval_fingerprint();
alter table public.follow_up_task_approvals disable trigger prevent_follow_up_task_approval_update;
update public.follow_up_task_approvals set approval_fingerprint = null;
alter table public.follow_up_task_approvals enable trigger prevent_follow_up_task_approval_update;
alter table public.follow_up_task_approvals alter column approval_fingerprint set not null;
alter table public.follow_up_task_approvals add constraint follow_up_task_approvals_approval_fingerprint_check check (approval_fingerprint ~ '^[0-9a-f]{64}$');

create or replace function public.apply_approved_follow_up_task_plan(p_request_id_text text, p_expected_actor_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  actor_id uuid := auth.uid();
  request_uuid uuid;
  approval public.follow_up_task_approvals;
  receipt public.follow_up_task_apply_receipts;
  actor_text text;
  request_text text;
  approval_text text;
  plan jsonb;
  projection jsonb;
  expected_projection jsonb;
  expected_header jsonb;
  plan_counts jsonb;
  expected_approval_fingerprint text;
  expected_request_fingerprint text;
  approval_preimage text;
  projection_canonical text;
  request_canonical text;
  result jsonb;
  result_preimage text;
  result_hash text;
  result_bytes integer;
  task_ids uuid[] := '{}'::uuid[];
  candidate record;
  task_row public.tasks;
  profile_row public.profiles;
  lead_row public.leads;
  preimage text;
  v_code text;
  v_projection_count integer;
  v_row_count integer;
  v_plan_total integer;
  v_row_limit boolean := false;
  v_projection_item_limit boolean := false;
  v_header_limit boolean := false;
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then v_code := 'AUTH_REQUIRED';
  elsif not exists (select 1 from public.profiles where id = actor_id and is_active) then v_code := 'AUTH_INACTIVE';
  elsif not exists (select 1 from public.profile_roles pr join public.roles r on r.id = pr.role_id where pr.profile_id = actor_id and r.name = 'admin') then v_code := 'AUTH_NOT_ADMIN';
  elsif p_expected_actor_id is null or p_expected_actor_id is distinct from actor_id then v_code := 'AUTH_ACTOR_MISMATCH';
  elsif p_request_id_text is null or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_code := 'INVALID_REQUEST';
  end if;
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;
  begin
    request_uuid := p_request_id_text::uuid;
    if request_uuid::text <> p_request_id_text then v_code := 'INVALID_REQUEST'; end if;
  exception when others then v_code := 'INVALID_REQUEST';
  end;
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;
   request_text := request_uuid::text; actor_text := actor_id::text;
   expected_request_fingerprint := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('follow-up-task-apply-request.v1',request_text,actor_text)),'UTF8'),'sha256'),'hex'));

  preimage := 'follow-up-apply:receipt-request:v1|' || request_text;
  perform pg_catalog.pg_advisory_xact_lock((('x' || substr(encode(extensions.digest(convert_to(preimage,'UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint));
   if exists (select 1 from public.follow_up_task_apply_receipts r where r.request_id = request_uuid) then
     select r.* into receipt from public.follow_up_task_apply_receipts r where r.request_id = p_request_id_text::uuid for update;
     if receipt.request_id <> request_uuid or receipt.actor_id <> actor_id
         or receipt.status <> 'applied'
         or receipt.approval_fingerprint !~ '^[0-9a-f]{64}$'
         or receipt.request_fingerprint !~ '^[0-9a-f]{64}$'
         or receipt.request_fingerprint <> expected_request_fingerprint
          or receipt.canonical_plan_hash !~ '^[0-9a-f]{64}$'
          or receipt.projection_hash !~ '^[0-9a-f]{64}$'
          or not public.validate_follow_up_task_apply_result(receipt.result, request_text, receipt.approval_id::text, actor_text, receipt.task_ids, receipt.task_count, receipt.result_hash, receipt.result_byte_count) then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPLY_IDEMPOTENCY_CONFLICT','message','APPLY_IDEMPOTENCY_CONFLICT'));
    end if;
    return to_jsonb(receipt) || jsonb_build_object('ok',true,'status','replayed');
  end if;

  select a.* into approval from public.follow_up_task_approvals a where a.request_id = request_uuid for update;
  if approval.id is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPROVAL_NOT_FOUND','message','APPROVAL_NOT_FOUND')); end if;
  approval_text := approval.id::text;
  begin
    plan := approval.canonical_plan::jsonb; projection := approval.eligible_projections;
    if jsonb_typeof(plan) <> 'array' or jsonb_array_length(plan) <> 10 or jsonb_typeof(plan->3) <> 'array'
       or jsonb_typeof(plan->4) <> 'array' or jsonb_array_length(plan->4) <> 7 or jsonb_typeof(projection) <> 'array' then
      v_code := 'APPROVAL_INTEGRITY_FAILURE';
    else
      plan_counts := plan->4;
      expected_header := jsonb_build_array(approval.rule_version,to_char(approval.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),approval.event_cutoff_id::text,'[]'::jsonb,
        jsonb_build_array(plan_counts->0,plan_counts->1,plan_counts->2,plan_counts->3,plan_counts->4,plan_counts->5,plan_counts->6),0,0,0,0,false);
      if public.follow_up_canonical_json(plan) <> approval.canonical_plan
         or jsonb_build_array(plan->0,plan->1,plan->2,'[]'::jsonb,plan->4,0,0,0,0,false) <> expected_header
          or plan->6 <> '0'::jsonb or plan->7 <> '0'::jsonb or plan->8 <> '0'::jsonb or plan->9 <> 'false'::jsonb
          or exists (select 1 from jsonb_array_elements(plan->3) row where jsonb_typeof(row) <> 'array' or jsonb_array_length(row) <> 9
            or row->>0 is null or row->>1 is null or row->>3 is null
            or row->>7 is null or row->>8 is null
            or row->>0 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (row->>0)::uuid::text <> row->>0
           or row->>1 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (row->>1)::uuid::text <> row->>1
           or (row->>2 is not null and (row->>2 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (row->>2)::uuid::text <> row->>2))
           or row->>3 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((row->>3)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> row->>3
           or (row->>4 is not null and (row->>4 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((row->>4)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> row->>4))
           or jsonb_typeof(row->5) not in ('boolean','null')
           or (row->>6 is not null and (row->>6 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((row->>6)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> row->>6))
           or (row->>7,row->>8) not in (('eligible','ELIGIBLE'),('invalid-date/no-task','INVALID_DATE_NO_TASK'),
             ('manual-review/unassigned-owner','UNASSIGNED_OWNER'),('manual-review/unassigned-owner','PROFILE_MISSING'),('manual-review/unassigned-owner','PROFILE_INACTIVE'),('manual-review/unassigned-owner','ROLE_INVALID'),
             ('excluded/lead-not-operational','LEAD_NOT_OPERATIONAL'),('excluded/non-selected-history','NON_SELECTED_HISTORY'),('already-converted','ALREADY_CONVERTED'),
             ('collision/manual-review','DUPLICATE_SOURCE'),('collision/manual-review','SOURCE_MISMATCH'),('collision/manual-review','IDEMPOTENCY_COLLISION'),('collision/manual-review','OWNER_LEAD_COLLISION'))
           or (row->>7 in ('eligible','already-converted','collision/manual-review') and (row->>2 is null or row->>4 is null or row->>5 is null or row->>6 is null))
           or (row->>7='manual-review/unassigned-owner' and row->>8='UNASSIGNED_OWNER' and (row->>2 is not null or row->>4 is not null or row->>5 is not null or row->>6 is not null))
           or (row->>7='manual-review/unassigned-owner' and row->>8 in ('PROFILE_MISSING','PROFILE_INACTIVE','ROLE_INVALID') and (row->>2 is null or row->>4 is not null or row->>5 is not null or row->>6 is not null))
           or (row->>7 in ('invalid-date/no-task','excluded/lead-not-operational','excluded/non-selected-history') and (row->>2 is not null or row->>4 is not null or row->>5 is not null or row->>6 is not null)))
         or exists (select 1 from jsonb_array_elements(plan_counts) c where jsonb_typeof(c) <> 'number' or c::text !~ '^[0-9]+$')
         or jsonb_typeof(plan->5) <> 'number' or (plan->>5) !~ '^[0-9]+$' then v_code := 'APPROVAL_INTEGRITY_FAILURE';
      else
        v_row_count := jsonb_array_length(plan->3); v_plan_total := (plan->>5)::integer;
        select coalesce(jsonb_agg(jsonb_build_object('owner_id',r->2,'lead_id',r->1,'quote_id',null,'description','Follow up with lead','due_at',r->4,'status','pending','idempotency_key',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id='||lower(r->>0),'UTF8'),'sha256'),'hex')),'task_kind','follow_up','source_event_id',lower(r->>0),'source_event_type','follow_up_registered','source_event_created_at',r->3,'source_due_at',r->4,'source_payload',jsonb_build_object('followUpAt',r->6,'hasNote',r->5),'metadata',jsonb_build_object('schema','follow_up_task.v1','source_event_id',lower(r->>0),'source_event_type','follow_up_registered','owner_id',lower(r->>2),'lead_id',lower(r->>1))) order by ord),'[]'::jsonb) into expected_projection
          from jsonb_array_elements(plan->3) with ordinality e(r,ord) where r->>7='eligible';
        v_projection_count := jsonb_array_length(projection); projection_canonical := public.follow_up_canonical_json(projection);
        request_canonical := public.follow_up_canonical_json(jsonb_build_array('follow-up-approval-request.v1',request_text,actor_text,approval.schema_version,approval.rule_version,jsonb_build_array(to_char(approval.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),approval.event_cutoff_id::text),case when approval.task_cutoff_id is null then null else jsonb_build_array(to_char(approval.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),approval.task_cutoff_id::text) end,approval.reader_snapshot_hash,approval.canonical_plan_hash,approval.projection_hash,plan,projection));
        approval_preimage := public.follow_up_canonical_json(jsonb_build_array('follow-up-task-approval.v1',approval.id::text,request_text,approval.actor_id::text,approval.actor_role,approval.schema_version,approval.rule_version,to_char(approval.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),approval.event_cutoff_id::text,to_char(approval.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),approval.task_cutoff_id::text,approval.reader_snapshot_hash,approval.canonical_plan_hash,approval.request_fingerprint,approval.projection_hash,approval.canonical_plan,approval.eligible_projections,approval.eligible_count,approval.invalid_date_no_task_count,approval.manual_review_unassigned_owner_count,approval.excluded_lead_not_operational_count,approval.excluded_non_selected_history_count,approval.already_converted_count,approval.collision_manual_review_count,approval.total_count,approval.row_count,approval.projection_count,approval.canonical_plan_byte_count,approval.projection_byte_count,approval.request_byte_count));
        expected_approval_fingerprint := lower(encode(extensions.digest(convert_to(approval_preimage,'UTF8'),'sha256'),'hex'));
        if approval.actor_id <> actor_id or approval.actor_role <> 'admin' or approval.schema_version <> 'follow-up-approval.v1' or approval.rule_version <> 'follow-up-backfill.v1'
           or approval.reader_snapshot_hash !~ '^[0-9a-f]{64}$' or ((approval.task_cutoff_created_at is null) <> (approval.task_cutoff_id is null))
           or (plan_counts->0)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='eligible')
           or (plan_counts->1)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='invalid-date/no-task')
           or (plan_counts->2)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='manual-review/unassigned-owner')
           or (plan_counts->3)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='excluded/lead-not-operational')
           or (plan_counts->4)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='excluded/non-selected-history')
           or (plan_counts->5)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='already-converted')
           or (plan_counts->6)::integer <> (select count(*) from jsonb_array_elements(plan->3) r where r->>7='collision/manual-review')
           or v_plan_total <> v_row_count or v_plan_total <> (select sum((plan_counts->i)::integer) from generate_series(0,6) i)
           or approval.eligible_count <> (plan_counts->0)::integer or approval.invalid_date_no_task_count <> (plan_counts->1)::integer
           or approval.manual_review_unassigned_owner_count <> (plan_counts->2)::integer or approval.excluded_lead_not_operational_count <> (plan_counts->3)::integer
           or approval.excluded_non_selected_history_count <> (plan_counts->4)::integer or approval.already_converted_count <> (plan_counts->5)::integer
           or approval.collision_manual_review_count <> (plan_counts->6)::integer or approval.total_count <> v_plan_total or approval.row_count <> v_row_count
           or v_projection_count <> (plan_counts->0)::integer or approval.projection_count <> v_projection_count or projection_canonical <> public.follow_up_canonical_json(expected_projection)
           or exists (select 1 from jsonb_array_elements(projection) item where jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 14)
           or lower(encode(extensions.digest(convert_to(approval.canonical_plan,'UTF8'),'sha256'),'hex')) <> approval.canonical_plan_hash
           or lower(encode(extensions.digest(convert_to(projection_canonical,'UTF8'),'sha256'),'hex')) <> approval.projection_hash
           or octet_length(convert_to(approval.canonical_plan,'UTF8')) <> approval.canonical_plan_byte_count or octet_length(convert_to(projection_canonical,'UTF8')) <> approval.projection_byte_count
           or octet_length(convert_to(request_canonical,'UTF8')) <> approval.request_byte_count or lower(encode(extensions.digest(convert_to(request_canonical,'UTF8'),'sha256'),'hex')) <> approval.request_fingerprint
           or expected_approval_fingerprint <> approval.approval_fingerprint or expected_approval_fingerprint !~ '^[0-9a-f]{64}$' then v_code := 'APPROVAL_INTEGRITY_FAILURE';
        end if;
        select exists (select 1 from jsonb_array_elements(plan->3) row where octet_length(convert_to(public.follow_up_canonical_json(row),'UTF8')) > 512) into v_row_limit;
        select exists (select 1 from jsonb_array_elements(projection) item where octet_length(convert_to(public.follow_up_canonical_json(item),'UTF8')) > 2048) into v_projection_item_limit;
        v_header_limit := octet_length(convert_to(public.follow_up_canonical_json(expected_header),'UTF8')) > 4096;
      end if;
    end if;
  exception when others then v_code := 'APPROVAL_INTEGRITY_FAILURE';
  end;
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;

  /* Stable live-context locks are acquired in the required total order. */
  for candidate in select distinct (r->>'owner_id')::uuid owner_id from jsonb_array_elements(projection) r order by owner_id loop
    select * into profile_row from public.profiles where id = candidate.owner_id for update;
  end loop;
  for candidate in select distinct (r->>'lead_id')::uuid lead_id from jsonb_array_elements(projection) r order by lead_id loop
    select * into lead_row from public.leads where id = candidate.lead_id for update;
  end loop;
  for candidate in select distinct (r->>'owner_id')::uuid owner_id from jsonb_array_elements(projection) r order by owner_id loop
    perform 1 from public.profile_roles where profile_id = candidate.owner_id order by role_id for update;
  end loop;
  for candidate in select distinct pr.role_id from public.profile_roles pr join (select distinct (r->>'owner_id')::uuid owner_id from jsonb_array_elements(projection) r) o on o.owner_id = pr.profile_id order by pr.role_id loop
    perform 1 from public.roles where id = candidate.role_id for update;
  end loop;
  for candidate in select (r->>'owner_id')::uuid owner_id,(r->>'lead_id')::uuid lead_id from jsonb_array_elements(projection) r order by (r->>'owner_id') collate "C",(r->>'lead_id') collate "C" loop
    select * into profile_row from public.profiles where id = candidate.owner_id;
    select * into lead_row from public.leads where id = candidate.lead_id;
    if profile_row.id is null or not profile_row.is_active or lead_row.id is null or lead_row.assigned_to is distinct from candidate.owner_id or lead_row.deleted_at is not null or lead_row.archived_at is not null
       or not exists (select 1 from public.profile_roles where profile_id = candidate.owner_id)
       or exists (select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=candidate.owner_id and r.name not in ('admin','manager','asesor')) then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','STALE_LIVE_CONTEXT','message','STALE_LIVE_CONTEXT'));
    end if;
  end loop;
  for candidate in select source_event_id::uuid source_event_id from (select distinct r->>'source_event_id' source_event_id from jsonb_array_elements(projection) r) s order by source_event_id collate "C" loop
    preimage := 'follow-up-apply:source:v1|' || candidate.source_event_id::text; perform pg_catalog.pg_advisory_xact_lock((('x'||substr(encode(extensions.digest(convert_to(preimage,'UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint));
  end loop;
  for candidate in select owner_id::uuid owner_id,idempotency_key from (select distinct r->>'owner_id' owner_id,r->>'idempotency_key' idempotency_key from jsonb_array_elements(projection) r) s order by owner_id collate "C",idempotency_key collate "C" loop
    preimage := 'follow-up-apply:owner-idempotency:v1|'||candidate.owner_id::text||'|'||candidate.idempotency_key; perform pg_catalog.pg_advisory_xact_lock((('x'||substr(encode(extensions.digest(convert_to(preimage,'UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint));
  end loop;
  for candidate in select owner_id::uuid owner_id,lead_id::uuid lead_id from (select distinct r->>'owner_id' owner_id,r->>'lead_id' lead_id from jsonb_array_elements(projection) r) s order by owner_id collate "C",lead_id collate "C" loop
    preimage := 'follow-up-apply:owner-lead:v1|'||candidate.owner_id::text||'|'||candidate.lead_id::text; perform pg_catalog.pg_advisory_xact_lock((('x'||substr(encode(extensions.digest(convert_to(preimage,'UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint));
  end loop;
   /* Closed precedence is stale context, then every occupancy namespace, then bounds. */
   for task_row in select t.* from public.tasks t where t.source_event_id in (select (r->>'source_event_id')::uuid from jsonb_array_elements(projection) r) or (t.owner_id,t.idempotency_key) in (select (r->>'owner_id')::uuid,r->>'idempotency_key' from jsonb_array_elements(projection) r) or (t.owner_id,t.lead_id) in (select (r->>'owner_id')::uuid,(r->>'lead_id')::uuid from jsonb_array_elements(projection) r) order by t.id for update loop
       return jsonb_build_object('ok',false,'error',jsonb_build_object('code','TASK_OCCUPANCY_CONFLICT','message','TASK_OCCUPANCY_CONFLICT'));
   end loop;
   if v_row_count > 2000 or v_plan_total > 2000 or v_projection_count > 2000 or v_row_limit or v_projection_item_limit or v_header_limit
      or approval.canonical_plan_byte_count > 1048576 or approval.projection_byte_count > 4194304 or approval.request_byte_count > 5242880
      or octet_length(convert_to(approval.canonical_plan,'UTF8')) > 1048576 or octet_length(convert_to(projection_canonical,'UTF8')) > 4194304 or octet_length(convert_to(request_canonical,'UTF8')) > 5242880 then
     return jsonb_build_object('ok',false,'error',jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED'));
   end if;

  for candidate in select r,ord from jsonb_array_elements(projection) with ordinality e(r,ord) order by ord loop
    insert into public.tasks(owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata)
    values ((candidate.r->>'owner_id')::uuid,(candidate.r->>'lead_id')::uuid,null,'Follow up with lead',(candidate.r->>'due_at')::timestamptz,'pending',candidate.r->>'idempotency_key','follow_up',(candidate.r->>'source_event_id')::uuid,candidate.r->>'source_event_type',(candidate.r->>'source_event_created_at')::timestamptz,(candidate.r->>'source_due_at')::timestamptz,candidate.r->'source_payload',candidate.r->'metadata') returning * into task_row;
    task_ids := task_ids || task_row.id;
  end loop;
  result := jsonb_build_object('schema','follow-up-task-apply-result.v1','requestId',request_text,'approvalId',approval_text,'actorId',actor_text,'taskIds',to_jsonb(task_ids),'taskCount',cardinality(task_ids));
  result_preimage := public.follow_up_canonical_json(jsonb_build_array('follow-up-task-apply-result.v1',request_text,approval_text,actor_text,to_jsonb(task_ids),cardinality(task_ids)));
  result_hash := lower(encode(extensions.digest(convert_to(result_preimage,'UTF8'),'sha256'),'hex')); result_bytes := octet_length(convert_to(result_preimage,'UTF8'));
  if result_bytes > 1048576 or not public.validate_follow_up_task_apply_result(result,request_text,approval_text,actor_text,task_ids,cardinality(task_ids),result_hash,result_bytes) then raise exception using message='FOLLOW_UP_TASK_APPLY_RECEIPT_INTEGRITY_FAILURE'; end if;
  insert into public.follow_up_task_apply_receipts(request_id,approval_id,actor_id,approval_fingerprint,request_fingerprint,canonical_plan_hash,projection_hash,status,task_ids,task_count,result,result_hash,result_byte_count)
   values (request_uuid,approval.id,actor_id,expected_approval_fingerprint,expected_request_fingerprint,approval.canonical_plan_hash,approval.projection_hash,'applied',task_ids,cardinality(task_ids),result,result_hash,result_bytes) returning * into receipt;
  return jsonb_build_object('ok',true,'status','applied') || to_jsonb(receipt);
end;
$function$;

alter function public.apply_approved_follow_up_task_plan(text,uuid) owner to postgres;
revoke all on function public.apply_approved_follow_up_task_plan(text,uuid) from public,anon,service_role;
grant execute on function public.apply_approved_follow_up_task_plan(text,uuid) to authenticated;
revoke insert,update,delete on table public.tasks from public,anon,authenticated,service_role;
revoke insert,update,delete on table public.follow_up_task_apply_receipts from public,anon,authenticated,service_role;

/* Exact 0067 rollback, in dependency order; 0066 objects remain at the boundary. */
-- revoke all on function public.apply_approved_follow_up_task_plan(text,uuid) from public,anon,authenticated,service_role;
-- drop function public.apply_approved_follow_up_task_plan(text,uuid);
-- alter table public.follow_up_task_approvals drop constraint follow_up_task_approvals_approval_fingerprint_check;
-- drop trigger set_follow_up_task_approval_fingerprint on public.follow_up_task_approvals;
-- drop function public.set_follow_up_task_approval_fingerprint();
-- alter table public.follow_up_task_approvals drop column approval_fingerprint;

commit;
