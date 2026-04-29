-- Citywide aggregate access for the GIS heatmap.
--
-- Per the BANTAY-TB conceptual framework + paper:
--   "Barangay Health Workers, Nurses, and Doctors... analyze GIS heatmap
--    outputs to identify high-risk areas..."
--
-- This requires staff to see *aggregate* case density across the whole city,
-- not just their own barangay. PR #8 correctly scoped raw `cases` rows to
-- the user's barangay (preserving privacy of individual records and
-- adherence/SMS data), but that also hid the citywide totals needed for
-- epidemiological surveillance on the heatmap.
--
-- Solution: a SECURITY DEFINER function that returns *only* per-barangay
-- counts (no patient-level data, no coordinates, no PII). Any authenticated
-- staff member may invoke it; the database itself enforces aggregation so
-- there is no row-level leak.

create or replace function public.barangay_case_counts(
  p_disease text default null,
  p_days int default 180
)
returns table (
  barangay_psgc bigint,
  case_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.barangay_psgc,
    count(*)::bigint as case_count
  from public.cases c
  where c.reported_at >= now() - (p_days || ' days')::interval
    and (
      p_disease is null
      or p_disease = 'all'
      or c.disease::text = p_disease
    )
  group by c.barangay_psgc;
$$;

revoke all on function public.barangay_case_counts(text, int) from public;
grant execute on function public.barangay_case_counts(text, int)
  to authenticated;
