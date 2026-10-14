-- Every staff account sees every hotspot.
--
-- Area staff (health_worker, barangay_admin) were limited to hotspots touching
-- their own barangay, so anyone outside a cluster saw the Gi* map coloured red
-- under a "No hotspots to show" overlay — hotspot_results was already readable
-- citywide by all staff, only this table was scoped. A hotspot row is an
-- aggregate (barangay, count, Gi* score), never a patient, so widening it
-- exposes nothing case-level. Case-level reads stay scoped by the cases policy.

drop policy if exists "hotspots staff read" on public.hotspots;

create policy "hotspots staff read"
  on public.hotspots for select
  using (public.is_staff());
