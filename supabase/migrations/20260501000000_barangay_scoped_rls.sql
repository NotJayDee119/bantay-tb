-- Barangay-scoped RLS for community-level operators.
--
-- Per the BANTAY-TB conceptual framework, Barangay Admins / Frontliners and
-- BHWs / Nurses / Doctors are *community-level* operators: they should only
-- see cases, hotspots, alerts, adherence records, and SMS notifications for
-- patients in their assigned barangay. TB Coordinators retain citywide
-- surveillance access. Patients continue to see only their own rows.
--
-- Without this migration, any staff account could read every case in the
-- city (e.g. a Mintal Barangay Admin could view Sasa cases), which violates
-- the framework's community-scoping intent and the paper's data-privacy
-- expectations. This migration tightens RLS so the database itself enforces
-- the boundary.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_user_barangay()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select barangay_psgc from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_barangay() to authenticated;

create or replace function public.is_citywide_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'tb_coordinator' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_citywide_staff() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- cases: scope reads + writes by barangay for BA / HW; coordinator citywide.
-- ---------------------------------------------------------------------------

drop policy if exists "cases staff read" on public.cases;
drop policy if exists "cases staff insert" on public.cases;
drop policy if exists "cases staff update" on public.cases;

create policy "cases staff read"
  on public.cases for select
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );

create policy "cases staff insert"
  on public.cases for insert
  with check (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );

create policy "cases staff update"
  on public.cases for update
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  )
  with check (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );

-- ---------------------------------------------------------------------------
-- hotspots: same scoping.
-- ---------------------------------------------------------------------------

drop policy if exists "hotspots staff read" on public.hotspots;
drop policy if exists "hotspots staff insert" on public.hotspots;

create policy "hotspots staff read"
  on public.hotspots for select
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );

create policy "hotspots staff insert"
  on public.hotspots for insert
  with check (public.is_staff());
-- Inserts come from the detect-hotspots Edge Function (service role) so the
-- check is permissive; community accounts shouldn't manually insert anyway.

-- ---------------------------------------------------------------------------
-- hotspot_alerts: each user sees only alerts addressed to them
-- (recipient_id), so the existing per-recipient policy is correct. No change
-- needed here — see the detect-hotspots edge function for the scoping fix on
-- the *write* side (BA / HW recipients now only get alerts for hotspots in
-- their own barangay).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- adherence_schedules: patient sees own; staff scoped via patient's barangay.
-- ---------------------------------------------------------------------------

drop policy if exists "adherence schedules read" on public.adherence_schedules;
drop policy if exists "adherence schedules write" on public.adherence_schedules;
drop policy if exists "adherence schedules update" on public.adherence_schedules;

create policy "adherence schedules read"
  on public.adherence_schedules for select
  using (
    patient_id = auth.uid()
    or public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_schedules.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

create policy "adherence schedules write"
  on public.adherence_schedules for insert
  with check (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_schedules.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

create policy "adherence schedules update"
  on public.adherence_schedules for update
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_schedules.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  )
  with check (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_schedules.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- adherence_logs: same scoping as schedules.
-- ---------------------------------------------------------------------------

drop policy if exists "adherence logs read" on public.adherence_logs;
drop policy if exists "adherence logs insert" on public.adherence_logs;
drop policy if exists "adherence logs update" on public.adherence_logs;

create policy "adherence logs read"
  on public.adherence_logs for select
  using (
    patient_id = auth.uid()
    or public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_logs.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

create policy "adherence logs insert"
  on public.adherence_logs for insert
  with check (
    patient_id = auth.uid()
    or public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_logs.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

create policy "adherence logs update"
  on public.adherence_logs for update
  using (
    patient_id = auth.uid()
    or public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_logs.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  )
  with check (
    patient_id = auth.uid()
    or public.is_citywide_staff()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.profiles p
        where p.id = adherence_logs.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- sms_outbox: scope by patient's barangay so a Mintal BA can't see SMS sent
-- to a Sasa patient.
-- ---------------------------------------------------------------------------

drop policy if exists "sms staff read" on public.sms_outbox;
drop policy if exists "sms staff write" on public.sms_outbox;

create policy "sms staff read"
  on public.sms_outbox for select
  using (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and patient_id is not null
      and exists (
        select 1
        from public.profiles p
        where p.id = sms_outbox.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

create policy "sms staff write"
  on public.sms_outbox for insert
  with check (
    public.is_citywide_staff()
    or (
      public.is_staff()
      and patient_id is not null
      and exists (
        select 1
        from public.profiles p
        where p.id = sms_outbox.patient_id
          and p.barangay_psgc is not null
          and p.barangay_psgc = public.current_user_barangay()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: BA / HW shouldn't see profiles outside their barangay either.
-- TB Coordinator keeps citywide visibility. Self-read remains.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles self read" on public.profiles;

create policy "profiles self read"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_citywide_staff()
    or (
      public.is_staff()
      and barangay_psgc is not null
      and barangay_psgc = public.current_user_barangay()
    )
  );
