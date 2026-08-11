-- Let a BHW, nurse or doctor upload their own case file.
--
-- 20260901000000 created the excel-imports bucket when bulk import was a TB
-- Coordinator errand, and wrote all three policies as
-- `role in ('tb_coordinator','system_admin')`. Field staff now upload their own
-- registers, so the archived copy of the file — the audit trail that proves
-- what was imported and by whom — has to be writable by them too.
--
-- What does NOT change: the folder rule. Every object still lives under
-- {auth.uid()}/, and read and delete are still restricted to your own folder.
-- A barangay admin cannot list, download or remove another account's uploads.
-- Widening the role check without that clause would turn a private audit trail
-- into a shared drive of every barangay's spreadsheets.
--
-- The `cases` policies are deliberately untouched. Insert already covers field
-- staff (20261015000000): file in the barangay you cover, or against your own
-- clinic. Delete stays where 20261003000000 left it — residence-scoped — and
-- the importer no longer asks scoped accounts to delete anything at all, since
-- a field upload appends rather than replacing. Replace-all remains a
-- coordinator action, and `is_citywide_staff()` is what still gates it.

create or replace function public.can_archive_import()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in (
        'tb_coordinator',
        'system_admin',
        'barangay_admin',
        'health_worker'
      )
  );
$$;

comment on function public.can_archive_import() is
  'True for staff roles allowed to bulk-import cases and archive the source file. Patients are excluded.';

drop policy if exists "coordinators_upload_excel" on storage.objects;
drop policy if exists "coordinators_read_own_excel" on storage.objects;
drop policy if exists "coordinators_delete_own_excel" on storage.objects;

create policy "staff_upload_own_excel"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'excel-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_archive_import()
);

create policy "staff_read_own_excel"
on storage.objects for select
to authenticated
using (
  bucket_id = 'excel-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_archive_import()
);

create policy "staff_delete_own_excel"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'excel-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_archive_import()
);
