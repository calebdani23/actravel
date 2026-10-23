begin;

create or replace function public.normalize_follow_up_write_due_at(p_due_at text)
returns text language plpgsql immutable security invoker set search_path = '' as $function$
declare
  parsed timestamptz;
  utc_value timestamp;
  zone text;
begin
  if p_due_at is null then return null; end if;
  if p_due_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
     or pg_catalog.substr(p_due_at,1,4)::integer not between 1970 and 9999
     or pg_catalog.substr(p_due_at,6,2)::integer not between 1 and 12
     or pg_catalog.substr(p_due_at,9,2)::integer not between 1 and 31
     or pg_catalog.substr(p_due_at,12,2)::integer > 23
     or pg_catalog.substr(p_due_at,15,2)::integer > 59
     or pg_catalog.substr(p_due_at,18,2)::integer > 59 then return null;
  end if;
  zone := case when p_due_at ~ 'Z$' then 'Z' else pg_catalog.right(p_due_at,6) end;
  if zone <> 'Z' and (pg_catalog.substr(zone,2,2)::integer > 14
     or pg_catalog.substr(zone,5,2)::integer > 59
     or (pg_catalog.substr(zone,2,2)::integer = 14 and pg_catalog.substr(zone,5,2) <> '00')
     or zone = '-00:00') then return null;
  end if;
  parsed := p_due_at::timestamptz;
  utc_value := parsed at time zone 'UTC';
  if extract(year from utc_value) not between 1970 and 9999 then return null; end if;
  return pg_catalog.to_char(utc_value,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
exception when others then return null;
end;
$function$;

create or replace function public.follow_up_write_request_fingerprint(p_request_id uuid, p_actor_id uuid, p_lead_id uuid, p_note_body text, p_due_at text)
returns text language sql immutable security invoker set search_path = '' as $function$
  select case when p_request_id is null or p_actor_id is null or p_lead_id is null or p_note_body is null then null else
    lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(pg_catalog.jsonb_build_array(
      'follow-up-write-request.v1',p_request_id::text,p_actor_id::text,p_lead_id::text,p_note_body,p_due_at
    )),'UTF8'),'sha256'),'hex')) end;
$function$;

create or replace function public.read_follow_up_write_replay(p_request_id uuid, p_actor_id uuid, p_lead_id uuid, p_note_body text, p_due_at text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare
  event_row public.lead_events;
  source_event public.lead_events;
  note_row public.lead_notes;
  task_row public.tasks;
  payload jsonb;
  outcome text;
  note_id uuid;
  task_id uuid;
  normalized_due text := public.normalize_follow_up_write_due_at(p_due_at);
  recorded_fingerprint text;
  expected_fingerprint text;
begin
  select value.* into event_row from public.lead_events value where value.id=p_request_id;
  if not found then return null; end if;
  payload := event_row.payload;
  if pg_catalog.jsonb_typeof(payload)<>'object' or (select count(*) from pg_catalog.jsonb_object_keys(payload))<>8
     or not (payload ?& array['schema','requestId','requestFingerprint','noteId','taskId','outcome','followUpAt','hasNote'])
     or payload-array['schema','requestId','requestFingerprint','noteId','taskId','outcome','followUpAt','hasNote']<>'{}'::jsonb
     or payload->>'schema'<>'follow-up-write.v1' or payload->>'requestId'<>event_row.id::text
     or payload->>'requestFingerprint' !~ '^[0-9a-f]{64}$'
     or payload->>'noteId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (payload->>'noteId')::uuid::text<>payload->>'noteId'
     or pg_catalog.jsonb_typeof(payload->'taskId') not in ('string','null')
     or pg_catalog.jsonb_typeof(payload->'followUpAt') not in ('string','null')
     or payload->'hasNote'<>'true'::jsonb or event_row.event_type<>'follow_up_registered'
     or event_row.actor_id is null then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
  end if;
  note_id := (payload->>'noteId')::uuid;
  select value.* into note_row from public.lead_notes value where value.id=note_id;
  if not found or note_row.lead_id<>event_row.lead_id or note_row.author_id<>event_row.actor_id
     or note_row.is_internal is not true then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
  end if;
  recorded_fingerprint := public.follow_up_write_request_fingerprint(event_row.id,event_row.actor_id,event_row.lead_id,note_row.body,payload->>'followUpAt');
  if recorded_fingerprint is distinct from payload->>'requestFingerprint' then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
  end if;
  expected_fingerprint := public.follow_up_write_request_fingerprint(p_request_id,p_actor_id,p_lead_id,pg_catalog.btrim(p_note_body),normalized_due);
  if expected_fingerprint is distinct from recorded_fingerprint then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','IDEMPOTENCY_CONFLICT','message','IDEMPOTENCY_CONFLICT'));
  end if;
  if event_row.actor_id<>p_actor_id or event_row.lead_id<>p_lead_id
     or (payload->>'followUpAt' is not null and public.normalize_follow_up_write_due_at(payload->>'followUpAt') is distinct from payload->>'followUpAt') then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
  end if;
  outcome := payload->>'outcome';
  if outcome='history_only' then
    if payload->>'followUpAt' is not null or payload->>'taskId' is not null then
      return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
    end if;
  elsif outcome in ('created','rescheduled') then
    if payload->>'followUpAt' is null or payload->>'taskId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or (payload->>'taskId')::uuid::text<>payload->>'taskId' then
      return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
    end if;
    task_id := (payload->>'taskId')::uuid;
    select value.* into task_row from public.tasks value where value.id=task_id;
    if not found then return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE')); end if;
    select value.* into source_event from public.lead_events value where value.id=task_row.source_event_id;
    if not found or task_row.owner_id is null or task_row.lead_id<>event_row.lead_id or task_row.quote_id is not null
       or task_row.description<>'Follow up with lead' or task_row.task_kind<>'follow_up' or task_row.source_event_type<>'follow_up_registered'
       or task_row.source_event_created_at<>source_event.created_at or source_event.lead_id<>task_row.lead_id or source_event.event_type<>task_row.source_event_type
       or task_row.idempotency_key<>lower(encode(extensions.digest(convert_to('follow-up-task:v1|source_event_id='||task_row.source_event_id::text,'UTF8'),'sha256'),'hex'))
       or task_row.metadata<>pg_catalog.jsonb_build_object('schema','follow_up_task.v1','source_event_id',task_row.source_event_id::text,'source_event_type','follow_up_registered','owner_id',task_row.owner_id::text,'lead_id',task_row.lead_id::text)
       or public.normalize_follow_up_write_due_at(task_row.source_payload->>'followUpAt')::timestamptz is distinct from task_row.source_due_at
       or task_row.source_payload->'hasNote' is distinct from source_event.payload->'hasNote'
       or task_row.source_payload->'followUpAt' is distinct from source_event.payload->'followUpAt'
       or (outcome='created' and (task_row.source_event_id<>event_row.id or task_row.source_payload<>payload))
       or (outcome='rescheduled' and task_row.source_event_id=event_row.id) then
      return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
    end if;
  else
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'outcome',outcome,'requestId',event_row.id,'noteId',note_id,'eventId',event_row.id,
    'taskId',task_id,'taskStatus',case when task_id is null then null else task_row.status end,'dueAt',payload->'followUpAt','replayed',true);
exception when others then
  return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','REPLAY_INTEGRITY_FAILURE','message','REPLAY_INTEGRITY_FAILURE'));
end;
$function$;

alter function public.normalize_follow_up_write_due_at(text) owner to postgres;
alter function public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text) owner to postgres;
alter function public.read_follow_up_write_replay(uuid,uuid,uuid,text,text) owner to postgres;
revoke all on function public.normalize_follow_up_write_due_at(text) from public,anon,authenticated,service_role;
revoke all on function public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.read_follow_up_write_replay(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;

-- rollback: drop function public.read_follow_up_write_replay(uuid,uuid,uuid,text,text);
-- rollback: drop function public.follow_up_write_request_fingerprint(uuid,uuid,uuid,text,text);
-- rollback: drop function public.normalize_follow_up_write_due_at(text);

commit;
