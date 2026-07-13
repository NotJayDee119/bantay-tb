-- Pipeline refactor: 4-level barangay resolution, replace-all upload,
-- updated DBSCAN defaults, new hotspot severity tiers.

-- 1. New columns on cases for the expanded import pipeline.
alter table public.cases add column if not exists patient_code text;
alter table public.cases add column if not exists diagnosis_date date;
alter table public.cases add column if not exists source_file_path text;

-- 2. DELETE RLS policy — required for the replace-all upload flow.
create policy "cases staff delete"
  on public.cases for delete
  using (public.is_staff());

-- 3. Expand the severity enum with new priority tiers.
alter type public.severity add value if not exists 'watch';
alter type public.severity add value if not exists 'moderate';
alter type public.severity add value if not exists 'urgent';

-- 4. Update DBSCAN defaults stored in app_settings.
insert into public.app_settings (key, value, updated_at)
values (
  'dbscan',
  '{"eps_km": 5, "min_pts": 2, "window_days": 90}'::jsonb,
  now()
)
on conflict (key)
do update set
  value = '{"eps_km": 5, "min_pts": 2, "window_days": 90}'::jsonb,
  updated_at = now();
