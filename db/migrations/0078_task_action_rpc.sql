begin;

create or replace function public.task_action(p_request_id_text text, p_expected_actor_id uuid, p_task_id_text text, p_target_status text, p_cancel_reason text, p_completion_outcome text, p_note text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  actor_id uuid := auth.uid();
  v_request_id uuid;
  v_requested_task_id uuid;
  authoritative_task_id uuid;
  task_row public.tasks;
  prior_receipt public.task_action_receipts;
  receipt_row public.task_action_receipts;
  v_request_key text;
  v_request_fingerprint text;
  action_name text;
  receipt_outcome text;
  code text;
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then code := 'AUTH_REQUIRED';
  elsif not exists (select 1 from public.profiles value where value.id=actor_id and value.is_active) then code := 'AUTH_INACTIVE';
  elsif p_expected_actor_id is null or p_expected_actor_id is distinct from actor_id then code := 'AUTH_ACTOR_MISMATCH';
  end if;
  if code is not null then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code)); end if;

  if p_request_id_text is null or p_task_id_text is null
     or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_task_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_target_status is null or p_target_status not in ('in_progress','completed','canceled') then
    code := 'INVALID_REQUEST';
  else
    begin
      v_request_id := p_request_id_text::uuid;
      v_requested_task_id := p_task_id_text::uuid;
      if v_request_id::text<>p_request_id_text or v_requested_task_id::text<>p_task_id_text then code := 'INVALID_REQUEST'; end if;
    exception when others then code := 'INVALID_REQUEST';
    end;
  end if;
  if code is null and (
    (p_target_status='in_progress' and (p_cancel_reason is not null or p_completion_outcome is not null or p_note is not null))
    or (p_target_status='completed' and (p_cancel_reason is not null or (p_completion_outcome is not null and p_completion_outcome not in ('first_contact_completed','work_completed'))))
    or (p_target_status='canceled' and (p_cancel_reason is null or p_cancel_reason not in ('no_longer_needed','duplicate','source_invalidated','other') or p_completion_outcome is not null))
    or (p_note is not null and (p_note<>pg_catalog.btrim(p_note) or pg_catalog.octet_length(pg_catalog.convert_to(p_note,'UTF8')) not between 1 and 2000))
  ) then code := 'INVALID_REQUEST'; end if;
  if code is not null then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code)); end if;

  v_request_key := pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.follow_up_canonical_json(pg_catalog.jsonb_build_array('task-action-request-key.v1',v_request_id::text)),'UTF8'),'sha256'),'hex'));
  v_request_fingerprint := pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.follow_up_canonical_json(pg_catalog.jsonb_build_array(
    'task-action-request.v1',v_request_id::text,actor_id::text,v_requested_task_id::text,p_target_status,p_cancel_reason,p_completion_outcome,p_note
  )),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||pg_catalog.substr(v_request_key,1,16))::bit(64)::bigint));
  select value.* into prior_receipt from public.task_action_receipts value where value.request_key=v_request_key;
  authoritative_task_id := case when prior_receipt.id is null then v_requested_task_id else prior_receipt.task_id end;

  select value.* into task_row from public.tasks value where value.id=authoritative_task_id for update;
  if task_row.id is null or not public.task_actor_can_manage(task_row.owner_id) then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_FORBIDDEN','message','TASK_FORBIDDEN'));
  end if;
  if prior_receipt.id is not null then
    if prior_receipt.request_fingerprint = v_request_fingerprint then
      return prior_receipt.result || pg_catalog.jsonb_build_object('ok',true,'replayed',true);
    end if;
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_ACTION_IDEMPOTENCY_CONFLICT','message','TASK_ACTION_IDEMPOTENCY_CONFLICT'));
  end if;

  action_name := case p_target_status when 'in_progress' then 'start' when 'completed' then 'complete' else 'cancel' end;
  if task_row.status=p_target_status then
    receipt_outcome := 'already_at_target';
  elsif (task_row.status='pending' and p_target_status in ('in_progress','completed','canceled'))
     or (task_row.status='in_progress' and p_target_status in ('completed','canceled')) then
    receipt_outcome := 'applied';
    update public.tasks set status=p_target_status where id=task_row.id;
  else
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_INVALID_TRANSITION','message','TASK_INVALID_TRANSITION'));
  end if;

  insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,cancel_reason,completion_outcome,note,outcome,result,result_hash,result_byte_count)
  values (v_request_id,v_request_key,v_request_fingerprint,task_row.id,'human',actor_id,task_row.owner_id,action_name,task_row.status,p_target_status,p_cancel_reason,p_completion_outcome,p_note,receipt_outcome,'{}',pg_catalog.repeat('0',64),1)
  returning * into receipt_row;
  return receipt_row.result || pg_catalog.jsonb_build_object('ok',true,'replayed',false);
end;
$function$;

alter function public.task_action(text,uuid,text,text,text,text,text) owner to postgres;
revoke all on function public.task_action(text,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.task_action(text,uuid,text,text,text,text,text) to authenticated;
revoke all on function public.task_transition(uuid,text) from authenticated;

create or replace function public.task_action_automation_cancel(p_source_kind text, p_source_id uuid, p_source_key text, p_source_order bigint, p_task_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  task_row public.tasks;
  prior_receipt public.task_action_receipts;
  receipt_row public.task_action_receipts;
  v_request_key text;
  v_request_fingerprint text;
  receipt_outcome text;
begin
  if p_source_kind is null or p_source_kind !~ '^[a-z][a-z0-9_]{0,63}$'
     or p_source_id is null or p_source_key is null or p_source_key !~ '^[0-9a-f]{64}$'
     or p_source_order is null or p_source_order not between 0 and 2147483647
     or p_task_id is null then
    raise exception using errcode='P0001', message='TASK_ACTION_AUTOMATION_INVALID_REQUEST';
  end if;

  v_request_key := pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.follow_up_canonical_json(pg_catalog.jsonb_build_array(
    'task-action-automation-key.v1',p_source_kind,p_source_id::text,p_source_key,p_source_order,p_task_id::text
  )),'UTF8'),'sha256'),'hex'));
  v_request_fingerprint := pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.follow_up_canonical_json(pg_catalog.jsonb_build_array(
    'task-action-automation.v1',p_source_kind,p_source_id::text,p_source_key,p_source_order,p_task_id::text,'canceled','source_invalidated'
  )),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||pg_catalog.substr(v_request_key,1,16))::bit(64)::bigint));
  select value.* into prior_receipt from public.task_action_receipts value where value.request_key=v_request_key;
  select value.* into task_row from public.tasks value where value.id=case when prior_receipt.id is null then p_task_id else prior_receipt.task_id end for update;
  if task_row.id is null then
    raise exception using errcode='P0001', message='TASK_ACTION_AUTOMATION_TASK_NOT_FOUND';
  end if;
  if prior_receipt.id is not null then
    if prior_receipt.request_fingerprint <> v_request_fingerprint then
      raise exception using errcode='P0001', message='TASK_ACTION_IDEMPOTENCY_CONFLICT';
    end if;
    return prior_receipt.result || pg_catalog.jsonb_build_object('ok',true,'replayed',true);
  end if;

  if task_row.status='canceled' then
    receipt_outcome := 'already_at_target';
  elsif task_row.status='completed' then
    receipt_outcome := 'not_applicable_terminal';
  else
    receipt_outcome := 'applied';
    update public.tasks set status='canceled' where id=task_row.id;
  end if;
  insert into public.task_action_receipts(request_id,request_key,request_fingerprint,task_id,actor_kind,actor_id,owner_id,action,from_status,target_status,cancel_reason,completion_outcome,note,source_kind,source_id,source_key,source_order,outcome,result,result_hash,result_byte_count)
  values (null,v_request_key,v_request_fingerprint,task_row.id,'automation',null,task_row.owner_id,'cancel',task_row.status,'canceled','source_invalidated',null,null,p_source_kind,p_source_id,p_source_key,p_source_order,receipt_outcome,'{}',pg_catalog.repeat('0',64),1)
  returning * into receipt_row;
  return receipt_row.result || pg_catalog.jsonb_build_object('ok',true,'replayed',false);
end;
$function$;

alter function public.task_action_automation_cancel(text,uuid,text,bigint,uuid) owner to postgres;
revoke all on function public.task_action_automation_cancel(text,uuid,text,bigint,uuid) from public,anon,authenticated,service_role;

/* Forward rollback disables new execution, retains audit/status, and keeps legacy execution revoked. */
commit;
