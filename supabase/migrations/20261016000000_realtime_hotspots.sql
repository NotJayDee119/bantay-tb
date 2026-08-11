-- Publish `hotspots` for Realtime, so the map's subscription to it is not a
-- subscription to nothing.
--
-- 20260801000000_realtime_cases added `cases` to supabase_realtime and stopped
-- there. The Hotspots page has subscribed to postgres_changes on `hotspots`
-- since it was written, but that table was never in the publication, so the
-- callback has never fired once. The page looked live and was not: it showed
-- whatever the last detection run had left behind, and only a full reload
-- picked up a new one.
--
-- With `cases` published and `hotspots` not, the map could react to a case
-- being recorded but not to a detection run finishing — including runs it did
-- not start itself. The case form fires its own run on insert, so the common
-- path was exactly the one that went unseen.
--
-- REPLICA IDENTITY FULL matches what `cases` was given: detection replaces the
-- whole TB set on every run (delete-then-insert), and a client that can read
-- the old row in the delete payload can tell a cleared hotspot apart from one
-- that simply moved.

alter table public.hotspots replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.hotspots';
    exception when duplicate_object then
      null;
    end;
  end if;
end
$$;

-- RLS still decides what each subscriber receives: Realtime evaluates the
-- "hotspots read" policy per recipient, so a barangay account is notified about
-- its own area's clusters and not about anyone else's.
