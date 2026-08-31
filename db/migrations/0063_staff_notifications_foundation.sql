begin;

create table public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check (kind in ('task', 'quote', 'system')),
  title text not null,
  body text not null,
  quote_id uuid references public.quotes(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  read_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint staff_notifications_title_length_check check (char_length(trim(title)) between 1 and 200),
  constraint staff_notifications_body_length_check check (char_length(trim(body)) between 1 and 2000),
  constraint staff_notifications_idempotency_key_format_check check (idempotency_key ~ '^[0-9a-f]{64}$'),
  constraint staff_notifications_immutable_fields_check check (id is not null)
);

create unique index staff_notifications_recipient_idempotency_key_idx
  on public.staff_notifications(recipient_id, idempotency_key);
create index staff_notifications_recipient_created_idx
  on public.staff_notifications(recipient_id, created_at desc, id desc);
create index staff_notifications_unread_idx
  on public.staff_notifications(recipient_id, created_at desc, id desc)
  where read_at is null;
create index staff_notifications_quote_id_idx
  on public.staff_notifications(quote_id) where quote_id is not null;
create index staff_notifications_task_id_idx
  on public.staff_notifications(task_id) where task_id is not null;

create or replace function public.create_staff_notification(
  p_recipient_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_quote_id uuid,
  p_task_id uuid,
  p_idempotency_key text
)
returns public.staff_notifications
language plpgsql volatile security definer set search_path = public
as $function$
declare
  v_notification public.staff_notifications;
  v_title text;
  v_body text;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null then
      raise exception using errcode = 'SN001', message = 'STAFF_NOTIFICATION_UNAUTHENTICATED';
    end if;
    raise exception using errcode = 'SN003', message = 'STAFF_NOTIFICATION_FORBIDDEN';
  end if;

  v_title := nullif(trim(p_title), '');
  v_body := nullif(trim(p_body), '');
  if p_recipient_id is null or p_kind is null or p_kind not in ('task', 'quote', 'system')
     or v_title is null or char_length(v_title) > 200
     or v_body is null or char_length(v_body) > 2000
     or p_idempotency_key is null or p_idempotency_key !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'SN002', message = 'STAFF_NOTIFICATION_INVALID_ARGUMENT';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_recipient_id and p.is_active) then
    raise exception using errcode = 'SN003', message = 'STAFF_NOTIFICATION_FORBIDDEN';
  end if;
  if p_task_id is not null and not exists (
    select 1 from public.tasks t where t.id = p_task_id and t.status <> 'canceled'
  ) then
    raise exception using errcode = 'SN004', message = 'STAFF_NOTIFICATION_CONTEXT_INVALID';
  end if;
  if p_quote_id is not null and not exists (
    select 1
    from public.quotes q
    join public.leads l on l.id = q.lead_id
    join public.contacts c on c.id = q.contact_id
    where q.id = p_quote_id and q.deleted_at is null
      and l.deleted_at is null and c.deleted_at is null
  ) then
    raise exception using errcode = 'SN004', message = 'STAFF_NOTIFICATION_CONTEXT_INVALID';
  end if;

  insert into public.staff_notifications(recipient_id, kind, title, body, quote_id, task_id, idempotency_key)
  values (p_recipient_id, p_kind, v_title, v_body, p_quote_id, p_task_id, p_idempotency_key)
  on conflict (recipient_id, idempotency_key) do nothing
  returning * into v_notification;
  if v_notification.id is not null then return v_notification; end if;

  select * into v_notification
  from public.staff_notifications n
  where n.recipient_id = p_recipient_id and n.idempotency_key = p_idempotency_key
  for update;
  if v_notification.id is null
     or v_notification.kind is distinct from p_kind
     or v_notification.title is distinct from v_title
     or v_notification.body is distinct from v_body
     or v_notification.quote_id is distinct from p_quote_id
     or v_notification.task_id is distinct from p_task_id then
    raise exception using errcode = 'SN005', message = 'STAFF_NOTIFICATION_IDEMPOTENCY_CONFLICT';
  end if;
  return v_notification;
end;
$function$;

create or replace function public.mark_staff_notification_read(p_notification_id uuid)
returns public.staff_notifications
language plpgsql volatile security definer set search_path = public
as $function$
declare
  v_notification public.staff_notifications;
begin
  if auth.role() <> 'authenticated' then
    if auth.uid() is null then
      raise exception using errcode = 'SN001', message = 'STAFF_NOTIFICATION_UNAUTHENTICATED';
    end if;
    raise exception using errcode = 'SN003', message = 'STAFF_NOTIFICATION_FORBIDDEN';
  end if;
  if p_notification_id is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) then
    raise exception using errcode = 'SN003', message = 'STAFF_NOTIFICATION_FORBIDDEN';
  end if;
  update public.staff_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = auth.uid()
  returning * into v_notification;
  if v_notification.id is null then
    raise exception using errcode = 'SN003', message = 'STAFF_NOTIFICATION_FORBIDDEN';
  end if;
  return v_notification;
end;
$function$;

alter function public.create_staff_notification(uuid, text, text, text, uuid, uuid, text) owner to postgres;
alter function public.mark_staff_notification_read(uuid) owner to postgres;
create or replace function public.staff_notification_active_recipient()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active) $$;
alter function public.staff_notification_active_recipient() owner to postgres;
revoke all on function public.create_staff_notification(uuid, text, text, text, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.mark_staff_notification_read(uuid) from public, anon, authenticated, service_role;
revoke all on function public.staff_notification_active_recipient() from public, anon, authenticated, service_role;
grant execute on function public.create_staff_notification(uuid, text, text, text, uuid, uuid, text) to service_role;
grant execute on function public.mark_staff_notification_read(uuid) to authenticated;
grant execute on function public.staff_notification_active_recipient() to authenticated;

alter table public.staff_notifications enable row level security;
create policy "staff notifications authenticated recipient read" on public.staff_notifications
  for select to authenticated
  using (auth.uid() = recipient_id and public.staff_notification_active_recipient());

revoke all on table public.staff_notifications from public, anon, authenticated, service_role;
grant select on table public.staff_notifications to authenticated;
-- No direct INSERT, UPDATE, or DELETE privileges are granted; no delete path exists.

commit;
