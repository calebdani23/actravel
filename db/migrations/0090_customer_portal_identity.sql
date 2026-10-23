-- Customer identities are explicit Contact bindings, never staff profiles.
create table public.customer_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  contact_id uuid not null unique references public.contacts(id) on delete restrict,
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.portal_invitations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (isfinite(expires_at)),
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete restrict
);
create index portal_invitations_contact_idx on public.portal_invitations(contact_id, created_at desc);
create table public.portal_access_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null,
  invitation_id uuid,
  actor_id uuid,
  event_type text not null check (event_type in ('issued','replaced','revoked','redeemed','account_disabled','access_requested')),
  created_at timestamptz not null default now()
);
create index portal_access_events_contact_idx on public.portal_access_events(contact_id, created_at desc);

create function public.is_portal_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join public.profile_roles pr on pr.profile_id=p.id
    join public.roles r on r.id=pr.role_id where p.id=auth.uid() and p.is_active
    and r.name in ('admin','manager','asesor','operaciones','finanzas','marketing'));
$$;
create function public.customer_account_is_active() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.customer_accounts a join public.contacts c on c.id=a.contact_id
    join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and a.is_active
    and c.deleted_at is null and c.blocked_at is null and c.lifecycle_status <> 'blocked'
    and u.email_confirmed_at is not null and lower(btrim(u.email))=a.email and lower(btrim(c.email))=a.email
    and not exists(select 1 from public.profiles p where p.id=u.id));
$$;
create function public.prevent_customer_staff_collision() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id=new.id for update;
  if exists(select 1 from public.customer_accounts where user_id=new.id) then
    raise exception 'CUSTOMER_STAFF_COLLISION';
  end if;
  return new;
end $$;
create trigger profiles_customer_separation before insert or update of id on public.profiles
  for each row execute function public.prevent_customer_staff_collision();
create function public.portal_audit_append_only() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'PORTAL_AUDIT_APPEND_ONLY'; end $$;
create trigger portal_audit_immutable before update or delete on public.portal_access_events
  for each row execute function public.portal_audit_append_only();

alter table public.customer_accounts enable row level security;
alter table public.customer_accounts force row level security;
alter table public.portal_invitations enable row level security;
alter table public.portal_invitations force row level security;
alter table public.portal_access_events enable row level security;
alter table public.portal_access_events force row level security;
revoke all on public.customer_accounts, public.portal_invitations, public.portal_access_events from public, anon, authenticated;
grant select on public.customer_accounts, public.portal_invitations, public.portal_access_events to authenticated;
create policy customer_accounts_read on public.customer_accounts for select to authenticated
  using (public.is_admin() or (user_id=auth.uid() and public.customer_account_is_active()));
create policy portal_invitations_admin_read on public.portal_invitations for select to authenticated using (public.is_admin());
create policy portal_audit_admin_read on public.portal_access_events for select to authenticated using (public.is_admin());

-- Add a restrictive boundary to every existing data table, preserving its
-- prior staff rules and exactly its anonymous SELECT visibility. This closes
-- legacy USING(true) policies without broadening any staff or public grant.
-- These private metadata tables previously relied on revoked grants alone.
-- Keep their grants private and add deny-by-default RLS as defense in depth.
alter table public.task_due_calendar_rules enable row level security;
alter table public.task_automation_source_cutoffs enable row level security;
do $boundary$
declare t record; public_read text;
begin
  for t in select c.relname, n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and ((n.nspname='public' and c.relname not in
      ('customer_accounts','portal_invitations','portal_access_events')) or (n.nspname='storage' and c.relname='objects'))
  loop
    select string_agg('('||coalesce(qual,'true')||')',' OR ') into public_read from pg_policies
      where schemaname=t.nspname and tablename=t.relname and cmd in ('SELECT','ALL')
      and ('anon'=any(roles) or 'public'=any(roles)) and permissive='PERMISSIVE';
    execute format('create policy customer_staff_boundary on %I.%I as restrictive for all to authenticated using (public.is_portal_staff() OR (%s)) with check (public.is_portal_staff())',
      t.nspname,t.relname,coalesce(public_read,'false'));
    if public_read is not null then
      execute format('create policy customer_public_read on %I.%I for select to authenticated using (%s)',t.nspname,t.relname,public_read);
    end if;
  end loop;
end $boundary$;

create function public.current_customer_identity() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('ok',true,'accountId',a.user_id,'displayName',left(concat_ws(' ',c.first_name,c.last_name),160))
    from public.customer_accounts a join public.contacts c on c.id=a.contact_id
    where a.user_id=auth.uid() and public.customer_account_is_active()),jsonb_build_object('ok',false,'code','ACCESS_DENIED'));
$$;

create function public.issue_portal_invitation(p_contact_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.contacts; recipient text; token text; invitation_id uuid; prior record;
begin
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  select * into c from public.contacts where id=p_contact_id for update;
  recipient := lower(btrim(c.email));
  if c.id is null or c.deleted_at is not null or c.blocked_at is not null or c.lifecycle_status='blocked'
    or recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(recipient)>254
    or (select count(*) from public.contacts where lower(btrim(email))=recipient)<>1
    or exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(btrim(u.email))=recipient)
    or exists(select 1 from public.customer_accounts a where a.contact_id=c.id and (a.email<>recipient or not a.is_active)) then
    return jsonb_build_object('ok',false,'code','CONTACT_UNAVAILABLE');
  end if;
  for prior in update public.portal_invitations set revoked_at=now()
    where contact_id=c.id and redeemed_at is null and revoked_at is null returning id
  loop
    insert into public.portal_access_events(contact_id,invitation_id,actor_id,event_type) values(c.id,prior.id,auth.uid(),'replaced');
  end loop;
  token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.portal_invitations(contact_id,email,token_hash,created_by,expires_at)
    values(c.id,recipient,encode(extensions.digest(token,'sha256'),'hex'),auth.uid(),now()+interval '72 hours') returning id into invitation_id;
  insert into public.portal_access_events(contact_id,invitation_id,actor_id,event_type) values(c.id,invitation_id,auth.uid(),'issued');
  return jsonb_build_object('ok',true,'invitationId',invitation_id,'token',token);
end $$;

create function public.redeem_portal_invitation(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare invitation public.portal_invitations; c public.contacts; u auth.users; a public.customer_accounts;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok',false,'code','ACCESS_DENIED');
  end if;
  select * into u from auth.users where id=auth.uid() for update;
  if u.email_confirmed_at is null or exists(select 1 from public.profiles where id=u.id) then
    return jsonb_build_object('ok',false,'code','ACCESS_DENIED');
  end if;
  select * into invitation from public.portal_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  select * into c from public.contacts where id=invitation.contact_id for update;
  select * into invitation from public.portal_invitations where id=invitation.id for update;
  if invitation.id is null or c.deleted_at is not null or c.blocked_at is not null or c.lifecycle_status='blocked'
    or invitation.revoked_at is not null or invitation.expires_at<=now()
    or invitation.email is distinct from lower(btrim(u.email)) or invitation.email is distinct from lower(btrim(c.email))
    or (select count(*) from public.contacts where lower(btrim(email))=invitation.email)<>1
    or (invitation.redeemed_by is not null and invitation.redeemed_by<>u.id) then
    return jsonb_build_object('ok',false,'code','ACCESS_DENIED');
  end if;
  insert into public.customer_accounts(user_id,contact_id,email) values(u.id,c.id,invitation.email) on conflict do nothing;
  select * into a from public.customer_accounts where user_id=u.id and contact_id=c.id;
  if a.user_id is null or not a.is_active or a.email<>invitation.email then
    return jsonb_build_object('ok',false,'code','ACCESS_DENIED');
  end if;
  if invitation.redeemed_at is null then
    update public.portal_invitations set redeemed_at=now(),redeemed_by=u.id where id=invitation.id;
    insert into public.portal_access_events(contact_id,invitation_id,actor_id,event_type) values(c.id,invitation.id,u.id,'redeemed');
  end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.revoke_portal_invitation(p_invitation_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare invitation public.portal_invitations;
begin
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  select * into invitation from public.portal_invitations where id=p_invitation_id;
  if invitation.id is null then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  perform 1 from public.contacts where id=invitation.contact_id for update;
  update public.portal_invitations set revoked_at=now() where id=invitation.id and revoked_at is null;
  if found then insert into public.portal_access_events(contact_id,invitation_id,actor_id,event_type)
    values(invitation.contact_id,invitation.id,auth.uid(),'revoked'); end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.disable_customer_account(p_user_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare contact uuid;
begin
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  update public.customer_accounts set is_active=false where user_id=p_user_id and is_active returning contact_id into contact;
  if contact is not null then insert into public.portal_access_events(contact_id,actor_id,event_type) values(contact,auth.uid(),'account_disabled'); end if;
  return jsonb_build_object('ok',true);
end $$;

-- Server-only delivery eligibility lookup. Never exposed to browser roles.
-- Request responses are generic; access events record attempts, not email delivery.
create function public.portal_resolve_access(p_email text, p_token text, p_request_otp boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare recipient text := lower(btrim(p_email)); contact uuid; invitation uuid;
begin
  if recipient is null or length(recipient)>254 then return null; end if;
  if p_token is not null then
    if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
    select i.contact_id,i.id into contact,invitation from public.portal_invitations i join public.contacts c on c.id=i.contact_id
      where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and i.email=recipient
      and lower(btrim(c.email))=recipient and c.deleted_at is null and c.blocked_at is null and c.lifecycle_status<>'blocked'
      and i.revoked_at is null and i.redeemed_at is null and i.expires_at>now();
  else
    select a.contact_id into contact from public.customer_accounts a join public.contacts c on c.id=a.contact_id
      join auth.users u on u.id=a.user_id where a.email=recipient and a.is_active and lower(btrim(u.email))=recipient
      and u.email_confirmed_at is not null and lower(btrim(c.email))=recipient
      and c.deleted_at is null and c.blocked_at is null and c.lifecycle_status<>'blocked';
  end if;
  if contact is null or exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(btrim(u.email))=recipient)
    or (select count(*) from public.contacts where lower(btrim(email))=recipient)<>1 then return null; end if;
  perform 1 from public.contacts where id=contact for update;
  if p_request_otp then
    if exists(select 1 from public.portal_access_events where contact_id=contact and event_type='access_requested' and created_at>now()-interval '60 seconds')
      or (select count(*) from public.portal_access_events where contact_id=contact and event_type='access_requested' and created_at>now()-interval '1 day')>=20 then return null; end if;
    insert into public.portal_access_events(contact_id,invitation_id,event_type) values(contact,invitation,'access_requested');
  end if;
  return recipient;
end $$;

revoke all on function public.is_portal_staff(), public.customer_account_is_active(), public.prevent_customer_staff_collision(), public.portal_audit_append_only(),
  public.current_customer_identity(), public.issue_portal_invitation(uuid), public.redeem_portal_invitation(text),
  public.revoke_portal_invitation(uuid), public.disable_customer_account(uuid), public.portal_resolve_access(text,text,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.is_portal_staff(), public.customer_account_is_active(), public.current_customer_identity(),
  public.issue_portal_invitation(uuid), public.redeem_portal_invitation(text), public.revoke_portal_invitation(uuid), public.disable_customer_account(uuid) to authenticated;
grant execute on function public.portal_resolve_access(text,text,boolean) to service_role;
