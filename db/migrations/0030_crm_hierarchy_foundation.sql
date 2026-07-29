-- CRM hierarchy foundation: canonical contact normalization, opportunity signatures,
-- and request-scoped notification idempotency for reused opportunities.

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

  compact := lower(regexp_replace(trim(value), '\s+', '', 'g'));
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

  normalized := trim(value);
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

alter table public.contacts
  add column if not exists normalized_email text,
  add column if not exists normalized_phone text;

update public.contacts
set normalized_email = public.crm_normalize_email(email),
    normalized_phone = public.crm_normalize_phone(phone)
where normalized_email is distinct from public.crm_normalize_email(email)
   or normalized_phone is distinct from public.crm_normalize_phone(phone);

create index if not exists contacts_normalized_email_idx
  on public.contacts(normalized_email)
  where normalized_email is not null;

create index if not exists contacts_normalized_phone_idx
  on public.contacts(normalized_phone)
  where normalized_phone is not null;

alter table public.leads
  add column if not exists opportunity_signature text,
  add column if not exists opportunity_signature_version smallint not null default 1,
  add column if not exists opportunity_basis jsonb not null default '{}'::jsonb;

update public.leads
set opportunity_signature = case
      when destination_id is not null and service_id is not null
        then 'opp:v1|dest:' || destination_id::text || '|svc:' || service_id::text
      else null
    end,
    opportunity_signature_version = 1,
    opportunity_basis = jsonb_build_object(
      'version', 1,
      'reliablePurpose', destination_id is not null and service_id is not null,
      'destination', jsonb_build_object('id', destination_id, 'token', case when destination_id is not null then 'dest:' || destination_id::text else null end, 'reliable', destination_id is not null),
      'service', jsonb_build_object('id', service_id, 'token', case when service_id is not null then 'svc:' || service_id::text else null end, 'reliable', service_id is not null)
    )
where opportunity_signature is null
   or opportunity_basis = '{}'::jsonb;

create index if not exists leads_contact_signature_updated_idx
  on public.leads(contact_id, opportunity_signature, updated_at desc, id)
  where opportunity_signature is not null;

alter table public.notification_logs
  add column if not exists quote_request_id uuid references public.quote_requests(id) on delete set null;

create index if not exists notification_logs_quote_request_id_idx
  on public.notification_logs(quote_request_id);

drop index if exists notification_logs_email_idempotency_idx;

create unique index if not exists notification_logs_email_quote_request_idempotency_idx
  on public.notification_logs(quote_request_id, recipient, template_name)
  where channel = 'email'
    and quote_request_id is not null
    and recipient is not null
    and template_name is not null;

create unique index if not exists notification_logs_email_lead_fallback_idempotency_idx
  on public.notification_logs(lead_id, recipient, template_name)
  where channel = 'email'
    and quote_request_id is null
    and lead_id is not null
    and recipient is not null
    and template_name is not null;
