-- Tighten RLS on app_settings + dots_centers writes: only barangay_admin and
-- tb_coordinator (not health_worker) should be able to mutate these tables.
-- The original PR-B migration used public.is_staff() which also includes
-- health_worker, allowing a nurse/doctor account to bypass the frontend route
-- guard via direct API calls.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('tb_coordinator', 'barangay_admin')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- app_settings: replace staff-write policies with admin-only policies.
drop policy if exists "app_settings staff insert" on public.app_settings;
drop policy if exists "app_settings staff update" on public.app_settings;

create policy "app_settings admin insert"
  on public.app_settings for insert
  with check (public.is_admin());

create policy "app_settings admin update"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- dots_centers: same tightening for write paths. Read remains public so the
-- DOTS Locator page (no auth) keeps working.
drop policy if exists "dots_centers staff insert" on public.dots_centers;
drop policy if exists "dots_centers staff update" on public.dots_centers;
drop policy if exists "dots_centers staff delete" on public.dots_centers;

create policy "dots_centers admin insert"
  on public.dots_centers for insert
  with check (public.is_admin());

create policy "dots_centers admin update"
  on public.dots_centers for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "dots_centers admin delete"
  on public.dots_centers for delete
  using (public.is_admin());
