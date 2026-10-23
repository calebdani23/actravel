begin;

create or replace function public.task_automation_historical_hash(jsonb) returns text
language sql immutable strict parallel safe security invoker set search_path = '' as $function$
  select pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.follow_up_canonical_json($1),'UTF8'),'sha256'),'hex'))
$function$;

create or replace function public.task_automation_historical_task_uuid(text) returns uuid
language plpgsql immutable strict parallel safe security invoker set search_path = '' as $function$
declare v_digest bytea; v_hex text;
begin
  if $1 !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='HISTORICAL_ORIGIN_KEY_INVALID'; end if;
  v_digest := extensions.digest(pg_catalog.convert_to(public.follow_up_canonical_json(jsonb_build_array('task-automation-historical-task-id.v1',$1)),'UTF8'),'sha256');
  v_digest := pg_catalog.set_byte(v_digest,6,(pg_catalog.get_byte(v_digest,6)&15)|80);
  v_digest := pg_catalog.set_byte(v_digest,8,(pg_catalog.get_byte(v_digest,8)&63)|128);
  v_hex := pg_catalog.encode(pg_catalog.substr(v_digest,1,16),'hex');
  return (pg_catalog.substr(v_hex,1,8)||'-'||pg_catalog.substr(v_hex,9,4)||'-'||pg_catalog.substr(v_hex,13,4)||'-'||pg_catalog.substr(v_hex,17,4)||'-'||pg_catalog.substr(v_hex,21,12))::uuid;
end
$function$;

create or replace function public.read_task_automation_historical_boundaries(p_expected_actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid(); v_opportunity_cutoff timestamptz; v_quote_cutoff timestamptz;
  v_cutoff_count bigint; v_opportunity_count bigint; v_quote_count bigint;
  v_snapshot jsonb; v_snapshot_valid boolean;
begin
  if v_actor is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_REQUIRED','message','AUTH_REQUIRED')); end if;
  if not exists (select 1 from public.profiles p where p.id=v_actor and p.is_active) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INACTIVE','message','AUTH_INACTIVE')); end if;
  if not exists (select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=v_actor and r.name='admin') then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_NOT_ADMIN','message','AUTH_NOT_ADMIN')); end if;
  if v_actor is distinct from p_expected_actor_id then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_ACTOR_MISMATCH','message','AUTH_ACTOR_MISMATCH')); end if;

  select count(*),min(cutoff_at) filter(where source_kind='opportunity_assignment'),min(cutoff_at) filter(where source_kind='quote_sent')
    into v_cutoff_count,v_opportunity_cutoff,v_quote_cutoff from public.task_automation_source_cutoffs;
  if v_cutoff_count<>2 or v_opportunity_cutoff is null or v_quote_cutoff is null
     or not pg_catalog.isfinite(v_opportunity_cutoff) or not pg_catalog.isfinite(v_quote_cutoff)
     or date_trunc('microseconds',v_opportunity_cutoff)<>v_opportunity_cutoff or date_trunc('microseconds',v_quote_cutoff)<>v_quote_cutoff then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','CUTOFF_UNAVAILABLE','message','CUTOFF_UNAVAILABLE'));
  end if;
  select count(*) into v_opportunity_count from public.leads value where value.created_at < v_opportunity_cutoff;
  select count(*) into v_quote_count from public.quote_versions value where value.sent_at is not null and value.sent_at < v_quote_cutoff;
  if v_opportunity_count>2000 or v_quote_count>2000 or v_opportunity_count+v_quote_count>4000 then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED'));
  end if;

  with cursors(name,at,identity) as (
    select 'opportunityRoots',x.at,x.identity from (values(1)) seed(n) left join lateral (select created_at at,id::text identity from public.leads where created_at<v_opportunity_cutoff order by created_at desc,id desc limit 1) x on true
    union all select 'quoteVersionRoots',x.at,x.identity from (values(1)) seed(n) left join lateral (select sent_at at,id::text identity from public.quote_versions where sent_at is not null and sent_at<v_quote_cutoff order by sent_at desc,id desc limit 1) x on true
    union all select 'assignmentEvidence',x.at,x.identity from (values(1)) seed(n) left join lateral (select e.created_at at,e.id::text identity from public.lead_events e where e.event_type in ('assigned','status_changed') and exists(select 1 from public.leads l where l.id=e.lead_id and l.created_at<v_opportunity_cutoff) order by e.created_at desc,e.id desc limit 1) x on true
    union all select 'quoteSourceEvidence',x.at,x.identity from (values(1)) seed(n) left join lateral (
      select q.at,q.identity from (
        select e.created_at at,e.id::text identity from public.quote_events e join public.quote_versions v on v.id=e.quote_version_id where v.sent_at is not null and v.sent_at<v_quote_cutoff and e.event_type in ('quote_sent','quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded')
        union all select e.created_at,e.id::text from public.lead_events e where e.event_type='whatsapp_inbound_received' and exists(select 1 from public.quote_versions v where v.lead_id=e.lead_id and v.sent_at is not null and v.sent_at<v_quote_cutoff)
        union all select p.verified_at,p.id::text from public.payments p where p.status='verified' and p.verified_at is not null and (exists(select 1 from public.quote_versions v where v.id=p.accepted_quote_version_id and v.sent_at is not null and v.sent_at<v_quote_cutoff) or exists(select 1 from public.quote_versions v where v.lead_id=p.lead_id and v.sent_at is not null and v.sent_at<v_quote_cutoff))
      ) q order by q.at desc,q.identity desc limit 1
    ) x on true
    union all select 'taskOccupancy',x.at,x.identity from (values(1)) seed(n) left join lateral (select created_at at,id::text identity from public.tasks order by created_at desc,id desc limit 1) x on true
    union all select 'automationOrigins',x.at,x.identity from (values(1)) seed(n) left join lateral (select created_at at,origin_key identity from public.task_automation_origins order by created_at desc,origin_key desc limit 1) x on true
    union all select 'automationOutcomes',x.at,x.identity from (values(1)) seed(n) left join lateral (select created_at at,outcome_key identity from public.task_automation_outcomes order by created_at desc,outcome_key desc limit 1) x on true
    union all select 'automationTombstones',x.at,x.identity from (values(1)) seed(n) left join lateral (select created_at at,tombstone_key identity from public.task_automation_tombstones order by created_at desc,tombstone_key desc limit 1) x on true
  )
  select bool_and((at is null and identity is null) or (pg_catalog.isfinite(at) and date_trunc('microseconds',at)=at and identity ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64})$')),
    jsonb_object_agg(name,case when at is null then 'null'::jsonb else jsonb_build_array(to_char(at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),identity) end)
    into v_snapshot_valid,v_snapshot from cursors;
  if not coalesce(v_snapshot_valid,false) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','CUTOFF_UNAVAILABLE','message','CUTOFF_UNAVAILABLE')); end if;
  return jsonb_build_object('ok',true,'source_cutoffs',jsonb_build_object(
    'opportunityAssignment',to_char(v_opportunity_cutoff at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'quoteSent',to_char(v_quote_cutoff at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    'snapshot_cutoffs',v_snapshot,'opportunity_root_count',v_opportunity_count::integer,'quote_version_root_count',v_quote_count::integer);
end
$function$;

create or replace function public.read_task_automation_historical_sources(p_expected_actor_id uuid,p_boundaries jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare
  v_current jsonb; v_result jsonb; v_opportunity_count bigint; v_quote_count bigint;
  v_assignment_count bigint; v_quote_evidence_count bigint; v_occupancy_count bigint;
begin
  v_current := public.read_task_automation_historical_boundaries(p_expected_actor_id);
  if v_current->>'ok' is distinct from 'true' then return v_current; end if;
  if p_boundaries is null or pg_catalog.jsonb_typeof(p_boundaries)<>'object'
     or not p_boundaries ?& array['ok','source_cutoffs','snapshot_cutoffs','opportunity_root_count','quote_version_root_count']
     or p_boundaries-array['ok','source_cutoffs','snapshot_cutoffs','opportunity_root_count','quote_version_root_count']<>'{}'::jsonb then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','MALFORMED_ROW','message','MALFORMED_ROW'));
  end if;
  if p_boundaries<>v_current then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INCOMPLETE_JOIN','message','INCOMPLETE_JOIN'));
  end if;

  with
  limits as (select (p_boundaries#>>'{source_cutoffs,opportunityAssignment}')::timestamptz opportunity_cutoff,
    (p_boundaries#>>'{source_cutoffs,quoteSent}')::timestamptz quote_cutoff,
    (p_boundaries#>>'{snapshot_cutoffs,assignmentEvidence,0}')::timestamptz assignment_at,
    p_boundaries#>>'{snapshot_cutoffs,assignmentEvidence,1}' assignment_id,
    (p_boundaries#>>'{snapshot_cutoffs,quoteSourceEvidence,0}')::timestamptz quote_evidence_at,
    p_boundaries#>>'{snapshot_cutoffs,quoteSourceEvidence,1}' quote_evidence_id,
    (p_boundaries#>>'{snapshot_cutoffs,taskOccupancy,0}')::timestamptz task_at,
    p_boundaries#>>'{snapshot_cutoffs,taskOccupancy,1}' task_id,
    (p_boundaries#>>'{snapshot_cutoffs,automationOrigins,0}')::timestamptz origin_at,
    p_boundaries#>>'{snapshot_cutoffs,automationOrigins,1}' origin_id,
    (p_boundaries#>>'{snapshot_cutoffs,automationOutcomes,0}')::timestamptz outcome_at,
    p_boundaries#>>'{snapshot_cutoffs,automationOutcomes,1}' outcome_id,
    (p_boundaries#>>'{snapshot_cutoffs,automationTombstones,0}')::timestamptz tombstone_at,
    p_boundaries#>>'{snapshot_cutoffs,automationTombstones,1}' tombstone_id),
  opportunity_roots as (
    select l.id opportunity_id,l.created_at,l.assigned_to,l.deleted_at,l.archived_at,l.status_id,s.is_terminal
    from public.leads l join public.lead_statuses s on s.id=l.status_id cross join limits x where l.created_at<x.opportunity_cutoff),
  quote_roots as (
    select v.id quote_version_id,v.quote_id,v.lead_id opportunity_id,v.sent_at,v.status version_status,
      q.owner_id,q.deleted_at quote_deleted_at,l.deleted_at opportunity_deleted_at,l.archived_at opportunity_archived_at
    from public.quote_versions v join public.quotes q on q.id=v.quote_id and q.lead_id=v.lead_id
    join public.leads l on l.id=v.lead_id cross join limits x where v.sent_at is not null and v.sent_at<x.quote_cutoff),
  assignment_rows as (
    select e.id event_id,e.lead_id opportunity_id,e.created_at occurred_at,e.event_type,
      case when e.event_type='assigned' then e.payload ? 'assignedTo' and e.payload-array['assignedTo']='{}'::jsonb
        and (e.payload->'assignedTo'='null'::jsonb or e.payload->>'assignedTo'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        else e.payload ? 'statusId' and e.payload-array['statusId']='{}'::jsonb and e.payload->>'statusId'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' end payload_valid,
      case when e.event_type='assigned' then e.payload->>'assignedTo' end assigned_to,
      case when e.event_type='status_changed' then e.payload->>'statusId' end status_id,
      coalesce(s.is_terminal,false) status_terminal
    from public.lead_events e join opportunity_roots r on r.opportunity_id=e.lead_id cross join limits x
    left join public.lead_statuses s on e.event_type='status_changed' and s.id::text=e.payload->>'statusId'
    where e.event_type in ('assigned','status_changed') and x.assignment_at is not null
      and (e.created_at,e.id::text)<=(x.assignment_at,x.assignment_id)),
  quote_evidence_rows as (
    select e.id evidence_id,e.created_at occurred_at,e.event_type kind,e.quote_version_id,e.quote_id,e.lead_id opportunity_id,
      null::uuid accepted_quote_version_id,null::text payment_status,
      case when e.event_type='quote_version_response' then e.payload ?& array['schema','requestId','quoteId','quoteVersionId','channel','actorId']
        and e.payload-array['schema','requestId','quoteId','quoteVersionId','channel','actorId']='{}'::jsonb else true end payload_valid
    from public.quote_events e join quote_roots r on r.quote_version_id=e.quote_version_id cross join limits x
    where e.event_type in ('quote_sent','quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded')
      and x.quote_evidence_at is not null and (e.created_at,e.id::text)<=(x.quote_evidence_at,x.quote_evidence_id)
    union all
    select e.id,e.created_at,'whatsapp_inbound',null,null,e.lead_id,null,null,true
    from public.lead_events e cross join limits x where e.event_type='whatsapp_inbound_received'
      and exists(select 1 from quote_roots r where r.opportunity_id=e.lead_id) and x.quote_evidence_at is not null
      and (e.created_at,e.id::text)<=(x.quote_evidence_at,x.quote_evidence_id)
    union all
    select p.id,p.verified_at,'payment',null,null,p.lead_id,p.accepted_quote_version_id,p.status,true
    from public.payments p cross join limits x where p.status='verified' and p.verified_at is not null
      and (exists(select 1 from quote_roots r where r.quote_version_id=p.accepted_quote_version_id)
        or exists(select 1 from quote_roots r where r.opportunity_id=p.lead_id)) and x.quote_evidence_at is not null
      and (p.verified_at,p.id::text)<=(x.quote_evidence_at,x.quote_evidence_id)),
  owner_ids as (select assigned_to owner_id from opportunity_roots where assigned_to is not null union select owner_id from quote_roots where owner_id is not null),
  owner_rows as (select o.owner_id,p.id is not null profile_exists,coalesce(p.is_active,false) is_active,
    coalesce((select jsonb_agg(r.name order by r.name) from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=o.owner_id),'[]'::jsonb) roles
    from owner_ids o left join public.profiles p on p.id=o.owner_id),
  candidate_origins as (
    select public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',r.opportunity_id::text)) origin_key from opportunity_roots r
    union select public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','quote_follow_up',r.quote_version_id::text,e.id::text))
      from quote_roots r join lateral (select q.id from public.quote_events q where q.quote_version_id=r.quote_version_id and q.event_type='quote_sent' order by q.created_at,q.id limit 1) e on true),
  task_rows as (select t.id,t.created_at,t.updated_at,t.owner_id,t.lead_id,t.quote_id,t.description,t.due_at,t.status,t.task_kind,
      t.idempotency_key,t.automation_origin_key,(t.source_event_id is not null or t.source_event_type is not null or t.source_event_created_at is not null or t.source_due_at is not null or t.source_payload is not null) legacy_provenance
    from public.tasks t cross join limits x where x.task_at is not null and (t.created_at,t.id::text)<=(x.task_at,x.task_id)
    and (exists(select 1 from opportunity_roots r where r.opportunity_id=t.lead_id)
      or exists(select 1 from quote_roots r where r.quote_id=t.quote_id)
      or exists(select 1 from candidate_origins c where c.origin_key in (t.idempotency_key,t.automation_origin_key) or public.task_automation_historical_task_uuid(c.origin_key)=t.id))),
  origin_rows as (select o.origin_key,o.task_kind,o.source_kind,o.operation,o.opportunity_id,o.quote_version_id,o.sent_event_id,o.anchor_at,o.due_rule_version,o.task_id,o.created_at
    from public.task_automation_origins o cross join limits x where x.origin_at is not null
    and (o.created_at,o.origin_key)<=(x.origin_at,x.origin_id) and (exists(select 1 from candidate_origins c where c.origin_key=o.origin_key)
      or exists(select 1 from opportunity_roots r where r.opportunity_id=o.opportunity_id) or exists(select 1 from quote_roots r where r.quote_version_id=o.quote_version_id))),
  outcome_rows as (select o.outcome_key,o.source_kind,o.source_id,o.source_key,o.source_order,o.operation,o.origin_key,o.task_id,o.outcome,o.reason,o.created_at
    from public.task_automation_outcomes o cross join limits x where x.outcome_at is not null
    and (o.created_at,o.outcome_key)<=(x.outcome_at,x.outcome_id) and (exists(select 1 from candidate_origins c where c.origin_key=o.origin_key)
      or exists(select 1 from assignment_rows e where e.event_id=o.source_id) or exists(select 1 from quote_evidence_rows e where e.evidence_id=o.source_id))),
  tombstone_rows as (select t.tombstone_key,t.source_kind,t.source_id,t.source_key,t.source_order,t.origin_key,t.reason,t.created_at
    from public.task_automation_tombstones t cross join limits x where x.tombstone_at is not null
    and (t.created_at,t.tombstone_key)<=(x.tombstone_at,x.tombstone_id) and (exists(select 1 from candidate_origins c where c.origin_key=t.origin_key)
      or exists(select 1 from assignment_rows e where e.event_id=t.source_id) or exists(select 1 from quote_evidence_rows e where e.evidence_id=t.source_id)))
  select (select count(*) from opportunity_roots),(select count(*) from quote_roots),(select count(*) from assignment_rows),
    (select count(*) from quote_evidence_rows),(select count(*) from task_rows),jsonb_build_object('ok',true,
      'opportunity_facts',coalesce((select jsonb_agg(jsonb_build_object('opportunity_id',opportunity_id,'created_at',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'assigned_to',assigned_to,'deleted',deleted_at is not null,'archived',archived_at is not null,'status_id',status_id,'terminal',is_terminal) order by created_at,opportunity_id) from opportunity_roots),'[]'::jsonb),
      'quote_facts',coalesce((select jsonb_agg(jsonb_build_object('quote_version_id',quote_version_id,'quote_id',quote_id,'opportunity_id',opportunity_id,'sent_at',to_char(sent_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'owner_id',owner_id,'quote_deleted',quote_deleted_at is not null,'opportunity_deleted',opportunity_deleted_at is not null,'opportunity_archived',opportunity_archived_at is not null,'version_status',version_status) order by sent_at,quote_version_id) from quote_roots),'[]'::jsonb),
      'assignment_evidence',coalesce((select jsonb_agg(jsonb_build_object('event_id',event_id,'opportunity_id',opportunity_id,'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'event_type',event_type,'payload_valid',payload_valid,'assigned_to',case when payload_valid then assigned_to end,'status_id',case when payload_valid then status_id end,'status_terminal',status_terminal) order by occurred_at,event_id) from assignment_rows),'[]'::jsonb),
      'quote_source_evidence',coalesce((select jsonb_agg(jsonb_build_object('evidence_id',evidence_id,'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'kind',kind,'quote_version_id',quote_version_id,'quote_id',quote_id,'opportunity_id',opportunity_id,'accepted_quote_version_id',accepted_quote_version_id,'payment_status',payment_status,'payload_valid',payload_valid) order by occurred_at,evidence_id) from quote_evidence_rows),'[]'::jsonb),
      'owner_facts',coalesce((select jsonb_agg(to_jsonb(o) order by owner_id) from owner_rows o),'[]'::jsonb),
      'task_occupancy',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('created_at',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updated_at',to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'due_at',to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by created_at,id) from task_rows t),'[]'::jsonb),
      'automation_origins',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('anchor_at',to_char(anchor_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'created_at',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by created_at,origin_key) from origin_rows o),'[]'::jsonb),
      'automation_outcomes',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('created_at',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by created_at,outcome_key) from outcome_rows o),'[]'::jsonb),
      'automation_tombstones',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('created_at',to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by created_at,tombstone_key) from tombstone_rows t),'[]'::jsonb))
    into v_opportunity_count,v_quote_count,v_assignment_count,v_quote_evidence_count,v_occupancy_count,v_result;
  if v_opportunity_count<>(p_boundaries->>'opportunity_root_count')::integer or v_quote_count<>(p_boundaries->>'quote_version_root_count')::integer then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INCOMPLETE_JOIN','message','INCOMPLETE_JOIN'));
  end if;
  if v_assignment_count>20000 or v_quote_evidence_count>20000 or v_assignment_count+v_quote_evidence_count>40000 or v_occupancy_count>40000 then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED'));
  end if;
  if (select count(*)<>count(distinct value->>'evidence_id') from jsonb_array_elements(v_result->'quote_source_evidence') value) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','MALFORMED_ROW','message','MALFORMED_ROW'));
  end if;
  return v_result;
exception when others then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','QUERY_FAILED','message','QUERY_FAILED'));
end
$function$;

alter function public.task_automation_historical_hash(jsonb) owner to postgres;
alter function public.task_automation_historical_task_uuid(text) owner to postgres;
alter function public.read_task_automation_historical_boundaries(uuid) owner to postgres;
alter function public.read_task_automation_historical_sources(uuid,jsonb) owner to postgres;
revoke all on function public.task_automation_historical_hash(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.task_automation_historical_task_uuid(text) from public,anon,authenticated,service_role;
revoke all on function public.read_task_automation_historical_boundaries(uuid) from public,anon,authenticated,service_role;
revoke all on function public.read_task_automation_historical_sources(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.read_task_automation_historical_boundaries(uuid) to authenticated;
grant execute on function public.read_task_automation_historical_sources(uuid,jsonb) to authenticated;

commit;
