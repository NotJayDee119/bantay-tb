-- Allow alert recipients (and staff) to mark their hotspot alerts as read.
-- The init migration only created select+insert policies; without an update
-- policy, the Alerts inbox cannot persist read_at timestamps.

create policy "hotspot_alerts user update"
  on public.hotspot_alerts for update
  using (recipient_id = auth.uid() or public.is_staff())
  with check (recipient_id = auth.uid() or public.is_staff());
