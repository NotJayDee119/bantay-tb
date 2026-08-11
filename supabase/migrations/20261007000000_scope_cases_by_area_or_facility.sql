-- Let area staff see the patients their own clinic treats.
--
-- 20261003000000_scope_cases_to_assigned_area scoped case reads to the
-- staff member's assigned barangay. When 20261005000000_case_treatment_facility
-- split residence from facility of treatment, `barangay_psgc` came to mean
-- strictly "where the patient lives" — and that quietly broke the clinic side
-- of the job.
--
-- Concretely: Mintal has no TB cases living in it, but the Mintal DOTS clinic
-- treats five patients who live in Baguio (Pob.) and Catalunan Grande. The
-- health worker assigned to Mintal saw an empty case register while the GIS
-- map showed five patients treated at their own facility. They could not
-- record a dose for a patient standing in front of them.
--
-- A barangay health worker has two duties, and they key on different columns:
--
--   contact tracing / surveillance -> cases RESIDING in their barangay
--   directly observed treatment    -> cases TREATED at a facility in it
--
-- So the scope becomes the union of the two. It stays a real boundary: a
-- worker still cannot browse the city. They see another barangay's resident
-- only when their own clinic is the one treating that person.
--
-- Delete is deliberately NOT widened — see the bottom of this file.

/**
 * True when `p_facility_id` is a DOTS facility sitting in the caller's
 * assigned barangay.
 *
 * Plain STABLE (not SECURITY DEFINER): `dots_centers` is world-readable
 * ("dots_centers read" USING true), so this needs no elevation. It leans on
 * current_user_barangay(), which is already SECURITY DEFINER.
 *
 * Returns false rather than null for an unlinked case, so a case with no
 * facility can never widen anyone's scope.
 */
create or replace function public.facility_in_user_barangay(p_facility_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.dots_centers d
    where d.id = p_facility_id
      and d.barangay_psgc is not null
      and d.barangay_psgc = public.current_user_barangay()
  );
$$;

comment on function public.facility_in_user_barangay(uuid) is
  'True when the given DOTS facility is in the calling staff member''s assigned barangay. Used by the cases RLS policies so clinic staff can see the patients they treat.';

-- ── Read ────────────────────────────────────────────────────────────────
drop policy if exists "cases staff read" on public.cases;

create policy "cases staff read"
  on public.cases for select
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and (
        (barangay_psgc is not null
         and barangay_psgc = public.current_user_barangay())
        or public.facility_in_user_barangay(facility_id)
      )
    )
  );

-- ── Update ──────────────────────────────────────────────────────────────
-- Matches the read scope: recording a treatment outcome for a patient your
-- clinic is treating is the whole point of the widening. A worker who can see
-- the case but not update it would be stuck the same way as before.
drop policy if exists "cases staff update" on public.cases;

create policy "cases staff update"
  on public.cases for update
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and (
        (barangay_psgc is not null
         and barangay_psgc = public.current_user_barangay())
        or public.facility_in_user_barangay(facility_id)
      )
    )
  );

-- ── Delete: left at residence only, on purpose ──────────────────────────
-- Treating a patient is a reason to read and update their record, not to
-- destroy it. Deleting another barangay's resident is not part of running a
-- DOTS clinic, and the replace-all import flow that needs bulk delete is
-- tb_coordinator work. "cases staff delete" therefore keeps the narrower
-- 20261003 rule and is not touched here.
