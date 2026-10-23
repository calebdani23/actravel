begin;

create table public.task_automation_historical_approvals (
  id uuid not null default extensions.gen_random_uuid() primary key,
  request_id uuid not null unique,
  actor_id uuid not null,
  actor_role text not null default 'admin',
  schema_version text not null,
  preview_schema text not null,
  rule_version text not null,
  source_cutoffs jsonb not null,
  snapshot_cutoffs jsonb not null,
  snapshot_hash text not null,
  plan jsonb not null,
  plan_hash text not null,
  projections jsonb not null,
  projection_hash text not null,
  request_fingerprint text not null,
  approval_fingerprint text not null unique,
  apply_generate_count integer not null,
  apply_suppress_count integer not null,
  already_projected_count integer not null,
  already_suppressed_count integer not null,
  excluded_not_actionable_count integer not null,
  manual_review_owner_invalid_count integer not null,
  manual_review_context_invalid_count integer not null,
  collision_manual_review_count integer not null,
  total_count integer not null,
  row_count integer not null,
  generate_count integer not null,
  suppress_count integer not null,
  projection_count integer not null,
  plan_byte_count integer not null,
  projection_byte_count integer not null,
  request_byte_count integer not null,
  created_at timestamptz not null default date_trunc('microseconds',clock_timestamp()),
  constraint task_automation_historical_approvals_actor_role_check check (actor_role='admin'),
  constraint task_automation_historical_approvals_schema_check check (schema_version='task-automation-historical-approval.v1'),
  constraint task_automation_historical_approvals_preview_schema_check check (preview_schema='task-automation-historical-preview.v1'),
  constraint task_automation_historical_approvals_rule_version_check check (rule_version='task-automation-historical.v1'),
  constraint task_automation_historical_approvals_hash_check check (snapshot_hash~'^[0-9a-f]{64}$' and plan_hash~'^[0-9a-f]{64}$' and projection_hash~'^[0-9a-f]{64}$' and request_fingerprint~'^[0-9a-f]{64}$' and approval_fingerprint~'^[0-9a-f]{64}$'),
  constraint task_automation_historical_approvals_json_check check (jsonb_typeof(source_cutoffs)='object' and jsonb_typeof(snapshot_cutoffs)='object' and jsonb_typeof(plan)='object' and jsonb_typeof(projections)='array'),
  constraint task_automation_historical_approvals_counts_check check (
    apply_generate_count between 0 and 4000 and apply_suppress_count between 0 and 4000 and already_projected_count between 0 and 4000
    and already_suppressed_count between 0 and 4000 and excluded_not_actionable_count between 0 and 4000
    and manual_review_owner_invalid_count between 0 and 4000 and manual_review_context_invalid_count between 0 and 4000
    and collision_manual_review_count between 0 and 4000 and total_count between 0 and 4000 and row_count=total_count
    and total_count=apply_generate_count+apply_suppress_count+already_projected_count+already_suppressed_count+excluded_not_actionable_count
      +manual_review_owner_invalid_count+manual_review_context_invalid_count+collision_manual_review_count
    and generate_count=apply_generate_count and suppress_count=apply_suppress_count and projection_count=generate_count+suppress_count
    and jsonb_array_length(plan->'rows')=row_count and jsonb_array_length(projections)=projection_count),
  constraint task_automation_historical_approvals_bytes_check check (
    plan_byte_count between 1 and 16777216 and projection_byte_count between 2 and 16777216 and request_byte_count between 1 and 33554432
    and plan_byte_count=octet_length(convert_to(public.follow_up_canonical_json(plan),'UTF8'))
    and projection_byte_count=octet_length(convert_to(public.follow_up_canonical_json(projections),'UTF8'))),
  constraint task_automation_historical_approvals_created_at_check check (isfinite(created_at) and date_trunc('microseconds',created_at)=created_at)
);

create or replace function public.validate_task_automation_historical_approval(p_value public.task_automation_historical_approvals)
returns boolean language plpgsql immutable strict parallel safe security invoker set search_path='' as $function$
declare
  v_counts jsonb := jsonb_build_array(p_value.apply_generate_count,p_value.apply_suppress_count,p_value.already_projected_count,
    p_value.already_suppressed_count,p_value.excluded_not_actionable_count,p_value.manual_review_owner_invalid_count,
    p_value.manual_review_context_invalid_count,p_value.collision_manual_review_count);
  v_row_counts jsonb; v_row_count integer; v_generate_count integer; v_suppress_count integer;
  v_request jsonb; v_expected_projections jsonb; v_fingerprint jsonb; v_created text;
begin
  if not (p_value.source_cutoffs ?& array['opportunityAssignment','quoteSent']) or p_value.source_cutoffs-array['opportunityAssignment','quoteSent']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_value.source_cutoffs) e where jsonb_typeof(e.value)<>'string' or e.value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
      or to_char((e.value#>>'{}')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>e.value#>>'{}') then return false; end if;
  if not (p_value.snapshot_cutoffs ?& array['opportunityRoots','quoteVersionRoots','assignmentEvidence','quoteSourceEvidence','taskOccupancy','automationOrigins','automationOutcomes','automationTombstones'])
    or p_value.snapshot_cutoffs-array['opportunityRoots','quoteVersionRoots','assignmentEvidence','quoteSourceEvidence','taskOccupancy','automationOrigins','automationOutcomes','automationTombstones']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_value.snapshot_cutoffs) e where e.value<>'null'::jsonb and (jsonb_typeof(e.value)<>'array' or jsonb_array_length(e.value)<>2
      or e.value->>0 !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
      or to_char((e.value->>0)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>e.value->>0
      or case when e.key in ('automationOrigins','automationOutcomes','automationTombstones') then e.value->>1 !~ '^[0-9a-f]{64}$'
        else e.value->>1 !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' end)) then return false; end if;
  if not (p_value.plan ?& array['schema','ruleVersion','sourceCutoffs','snapshotCutoffs','snapshotHash','rows','counts','totalCount'])
    or p_value.plan-array['schema','ruleVersion','sourceCutoffs','snapshotCutoffs','snapshotHash','rows','counts','totalCount']<>'{}'::jsonb
    or p_value.plan->>'schema'<>'task-automation-historical-plan.v1' or p_value.plan->>'ruleVersion'<>p_value.rule_version
    or p_value.plan->'sourceCutoffs'<>p_value.source_cutoffs or p_value.plan->'snapshotCutoffs'<>p_value.snapshot_cutoffs
    or p_value.plan->>'snapshotHash'<>p_value.snapshot_hash or p_value.plan->'counts'<>v_counts
    or p_value.plan->>'totalCount'<>p_value.total_count::text or jsonb_typeof(p_value.plan->'rows')<>'array'
    or jsonb_typeof(p_value.plan->'counts')<>'array' or jsonb_array_length(p_value.plan->'counts')<>8
    or jsonb_typeof(p_value.plan->'totalCount')<>'number' or p_value.plan->>'totalCount' !~ '^[0-9]+$'
    or exists(select 1 from jsonb_array_elements(p_value.plan->'counts') value where jsonb_typeof(value)<>'number' or value#>>'{}' !~ '^[0-9]+$' or (value#>>'{}')::numeric>4000) then return false; end if;
  if exists(select 1 from jsonb_array_elements(p_value.plan->'rows') with ordinality e(value,ord) where jsonb_typeof(value)<>'object'
    or not (value ?& array['ordinal','sourceKind','rootId','anchorAt','sourceId','ownerId','opportunityId','quoteId','quoteVersionId','sentEventId','disposition','reason','action','operationSourceKind','operationSourceId','sourceKey','sourceOrder','originKey','taskId','taskKind','dueRuleVersion','dueAt','outcomeKey','tombstoneKey'])
    or value-array['ordinal','sourceKind','rootId','anchorAt','sourceId','ownerId','opportunityId','quoteId','quoteVersionId','sentEventId','disposition','reason','action','operationSourceKind','operationSourceId','sourceKey','sourceOrder','originKey','taskId','taskKind','dueRuleVersion','dueAt','outcomeKey','tombstoneKey']<>'{}'::jsonb
    or jsonb_typeof(value->'ordinal')<>'number' or value->>'ordinal' !~ '^[0-9]+$' or value->>'ordinal'<>(ord-1)::text or value->>'sourceKind' not in ('opportunity_assignment','quote_sent')
    or value->>'rootId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or exists(select 1 from jsonb_each(value) field where field.key in ('sourceId','ownerId','opportunityId','quoteId','quoteVersionId','sentEventId','operationSourceId','taskId') and field.value<>'null'::jsonb
      and (jsonb_typeof(field.value)<>'string' or field.value#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
    or exists(select 1 from jsonb_each(value) field where field.key in ('sourceKey','originKey','outcomeKey','tombstoneKey') and field.value<>'null'::jsonb
      and (jsonb_typeof(field.value)<>'string' or field.value#>>'{}' !~ '^[0-9a-f]{64}$'))
    or exists(select 1 from jsonb_each(value) field where field.key in ('anchorAt','dueAt') and field.value<>'null'::jsonb
      and (jsonb_typeof(field.value)<>'string' or field.value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
        or to_char((field.value#>>'{}')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>field.value#>>'{}'))
    or (value->>'disposition',value->>'reason') not in (('apply/generate','ELIGIBLE_GENERATE'),('apply/suppress','SOURCE_INVALIDATED'),('already/projected','ALREADY_PROJECTED'),('already/suppressed','ALREADY_SUPPRESSED'),('excluded/not-actionable','OPPORTUNITY_NOT_OPERATIONAL'),('excluded/not-actionable','QUOTE_NOT_OPERATIONAL'),('manual-review/owner-invalid','OWNER_UNASSIGNED'),('manual-review/owner-invalid','PROFILE_MISSING'),('manual-review/owner-invalid','PROFILE_INACTIVE'),('manual-review/owner-invalid','ROLE_INVALID'),('manual-review/context-invalid','ASSIGNMENT_EVIDENCE_MISSING'),('manual-review/context-invalid','ASSIGNMENT_EVIDENCE_CONTRADICTORY'),('manual-review/context-invalid','FIRST_SENT_EVENT_MISSING'),('manual-review/context-invalid','FIRST_SENT_EVENT_CONTRADICTORY'),('manual-review/context-invalid','SOURCE_AMBIGUOUS'),('manual-review/context-invalid','INVALIDATION_EVIDENCE_MISSING'),('manual-review/context-invalid','DUE_UNSUPPORTED'),('collision/manual-review','IDENTITY_OCCUPIED'),('collision/manual-review','STATE_MISMATCH'),('collision/manual-review','DUPLICATE_SOURCE_STATE'),('collision/manual-review','SOURCE_ORDER_EXHAUSTED'))
    or (value->>'disposition'='apply/generate' and value->>'action' is distinct from 'generate') or (value->>'disposition'='apply/suppress' and value->>'action' is distinct from 'suppress')
    or (value->>'disposition' not in ('apply/generate','apply/suppress') and value->'action'<>'null'::jsonb)
    or (value->'operationSourceKind'<>'null'::jsonb and value->>'operationSourceKind' not in ('opportunity_assignment','quote_sent','opportunity_unassigned','opportunity_archived','opportunity_terminal','quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded','whatsapp_inbound','payment_verified'))
    or (value->'sourceOrder'<>'null'::jsonb and (jsonb_typeof(value->'sourceOrder')<>'number' or value->>'sourceOrder' !~ '^[1-9][0-9]*$' or (value->>'sourceOrder')::numeric>2147483647))
    or (value->'taskKind'<>'null'::jsonb and value->>'taskKind' not in ('first_contact','quote_follow_up')) or (value->'dueRuleVersion'<>'null'::jsonb and value->>'dueRuleVersion' not in ('mx-calendar.v1','elapsed-48h.v1'))
    or (value->>'action' is not null and (value->>'operationSourceKind' is null or value->>'operationSourceId' is null or value->>'sourceKey' is null or value->>'sourceOrder' is null or value->>'originKey' is null or value->>'outcomeKey' is null))
    or (value->>'action'='generate' and (value->>'ownerId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or value->>'taskId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or value->>'taskKind' not in ('first_contact','quote_follow_up') or value->>'dueRuleVersion' not in ('mx-calendar.v1','elapsed-48h.v1') or value->'dueAt'='null'::jsonb or value->'tombstoneKey'<>'null'::jsonb))
    or (value->>'action'='suppress' and (value->'ownerId'<>'null'::jsonb or value->'taskId'<>'null'::jsonb or value->'taskKind'<>'null'::jsonb or value->'dueRuleVersion'<>'null'::jsonb or value->'dueAt'<>'null'::jsonb or value->>'tombstoneKey' !~ '^[0-9a-f]{64}$'))
    or (value->>'disposition' in ('excluded/not-actionable','manual-review/owner-invalid','manual-review/context-invalid','collision/manual-review')
      and exists(select 1 from jsonb_each(value) field where field.key in ('operationSourceKind','operationSourceId','sourceKey','sourceOrder','originKey','taskId','taskKind','dueRuleVersion','dueAt','outcomeKey','tombstoneKey') and field.value<>'null'::jsonb))
    or (value->>'disposition'='already/projected' and (value->>'operationSourceKind' is null or value->>'operationSourceId' is null or value->>'sourceKey' is null or value->>'sourceOrder' is null or value->>'originKey' is null or value->>'taskId' is null or value->>'taskKind' is null or value->>'dueRuleVersion' is null or value->>'dueAt' is null or value->>'outcomeKey' is null or value->'tombstoneKey'<>'null'::jsonb))
    or (value->>'disposition'='already/suppressed' and (value->>'operationSourceKind' is null or value->>'operationSourceId' is null or value->>'sourceKey' is null or value->>'sourceOrder' is null or value->>'originKey' is null or value->>'outcomeKey' is null or value->>'tombstoneKey' is null or value->'ownerId'<>'null'::jsonb or value->'taskId'<>'null'::jsonb or value->'taskKind'<>'null'::jsonb or value->'dueRuleVersion'<>'null'::jsonb or value->'dueAt'<>'null'::jsonb))
    or octet_length(convert_to(public.follow_up_canonical_json(value),'UTF8'))>4096) then return false; end if;
  select jsonb_build_array(count(*) filter(where value->>'disposition'='apply/generate'),count(*) filter(where value->>'disposition'='apply/suppress'),
      count(*) filter(where value->>'disposition'='already/projected'),count(*) filter(where value->>'disposition'='already/suppressed'),
      count(*) filter(where value->>'disposition'='excluded/not-actionable'),count(*) filter(where value->>'disposition'='manual-review/owner-invalid'),
      count(*) filter(where value->>'disposition'='manual-review/context-invalid'),count(*) filter(where value->>'disposition'='collision/manual-review')),
    count(*),count(*) filter(where value->>'action'='generate'),count(*) filter(where value->>'action'='suppress')
    into v_row_counts,v_row_count,v_generate_count,v_suppress_count from jsonb_array_elements(p_value.plan->'rows') value;
  if v_row_counts<>v_counts or v_row_count<>p_value.row_count or v_row_count<>p_value.total_count
    or v_generate_count<>p_value.generate_count or v_generate_count<>p_value.apply_generate_count
    or v_suppress_count<>p_value.suppress_count or v_suppress_count<>p_value.apply_suppress_count
    or v_generate_count+v_suppress_count<>p_value.projection_count or jsonb_array_length(p_value.projections)<>p_value.projection_count
    or (select count(*)<>count(distinct (value->>'sourceKind',value->>'rootId')) from jsonb_array_elements(p_value.plan->'rows') value)
    or (select coalesce(jsonb_agg(value order by value->>'sourceKind' collate "C",value->>'anchorAt' collate "C" nulls last,value->>'sourceId' collate "C" nulls last,value->>'rootId' collate "C"),'[]'::jsonb) from jsonb_array_elements(p_value.plan->'rows') value)<>p_value.plan->'rows'
    or octet_length(convert_to(public.follow_up_canonical_json(jsonb_set(p_value.plan,'{rows}','[]'::jsonb)),'UTF8'))>65536 then return false; end if;
  select coalesce(jsonb_agg(jsonb_build_object('ordinal',value->'ordinal','action',value->'action','operationSourceKind',value->'operationSourceKind','operationSourceId',value->'operationSourceId','sourceKey',value->'sourceKey','sourceOrder',value->'sourceOrder','originKey',value->'originKey','taskId',value->'taskId','taskKind',value->'taskKind','ownerId',value->'ownerId','opportunityId',value->'opportunityId','quoteId',value->'quoteId','quoteVersionId',value->'quoteVersionId','sentEventId',value->'sentEventId','anchorAt',value->'anchorAt','dueRuleVersion',value->'dueRuleVersion','dueAt',value->'dueAt','outcomeKey',value->'outcomeKey','tombstoneKey',value->'tombstoneKey') order by ord),'[]'::jsonb)
    into v_expected_projections from jsonb_array_elements(p_value.plan->'rows') with ordinality e(value,ord) where value->>'action' in ('generate','suppress');
  if v_expected_projections<>p_value.projections or exists(select 1 from jsonb_array_elements(p_value.projections) value where octet_length(convert_to(public.follow_up_canonical_json(value),'UTF8'))>4096) then return false; end if;
  v_request:=jsonb_build_array('task-automation-historical-approval-request.v1',p_value.request_id::text,p_value.actor_id::text,'admin',p_value.preview_schema,p_value.rule_version,p_value.source_cutoffs,p_value.snapshot_cutoffs,p_value.snapshot_hash,p_value.plan_hash,p_value.projection_hash,p_value.plan,p_value.projections);
  v_created:=to_char(p_value.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_fingerprint:=jsonb_build_array('task-automation-historical-approval-fingerprint.v1',p_value.id::text,p_value.request_id::text,p_value.actor_id::text,'admin',p_value.schema_version,p_value.preview_schema,p_value.rule_version,p_value.source_cutoffs,p_value.snapshot_cutoffs,p_value.snapshot_hash,p_value.plan_hash,p_value.projection_hash,p_value.request_fingerprint,p_value.plan,p_value.projections,v_counts,p_value.total_count,p_value.row_count,p_value.generate_count,p_value.suppress_count,p_value.projection_count,p_value.plan_byte_count,p_value.projection_byte_count,p_value.request_byte_count,v_created);
  return p_value.plan_hash=public.task_automation_historical_hash(p_value.plan) and p_value.projection_hash=public.task_automation_historical_hash(p_value.projections)
    and p_value.request_fingerprint=public.task_automation_historical_hash(v_request) and p_value.request_byte_count=octet_length(convert_to(public.follow_up_canonical_json(v_request),'UTF8'))
    and p_value.approval_fingerprint=public.task_automation_historical_hash(v_fingerprint);
exception when others then return false;
end
$function$;

create or replace function public.reject_task_automation_historical_approval_mutation() returns trigger
language plpgsql security invoker set search_path='' as $function$
begin
  if tg_op<>'INSERT' then raise exception using errcode='P0001',message='HISTORICAL_APPROVAL_IMMUTABLE'; end if;
  if not public.validate_task_automation_historical_approval(new) then raise exception using errcode='P0001',message='HISTORICAL_APPROVAL_INTEGRITY'; end if;
  return new;
end
$function$;

create trigger task_automation_historical_approvals_immutable before insert or update or delete on public.task_automation_historical_approvals
for each row execute function public.reject_task_automation_historical_approval_mutation();
alter function public.validate_task_automation_historical_approval(public.task_automation_historical_approvals) owner to postgres;
alter function public.reject_task_automation_historical_approval_mutation() owner to postgres;
revoke all on function public.validate_task_automation_historical_approval(public.task_automation_historical_approvals) from public,anon,authenticated,service_role;
revoke all on function public.reject_task_automation_historical_approval_mutation() from public,anon,authenticated,service_role;

alter table public.task_automation_historical_approvals enable row level security;
alter table public.task_automation_historical_approvals force row level security;
revoke all on table public.task_automation_historical_approvals from public,anon,authenticated,service_role;
grant select on table public.task_automation_historical_approvals to authenticated;
create policy "historical approval active admin select" on public.task_automation_historical_approvals for select to authenticated using (
  auth.role()='authenticated' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
  and exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=auth.uid() and r.name='admin'));

commit;
