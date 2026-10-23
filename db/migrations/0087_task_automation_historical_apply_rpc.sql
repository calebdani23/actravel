begin;

create or replace function public.apply_task_automation_historical_plan(p_request_id_text text,p_expected_actor_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $function$
declare
  v_actor uuid:=auth.uid(); v_request_id uuid; v_code text; v_projection jsonb; v_written jsonb; v_result jsonb; v_stage text:='approval';
  v_approval public.task_automation_historical_approvals%rowtype; v_receipt public.task_automation_historical_apply_receipts%rowtype;
  v_task_ids uuid[]:=array[]::uuid[]; v_origin_keys text[]:=array[]::text[]; v_outcome_keys text[]:=array[]::text[]; v_tombstone_keys text[]:=array[]::text[];
begin
  if v_actor is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_REQUIRED','message','AUTH_REQUIRED')); end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INACTIVE','message','AUTH_INACTIVE')); end if;
  if not exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=v_actor and r.name='admin') then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_NOT_ADMIN','message','AUTH_NOT_ADMIN')); end if;
  if v_actor is distinct from p_expected_actor_id then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_ACTOR_MISMATCH','message','AUTH_ACTOR_MISMATCH')); end if;
  if p_request_id_text is null or p_request_id_text!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST')); end if;
  begin v_request_id:=p_request_id_text::uuid; exception when others then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST')); end;
  if v_request_id::text<>p_request_id_text then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST')); end if;

  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(public.task_automation_historical_hash(jsonb_build_array('task-automation-historical-lock.v1','request',p_request_id_text)),1,16))::bit(64)::bigint));
  select * into v_receipt from public.task_automation_historical_apply_receipts value where value.request_id=v_request_id for update;
  if found then
    if v_receipt.actor_id<>v_actor then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPLY_IDEMPOTENCY_CONFLICT','message','APPLY_IDEMPOTENCY_CONFLICT')); end if;
    if not public.validate_task_automation_historical_apply_receipt(v_receipt) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPLY_RECEIPT_INTEGRITY_FAILURE','message','APPLY_RECEIPT_INTEGRITY_FAILURE')); end if;
    return jsonb_build_object('ok',true,'status','replayed')||(to_jsonb(v_receipt)-'created_at')||jsonb_build_object('created_at',to_char(v_receipt.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  end if;
  select * into v_approval from public.task_automation_historical_approvals value where value.request_id=v_request_id for update;
  if not found or v_approval.actor_id<>v_actor then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPROVAL_NOT_FOUND','message','APPROVAL_NOT_FOUND')); end if;
  if not public.validate_task_automation_historical_approval(v_approval) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPROVAL_INTEGRITY_FAILURE','message','APPROVAL_INTEGRITY_FAILURE')); end if;
  if exists(select 1 from jsonb_array_elements(v_approval.projections) p where
      p->>'originKey'<>public.task_automation_historical_hash(case when p->>'operationSourceKind' like 'opportunity_%' then jsonb_build_array('task-automation:v1','first_contact',p->>'opportunityId') else jsonb_build_array('task-automation:v1','quote_follow_up',p->>'quoteVersionId',p->>'sentEventId') end)
      or p->>'action'='generate' and (p->>'taskId')::uuid<>public.task_automation_historical_task_uuid(p->>'originKey')
      or p->>'outcomeKey'<>public.task_automation_historical_hash(jsonb_build_array('task-automation-outcome.v1',p->>'operationSourceKind',p->>'operationSourceId',p->>'sourceKey',p->>'action',p->>'originKey'))
      or p->>'action'='suppress' and p->>'tombstoneKey'<>public.task_automation_historical_hash(jsonb_build_array('task-automation-tombstone.v1',p->>'operationSourceKind',p->>'operationSourceId',p->>'sourceKey',(p->>'sourceOrder')::bigint,p->>'originKey','source_invalidated'))
      or p->>'operationSourceKind' like 'opportunity_%' and p->>'operationSourceId'<>p->>'opportunityId'
      or p->>'operationSourceKind'='quote_sent' and p->>'operationSourceId'<>p->>'sentEventId'
      or p->>'operationSourceKind' in ('quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded') and p->>'operationSourceId'<>p->>'quoteVersionId')
    or (select count(*)<>count(distinct p->>'originKey') or count(*)<>count(distinct p->>'outcomeKey') from jsonb_array_elements(v_approval.projections) p)
    or (select count(*)<>count(distinct p->>'taskId') from jsonb_array_elements(v_approval.projections) p where p->>'action'='generate')
    or (select count(*)<>count(distinct p->>'tombstoneKey') from jsonb_array_elements(v_approval.projections) p where p->>'action'='suppress') then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPROVAL_INTEGRITY_FAILURE','message','APPROVAL_INTEGRITY_FAILURE'));
  end if;

  perform pg_catalog.pg_advisory_xact_lock(3825938359965795805);
  v_code:=public.task_automation_historical_revalidate_plan(v_approval);
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;
  v_code:=public.task_automation_historical_revalidate_live(v_approval);
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;

  v_stage:='context';
  perform 1 from public.contacts c where c.id in (select l.contact_id from public.leads l where l.id in (select (r->>'opportunityId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'opportunityId' is not null)) order by c.id for update nowait;
  perform 1 from public.lead_events e where e.lead_id in (select (r->>'opportunityId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'opportunityId' is not null) order by e.id for update nowait;
  perform 1 from public.lead_statuses s where s.id in (select l.status_id from public.leads l where l.id in (select (r->>'opportunityId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'opportunityId' is not null)) order by s.id for update nowait;
  perform 1 from public.leads l where l.id in (select (r->>'rootId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'sourceKind'='opportunity_assignment') or l.id in (select (r->>'opportunityId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'opportunityId' is not null) order by l.id for update nowait;
  perform 1 from public.payments p where p.id in (select (r->>'operationSourceId')::uuid from jsonb_array_elements(v_approval.projections) r where r->>'operationSourceKind'='payment_verified') or p.accepted_quote_version_id in (select (r->>'quoteVersionId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'quoteVersionId' is not null) order by p.id for update nowait;
  perform 1 from public.profile_roles pr where pr.profile_id in (select (r->>'ownerId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'ownerId' is not null) order by pr.profile_id,pr.role_id for update nowait;
  perform 1 from public.profiles p where p.id in (select (r->>'ownerId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'ownerId' is not null) order by p.id for update nowait;
  perform 1 from public.quote_events e where e.quote_version_id in (select (r->>'quoteVersionId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'quoteVersionId' is not null) order by e.id for update nowait;
  perform 1 from public.quote_versions q where q.id in (select (r->>'rootId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'sourceKind'='quote_sent') order by q.id for update nowait;
  perform 1 from public.quotes q where q.id in (select (r->>'quoteId')::uuid from jsonb_array_elements(v_approval.plan->'rows') r where r->>'quoteId' is not null) order by q.id for update nowait;
  perform 1 from public.roles r where r.id in (select pr.role_id from public.profile_roles pr where pr.profile_id in (select (p->>'ownerId')::uuid from jsonb_array_elements(v_approval.plan->'rows') p where p->>'ownerId' is not null)) order by r.id for update nowait;
  v_stage:='task-context';
  perform 1 from public.tasks t where t.id in (select (p->>'taskId')::uuid from jsonb_array_elements(v_approval.plan->'rows') p where p->>'taskId' is not null) or t.idempotency_key in (select p->>'originKey' from jsonb_array_elements(v_approval.plan->'rows') p where p->>'originKey' is not null) or t.automation_origin_key in (select p->>'originKey' from jsonb_array_elements(v_approval.plan->'rows') p where p->>'originKey' is not null)
    or t.lead_id in (select (p->>'rootId')::uuid from jsonb_array_elements(v_approval.plan->'rows') p where p->>'sourceKind'='opportunity_assignment') or t.quote_id in (select (p->>'quoteId')::uuid from jsonb_array_elements(v_approval.plan->'rows') p where p->>'quoteId' is not null) order by t.id for update nowait;

  if exists(select 1 from jsonb_array_elements(v_approval.projections) p cross join lateral (select coalesce(max(source_order),0) value from (select source_order from public.task_automation_outcomes where origin_key=p->>'originKey' union all select source_order from public.task_automation_tombstones where origin_key=p->>'originKey') orders) current_order where current_order.value=2147483647 or (p->>'sourceOrder')::bigint<>current_order.value+1) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','STALE_SOURCE_ORDER','message','STALE_SOURCE_ORDER'));
  end if;
  if exists(select 1 from public.tasks t join jsonb_array_elements(v_approval.projections) p on t.id=(p->>'taskId')::uuid or t.idempotency_key=p->>'originKey' or t.automation_origin_key=p->>'originKey')
    or exists(select 1 from public.task_automation_origins o join jsonb_array_elements(v_approval.projections) p on o.origin_key=p->>'originKey' or o.opportunity_id is not distinct from (p->>'opportunityId')::uuid and p->>'operationSourceKind' like 'opportunity_%' or o.quote_version_id is not distinct from (p->>'quoteVersionId')::uuid and p->>'quoteVersionId' is not null)
    or exists(select 1 from public.task_automation_outcomes o join jsonb_array_elements(v_approval.projections) p on o.outcome_key=p->>'outcomeKey' or (o.source_kind,o.source_id,o.source_key,o.source_order)=(p->>'operationSourceKind',(p->>'operationSourceId')::uuid,p->>'sourceKey',(p->>'sourceOrder')::bigint))
    or exists(select 1 from public.task_automation_tombstones t join jsonb_array_elements(v_approval.projections) p on t.tombstone_key=p->>'tombstoneKey' or t.origin_key=p->>'originKey' or (t.source_kind,t.source_id,t.source_key,t.source_order)=(p->>'operationSourceKind',(p->>'operationSourceId')::uuid,p->>'sourceKey',(p->>'sourceOrder')::bigint)) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','IDENTITY_OCCUPANCY_CONFLICT','message','IDENTITY_OCCUPANCY_CONFLICT'));
  end if;

  v_stage:='write';
  for v_projection in select p from jsonb_array_elements(v_approval.projections) with ordinality value(p,ordinality) order by ordinality loop
    if v_projection->>'action'='generate' then
      v_written:=public.task_automation_historical_write_generate(v_projection);
      if v_written<>jsonb_build_object('taskId',v_projection->>'taskId','originKey',v_projection->>'originKey','outcomeKey',v_projection->>'outcomeKey') then raise exception 'writer mismatch'; end if;
      v_task_ids:=array_append(v_task_ids,(v_projection->>'taskId')::uuid); v_origin_keys:=array_append(v_origin_keys,v_projection->>'originKey');
    else
      v_written:=public.task_automation_historical_write_suppress(v_projection||jsonb_build_object('anchorAt',null));
      if v_written<>jsonb_build_object('outcomeKey',v_projection->>'outcomeKey','tombstoneKey',v_projection->>'tombstoneKey') then raise exception 'writer mismatch'; end if;
      v_tombstone_keys:=array_append(v_tombstone_keys,v_projection->>'tombstoneKey');
    end if;
    v_outcome_keys:=array_append(v_outcome_keys,v_projection->>'outcomeKey');
  end loop;
  v_result:=jsonb_build_object('schema','task-automation-historical-apply-result.v1','requestId',p_request_id_text,'approvalId',v_approval.id::text,'actorId',v_actor::text,'planHash',v_approval.plan_hash,'projectionHash',v_approval.projection_hash,'taskIds',to_jsonb(v_task_ids),'originKeys',to_jsonb(v_origin_keys),'outcomeKeys',to_jsonb(v_outcome_keys),'tombstoneKeys',to_jsonb(v_tombstone_keys),'generatedCount',cardinality(v_task_ids),'suppressedCount',cardinality(v_tombstone_keys),'projectionCount',cardinality(v_outcome_keys));
  v_stage:='receipt';
  insert into public.task_automation_historical_apply_receipts(request_id,approval_id,actor_id,approval_fingerprint,plan_hash,projection_hash,task_ids,origin_keys,outcome_keys,tombstone_keys,generated_count,suppressed_count,projection_count,result,result_hash,result_byte_count)
    values(v_request_id,v_approval.id,v_actor,v_approval.approval_fingerprint,v_approval.plan_hash,v_approval.projection_hash,v_task_ids,v_origin_keys,v_outcome_keys,v_tombstone_keys,cardinality(v_task_ids),cardinality(v_tombstone_keys),cardinality(v_outcome_keys),v_result,public.task_automation_historical_hash(v_result),octet_length(convert_to(public.follow_up_canonical_json(v_result),'UTF8'))) returning * into v_receipt;
  return jsonb_build_object('ok',true,'status','applied')||(to_jsonb(v_receipt)-'created_at')||jsonb_build_object('created_at',to_char(v_receipt.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
exception when others then
  v_code:=case v_stage when 'context' then 'STALE_LIVE_CONTEXT' when 'task-context' then 'IDENTITY_OCCUPANCY_CONFLICT' when 'receipt' then 'APPLY_RECEIPT_INTEGRITY_FAILURE' when 'write' then 'IDENTITY_OCCUPANCY_CONFLICT' else 'APPROVAL_INTEGRITY_FAILURE' end;
  return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code));
end
$function$;

alter function public.apply_task_automation_historical_plan(text,uuid) owner to postgres;
revoke all on function public.apply_task_automation_historical_plan(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.apply_task_automation_historical_plan(text,uuid) to authenticated;

commit;
