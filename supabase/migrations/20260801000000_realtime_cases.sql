-- Enable Supabase Realtime for the `cases` table so dashboards can subscribe to
-- inserts/updates/deletes via the supabase_realtime publication. REPLICA
-- IDENTITY FULL is set so payloads include the full old/new row.

alter table public.cases replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.cases';
    exception when duplicate_object then
      null;
    end;
  end if;
end
$$;
