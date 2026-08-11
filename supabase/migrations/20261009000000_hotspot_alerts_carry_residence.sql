-- An alert must name the residences behind the hotspot, not just its barangay.
--
-- A hotspot alert carried the cluster's *modal* barangay, its case count and
-- its radius. Two failures followed, both the same shape: the alert never said
-- which households it was about.
--
--   1. Routing. A cluster straddling Calinan (12 residents) and Baguio (9) was
--      filed under Calinan alone. Calinan staff were alerted for 21 cases when
--      only 12 live in their area, and Baguio staff — whose residents were the
--      other 9 — were never told at all.
--   2. Content. Even a correctly-routed recipient could not check the claim.
--      A health centre reading "21 cases, 1.4 km radius" cannot tell which of
--      them are its own, and the registering facility does not answer that: a
--      Calinan resident routinely registers at Mintal DOTS
--      (see 20261008000000_facility_is_registration_not_treatment).
--
-- So a hotspot now records the cases that formed it and every barangay of
-- RESIDENCE it touches. Alerts fan out to all of those barangays, and the alert
-- view resolves case_ids back to `cases`, where the read policy from
-- 20261007000000 already limits each recipient to residents of their own area
-- plus their own facility's registrations. The addresses a health worker reads
-- in an alert are therefore exactly the ones they are entitled to act on —
-- the database, not the UI, draws that line.

alter table public.hotspots
  add column case_ids uuid[] not null default '{}',
  add column barangay_psgcs bigint[] not null default '{}';

comment on column public.hotspots.case_ids is
  'Cases that formed this cluster. Resolved against `cases` under RLS so an alert can show each recipient the patient residences they may act on. Deliberately not a foreign key: hotspots are recomputed and replaced wholesale, and a stale id must degrade to "no longer on file" rather than block the run.';

comment on column public.hotspots.barangay_psgcs is
  'Every barangay of RESIDENCE with at least one case in this cluster — not just the modal one in barangay_psgc. Alert routing and the staff read policy key on this so a cluster that straddles a boundary reaches every area it actually covers.';

-- The widened read policy below tests membership on every hotspot row.
create index if not exists hotspots_barangay_psgcs_idx
  on public.hotspots using gin (barangay_psgcs);

-- ---------------------------------------------------------------------------
-- Read policy: an area worker whose barangay sits anywhere in the cluster must
-- be able to open the hotspot their alert points at, or the alert renders as a
-- dead reference. Keyed to the residence array, so this widens visibility only
-- to areas whose own residents are in the cluster — never to the city.
-- ---------------------------------------------------------------------------

drop policy if exists "hotspots staff read" on public.hotspots;

create policy "hotspots staff read"
  on public.hotspots for select
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and (
        (barangay_psgc is not null
         and barangay_psgc = public.current_user_barangay())
        or public.current_user_barangay() = any (barangay_psgcs)
      )
    )
  );
