-- Let a health centre record the patients who walk into it.
--
-- 20260501000000 wrote the insert rule when only tb_coordinator and
-- barangay_admin filed cases: you may create a case in the barangay you cover,
-- and nowhere else. 20261010000000 later opened *read* and *update* to a
-- health worker's own facility — a Mintal clinic dosing five Calinan residents
-- has to see and update those five — but deliberately left insert alone,
-- noting that "/app/cases/new is tb_coordinator + barangay_admin anyway".
--
-- That is no longer true. Enrollment starts from a case that already exists in
-- the facility's register, and the person who creates that record is the nurse
-- at the counter when the patient walks in. With insert still pinned to
-- residence, a Mintal nurse could not record a Calinan resident at all — the
-- single most ordinary event in a DOTS centre.
--
-- The rule each role gets now mirrors the read scope:
--
--   system_admin / tb_coordinator : any barangay, any facility (citywide)
--   barangay_admin                : residents of its own barangay. Only.
--   health_worker                 : any barangay of residence, PROVIDED the
--                                   case is filed against ITS OWN facility.
--
-- The facility clause is what keeps this from being a hole. A health worker
-- still cannot inject a case into another barangay's register unattached —
-- whatever they create is stamped with their own clinic, which is exactly the
-- claim they are entitled to make: "this patient registered with us".

drop policy if exists "cases staff insert" on public.cases;

create policy "cases staff insert"
  on public.cases for insert
  with check (
    public.is_citywide_staff()
    or (
      public.current_role() = 'barangay_admin'::public.app_role
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
    or (
      public.current_role() = 'health_worker'::public.app_role
      and (
        -- Its own residents, as before.
        (barangay_psgc is not null
         and barangay_psgc = public.current_user_barangay())
        -- Or anyone at all, as long as the case is theirs to answer for.
        or (facility_id is not null
         and facility_id = public.current_user_facility())
      )
    )
  );

comment on policy "cases staff insert" on public.cases is
  'A health centre may register a patient living in any barangay, provided the case is filed against its own facility. Everyone else files by residence.';
