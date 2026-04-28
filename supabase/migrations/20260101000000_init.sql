-- BANTAY-TB initial schema
-- All four user roles (Barangay Admin/Frontliner, BHW/Nurse/Doctor,
-- TB Coordinator, Patient) live in the `profiles` table; Supabase Auth
-- maintains the underlying auth.users row.

-- ─────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────
create type public.app_role as enum (
  'barangay_admin',
  'health_worker',
  'tb_coordinator',
  'patient'
);

create type public.disease as enum ('tb', 'pneumonia', 'covid19', 'asthma');

create type public.tb_classification as enum (
  'drug_sensitive',
  'drug_resistant',
  'pulmonary',
  'extra_pulmonary',
  'presumptive',
  'unknown'
);

create type public.sex as enum ('male', 'female', 'other', 'unknown');

create type public.treatment_outcome as enum (
  'ongoing',
  'cured',
  'completed',
  'failed',
  'died',
  'lost_to_followup',
  'not_evaluated'
);

create type public.adherence_status as enum (
  'scheduled',
  'taken',
  'missed',
  'late'
);

create type public.severity as enum ('low', 'medium', 'high');

create type public.locale as enum ('en', 'tl', 'ceb');

create type public.health_category as enum (
  'overview',
  'symptoms',
  'treatment',
  'prevention',
  'lifestyle'
);

create type public.sms_status as enum (
  'queued',
  'sent',
  'delivered',
  'failed',
  'mocked'
);

-- ─────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────
create table public.barangays (
  psgc bigint primary key,
  name text not null,
  centroid_lat double precision not null,
  centroid_lon double precision not null,
  area_km2 double precision,
  population int
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'patient',
  barangay_psgc bigint references public.barangays (psgc) on delete set null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  barangay_psgc bigint not null references public.barangays (psgc),
  disease public.disease not null,
  tb_classification public.tb_classification,
  age int,
  age_group text,
  sex public.sex not null default 'unknown',
  treatment_outcome public.treatment_outcome not null default 'ongoing',
  reported_at timestamptz not null default now(),
  jitter_lat double precision not null,
  jitter_lon double precision not null,
  notes text,
  reported_by uuid references public.profiles (id) on delete set null,
  source text not null default 'active_case_finding',
  created_at timestamptz not null default now()
);
create index cases_reported_at_idx on public.cases (reported_at desc);
create index cases_barangay_psgc_idx on public.cases (barangay_psgc);
create index cases_disease_idx on public.cases (disease);

create table public.hotspots (
  id uuid primary key default gen_random_uuid(),
  barangay_psgc bigint not null references public.barangays (psgc),
  disease public.disease not null default 'tb',
  case_count int not null,
  density double precision not null,
  severity public.severity not null,
  detected_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  centroid_lat double precision not null,
  centroid_lon double precision not null,
  radius_km double precision not null
);
create index hotspots_detected_at_idx on public.hotspots (detected_at desc);

create table public.hotspot_alerts (
  id uuid primary key default gen_random_uuid(),
  hotspot_id uuid not null references public.hotspots (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.dots_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  barangay_psgc bigint references public.barangays (psgc),
  lat double precision not null,
  lon double precision not null,
  phone text,
  hours text,
  services text[]
);

create table public.adherence_schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  medication text not null,
  dose text not null default '',
  times_per_day int not null default 1 check (times_per_day between 1 and 6),
  start_date date not null default current_date,
  end_date date not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.adherence_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.adherence_schedules (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_at timestamptz not null,
  taken_at timestamptz,
  status public.adherence_status not null default 'scheduled',
  notes text
);
create index adherence_logs_schedule_idx on public.adherence_logs (schedule_id);
create index adherence_logs_patient_idx on public.adherence_logs (patient_id);

create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  status public.sms_status not null default 'queued',
  provider text not null default 'mock',
  provider_response jsonb,
  patient_id uuid references public.profiles (id) on delete set null,
  schedule_id uuid references public.adherence_schedules (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid references public.profiles (id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  language public.locale,
  created_at timestamptz not null default now()
);
create index chatbot_messages_session_idx on public.chatbot_messages (session_id, created_at);

create table public.health_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  disease public.disease not null,
  locale public.locale not null,
  category public.health_category not null,
  title text not null,
  summary text,
  body_md text not null,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- Helper functions for RLS
-- ─────────────────────────────────────────────────────────────────
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('barangay_admin', 'health_worker', 'tb_coordinator')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────
-- Profile auto-creation trigger
-- ─────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bgy bigint;
begin
  bgy := nullif(new.raw_user_meta_data ->> 'barangay_psgc', '')::bigint;
  insert into public.profiles (id, email, full_name, role, barangay_psgc)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      (new.raw_user_meta_data ->> 'role')::public.app_role,
      'patient'::public.app_role
    ),
    bgy
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.barangays enable row level security;
alter table public.cases enable row level security;
alter table public.hotspots enable row level security;
alter table public.hotspot_alerts enable row level security;
alter table public.dots_centers enable row level security;
alter table public.adherence_schedules enable row level security;
alter table public.adherence_logs enable row level security;
alter table public.sms_outbox enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.health_content enable row level security;

-- Public reference data
create policy "barangays read" on public.barangays for select using (true);
create policy "dots_centers read" on public.dots_centers for select using (true);
create policy "health_content read" on public.health_content for select using (true);

-- Profiles: users see their own; staff see all profiles
create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id or public.is_staff());

create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles self insert"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Cases: staff can read/write; patients have no direct access
create policy "cases staff read"
  on public.cases for select
  using (public.is_staff());

create policy "cases staff insert"
  on public.cases for insert
  with check (public.is_staff());

create policy "cases staff update"
  on public.cases for update
  using (public.is_staff())
  with check (public.is_staff());

-- Hotspots: staff read/write
create policy "hotspots staff read"
  on public.hotspots for select
  using (public.is_staff());

create policy "hotspots staff insert"
  on public.hotspots for insert
  with check (public.is_staff());

create policy "hotspot_alerts user read"
  on public.hotspot_alerts for select
  using (recipient_id = auth.uid() or public.is_staff());

create policy "hotspot_alerts staff insert"
  on public.hotspot_alerts for insert
  with check (public.is_staff());

-- Adherence: patient sees own records; staff see all
create policy "adherence schedules read"
  on public.adherence_schedules for select
  using (patient_id = auth.uid() or public.is_staff());

create policy "adherence schedules write"
  on public.adherence_schedules for insert
  with check (public.is_staff());

create policy "adherence schedules update"
  on public.adherence_schedules for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "adherence logs read"
  on public.adherence_logs for select
  using (patient_id = auth.uid() or public.is_staff());

create policy "adherence logs insert"
  on public.adherence_logs for insert
  with check (patient_id = auth.uid() or public.is_staff());

create policy "adherence logs update"
  on public.adherence_logs for update
  using (patient_id = auth.uid() or public.is_staff())
  with check (patient_id = auth.uid() or public.is_staff());

-- SMS outbox: staff only
create policy "sms staff read"
  on public.sms_outbox for select
  using (public.is_staff());

create policy "sms staff write"
  on public.sms_outbox for insert
  with check (public.is_staff());

-- Chatbot: each user sees their own messages
create policy "chatbot self read"
  on public.chatbot_messages for select
  using (user_id = auth.uid() or user_id is null);

create policy "chatbot self write"
  on public.chatbot_messages for insert
  with check (user_id = auth.uid() or user_id is null);
