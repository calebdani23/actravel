begin;

create or replace function public.approve_task_automation_historical_plan(p_request_id_text text,p_expected_actor_id uuid,p_preview_schema text,p_rule_version text,p_source_cutoffs jsonb,p_snapshot_cutoffs jsonb,p_snapshot_hash text,p_plan_hash text,p_projection_hash text,p_request_fingerprint text,p_plan jsonb,p_projections jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_actor uuid := auth.uid(); v_request_id uuid; v_created text; v_request jsonb; v_counts jsonb; v_expected_projections jsonb;
  v_plan_hash text; v_projection_hash text; v_request_fingerprint text; v_plan_bytes integer; v_projection_bytes integer; v_request_bytes integer;
  v_candidate public.task_automation_historical_approvals%rowtype; v_existing public.task_automation_historical_approvals%rowtype;
begin
  if v_actor is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_REQUIRED','message','AUTH_REQUIRED')); end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INACTIVE','message','AUTH_INACTIVE')); end if;
  if not exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=v_actor and r.name='admin') then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_NOT_ADMIN','message','AUTH_NOT_ADMIN')); end if;
  if v_actor is distinct from p_expected_actor_id then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_ACTOR_MISMATCH','message','AUTH_ACTOR_MISMATCH')); end if;

  if p_request_id_text is null or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST'));
  end if;
  begin v_request_id:=p_request_id_text::uuid; exception when others then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST'));
  end;
  if v_request_id::text<>p_request_id_text then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST')); end if;

  begin
    if p_preview_schema is distinct from 'task-automation-historical-preview.v1' or p_rule_version is distinct from 'task-automation-historical.v1'
      or p_snapshot_hash is null or p_snapshot_hash !~ '^[0-9a-f]{64}$' or p_source_cutoffs is null or jsonb_typeof(p_source_cutoffs)<>'object'
      or not (p_source_cutoffs ?& array['opportunityAssignment','quoteSent']) or p_source_cutoffs-array['opportunityAssignment','quoteSent']<>'{}'::jsonb
      or exists(select 1 from jsonb_each(p_source_cutoffs) e where jsonb_typeof(e.value)<>'string' or e.value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
        or to_char((e.value#>>'{}')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>e.value#>>'{}')
      or p_snapshot_cutoffs is null or jsonb_typeof(p_snapshot_cutoffs)<>'object'
      or not (p_snapshot_cutoffs ?& array['opportunityRoots','quoteVersionRoots','assignmentEvidence','quoteSourceEvidence','taskOccupancy','automationOrigins','automationOutcomes','automationTombstones'])
      or p_snapshot_cutoffs-array['opportunityRoots','quoteVersionRoots','assignmentEvidence','quoteSourceEvidence','taskOccupancy','automationOrigins','automationOutcomes','automationTombstones']<>'{}'::jsonb
      or exists(select 1 from jsonb_each(p_snapshot_cutoffs) e where e.value<>'null'::jsonb and (jsonb_typeof(e.value)<>'array' or jsonb_array_length(e.value)<>2
        or e.value->>0 !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
        or to_char((e.value->>0)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>e.value->>0
        or case when e.key in ('automationOrigins','automationOutcomes','automationTombstones') then e.value->>1 !~ '^[0-9a-f]{64}$'
          else e.value->>1 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' end)) then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_PREVIEW','message','INVALID_PREVIEW'));
    end if;
  exception when others then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_PREVIEW','message','INVALID_PREVIEW'));
  end;

  begin
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or not (p_plan ?& array['schema','ruleVersion','sourceCutoffs','snapshotCutoffs','snapshotHash','rows','counts','totalCount'])
    or p_plan-array['schema','ruleVersion','sourceCutoffs','snapshotCutoffs','snapshotHash','rows','counts','totalCount']<>'{}'::jsonb
    or p_plan->>'schema'<>'task-automation-historical-plan.v1' or p_plan->>'ruleVersion'<>p_rule_version or p_plan->'sourceCutoffs'<>p_source_cutoffs
    or p_plan->'snapshotCutoffs'<>p_snapshot_cutoffs or p_plan->>'snapshotHash'<>p_snapshot_hash or jsonb_typeof(p_plan->'rows')<>'array'
    or jsonb_typeof(p_plan->'counts')<>'array' or jsonb_array_length(p_plan->'counts')<>8 or jsonb_typeof(p_plan->'totalCount')<>'number'
    or p_plan->>'totalCount' !~ '^[0-9]+$' or exists(select 1 from jsonb_array_elements(p_plan->'counts') value where jsonb_typeof(value)<>'number' or value#>>'{}' !~ '^[0-9]+$') then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_PLAN','message','INVALID_PLAN'));
  end if;
  select jsonb_build_array(count(*) filter(where value->>'disposition'='apply/generate'),count(*) filter(where value->>'disposition'='apply/suppress'),
      count(*) filter(where value->>'disposition'='already/projected'),count(*) filter(where value->>'disposition'='already/suppressed'),
      count(*) filter(where value->>'disposition'='excluded/not-actionable'),count(*) filter(where value->>'disposition'='manual-review/owner-invalid'),
      count(*) filter(where value->>'disposition'='manual-review/context-invalid'),count(*) filter(where value->>'disposition'='collision/manual-review')),
    coalesce(jsonb_agg(jsonb_build_object('ordinal',value->'ordinal','action',value->'action','operationSourceKind',value->'operationSourceKind','operationSourceId',value->'operationSourceId','sourceKey',value->'sourceKey','sourceOrder',value->'sourceOrder','originKey',value->'originKey','taskId',value->'taskId','taskKind',value->'taskKind','ownerId',value->'ownerId','opportunityId',value->'opportunityId','quoteId',value->'quoteId','quoteVersionId',value->'quoteVersionId','sentEventId',value->'sentEventId','anchorAt',value->'anchorAt','dueRuleVersion',value->'dueRuleVersion','dueAt',value->'dueAt','outcomeKey',value->'outcomeKey','tombstoneKey',value->'tombstoneKey') order by ord) filter(where value->>'action' in ('generate','suppress')),'[]'::jsonb)
    into v_counts,v_expected_projections from jsonb_array_elements(p_plan->'rows') with ordinality e(value,ord);
  v_plan_hash:=public.task_automation_historical_hash(p_plan); v_projection_hash:=public.task_automation_historical_hash(v_expected_projections);
  v_request:=jsonb_build_array('task-automation-historical-approval-request.v1',p_request_id_text,v_actor::text,'admin',p_preview_schema,p_rule_version,p_source_cutoffs,p_snapshot_cutoffs,p_snapshot_hash,v_plan_hash,v_projection_hash,p_plan,v_expected_projections);
  v_request_fingerprint:=public.task_automation_historical_hash(v_request); v_plan_bytes:=octet_length(convert_to(public.follow_up_canonical_json(p_plan),'UTF8'));
  v_projection_bytes:=octet_length(convert_to(public.follow_up_canonical_json(v_expected_projections),'UTF8')); v_request_bytes:=octet_length(convert_to(public.follow_up_canonical_json(v_request),'UTF8'));

  v_candidate.id:=extensions.gen_random_uuid(); v_candidate.request_id:=v_request_id; v_candidate.actor_id:=v_actor; v_candidate.actor_role:='admin';
  v_candidate.schema_version:='task-automation-historical-approval.v1'; v_candidate.preview_schema:=p_preview_schema; v_candidate.rule_version:=p_rule_version;
  v_candidate.source_cutoffs:=p_source_cutoffs; v_candidate.snapshot_cutoffs:=p_snapshot_cutoffs; v_candidate.snapshot_hash:=p_snapshot_hash;
  v_candidate.plan:=p_plan; v_candidate.plan_hash:=v_plan_hash; v_candidate.projections:=v_expected_projections; v_candidate.projection_hash:=v_projection_hash;
  v_candidate.request_fingerprint:=v_request_fingerprint; v_candidate.apply_generate_count:=(v_counts->>0)::integer; v_candidate.apply_suppress_count:=(v_counts->>1)::integer;
  v_candidate.already_projected_count:=(v_counts->>2)::integer; v_candidate.already_suppressed_count:=(v_counts->>3)::integer; v_candidate.excluded_not_actionable_count:=(v_counts->>4)::integer;
  v_candidate.manual_review_owner_invalid_count:=(v_counts->>5)::integer; v_candidate.manual_review_context_invalid_count:=(v_counts->>6)::integer; v_candidate.collision_manual_review_count:=(v_counts->>7)::integer;
  v_candidate.total_count:=jsonb_array_length(p_plan->'rows'); v_candidate.row_count:=v_candidate.total_count; v_candidate.generate_count:=v_candidate.apply_generate_count;
  v_candidate.suppress_count:=v_candidate.apply_suppress_count; v_candidate.projection_count:=jsonb_array_length(v_expected_projections);
  v_candidate.plan_byte_count:=v_plan_bytes; v_candidate.projection_byte_count:=v_projection_bytes; v_candidate.request_byte_count:=v_request_bytes;
  v_candidate.created_at:=date_trunc('microseconds',clock_timestamp()); v_created:=to_char(v_candidate.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_candidate.approval_fingerprint:=public.task_automation_historical_hash(jsonb_build_array('task-automation-historical-approval-fingerprint.v1',v_candidate.id::text,p_request_id_text,v_actor::text,'admin',v_candidate.schema_version,p_preview_schema,p_rule_version,p_source_cutoffs,p_snapshot_cutoffs,p_snapshot_hash,v_plan_hash,v_projection_hash,v_request_fingerprint,p_plan,v_expected_projections,v_counts,v_candidate.total_count,v_candidate.row_count,v_candidate.generate_count,v_candidate.suppress_count,v_candidate.projection_count,v_plan_bytes,v_projection_bytes,v_request_bytes,v_created));
  if not public.validate_task_automation_historical_approval(v_candidate) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_PLAN','message','INVALID_PLAN'));
  end if;
  exception when others then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_PLAN','message','INVALID_PLAN'));
  end;
  if p_projections is null or jsonb_typeof(p_projections)<>'array' or p_projections<>v_expected_projections then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_PROJECTION','message','INVALID_PROJECTION'));
  end if;
  if jsonb_array_length(p_plan->'rows')>4000 or (p_plan->>'totalCount')::numeric>4000
    or exists(select 1 from jsonb_array_elements(p_plan->'counts') value where (value#>>'{}')::numeric>4000)
    or (select count(*) from jsonb_array_elements(p_plan->'rows') value where value->>'sourceKind'='opportunity_assignment')>2000
    or (select count(*) from jsonb_array_elements(p_plan->'rows') value where value->>'sourceKind'='quote_sent')>2000 then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED'));
  end if;
  if v_plan_bytes>16777216 or v_projection_bytes>16777216 or v_request_bytes>33554432 then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED'));
  end if;
  if p_plan_hash is distinct from v_plan_hash or p_projection_hash is distinct from v_projection_hash or p_request_fingerprint is distinct from v_request_fingerprint then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','HASH_MISMATCH','message','HASH_MISMATCH'));
  end if;

  perform pg_advisory_xact_lock((('x'||substr(public.task_automation_historical_hash(jsonb_build_array('task-automation-historical-lock.v1','approval-request',p_request_id_text)),1,16))::bit(64)::bigint));
  select * into v_existing from public.task_automation_historical_approvals value where value.request_id=v_request_id;
  if found then
    if public.validate_task_automation_historical_approval(v_existing)
      and to_jsonb(v_existing)-array['id','approval_fingerprint','created_at']=to_jsonb(v_candidate)-array['id','approval_fingerprint','created_at'] then
      return jsonb_build_object('ok',true,'status','replayed')||(to_jsonb(v_existing)-'created_at')
        ||jsonb_build_object('created_at',to_char(v_existing.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
    end if;
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','APPROVAL_IDEMPOTENCY_CONFLICT','message','APPROVAL_IDEMPOTENCY_CONFLICT'));
  end if;
  insert into public.task_automation_historical_approvals select (v_candidate).* returning * into v_existing;
  return jsonb_build_object('ok',true,'status','approved')||(to_jsonb(v_existing)-'created_at')
    ||jsonb_build_object('created_at',to_char(v_existing.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end
$function$;

alter function public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) owner to postgres;
revoke all on function public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.approve_task_automation_historical_plan(text,uuid,text,text,jsonb,jsonb,text,text,text,text,jsonb,jsonb) to authenticated;

commit;
