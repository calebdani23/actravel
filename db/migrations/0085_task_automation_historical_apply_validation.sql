begin;

create or replace function public.task_automation_historical_universe_guard() returns trigger
language plpgsql volatile security invoker set search_path='' as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(3825938359965795805);
  return null;
end
$function$;

create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.contacts for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.leads for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.lead_statuses for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.lead_events for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.quotes for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.quote_versions for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.quote_events for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.payments for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.profiles for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.profile_roles for each statement execute function public.task_automation_historical_universe_guard();
create trigger task_automation_historical_universe_guard before insert or update or delete or truncate on public.roles for each statement execute function public.task_automation_historical_universe_guard();

create or replace function public.task_automation_historical_revalidate_plan(p_value public.task_automation_historical_approvals) returns text
language plpgsql volatile security definer set search_path='' as $function$
declare
  v_opportunity_cutoff timestamptz; v_quote_cutoff timestamptz; v_cutoff_count bigint;
  v_opportunity_count bigint; v_quote_count bigint; value jsonb;
begin
  if not public.validate_task_automation_historical_approval(p_value) then return 'APPROVAL_INTEGRITY_FAILURE'; end if;
  select count(*),min(cutoff_at) filter(where source_kind='opportunity_assignment'),min(cutoff_at) filter(where source_kind='quote_sent')
    into v_cutoff_count,v_opportunity_cutoff,v_quote_cutoff from public.task_automation_source_cutoffs;
  if v_cutoff_count<>2 or to_char(v_opportunity_cutoff at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>p_value.source_cutoffs->>'opportunityAssignment'
    or to_char(v_quote_cutoff at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>p_value.source_cutoffs->>'quoteSent' then return 'STALE_PLAN_INTEGRITY'; end if;
  select count(*) into v_opportunity_count from public.leads where created_at<v_opportunity_cutoff;
  select count(*) into v_quote_count from public.quote_versions where sent_at is not null and sent_at<v_quote_cutoff;
  if v_opportunity_count>2000 or v_quote_count>2000 or v_opportunity_count+v_quote_count>4000 then return 'LIMIT_EXCEEDED'; end if;
  if v_opportunity_count<>(select count(*) from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='opportunity_assignment')
    or v_quote_count<>(select count(*) from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='quote_sent')
    or exists(select * from (select 'opportunity_assignment' kind,id::text root from public.leads where created_at<v_opportunity_cutoff
      union all select 'quote_sent',id::text from public.quote_versions where sent_at is not null and sent_at<v_quote_cutoff) current_roots
      except select r->>'sourceKind',r->>'rootId' from jsonb_array_elements(p_value.plan->'rows') r)
    or exists(select r->>'sourceKind',r->>'rootId' from jsonb_array_elements(p_value.plan->'rows') r except
      select * from (select 'opportunity_assignment' kind,id::text root from public.leads where created_at<v_opportunity_cutoff
      union all select 'quote_sent',id::text from public.quote_versions where sent_at is not null and sent_at<v_quote_cutoff) current_roots)
    then return 'STALE_PLAN_INTEGRITY'; end if;

  for value in select r from jsonb_array_elements(p_value.plan->'rows') r where r->>'operationSourceKind' is not null loop
    if value->>'sourceKind'='opportunity_assignment' and value->>'operationSourceKind'='opportunity_assignment' and not exists(
      select 1 from public.leads l join lateral (select e.created_at,e.payload from public.lead_events e where e.lead_id=l.id and e.event_type='assigned'
        and e.payload ? 'assignedTo' and e.payload-array['assignedTo']='{}'::jsonb and e.payload->>'assignedTo'~'^[0-9a-f-]{36}$' order by e.created_at,e.id limit 1) e on true
      where l.id=(value->>'rootId')::uuid and value->>'sourceId'=l.id::text and value->>'operationSourceId'=l.id::text
        and value->>'ownerId'=e.payload->>'assignedTo' and (value->>'anchorAt')::timestamptz=greatest(l.created_at,e.created_at)
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','opportunity_assignment',l.id::text,e.payload->>'assignedTo',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')))
    ) then return 'STALE_PLAN_INTEGRITY'; end if;
    if value->>'sourceKind'='quote_sent' and not exists(
      select 1 from public.quote_versions v join public.quotes q on q.id=v.quote_id and q.lead_id=v.lead_id
      join lateral (select e.id from public.quote_events e where e.quote_version_id=v.id and e.event_type='quote_sent' order by e.created_at,e.id limit 1) e on true
      where v.id=(value->>'rootId')::uuid and value->>'sourceId'=e.id::text and value->>'sentEventId'=e.id::text
        and value->>'quoteId'=q.id::text and value->>'opportunityId'=v.lead_id::text and (value->>'anchorAt')::timestamptz=v.sent_at
    ) then return 'STALE_PLAN_INTEGRITY'; end if;
    if value->>'operationSourceKind' not in ('opportunity_assignment','quote_sent') and not (
      value->>'operationSourceKind'='opportunity_unassigned' and exists(select 1 from public.lead_events e where e.lead_id=(value->>'rootId')::uuid and e.event_type='assigned' and e.payload=jsonb_build_object('assignedTo',null)
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','opportunity_unassigned',e.lead_id::text,to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))))
      or value->>'operationSourceKind'='opportunity_terminal' and exists(select 1 from public.lead_events e join public.lead_statuses s on s.id::text=e.payload->>'statusId' and s.is_terminal where e.lead_id=(value->>'rootId')::uuid and e.event_type='status_changed'
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','opportunity_terminal',e.lead_id::text,to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))))
      or value->>'operationSourceKind'='quote_version_response' and exists(select 1 from public.quote_events e where e.id=(value->>'operationSourceId')::uuid and e.quote_version_id=(value->>'rootId')::uuid and e.event_type='quote_version_response'
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','quote_version_response',e.quote_version_id::text,e.id::text)))
      or value->>'operationSourceKind' in ('quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded') and exists(select 1 from public.quote_versions v where v.id=(value->>'rootId')::uuid and 'quote_'||v.status=value->>'operationSourceKind'
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1',value->>'operationSourceKind',v.id::text,v.status)))
      or value->>'operationSourceKind'='whatsapp_inbound' and exists(select 1 from public.lead_events e where e.id=(value->>'operationSourceId')::uuid and e.lead_id=(value->>'opportunityId')::uuid and e.event_type='whatsapp_inbound_received'
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','whatsapp_inbound',e.id::text,e.lead_id::text,value->>'quoteVersionId')))
      or value->>'operationSourceKind'='payment_verified' and exists(select 1 from public.payments p where p.id=(value->>'operationSourceId')::uuid and p.status='verified' and p.accepted_quote_version_id=(value->>'rootId')::uuid
        and value->>'sourceKey'=public.task_automation_historical_hash(jsonb_build_array('task-automation-source.v1','payment_verified',p.id::text,p.accepted_quote_version_id::text)))
    ) then return 'STALE_PLAN_INTEGRITY'; end if;
  end loop;
  return null;
end
$function$;

create or replace function public.task_automation_historical_revalidate_live(p_value public.task_automation_historical_approvals) returns text
language plpgsql volatile security definer set search_path='' as $function$
declare
  v_projection jsonb; v_row jsonb; v_lock bigint; v_origin text; v_sent uuid; v_first_id uuid; v_first_at timestamptz;
  v_task_count bigint; v_origin_count bigint; v_outcome_count bigint; v_tombstone_count bigint; v_max_order bigint;
  v_exact_projected boolean; v_exact_suppressed boolean; v_duplicate boolean; v_contradictory boolean; v_invalidation boolean; v_ambiguous boolean;
  v_operational boolean; v_terminal boolean; v_due_supported boolean; v_owner_reason text; v_proof_reason text; v_expected_disposition text; v_expected_reason text;
  v_lead public.leads%rowtype; v_version public.quote_versions%rowtype; v_quote public.quotes%rowtype;
begin
  if not public.validate_task_automation_historical_approval(p_value) then return 'APPROVAL_INTEGRITY_FAILURE'; end if;
  for v_lock in select lock_id from (select distinct on(lock_id) lock_id,full_key from (select (('x'||substr(value->>'sourceKey',1,16))::bit(64)::bigint) lock_id,value->>'sourceKey' full_key from jsonb_array_elements(p_value.plan->'rows') value where value->>'sourceKey' is not null) raw order by lock_id,full_key collate "C") unique_locks order by full_key collate "C" loop perform pg_catalog.pg_advisory_xact_lock(v_lock); end loop;
  for v_lock in select lock_id from (select distinct on(lock_id) lock_id,full_key from (select (('x'||substr(origin_key,1,16))::bit(64)::bigint) lock_id,origin_key full_key from (select coalesce(value->>'originKey',case when value->>'sourceKind'='opportunity_assignment' then public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',value->>'rootId')) when value->>'sentEventId' is not null then public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','quote_follow_up',value->>'rootId',value->>'sentEventId')) end) origin_key from jsonb_array_elements(p_value.plan->'rows') value) values where origin_key is not null) raw order by lock_id,full_key collate "C") unique_locks order by full_key collate "C" loop perform pg_catalog.pg_advisory_xact_lock(v_lock); end loop;
  for v_lock in select lock_id from (select distinct on(lock_id) lock_id,full_key from (select (('x'||substr(public.task_automation_historical_hash(jsonb_build_array('task-automation-historical-lock.v1','task',task_id)),1,16))::bit(64)::bigint) lock_id,task_id full_key from (select coalesce(value->>'taskId',case when value->>'sourceKind'='opportunity_assignment' then public.task_automation_historical_task_uuid(public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',value->>'rootId')))::text when value->>'sentEventId' is not null then public.task_automation_historical_task_uuid(public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','quote_follow_up',value->>'rootId',value->>'sentEventId')))::text end) task_id from jsonb_array_elements(p_value.plan->'rows') value) values where task_id is not null) raw order by lock_id,full_key collate "C") unique_locks order by full_key collate "C" loop perform pg_catalog.pg_advisory_xact_lock(v_lock); end loop;
  perform 1 from public.tasks t where t.id in (select coalesce((r->>'taskId')::uuid,case when r->>'sourceKind'='opportunity_assignment' then public.task_automation_historical_task_uuid(public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',r->>'rootId'))) end) from jsonb_array_elements(p_value.plan->'rows') r)
    or t.lead_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='opportunity_assignment') or t.quote_id in (select (r->>'quoteId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'quoteId' is not null) order by t.id for update;
  perform 1 from public.task_automation_origins o where o.origin_key in (select r->>'originKey' from jsonb_array_elements(p_value.plan->'rows') r where r->>'originKey' is not null) or o.opportunity_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='opportunity_assignment') or o.quote_version_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='quote_sent') order by o.origin_key for update;
  perform 1 from public.task_automation_outcomes o where o.origin_key in (select origin_key from public.task_automation_origins x where x.opportunity_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='opportunity_assignment') or x.quote_version_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='quote_sent') union select r->>'originKey' from jsonb_array_elements(p_value.plan->'rows') r where r->>'originKey' is not null) order by o.outcome_key for update;
  perform 1 from public.task_automation_tombstones t where t.origin_key in (select origin_key from public.task_automation_origins x where x.opportunity_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='opportunity_assignment') or x.quote_version_id in (select (r->>'rootId')::uuid from jsonb_array_elements(p_value.plan->'rows') r where r->>'sourceKind'='quote_sent') union select r->>'originKey' from jsonb_array_elements(p_value.plan->'rows') r where r->>'originKey' is not null) order by t.tombstone_key for update;
  for v_row in select r from jsonb_array_elements(p_value.plan->'rows') r where r->>'action' is null loop
    v_first_id:=null; v_first_at:=null; v_sent:=null; v_owner_reason:=null; v_proof_reason:=null; v_invalidation:=false; v_ambiguous:=false;
    v_exact_projected:=false; v_exact_suppressed:=false; v_contradictory:=false; v_due_supported:=false;
    if v_row->>'sourceKind'='opportunity_assignment' then
      select * into v_lead from public.leads where id=(v_row->>'rootId')::uuid;
      if not found or v_row->>'sourceId' is distinct from v_lead.id::text or v_row->>'opportunityId' is distinct from v_lead.id::text then return 'STALE_PLAN_INTEGRITY'; end if;
      v_origin:=public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',v_lead.id::text));
      select e.id,e.created_at into v_first_id,v_first_at from public.lead_events e where e.lead_id=v_lead.id and e.event_type='assigned' and e.payload ? 'assignedTo' and e.payload-array['assignedTo']='{}'::jsonb and e.payload->>'assignedTo'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' order by e.created_at,e.id limit 1;
      select exists(select 1 from public.lead_events e where e.lead_id=v_lead.id and e.event_type='assigned' and (not(e.payload ? 'assignedTo') or e.payload-array['assignedTo']<>'{}'::jsonb or not(e.payload->'assignedTo'='null'::jsonb or e.payload->>'assignedTo'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') or e.created_at<v_lead.created_at))
        or exists(select 1 from public.lead_events a join public.lead_events b on b.lead_id=a.lead_id and b.event_type='assigned' and b.id>a.id and b.created_at=a.created_at where a.lead_id=v_lead.id and a.event_type='assigned' and a.payload->'assignedTo' is distinct from b.payload->'assignedTo')
        or (select case when e.payload->'assignedTo'='null'::jsonb then null else e.payload->>'assignedTo' end from public.lead_events e where e.lead_id=v_lead.id and e.event_type='assigned' order by e.created_at desc,e.id desc limit 1) is distinct from v_lead.assigned_to::text into v_contradictory;
      v_proof_reason:=case when v_contradictory then 'ASSIGNMENT_EVIDENCE_CONTRADICTORY' when v_first_id is null then 'ASSIGNMENT_EVIDENCE_MISSING' end;
      if v_proof_reason is null and (v_row->>'anchorAt')::timestamptz is distinct from greatest(v_lead.created_at,v_first_at) or v_proof_reason is not null and v_row->'anchorAt'<>'null'::jsonb then return 'STALE_PLAN_INTEGRITY'; end if;
      if v_first_id is not null then select exists(select 1 from public.lead_events e where e.lead_id=v_lead.id and (e.event_type='assigned' and e.payload=jsonb_build_object('assignedTo',null) or e.event_type='status_changed' and exists(select 1 from public.lead_statuses s where s.id::text=e.payload->>'statusId' and s.is_terminal)) and (e.created_at,e.id)>(v_first_at,v_first_id)) into v_invalidation; end if;
      select s.is_terminal into v_terminal from public.lead_statuses s where s.id=v_lead.status_id; v_operational:=v_lead.deleted_at is null and v_lead.archived_at is null;
      if v_lead.assigned_to is null then v_owner_reason:='OWNER_UNASSIGNED';
      elsif not exists(select 1 from public.profiles p where p.id=v_lead.assigned_to) then v_owner_reason:='PROFILE_MISSING';
      elsif not exists(select 1 from public.profiles p where p.id=v_lead.assigned_to and p.is_active) then v_owner_reason:='PROFILE_INACTIVE';
      elsif not exists(select 1 from public.profile_roles pr where pr.profile_id=v_lead.assigned_to) or exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=v_lead.assigned_to and r.name not in ('admin','manager','asesor')) then v_owner_reason:='ROLE_INVALID'; end if;
      v_due_supported:=v_first_at is not null and public.task_automation_due_at('first_contact',greatest(v_lead.created_at,v_first_at),'mx-calendar.v1') is not null;
      select count(*) into v_task_count from public.tasks t where t.task_kind='first_contact' and t.lead_id=v_lead.id or t.id=public.task_automation_historical_task_uuid(v_origin) or t.idempotency_key=v_origin or t.automation_origin_key=v_origin;
      select count(*) into v_origin_count from public.task_automation_origins o where o.task_kind='first_contact' and o.opportunity_id=v_lead.id or o.origin_key=v_origin;
    else
      select * into v_version from public.quote_versions where id=(v_row->>'rootId')::uuid; if not found then return 'STALE_PLAN_INTEGRITY'; end if;
      select * into v_quote from public.quotes where id=v_version.quote_id and lead_id=v_version.lead_id; if not found then return 'STALE_PLAN_INTEGRITY'; end if;
      select e.id,e.created_at into v_sent,v_first_at from public.quote_events e where e.quote_version_id=v_version.id and e.event_type='quote_sent' order by e.created_at,e.id limit 1;
      v_contradictory:=exists(select 1 from public.quote_events e where e.quote_version_id=v_version.id and e.event_type='quote_sent' and (e.quote_id<>v_version.quote_id or e.lead_id<>v_version.lead_id));
      v_proof_reason:=case when v_contradictory then 'FIRST_SENT_EVENT_CONTRADICTORY' when v_sent is null then 'FIRST_SENT_EVENT_MISSING' end;
      if v_row->>'quoteVersionId' is distinct from v_version.id::text or v_row->>'quoteId' is distinct from v_quote.id::text or v_row->>'sentEventId' is distinct from v_sent::text or (v_row->>'anchorAt')::timestamptz is distinct from v_version.sent_at then return 'STALE_PLAN_INTEGRITY'; end if;
      v_origin:=case when v_sent is null then null else public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','quote_follow_up',v_version.id::text,v_sent::text)) end;
      v_operational:=v_quote.deleted_at is null and (select l.deleted_at is null and l.archived_at is null from public.leads l where l.id=v_version.lead_id); v_terminal:=v_version.status in ('accepted','rejected','expired','cancelled','superseded');
      v_invalidation:=exists(select 1 from public.quote_events e where e.quote_version_id=v_version.id and e.event_type in ('quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded')) or exists(select 1 from public.payments p where p.status='verified' and p.accepted_quote_version_id=v_version.id);
      v_ambiguous:=exists(select 1 from public.quote_events e where e.quote_version_id=v_version.id and (e.quote_id<>v_version.quote_id or e.lead_id<>v_version.lead_id)) or exists(select 1 from public.payments p where p.status='verified' and p.lead_id=v_version.lead_id and (p.accepted_quote_version_id is null or p.accepted_quote_version_id<>v_version.id));
      if v_quote.owner_id is null then v_owner_reason:='OWNER_UNASSIGNED'; elsif not exists(select 1 from public.profiles p where p.id=v_quote.owner_id) then v_owner_reason:='PROFILE_MISSING'; elsif not exists(select 1 from public.profiles p where p.id=v_quote.owner_id and p.is_active) then v_owner_reason:='PROFILE_INACTIVE'; elsif not exists(select 1 from public.profile_roles pr where pr.profile_id=v_quote.owner_id) or exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=v_quote.owner_id and r.name not in ('admin','manager','asesor')) then v_owner_reason:='ROLE_INVALID'; end if;
      v_due_supported:=pg_catalog.isfinite(v_version.sent_at+interval '48 hours');
      select count(*) into v_task_count from public.tasks t where t.task_kind='quote_follow_up' and t.quote_id=v_quote.id or v_origin is not null and (t.id=public.task_automation_historical_task_uuid(v_origin) or t.idempotency_key=v_origin or t.automation_origin_key=v_origin);
      select count(*) into v_origin_count from public.task_automation_origins o where o.task_kind='quote_follow_up' and o.quote_version_id=v_version.id or v_origin is not null and o.origin_key=v_origin;
    end if;
    select count(*),coalesce(max(source_order),0) into v_outcome_count,v_max_order from public.task_automation_outcomes where origin_key=v_origin;
    select count(*) into v_tombstone_count from public.task_automation_tombstones where origin_key=v_origin;
    v_duplicate:=v_task_count>1 or v_origin_count>1 or v_outcome_count>1 or v_tombstone_count>1 or exists(select 1 from (select source_order from public.task_automation_outcomes where origin_key=v_origin union all select source_order from public.task_automation_tombstones where origin_key=v_origin) orders group by source_order having count(*)>1);
    if v_row->>'disposition'='already/projected' then
      v_exact_projected:=v_task_count=1 and v_origin_count=1 and v_outcome_count=1 and v_tombstone_count=0
        and exists(select 1 from public.tasks t where t.id=(v_row->>'taskId')::uuid and t.owner_id=(v_row->>'ownerId')::uuid and t.lead_id is not distinct from (v_row->>'opportunityId')::uuid and t.quote_id is not distinct from (v_row->>'quoteId')::uuid and t.task_kind=v_row->>'taskKind' and t.description=case v_row->>'taskKind' when 'first_contact' then 'Complete first contact' else 'Follow up on quote version' end and t.due_at=(v_row->>'dueAt')::timestamptz and t.idempotency_key=v_row->>'originKey' and t.automation_origin_key=v_row->>'originKey')
        and exists(select 1 from public.task_automation_origins o where o.origin_key=v_row->>'originKey' and o.task_id=(v_row->>'taskId')::uuid and o.task_kind=v_row->>'taskKind' and o.source_kind=v_row->>'operationSourceKind' and o.operation='generate' and o.anchor_at=(v_row->>'anchorAt')::timestamptz and o.due_rule_version=v_row->>'dueRuleVersion')
        and exists(select 1 from public.task_automation_outcomes o where o.outcome_key=v_row->>'outcomeKey' and o.source_kind=v_row->>'operationSourceKind' and o.source_id=(v_row->>'operationSourceId')::uuid and o.source_key=v_row->>'sourceKey' and o.source_order=(v_row->>'sourceOrder')::bigint and o.operation='generate' and o.origin_key=v_row->>'originKey' and o.task_id=(v_row->>'taskId')::uuid and o.outcome='applied' and o.reason is null);
    elsif v_row->>'disposition'='already/suppressed' then
      v_exact_suppressed:=v_task_count=0 and v_origin_count=0 and v_outcome_count=1 and v_tombstone_count=1 and v_invalidation
        and exists(select 1 from public.task_automation_outcomes o where o.outcome_key=v_row->>'outcomeKey' and o.source_kind=v_row->>'operationSourceKind' and o.source_id=(v_row->>'operationSourceId')::uuid and o.source_key=v_row->>'sourceKey' and o.source_order=(v_row->>'sourceOrder')::bigint and o.operation='suppress' and o.origin_key=v_row->>'originKey' and o.task_id is null and o.outcome='applied' and o.reason is null)
        and exists(select 1 from public.task_automation_tombstones t where t.tombstone_key=v_row->>'tombstoneKey' and t.source_kind=v_row->>'operationSourceKind' and t.source_id=(v_row->>'operationSourceId')::uuid and t.source_key=v_row->>'sourceKey' and t.source_order=(v_row->>'sourceOrder')::bigint and t.origin_key=v_row->>'originKey' and t.reason='source_invalidated');
    end if;
    if v_duplicate then v_expected_disposition:='collision/manual-review'; v_expected_reason:='DUPLICATE_SOURCE_STATE';
    elsif v_exact_projected then v_expected_disposition:='already/projected'; v_expected_reason:='ALREADY_PROJECTED';
    elsif v_exact_suppressed then v_expected_disposition:='already/suppressed'; v_expected_reason:='ALREADY_SUPPRESSED';
    elsif v_task_count+v_origin_count+v_outcome_count+v_tombstone_count>0 then v_expected_disposition:='collision/manual-review'; v_expected_reason:=case when v_task_count>0 then 'IDENTITY_OCCUPIED' else 'STATE_MISMATCH' end;
    elsif not v_operational then v_expected_disposition:='excluded/not-actionable'; v_expected_reason:=case v_row->>'sourceKind' when 'opportunity_assignment' then 'OPPORTUNITY_NOT_OPERATIONAL' else 'QUOTE_NOT_OPERATIONAL' end;
    elsif v_proof_reason is not null then v_expected_disposition:='manual-review/context-invalid'; v_expected_reason:=v_proof_reason;
    elsif v_invalidation then v_expected_disposition:='apply/suppress'; v_expected_reason:='SOURCE_INVALIDATED';
    elsif v_ambiguous then v_expected_disposition:='manual-review/context-invalid'; v_expected_reason:='SOURCE_AMBIGUOUS';
    elsif v_terminal then v_expected_disposition:='manual-review/context-invalid'; v_expected_reason:='INVALIDATION_EVIDENCE_MISSING';
    elsif v_owner_reason is not null then v_expected_disposition:='manual-review/owner-invalid'; v_expected_reason:=v_owner_reason;
    elsif not v_due_supported then v_expected_disposition:='manual-review/context-invalid'; v_expected_reason:='DUE_UNSUPPORTED';
    elsif v_max_order=2147483647 then v_expected_disposition:='collision/manual-review'; v_expected_reason:='SOURCE_ORDER_EXHAUSTED';
    else v_expected_disposition:='apply/generate'; v_expected_reason:='ELIGIBLE_GENERATE'; end if;
    if (v_row->>'disposition',v_row->>'reason') is distinct from (v_expected_disposition,v_expected_reason) then return 'STALE_PLAN_INTEGRITY'; end if;
  end loop;
  for v_projection in select r from jsonb_array_elements(p_value.projections) r where r->>'action'='generate' loop
    if not exists(select 1 from public.profiles p where p.id=(v_projection->>'ownerId')::uuid and p.is_active
      and exists(select 1 from public.profile_roles pr where pr.profile_id=p.id)
      and not exists(select 1 from public.profile_roles pr join public.roles role on role.id=pr.role_id where pr.profile_id=p.id and role.name not in ('admin','manager','asesor'))) then return 'STALE_LIVE_CONTEXT'; end if;
    if v_projection->>'taskKind'='first_contact' and not exists(select 1 from public.leads l join public.lead_statuses s on s.id=l.status_id
      where l.id=(v_projection->>'opportunityId')::uuid and l.assigned_to=(v_projection->>'ownerId')::uuid and l.deleted_at is null and l.archived_at is null and not s.is_terminal)
      then return 'STALE_LIVE_CONTEXT'; end if;
    if v_projection->>'taskKind'='quote_follow_up' and not exists(select 1 from public.quote_versions v join public.quotes q on q.id=v.quote_id and q.lead_id=v.lead_id join public.leads l on l.id=v.lead_id
      where v.id=(v_projection->>'quoteVersionId')::uuid and q.id=(v_projection->>'quoteId')::uuid and l.id=(v_projection->>'opportunityId')::uuid and q.owner_id=(v_projection->>'ownerId')::uuid
        and q.deleted_at is null and l.deleted_at is null and l.archived_at is null and v.status='sent' and v.sent_at=(v_projection->>'anchorAt')::timestamptz)
      then return 'STALE_LIVE_CONTEXT'; end if;
  end loop;
  return null;
end
$function$;

alter function public.task_automation_historical_universe_guard() owner to postgres;
alter function public.task_automation_historical_revalidate_plan(public.task_automation_historical_approvals) owner to postgres;
alter function public.task_automation_historical_revalidate_live(public.task_automation_historical_approvals) owner to postgres;
revoke all on function public.task_automation_historical_universe_guard() from public,anon,authenticated,service_role;
revoke all on function public.task_automation_historical_revalidate_plan(public.task_automation_historical_approvals) from public,anon,authenticated,service_role;
revoke all on function public.task_automation_historical_revalidate_live(public.task_automation_historical_approvals) from public,anon,authenticated,service_role;

commit;
