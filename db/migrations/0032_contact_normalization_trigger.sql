-- Canonical contact normalization contract for runtime and database writes.
-- Supported parity is intentionally limited to full-width ASCII folding,
-- trim/whitespace compaction, case folding, Gmail dot/plus aliases,
-- trailing domain dots, and trailing phone extensions.

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

create or replace function public.crm_apply_contact_normalization()
returns trigger
language plpgsql
as $$
begin
  new.normalized_email := public.crm_normalize_email(new.email);
  new.normalized_phone := public.crm_normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists set_contacts_normalized_identity on public.contacts;

create trigger set_contacts_normalized_identity
  before insert or update on public.contacts
  for each row
  execute function public.crm_apply_contact_normalization();

update public.contacts
set normalized_email = public.crm_normalize_email(email),
    normalized_phone = public.crm_normalize_phone(phone)
where normalized_email is distinct from public.crm_normalize_email(email)
   or normalized_phone is distinct from public.crm_normalize_phone(phone);
