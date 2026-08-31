begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  description text not null,
  due_at timestamptz not null,
  status text not null default 'pending',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_description_length check (char_length(trim(description)) between 1 and 2000),
  constraint tasks_status_check check (status in ('pending', 'in_progress', 'completed', 'canceled')),
  constraint tasks_one_context_check check (lead_id is null or quote_id is null),
  constraint tasks_idempotency_key_format_check check (idempotency_key ~ '^[0-9a-f]{64}$')
);

create unique index tasks_owner_idempotency_key_idx on public.tasks(owner_id, idempotency_key);
create index tasks_owner_id_idx on public.tasks(owner_id);
create index tasks_lead_id_idx on public.tasks(lead_id) where lead_id is not null;
create index tasks_quote_id_idx on public.tasks(quote_id) where quote_id is not null;
create index tasks_due_at_idx on public.tasks(due_at);

create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.task_actor_can_manage(p_owner_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles actor where actor.id = auth.uid() and actor.is_active)
    and (
      public.is_admin()
      or p_owner_id = auth.uid()
      or (
        public.has_role('manager')
        and exists (select 1 from public.profiles owner_profile where owner_profile.id = p_owner_id and owner_profile.is_active)
        and not exists (
          select 1 from public.profile_roles pr
          join public.roles r on r.id = pr.role_id
          where pr.profile_id = p_owner_id and r.name = 'admin'
        )
      )
    );
$$;

create or replace function public.create_task(
  p_owner_id uuid, p_lead_id uuid, p_quote_id uuid, p_description text, p_due_at timestamptz
)
returns public.tasks language plpgsql volatile security definer set search_path = public
as $function$
declare
  v_task public.tasks;
  v_key text;
  v_description text;
  v_context text;
begin
  if auth.uid() is null then raise exception using errcode = 'PT001', message = 'TASK_UNAUTHENTICATED'; end if;
  if p_owner_id is null or p_due_at is null or (p_lead_id is null) = (p_quote_id is null) then
    raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
  end if;
  v_description := nullif(trim(p_description), '');
  if v_description is null or char_length(v_description) > 2000 then
    raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_owner_id and p.is_active) or not public.task_actor_can_manage(p_owner_id) then
    raise exception using errcode = 'PT003', message = 'TASK_FORBIDDEN';
  end if;
  if p_lead_id is not null then
    if not exists (select 1 from public.leads l where l.id = p_lead_id and l.deleted_at is null) then
      raise exception using errcode = 'PT004', message = 'TASK_CONTEXT_INVALID';
    end if;
    v_context := 'lead=' || lower(p_lead_id::text);
  else
    if not exists (select 1 from public.quotes q where q.id = p_quote_id and q.deleted_at is null) then
      raise exception using errcode = 'PT004', message = 'TASK_CONTEXT_INVALID';
    end if;
    v_context := 'quote=' || lower(p_quote_id::text);
  end if;
  v_key := encode(extensions.digest('tasks:v1|owner=' || lower(p_owner_id::text) || '|' || v_context, 'sha256'), 'hex');

  insert into public.tasks(owner_id, lead_id, quote_id, description, due_at, idempotency_key)
  values (p_owner_id, p_lead_id, p_quote_id, v_description, p_due_at, v_key)
  on conflict (owner_id, idempotency_key) do nothing
  returning * into v_task;
  if v_task.id is not null then return v_task; end if;

  select * into v_task from public.tasks t
  where t.owner_id = p_owner_id and t.idempotency_key = v_key for update;
  if v_task.id is null then raise exception using errcode = 'PT005', message = 'TASK_IDEMPOTENCY_CONFLICT'; end if;
  if v_task.lead_id is distinct from p_lead_id or v_task.quote_id is distinct from p_quote_id
     or v_task.description is distinct from v_description or v_task.due_at is distinct from p_due_at then
    raise exception using errcode = 'PT005', message = 'TASK_IDEMPOTENCY_CONFLICT';
  end if;
  return v_task;
end;
$function$;

create or replace function public.task_transition(p_task_id uuid, p_target_status text)
returns public.tasks language plpgsql volatile security definer set search_path = public
as $function$
declare v_task public.tasks;
begin
  if auth.uid() is null then raise exception using errcode = 'PT001', message = 'TASK_UNAUTHENTICATED'; end if;
  if p_task_id is null or p_target_status is null or p_target_status not in ('pending','in_progress','completed','canceled') then
    raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
  end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null or not public.task_actor_can_manage(v_task.owner_id) then
    raise exception using errcode = 'PT003', message = 'TASK_FORBIDDEN';
  end if;
  if v_task.status = p_target_status or (v_task.status = 'pending' and p_target_status not in ('in_progress','canceled'))
     or (v_task.status = 'in_progress' and p_target_status not in ('completed','canceled'))
     or v_task.status in ('completed','canceled') then
    raise exception using errcode = 'PT006', message = 'TASK_INVALID_TRANSITION';
  end if;
  update public.tasks set status = p_target_status, updated_at = now() where id = p_task_id returning * into v_task;
  return v_task;
end;
$function$;

alter function public.task_actor_can_manage(uuid) owner to postgres;
alter function public.create_task(uuid, uuid, uuid, text, timestamptz) owner to postgres;
alter function public.task_transition(uuid, text) owner to postgres;
revoke all on function public.task_actor_can_manage(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_task(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.task_transition(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.task_actor_can_manage(uuid) to authenticated;
grant execute on function public.create_task(uuid, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.task_transition(uuid, text) to authenticated;

alter table public.tasks enable row level security;
create policy "tasks authenticated read scoped" on public.tasks for select to authenticated
using (public.task_actor_can_manage(owner_id));

revoke all on table public.tasks from public, anon, authenticated, service_role;
grant select on table public.tasks to authenticated;

commit;
