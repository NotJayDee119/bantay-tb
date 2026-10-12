-- Per-barangay case counts, split by calendar year, for the public map.
--
-- barangay_case_counts only answers "the last N days from today", so the
-- landing page map could not show a specific year — and once the newest
-- data was more than a year old it showed an empty city. This returns one
-- row per (year, barangay), so the page can offer "All years / 2025 / 2024"
-- and switch between them without another round trip.
--
-- Same privacy guarantee as barangay_case_counts: SECURITY DEFINER, grouped
-- totals only — no patient rows, coordinates or identifiers ever leave the
-- database. The year is the Philippine calendar year, matching the staff
-- dashboards.

create or replace function public.barangay_case_counts_yearly(
  p_disease text default null
)
returns table (year int, barangay_psgc bigint, case_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    extract(year from c.reported_at at time zone 'Asia/Manila')::int as year,
    c.barangay_psgc,
    count(*)::bigint as case_count
  from public.cases c
  where c.reported_at is not null
    and (
      p_disease is null
      or p_disease = 'all'
      or c.disease::text = p_disease
    )
  group by 1, 2;
$$;

grant execute on function public.barangay_case_counts_yearly(text)
  to anon, authenticated;
