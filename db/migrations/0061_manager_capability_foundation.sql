-- Add the persisted Manager role without changing existing authorization seams.
-- This migration is intentionally limited to role vocabulary, role seeding, and
-- the role-catalog read predicate. Existing helpers and data policies remain
-- authoritative for their current tables and operations.

begin;

alter table public.roles
  drop constraint if exists roles_name_check;

alter table public.roles
  add constraint roles_name_check check (
    name in ('admin', 'asesor', 'operaciones', 'finanzas', 'marketing', 'manager')
  );

insert into public.roles (name, description)
values ('manager', 'Management staff for approvals and operational visibility')
on conflict (name) do update
set description = excluded.description;

drop policy if exists "roles staff read" on public.roles;
create policy "roles staff read" on public.roles
for select to authenticated
using (
  public.has_role('admin')
  or public.has_role('asesor')
  or public.has_role('operaciones')
  or public.has_role('finanzas')
  or public.has_role('marketing')
  or public.has_role('manager')
);

commit;
