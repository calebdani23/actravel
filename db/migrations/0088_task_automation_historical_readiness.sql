begin;

create or replace function public.read_task_automation_historical_readiness(p_request_id_text text,p_expected_actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare
  v_actor uuid:=auth.uid(); v_request uuid; v_approval public.task_automation_historical_approvals%rowtype; v_receipt public.task_automation_historical_apply_receipts%rowtype;
  v_row jsonb; v_rows jsonb:='[]'::jsonb; v_outcome text; v_code text; v_match boolean; v_over_limit boolean;
  v_ordinal integer:=0; v_generate integer:=0; v_suppress integer:=0; v_write integer:=0;
  v_task_backed integer; v_suppressed integer; v_intentional integer; v_manual integer; v_counts jsonb;
begin
  if v_actor is null or auth.role() is distinct from 'authenticated' then v_code:='AUTH_REQUIRED';
  elsif not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active) then v_code:='AUTH_INACTIVE';
  elsif not exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=v_actor and r.name='admin') then v_code:='AUTH_NOT_ADMIN';
  elsif v_actor is distinct from p_expected_actor_id then v_code:='AUTH_ACTOR_MISMATCH';
  elsif p_request_id_text is null or p_request_id_text!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_code:='INVALID_REQUEST'; end if;
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;
  begin v_request:=p_request_id_text::uuid; exception when others then v_code:='INVALID_REQUEST'; end;
  if v_code is not null or v_request::text<>p_request_id_text then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST')); end if;

  select * into v_approval from public.task_automation_historical_approvals value where value.request_id=v_request;
  if not found then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPROVAL_NOT_FOUND','message','APPROVAL_NOT_FOUND')); end if;
  select * into v_receipt from public.task_automation_historical_apply_receipts value where value.request_id=v_request;
  if not found then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPLY_RECEIPT_NOT_FOUND','message','APPLY_RECEIPT_NOT_FOUND')); end if;
  if (case when jsonb_typeof(v_approval.plan->'rows')='array' then jsonb_array_length(v_approval.plan->'rows')>4000 else false end)
    or (case when jsonb_typeof(v_approval.projections)='array' then jsonb_array_length(v_approval.projections)>4000 else false end) then v_code:='APPROVAL_INTEGRITY_FAILURE';
  elsif v_approval.actor_id<>v_actor or not public.validate_task_automation_historical_approval(v_approval) then v_code:='APPROVAL_INTEGRITY_FAILURE'; end if;
  if v_code is not null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',v_code,'message',v_code)); end if;
  v_over_limit:=greatest(v_approval.apply_generate_count,v_approval.apply_suppress_count,v_approval.already_projected_count,v_approval.already_suppressed_count,
    v_approval.excluded_not_actionable_count,v_approval.manual_review_owner_invalid_count,v_approval.manual_review_context_invalid_count,
    v_approval.collision_manual_review_count,v_approval.total_count,v_approval.row_count,v_approval.projection_count,
    v_receipt.generated_count,v_receipt.suppressed_count,v_receipt.projection_count,cardinality(v_receipt.task_ids),cardinality(v_receipt.origin_keys),
    cardinality(v_receipt.outcome_keys),cardinality(v_receipt.tombstone_keys))>4000
    or case when jsonb_typeof(v_approval.plan->'rows')='array' then jsonb_array_length(v_approval.plan->'rows')>4000 else false end
    or case when jsonb_typeof(v_approval.projections)='array' then jsonb_array_length(v_approval.projections)>4000 else false end;
  if not v_over_limit and (not public.validate_task_automation_historical_apply_receipt(v_receipt) or v_receipt.actor_id<>v_actor
    or v_receipt.approval_id<>v_approval.id or v_receipt.approval_fingerprint<>v_approval.approval_fingerprint
    or v_receipt.plan_hash<>v_approval.plan_hash or v_receipt.projection_hash<>v_approval.projection_hash) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPLY_RECEIPT_INTEGRITY_FAILURE','message','APPLY_RECEIPT_INTEGRITY_FAILURE')); end if;

  if not v_over_limit then
    if jsonb_array_length(v_approval.plan->'rows')<>v_approval.total_count
      or (select count(*)<>v_approval.total_count or count(distinct (value->>'sourceKind',value->>'rootId'))<>v_approval.total_count
          or count(*) filter(where (value->>'ordinal')::integer<>ord-1)>0 from jsonb_array_elements(v_approval.plan->'rows') with ordinality item(value,ord)) then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','ROOT_ACCOUNTING_FAILURE','message','ROOT_ACCOUNTING_FAILURE')); end if;
    if v_receipt.generated_count<>v_approval.apply_generate_count or v_receipt.suppressed_count<>v_approval.apply_suppress_count
      or v_receipt.projection_count<>v_approval.apply_generate_count+v_approval.apply_suppress_count then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','WRITE_PARITY_FAILURE','message','WRITE_PARITY_FAILURE')); end if;

    for v_row in select value from jsonb_array_elements(v_approval.plan->'rows') with ordinality item(value,ord) order by ord loop
      v_ordinal:=v_ordinal+1;
      v_outcome:=case v_row->>'disposition' when 'apply/generate' then 'generated' when 'apply/suppress' then 'suppressed'
        when 'already/projected' then 'already_projected' when 'already/suppressed' then 'already_suppressed'
        when 'excluded/not-actionable' then 'excluded_not_actionable' when 'manual-review/owner-invalid' then 'manual_review_owner_invalid'
        when 'manual-review/context-invalid' then 'manual_review_context_invalid' when 'collision/manual-review' then 'collision_manual_review' end;
      if v_outcome is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','ROOT_ACCOUNTING_FAILURE','message','ROOT_ACCOUNTING_FAILURE')); end if;
      if v_row->>'disposition'='apply/generate' then
        v_generate:=v_generate+1; v_write:=v_write+1;
        if v_receipt.task_ids[v_generate]::text is distinct from v_row->>'taskId' or v_receipt.origin_keys[v_generate] is distinct from v_row->>'originKey'
          or v_receipt.outcome_keys[v_write] is distinct from v_row->>'outcomeKey' then v_match:=false; end if;
      elsif v_row->>'disposition'='apply/suppress' then
        v_suppress:=v_suppress+1; v_write:=v_write+1;
        if v_receipt.tombstone_keys[v_suppress] is distinct from v_row->>'tombstoneKey' or v_receipt.outcome_keys[v_write] is distinct from v_row->>'outcomeKey' then v_match:=false; end if;
      elsif v_row->>'disposition'='already/projected' then
        if (v_row->>'taskId')::uuid=any(v_receipt.task_ids) or v_row->>'originKey'=any(v_receipt.origin_keys) or v_row->>'outcomeKey'=any(v_receipt.outcome_keys) then v_match:=false; end if;
      elsif v_row->>'disposition'='already/suppressed' then
        if v_row->>'originKey'=any(v_receipt.origin_keys) or v_row->>'tombstoneKey'=any(v_receipt.tombstone_keys) or v_row->>'outcomeKey'=any(v_receipt.outcome_keys) then v_match:=false; end if;
      end if;
      if v_match is false then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','WRITE_PARITY_FAILURE','message','WRITE_PARITY_FAILURE')); end if;

      if v_row->>'disposition' in ('apply/generate','already/projected') then
        select count(*)=1 into v_match from public.tasks t join public.task_automation_origins g on g.origin_key=t.automation_origin_key
          join public.task_automation_outcomes o on o.outcome_key=v_row->>'outcomeKey'
          where t.id=(v_row->>'taskId')::uuid and t.owner_id=(v_row->>'ownerId')::uuid and t.idempotency_key=v_row->>'originKey'
          and t.automation_origin_key=v_row->>'originKey' and t.task_kind=v_row->>'taskKind' and t.due_at=(v_row->>'dueAt')::timestamptz
          and t.status in ('pending','in_progress','completed','canceled') and t.source_event_id is null and t.source_event_type is null
          and t.source_event_created_at is null and t.source_due_at is null and t.source_payload is null and t.metadata is null
          and ((v_row->>'taskKind'='first_contact' and t.lead_id=(v_row->>'opportunityId')::uuid and t.quote_id is null and t.description='Complete first contact'
            and exists(select 1 from public.leads l where l.id=(v_row->>'opportunityId')::uuid and l.assigned_to=(v_row->>'ownerId')::uuid))
            or (v_row->>'taskKind'='quote_follow_up' and t.lead_id is null and t.quote_id=(v_row->>'quoteId')::uuid and t.description='Follow up on quote version'
            and exists(select 1 from public.quotes q where q.id=(v_row->>'quoteId')::uuid and q.owner_id=(v_row->>'ownerId')::uuid)))
          and g.task_kind=v_row->>'taskKind' and g.source_kind=v_row->>'operationSourceKind' and g.operation='generate'
          and g.opportunity_id is not distinct from case when v_row->>'taskKind'='first_contact' then (v_row->>'opportunityId')::uuid end
          and g.quote_version_id is not distinct from case when v_row->>'taskKind'='quote_follow_up' then (v_row->>'quoteVersionId')::uuid end
          and g.sent_event_id is not distinct from case when v_row->>'taskKind'='quote_follow_up' then (v_row->>'sentEventId')::uuid end
          and g.anchor_at=(v_row->>'anchorAt')::timestamptz and g.due_rule_version=v_row->>'dueRuleVersion' and g.task_id=t.id
          and (o.source_kind,o.source_id,o.source_key,o.source_order,o.operation,o.origin_key,o.task_id,o.outcome)
            =(v_row->>'operationSourceKind',(v_row->>'operationSourceId')::uuid,v_row->>'sourceKey',(v_row->>'sourceOrder')::bigint,'generate',v_row->>'originKey',t.id,'applied') and o.reason is null;
        if not v_match then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','WRITE_PARITY_FAILURE','message','WRITE_PARITY_FAILURE')); end if;
      elsif v_row->>'disposition' in ('apply/suppress','already/suppressed') then
        select count(*)=1 into v_match from public.task_automation_tombstones t join public.task_automation_outcomes o on o.outcome_key=v_row->>'outcomeKey'
          where (t.tombstone_key,t.source_kind,t.source_id,t.source_key,t.source_order,t.origin_key,t.reason)
            =(v_row->>'tombstoneKey',v_row->>'operationSourceKind',(v_row->>'operationSourceId')::uuid,v_row->>'sourceKey',(v_row->>'sourceOrder')::bigint,v_row->>'originKey','source_invalidated')
          and (o.source_kind,o.source_id,o.source_key,o.source_order,o.operation,o.origin_key,o.outcome)
            =(v_row->>'operationSourceKind',(v_row->>'operationSourceId')::uuid,v_row->>'sourceKey',(v_row->>'sourceOrder')::bigint,'suppress',v_row->>'originKey','applied') and o.task_id is null and o.reason is null;
        if not v_match then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','WRITE_PARITY_FAILURE','message','WRITE_PARITY_FAILURE')); end if;
      elsif exists(select 1 from jsonb_each(v_row) field where field.key in ('operationSourceKind','operationSourceId','sourceKey','sourceOrder','originKey','taskId','outcomeKey','tombstoneKey') and field.value<>'null'::jsonb) then
        return jsonb_build_object('ok',false,'error',jsonb_build_object('code','ROOT_ACCOUNTING_FAILURE','message','ROOT_ACCOUNTING_FAILURE'));
      end if;
      v_rows:=v_rows||jsonb_build_array(jsonb_build_object('ordinal',v_row->'ordinal','sourceKind',v_row->'sourceKind','rootId',v_row->'rootId',
        'disposition',v_row->'disposition','outcome',v_outcome,'taskId',v_row->'taskId','originKey',v_row->'originKey','outcomeKey',v_row->'outcomeKey','tombstoneKey',v_row->'tombstoneKey'));
      v_match:=null;
    end loop;
    if v_ordinal<>v_approval.total_count then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','ROOT_ACCOUNTING_FAILURE','message','ROOT_ACCOUNTING_FAILURE')); end if;
    if v_generate<>v_receipt.generated_count or v_suppress<>v_receipt.suppressed_count or v_write<>v_receipt.projection_count then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','WRITE_PARITY_FAILURE','message','WRITE_PARITY_FAILURE')); end if;
  end if;
  if v_over_limit then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED')); end if;

  v_task_backed:=v_approval.apply_generate_count+v_approval.already_projected_count; v_suppressed:=v_approval.apply_suppress_count+v_approval.already_suppressed_count;
  v_intentional:=v_approval.excluded_not_actionable_count; v_manual:=v_approval.manual_review_owner_invalid_count+v_approval.manual_review_context_invalid_count+v_approval.collision_manual_review_count;
  v_counts:=jsonb_build_object('applyGenerate',v_approval.apply_generate_count,'applySuppress',v_approval.apply_suppress_count,'alreadyProjected',v_approval.already_projected_count,
    'alreadySuppressed',v_approval.already_suppressed_count,'excludedNotActionable',v_approval.excluded_not_actionable_count,'manualReviewOwnerInvalid',v_approval.manual_review_owner_invalid_count,
    'manualReviewContextInvalid',v_approval.manual_review_context_invalid_count,'collisionManualReview',v_approval.collision_manual_review_count,'receiptGenerated',v_receipt.generated_count,
    'receiptSuppressed',v_receipt.suppressed_count,'plannedWrites',v_approval.apply_generate_count+v_approval.apply_suppress_count,'receiptWrites',v_receipt.projection_count,
    'taskBacked',v_task_backed,'suppressed',v_suppressed,'intentionalNoWrite',v_intentional,'unresolvedManualReview',v_manual,'total',v_approval.total_count);
  if v_approval.total_count<>v_task_backed+v_suppressed+v_intentional+v_manual then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','ROOT_ACCOUNTING_FAILURE','message','ROOT_ACCOUNTING_FAILURE')); end if;
  return jsonb_build_object('ok',true,'request_id',v_request,'approval_id',v_approval.id,'apply_receipt_id',v_receipt.id,'ready',v_manual=0,'counts',v_counts,'rows',v_rows);
exception when others then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','ROOT_ACCOUNTING_FAILURE','message','ROOT_ACCOUNTING_FAILURE'));
end
$function$;

alter function public.read_task_automation_historical_readiness(text,uuid) owner to postgres;
revoke all on function public.read_task_automation_historical_readiness(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_task_automation_historical_readiness(text,uuid) to authenticated;

commit;
