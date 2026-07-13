-- Storage bucket for coordinator Excel uploads (audit trail).
-- Files are stored under {user_id}/{timestamp}_{filename} and are never public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'excel-imports',
  'excel-imports',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;

-- Only tb_coordinator / system_admin can upload, scoped to their own folder.
create policy "coordinators_upload_excel"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'excel-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('tb_coordinator', 'system_admin')
  )
);

-- Users can read only their own files.
create policy "coordinators_read_own_excel"
on storage.objects for select
to authenticated
using (
  bucket_id = 'excel-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('tb_coordinator', 'system_admin')
  )
);

-- Users can delete only their own files.
create policy "coordinators_delete_own_excel"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'excel-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('tb_coordinator', 'system_admin')
  )
);
