begin;

create table public.portal_quote_terms (
  id uuid primary key default gen_random_uuid(),
  revision text not null unique check (revision ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'),
  body text not null check (body=btrim(body) and octet_length(body) between 1 and 16000),
  sha256 text not null check (sha256=encode(extensions.digest(body,'sha256'),'hex')),
  published_by uuid not null,
  published_at timestamptz not null default now(),
  is_active boolean not null default true
);
create unique index portal_quote_terms_current on public.portal_quote_terms(is_active) where is_active;
alter table public.portal_quote_terms enable row level security;
alter table public.portal_quote_terms force row level security;
revoke all on public.portal_quote_terms from public,anon,authenticated,service_role;
grant select on public.portal_quote_terms to authenticated;
create policy portal_terms_admin_read on public.portal_quote_terms for select to authenticated using(public.is_admin());

create function public.portal_quote_terms_immutable() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'PORTAL_TERMS_IMMUTABLE'; end if;
  if to_jsonb(new)-'is_active' is distinct from to_jsonb(old)-'is_active' or (not old.is_active and new.is_active) then
    raise exception 'PORTAL_TERMS_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger portal_terms_immutable before update or delete on public.portal_quote_terms
  for each row execute function public.portal_quote_terms_immutable();

create function public.publish_portal_quote_terms(p_revision text,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.portal_quote_terms; created uuid;
begin
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  if p_revision is null or p_revision !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$'
    or p_body is null or octet_length(btrim(p_body)) not between 1 and 16000 then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('portal-quote-terms:v1',0));
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.profile_roles where profile_id=auth.uid() for share;
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  select * into existing from public.portal_quote_terms where revision=p_revision;
  if existing.id is not null then
    if existing.is_active and existing.body=btrim(p_body) then return jsonb_build_object('ok',true,'termsId',existing.id); end if;
    return jsonb_build_object('ok',false,'code','CONFLICT');
  end if;
  update public.portal_quote_terms set is_active=false where is_active;
  insert into public.portal_quote_terms(revision,body,sha256,published_by)
    values(p_revision,btrim(p_body),encode(extensions.digest(btrim(p_body),'sha256'),'hex'),auth.uid()) returning id into created;
  return jsonb_build_object('ok',true,'termsId',created);
end $$;

-- Private shared ownership predicate; never accept a browser-supplied Contact.
create function public.portal_customer_owns_quote(p_quote_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.customer_account_is_active() and exists(
    select 1 from public.quotes q join public.leads l on l.id=q.lead_id and l.contact_id=q.contact_id
    join public.customer_accounts a on a.contact_id=q.contact_id and a.user_id=auth.uid()
    where q.id=p_quote_id and q.deleted_at is null and l.deleted_at is null);
$$;
create function public.portal_customer_visible_versions(p_quote_id uuid) returns setof public.quote_versions
language sql stable security definer set search_path='' as $$
  select v.* from public.quote_versions v where v.quote_id=p_quote_id and public.portal_customer_owns_quote(p_quote_id)
    and v.finalized_at is not null and (v.sent_at is not null or v.accepted_at is not null)
    and v.status in ('sent','accepted','rejected','expired','cancelled','superseded');
$$;
create function public.portal_customer_version_card(v public.quote_versions) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('versionId',v.id,'versionNumber',v.version_number,'title',v.title,'summary',v.summary,
    'currency',v.currency,'totalAmount',v.total_amount,'depositAmount',v.deposit_amount,'validUntil',v.valid_until,'status',v.status);
$$;

create function public.read_customer_quotes(p_before timestamptz default null,p_after uuid default null,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb:='[]'; cursor_value jsonb; more boolean:=false; r record;
begin
  if not public.customer_account_is_active() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  if (p_before is null)<>(p_after is null) or (p_before is not null and not isfinite(p_before)) or p_limit is null or p_limit not between 1 and 50 then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT');
  end if;
  for r in select q.id,q.quote_number,q.created_at,v.title,v.currency,v.total_amount,v.status
    from public.quotes q join lateral (select value.* from public.portal_customer_visible_versions(q.id) value
      order by (value.id=q.current_version_id) desc,(value.id=q.accepted_version_id) desc nulls last,value.version_number desc limit 1) v on true
    where p_before is null or (q.created_at,q.id)<(p_before,p_after)
    order by q.created_at desc,q.id desc limit p_limit+1
  loop
    if jsonb_array_length(items)=p_limit then more:=true; exit; end if;
    cursor_value:=jsonb_build_object('createdAt',to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'quoteId',r.id);
    items:=items||jsonb_build_array(jsonb_build_object('quoteId',r.id,'number',r.quote_number,'title',r.title,
      'currency',r.currency,'totalAmount',r.total_amount,'status',r.status));
  end loop;
  return jsonb_build_object('ok',true,'items',items,'next',case when more then cursor_value else null end);
end $$;

create function public.portal_customer_quote_detail(p_quote_id uuid,p_version_id uuid,p_before_version integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q public.quotes; v public.quote_versions; d public.documents; terms public.portal_quote_terms;
  history jsonb:='[]'; next_version integer; more boolean:=false; item public.quote_versions; eligible boolean;
begin
  if not public.portal_customer_owns_quote(p_quote_id) then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  if p_before_version is not null and p_before_version<1 then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  select * into q from public.quotes where id=p_quote_id;
  select value.* into v from public.portal_customer_visible_versions(q.id) value where p_version_id is null or value.id=p_version_id
    order by (value.id=q.current_version_id) desc,(value.id=q.accepted_version_id) desc nulls last,value.version_number desc limit 1;
  if v.id is null then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  select * into d from public.documents where quote_version_id=v.id and contact_id=q.contact_id and lead_id=q.lead_id
    and document_type='quote' and storage_state='ready' and status='active' and deleted_at is null
    and mime_type='application/pdf' and byte_size between 1 and 20971520 and sha256 ~ '^[a-f0-9]{64}$';
  select * into terms from public.portal_quote_terms where is_active;
  eligible:=v.id=q.current_version_id and v.status='sent' and d.id is not null and terms.id is not null
    and (v.valid_until is null or v.valid_until >= (statement_timestamp() at time zone 'UTC')::date)
    and q.accepted_version_id is null and not exists(select 1 from public.quotes other where other.lead_id=q.lead_id and other.status='accepted')
    and exists(select 1 from public.leads l join public.lead_statuses s on s.id=l.status_id where l.id=q.lead_id and l.archived_at is null and not s.is_terminal);
  for item in select * from public.portal_customer_visible_versions(q.id) value
    where p_before_version is null or value.version_number<p_before_version order by value.version_number desc limit 21
  loop
    if jsonb_array_length(history)=20 then more:=true; exit; end if;
    history:=history||jsonb_build_array(public.portal_customer_version_card(item)); next_version:=item.version_number;
  end loop;
  return jsonb_build_object('ok',true,'quote',jsonb_build_object('quoteId',q.id,'number',q.quote_number,'lockVersion',q.lock_version),
    'version',public.portal_customer_version_card(v)||jsonb_build_object('current',v.id=q.current_version_id,'canAccept',eligible,
      'canRequestChanges',v.id=q.current_version_id and v.status in ('sent','accepted'),
      'pdf',case when d.id is not null then jsonb_build_object('documentId',d.id,'sha256',d.sha256,'byteSize',d.byte_size) else null end),
    'history',history,'nextBeforeVersion',case when more then next_version else null end,
    'terms',case when terms.id is not null then jsonb_build_object('termsId',terms.id,'revision',terms.revision,'body',terms.body,'sha256',terms.sha256) else null end,
    'acceptance',null);
end $$;
create function public.read_customer_quote(p_quote_id uuid,p_version_id uuid default null,p_before_version integer default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.portal_customer_quote_detail(p_quote_id,p_version_id,p_before_version);
$$;

create function public.read_customer_quote_pdf(p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare qid uuid; d public.documents;
begin
  select quote_id into qid from public.quote_versions where id=p_version_id;
  if not exists(select 1 from public.portal_customer_visible_versions(qid) where id=p_version_id) then
    return jsonb_build_object('ok',false,'code','NOT_AVAILABLE');
  end if;
  select * into d from public.documents where quote_version_id=p_version_id and document_type='quote'
    and storage_state='ready' and status='active' and deleted_at is null and mime_type='application/pdf'
    and byte_size between 1 and 20971520 and sha256 ~ '^[a-f0-9]{64}$';
  if d.id is null then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  return jsonb_build_object('ok',true,'pdf',jsonb_build_object('versionId',p_version_id,'documentId',d.id,
    'bucket',d.bucket,'path',d.path,'sha256',d.sha256,'byteSize',d.byte_size));
end $$;

revoke all on function public.portal_quote_terms_immutable(),public.publish_portal_quote_terms(text,text),
  public.portal_customer_owns_quote(uuid),public.portal_customer_visible_versions(uuid),public.portal_customer_version_card(public.quote_versions),
  public.portal_customer_quote_detail(uuid,uuid,integer),public.read_customer_quotes(timestamptz,uuid,integer),
  public.read_customer_quote(uuid,uuid,integer),public.read_customer_quote_pdf(uuid) from public,anon,authenticated,service_role;
grant execute on function public.publish_portal_quote_terms(text,text),public.read_customer_quotes(timestamptz,uuid,integer),
  public.read_customer_quote(uuid,uuid,integer),public.read_customer_quote_pdf(uuid) to authenticated;
commit;
