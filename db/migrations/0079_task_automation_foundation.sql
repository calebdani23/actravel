begin;

alter table public.tasks drop constraint tasks_task_kind_check;
alter table public.tasks
  add column automation_origin_key text,
  add constraint tasks_task_kind_check check (task_kind in ('manual', 'follow_up', 'first_contact', 'quote_follow_up')),
  add constraint tasks_automation_origin_key_check check (
    (task_kind in ('manual','follow_up') and automation_origin_key is null)
    or (task_kind in ('first_contact','quote_follow_up') and automation_origin_key=idempotency_key and automation_origin_key ~ '^[0-9a-f]{64}$')
  ),
  add constraint tasks_automation_origin_key_key unique (automation_origin_key);

create or replace function public.validate_task_representation_insert()
returns trigger language plpgsql set search_path = public
as $function$
begin
  if new.task_kind in ('first_contact','quote_follow_up') then
    if new.status <> 'pending' or new.automation_origin_key is null or new.automation_origin_key <> new.idempotency_key
       or new.source_event_id is not null or new.source_event_type is not null
       or new.source_event_created_at is not null or new.source_due_at is not null
       or new.source_payload is not null or new.metadata is not null
       or not pg_catalog.isfinite(new.due_at) or date_trunc('microseconds',new.due_at) is distinct from new.due_at
       or (new.task_kind='first_contact' and (new.lead_id is null or new.quote_id is not null or new.description <> 'Complete first contact'))
       or (new.task_kind='quote_follow_up' and (new.lead_id is not null or new.quote_id is null or new.description <> 'Follow up on quote version')) then
      raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
    end if;
    return new;
  end if;

  if new.task_kind = 'manual' then
    if new.source_event_id is not null or new.source_event_type is not null
       or new.source_event_created_at is not null or new.source_due_at is not null
       or new.source_payload is not null or new.metadata is not null then
      raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
    end if;
    return new;
  end if;

  if new.task_kind <> 'follow_up'
     or new.source_event_id is null or new.source_event_type is null
     or new.source_event_created_at is null or new.source_due_at is null
     or new.source_payload is null or new.metadata is null
     or new.source_event_type <> 'follow_up_registered'
     or new.lead_id is null or new.quote_id is not null
     or new.source_due_at is distinct from new.due_at
     or date_trunc('microseconds', new.source_event_created_at) is distinct from new.source_event_created_at
     or date_trunc('microseconds', new.source_due_at) is distinct from new.source_due_at
     or (select count(*) from jsonb_object_keys(new.metadata)) <> 5
     or new.metadata ?| array['unexpected']
     or (new.metadata - array['schema', 'source_event_id', 'source_event_type', 'owner_id', 'lead_id']) <> '{}'::jsonb
     or not (new.metadata ?& array['schema', 'source_event_id', 'source_event_type', 'owner_id', 'lead_id'])
     or exists (select 1 from jsonb_each(new.metadata) e where jsonb_typeof(e.value) <> 'string')
     or new.metadata->>'schema' <> 'follow_up_task.v1'
     or new.metadata->>'source_event_id' <> lower(new.source_event_id::text)
     or new.metadata->>'source_event_type' <> new.source_event_type
     or new.metadata->>'owner_id' <> lower(new.owner_id::text)
     or new.metadata->>'lead_id' <> lower(new.lead_id::text) then
    raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
  end if;
  return new;
end;
$function$;

create or replace function public.prevent_native_task_representation_update()
returns trigger language plpgsql set search_path = public as $function$
begin
  if old.task_kind in ('first_contact','quote_follow_up') and (
    new.automation_origin_key is distinct from old.automation_origin_key or new.idempotency_key is distinct from old.idempotency_key
    or new.description is distinct from old.description or new.due_at is distinct from old.due_at
    or (new.lead_id is distinct from old.lead_id and new.lead_id is not null)
    or (new.quote_id is distinct from old.quote_id and new.quote_id is not null)
  ) then raise exception using errcode='PT002', message='TASK_REPRESENTATION_IMMUTABLE'; end if;
  return new;
end;
$function$;
create trigger prevent_native_task_representation_update before update on public.tasks
for each row execute function public.prevent_native_task_representation_update();

create table public.task_automation_origins (
  origin_key text primary key check (origin_key ~ '^[0-9a-f]{64}$'),
  task_kind text not null check (task_kind in ('first_contact','quote_follow_up')),
  source_kind text not null,
  operation text not null,
  opportunity_id uuid,
  quote_version_id uuid,
  sent_event_id uuid,
  anchor_at timestamptz not null,
  due_rule_version text not null check (due_rule_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  task_id uuid unique references public.tasks(id) deferrable initially deferred,
  created_at timestamptz not null default date_trunc('microseconds',clock_timestamp()),
  constraint task_automation_origins_tuple_check check (
    (task_kind='first_contact' and source_kind='opportunity_assignment' and operation='generate' and opportunity_id is not null and quote_version_id is null and sent_event_id is null)
    or (task_kind='quote_follow_up' and source_kind='quote_sent' and operation='generate' and opportunity_id is null and quote_version_id is not null and sent_event_id is not null)
  ),
  constraint task_automation_origins_time_check check (pg_catalog.isfinite(anchor_at) and date_trunc('microseconds',anchor_at)=anchor_at),
  constraint task_automation_origins_key_check check (origin_key=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    case when task_kind='first_contact' then jsonb_build_array('task-automation:v1',task_kind,opportunity_id::text)
         else jsonb_build_array('task-automation:v1',task_kind,quote_version_id::text,sent_event_id::text) end
  ),'UTF8'),'sha256'),'hex')))
);
create unique index task_automation_origins_opportunity_key on public.task_automation_origins(opportunity_id) where task_kind='first_contact';
create unique index task_automation_origins_quote_version_key on public.task_automation_origins(quote_version_id) where task_kind='quote_follow_up';
alter table public.tasks add constraint tasks_automation_origin_key_fkey foreign key (automation_origin_key)
  references public.task_automation_origins(origin_key) deferrable initially deferred;

create or replace function public.prevent_task_automation_origin_change()
returns trigger language plpgsql set search_path = public as $function$
begin
  raise exception using errcode='PT002', message='TASK_AUTOMATION_ORIGIN_IMMUTABLE';
end;
$function$;
create trigger prevent_task_automation_origin_change before update or delete on public.task_automation_origins
for each row execute function public.prevent_task_automation_origin_change();

create or replace function public.validate_task_automation_task_parity()
returns trigger language plpgsql set search_path = public as $function$
begin
  if new.task_kind in ('first_contact','quote_follow_up') then
    if not exists (select 1 from public.task_automation_origins value where value.origin_key=new.automation_origin_key and value.task_id=new.id and value.task_kind=new.task_kind) then
      raise exception using errcode='PT002', message='TASK_AUTOMATION_PARITY_INVALID';
    end if;
  end if;
  return null;
end;
$function$;
create or replace function public.validate_task_automation_origin_parity()
returns trigger language plpgsql set search_path = public as $function$
begin
  if new.task_id is not null then
    if not exists (select 1 from public.tasks value where value.id=new.task_id and value.automation_origin_key=new.origin_key and value.task_kind=new.task_kind) then
      raise exception using errcode='PT002', message='TASK_AUTOMATION_PARITY_INVALID';
    end if;
  end if;
  return null;
end;
$function$;
create constraint trigger validate_task_automation_task_parity after insert or update on public.tasks
deferrable initially deferred for each row execute function public.validate_task_automation_task_parity();
create constraint trigger validate_task_automation_origin_parity after insert or update on public.task_automation_origins
deferrable initially deferred for each row execute function public.validate_task_automation_origin_parity();

create table public.task_automation_outcomes (
  outcome_key text primary key check (outcome_key ~ '^[0-9a-f]{64}$'),
  source_kind text not null check (source_kind ~ '^[a-z][a-z0-9_]{0,63}$'),
  source_id uuid not null,
  source_key text not null check (source_key ~ '^[0-9a-f]{64}$'),
  source_order bigint not null check (source_order between 0 and 2147483647),
  operation text not null check (operation in ('generate','transfer','cancel','suppress')),
  origin_key text not null check (origin_key ~ '^[0-9a-f]{64}$'),
  task_id uuid,
  outcome text not null check (outcome in ('applied','unresolved')),
  reason text,
  created_at timestamptz not null default date_trunc('microseconds',clock_timestamp()),
  constraint task_automation_outcomes_source_key unique (source_kind,source_id,source_key,source_order),
  constraint task_automation_outcomes_matrix_check check (
    (source_kind='opportunity_assignment' and operation in ('generate','transfer'))
    or (source_kind in ('opportunity_unassigned','opportunity_archived','opportunity_terminal') and operation in ('cancel','suppress'))
    or (source_kind='quote_sent' and operation='generate')
    or (source_kind in ('quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded','whatsapp_inbound','payment_verified') and operation in ('cancel','suppress'))
  ),
  constraint task_automation_outcomes_result_check check (
    (outcome='applied' and reason is null)
    or (outcome='unresolved' and reason in ('owner_unassigned','owner_inactive','owner_unknown','owner_role_invalid','source_ambiguous','identity_occupied'))
  ),
  constraint task_automation_outcomes_key_check check (outcome_key=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-automation-outcome.v1',source_kind,source_id::text,source_key,operation,origin_key)
  ),'UTF8'),'sha256'),'hex'))),
  constraint task_automation_outcomes_time_check check (pg_catalog.isfinite(created_at) and date_trunc('microseconds',created_at)=created_at)
);
alter table public.task_automation_outcomes enable row level security;
alter table public.task_automation_outcomes force row level security;

create or replace function public.prevent_task_automation_outcome_change()
returns trigger language plpgsql set search_path = public as $function$
begin
  raise exception using errcode='PT002', message='TASK_AUTOMATION_OUTCOME_IMMUTABLE';
end;
$function$;
create trigger prevent_task_automation_outcome_change before update or delete on public.task_automation_outcomes
for each row execute function public.prevent_task_automation_outcome_change();

create or replace function public.task_automation_project(
  p_source_kind text,p_source_id uuid,p_source_key text,p_source_order bigint,p_operation text,p_origin_key text,
  p_task_kind text,p_owner_id uuid,p_opportunity_id uuid,p_quote_id uuid,p_quote_version_id uuid,p_sent_event_id uuid,
  p_anchor_at timestamptz,p_due_at timestamptz,p_due_rule_version text
)
returns public.task_automation_outcomes language plpgsql volatile security definer set search_path = '' as $function$
declare
  prior_outcome public.task_automation_outcomes;
  result_outcome public.task_automation_outcomes;
  origin_row public.task_automation_origins;
  task_row public.tasks;
  owner_row public.profiles;
  owner_roles_valid boolean;
  v_outcome_key text;
  v_reason text;
  v_task_id uuid;
begin
  if p_source_kind is null or p_source_kind !~ '^[a-z][a-z0-9_]{0,63}$' or p_source_id is null
     or p_source_key is null or p_source_key !~ '^[0-9a-f]{64}$' or p_source_order is null or p_source_order not between 0 and 2147483647
     or p_operation is null
     or p_origin_key is null or p_origin_key !~ '^[0-9a-f]{64}$'
     or not ((p_source_kind='opportunity_assignment' and p_operation in ('generate','transfer'))
       or (p_source_kind in ('opportunity_unassigned','opportunity_archived','opportunity_terminal') and p_operation in ('cancel','suppress'))
       or (p_source_kind='quote_sent' and p_operation='generate')
       or (p_source_kind in ('quote_version_response','quote_accepted','quote_rejected','quote_expired','quote_cancelled','quote_superseded','whatsapp_inbound','payment_verified') and p_operation in ('cancel','suppress'))) then
    raise exception using errcode='P0001', message='TASK_AUTOMATION_PROJECTOR_INVALID_REQUEST';
  end if;
  if (p_operation='generate' and (p_task_kind is null or p_task_kind not in ('first_contact','quote_follow_up') or p_anchor_at is null or p_due_at is null
      or not pg_catalog.isfinite(p_anchor_at) or not pg_catalog.isfinite(p_due_at)
      or date_trunc('microseconds',p_anchor_at) is distinct from p_anchor_at or date_trunc('microseconds',p_due_at) is distinct from p_due_at
      or p_due_rule_version is null or p_due_rule_version !~ '^[a-z0-9][a-z0-9._-]{0,63}$'))
     or (p_operation<>'generate' and (p_task_kind is not null or p_opportunity_id is not null or p_quote_id is not null
       or p_quote_version_id is not null or p_sent_event_id is not null or p_anchor_at is not null or p_due_at is not null or p_due_rule_version is not null))
     or (p_operation='transfer' and p_owner_id is null) or (p_operation in ('cancel','suppress') and p_owner_id is not null) then
    raise exception using errcode='P0001', message='TASK_AUTOMATION_PROJECTOR_INVALID_REQUEST';
  end if;

  v_outcome_key := lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array(
    'task-automation-outcome.v1',p_source_kind,p_source_id::text,p_source_key,p_operation,p_origin_key
  )),'UTF8'),'sha256'),'hex'));
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(p_source_key,1,16))::bit(64)::bigint));
  select value.* into prior_outcome from public.task_automation_outcomes value where value.outcome_key=v_outcome_key;
  if prior_outcome.outcome_key is not null then return prior_outcome; end if;
  perform pg_catalog.pg_advisory_xact_lock((('x'||substr(p_origin_key,1,16))::bit(64)::bigint));

  if p_operation in ('generate','transfer') then
    if p_owner_id is null then v_reason := 'owner_unassigned';
    else
      select value.* into owner_row from public.profiles value where value.id=p_owner_id for update;
      if owner_row.id is null then v_reason := 'owner_unknown';
      elsif not owner_row.is_active then v_reason := 'owner_inactive';
      else
        perform 1 from public.profile_roles value where value.profile_id=p_owner_id order by value.role_id for update;
        perform 1 from public.roles r join public.profile_roles pr on pr.role_id=r.id where pr.profile_id=p_owner_id order by r.id for share of r;
        select count(*)>0 and bool_and(r.name in ('admin','manager','asesor')) into owner_roles_valid
          from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=p_owner_id;
        if not coalesce(owner_roles_valid,false) then v_reason := 'owner_role_invalid'; end if;
      end if;
    end if;
  end if;

  if p_operation='generate' and v_reason is null then
    if (p_task_kind='first_contact' and (p_source_kind<>'opportunity_assignment' or p_opportunity_id is null or p_quote_id is not null
        or p_quote_version_id is not null or p_sent_event_id is not null or not exists (select 1 from public.leads value where value.id=p_opportunity_id and value.deleted_at is null)))
       or (p_task_kind='quote_follow_up' and (p_source_kind<>'quote_sent' or p_opportunity_id is not null or p_quote_id is null
        or p_quote_version_id is null or p_sent_event_id is null or not exists (select 1 from public.quote_versions value join public.quotes q on q.id=value.quote_id where value.id=p_quote_version_id and value.quote_id=p_quote_id and q.deleted_at is null))) then
      v_reason := 'source_ambiguous';
    end if;
  end if;

  select value.* into origin_row from public.task_automation_origins value where value.origin_key=p_origin_key for update;
  if p_operation='generate' and v_reason is null then
    if origin_row.origin_key is not null then
      select value.* into task_row from public.tasks value where value.id=origin_row.task_id for update;
      if task_row.id is null or origin_row.task_kind<>p_task_kind or origin_row.anchor_at<>p_anchor_at or origin_row.due_rule_version<>p_due_rule_version
         or task_row.automation_origin_key<>p_origin_key or task_row.idempotency_key<>p_origin_key or task_row.owner_id<>p_owner_id
         or task_row.due_at<>p_due_at or task_row.lead_id is distinct from p_opportunity_id or task_row.quote_id is distinct from p_quote_id
         or origin_row.opportunity_id is distinct from p_opportunity_id or origin_row.quote_version_id is distinct from p_quote_version_id
         or origin_row.sent_event_id is distinct from p_sent_event_id then v_reason := 'identity_occupied';
      else v_task_id := task_row.id; end if;
    else
      perform 1 from public.tasks value where value.idempotency_key=p_origin_key or value.automation_origin_key=p_origin_key order by value.id for update;
      if found then v_reason := 'identity_occupied';
      else
        v_task_id := extensions.gen_random_uuid();
        insert into public.tasks(id,owner_id,lead_id,quote_id,description,due_at,status,idempotency_key,task_kind,automation_origin_key)
        values (v_task_id,p_owner_id,p_opportunity_id,p_quote_id,case when p_task_kind='first_contact' then 'Complete first contact' else 'Follow up on quote version' end,p_due_at,'pending',p_origin_key,p_task_kind,p_origin_key)
        on conflict do nothing returning * into task_row;
        if task_row.id is null then v_task_id := null; v_reason := 'identity_occupied';
        else
          insert into public.task_automation_origins(origin_key,task_kind,source_kind,operation,opportunity_id,quote_version_id,sent_event_id,anchor_at,due_rule_version,task_id)
          values (p_origin_key,p_task_kind,p_source_kind,'generate',p_opportunity_id,p_quote_version_id,p_sent_event_id,p_anchor_at,p_due_rule_version,v_task_id);
        end if;
      end if;
    end if;
  elsif p_operation in ('transfer','cancel') and v_reason is null then
    if origin_row.origin_key is null or origin_row.task_id is null then v_reason := 'source_ambiguous';
    else
      select value.* into task_row from public.tasks value where value.id=origin_row.task_id for update;
      if task_row.id is null or task_row.automation_origin_key<>p_origin_key then v_reason := 'identity_occupied';
      else
        v_task_id := task_row.id;
        if p_operation='transfer' and task_row.status in ('pending','in_progress') then update public.tasks set owner_id=p_owner_id where id=v_task_id;
        elsif p_operation='cancel' then perform public.task_action_automation_cancel(p_source_kind,p_source_id,p_source_key,p_source_order,v_task_id);
        end if;
      end if;
    end if;
  end if;

  insert into public.task_automation_outcomes(outcome_key,source_kind,source_id,source_key,source_order,operation,origin_key,task_id,outcome,reason)
  values (v_outcome_key,p_source_kind,p_source_id,p_source_key,p_source_order,p_operation,p_origin_key,v_task_id,
    case when v_reason is null then 'applied' else 'unresolved' end,v_reason) returning * into result_outcome;
  return result_outcome;
end;
$function$;

create table public.task_due_calendar_rules (
  rule_version text primary key check (rule_version='mx-calendar.v1'),
  payload jsonb not null check (payload='{"schema":"mx-calendar.v1","zone":"America/Mexico_City","tzdb":"2024a","valid":["2026-01-01","2031-12-31"],"offsetSeconds":-21600,"weekdays":[1,2,3,4,5],"hours":["09:00","18:00"],"holidays":["01-01","firstMonFeb","thirdMonMar","05-01","firstSunJun:y%6=2","09-16","10-01:y%6=2","thirdMonNov","12-25"]}'::jsonb),
  rule_hash text not null unique check (rule_hash=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
    jsonb_build_array('task-due-calendar.v1',payload)
  ),'UTF8'),'sha256'),'hex'))),
  created_at timestamptz not null default date_trunc('microseconds',clock_timestamp()),
  constraint task_due_calendar_rules_time_check check (pg_catalog.isfinite(created_at) and date_trunc('microseconds',created_at)=created_at)
);
with rule(payload) as (values ('{"schema":"mx-calendar.v1","zone":"America/Mexico_City","tzdb":"2024a","valid":["2026-01-01","2031-12-31"],"offsetSeconds":-21600,"weekdays":[1,2,3,4,5],"hours":["09:00","18:00"],"holidays":["01-01","firstMonFeb","thirdMonMar","05-01","firstSunJun:y%6=2","09-16","10-01:y%6=2","thirdMonNov","12-25"]}'::jsonb))
insert into public.task_due_calendar_rules(rule_version,payload,rule_hash)
select 'mx-calendar.v1',payload,lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
  jsonb_build_array('task-due-calendar.v1',payload)
),'UTF8'),'sha256'),'hex')) from rule;

create or replace function public.prevent_task_due_calendar_rule_change()
returns trigger language plpgsql set search_path = public as $function$
begin
  raise exception using errcode='PT002', message='TASK_DUE_CALENDAR_IMMUTABLE';
end;
$function$;
create trigger prevent_task_due_calendar_rule_change before update or delete on public.task_due_calendar_rules
for each row execute function public.prevent_task_due_calendar_rule_change();

create or replace function public.task_due_is_mx_holiday(p_local_date date)
returns boolean language sql immutable strict parallel safe set search_path = '' as $function$
  select to_char(p_local_date,'MM-DD') in ('01-01','05-01','09-16','12-25')
    or (extract(month from p_local_date)=2 and extract(isodow from p_local_date)=1 and extract(day from p_local_date)<=7)
    or (extract(month from p_local_date)=3 and extract(isodow from p_local_date)=1 and extract(day from p_local_date) between 15 and 21)
    or (extract(month from p_local_date)=6 and extract(isodow from p_local_date)=7 and extract(day from p_local_date)<=7 and extract(year from p_local_date)::integer%6=2)
    or (extract(month from p_local_date)=10 and extract(day from p_local_date)=1 and extract(year from p_local_date)::integer%6=2)
    or (extract(month from p_local_date)=11 and extract(isodow from p_local_date)=1 and extract(day from p_local_date) between 15 and 21)
$function$;

create or replace function public.task_automation_due_at(p_task_kind text,p_anchor_at timestamptz,p_due_rule_version text)
returns timestamptz language plpgsql stable security definer set search_path = '' as $function$
declare
  local_anchor timestamp;
  candidate date;
  calendar_payload jsonb;
begin
  if p_anchor_at is null or not pg_catalog.isfinite(p_anchor_at)
     or pg_catalog.date_trunc('microseconds',p_anchor_at) is distinct from p_anchor_at then
    raise exception using errcode='P0001', message='TASK_DUE_UNSUPPORTED';
  end if;
  if p_task_kind='quote_follow_up' and p_due_rule_version='elapsed-48h.v1' then
    if (p_anchor_at at time zone 'UTC')::date not between date '2026-01-01' and date '2031-12-31' then
      raise exception using errcode='P0001', message='TASK_DUE_UNSUPPORTED';
    end if;
    return p_anchor_at + interval '48 hours';
  end if;
  if p_task_kind<>'first_contact' or p_due_rule_version<>'mx-calendar.v1' then
    raise exception using errcode='P0001', message='TASK_DUE_UNSUPPORTED';
  end if;
  select value.payload into calendar_payload from public.task_due_calendar_rules value
    where value.rule_version=p_due_rule_version and value.rule_hash=lower(encode(extensions.digest(convert_to(public.follow_up_canonical_json(
      jsonb_build_array('task-due-calendar.v1',value.payload)
    ),'UTF8'),'sha256'),'hex'));
  if calendar_payload is null then raise exception using errcode='P0001', message='TASK_DUE_UNSUPPORTED'; end if;

  local_anchor := (p_anchor_at at time zone 'UTC') - interval '6 hours';
  if local_anchor::date not between date '2026-01-01' and date '2031-12-31' then
    raise exception using errcode='P0001', message='TASK_DUE_UNSUPPORTED';
  end if;
  if extract(isodow from local_anchor::date) between 1 and 5
     and not public.task_due_is_mx_holiday(local_anchor::date)
     and local_anchor::time>=time '09:00' and local_anchor::time<time '18:00' then
    return (local_anchor + interval '6 hours 15 minutes') at time zone 'UTC';
  end if;

  candidate := local_anchor::date;
  if local_anchor::time>=time '18:00' then candidate := candidate+1; end if;
  loop
    if candidate>date '2031-12-31' then raise exception using errcode='P0001', message='TASK_DUE_UNSUPPORTED'; end if;
    exit when extract(isodow from candidate) between 1 and 5 and not public.task_due_is_mx_holiday(candidate);
    candidate := candidate+1;
  end loop;
  return (candidate+time '15:15') at time zone 'UTC';
end;
$function$;

alter table public.task_automation_origins enable row level security;
alter table public.task_automation_origins force row level security;
create policy "task automation origins authenticated read scoped" on public.task_automation_origins for select to authenticated
using (exists (select 1 from public.tasks value where value.id=task_automation_origins.task_id and public.task_actor_can_manage(value.owner_id)));
create policy "task automation outcomes authenticated read scoped" on public.task_automation_outcomes for select to authenticated
using (
  (task_id is not null and exists (select 1 from public.tasks value where value.id=task_automation_outcomes.task_id and public.task_actor_can_manage(value.owner_id)))
  or (task_id is null and public.task_actor_can_manage(auth.uid()) and public.is_admin())
);
revoke all on table public.task_automation_origins from public,anon,authenticated,service_role;
revoke all on table public.task_automation_outcomes from public,anon,authenticated,service_role;
grant select on table public.task_automation_origins to authenticated;
grant select on table public.task_automation_outcomes to authenticated;
alter function public.validate_task_representation_insert() owner to postgres;
alter function public.prevent_native_task_representation_update() owner to postgres;
alter function public.prevent_task_automation_origin_change() owner to postgres;
alter function public.validate_task_automation_task_parity() owner to postgres;
alter function public.validate_task_automation_origin_parity() owner to postgres;
alter function public.prevent_task_automation_outcome_change() owner to postgres;
alter function public.prevent_task_due_calendar_rule_change() owner to postgres;
alter function public.task_due_is_mx_holiday(date) owner to postgres;
alter function public.task_automation_due_at(text,timestamptz,text) owner to postgres;
alter function public.task_automation_project(text,uuid,text,bigint,text,text,text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) owner to postgres;
revoke all on function public.prevent_native_task_representation_update(),public.prevent_task_automation_origin_change(),public.validate_task_automation_task_parity(),public.validate_task_automation_origin_parity() from public,anon,authenticated,service_role;
revoke all on function public.prevent_task_automation_outcome_change(),public.task_automation_project(text,uuid,text,bigint,text,text,text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated,service_role;
revoke all on table public.task_due_calendar_rules from public,anon,authenticated,service_role;
revoke all on function public.prevent_task_due_calendar_rule_change(),public.task_due_is_mx_holiday(date),public.task_automation_due_at(text,timestamptz,text) from public,anon,authenticated,service_role;

commit;
