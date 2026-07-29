-- Contact-centric CRM governance fields and least-privilege staff reads.

alter table public.contacts
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists blocked_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_reason text;

alter table public.contacts drop constraint if exists contacts_lifecycle_status_check;
alter table public.contacts add constraint contacts_lifecycle_status_check
  check (lifecycle_status in ('active', 'follow_up', 'customer', 'inactive', 'blocked', 'deleted'));

alter table public.leads
  add column if not exists is_featured boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_reason text;

create index if not exists contacts_lifecycle_status_idx on public.contacts(lifecycle_status);
create index if not exists contacts_blocked_at_idx on public.contacts(blocked_at) where blocked_at is not null;
create index if not exists contacts_deleted_at_idx on public.contacts(deleted_at) where deleted_at is not null;
create index if not exists leads_featured_idx on public.leads(is_featured) where is_featured;
create index if not exists leads_archived_at_idx on public.leads(archived_at) where archived_at is not null;
create index if not exists leads_deleted_at_idx on public.leads(deleted_at) where deleted_at is not null;

-- Governance fields are mutated through the audited admin RPCs, not advisor updates.
create or replace function public.crm_guard_governance_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    if tg_table_name = 'contacts' and (
      new.lifecycle_status is distinct from old.lifecycle_status or
      new.blocked_at is distinct from old.blocked_at or
      new.blocked_by is distinct from old.blocked_by or
      new.blocked_reason is distinct from old.blocked_reason or
      new.deleted_at is distinct from old.deleted_at or
      new.deleted_by is distinct from old.deleted_by or
      new.deleted_reason is distinct from old.deleted_reason
    ) then raise insufficient_privilege using message = 'CRM governance fields require an administrator'; end if;
    if tg_table_name = 'leads' and (
      new.is_featured is distinct from old.is_featured or
      new.archived_at is distinct from old.archived_at or
      new.archived_by is distinct from old.archived_by or
      new.deleted_at is distinct from old.deleted_at or
      new.deleted_by is distinct from old.deleted_by or
      new.deleted_reason is distinct from old.deleted_reason
    ) then raise insufficient_privilege using message = 'CRM governance fields require an administrator'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_contacts_governance_fields on public.contacts;
create trigger guard_contacts_governance_fields before update on public.contacts
for each row execute function public.crm_guard_governance_fields();
drop trigger if exists guard_leads_governance_fields on public.leads;
create trigger guard_leads_governance_fields before update on public.leads
for each row execute function public.crm_guard_governance_fields();

drop policy if exists "crm contact read" on public.contacts;
create policy "crm contact read" on public.contacts for select to authenticated using (
  deleted_at is null and (
    public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
    (public.has_role('asesor') and exists (
      select 1 from public.leads l where l.contact_id = contacts.id
        and l.assigned_to = auth.uid() and l.deleted_at is null
    ))
  )
);

drop policy if exists "lead read scoped" on public.leads;
create policy "lead read scoped" on public.leads for select to authenticated using (
  deleted_at is null and (
    public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
    (public.has_role('asesor') and assigned_to = auth.uid())
  )
);

drop policy if exists "quote requests staff read" on public.quote_requests;
create policy "quote requests staff read" on public.quote_requests for select to authenticated using (
  public.is_admin() or public.has_role('marketing') or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (
    select 1 from public.leads l where l.id = quote_requests.lead_id
      and l.assigned_to = auth.uid() and l.deleted_at is null
  ))
);

drop policy if exists "logs staff read" on public.whatsapp_clicks;
create policy "logs staff read" on public.whatsapp_clicks for select to authenticated using (
  public.is_admin() or public.has_role('marketing') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = whatsapp_clicks.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
drop policy if exists "notification logs staff read" on public.notification_logs;
create policy "notification logs staff read" on public.notification_logs for select to authenticated using (
  public.is_admin() or public.has_role('marketing') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = notification_logs.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);

drop policy if exists "lead notes read scoped" on public.lead_notes;
create policy "lead notes read scoped" on public.lead_notes for select to authenticated using (
  public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = lead_notes.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
drop policy if exists "lead events read scoped" on public.lead_events;
create policy "lead events read scoped" on public.lead_events for select to authenticated using (
  public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = lead_events.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
drop policy if exists "whatsapp inbound staff read" on public.whatsapp_inbound_messages;
create policy "whatsapp inbound staff read" on public.whatsapp_inbound_messages for select to authenticated using (
  public.is_admin() or public.has_role('marketing') or public.has_role('operaciones') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = whatsapp_inbound_messages.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
