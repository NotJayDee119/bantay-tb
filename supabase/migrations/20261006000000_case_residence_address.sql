-- Street-level residence for contact tracing.
--
-- The residence axis so far stopped at the barangay: `barangay_psgc` plus a
-- ~75 m jittered point for the heatmap. Contact tracing needs the actual
-- household, so a case can now carry the patient's street address and its
-- geocoded coordinates. The facility "spread" view traces each patient to
-- this point instead of the barangay centroid.
--
-- Privacy: this supersedes the "no exact addresses are stored" note in
-- 20261002_citywide_cases_read. `cases` is readable only by authenticated
-- staff (citywide staff, or area staff within their barangay), never by
-- anon. Public surfaces (hero map, barangay counts RPC) keep using
-- jittered coordinates and aggregates — never these columns.

alter table public.cases
  add column address text,
  add column residence_lat double precision,
  add column residence_lon double precision,
  add constraint cases_residence_coords_paired
    check ((residence_lat is null) = (residence_lon is null));

comment on column public.cases.address is
  'Patient''s street address (house no. / street / purok). PII — staff-only via RLS; must never surface on public pages.';
comment on column public.cases.residence_lat is
  'Geocoded latitude of the address. Unlike jitter_lat this is the real household location.';
comment on column public.cases.residence_lon is
  'Geocoded longitude of the address. Unlike jitter_lon this is the real household location.';
