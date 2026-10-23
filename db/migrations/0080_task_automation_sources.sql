begin;

create table public.task_automation_source_cutoffs (
  source_kind text primary key check (source_kind in ('opportunity_assignment','quote_sent')),
  cutoff_at timestamptz not null,
  constraint task_automation_source_cutoffs_time_check check (
    pg_catalog.isfinite(cutoff_at) and date_trunc('microseconds',cutoff_at)=cutoff_at
  )
);
insert into public.task_automation_source_cutoffs(source_kind,cutoff_at)
values ('opportunity_assignment',date_trunc('microseconds',statement_timestamp())),
       ('quote_sent',date_trunc('microseconds',statement_timestamp()));

create table public.task_automation_tombstones (
  tombstone_key text primary key check (tombstone_key ~ '^[0-9a-f]{64}$'),
  source_kind text not null check (source_kind ~ '^[a-z][a-z0-9_]{0,63}$'),
  source_id uuid not null,
  source_key text not null check (source_key ~ '^[0-9a-f]{64}$'),
  source_order bigint not null check (source_order between 0 and 2147483647),
  origin_key text not null unique check (origin_key ~ '^[0-9a-f]{64}$'),
  reason text not null check (reason in ('pre_cutoff','source_invalidated')),
  created_at timestamptz not null default date_trunc('microseconds',clock_timestamp()),
  constraint task_automation_tombstones_source_key unique (source_kind,source_id,source_key,source_order),
  constraint task_automation_tombstones_key_check check (
    tombstone_key=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
      'task-automation-tombstone.v1',source_kind,source_id::text,source_key,source_order,origin_key,reason
    )),'UTF8'),'sha256'),'hex'))
  ),
  constraint task_automation_tombstones_time_check check (
    pg_catalog.isfinite(created_at) and date_trunc('microseconds',created_at)=created_at
  )
);

create or replace function public.prevent_task_automation_source_state_change()
returns trigger language plpgsql set search_path = public as $function$
begin
  if tg_table_name='task_automation_tombstones' then
    raise exception using errcode='PT002', message='TASK_AUTOMATION_TOMBSTONE_IMMUTABLE';
  end if;
  raise exception using errcode='PT002', message='TASK_AUTOMATION_CUTOFF_IMMUTABLE';
end;
$function$;
create trigger prevent_task_automation_cutoff_change before update or delete on public.task_automation_source_cutoffs
for each row execute function public.prevent_task_automation_source_state_change();
create trigger prevent_task_automation_tombstone_change before update or delete on public.task_automation_tombstones
for each row execute function public.prevent_task_automation_source_state_change();

create or replace function public.task_automation_generate_first_contact()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_assignment_at timestamptz := pg_catalog.date_trunc('microseconds',pg_catalog.statement_timestamp());
  v_anchor_at timestamptz;
  v_cutoff_at timestamptz;
  v_due_at timestamptz;
  v_origin_key text;
  v_source_key text;
  v_source_order bigint;
  v_tombstone_key text;
begin
  if new.assigned_to is null or new.archived_at is not null
     or exists (select 1 from public.lead_statuses value where value.id=new.status_id and value.is_terminal)
     or (tg_op='UPDATE' and new.assigned_to is not distinct from old.assigned_to) then return new; end if;
  v_origin_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation:v1','first_contact',new.id::text)
  ),'UTF8'),'sha256'),'hex'));
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1','opportunity_assignment',new.id::text,new.assigned_to::text,
      to_char(v_assignment_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
  ),'UTF8'),'sha256'),'hex'));

  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_source_key,1,16))::bit(64)::bigint));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_origin_key,1,16))::bit(64)::bigint));
  if exists (select 1 from public.task_automation_tombstones value where value.origin_key=v_origin_key) then return new; end if;
  select coalesce(max(value.source_order),0)+1 into v_source_order from (
    select source_order from public.task_automation_outcomes where origin_key=v_origin_key
    union all select source_order from public.task_automation_tombstones where origin_key=v_origin_key
  ) value;
  if exists (select 1 from public.task_automation_origins value where value.origin_key=v_origin_key) then
    perform public.task_automation_project(
      'opportunity_assignment',new.id,v_source_key,v_source_order,'transfer',v_origin_key,
      null,new.assigned_to,null,null,null,null,null,null,null
    );
    return new;
  end if;
  select value.cutoff_at into strict v_cutoff_at from public.task_automation_source_cutoffs value
    where value.source_kind='opportunity_assignment';

  if tg_op='UPDATE' and old.assigned_to is not null and old.created_at<v_cutoff_at then
    v_tombstone_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
      'task-automation-tombstone.v1','opportunity_assignment',new.id::text,v_source_key,v_source_order,v_origin_key,'pre_cutoff'
    )),'UTF8'),'sha256'),'hex'));
    insert into public.task_automation_tombstones(tombstone_key,source_kind,source_id,source_key,source_order,origin_key,reason)
    values (v_tombstone_key,'opportunity_assignment',new.id,v_source_key,v_source_order,v_origin_key,'pre_cutoff')
    on conflict (origin_key) do nothing;
    return new;
  end if;

  v_anchor_at := greatest(pg_catalog.date_trunc('microseconds',new.created_at),v_assignment_at);
  v_due_at := public.task_automation_due_at('first_contact',v_anchor_at,'mx-calendar.v1');
  perform public.task_automation_project(
    'opportunity_assignment',new.id,v_source_key,v_source_order,'generate',v_origin_key,
    'first_contact',new.assigned_to,new.id,null,null,null,v_anchor_at,v_due_at,'mx-calendar.v1'
  );
  return new;
end;
$function$;
create trigger generate_first_contact_on_assignment
after insert or update of assigned_to on public.leads
for each row execute function public.task_automation_generate_first_contact();

create or replace function public.task_automation_invalidate_first_contact()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_source_kind text;
  v_source_at timestamptz := pg_catalog.date_trunc('microseconds',pg_catalog.statement_timestamp());
  v_source_key text;
  v_source_order bigint;
  v_origin_key text;
  v_tombstone_key text;
  v_assignment_changed boolean := tg_op='UPDATE' and new.assigned_to is distinct from old.assigned_to;
  v_old_terminal boolean := false;
  v_new_terminal boolean;
begin
  select coalesce(value.is_terminal,false) into v_new_terminal from public.lead_statuses value where value.id=new.status_id;
  if tg_op='UPDATE' then select coalesce(value.is_terminal,false) into v_old_terminal from public.lead_statuses value where value.id=old.status_id; end if;
  if tg_op='UPDATE' and old.assigned_to is not null and new.assigned_to is null then v_source_kind := 'opportunity_unassigned';
  elsif new.archived_at is not null and (tg_op='INSERT' or old.archived_at is null or v_assignment_changed) then v_source_kind := 'opportunity_archived';
  elsif v_new_terminal and (tg_op='INSERT' or not v_old_terminal or v_assignment_changed) then v_source_kind := 'opportunity_terminal';
  else return new;
  end if;

  v_origin_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation:v1','first_contact',new.id::text)
  ),'UTF8'),'sha256'),'hex'));
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1',v_source_kind,new.id::text,
      to_char(v_source_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
  ),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_source_key,1,16))::bit(64)::bigint));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_origin_key,1,16))::bit(64)::bigint));
  if exists (select 1 from public.task_automation_tombstones value where value.origin_key=v_origin_key) then return new; end if;
  select coalesce(max(value.source_order),0)+1 into v_source_order from (
    select source_order from public.task_automation_outcomes where origin_key=v_origin_key
    union all select source_order from public.task_automation_tombstones where origin_key=v_origin_key
  ) value;
  if exists (select 1 from public.task_automation_origins value where value.origin_key=v_origin_key) then
    perform public.task_automation_project(v_source_kind,new.id,v_source_key,v_source_order,'cancel',v_origin_key,
      null,null,null,null,null,null,null,null,null);
  else
    v_tombstone_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
      'task-automation-tombstone.v1',v_source_kind,new.id::text,v_source_key,v_source_order,v_origin_key,'source_invalidated'
    )),'UTF8'),'sha256'),'hex'));
    insert into public.task_automation_tombstones(tombstone_key,source_kind,source_id,source_key,source_order,origin_key,reason)
    values (v_tombstone_key,v_source_kind,new.id,v_source_key,v_source_order,v_origin_key,'source_invalidated');
  end if;
  return new;
end;
$function$;
create trigger first_contact_invalidation_before_generation
after insert or update of assigned_to,archived_at,status_id on public.leads
for each row execute function public.task_automation_invalidate_first_contact();

create or replace function public.enforce_first_contact_completion_receipt()
returns trigger language plpgsql set search_path = public as $function$
begin
  if new.action='complete' and new.target_status='completed'
     and exists (select 1 from public.tasks value where value.id=new.task_id and value.task_kind='first_contact')
     and new.completion_outcome is distinct from 'first_contact_completed' then
    raise exception using errcode='PT002', message='TASK_FIRST_CONTACT_COMPLETION_REQUIRED';
  end if;
  return new;
end;
$function$;
create trigger enforce_first_contact_completion_receipt before insert on public.task_action_receipts
for each row execute function public.enforce_first_contact_completion_receipt();

create or replace function public.task_automation_generate_quote_follow_up()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_quote_version_id uuid := new.quote_version_id;
  v_first_event_id uuid;
  v_first_event_at timestamptz;
  v_source_id uuid;
  v_source_key text;
  v_source_order bigint;
  v_origin_key text;
  v_quote_id uuid;
  v_owner_id uuid;
  v_sent_at timestamptz;
  v_due_at timestamptz;
  v_cutoff_at timestamptz;
  v_tombstone_key text;
  v_constraint_name text;
begin
  if new.event_type<>'quote_sent' or v_quote_version_id is null then return new; end if;
  select value.id,pg_catalog.date_trunc('microseconds',value.created_at)
    into v_first_event_id,v_first_event_at
    from public.quote_events value
    where value.quote_version_id=v_quote_version_id and value.event_type='quote_sent'
    order by value.created_at,value.id limit 1;
  if v_first_event_id is null then
    v_first_event_id := new.id;
    v_first_event_at := pg_catalog.date_trunc('microseconds',new.created_at);
  end if;
  if exists (select 1 from public.task_automation_origins value
    where value.task_kind='quote_follow_up' and value.quote_version_id=v_quote_version_id) then return new; end if;

  v_origin_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation:v1','quote_follow_up',v_quote_version_id::text,v_first_event_id::text)
  ),'UTF8'),'sha256'),'hex'));
  if exists (select 1 from public.task_automation_tombstones value where value.origin_key=v_origin_key) then return new; end if;
  select pg_catalog.date_trunc('microseconds',value.sent_at),value.quote_id,q.owner_id
    into strict v_sent_at,v_quote_id,v_owner_id
    from public.quote_versions value join public.quotes q on q.id=value.quote_id
    where value.id=v_quote_version_id and value.status='sent' and value.sent_at is not null and q.deleted_at is null;
  select value.cutoff_at into strict v_cutoff_at from public.task_automation_source_cutoffs value
    where value.source_kind='quote_sent';

  v_source_id := case when v_first_event_at<v_cutoff_at then v_first_event_id else new.id end;
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1','quote_sent',v_quote_version_id::text,v_source_id::text)
  ),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_source_key,1,16))::bit(64)::bigint));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_origin_key,1,16))::bit(64)::bigint));
  if exists (select 1 from public.task_automation_tombstones value where value.origin_key=v_origin_key) then return new; end if;
  select coalesce(max(value.source_order),0)+1 into v_source_order from (
    select source_order from public.task_automation_outcomes where origin_key=v_origin_key
    union all select source_order from public.task_automation_tombstones where origin_key=v_origin_key
  ) value;

  if v_first_event_at<v_cutoff_at then
    v_tombstone_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
      'task-automation-tombstone.v1','quote_sent',v_source_id::text,v_source_key,v_source_order,v_origin_key,'pre_cutoff'
    )),'UTF8'),'sha256'),'hex'));
    insert into public.task_automation_tombstones(tombstone_key,source_kind,source_id,source_key,source_order,origin_key,reason)
    values (v_tombstone_key,'quote_sent',v_source_id,v_source_key,v_source_order,v_origin_key,'pre_cutoff')
    on conflict (origin_key) do nothing;
    return new;
  end if;

  v_due_at := public.task_automation_due_at('quote_follow_up',v_sent_at,'elapsed-48h.v1');
  begin
    perform public.task_automation_project(
      'quote_sent',v_source_id,v_source_key,v_source_order,'generate',v_origin_key,
      'quote_follow_up',v_owner_id,null,v_quote_id,v_quote_version_id,v_first_event_id,
      v_sent_at,v_due_at,'elapsed-48h.v1'
    );
  exception when unique_violation then
    get stacked diagnostics v_constraint_name=constraint_name;
    if v_constraint_name<>'task_automation_origins_quote_version_key' then raise; end if;
  end;
  return new;
end;
$function$;
create trigger generate_quote_follow_up_on_sent
before insert on public.quote_events
for each row execute function public.task_automation_generate_quote_follow_up();

create or replace function public.task_automation_cancel_quote_follow_up(
  p_source_kind text,p_source_id uuid,p_source_key text,p_quote_version_id uuid
)
returns void language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_first_event_id uuid;
  v_origin_key text;
  v_source_order bigint;
  v_tombstone_key text;
  v_has_origin boolean;
begin
  if p_source_kind not in ('quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded','whatsapp_inbound','payment_verified')
     or p_source_id is null or p_source_key !~ '^[0-9a-f]{64}$' or p_quote_version_id is null then
    raise exception using errcode='P0001', message='TASK_QUOTE_CANCELLATION_INVALID_REQUEST';
  end if;
  select value.origin_key into v_origin_key from public.task_automation_origins value
    where value.task_kind='quote_follow_up' and value.quote_version_id=p_quote_version_id;
  if v_origin_key is null then
    select value.id into v_first_event_id from public.quote_events value
      where value.quote_version_id=p_quote_version_id and value.event_type='quote_sent'
      order by value.created_at,value.id limit 1;
    if v_first_event_id is null then return; end if;
    v_origin_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
      jsonb_build_array('task-automation:v1','quote_follow_up',p_quote_version_id::text,v_first_event_id::text)
    ),'UTF8'),'sha256'),'hex'));
  end if;

  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(p_source_key,1,16))::bit(64)::bigint));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_origin_key,1,16))::bit(64)::bigint));
  if exists (select 1 from public.task_automation_outcomes value
      where value.source_kind=p_source_kind and value.source_id=p_source_id and value.source_key=p_source_key)
     or exists (select 1 from public.task_automation_tombstones value
      where value.source_kind=p_source_kind and value.source_id=p_source_id and value.source_key=p_source_key) then return; end if;
  select coalesce(max(value.source_order),0)+1 into v_source_order from (
    select source_order from public.task_automation_outcomes where origin_key=v_origin_key
    union all select source_order from public.task_automation_tombstones where origin_key=v_origin_key
  ) value;
  select exists (select 1 from public.task_automation_origins value
    where value.origin_key=v_origin_key and value.quote_version_id=p_quote_version_id) into v_has_origin;
  if v_has_origin then
    perform public.task_automation_project(p_source_kind,p_source_id,p_source_key,v_source_order,'cancel',v_origin_key,
      null,null,null,null,null,null,null,null,null);
  else
    v_tombstone_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
      'task-automation-tombstone.v1',p_source_kind,p_source_id::text,p_source_key,v_source_order,v_origin_key,'source_invalidated'
    )),'UTF8'),'sha256'),'hex'));
    insert into public.task_automation_tombstones(tombstone_key,source_kind,source_id,source_key,source_order,origin_key,reason)
    values (v_tombstone_key,p_source_kind,p_source_id,p_source_key,v_source_order,v_origin_key,'source_invalidated')
    on conflict (origin_key) do nothing;
    perform public.task_automation_project(p_source_kind,p_source_id,p_source_key,v_source_order,'suppress',v_origin_key,
      null,null,null,null,null,null,null,null,null);
  end if;
end;
$function$;

create or replace function public.task_automation_cancel_quote_response()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare v_source_key text;
begin
  if new.event_type<>'quote_version_response' then return new; end if;
  if new.quote_version_id is null or new.actor_id is null or new.idempotency_key is distinct from 'quote-version-response:'||new.id::text
     or (new.payload-array['schema','requestId','quoteId','quoteVersionId','channel','actorId'])<>'{}'::jsonb
     or not (new.payload ?& array['schema','requestId','quoteId','quoteVersionId','channel','actorId'])
     or new.payload->>'schema' is distinct from 'quote-version-response.v1' or new.payload->>'requestId' is distinct from new.id::text
     or new.payload->>'quoteId' is distinct from new.quote_id::text or new.payload->>'quoteVersionId' is distinct from new.quote_version_id::text
     or new.payload->>'actorId' is distinct from new.actor_id::text or new.payload->>'channel' is null
     or new.payload->>'channel' not in ('phone','email','whatsapp','portal','other') then
    raise exception using errcode='P0001', message='TASK_QUOTE_RESPONSE_INVALID_PAYLOAD';
  end if;
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1','quote_version_response',new.quote_version_id::text,new.id::text)
  ),'UTF8'),'sha256'),'hex'));
  perform public.task_automation_cancel_quote_follow_up('quote_version_response',new.id,v_source_key,new.quote_version_id);
  return new;
end;
$function$;
create trigger cancel_quote_follow_up_on_response after insert on public.quote_events
for each row execute function public.task_automation_cancel_quote_response();

create or replace function public.task_automation_cancel_quote_terminal()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare v_source_kind text; v_source_key text;
begin
  if new.status is not distinct from old.status or new.status not in ('accepted','rejected','expired','cancelled','superseded') then return new; end if;
  v_source_kind := case new.status when 'accepted' then 'quote_accepted' when 'rejected' then 'quote_rejected'
    when 'expired' then 'quote_expired' when 'cancelled' then 'quote_cancelled' else 'quote_superseded' end;
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1',v_source_kind,new.id::text,new.status)
  ),'UTF8'),'sha256'),'hex'));
  perform public.task_automation_cancel_quote_follow_up(v_source_kind,new.id,v_source_key,new.id);
  return new;
end;
$function$;
create trigger cancel_quote_follow_up_on_terminal after update of status on public.quote_versions
for each row execute function public.task_automation_cancel_quote_terminal();

create or replace function public.task_automation_cancel_quote_whatsapp()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_occurrence_key text;
  v_source_key text;
  v_quote_version_ids uuid[];
  v_quote_version_id uuid;
  v_origin_key text;
  v_source_order bigint;
  v_outcome_key text;
begin
  if new.event_type<>'whatsapp_inbound_received' then return new; end if;
  v_occurrence_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source-lock.v1','whatsapp_inbound',new.id::text,new.lead_id::text)
  ),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_occurrence_key,1,16))::bit(64)::bigint));
  perform 1 from public.contacts value where value.id=(select lead_value.contact_id from public.leads lead_value where lead_value.id=new.lead_id) for update;
  perform 1 from public.leads value where value.id=new.lead_id for update;
  perform 1 from public.quotes value where value.lead_id=new.lead_id order by value.id for update;
  perform 1 from public.quote_versions value join public.quotes quote_value on quote_value.id=value.quote_id
    where quote_value.lead_id=new.lead_id order by value.quote_id,value.version_number,value.id for update of value;
  select array_agg(value.id order by value.quote_id,value.version_number,value.id) into v_quote_version_ids
    from public.quote_versions value join public.quotes quote_value on quote_value.id=value.quote_id
    where quote_value.lead_id=new.lead_id and quote_value.deleted_at is null and value.status='sent' and value.sent_at is not null;
  if cardinality(coalesce(v_quote_version_ids,'{}'::uuid[]))=1 then v_quote_version_id := v_quote_version_ids[1]; end if;
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1','whatsapp_inbound',new.id::text,new.lead_id::text,v_quote_version_id::text)
  ),'UTF8'),'sha256'),'hex'));
  if v_quote_version_id is not null then
    perform public.task_automation_cancel_quote_follow_up('whatsapp_inbound',new.id,v_source_key,v_quote_version_id);
    return new;
  end if;

  v_origin_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation:v1','quote_follow_up_ambiguous',new.lead_id::text,new.id::text)
  ),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_source_key,1,16))::bit(64)::bigint));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(v_origin_key,1,16))::bit(64)::bigint));
  if exists (select 1 from public.task_automation_outcomes value
    where value.source_kind='whatsapp_inbound' and value.source_id=new.id and value.source_key=v_source_key) then return new; end if;
  select coalesce(max(value.source_order),0)+1 into v_source_order from public.task_automation_outcomes value where value.origin_key=v_origin_key;
  v_outcome_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
    'task-automation-outcome.v1','whatsapp_inbound',new.id::text,v_source_key,'suppress',v_origin_key
  )),'UTF8'),'sha256'),'hex'));
  insert into public.task_automation_outcomes(outcome_key,source_kind,source_id,source_key,source_order,operation,origin_key,task_id,outcome,reason)
  values (v_outcome_key,'whatsapp_inbound',new.id,v_source_key,v_source_order,'suppress',v_origin_key,null,'unresolved','source_ambiguous');
  return new;
end;
$function$;
create trigger cancel_quote_follow_up_on_whatsapp after insert on public.lead_events
for each row execute function public.task_automation_cancel_quote_whatsapp();

create or replace function public.task_automation_cancel_quote_payment()
returns trigger language plpgsql volatile security definer set search_path = '' as $function$
declare v_source_key text;
begin
  if new.status is distinct from 'verified' or new.accepted_quote_version_id is null
     or (tg_op='UPDATE' and new.status is not distinct from old.status
       and new.accepted_quote_version_id is not distinct from old.accepted_quote_version_id) then return new; end if;
  v_source_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-source.v1','payment_verified',new.id::text,new.accepted_quote_version_id::text)
  ),'UTF8'),'sha256'),'hex'));
  perform public.task_automation_cancel_quote_follow_up('payment_verified',new.id,v_source_key,new.accepted_quote_version_id);
  return new;
end;
$function$;
create trigger cancel_quote_follow_up_on_payment after insert or update of status,accepted_quote_version_id on public.payments
for each row execute function public.task_automation_cancel_quote_payment();

create or replace function public.crm_record_quote_version_response(p_request_id_text text, p_expected_actor_id uuid, p_quote_id uuid, p_quote_version_id uuid, p_channel text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare
  v_actor_id uuid := auth.uid();
  v_request_id uuid;
  v_actor public.profiles;
  v_contact_id uuid;
  v_lead_id uuid;
  v_scope record;
  v_event public.quote_events;
  v_payload jsonb;
begin
  if v_actor_id is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_REQUIRED','message','AUTH_REQUIRED')); end if;
  select value.* into v_actor from public.profiles value where value.id=v_actor_id;
  if v_actor.id is null or not v_actor.is_active then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INACTIVE','message','AUTH_INACTIVE')); end if;
  if p_expected_actor_id is distinct from v_actor_id then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_ACTOR_MISMATCH','message','AUTH_ACTOR_MISMATCH')); end if;
  if p_request_id_text is null or p_request_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_request_id_text<>lower((p_request_id_text::uuid)::text) or p_quote_id is null or p_quote_version_id is null
     or p_channel is null or p_channel not in ('phone','email','whatsapp','portal','other') then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST'));
  end if;
  v_request_id := p_request_id_text::uuid;
  select value.contact_id,value.lead_id into v_contact_id,v_lead_id from public.quotes value where value.id=p_quote_id;
  if v_contact_id is null or v_lead_id is null then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','QUOTE_VERSION_FORBIDDEN','message','QUOTE_VERSION_FORBIDDEN')); end if;
  perform 1 from public.contacts value where value.id=v_contact_id for update;
  perform 1 from public.leads value where value.id=v_lead_id for update;
  perform 1 from public.quotes value where value.lead_id=v_lead_id order by value.id for update;
  perform 1 from public.quote_versions value where value.lead_id=v_lead_id order by value.quote_id,value.version_number,value.id for update;
  perform 1 from public.documents value join public.quote_versions version on version.id=value.quote_version_id
    where version.lead_id=v_lead_id order by value.id for update of value;
  perform 1 from public.quote_upload_intents value where value.quote_id in
    (select quote_value.id from public.quotes quote_value where quote_value.lead_id=v_lead_id) order by value.quote_id,value.id for update;
  select q.contact_id,q.lead_id,q.owner_id,q.deleted_at,l.deleted_at lead_deleted_at,c.deleted_at contact_deleted_at,v.status version_status
    into v_scope from public.quotes q join public.leads l on l.id=q.lead_id join public.contacts c on c.id=q.contact_id
    join public.quote_versions v on v.id=p_quote_version_id and v.quote_id=q.id where q.id=p_quote_id;
  if v_scope.owner_id is null or v_scope.deleted_at is not null or v_scope.lead_deleted_at is not null or v_scope.contact_deleted_at is not null
     or not public.task_actor_can_manage(v_scope.owner_id) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','QUOTE_VERSION_FORBIDDEN','message','QUOTE_VERSION_FORBIDDEN'));
  end if;
  v_payload := jsonb_build_object('schema','quote-version-response.v1','requestId',v_request_id::text,'quoteId',p_quote_id::text,
    'quoteVersionId',p_quote_version_id::text,'channel',p_channel,'actorId',v_actor_id::text);
  select value.* into v_event from public.quote_events value where value.id=v_request_id;
  if v_event.id is not null then
    if v_event.quote_id<>p_quote_id or v_event.quote_version_id is distinct from p_quote_version_id or v_event.actor_id is distinct from v_actor_id
       or v_event.event_type<>'quote_version_response' or v_event.payload<>v_payload or v_event.idempotency_key<>'quote-version-response:'||v_request_id::text then
      return jsonb_build_object('ok',false,'error',jsonb_build_object('code','QUOTE_RESPONSE_IDEMPOTENCY_CONFLICT','message','QUOTE_RESPONSE_IDEMPOTENCY_CONFLICT'));
    end if;
    return jsonb_build_object('ok',true,'schema','quote-version-response-result.v1','eventId',v_event.id::text,'requestId',v_request_id::text,
      'quoteId',p_quote_id::text,'quoteVersionId',p_quote_version_id::text,'channel',p_channel,'actorId',v_actor_id::text,'replayed',true);
  end if;
  if v_scope.version_status<>'sent' then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','QUOTE_VERSION_NOT_ACTIONABLE','message','QUOTE_VERSION_NOT_ACTIONABLE')); end if;
  insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,payload,idempotency_key)
  values (v_request_id,p_quote_id,p_quote_version_id,v_scope.contact_id,v_scope.lead_id,v_actor_id,'quote_version_response',v_payload,'quote-version-response:'||v_request_id::text)
  returning * into v_event;
  return jsonb_build_object('ok',true,'schema','quote-version-response-result.v1','eventId',v_event.id::text,'requestId',v_request_id::text,
    'quoteId',p_quote_id::text,'quoteVersionId',p_quote_version_id::text,'channel',p_channel,'actorId',v_actor_id::text,'replayed',false);
end;
$function$;

alter table public.task_automation_tombstones enable row level security;
alter table public.task_automation_tombstones force row level security;
create policy "task automation tombstones admin read" on public.task_automation_tombstones for select to authenticated
using (public.is_admin());
revoke all on table public.task_automation_source_cutoffs,public.task_automation_tombstones from public,anon,authenticated,service_role;
grant select on table public.task_automation_tombstones to authenticated;
alter function public.prevent_task_automation_source_state_change() owner to postgres;
alter function public.task_automation_generate_first_contact() owner to postgres;
alter function public.task_automation_invalidate_first_contact() owner to postgres;
alter function public.enforce_first_contact_completion_receipt() owner to postgres;
alter function public.task_automation_generate_quote_follow_up() owner to postgres;
alter function public.task_automation_cancel_quote_follow_up(text,uuid,text,uuid) owner to postgres;
alter function public.task_automation_cancel_quote_response() owner to postgres;
alter function public.task_automation_cancel_quote_terminal() owner to postgres;
alter function public.task_automation_cancel_quote_whatsapp() owner to postgres;
alter function public.task_automation_cancel_quote_payment() owner to postgres;
alter function public.crm_record_quote_version_response(text,uuid,uuid,uuid,text) owner to postgres;
revoke all on function public.prevent_task_automation_source_state_change(),public.task_automation_generate_first_contact(),public.task_automation_invalidate_first_contact(),public.enforce_first_contact_completion_receipt(),public.task_automation_generate_quote_follow_up(),public.task_automation_cancel_quote_follow_up(text,uuid,text,uuid),public.task_automation_cancel_quote_response(),public.task_automation_cancel_quote_terminal(),public.task_automation_cancel_quote_whatsapp(),public.task_automation_cancel_quote_payment(),public.crm_record_quote_version_response(text,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_record_quote_version_response(text,uuid,uuid,uuid,text) to authenticated;

commit;
