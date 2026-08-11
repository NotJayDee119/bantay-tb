-- ---------------------------------------------------------------------------
-- Hotspot detection now REPLACES the previous run instead of appending, so the
-- Hotspots list shows the current picture rather than a duplicate of every
-- cluster on each run. That requires a DELETE policy on public.hotspots — the
-- table has RLS enabled and previously exposed only SELECT + INSERT, so a
-- client-side delete was silently blocked (0 rows affected).
--
-- Scope the delete the same way as the read policy: citywide staff can clear
-- any hotspot; barangay-scoped staff can only clear hotspots in their own
-- barangay (so a barangay account can't wipe citywide detections). The
-- detect-hotspots Edge Function runs as service_role and bypasses RLS, so it
-- performs the full citywide replace.
-- ---------------------------------------------------------------------------

drop policy if exists "hotspots staff delete" on public.hotspots;

create policy "hotspots staff delete"
  on public.hotspots for delete
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );
