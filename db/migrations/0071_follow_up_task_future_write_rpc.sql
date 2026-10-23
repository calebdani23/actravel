begin;

create or replace function public.register_follow_up_action(p_request_id_text text, p_expected_actor_id uuid, p_lead_id_text text, p_note_body text, p_due_at text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  actor_id uuid := auth.uid();
  request_id uuid;
  request_lead_id uuid;
  lead_row public.leads;
  owner_row public.profiles;
  task_row public.tasks;
  active_task public.tasks;
  source_event public.lead_events;
  replay jsonb;
  event_payload jsonb;
  note_id uuid;
  task_id uuid;
  note_body text;
  normalized_due_at text;
  request_fingerprint text;
  request_key text;
  event_time timestamptz;
  outcome text;
  task_status text;
  code text;
  lock_preimage text;
  actor_is_admin boolean;
  actor_is_asesor boolean;
  owner_roles_valid boolean;
  active_count integer := 0;
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then
    code := 'AUTH_REQUIRED';
  elsif not exists (select 1 from public.profiles p where p.id=actor_id and p.is_active) then
    code := 'AUTH_INACTIVE';
  else
    select exists (select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=actor_id and r.name='admin'),
      exists (select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=actor_id and r.name='asesor')
      into actor_is_admin,actor_is_asesor;
    if not actor_is_admin and not actor_is_asesor then code := 'AUTH_FORBIDDEN'; end if;
  end if;
  if code is null and (p_expected_actor_id is null or p_expected_actor_id is distinct from actor_id) then code := 'AUTH_ACTOR_MISMATCH'; end if;
  if code is not null then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code)); end if;

  if p_request_id_text is null or p_lead_id_text is null or p_note_body is null
     or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_lead_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    code := 'INVALID_REQUEST';
  else
    begin
      request_id := p_request_id_text::uuid;
      request_lead_id := p_lead_id_text::uuid;
      if request_id::text<>p_request_id_text or request_lead_id::text<>p_lead_id_text then code := 'INVALID_REQUEST'; end if;
    exception when others then code := 'INVALID_REQUEST';
    end;
  end if;
  note_body := pg_catalog.btrim(p_note_body);
  normalized_due_at := public.normalize_follow_up_write_due_at(p_due_at);
  if code is null and (note_body='' or (p_due_at is not null and normalized_due_at is null)) then code := 'INVALID_REQUEST'; end if;
  if code is null and pg_catalog.octet_length(pg_catalog.convert_to(note_body,'UTF8'))>4000 then code := 'LIMIT_EXCEEDED'; end if;
  if code is not null then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code)); end if;

  lock_preimage := 'follow-up-write:request:v1|'||request_id::text;
  perform pg_catalog.pg_advisory_xact_lock((('x'||pg_catalog.substr(pg_catalog.encode(extensions.digest(pg_catalog.convert_to(lock_preimage,'UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint));
  replay := public.read_follow_up_write_replay(request_id,actor_id,request_lead_id,note_body,normalized_due_at);
  if replay is not null then return replay; end if;

  select value.* into lead_row from public.leads value where value.id=request_lead_id for update;
  if not found or lead_row.deleted_at is not null or lead_row.archived_at is not null then
    code := 'LEAD_NOT_OPERATIONAL';
  elsif not actor_is_admin and lead_row.assigned_to is distinct from actor_id then
    code := 'AUTH_FORBIDDEN';
  elsif lead_row.assigned_to is null then
    code := 'OWNER_CONTEXT_INVALID';
  end if;
  if code is not null then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',code,'message',code)); end if;

  select value.* into owner_row from public.profiles value where value.id=lead_row.assigned_to for update;
  perform 1 from public.profile_roles pr where pr.profile_id=lead_row.assigned_to order by pr.role_id for update;
  perform 1 from public.roles r join public.profile_roles pr on pr.role_id=r.id where pr.profile_id=lead_row.assigned_to order by r.id for share of r;
  select count(*)>0 and pg_catalog.bool_and(r.name in ('admin','manager','asesor')) into owner_roles_valid
    from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=lead_row.assigned_to;
  if owner_row.id is null or not owner_row.is_active or not coalesce(owner_roles_valid,false) then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','OWNER_CONTEXT_INVALID','message','OWNER_CONTEXT_INVALID'));
  end if;

  if normalized_due_at is null then
    outcome := 'history_only';
  else
  request_key := pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to('follow-up-task:v1|source_event_id='||request_id::text,'UTF8'),'sha256'),'hex'));
  for task_row in select t.* from public.tasks t
    where (t.lead_id=request_lead_id and t.status in ('pending','in_progress')) or t.source_event_id=request_id
      or (t.owner_id=lead_row.assigned_to and t.idempotency_key=request_key)
    order by t.id for update
  loop
    if task_row.source_event_id=request_id or (task_row.owner_id=lead_row.assigned_to and task_row.idempotency_key=request_key) then
      return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_OCCUPANCY_CONFLICT','message','TASK_OCCUPANCY_CONFLICT'));
    end if;
    if task_row.lead_id=request_lead_id and task_row.status in ('pending','in_progress') then
      active_count := active_count+1;
      active_task := task_row;
    end if;
  end loop;
  if active_count>1 then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_OCCUPANCY_CONFLICT','message','TASK_OCCUPANCY_CONFLICT'));
  end if;
  if active_count=1 then
    select value.* into source_event from public.lead_events value where value.id=active_task.source_event_id;
    if active_task.owner_id<>lead_row.assigned_to or active_task.task_kind<>'follow_up' or active_task.quote_id is not null
       or active_task.description<>'Follow up with lead' or active_task.source_event_type<>'follow_up_registered' or source_event.id is null
       or active_task.source_event_created_at<>source_event.created_at or source_event.lead_id<>request_lead_id or source_event.event_type<>active_task.source_event_type
       or active_task.idempotency_key<>pg_catalog.lower(pg_catalog.encode(extensions.digest(pg_catalog.convert_to('follow-up-task:v1|source_event_id='||active_task.source_event_id::text,'UTF8'),'sha256'),'hex'))
       or active_task.metadata<>pg_catalog.jsonb_build_object('schema','follow_up_task.v1','source_event_id',active_task.source_event_id::text,'source_event_type','follow_up_registered','owner_id',active_task.owner_id::text,'lead_id',request_lead_id::text)
       or public.normalize_follow_up_write_due_at(active_task.source_payload->>'followUpAt')::timestamptz is distinct from active_task.source_due_at
       or active_task.source_payload->'hasNote' is distinct from source_event.payload->'hasNote'
       or active_task.source_payload->'followUpAt' is distinct from source_event.payload->'followUpAt' then
      return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','TASK_OCCUPANCY_CONFLICT','message','TASK_OCCUPANCY_CONFLICT'));
    end if;
    task_id := active_task.id;
    task_status := active_task.status;
    outcome := 'rescheduled';
  else
    task_id := extensions.gen_random_uuid();
    task_status := 'pending';
    outcome := 'created';
  end if;
  end if;

  event_time := pg_catalog.date_trunc('microseconds',pg_catalog.transaction_timestamp());
  insert into public.lead_notes(lead_id,author_id,body,is_internal) values (request_lead_id,actor_id,note_body,true) returning id into note_id;
  request_fingerprint := public.follow_up_write_request_fingerprint(request_id,actor_id,request_lead_id,note_body,normalized_due_at);
  event_payload := pg_catalog.jsonb_build_object('schema','follow-up-write.v1','requestId',request_id,'requestFingerprint',request_fingerprint,
    'noteId',note_id,'taskId',task_id,'outcome',outcome,'followUpAt',normalized_due_at,'hasNote',true);
  insert into public.lead_events(id,lead_id,actor_id,event_type,payload,created_at)
    values (request_id,request_lead_id,actor_id,'follow_up_registered',event_payload,event_time);
  if outcome='rescheduled' then
    update public.tasks set due_at=normalized_due_at::timestamptz,updated_at=event_time where id=task_id returning status into task_status;
  elsif outcome='created' then
    insert into public.tasks(id,owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,source_event_id,source_event_type,source_event_created_at,source_due_at,source_payload,metadata)
    values (task_id,lead_row.assigned_to,request_lead_id,null,'Follow up with lead',normalized_due_at::timestamptz,'pending',request_key,'follow_up',request_id,
      'follow_up_registered',event_time,normalized_due_at::timestamptz,event_payload,pg_catalog.jsonb_build_object('schema','follow_up_task.v1','source_event_id',request_id::text,
      'source_event_type','follow_up_registered','owner_id',lead_row.assigned_to::text,'lead_id',request_lead_id::text));
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'outcome',outcome,'requestId',request_id,'noteId',note_id,'eventId',request_id,
    'taskId',task_id,'taskStatus',task_status,'dueAt',normalized_due_at,'replayed',false);
end;
$function$;

alter function public.register_follow_up_action(text,uuid,text,text,text) owner to postgres;
revoke all on function public.register_follow_up_action(text,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.register_follow_up_action(text,uuid,text,text,text) to authenticated;

-- rollback after caller removal: revoke all on function public.register_follow_up_action(text,uuid,text,text,text) from public,anon,authenticated,service_role;
-- rollback after caller removal: drop function public.register_follow_up_action(text,uuid,text,text,text); retain committed rows and 0070 helpers.

commit;
