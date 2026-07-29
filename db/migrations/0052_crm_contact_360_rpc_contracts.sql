-- Normalized Contact 360 read contracts, keyset pagination, and advisor tombstone hardening.

-- These indexes match the bounded lookup and cursor paths used by the new RPCs.
create index if not exists leads_contact_updated_cursor_idx
  on public.leads(contact_id, updated_at desc, id desc);

create index if not exists quote_requests_lead_created_idx
  on public.quote_requests(lead_id, created_at desc, id desc);

create index if not exists quote_versions_contact_lead_version_idx
  on public.quote_versions(contact_id, lead_id, version_number desc, id desc);

create index if not exists lead_events_latest_follow_up_idx
  on public.lead_events(lead_id, created_at desc, id desc)
  where event_type = 'follow_up_registered';

-- This helper avoids recursive contact/lead RLS evaluation while disclosing
-- only whether the current user owns a live opportunity under a live contact.
create or replace function public.crm_advisor_can_access_live_opportunity(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.leads l
    join public.contacts c on c.id = l.contact_id
    where l.id = p_lead_id
      and l.assigned_to = auth.uid()
      and l.deleted_at is null
      and c.deleted_at is null
  );
$function$;

revoke all on function public.crm_advisor_can_access_live_opportunity(uuid) from public;
revoke all on function public.crm_advisor_can_access_live_opportunity(uuid) from anon;
revoke all on function public.crm_advisor_can_access_live_opportunity(uuid) from service_role;
grant execute on function public.crm_advisor_can_access_live_opportunity(uuid) to authenticated;

create or replace function public.crm_contact_360_summary(p_contact_id uuid)
returns table(
  contact_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  normalized_email text,
  normalized_phone text,
  preferred_locale text,
  source text,
  consent_marketing boolean,
  notes text,
  lifecycle_status text,
  blocked_at timestamptz,
  blocked_by uuid,
  blocked_by_name text,
  blocked_reason text,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  deleted_reason text,
  is_test_data boolean,
  created_at timestamptz,
  updated_at timestamptz,
  open_opportunity_count bigint,
  active_opportunity_count bigint,
  archived_opportunity_count bigint,
  deleted_opportunity_count bigint,
  total_opportunity_count bigint,
  request_count bigint,
  unassigned_request_count bigint,
  quote_version_count bigint,
  accepted_quote_count bigint,
  booking_count bigint,
  payment_count bigint,
  document_count bigint,
  duplicate_email_count bigint,
  duplicate_phone_count bigint,
  duplicate_risk boolean,
  overdue_follow_up_count bigint,
  next_follow_up_at timestamptz,
  last_activity_at timestamptz,
  pipeline_mxn numeric,
  pipeline_usd numeric,
  accepted_quote_value_mxn numeric,
  accepted_quote_value_usd numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
with target_contact as (
  select c.*
  from public.contacts c
  where c.id = p_contact_id
), opportunity_rollup as (
  select
    l.contact_id,
    count(*) filter (
      where l.deleted_at is null
        and l.archived_at is null
        and not coalesce(ls.is_terminal, false)
    )::bigint as open_count,
    count(*) filter (where l.deleted_at is null and l.archived_at is null)::bigint as active_count,
    count(*) filter (where l.deleted_at is null and l.archived_at is not null)::bigint as archived_count,
    count(*) filter (where l.deleted_at is not null)::bigint as deleted_count,
    count(*)::bigint as total_count,
    coalesce(sum(l.budget_mxn) filter (where l.deleted_at is null and l.archived_at is null), 0)::numeric as pipeline_mxn,
    coalesce(sum(l.budget_usd) filter (where l.deleted_at is null and l.archived_at is null), 0)::numeric as pipeline_usd
  from public.leads l
  join target_contact tc on tc.id = l.contact_id
  left join public.lead_statuses ls on ls.id = l.status_id
  group by l.contact_id
), request_rollup as (
  select
    qr.contact_id,
    count(*)::bigint as request_count,
    count(*) filter (where qr.lead_id is null)::bigint as unassigned_request_count
  from public.quote_requests qr
  join target_contact tc on tc.id = qr.contact_id
  group by qr.contact_id
), quote_rollup as (
  select
    qv.contact_id,
    count(*)::bigint as quote_version_count,
    count(*) filter (where qv.status = 'accepted')::bigint as accepted_quote_count,
    coalesce(sum(qv.total_amount) filter (where qv.status = 'accepted' and qv.currency = 'MXN'), 0)::numeric as accepted_mxn,
    coalesce(sum(qv.total_amount) filter (where qv.status = 'accepted' and qv.currency = 'USD'), 0)::numeric as accepted_usd
  from public.quote_versions qv
  join target_contact tc on tc.id = qv.contact_id
  group by qv.contact_id
), booking_rollup as (
  select b.contact_id, count(*)::bigint as booking_count
  from public.bookings b
  join target_contact tc on tc.id = b.contact_id
  group by b.contact_id
), payment_rollup as (
  select p.contact_id, count(*)::bigint as payment_count
  from public.payments p
  join target_contact tc on tc.id = p.contact_id
  group by p.contact_id
), document_rollup as (
  select d.contact_id, count(*)::bigint as document_count
  from public.documents d
  join target_contact tc on tc.id = d.contact_id
  group by d.contact_id
), duplicate_rollup as (
  select
    tc.id as contact_id,
    count(dc.id) filter (
      where tc.normalized_email is not null
        and dc.normalized_email = tc.normalized_email
    )::bigint as duplicate_email_count,
    count(dc.id) filter (
      where tc.normalized_phone is not null
        and dc.normalized_phone = tc.normalized_phone
    )::bigint as duplicate_phone_count
  from target_contact tc
  left join public.contacts dc
    on dc.id <> tc.id
   and (
     (tc.normalized_email is not null and dc.normalized_email = tc.normalized_email)
     or (tc.normalized_phone is not null and dc.normalized_phone = tc.normalized_phone)
   )
  group by tc.id
), latest_follow_up as (
  select distinct on (e.lead_id)
    l.contact_id,
    e.lead_id,
    nullif(e.payload ->> 'followUpAt', '')::timestamptz as follow_up_at
  from public.lead_events e
  join public.leads l on l.id = e.lead_id
  join target_contact tc on tc.id = l.contact_id
  where e.event_type = 'follow_up_registered'
    and l.deleted_at is null
    and l.archived_at is null
    and nullif(e.payload ->> 'followUpAt', '') is not null
  order by e.lead_id, e.created_at desc, e.id desc
), follow_up_rollup as (
  select
    lf.contact_id,
    count(*) filter (where lf.follow_up_at < now())::bigint as overdue_count,
    min(lf.follow_up_at) filter (where lf.follow_up_at >= now()) as next_follow_up_at
  from latest_follow_up lf
  group by lf.contact_id
), activity_candidates as (
  select tc.id as contact_id, tc.updated_at as activity_at from target_contact tc
  union all
  select l.contact_id, l.updated_at
  from public.leads l join target_contact tc on tc.id = l.contact_id
  union all
  select l.contact_id, e.created_at
  from public.lead_events e
  join public.leads l on l.id = e.lead_id
  join target_contact tc on tc.id = l.contact_id
  union all
  select qr.contact_id, qr.updated_at
  from public.quote_requests qr join target_contact tc on tc.id = qr.contact_id
  union all
  select qv.contact_id, qv.updated_at
  from public.quote_versions qv join target_contact tc on tc.id = qv.contact_id
  union all
  select b.contact_id, b.updated_at
  from public.bookings b join target_contact tc on tc.id = b.contact_id
  union all
  select p.contact_id, p.updated_at
  from public.payments p join target_contact tc on tc.id = p.contact_id
  union all
  select d.contact_id, d.updated_at
  from public.documents d join target_contact tc on tc.id = d.contact_id
), activity_rollup as (
  select ac.contact_id, max(ac.activity_at) as last_activity_at
  from activity_candidates ac
  group by ac.contact_id
)
select
  tc.id,
  tc.first_name,
  tc.last_name,
  tc.email,
  tc.phone,
  tc.normalized_email,
  tc.normalized_phone,
  tc.preferred_locale,
  tc.source,
  tc.consent_marketing,
  tc.notes,
  tc.lifecycle_status,
  tc.blocked_at,
  tc.blocked_by,
  blocker.full_name,
  tc.blocked_reason,
  tc.deleted_at,
  tc.deleted_by,
  deleter.full_name,
  tc.deleted_reason,
  tc.is_test_data,
  tc.created_at,
  tc.updated_at,
  coalesce(op.open_count, 0),
  coalesce(op.active_count, 0),
  coalesce(op.archived_count, 0),
  coalesce(op.deleted_count, 0),
  coalesce(op.total_count, 0),
  coalesce(rr.request_count, 0),
  coalesce(rr.unassigned_request_count, 0),
  coalesce(qr.quote_version_count, 0),
  coalesce(qr.accepted_quote_count, 0),
  coalesce(br.booking_count, 0),
  coalesce(pr.payment_count, 0),
  coalesce(dr.document_count, 0),
  coalesce(du.duplicate_email_count, 0),
  coalesce(du.duplicate_phone_count, 0),
  coalesce(du.duplicate_email_count, 0) > 0 or coalesce(du.duplicate_phone_count, 0) > 0,
  coalesce(fr.overdue_count, 0),
  fr.next_follow_up_at,
  ar.last_activity_at,
  coalesce(op.pipeline_mxn, 0),
  coalesce(op.pipeline_usd, 0),
  coalesce(qr.accepted_mxn, 0),
  coalesce(qr.accepted_usd, 0)
from target_contact tc
left join public.profiles blocker on blocker.id = tc.blocked_by
left join public.profiles deleter on deleter.id = tc.deleted_by
left join opportunity_rollup op on op.contact_id = tc.id
left join request_rollup rr on rr.contact_id = tc.id
left join quote_rollup qr on qr.contact_id = tc.id
left join booking_rollup br on br.contact_id = tc.id
left join payment_rollup pr on pr.contact_id = tc.id
left join document_rollup dr on dr.contact_id = tc.id
left join duplicate_rollup du on du.contact_id = tc.id
left join follow_up_rollup fr on fr.contact_id = tc.id
left join activity_rollup ar on ar.contact_id = tc.id;
$function$;

create or replace function public.crm_contact_opportunity_page(
  p_contact_id uuid,
  p_state text default 'active',
  p_limit integer default 20,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null
)
returns table(
  opportunity_id uuid,
  contact_id uuid,
  opportunity_state text,
  status_id uuid,
  status_name text,
  status_label text,
  status_is_terminal boolean,
  assigned_to uuid,
  owner_name text,
  destination_id uuid,
  destination_name text,
  service_id uuid,
  service_name text,
  summary text,
  source text,
  priority text,
  travel_start_date date,
  travel_end_date date,
  travelers_count integer,
  budget_mxn numeric,
  budget_usd numeric,
  is_featured boolean,
  is_test_data boolean,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  archived_by uuid,
  archived_by_name text,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  deleted_reason text,
  request_count bigint,
  open_request_count bigint,
  latest_request_id uuid,
  latest_request_status text,
  latest_request_locale text,
  latest_request_source text,
  latest_request_created_at timestamptz,
  quote_version_count bigint,
  active_quote_version_count bigint,
  latest_quote_id uuid,
  latest_quote_version_number integer,
  latest_quote_title text,
  latest_quote_status text,
  latest_quote_currency text,
  latest_quote_amount numeric,
  latest_quote_updated_at timestamptz,
  accepted_quote_id uuid,
  accepted_quote_version_number integer,
  accepted_quote_currency text,
  accepted_quote_amount numeric,
  accepted_quote_accepted_at timestamptz,
  latest_follow_up_at timestamptz,
  latest_follow_up_created_at timestamptz,
  follow_up_overdue boolean,
  last_activity_at timestamptz,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_contact_id is null then
    raise invalid_parameter_value using message = 'p_contact_id is required';
  end if;

  if p_state is null or p_state not in ('active', 'archived', 'deleted', 'all') then
    raise invalid_parameter_value using message = 'p_state must be active, archived, deleted, or all';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;

  if (p_after_updated_at is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;

  return query
  with candidate_rows as (
    select l.*
    from public.leads l
    join public.contacts c on c.id = l.contact_id
    where l.contact_id = p_contact_id
      and (
        p_state = 'all'
        or (p_state = 'active' and l.deleted_at is null and l.archived_at is null)
        or (p_state = 'archived' and l.deleted_at is null and l.archived_at is not null)
        or (p_state = 'deleted' and l.deleted_at is not null)
      )
      and (
        p_after_updated_at is null
        or l.updated_at < p_after_updated_at
        or (l.updated_at = p_after_updated_at and l.id < p_after_id)
      )
    order by l.updated_at desc, l.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.*
    from candidate_rows cr
    order by cr.updated_at desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  ), request_ranked as (
    select
      qr.*,
      row_number() over (partition by qr.lead_id order by qr.created_at desc, qr.id desc) as request_rank
    from public.quote_requests qr
    join page_rows pr on pr.id = qr.lead_id
  ), request_rollup as (
    select
      rr.lead_id,
      count(*)::bigint as request_count,
      count(*) filter (where rr.status in ('received', 'processing'))::bigint as open_request_count
    from request_ranked rr
    group by rr.lead_id
  ), latest_request as (
    select rr.* from request_ranked rr where rr.request_rank = 1
  ), quote_ranked as (
    select
      qv.*,
      row_number() over (partition by qv.lead_id order by qv.version_number desc, qv.id desc) as quote_rank
    from public.quote_versions qv
    join page_rows pr on pr.id = qv.lead_id
  ), quote_rollup as (
    select
      qr.lead_id,
      count(*)::bigint as quote_version_count,
      count(*) filter (where qr.status in ('draft', 'sent', 'accepted'))::bigint as active_quote_version_count
    from quote_ranked qr
    group by qr.lead_id
  ), latest_quote as (
    select qr.* from quote_ranked qr where qr.quote_rank = 1
  ), accepted_quote_ranked as (
    select
      qr.*,
      row_number() over (
        partition by qr.lead_id
        order by qr.accepted_at desc nulls last, qr.version_number desc, qr.id desc
      ) as accepted_rank
    from quote_ranked qr
    where qr.status = 'accepted'
  ), accepted_quote as (
    select aqr.* from accepted_quote_ranked aqr where aqr.accepted_rank = 1
  ), follow_up_ranked as (
    select
      e.lead_id,
      e.created_at,
      nullif(e.payload ->> 'followUpAt', '')::timestamptz as follow_up_at,
      row_number() over (partition by e.lead_id order by e.created_at desc, e.id desc) as follow_up_rank
    from public.lead_events e
    join page_rows pr on pr.id = e.lead_id
    where e.event_type = 'follow_up_registered'
  ), latest_follow_up as (
    select fur.* from follow_up_ranked fur where fur.follow_up_rank = 1
  ), activity_candidates as (
    select pr.id as lead_id, pr.updated_at as activity_at from page_rows pr
    union all
    select e.lead_id, e.created_at
    from public.lead_events e join page_rows pr on pr.id = e.lead_id
    union all
    select qr.lead_id, qr.updated_at
    from public.quote_requests qr join page_rows pr on pr.id = qr.lead_id
    union all
    select qv.lead_id, qv.updated_at
    from public.quote_versions qv join page_rows pr on pr.id = qv.lead_id
    union all
    select b.lead_id, b.updated_at
    from public.bookings b join page_rows pr on pr.id = b.lead_id
    union all
    select p.lead_id, p.updated_at
    from public.payments p join page_rows pr on pr.id = p.lead_id
    union all
    select d.lead_id, d.updated_at
    from public.documents d join page_rows pr on pr.id = d.lead_id
  ), activity_rollup as (
    select ac.lead_id, max(ac.activity_at) as last_activity_at
    from activity_candidates ac
    group by ac.lead_id
  )
  select
    pr.id,
    pr.contact_id,
    case
      when pr.deleted_at is not null then 'deleted'
      when pr.archived_at is not null then 'archived'
      else 'active'
    end,
    pr.status_id,
    ls.name,
    ls.label_es,
    coalesce(ls.is_terminal, false),
    pr.assigned_to,
    owner_profile.full_name,
    pr.destination_id,
    d.name_es,
    pr.service_id,
    s.name_es,
    pr.summary,
    pr.source,
    pr.priority,
    pr.travel_start_date,
    pr.travel_end_date,
    pr.travelers_count,
    pr.budget_mxn,
    pr.budget_usd,
    pr.is_featured,
    pr.is_test_data,
    pr.created_at,
    pr.updated_at,
    pr.archived_at,
    pr.archived_by,
    archived_profile.full_name,
    pr.deleted_at,
    pr.deleted_by,
    deleted_profile.full_name,
    pr.deleted_reason,
    coalesce(rr.request_count, 0),
    coalesce(rr.open_request_count, 0),
    lr.id,
    lr.status,
    lr.locale,
    coalesce(nullif(lr.payload ->> 'sourceChannel', ''), nullif(lr.payload ->> 'source', '')),
    lr.created_at,
    coalesce(qr.quote_version_count, 0),
    coalesce(qr.active_quote_version_count, 0),
    lq.id,
    lq.version_number,
    lq.title,
    lq.status,
    lq.currency,
    lq.total_amount,
    lq.updated_at,
    aq.id,
    aq.version_number,
    aq.currency,
    aq.total_amount,
    aq.accepted_at,
    lf.follow_up_at,
    lf.created_at,
    coalesce(lf.follow_up_at < now(), false),
    ar.last_activity_at,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  left join public.lead_statuses ls on ls.id = pr.status_id
  left join public.profiles owner_profile on owner_profile.id = pr.assigned_to
  left join public.profiles archived_profile on archived_profile.id = pr.archived_by
  left join public.profiles deleted_profile on deleted_profile.id = pr.deleted_by
  left join public.destinations d on d.id = pr.destination_id
  left join public.services s on s.id = pr.service_id
  left join request_rollup rr on rr.lead_id = pr.id
  left join latest_request lr on lr.lead_id = pr.id
  left join quote_rollup qr on qr.lead_id = pr.id
  left join latest_quote lq on lq.lead_id = pr.id
  left join accepted_quote aq on aq.lead_id = pr.id
  left join latest_follow_up lf on lf.lead_id = pr.id
  left join activity_rollup ar on ar.lead_id = pr.id
  order by pr.updated_at desc, pr.id desc;
end;
$function$;

revoke all on function public.crm_contact_360_summary(uuid) from public;
revoke all on function public.crm_contact_360_summary(uuid) from anon;
revoke all on function public.crm_contact_360_summary(uuid) from service_role;
grant execute on function public.crm_contact_360_summary(uuid) to authenticated;

revoke all on function public.crm_contact_opportunity_page(uuid, text, integer, timestamptz, uuid) from public;
revoke all on function public.crm_contact_opportunity_page(uuid, text, integer, timestamptz, uuid) from anon;
revoke all on function public.crm_contact_opportunity_page(uuid, text, integer, timestamptz, uuid) from service_role;
grant execute on function public.crm_contact_opportunity_page(uuid, text, integer, timestamptz, uuid) to authenticated;

-- Advisors must not reach an opportunity through a deleted parent contact.
drop policy if exists "lead read scoped" on public.leads;
create policy "lead read scoped" on public.leads for select to authenticated using (
  (public.is_admin() and (deleted_at is null or deleted_at is not null))
  or ((public.has_role('operaciones') or public.has_role('finanzas')) and deleted_at is null)
  or (
    public.has_role('asesor')
    and deleted_at is null
    and assigned_to = auth.uid()
    and public.crm_advisor_can_access_live_opportunity(id)
  )
);

drop policy if exists "quote requests staff read" on public.quote_requests;
create policy "quote requests staff read" on public.quote_requests for select to authenticated using (
  public.is_admin()
  or public.has_role('marketing')
  or public.has_role('operaciones')
  or public.has_role('finanzas')
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_requests.lead_id)
  )
);

drop policy if exists "quote requests staff write" on public.quote_requests;
create policy "quote requests staff write" on public.quote_requests for all to authenticated
using (
  public.is_admin()
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_requests.lead_id)
    and exists (
      select 1
      from public.leads l
      where l.id = quote_requests.lead_id
        and l.contact_id = quote_requests.contact_id
    )
  )
)
with check (
  public.is_admin()
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_requests.lead_id)
    and exists (
      select 1
      from public.leads l
      where l.id = quote_requests.lead_id
        and l.contact_id = quote_requests.contact_id
    )
  )
);

drop policy if exists "quote versions read scoped" on public.quote_versions;
create policy "quote versions read scoped" on public.quote_versions for select to authenticated using (
  public.is_admin()
  or public.has_role('operaciones')
  or public.has_role('finanzas')
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_versions.lead_id)
  )
);

drop policy if exists "quote versions insert scoped" on public.quote_versions;
create policy "quote versions insert scoped" on public.quote_versions for insert to authenticated with check (
  public.is_admin()
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_versions.lead_id)
    and exists (
      select 1
      from public.leads l
      where l.id = quote_versions.lead_id
        and l.contact_id = quote_versions.contact_id
    )
  )
);

drop policy if exists "quote versions update scoped" on public.quote_versions;
create policy "quote versions update scoped" on public.quote_versions for update to authenticated
using (
  public.is_admin()
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_versions.lead_id)
    and exists (
      select 1
      from public.leads l
      where l.id = quote_versions.lead_id
        and l.contact_id = quote_versions.contact_id
    )
  )
)
with check (
  public.is_admin()
  or (
    public.has_role('asesor')
    and public.crm_advisor_can_access_live_opportunity(quote_versions.lead_id)
    and exists (
      select 1
      from public.leads l
      where l.id = quote_versions.lead_id
        and l.contact_id = quote_versions.contact_id
    )
  )
);

-- Acceptance remains atomic and service-role compatible, while advisor calls
-- must target an assigned, non-deleted opportunity with a live parent contact.
create or replace function public.crm_accept_quote_version(
  p_lead_id uuid,
  p_quote_version_id uuid
)
returns table(
  accepted_version_id uuid,
  rejected_version_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  actor_admin boolean := false;
  target_version record;
  lead_row record;
  rejected_count integer := 0;
  changed_state boolean := false;
begin
  if p_lead_id is null or p_quote_version_id is null then
    raise exception 'quote version acceptance requires a lead and version';
  end if;

  select
    l.id,
    l.contact_id,
    l.assigned_to,
    l.deleted_at,
    c.deleted_at as contact_deleted_at
  into lead_row
  from public.leads l
  join public.contacts c on c.id = l.contact_id
  where l.id = p_lead_id
  for update of l, c;

  if lead_row.id is null then
    raise exception 'Quote version lead was not found';
  end if;

  if actor_role <> 'service_role' then
    if actor_id is null then
      raise insufficient_privilege using message = 'Not authorized to accept quote versions';
    end if;

    actor_admin := public.is_admin();
    if not actor_admin and not (
      public.has_role('asesor')
      and lead_row.assigned_to = actor_id
      and lead_row.deleted_at is null
      and lead_row.contact_deleted_at is null
    ) then
      raise insufficient_privilege using message = 'Not authorized to accept quote versions';
    end if;
  end if;

  perform 1
  from public.quote_versions qv
  where qv.lead_id = p_lead_id
  for update;

  select qv.id, qv.lead_id, qv.status, qv.title, qv.version_number, qv.accepted_at
  into target_version
  from public.quote_versions qv
  where qv.id = p_quote_version_id
    and qv.lead_id = p_lead_id
  for update;

  if target_version.id is null then
    raise exception 'Quote version was not found';
  end if;

  if target_version.status not in ('draft', 'sent', 'accepted') then
    raise exception 'Quote version cannot be accepted from its current status';
  end if;

  update public.quote_versions
  set status = 'rejected',
      accepted_at = null,
      rejected_at = coalesce(rejected_at, now()),
      expired_at = null,
      updated_at = now()
  where lead_id = p_lead_id
    and id <> target_version.id
    and status in ('draft', 'sent', 'accepted');

  get diagnostics rejected_count = row_count;

  update public.quote_versions
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, now()),
      rejected_at = null,
      expired_at = null,
      updated_at = now()
  where id = target_version.id
    and (status is distinct from 'accepted' or accepted_at is null);

  changed_state := rejected_count > 0 or found;

  if changed_state then
    insert into public.lead_events (lead_id, actor_id, event_type, payload)
    values (
      p_lead_id,
      actor_id,
      'quote_version_accepted',
      jsonb_build_object(
        'title', target_version.title,
        'versionNumber', target_version.version_number,
        'statusLabel', 'Aceptada',
        'rejectedAlternatives', rejected_count
      )
    );
  end if;

  return query select target_version.id, rejected_count;
end;
$function$;

revoke all on function public.crm_accept_quote_version(uuid, uuid) from public;
revoke all on function public.crm_accept_quote_version(uuid, uuid) from anon;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to authenticated;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to service_role;
