-- Public (anonymous) access to citywide per-barangay TB counts.
--
-- The public BANTAY-TB landing page shows residents a live map of TB burden
-- by barangay so they can see where the disease is concentrated in the city.
-- This only ever exposes *aggregated* counts per barangay — the same
-- SECURITY DEFINER function used by staff (see 20260601000000_citywide_heatmap.sql)
-- already guarantees no patient-level rows, coordinates, or PII can leak; the
-- database performs the aggregation.
--
-- We grant EXECUTE to the anon role so unauthenticated visitors can render the
-- public choropleth. Raw `public.cases` remains fully protected by RLS — anon
-- has no access to it, only to these grouped totals.

grant execute on function public.barangay_case_counts(text, int)
  to anon;
