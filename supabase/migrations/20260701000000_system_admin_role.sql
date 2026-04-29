-- System administrator role.
--
-- Adds a `system_admin` role with citywide visibility plus user-management
-- powers (can update any profile's role and barangay assignment). System
-- admins drive the central monitoring dashboard at /app/admin and are
-- expected to onboard health workers by assigning them an area.
--
-- Role hierarchy after this migration:
--   system_admin   : citywide + manages users
--   tb_coordinator : citywide surveillance (existing)
--   barangay_admin : own-barangay only (PR #8)
--   health_worker  : own-barangay only (PR #8)
--   patient        : own rows only

-- ---------------------------------------------------------------------------
-- Enum: extend app_role with 'system_admin'
-- ---------------------------------------------------------------------------
alter type public.app_role add value if not exists 'system_admin';

-- ---------------------------------------------------------------------------
-- Helper functions: include system_admin where appropriate
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in (
       'barangay_admin', 'health_worker', 'tb_coordinator', 'system_admin'
     )
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_citywide_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('tb_coordinator', 'system_admin')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('tb_coordinator', 'barangay_admin', 'system_admin')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'system_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_super_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Profiles: allow system_admin to update any profile (role + barangay
-- reassignment for user management). The existing self-update policy is
-- preserved.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
  on public.profiles for update
  using (public.is_super_admin())
  with check (public.is_super_admin());
