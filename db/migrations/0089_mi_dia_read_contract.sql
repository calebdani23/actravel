begin;

create index tasks_mi_dia_active_due_id_idx
  on public.tasks (due_at asc, id asc)
  include (owner_id, task_kind, status, lead_id, quote_id)
  where task_kind in ('follow_up','first_contact','quote_follow_up')
    and status in ('pending','in_progress');

create or replace function public.read_mi_dia_page(
  p_reference_time_text text,
  p_expected_actor_id uuid,
  p_limit integer,
  p_after_due_at_text text,
  p_after_id_text text
) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare
  actor_id uuid := auth.uid();
  actor_active boolean;
  actor_roles text[];
  result_scope text;
  reference_time timestamptz;
  today_start timestamptz;
  tomorrow_start timestamptz;
  after_due_at timestamptz;
  after_id uuid;
  effective_limit integer;
  result jsonb;
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','AUTH_REQUIRED','message','AUTH_REQUIRED'));
  end if;

  select p.is_active,
         coalesce(pg_catalog.array_agg(r.name order by r.name) filter (where r.name is not null), array[]::text[])
    into actor_active, actor_roles
    from public.profiles p
    left join public.profile_roles pr on pr.profile_id = p.id
    left join public.roles r on r.id = pr.role_id
   where p.id = actor_id
   group by p.is_active;
  if not found or not actor_active then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','AUTH_INACTIVE','message','AUTH_INACTIVE'));
  end if;
  if not (actor_roles && array['admin','manager','asesor']::text[]) then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','AUTH_ROLE_UNSUPPORTED','message','AUTH_ROLE_UNSUPPORTED'));
  end if;
  if p_expected_actor_id is null or p_expected_actor_id is distinct from actor_id then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','AUTH_ACTOR_MISMATCH','message','AUTH_ACTOR_MISMATCH'));
  end if;

  if p_reference_time_text is null
     or p_reference_time_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
     or p_limit is null
     or (p_after_due_at_text is null) <> (p_after_id_text is null)
     or (p_after_due_at_text is not null and p_after_due_at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$')
     or (p_after_id_text is not null and p_after_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST'));
  end if;
  begin
    reference_time := p_reference_time_text::timestamptz;
    after_due_at := p_after_due_at_text::timestamptz;
    after_id := p_after_id_text::uuid;
  exception when others then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST'));
  end;
  if not pg_catalog.isfinite(reference_time)
     or pg_catalog.to_char(reference_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') <> p_reference_time_text
     or (after_due_at is not null and (
       not pg_catalog.isfinite(after_due_at)
       or pg_catalog.to_char(after_due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') <> p_after_due_at_text
       or pg_catalog.lower(after_id::text) <> p_after_id_text
     )) then
    return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','INVALID_REQUEST','message','INVALID_REQUEST'));
  end if;

  effective_limit := case when p_limit < 1 then 1 when p_limit > 50 then 50 else p_limit end;
  result_scope := case when 'admin'=any(actor_roles) then 'all' when 'manager'=any(actor_roles) then 'team' else 'self' end;
  today_start := ((reference_time at time zone 'America/Mexico_City')::date::timestamp at time zone 'America/Mexico_City');
  tomorrow_start := (((reference_time at time zone 'America/Mexico_City')::date + 1)::timestamp at time zone 'America/Mexico_City');

  with authorized as materialized (
    select t.id, t.owner_id, pg_catalog.btrim(p.full_name) as owner_label,
           t.task_kind, t.status, t.description, t.due_at, t.lead_id, t.quote_id,
           case
             when 'admin'=any(actor_roles) and t.task_kind in ('follow_up','first_contact') and t.lead_id is not null
               then '/admin/leads/' || pg_catalog.lower(t.lead_id::text)
             when 'admin'=any(actor_roles) and t.task_kind='quote_follow_up' and t.quote_id is not null
               then '/admin/quotes/' || pg_catalog.lower(t.quote_id::text)
             when 'admin'<>all(actor_roles) and 'asesor'=any(actor_roles) and t.owner_id=actor_id
               and t.task_kind in ('follow_up','first_contact') and t.lead_id is not null
               and public.crm_advisor_can_access_live_opportunity(t.lead_id)
               then '/admin/leads/' || pg_catalog.lower(t.lead_id::text)
             when 'admin'<>all(actor_roles) and 'asesor'=any(actor_roles) and t.owner_id=actor_id
               and t.task_kind='quote_follow_up' and t.quote_id is not null
               and public.crm_can_read_quote(t.quote_id)
               then '/admin/quotes/' || pg_catalog.lower(t.quote_id::text)
             else null
           end as navigation_href
      from public.tasks t
      join public.profiles p on p.id = t.owner_id
     where t.task_kind in ('follow_up','first_contact','quote_follow_up')
       and t.status in ('pending','in_progress')
       and public.task_actor_can_manage(t.owner_id)
  ), bucketed as materialized (
    select a.*,
           case when a.due_at < reference_time then 'overdue'
                when a.due_at < tomorrow_start then 'today' else 'upcoming' end as bucket,
           a.owner_label is null or a.owner_label = '' or not pg_catalog.isfinite(a.due_at)
             or pg_catalog.date_trunc('microseconds',a.due_at) is distinct from a.due_at
             or (a.task_kind in ('follow_up','first_contact') and a.quote_id is not null)
             or (a.task_kind='quote_follow_up' and a.lead_id is not null) as invalid
      from authorized a
  ), totals as (
    select pg_catalog.count(*) filter (where bucket='overdue')::integer as overdue,
           pg_catalog.count(*) filter (where bucket='today')::integer as today,
           pg_catalog.count(*) filter (where bucket='upcoming')::integer as upcoming,
           pg_catalog.count(*)::integer as total
      from bucketed
  ), page as materialized (
    select * from bucketed
     where after_due_at is null or due_at > after_due_at or (due_at=after_due_at and id>after_id)
     order by due_at asc, id asc
     limit effective_limit + 1
  ), visible as materialized (
    select * from page order by due_at asc, id asc limit effective_limit
  ), page_data as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'taskId',pg_catalog.lower(id::text),'ownerId',pg_catalog.lower(owner_id::text),'ownerLabel',owner_label,
      'kind',task_kind,'status',status,'description',description,
      'dueAt',pg_catalog.to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'bucket',bucket,
      'leadId',case when lead_id is null then null else pg_catalog.lower(lead_id::text) end,
      'quoteId',case when quote_id is null then null else pg_catalog.lower(quote_id::text) end,
      'navigationHref',navigation_href
    ) order by due_at,id),'[]'::jsonb) as items from visible
  )
  select case when exists(select 1 from bucketed where invalid) then
    pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','PERSISTENCE_FAILURE','message','PERSISTENCE_FAILURE'))
  else pg_catalog.jsonb_build_object(
    'ok',true,'referenceTime',p_reference_time_text,
    'todayStart',pg_catalog.to_char(today_start at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'tomorrowStart',pg_catalog.to_char(tomorrow_start at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'scope',result_scope,'counts',pg_catalog.jsonb_build_object('overdue',totals.overdue,'today',totals.today,'upcoming',totals.upcoming,'total',totals.total),
    'items',page_data.items,'pageInfo',pg_catalog.jsonb_build_object(
      'hasMore',(select pg_catalog.count(*) > effective_limit from page),
      'nextCursor',case when (select pg_catalog.count(*) > effective_limit from page) then (select pg_catalog.jsonb_build_object(
        'referenceTime',p_reference_time_text,'afterDueAt',pg_catalog.to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'afterId',pg_catalog.lower(id::text)
      ) from visible order by due_at desc,id desc limit 1) else null end
    )
  ) end into result from totals cross join page_data;
  return result;
exception when others then
  return pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','PERSISTENCE_FAILURE','message','PERSISTENCE_FAILURE'));
end;
$function$;

alter function public.read_mi_dia_page(text,uuid,integer,text,text) owner to postgres;
revoke all on function public.read_mi_dia_page(text,uuid,integer,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_mi_dia_page(text,uuid,integer,text,text)
  to authenticated;

-- Local rollback while unused: revoke, drop the exact function, then drop the index.
commit;
