begin;

create or replace function public.follow_up_task_readiness_validate_approval(p_request_id uuid)
returns boolean language plpgsql stable security invoker set search_path = '' as $function$
declare
  a public.follow_up_task_approvals;
  plan jsonb;
  counts jsonb;
  projection jsonb;
  expected_projection jsonb;
  expected_header jsonb;
  request_canonical text;
  approval_canonical text;
begin
  if p_request_id is null then return false; end if;
  select value.* into a from public.follow_up_task_approvals value where value.request_id = p_request_id;
  if not found then return false; end if;
  plan := a.canonical_plan::jsonb;
  projection := a.eligible_projections;
  if pg_catalog.jsonb_typeof(plan) <> 'array' or pg_catalog.jsonb_array_length(plan) <> 10
     or pg_catalog.jsonb_typeof(plan->3) <> 'array' or pg_catalog.jsonb_typeof(plan->4) <> 'array'
     or pg_catalog.jsonb_array_length(plan->4) <> 7 or pg_catalog.jsonb_typeof(plan->5) <> 'number'
     or plan->>5 !~ '^[0-9]+$' or pg_catalog.jsonb_typeof(projection) <> 'array' then return false; end if;
  counts := plan->4;
  expected_header := pg_catalog.jsonb_build_array(a.rule_version,to_char(a.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.event_cutoff_id::text,'[]'::jsonb,counts,0,0,0,0,false);
  if public.follow_up_canonical_json(plan) <> a.canonical_plan
     or pg_catalog.jsonb_build_array(plan->0,plan->1,plan->2,'[]'::jsonb,plan->4,0,plan->6,plan->7,plan->8,plan->9) <> expected_header
     or exists (select 1 from pg_catalog.jsonb_array_elements(counts) c where pg_catalog.jsonb_typeof(c) <> 'number' or c::text !~ '^[0-9]+$' or (c::text)::numeric > 2000)
     or exists (select 1 from pg_catalog.jsonb_array_elements(plan->3) row where
       pg_catalog.jsonb_typeof(row) <> 'array' or pg_catalog.jsonb_array_length(row) <> 9
       or row->>0 is null or row->>1 is null or row->>3 is null or row->>7 is null or row->>8 is null
       or row->>0 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (row->>0)::uuid::text <> row->>0
       or row->>1 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (row->>1)::uuid::text <> row->>1
       or (row->>2 is not null and (row->>2 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (row->>2)::uuid::text <> row->>2))
       or row->>3 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((row->>3)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> row->>3
       or (row->>4 is not null and (row->>4 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((row->>4)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> row->>4))
       or pg_catalog.jsonb_typeof(row->5) not in ('boolean','null')
       or (row->>6 is not null and (row->>6 !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((row->>6)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> row->>6))
       or (row->>7,row->>8) not in (('eligible','ELIGIBLE'),('invalid-date/no-task','INVALID_DATE_NO_TASK'),
         ('manual-review/unassigned-owner','UNASSIGNED_OWNER'),('manual-review/unassigned-owner','PROFILE_MISSING'),('manual-review/unassigned-owner','PROFILE_INACTIVE'),('manual-review/unassigned-owner','ROLE_INVALID'),
         ('excluded/lead-not-operational','LEAD_NOT_OPERATIONAL'),('excluded/non-selected-history','NON_SELECTED_HISTORY'),('already-converted','ALREADY_CONVERTED'),
         ('collision/manual-review','DUPLICATE_SOURCE'),('collision/manual-review','SOURCE_MISMATCH'),('collision/manual-review','IDEMPOTENCY_COLLISION'),('collision/manual-review','OWNER_LEAD_COLLISION'))
       or (row->>7 in ('eligible','already-converted','collision/manual-review') and (row->>2 is null or row->>4 is null or row->>5 is null or row->>6 is null))
       or (row->>7='manual-review/unassigned-owner' and row->>8='UNASSIGNED_OWNER' and (row->>2 is not null or row->>4 is not null or row->>5 is not null or row->>6 is not null))
       or (row->>7='manual-review/unassigned-owner' and row->>8 in ('PROFILE_MISSING','PROFILE_INACTIVE','ROLE_INVALID') and (row->>2 is null or row->>4 is not null or row->>5 is not null or row->>6 is not null))
       or (row->>7 in ('invalid-date/no-task','excluded/lead-not-operational','excluded/non-selected-history') and (row->>2 is not null or row->>4 is not null or row->>5 is not null or row->>6 is not null))
       or octet_length(convert_to(public.follow_up_canonical_json(row),'UTF8')) > 512) then return false; end if;
  if pg_catalog.jsonb_array_length(plan->3) > 2000 or (plan->>5)::integer <> pg_catalog.jsonb_array_length(plan->3)
     or (plan->>5)::integer <> (select sum((counts->i)::integer) from pg_catalog.generate_series(0,6) i)
     or (counts->0)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='eligible')
     or (counts->1)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='invalid-date/no-task')
     or (counts->2)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='manual-review/unassigned-owner')
     or (counts->3)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='excluded/lead-not-operational')
     or (counts->4)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='excluded/non-selected-history')
     or (counts->5)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='already-converted')
     or (counts->6)::integer <> (select count(*) from pg_catalog.jsonb_array_elements(plan->3) r where r->>7='collision/manual-review') then return false; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'owner_id',r->2,'lead_id',r->1,'quote_id',null,'description','Follow up with lead','due_at',r->4,'status','pending',
    'idempotency_key',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id='||lower(r->>0),'UTF8'),'sha256'),'hex')),
    'task_kind','follow_up','source_event_id',lower(r->>0),'source_event_type','follow_up_registered','source_event_created_at',r->3,'source_due_at',r->4,
    'source_payload',pg_catalog.jsonb_build_object('followUpAt',r->6,'hasNote',r->5),
    'metadata',pg_catalog.jsonb_build_object('schema','follow_up_task.v1','source_event_id',lower(r->>0),'source_event_type','follow_up_registered','owner_id',lower(r->>2),'lead_id',lower(r->>1))) order by ord),'[]'::jsonb)
    into expected_projection from pg_catalog.jsonb_array_elements(plan->3) with ordinality e(r,ord) where r->>7='eligible';
  request_canonical := public.follow_up_canonical_json(pg_catalog.jsonb_build_array('follow-up-approval-request.v1',a.request_id::text,a.actor_id::text,a.schema_version,a.rule_version,
    pg_catalog.jsonb_build_array(to_char(a.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.event_cutoff_id::text),
    case when a.task_cutoff_id is null then null else pg_catalog.jsonb_build_array(to_char(a.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),a.task_cutoff_id::text) end,
    a.reader_snapshot_hash,a.canonical_plan_hash,a.projection_hash,plan,projection));
  approval_canonical := public.follow_up_canonical_json(pg_catalog.jsonb_build_array('follow-up-task-approval.v1',a.id::text,a.request_id::text,a.actor_id::text,a.actor_role,a.schema_version,a.rule_version,
    to_char(a.event_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),a.event_cutoff_id::text,to_char(a.task_cutoff_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),a.task_cutoff_id::text,
    a.reader_snapshot_hash,a.canonical_plan_hash,a.request_fingerprint,a.projection_hash,a.canonical_plan,a.eligible_projections,a.eligible_count,a.invalid_date_no_task_count,
    a.manual_review_unassigned_owner_count,a.excluded_lead_not_operational_count,a.excluded_non_selected_history_count,a.already_converted_count,a.collision_manual_review_count,
    a.total_count,a.row_count,a.projection_count,a.canonical_plan_byte_count,a.projection_byte_count,a.request_byte_count));
  return a.actor_role='admin' and a.schema_version='follow-up-approval.v1' and a.rule_version='follow-up-backfill.v1'
    and a.eligible_count=(counts->0)::integer and a.invalid_date_no_task_count=(counts->1)::integer and a.manual_review_unassigned_owner_count=(counts->2)::integer
    and a.excluded_lead_not_operational_count=(counts->3)::integer and a.excluded_non_selected_history_count=(counts->4)::integer
    and a.already_converted_count=(counts->5)::integer and a.collision_manual_review_count=(counts->6)::integer
    and a.total_count=(plan->>5)::integer and a.row_count=a.total_count and a.projection_count=a.eligible_count
    and public.follow_up_canonical_json(projection)=public.follow_up_canonical_json(expected_projection)
    and not exists (select 1 from pg_catalog.jsonb_array_elements(projection) item where pg_catalog.jsonb_typeof(item)<>'object' or octet_length(convert_to(public.follow_up_canonical_json(item),'UTF8'))>2048)
    and a.canonical_plan_byte_count=octet_length(convert_to(a.canonical_plan,'UTF8')) and a.canonical_plan_byte_count<=1048576
    and a.projection_byte_count=octet_length(convert_to(public.follow_up_canonical_json(projection),'UTF8')) and a.projection_byte_count<=4194304
    and a.request_byte_count=octet_length(convert_to(request_canonical,'UTF8')) and a.request_byte_count<=5242880
    and octet_length(convert_to(public.follow_up_canonical_json(expected_header),'UTF8'))<=4096
    and a.canonical_plan_hash=lower(encode(extensions.digest(convert_to(a.canonical_plan,'UTF8'),'sha256'),'hex'))
    and a.projection_hash=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(projection),'UTF8'),'sha256'),'hex'))
    and a.request_fingerprint=lower(encode(extensions.digest(convert_to(request_canonical,'UTF8'),'sha256'),'hex'))
    and a.approval_fingerprint=lower(encode(extensions.digest(convert_to(approval_canonical,'UTF8'),'sha256'),'hex'));
exception when others then return false;
end;
$function$;

create or replace function public.follow_up_task_readiness_validate_receipt(p_request_id uuid)
returns boolean language plpgsql stable security invoker set search_path = '' as $function$
declare a public.follow_up_task_approvals; r public.follow_up_task_apply_receipts; expected_request_fingerprint text;
begin
  if not public.follow_up_task_readiness_validate_approval(p_request_id) then return false; end if;
  select value.* into a from public.follow_up_task_approvals value where value.request_id=p_request_id;
  select value.* into r from public.follow_up_task_apply_receipts value where value.request_id=p_request_id;
  if not found then return false; end if;
  expected_request_fingerprint := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(pg_catalog.jsonb_build_array('follow-up-task-apply-request.v1',p_request_id::text,a.actor_id::text)),'UTF8'),'sha256'),'hex'));
  return r.approval_id=a.id and r.actor_id=a.actor_id and r.approval_fingerprint=a.approval_fingerprint
    and r.request_fingerprint=expected_request_fingerprint and r.canonical_plan_hash=a.canonical_plan_hash and r.projection_hash=a.projection_hash
    and r.status='applied' and r.task_count=a.eligible_count and r.task_count between 0 and 2000
    and public.validate_follow_up_task_apply_result(r.result,p_request_id::text,a.id::text,a.actor_id::text,r.task_ids,r.task_count,r.result_hash,r.result_byte_count);
exception when others then return false;
end;
$function$;

create or replace function public.follow_up_task_readiness_rows(p_request_id uuid)
returns table (ordinal integer, event_id uuid, lead_id uuid, owner_id uuid, event_created_at timestamptz,
  due_at timestamptz, has_note boolean, follow_up_at timestamptz, disposition text, reason text, receipt_task_id uuid)
language plpgsql stable security invoker set search_path = '' as $function$
declare plan jsonb; task_ids uuid[];
begin
  if not public.follow_up_task_readiness_validate_receipt(p_request_id) then return; end if;
  select a.canonical_plan::jsonb,r.task_ids into plan,task_ids from public.follow_up_task_approvals a
    join public.follow_up_task_apply_receipts r on r.request_id=a.request_id where a.request_id=p_request_id;
  return query with source_rows as (
    select item,ord,count(*) filter (where item->>7='eligible') over (order by ord) eligible_ordinal
    from pg_catalog.jsonb_array_elements(plan->3) with ordinality e(item,ord) order by ord limit 2000
  ) select (ord-1)::integer,(item->>0)::uuid,(item->>1)::uuid,(item->>2)::uuid,(item->>3)::timestamptz,
    (item->>4)::timestamptz,(item->>5)::boolean,(item->>6)::timestamptz,item->>7,item->>8,
    case when item->>7='eligible' then task_ids[eligible_ordinal::integer] end from source_rows order by ord;
end;
$function$;

alter function public.follow_up_task_readiness_validate_approval(uuid) owner to postgres;
alter function public.follow_up_task_readiness_validate_receipt(uuid) owner to postgres;
alter function public.follow_up_task_readiness_rows(uuid) owner to postgres;
revoke all on function public.follow_up_task_readiness_validate_approval(uuid) from public,anon,authenticated,service_role;
revoke all on function public.follow_up_task_readiness_validate_receipt(uuid) from public,anon,authenticated,service_role;
revoke all on function public.follow_up_task_readiness_rows(uuid) from public,anon,authenticated,service_role;

-- rollback: drop function public.follow_up_task_readiness_rows(uuid);
-- rollback: drop function public.follow_up_task_readiness_validate_receipt(uuid);
-- rollback: drop function public.follow_up_task_readiness_validate_approval(uuid);

commit;
