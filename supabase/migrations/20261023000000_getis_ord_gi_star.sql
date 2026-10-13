-- Hotspot detection moves from DBSCAN to Global Moran's I + Local Getis-Ord Gi*.
--
-- DBSCAN grouped case points within eps km and graded a cluster by its raw case
-- count (≥20 high, ≥50 urgent) — a "case density threshold" that ignored how
-- many people live in an area and had no statistical test behind it. Now:
--
--   1. Global Moran's I (row-standardised queen weights, 999 permutations)
--      answers "is TB spatially clustered across the city at all?".
--   2. Local Gi* (binary queen weights including self) gives every barangay a
--      z-score: ≥2.58 hotspot 99%, ≥1.96 hotspot 95%, ≤−1.96 / ≤−2.58 coldspot,
--      otherwise not significant.
--
-- Input is cases per 100,000 when every barangay has barangays.population;
-- until the census figures are loaded it is the case count, and each run
-- records which (hotspot_runs.metric) so a result is never misread as a rate.
--
-- `public.hotspots` stays as the CURRENT hotspot list — one row per barangay
-- classified as a 95%/99% hotspot in the latest run — so alerts, the
-- dashboards and RLS keep working unchanged. The full per-barangay output of
-- every run, coldspots and non-significant included, lives in hotspot_results.

-- ---------------------------------------------------------------------------
-- Spatial weights: queen contiguity, precomputed once from the polygons.
-- Seeded by 20261023000001_barangay_neighbors_seed.sql (generated).
-- ---------------------------------------------------------------------------
create table if not exists public.barangay_neighbors (
  barangay_psgc bigint not null references public.barangays (psgc) on delete cascade,
  neighbor_psgc bigint not null references public.barangays (psgc) on delete cascade,
  -- 'queen' = shares a border or corner; 'knn' = nearest-neighbour fallback
  -- for a barangay with no contiguous neighbour.
  kind text not null default 'queen' check (kind in ('queen', 'knn')),
  primary key (barangay_psgc, neighbor_psgc),
  check (barangay_psgc <> neighbor_psgc)
);

alter table public.barangay_neighbors enable row level security;

drop policy if exists "barangay_neighbors read" on public.barangay_neighbors;
create policy "barangay_neighbors read"
  on public.barangay_neighbors for select
  using (true);

-- ---------------------------------------------------------------------------
-- One row per detection run: the citywide Moran's I and run metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.hotspot_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  trigger text not null default 'manual',
  window_start timestamptz not null,
  window_end timestamptz not null,
  metric text not null check (metric in ('rate_per_100k', 'case_count')),
  n_units int not null,
  cases_considered int not null,
  moran_i double precision not null,
  moran_expected double precision not null,
  moran_z double precision not null,
  moran_p_norm double precision not null,
  moran_p_sim double precision not null,
  permutations int not null,
  hotspot_count int not null,
  coldspot_count int not null,
  duration_ms int
);

create index if not exists hotspot_runs_run_at_idx on public.hotspot_runs (run_at desc);

-- ---------------------------------------------------------------------------
-- Gi* per barangay per run.
-- ---------------------------------------------------------------------------
create table if not exists public.hotspot_results (
  run_id uuid not null references public.hotspot_runs (id) on delete cascade,
  barangay_psgc bigint not null references public.barangays (psgc) on delete cascade,
  case_count int not null,
  population int,
  -- The value Gi* ran on: a rate per 100k or a count, per hotspot_runs.metric.
  value double precision not null,
  gi_z double precision not null,
  gi_p double precision not null,
  gi_class text not null check (
    gi_class in ('hotspot_99', 'hotspot_95', 'not_significant', 'coldspot_95', 'coldspot_99')
  ),
  -- Benjamini-Hochberg at q = 0.05 across the run's 182 tests. Reported, not
  -- used for gi_class, which follows the plain z thresholds.
  fdr_significant boolean not null default false,
  primary key (run_id, barangay_psgc)
);

create index if not exists hotspot_results_class_idx
  on public.hotspot_results (run_id, gi_class);

alter table public.hotspot_runs enable row level security;
alter table public.hotspot_results enable row level security;

-- Staff read; only the detect-hotspots function (service_role) writes.
drop policy if exists "hotspot_runs staff read" on public.hotspot_runs;
create policy "hotspot_runs staff read"
  on public.hotspot_runs for select
  using (public.is_staff());

drop policy if exists "hotspot_results staff read" on public.hotspot_results;
create policy "hotspot_results staff read"
  on public.hotspot_results for select
  using (public.is_staff());

-- ---------------------------------------------------------------------------
-- hotspots: carry the Gi* evidence for each current hotspot.
-- ---------------------------------------------------------------------------
alter table public.hotspots
  add column if not exists run_id uuid references public.hotspot_runs (id) on delete set null,
  add column if not exists gi_z double precision,
  add column if not exists gi_p double precision,
  add column if not exists gi_class text;

comment on column public.hotspots.gi_class is
  'Gi* class of this barangay in the run that produced the row: hotspot_99 (z ≥ 2.58, severity urgent) or hotspot_95 (z ≥ 1.96, severity high).';
comment on column public.hotspots.density is
  'Cases per km² of the barangay in the detection window (context only; Gi* decides the hotspot).';

-- Detection now runs only in the Edge Function as service_role. The browser
-- used to recompute DBSCAN itself and write hotspots through these policies;
-- with that path gone, staff no longer need to insert or delete hotspot rows.
drop policy if exists "hotspots staff insert" on public.hotspots;
drop policy if exists "hotspots staff delete" on public.hotspots;

-- Old DBSCAN rows have no Gi* evidence and would read as hotspots under the
-- new definition. Clear them; the next run repopulates the table.
delete from public.hotspots where gi_class is null;

-- ---------------------------------------------------------------------------
-- Settings: the DBSCAN thresholds are gone.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value)
values ('hotspot_gi', '{"window_days": 365, "permutations": 999}'::jsonb)
on conflict (key) do nothing;

delete from public.app_settings where key = 'dbscan';
