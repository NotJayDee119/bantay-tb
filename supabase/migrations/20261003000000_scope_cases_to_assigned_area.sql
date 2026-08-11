-- Re-scope case reads to a staff member's assigned barangay.
--
-- 20261002000000_citywide_cases_read relaxed "cases staff read" down to a
-- plain is_staff() check so the GIS heatmap could render every barangay's
-- dots for barangay_admin / health_worker accounts. That reopened exactly
-- what 20260501000000_barangay_scoped_rls had closed: a BHW assigned to
-- Mintal could read — and page through — every TB case in Davao City.
--
-- Product decision: community-level operators see ONLY their assigned area,
-- the map included. The heatmap keeps working for them; it simply renders
-- their own barangay instead of the whole city.
--
--   system_admin / tb_coordinator : citywide (is_citywide_staff())
--   barangay_admin / health_worker: own barangay only
--   patient                       : own rows only (untouched)
--
-- Fail-closed note: a staff account with barangay_psgc IS NULL now reads no
-- cases at all, because the comparison yields NULL and the policy fails.
-- That is intended — a system_admin assigns the area at onboarding via
-- /app/users. The Cases page surfaces an explicit "no area assigned" notice
-- so the empty state doesn't read as a bug.

drop policy if exists "cases staff read" on public.cases;

create policy "cases staff read"
  on public.cases for select
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );

-- 20261001000000_pipeline_refactor added "cases staff delete" with a plain
-- is_staff() check to support the replace-all upload flow. That let any
-- community operator delete cases citywide. /app/import is tb_coordinator
-- only in the UI, but RLS is the real boundary — scope the delete to match
-- the read so the UI gate isn't the only thing standing in the way.

drop policy if exists "cases staff delete" on public.cases;

create policy "cases staff delete"
  on public.cases for delete
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );
