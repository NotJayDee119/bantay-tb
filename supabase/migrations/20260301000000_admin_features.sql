-- PR-B admin features: app_settings table + DOTS Center write policies.

-- ---------------------------------------------------------------------------
-- app_settings: small key/value store for runtime-configurable knobs (e.g.
-- DBSCAN thresholds the barangay admin / TB coordinator can tune from the
-- Settings page).
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.app_settings enable row level security;

create policy "app_settings read"
  on public.app_settings for select
  using (true);

create policy "app_settings staff insert"
  on public.app_settings for insert
  with check (public.is_staff());

create policy "app_settings staff update"
  on public.app_settings for update
  using (public.is_staff())
  with check (public.is_staff());

-- Seed DBSCAN defaults matching the values previously hardcoded in
-- supabase/functions/detect-hotspots/index.ts (eps_km=1.2, min_pts=8,
-- window_days=90).
insert into public.app_settings (key, value)
values (
  'dbscan',
  '{"eps_km": 1.2, "min_pts": 8, "window_days": 90}'::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- DOTS Center write policies: barangay_admin and tb_coordinator may add /
-- update / delete centers from the maintenance UI; everyone else still has
-- public read (init migration policy) for the public locator page.
-- ---------------------------------------------------------------------------
create policy "dots_centers staff insert"
  on public.dots_centers for insert
  with check (public.is_staff());

create policy "dots_centers staff update"
  on public.dots_centers for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "dots_centers staff delete"
  on public.dots_centers for delete
  using (public.is_staff());
