begin;

create or replace function public.read_follow_up_task_disposition_readiness(p_request_id_text text, p_expected_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  actor_id uuid := auth.uid();
  request_uuid uuid;
  approval public.follow_up_task_approvals;
  receipt public.follow_up_task_apply_receipts;
  source record;
  task_id uuid;
  expected_task jsonb;
  rows jsonb := '[]'::jsonb;
  task_matches integer;
  row_count integer := 0;
  task_backed integer;
  intentional_no_task integer;
  unresolved_manual_review integer;
  over_limit boolean;
  code text;
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then code := 'AUTH_REQUIRED';
  elsif not exists (select 1 from public.profiles p where p.id=actor_id and p.is_active) then code := 'AUTH_INACTIVE';
  elsif not exists (select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=actor_id and r.name='admin') then code := 'AUTH_NOT_ADMIN';
  elsif p_expected_actor_id is null or p_expected_actor_id is distinct from actor_id then code := 'AUTH_ACTOR_MISMATCH';
  elsif p_request_id_text is null or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then code := 'INVALID_REQUEST';
  end if;
  if code is not null then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code));
  end if;
  begin
    request_uuid := p_request_id_text::uuid;
    if request_uuid::text <> p_request_id_text then code := 'INVALID_REQUEST'; end if;
  exception when others then code := 'INVALID_REQUEST';
  end;
  if code is not null then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code));
  end if;

  select value.* into approval from public.follow_up_task_approvals value where value.request_id=request_uuid;
  if not found then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','APPROVAL_NOT_FOUND','message','APPROVAL_NOT_FOUND'));
  end if;
  over_limit := approval.eligible_count > 2000 or approval.invalid_date_no_task_count > 2000
    or approval.manual_review_unassigned_owner_count > 2000 or approval.excluded_lead_not_operational_count > 2000
    or approval.excluded_non_selected_history_count > 2000 or approval.already_converted_count > 2000
    or approval.collision_manual_review_count > 2000 or approval.total_count > 2000
    or approval.row_count > 2000 or approval.projection_count > 2000;
  if not over_limit and not public.follow_up_task_readiness_validate_approval(request_uuid) then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','APPROVAL_INTEGRITY_FAILURE','message','APPROVAL_INTEGRITY_FAILURE'));
  end if;

  select value.* into receipt from public.follow_up_task_apply_receipts value where value.request_id=request_uuid;
  if not found then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','APPLY_RECEIPT_NOT_FOUND','message','APPLY_RECEIPT_NOT_FOUND'));
  end if;
  over_limit := over_limit or receipt.task_count > 2000 or pg_catalog.cardinality(receipt.task_ids) > 2000;
  if not over_limit and not public.follow_up_task_readiness_validate_receipt(request_uuid) then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','APPLY_RECEIPT_INTEGRITY_FAILURE','message','APPLY_RECEIPT_INTEGRITY_FAILURE'));
  end if;
  if over_limit then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','LIMIT_EXCEEDED','message','LIMIT_EXCEEDED'));
  end if;

  task_backed := approval.eligible_count + approval.already_converted_count;
  intentional_no_task := approval.invalid_date_no_task_count + approval.excluded_lead_not_operational_count + approval.excluded_non_selected_history_count;
  unresolved_manual_review := approval.manual_review_unassigned_owner_count + approval.collision_manual_review_count;
  if approval.total_count <> task_backed + intentional_no_task + unresolved_manual_review then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_PARITY_FAILURE','message','TASK_PARITY_FAILURE'));
  end if;

  for source in select * from public.follow_up_task_readiness_rows(request_uuid) order by ordinal loop
    row_count := row_count + 1;
    task_id := null;
    if source.disposition='eligible' then
      task_id := source.receipt_task_id;
    elsif source.disposition='already-converted' then
      select t.id into task_id from public.tasks t where t.source_event_id=source.event_id;
    end if;
    if source.disposition in ('eligible','already-converted') then
      expected_task := pg_catalog.jsonb_build_object(
        'owner_id',source.owner_id,'lead_id',source.lead_id,'quote_id',null,'description','Follow up with lead','due_at',source.due_at,'status','pending',
        'idempotency_key',lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id='||source.event_id::text,'UTF8'),'sha256'),'hex')),
        'task_kind','follow_up','source_event_id',source.event_id,'source_event_type','follow_up_registered','source_event_created_at',source.event_created_at,
        'source_due_at',source.due_at,'source_payload',pg_catalog.jsonb_build_object('followUpAt',to_char(source.follow_up_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'hasNote',source.has_note),
        'metadata',pg_catalog.jsonb_build_object('schema','follow_up_task.v1','source_event_id',source.event_id::text,'source_event_type','follow_up_registered','owner_id',source.owner_id::text,'lead_id',source.lead_id::text));
      select count(*) into task_matches from public.tasks t where t.id=task_id and pg_catalog.to_jsonb(t)-array['id','created_at','updated_at'] = expected_task;
      if task_id is null or task_matches <> 1 then
        return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_PARITY_FAILURE','message','TASK_PARITY_FAILURE'));
      end if;
    end if;
    rows := rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'ordinal',source.ordinal,'eventId',source.event_id,'disposition',source.disposition,
      'outcome',case when source.disposition in ('eligible','already-converted') then 'task_backed'
        when source.disposition in ('manual-review/unassigned-owner','collision/manual-review') then 'unresolved_manual_review' else 'intentional_no_task' end,
      'taskId',task_id));
  end loop;
  if row_count <> approval.total_count then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_PARITY_FAILURE','message','TASK_PARITY_FAILURE'));
  end if;
  return pg_catalog.jsonb_build_object(
    'ok',true,'requestId',request_uuid,'approvalId',approval.id,'applyReceiptId',receipt.id,
    'ready',unresolved_manual_review=0,
    'counts',pg_catalog.jsonb_build_object(
      'eligible',approval.eligible_count,'invalidDateNoTask',approval.invalid_date_no_task_count,
      'manualReviewUnassignedOwner',approval.manual_review_unassigned_owner_count,'excludedLeadNotOperational',approval.excluded_lead_not_operational_count,
      'excludedNonSelectedHistory',approval.excluded_non_selected_history_count,'alreadyConverted',approval.already_converted_count,
      'collisionManualReview',approval.collision_manual_review_count,'taskBacked',task_backed,
      'intentionalNoTask',intentional_no_task,'unresolvedManualReview',unresolved_manual_review,'total',approval.total_count),
    'rows',rows);
end;
$function$;

alter function public.read_follow_up_task_disposition_readiness(text,uuid) owner to postgres;
revoke all on function public.read_follow_up_task_disposition_readiness(text,uuid) from public,anon,service_role;
revoke all on function public.read_follow_up_task_disposition_readiness(text,uuid) from authenticated;
grant execute on function public.read_follow_up_task_disposition_readiness(text,uuid) to authenticated;

-- rollback: revoke all on function public.read_follow_up_task_disposition_readiness(text,uuid) from public,anon,authenticated,service_role;
-- rollback: drop function public.read_follow_up_task_disposition_readiness(text,uuid);

commit;
