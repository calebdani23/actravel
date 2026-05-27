create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = auth.uid()
      and p.is_active
      and r.name = role_name
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role('admin'); $$;

create or replace function public.is_assigned_lead(lead_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leads l
    where l.id = lead_uuid and l.assigned_to = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.profile_roles enable row level security;
alter table public.contacts enable row level security;
alter table public.lead_statuses enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_events enable row level security;
alter table public.quote_requests enable row level security;
alter table public.destinations enable row level security;
alter table public.services enable row level security;
alter table public.promotions enable row level security;
alter table public.promotion_media enable row level security;
alter table public.payment_methods enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_clicks enable row level security;
alter table public.notification_logs enable row level security;
alter table public.sheet_sync_logs enable row level security;

create policy "profiles self or admin read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "roles staff read" on public.roles for select to authenticated using (public.has_role('admin') or public.has_role('asesor') or public.has_role('operaciones') or public.has_role('finanzas') or public.has_role('marketing'));
create policy "roles admin write" on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profile_roles self or admin read" on public.profile_roles for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "profile_roles admin write" on public.profile_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "anon read published destinations" on public.destinations for select to anon using (status = 'published');
create policy "anon read published services" on public.services for select to anon using (status = 'published');
create policy "anon read published promotions" on public.promotions for select to anon using (status = 'published');
create policy "anon read public published media" on public.promotion_media for select to anon using (
  is_public and (
    (promotion_id is not null and exists (select 1 from public.promotions p where p.id = promotion_id and p.status = 'published')) or
    (destination_id is not null and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')) or
    (service_id is not null and exists (select 1 from public.services s where s.id = service_id and s.status = 'published'))
  )
);

create policy "staff read destinations" on public.destinations for select to authenticated using (true);
create policy "marketing manage destinations" on public.destinations for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));
create policy "staff read services" on public.services for select to authenticated using (true);
create policy "marketing manage services" on public.services for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));
create policy "staff read promotions" on public.promotions for select to authenticated using (true);
create policy "marketing manage promotions" on public.promotions for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));
create policy "staff read promotion media" on public.promotion_media for select to authenticated using (true);
create policy "marketing manage promotion media" on public.promotion_media for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));

create policy "staff read lead statuses" on public.lead_statuses for select to authenticated using (true);
create policy "admin manage lead statuses" on public.lead_statuses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "crm contact read" on public.contacts for select to authenticated using (public.is_admin() or public.has_role('asesor') or public.has_role('operaciones') or public.has_role('finanzas'));
create policy "crm contact write" on public.contacts for all to authenticated using (public.is_admin() or public.has_role('asesor')) with check (public.is_admin() or public.has_role('asesor'));
create policy "lead read scoped" on public.leads for select to authenticated using (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or (public.has_role('asesor') and assigned_to = auth.uid()));
create policy "lead write scoped" on public.leads for all to authenticated using (public.is_admin() or (public.has_role('asesor') and (assigned_to = auth.uid() or assigned_to is null))) with check (public.is_admin() or (public.has_role('asesor') and (assigned_to = auth.uid() or assigned_to is null)));
create policy "lead notes read scoped" on public.lead_notes for select to authenticated using (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or public.is_assigned_lead(lead_id));
create policy "lead notes write scoped" on public.lead_notes for all to authenticated using (public.is_admin() or public.is_assigned_lead(lead_id)) with check (public.is_admin() or public.is_assigned_lead(lead_id));
create policy "lead events read scoped" on public.lead_events for select to authenticated using (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or public.is_assigned_lead(lead_id));
create policy "lead events write scoped" on public.lead_events for all to authenticated using (public.is_admin() or public.is_assigned_lead(lead_id)) with check (public.is_admin() or public.is_assigned_lead(lead_id));
create policy "quote requests staff read" on public.quote_requests for select to authenticated using (public.is_admin() or public.has_role('asesor') or public.has_role('marketing'));
create policy "quote requests staff write" on public.quote_requests for all to authenticated using (public.is_admin() or public.has_role('asesor')) with check (public.is_admin() or public.has_role('asesor'));

create policy "staff read payment methods" on public.payment_methods for select to authenticated using (true);
create policy "admin manage payment methods" on public.payment_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "bookings ops read" on public.bookings for select to authenticated using (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or assigned_to = auth.uid());
create policy "bookings ops write" on public.bookings for all to authenticated using (public.is_admin() or public.has_role('operaciones')) with check (public.is_admin() or public.has_role('operaciones'));
create policy "payments finance read" on public.payments for select to authenticated using (public.is_admin() or public.has_role('finanzas') or public.has_role('operaciones'));
create policy "payments finance write" on public.payments for all to authenticated using (public.is_admin() or public.has_role('finanzas')) with check (public.is_admin() or public.has_role('finanzas'));
create policy "documents ops read" on public.documents for select to authenticated using (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas'));
create policy "documents ops write" on public.documents for all to authenticated using (public.is_admin() or public.has_role('operaciones')) with check (public.is_admin() or public.has_role('operaciones'));
create policy "templates staff read" on public.message_templates for select to authenticated using (true);
create policy "templates marketing write" on public.message_templates for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));

create policy "logs staff read" on public.whatsapp_clicks for select to authenticated using (public.is_admin() or public.has_role('marketing') or public.has_role('asesor'));
create policy "logs staff write" on public.whatsapp_clicks for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));
create policy "notification logs staff read" on public.notification_logs for select to authenticated using (public.is_admin() or public.has_role('marketing') or public.has_role('asesor'));
create policy "notification logs staff write" on public.notification_logs for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));
create policy "sheet sync logs staff read" on public.sheet_sync_logs for select to authenticated using (public.is_admin() or public.has_role('marketing'));
create policy "sheet sync logs staff write" on public.sheet_sync_logs for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));

create policy "anon read catalog media objects" on storage.objects for select to anon using (bucket_id = 'catalog-media');
create policy "staff read private storage objects" on storage.objects for select to authenticated using (bucket_id = 'catalog-media' or public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or public.has_role('marketing'));
create policy "marketing manage catalog media objects" on storage.objects for all to authenticated using (bucket_id = 'catalog-media' and (public.is_admin() or public.has_role('marketing'))) with check (bucket_id = 'catalog-media' and (public.is_admin() or public.has_role('marketing')));
create policy "ops finance manage private storage objects" on storage.objects for all to authenticated using (bucket_id in ('documents', 'payment-proofs') and (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas'))) with check (bucket_id in ('documents', 'payment-proofs') and (public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas')));
