-- Allow all staff to read cases city-wide so the GIS heatmap shows
-- complete disease distribution regardless of role.
--
-- Background: barangay_scoped_rls (20260501) restricted reads to own
-- barangay, which was correct for raw patient data but broke the GIS
-- heatmap for barangay_admin / health_worker users — they only saw
-- their own barangay's markers. The citywide_heatmap migration
-- (20260601) added a barangay_case_counts aggregate function, but
-- GISMapTab uses individual jitter_lat/jitter_lon coordinates for
-- DBSCAN clustering, so aggregate counts aren't sufficient.
--
-- Individual coordinates are already anonymised with a ~75 m radial
-- jitter applied at import time (no exact addresses are stored), so
-- exposing them city-wide to authenticated staff is acceptable.
--
-- Write policies (insert / update / delete) remain barangay-scoped.

drop policy if exists "cases staff read" on public.cases;

create policy "cases staff read"
  on public.cases for select
  using (public.is_staff());
