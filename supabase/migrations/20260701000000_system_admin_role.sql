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

-- ---------------------------------------------------------------------------
-- Privilege escalation guard: prevent self-registration as system_admin.
--
-- The handle_new_user() trigger (defined in 20260101000000_init.sql) blindly
-- trusts the role value supplied in raw_user_meta_data. The frontend filters
-- 'system_admin' out of the registration role dropdown, but a malicious user
-- could call supabase.auth.signUp() directly with role = 'system_admin' in
-- the user metadata, and combined with the new admin-update RLS policy
-- above this would be a complete privilege escalation. Cap the role inside
-- the trigger so only an existing system_admin (via /app/users) can elevate
-- another account.
--
-- Defense in depth: the profiles self-insert policy is also tightened to
-- forbid 'system_admin' inserts directly through the API.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bgy bigint;
  requested public.app_role;
  effective public.app_role;
begin
  bgy := nullif(new.raw_user_meta_data ->> 'barangay_psgc', '')::bigint;
  requested := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.app_role,
    'patient'::public.app_role
  );
  -- Cap self-registered system_admin requests down to 'patient'. A real
  -- system admin must be promoted by an existing system_admin via /app/users.
  if requested = 'system_admin'::public.app_role then
    effective := 'patient'::public.app_role;
  else
    effective := requested;
  end if;
  insert into public.profiles (id, email, full_name, role, barangay_psgc)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    effective,
    bgy
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
  on public.profiles for insert
  with check (auth.uid() = id and role <> 'system_admin'::public.app_role);

-- The pre-existing "profiles self update" policy from 20260101000000_init.sql
-- only checks `auth.uid() = id`, which lets any authenticated user mutate
-- ANY column on their own profile — including `role`. That is a complete
-- privilege escalation: a patient could run
--   supabase.from('profiles').update({ role: 'tb_coordinator' }).eq('id', me)
-- from the browser and immediately gain citywide read access via
-- is_citywide_staff(), or set role = 'system_admin' for admin powers.
-- Tighten the self-update policy so users can still update their profile
-- (name, phone, barangay) but the `role` column is frozen on the self path.
-- Only the "profiles admin update" policy (gated on is_super_admin()) can
-- change roles.
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from
      (select p.role from public.profiles p where p.id = auth.uid())
  );
