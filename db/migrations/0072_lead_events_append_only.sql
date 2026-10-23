begin;

drop policy if exists "lead events write scoped" on public.lead_events;
create policy "lead events insert scoped" on public.lead_events
for insert to authenticated
with check (public.is_admin() or public.is_assigned_lead(lead_id));

-- Rollback through a later additive migration only: drop "lead events insert scoped",
-- then restore the exact prior "lead events write scoped" FOR ALL policy with
-- USING and WITH CHECK both set to (public.is_admin() or public.is_assigned_lead(lead_id)).

commit;
