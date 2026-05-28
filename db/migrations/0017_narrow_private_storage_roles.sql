drop policy if exists "staff read private storage objects" on storage.objects;
drop policy if exists "ops finance manage private storage objects" on storage.objects;

create policy "staff read private storage objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'catalog-media'
  or (
    bucket_id = 'documents'
    and (public.is_admin() or public.has_role('operaciones'))
  )
  or (
    bucket_id = 'payment-proofs'
    and (public.is_admin() or public.has_role('finanzas'))
  )
);

create policy "operations manage document storage objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'documents'
  and (public.is_admin() or public.has_role('operaciones'))
)
with check (
  bucket_id = 'documents'
  and (public.is_admin() or public.has_role('operaciones'))
);

create policy "finance manage payment proof storage objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (public.is_admin() or public.has_role('finanzas'))
)
with check (
  bucket_id = 'payment-proofs'
  and (public.is_admin() or public.has_role('finanzas'))
);
