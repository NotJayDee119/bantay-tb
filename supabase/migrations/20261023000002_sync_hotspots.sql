-- Keep current hotspots in place across runs instead of delete-and-reinsert.
--
-- detect-hotspots used to delete every TB hotspot and insert the new run's.
-- hotspot_alerts.hotspot_id cascades on delete, so every run wiped the alerts
-- raised by the run before it. Under Gi* alerts fire only when a barangay
-- NEWLY becomes a hotspot — so the next run deleted the alert and, the
-- barangay no longer being new, never raised it again. Two Hotspots pages
-- opening at once made it worse: both runs saw "no previous run", both
-- alerted, and the second deleted the first's rows and alerts mid-flight.
--
-- sync_hotspots() applies one run atomically under an advisory lock:
--   * barangays still hot   → row updated in place (alerts survive),
--   * barangays no longer hot → row deleted (their alerts go with it),
--   * barangays newly hot   → row inserted and reported back with is_new,
-- and "new" is judged against the hotspots table inside the lock, so two
-- concurrent runs serialise and only the first one alerts.

-- One current hotspot row per barangay. Clearing first also resets the rows
-- whose alerts the delete-and-reinsert runs already destroyed, so the next run
-- raises those alerts again.
delete from public.hotspots where disease = 'tb';

create unique index if not exists hotspots_tb_barangay_uniq
  on public.hotspots (barangay_psgc)
  where disease = 'tb';

create or replace function public.sync_hotspots(p_rows jsonb)
returns table (
  hotspot_id uuid,
  psgc bigint,
  psgcs bigint[],
  sev text,
  is_new boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('bantay_tb_detect_hotspots'));

  -- No longer a hotspot in this run.
  delete from public.hotspots h
  where h.disease = 'tb'
    and not exists (
      select 1 from jsonb_array_elements(p_rows) r
      where (r ->> 'barangay_psgc')::bigint = h.barangay_psgc
    );

  return query
  with incoming as (
    select * from jsonb_populate_recordset(null::public.hotspots, p_rows)
  ),
  upd as (
    update public.hotspots h
    set barangay_psgcs = i.barangay_psgcs,
        case_ids       = i.case_ids,
        case_count     = i.case_count,
        density        = i.density,
        severity       = i.severity,
        window_start   = i.window_start,
        window_end     = i.window_end,
        centroid_lat   = i.centroid_lat,
        centroid_lon   = i.centroid_lon,
        radius_km      = i.radius_km,
        run_id         = i.run_id,
        gi_z           = i.gi_z,
        gi_p           = i.gi_p,
        gi_class       = i.gi_class
    from incoming i
    where h.disease = 'tb' and h.barangay_psgc = i.barangay_psgc
    returning h.id, h.barangay_psgc, h.barangay_psgcs, h.severity::text, false
  ),
  ins as (
    insert into public.hotspots (
      barangay_psgc, barangay_psgcs, case_ids, disease, case_count, density,
      severity, window_start, window_end, centroid_lat, centroid_lon,
      radius_km, run_id, gi_z, gi_p, gi_class
    )
    select
      i.barangay_psgc, i.barangay_psgcs, i.case_ids, 'tb', i.case_count,
      i.density, i.severity, i.window_start, i.window_end, i.centroid_lat,
      i.centroid_lon, i.radius_km, i.run_id, i.gi_z, i.gi_p, i.gi_class
    from incoming i
    where not exists (
      select 1 from public.hotspots h
      where h.disease = 'tb' and h.barangay_psgc = i.barangay_psgc
    )
    returning id, barangay_psgc, barangay_psgcs, severity::text, true
  )
  select * from upd
  union all
  select * from ins;
end;
$$;

revoke all on function public.sync_hotspots(jsonb) from public, anon, authenticated;
grant execute on function public.sync_hotspots(jsonb) to service_role;
