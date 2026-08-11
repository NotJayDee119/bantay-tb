-- Split the barangay dashboard from the health centre, and pin a health
-- centre account to its own facility.
--
-- 20261007000000_scope_cases_by_area_or_facility gave `barangay_admin` and
-- `health_worker` one shared rule: residents of my barangay UNION cases
-- registered at any DOTS facility standing in my barangay. That single rule
-- was wrong at both ends of it.
--
-- 1. The barangay dashboard saw non-residents. A patient living in Calinan
--    who registered at a clinic inside Barangay X appeared on X's register.
--    A barangay's mandate is the people who live in it — contact tracing,
--    household visits, local response. Someone else's resident is not theirs
--    to hold, and holding them is a disclosure with no duty behind it.
--
-- 2. "Own facility" was never modelled. `profiles` carried only a barangay,
--    so a health worker was scoped to EVERY clinic in their barangay. Where
--    two DOTS centres share a barangay — Davao Doctors DOTS and City Health
--    Office Central DOTS both sit in the Poblacion cluster — each one's staff
--    could read the other's register. And a worker posted to a clinic outside
--    their assigned barangay matched nothing at all.
--
-- The scope now follows the role, and each role gets the axis its job runs on:
--
--   system_admin / tb_coordinator : citywide, both axes. Policy and budget
--                                   need the origin spread, so residence stays
--                                   readable across the whole city.
--   barangay_admin                : residents of the assigned barangay. Only.
--   health_worker                 : residents of the assigned barangay
--                                   (contact tracing) UNION every case
--                                   registered at ITS OWN facility, wherever
--                                   those patients live (directly observed
--                                   treatment).
--   patient                       : own rows only (untouched).
--
-- Clause 2 is the one that has to reach across barangays: a health centre
-- treats who walks in, and a Mintal clinic dosing five Baguio residents must
-- be able to see and update those five. It reaches by facility identity now,
-- not by "some clinic near me".

-- ---------------------------------------------------------------------------
-- profiles.facility_id — which DOTS facility this account is posted to
-- ---------------------------------------------------------------------------
-- Nullable and unconstrained by role on purpose. A tb_coordinator may carry a
-- facility for display without it narrowing anything (they read citywide), and
-- a barangay_admin's facility is simply ignored by the policies below. Only
-- health_worker reads through it.

alter table public.profiles
  add column if not exists facility_id uuid
    references public.dots_centers (id) on delete set null;

create index if not exists profiles_facility_id_idx
  on public.profiles (facility_id);

comment on column public.profiles.facility_id is
  'DOTS facility this staff account is posted to. Drives the health_worker case scope: they read every case registered at this facility, including patients residing in other barangays. Null for barangay_admin (residence-scoped) and for citywide roles.';

comment on column public.profiles.barangay_psgc is
  'Barangay this staff account covers — the residence axis. barangay_admin sees exactly this barangay''s residents; health_worker sees them plus their own facility''s register.';

-- ---------------------------------------------------------------------------
-- Helper: the caller's own facility
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER and no-argument, mirroring current_user_barangay(). Taking
-- no arguments is what keeps it cheap: Postgres evaluates a STABLE no-arg
-- function once per query rather than once per row, so `facility_id =
-- current_user_facility()` still uses cases_facility_id_idx. A predicate that
-- took the row's columns as arguments would defeat that on every case scan.

create or replace function public.current_user_facility()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select facility_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_facility() to authenticated;

comment on function public.current_user_facility() is
  'The DOTS facility the calling staff member is posted to, or null. Used by the cases policies so a health centre can reach the patients it registered, who often live in another barangay.';

-- ---------------------------------------------------------------------------
-- cases: read + update
-- ---------------------------------------------------------------------------
-- Both fail closed. current_user_barangay() / current_user_facility() return
-- null for an unassigned account, `col = null` yields null, and a null USING
-- clause is not true — so a staff member with neither assignment reads zero
-- cases until a system_admin sets one. That is intended; the Cases page prints
-- an explicit notice so the empty state doesn't read as a bug.

drop policy if exists "cases staff read" on public.cases;

create policy "cases staff read"
  on public.cases for select
  using (
    -- Citywide surveillance: TB Coordinator + System Admin.
    public.is_citywide_staff()
    -- Barangay dashboard: its own residents, and nothing else.
    or (
      public.current_role() = 'barangay_admin'::public.app_role
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
    -- Health centre: its own residents, plus its own facility's register.
    or (
      public.current_role() = 'health_worker'::public.app_role
      and (
        (barangay_psgc is not null
         and barangay_psgc = public.current_user_barangay())
        or (facility_id is not null
         and facility_id = public.current_user_facility())
      )
    )
  );

-- Update tracks read exactly. Recording a treatment outcome for a patient your
-- clinic registered is the entire reason clause 2 crosses barangays; a health
-- worker who could see the row but not update it would be stuck where they
-- started. A barangay_admin correspondingly loses update on non-residents,
-- which they should never have had.
drop policy if exists "cases staff update" on public.cases;

create policy "cases staff update"
  on public.cases for update
  using (
    public.is_citywide_staff()
    or (
      public.current_role() = 'barangay_admin'::public.app_role
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
    or (
      public.current_role() = 'health_worker'::public.app_role
      and (
        (barangay_psgc is not null
         and barangay_psgc = public.current_user_barangay())
        or (facility_id is not null
         and facility_id = public.current_user_facility())
      )
    )
  );

-- Insert and delete are deliberately left alone, both at residence only:
--
--   insert (20260501000000) — a case may only be filed against the barangay
--     the encoder covers, so no account can inject a case into someone else's
--     area. /app/cases/new is tb_coordinator + barangay_admin anyway.
--   delete (20261003000000) — registering a patient is a reason to read and
--     update their record, never to destroy it. Bulk delete belongs to the
--     replace-all import, which is tb_coordinator work.

-- ---------------------------------------------------------------------------
-- Retire facility_in_user_barangay()
-- ---------------------------------------------------------------------------
-- It answered "is this clinic near me", which is the proxy this migration
-- replaces with facility identity. Nothing else calls it.

drop function if exists public.facility_in_user_barangay(uuid);

-- ---------------------------------------------------------------------------
-- Freeze facility_id on the self-update path
-- ---------------------------------------------------------------------------
-- Same escalation 20260701000000 closed for `role` and `barangay_psgc`, now
-- reachable through the new column: a health_worker could otherwise run
--   supabase.from('profiles').update({ facility_id: <other> }).eq('id', me)
-- from the browser and read any clinic's register in the city. Only
-- system_admin reassigns a facility, via the "profiles admin update" policy.

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from
      (select p.role from public.profiles p where p.id = auth.uid())
    and barangay_psgc is not distinct from
      (select p.barangay_psgc from public.profiles p where p.id = auth.uid())
    and facility_id is not distinct from
      (select p.facility_id from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Carry facility_id through registration
-- ---------------------------------------------------------------------------
-- Staff registration is invite-gated and the registrant already picks their own
-- role and barangay, so the facility rides the same trust level. The
-- system_admin cap from 20260701000000 is preserved verbatim.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bgy bigint;
  fac uuid;
  requested public.app_role;
  effective public.app_role;
begin
  bgy := nullif(new.raw_user_meta_data ->> 'barangay_psgc', '')::bigint;
  fac := nullif(new.raw_user_meta_data ->> 'facility_id', '')::uuid;
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
  insert into public.profiles (id, email, full_name, role, barangay_psgc, facility_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    effective,
    bgy,
    fac
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
