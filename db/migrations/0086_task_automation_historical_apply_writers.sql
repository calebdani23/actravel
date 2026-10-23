begin;

create or replace function public.task_automation_historical_write_generate(p_projection jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $function$
declare
  v_task_id uuid; v_owner_id uuid; v_opportunity_id uuid; v_quote_id uuid; v_quote_version_id uuid; v_sent_event_id uuid;
  v_source_id uuid; v_source_order bigint; v_anchor_at timestamptz; v_due_at timestamptz; v_origin_key text; v_expected text; v_max_order bigint;
  v_keys constant text[] := array['ordinal','action','operationSourceKind','operationSourceId','sourceKey','sourceOrder','originKey','taskId','taskKind','ownerId','opportunityId','quoteId','quoteVersionId','sentEventId','anchorAt','dueRuleVersion','dueAt','outcomeKey','tombstoneKey'];
begin
  if p_projection is null or jsonb_typeof(p_projection)<>'object' or not p_projection ?& v_keys or p_projection-v_keys<>'{}'::jsonb
    or jsonb_typeof(p_projection->'ordinal')<>'number' or p_projection->>'ordinal'!~'^(0|[1-9][0-9]{0,3})$' or (p_projection->>'ordinal')::numeric>3999
    or p_projection->>'action'<>'generate' or p_projection->>'operationSourceKind' not in ('opportunity_assignment','quote_sent')
    or p_projection->>'operationSourceId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_projection->>'sourceKey'!~'^[0-9a-f]{64}$' or jsonb_typeof(p_projection->'sourceOrder')<>'number'
    or p_projection->>'sourceOrder'!~'^[1-9][0-9]{0,9}$' or (p_projection->>'sourceOrder')::numeric>2147483647
    or p_projection->>'originKey'!~'^[0-9a-f]{64}$' or p_projection->>'outcomeKey'!~'^[0-9a-f]{64}$'
    or p_projection->>'taskId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_projection->>'ownerId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_projection->>'anchorAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
    or p_projection->>'dueAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
    or p_projection->'tombstoneKey'<>'null'::jsonb then raise exception 'invalid'; end if;
  v_task_id:=(p_projection->>'taskId')::uuid; v_owner_id:=(p_projection->>'ownerId')::uuid;
  v_source_id:=(p_projection->>'operationSourceId')::uuid; v_source_order:=(p_projection->>'sourceOrder')::bigint;
  v_anchor_at:=(p_projection->>'anchorAt')::timestamptz; v_due_at:=(p_projection->>'dueAt')::timestamptz; v_origin_key:=p_projection->>'originKey';
  if v_source_id::text<>p_projection->>'operationSourceId' or v_task_id::text<>p_projection->>'taskId' or v_owner_id::text<>p_projection->>'ownerId'
    or to_char(v_anchor_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>p_projection->>'anchorAt'
    or to_char(v_due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>p_projection->>'dueAt' then raise exception 'invalid'; end if;
  if p_projection->>'taskKind'='first_contact' then
    v_opportunity_id:=(p_projection->>'opportunityId')::uuid;
    if v_opportunity_id is null or v_opportunity_id::text<>p_projection->>'opportunityId' or p_projection->>'operationSourceKind'<>'opportunity_assignment' or v_source_id<>v_opportunity_id
      or p_projection->'quoteId'<>'null'::jsonb or p_projection->'quoteVersionId'<>'null'::jsonb or p_projection->'sentEventId'<>'null'::jsonb
      or p_projection->>'dueRuleVersion'<>'mx-calendar.v1' then raise exception 'invalid'; end if;
    v_expected:=public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',v_opportunity_id::text));
  elsif p_projection->>'taskKind'='quote_follow_up' then
    v_opportunity_id:=(p_projection->>'opportunityId')::uuid; v_quote_id:=(p_projection->>'quoteId')::uuid;
    v_quote_version_id:=(p_projection->>'quoteVersionId')::uuid; v_sent_event_id:=(p_projection->>'sentEventId')::uuid;
    if v_opportunity_id is null or v_opportunity_id::text<>p_projection->>'opportunityId' or v_quote_id::text<>p_projection->>'quoteId'
      or v_quote_version_id::text<>p_projection->>'quoteVersionId' or v_sent_event_id::text<>p_projection->>'sentEventId'
      or p_projection->>'operationSourceKind'<>'quote_sent' or v_source_id<>v_sent_event_id or p_projection->>'dueRuleVersion'<>'elapsed-48h.v1' then raise exception 'invalid'; end if;
    v_expected:=public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','quote_follow_up',v_quote_version_id::text,v_sent_event_id::text));
  else raise exception 'invalid'; end if;
  if v_origin_key<>v_expected or v_task_id<>public.task_automation_historical_task_uuid(v_origin_key)
    or v_due_at<>public.task_automation_due_at(p_projection->>'taskKind',v_anchor_at,p_projection->>'dueRuleVersion')
    or p_projection->>'outcomeKey'<>public.task_automation_historical_hash(jsonb_build_array('task-automation-outcome.v1',p_projection->>'operationSourceKind',v_source_id::text,p_projection->>'sourceKey','generate',v_origin_key)) then raise exception 'invalid'; end if;
  select coalesce(max(source_order),0) into v_max_order from (select source_order from public.task_automation_outcomes where origin_key=v_origin_key union all select source_order from public.task_automation_tombstones where origin_key=v_origin_key) value;
  if v_max_order=2147483647 or v_source_order<>v_max_order+1
    or exists(select 1 from public.tasks where id=v_task_id or idempotency_key=v_origin_key or automation_origin_key=v_origin_key)
    or exists(select 1 from public.task_automation_origins where origin_key=v_origin_key or opportunity_id is not distinct from v_opportunity_id and p_projection->>'taskKind'='first_contact' or quote_version_id is not distinct from v_quote_version_id and v_quote_version_id is not null)
    or exists(select 1 from public.task_automation_outcomes where outcome_key=p_projection->>'outcomeKey' or (source_kind,source_id,source_key,source_order)=(p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order))
    or exists(select 1 from public.task_automation_tombstones where origin_key=v_origin_key or (source_kind,source_id,source_key,source_order)=(p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order)) then raise exception 'occupied'; end if;
  insert into public.tasks(id,owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,automation_origin_key)
    values(v_task_id,v_owner_id,case when p_projection->>'taskKind'='first_contact' then v_opportunity_id end,v_quote_id,case p_projection->>'taskKind' when 'first_contact' then 'Complete first contact' else 'Follow up on quote version' end,v_due_at,'pending',v_origin_key,p_projection->>'taskKind',v_origin_key);
  insert into public.task_automation_origins(origin_key,task_kind,source_kind,operation,opportunity_id,quote_version_id,sent_event_id,anchor_at,due_rule_version,task_id)
    values(v_origin_key,p_projection->>'taskKind',p_projection->>'operationSourceKind','generate',case when p_projection->>'taskKind'='first_contact' then v_opportunity_id end,v_quote_version_id,v_sent_event_id,v_anchor_at,p_projection->>'dueRuleVersion',v_task_id);
  insert into public.task_automation_outcomes(outcome_key,source_kind,source_id,source_key,source_order,operation,origin_key,task_id,outcome,reason)
    values(p_projection->>'outcomeKey',p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order,'generate',v_origin_key,v_task_id,'applied',null);
  return jsonb_build_object('taskId',v_task_id::text,'originKey',v_origin_key,'outcomeKey',p_projection->>'outcomeKey');
exception when others then raise exception using errcode='P0001',message='TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE';
end
$function$;

create or replace function public.task_automation_historical_write_suppress(p_projection jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $function$
declare
  v_source_id uuid; v_source_order bigint; v_opportunity_id uuid; v_quote_id uuid; v_quote_version_id uuid; v_sent_event_id uuid; v_origin_key text; v_expected text; v_max_order bigint;
  v_keys constant text[] := array['ordinal','action','operationSourceKind','operationSourceId','sourceKey','sourceOrder','originKey','taskId','taskKind','ownerId','opportunityId','quoteId','quoteVersionId','sentEventId','anchorAt','dueRuleVersion','dueAt','outcomeKey','tombstoneKey'];
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if p_projection is null or jsonb_typeof(p_projection)<>'object' or not p_projection ?& v_keys or p_projection-v_keys<>'{}'::jsonb
    or jsonb_typeof(p_projection->'ordinal')<>'number' or p_projection->>'ordinal'!~'^(0|[1-9][0-9]{0,3})$' or (p_projection->>'ordinal')::numeric>3999 or p_projection->>'action'<>'suppress'
    or p_projection->>'operationSourceKind' not in ('opportunity_unassigned','opportunity_archived','opportunity_terminal','quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded','whatsapp_inbound','payment_verified')
    or p_projection->>'operationSourceId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_projection->>'sourceKey'!~'^[0-9a-f]{64}$' or jsonb_typeof(p_projection->'sourceOrder')<>'number' or p_projection->>'sourceOrder'!~'^[1-9][0-9]{0,9}$' or (p_projection->>'sourceOrder')::numeric>2147483647
    or p_projection->>'originKey'!~'^[0-9a-f]{64}$' or p_projection->>'outcomeKey'!~'^[0-9a-f]{64}$' or p_projection->>'tombstoneKey'!~'^[0-9a-f]{64}$'
    or exists(select 1 from jsonb_each(p_projection) value where value.key in ('taskId','taskKind','ownerId','anchorAt','dueRuleVersion','dueAt') and value.value<>'null'::jsonb) then raise exception 'invalid'; end if;
  v_source_id:=(p_projection->>'operationSourceId')::uuid; v_source_order:=(p_projection->>'sourceOrder')::bigint; v_origin_key:=p_projection->>'originKey';
  if v_source_id::text<>p_projection->>'operationSourceId' then raise exception 'invalid'; end if;
  if p_projection->>'operationSourceKind' like 'opportunity_%' then
    v_opportunity_id:=(p_projection->>'opportunityId')::uuid;
    if v_opportunity_id is null or v_opportunity_id::text<>p_projection->>'opportunityId' or p_projection->'quoteId'<>'null'::jsonb or p_projection->'quoteVersionId'<>'null'::jsonb or p_projection->'sentEventId'<>'null'::jsonb then raise exception 'invalid'; end if;
    v_expected:=public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','first_contact',v_opportunity_id::text));
  else
    if p_projection->>'opportunityId' is null or p_projection->>'opportunityId' !~ v_uuid_pattern
      or p_projection->>'quoteId' is null or p_projection->>'quoteId' !~ v_uuid_pattern
      or p_projection->>'quoteVersionId' is null or p_projection->>'quoteVersionId' !~ v_uuid_pattern
      or p_projection->>'sentEventId' is null or p_projection->>'sentEventId' !~ v_uuid_pattern then raise exception 'invalid'; end if;
    v_opportunity_id:=(p_projection->>'opportunityId')::uuid; v_quote_id:=(p_projection->>'quoteId')::uuid;
    v_quote_version_id:=(p_projection->>'quoteVersionId')::uuid; v_sent_event_id:=(p_projection->>'sentEventId')::uuid;
    if v_opportunity_id::text is distinct from p_projection->>'opportunityId' or v_quote_id::text is distinct from p_projection->>'quoteId'
      or v_quote_version_id::text is distinct from p_projection->>'quoteVersionId' or v_sent_event_id::text is distinct from p_projection->>'sentEventId' then raise exception 'invalid'; end if;
    v_expected:=public.task_automation_historical_hash(jsonb_build_array('task-automation:v1','quote_follow_up',v_quote_version_id::text,v_sent_event_id::text));
  end if;
  if v_origin_key<>v_expected
    or p_projection->>'outcomeKey'<>public.task_automation_historical_hash(jsonb_build_array('task-automation-outcome.v1',p_projection->>'operationSourceKind',v_source_id::text,p_projection->>'sourceKey','suppress',v_origin_key))
    or p_projection->>'tombstoneKey'<>public.task_automation_historical_hash(jsonb_build_array('task-automation-tombstone.v1',p_projection->>'operationSourceKind',v_source_id::text,p_projection->>'sourceKey',v_source_order,v_origin_key,'source_invalidated')) then raise exception 'invalid'; end if;
  select coalesce(max(source_order),0) into v_max_order from (select source_order from public.task_automation_outcomes where origin_key=v_origin_key union all select source_order from public.task_automation_tombstones where origin_key=v_origin_key) value;
  if v_max_order=2147483647 or v_source_order<>v_max_order+1 or exists(select 1 from public.tasks where idempotency_key=v_origin_key or automation_origin_key=v_origin_key)
    or exists(select 1 from public.task_automation_origins where origin_key=v_origin_key or opportunity_id is not distinct from v_opportunity_id and p_projection->>'operationSourceKind' like 'opportunity_%' or quote_version_id is not distinct from v_quote_version_id and v_quote_version_id is not null)
    or exists(select 1 from public.task_automation_outcomes where outcome_key=p_projection->>'outcomeKey' or (source_kind,source_id,source_key,source_order)=(p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order))
    or exists(select 1 from public.task_automation_tombstones where tombstone_key=p_projection->>'tombstoneKey' or origin_key=v_origin_key or (source_kind,source_id,source_key,source_order)=(p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order)) then raise exception 'occupied'; end if;
  insert into public.task_automation_tombstones(tombstone_key,source_kind,source_id,source_key,source_order,origin_key,reason)
    values(p_projection->>'tombstoneKey',p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order,v_origin_key,'source_invalidated');
  insert into public.task_automation_outcomes(outcome_key,source_kind,source_id,source_key,source_order,operation,origin_key,task_id,outcome,reason)
    values(p_projection->>'outcomeKey',p_projection->>'operationSourceKind',v_source_id,p_projection->>'sourceKey',v_source_order,'suppress',v_origin_key,null,'applied',null);
  return jsonb_build_object('outcomeKey',p_projection->>'outcomeKey','tombstoneKey',p_projection->>'tombstoneKey');
exception when others then raise exception using errcode='P0001',message='TASK_AUTOMATION_HISTORICAL_WRITE_INTEGRITY_FAILURE';
end
$function$;

alter function public.task_automation_historical_write_generate(jsonb) owner to postgres;
alter function public.task_automation_historical_write_suppress(jsonb) owner to postgres;
revoke all on function public.task_automation_historical_write_generate(jsonb),public.task_automation_historical_write_suppress(jsonb) from public,anon,authenticated,service_role;

commit;
