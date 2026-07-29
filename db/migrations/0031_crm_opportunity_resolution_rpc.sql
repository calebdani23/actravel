-- Serialized opportunity resolution for reliable same-purpose reuse without exposing
-- cross-advisor lead details when a hidden canonical opportunity already exists.

create or replace function public.crm_normalize_identity_ascii(value text)
returns text
language sql
immutable
as $$
  select translate(
    value,
    '！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～',
    '!"#$%&''()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
  );
$$;

create or replace function public.crm_normalize_email(value text)
returns text
language plpgsql
immutable
as $$
declare
  compact text;
  raw_local text;
  raw_domain text;
  extra_parts text[];
  domain_value text;
  local_value text;
begin
  if value is null then
    return null;
  end if;

  compact := lower(regexp_replace(trim(public.crm_normalize_identity_ascii(value)), '\s+', '', 'g'));
  if compact = '' then
    return null;
  end if;

  raw_local := split_part(compact, '@', 1);
  raw_domain := split_part(compact, '@', 2);
  extra_parts := string_to_array(compact, '@');
  if raw_local = '' or raw_domain = '' or coalesce(array_length(extra_parts, 1), 0) <> 2 then
    return compact;
  end if;

  domain_value := regexp_replace(raw_domain, '\.+$', '');
  local_value := raw_local;

  if domain_value in ('gmail.com', 'googlemail.com') then
    local_value := replace(split_part(local_value, '+', 1), '.', '');
    return local_value || '@gmail.com';
  end if;

  return local_value || '@' || domain_value;
end;
$$;

create or replace function public.crm_normalize_phone(value text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
  digits text;
begin
  if value is null then
    return null;
  end if;

  normalized := trim(public.crm_normalize_identity_ascii(value));
  if normalized = '' then
    return null;
  end if;

  normalized := regexp_replace(normalized, '(?:ext\.?|extension|anexo|x|#)\s*\d+$', '', 'i');
  digits := regexp_replace(normalized, '\D', '', 'g');
  digits := regexp_replace(digits, '^00+', '');

  if digits like '521%' and char_length(digits) = 13 then
    digits := '52' || substr(digits, 4);
  end if;

  return nullif(digits, '');
end;
$$;

update public.contacts
set normalized_email = public.crm_normalize_email(email),
    normalized_phone = public.crm_normalize_phone(phone)
where normalized_email is distinct from public.crm_normalize_email(email)
   or normalized_phone is distinct from public.crm_normalize_phone(phone);

create or replace function public.crm_resolve_opportunity_lead(
  p_contact_id uuid,
  p_status_id uuid,
  p_assigned_to uuid default null,
  p_source text default 'website_quote',
  p_priority text default 'normal',
  p_summary text default null,
  p_destination_id uuid default null,
  p_service_id uuid default null,
  p_travel_start_date date default null,
  p_travel_end_date date default null,
  p_travelers_count integer default 1,
  p_budget_mxn numeric default null,
  p_budget_usd numeric default null,
  p_opportunity_signature text default null,
  p_opportunity_signature_version smallint default 1,
  p_opportunity_basis jsonb default '{}'::jsonb
)
returns table(
  lead_id uuid,
  resolution_status text,
  created_new boolean,
  review_required boolean,
  reliable_purpose boolean,
  signature text,
  signature_version smallint,
  basis jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_admin boolean := coalesce(public.is_admin(), false);
  actor_is_advisor boolean := coalesce(public.has_role('asesor'), false);
  can_global_reuse boolean := actor_id is null or actor_is_admin;
  effective_assigned_to uuid := p_assigned_to;
  lock_key bigint;
  candidate record;
  created_id uuid;
begin
  if p_contact_id is null or p_status_id is null or nullif(trim(coalesce(p_source, '')), '') is null or nullif(trim(coalesce(p_opportunity_signature, '')), '') is null then
    raise exception 'crm_resolve_opportunity_lead requires contact, status, source, and reliable signature';
  end if;

  if actor_id is not null and not actor_is_admin and not actor_is_advisor then
    raise insufficient_privilege using message = 'Not authorized to resolve CRM opportunities';
  end if;

  if actor_id is not null and actor_is_advisor and not actor_is_admin then
    if p_assigned_to is not null and p_assigned_to <> actor_id then
      raise insufficient_privilege using message = 'Advisors may only create self-assigned manual opportunities';
    end if;
    effective_assigned_to := actor_id;
  end if;

  lock_key := hashtextextended('crm_opportunity|' || p_contact_id::text || '|' || p_opportunity_signature || '|' || p_opportunity_signature_version::text, 0);
  perform pg_advisory_xact_lock(lock_key);

  select
    l.id,
    l.assigned_to,
    l.created_at,
    l.updated_at,
    coalesce(ls.is_terminal, false) as is_terminal
  into candidate
  from public.leads l
  left join public.lead_statuses ls on ls.id = l.status_id
  where l.contact_id = p_contact_id
    and l.opportunity_signature = p_opportunity_signature
    and l.opportunity_signature_version = p_opportunity_signature_version
  order by
    case when coalesce(ls.is_terminal, false) then 1 else 0 end,
    l.updated_at desc,
    l.created_at desc,
    l.id asc
  limit 1;

  if candidate.id is not null and (can_global_reuse or candidate.assigned_to = actor_id) then
    update public.leads
    set destination_id = p_destination_id,
        service_id = p_service_id,
        travel_start_date = p_travel_start_date,
        travel_end_date = p_travel_end_date,
        travelers_count = coalesce(p_travelers_count, 1),
        budget_mxn = p_budget_mxn,
        budget_usd = p_budget_usd,
        summary = p_summary,
        opportunity_signature = p_opportunity_signature,
        opportunity_signature_version = p_opportunity_signature_version,
        opportunity_basis = coalesce(p_opportunity_basis, '{}'::jsonb),
        updated_at = now()
    where id = candidate.id;

    return query select candidate.id, 'reused_existing', false, false, true, p_opportunity_signature, p_opportunity_signature_version, coalesce(p_opportunity_basis, '{}'::jsonb);
    return;
  end if;

  insert into public.leads (
    contact_id,
    status_id,
    assigned_to,
    destination_id,
    service_id,
    travel_start_date,
    travel_end_date,
    travelers_count,
    budget_mxn,
    budget_usd,
    source,
    priority,
    summary,
    opportunity_signature,
    opportunity_signature_version,
    opportunity_basis
  ) values (
    p_contact_id,
    p_status_id,
    effective_assigned_to,
    p_destination_id,
    p_service_id,
    p_travel_start_date,
    p_travel_end_date,
    coalesce(p_travelers_count, 1),
    p_budget_mxn,
    p_budget_usd,
    p_source,
    coalesce(nullif(trim(coalesce(p_priority, '')), ''), 'normal'),
    p_summary,
    p_opportunity_signature,
    p_opportunity_signature_version,
    coalesce(p_opportunity_basis, '{}'::jsonb)
  )
  returning id into created_id;

  return query select created_id,
    case when candidate.id is not null then 'created_duplicate_review' else 'created_new' end,
    true,
    candidate.id is not null,
    true,
    p_opportunity_signature,
    p_opportunity_signature_version,
    coalesce(p_opportunity_basis, '{}'::jsonb);
end;
$$;

revoke all on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) from public;

revoke all on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) from anon;

grant execute on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) to authenticated;

grant execute on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) to service_role;
