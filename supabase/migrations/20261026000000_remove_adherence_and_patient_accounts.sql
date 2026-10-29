-- Remove the adherence module and patient accounts.
--
-- The CHO has no budget for adherence monitoring (the SMS reminders were its
-- running cost), and without it a patient login offers nothing the public
-- site doesn't already give anonymously. What stays:
--
--   * Enrollment itself. A nurse still verifies a diagnosed case and starts
--     treatment; `enrolled_at` / `enrolled_by` record that on the case. It
--     just no longer mints a claim slip.
--   * The `patient` value of `app_role`. Every sign-up is written as
--     `patient` until `claim_staff_role` promotes it, so the value now means
--     "no staff role yet" and the app opens nothing for it.
--
-- DESTRUCTIVE: drops every adherence schedule, dose log, queued SMS and
-- claim code. Take a backup before applying if any of it should be kept.

-- ---------------------------------------------------------------------------
-- Patients no longer read their own case.
-- ---------------------------------------------------------------------------
drop policy if exists "cases own patient read" on public.cases;

-- ---------------------------------------------------------------------------
-- case_enrollable — same rule, minus the claimed-account check.
-- ---------------------------------------------------------------------------
create or replace function public.case_enrollable(p_case_id uuid)
returns table (ok boolean, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.cases;
begin
  select * into c from public.cases where id = p_case_id;

  if not found then
    return query select false, 'not_found'::text;
  elsif c.enrolled_at is not null then
    return query select false, 'already_enrolled'::text;
  elsif c.diagnosis_status is null
     or c.diagnosis_status = 'presumptive'::public.diagnosis_status then
    return query select false, 'not_diagnosed'::text;
  elsif c.treatment_outcome <> 'ongoing'::public.treatment_outcome then
    return query select false, 'treatment_closed'::text;
  elsif coalesce(btrim(c.given_name), '') = ''
     or coalesce(btrim(c.family_name), '') = '' then
    -- Imported and historical rows often have no name. There is nothing to
    -- verify against, so the nurse fills it in before enrolling.
    return query select false, 'name_missing'::text;
  else
    return query select true, 'ok'::text;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- enroll_patient — marks the case started on treatment, nothing more. The
-- return type loses its claim columns, so it is dropped and recreated.
-- ---------------------------------------------------------------------------
drop function if exists public.enroll_patient(uuid);

create function public.enroll_patient(p_case_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eligible record;
begin
  if uid is null then
    return query select false, 'not_authenticated'::text;
    return;
  end if;

  if not public.can_manage_case(p_case_id) then
    return query select false, 'out_of_scope'::text;
    return;
  end if;

  select * into eligible from public.case_enrollable(p_case_id);
  if not eligible.ok then
    return query select false, eligible.reason;
    return;
  end if;

  update public.cases
  set enrolled_by = uid,
      enrolled_at = now()
  where id = p_case_id;

  return query select true, 'ok'::text;
end;
$$;

grant execute on function public.enroll_patient(uuid) to authenticated;

comment on function public.enroll_patient(uuid) is
  'Marks a verified, diagnosed case as started on treatment.';

-- ---------------------------------------------------------------------------
-- Claim codes.
-- ---------------------------------------------------------------------------
drop function if exists public.redeem_patient_claim(text);
drop function if exists public.validate_patient_claim(text);
drop function if exists public.create_patient_claim(uuid);
drop table if exists public.patient_claims;

-- ---------------------------------------------------------------------------
-- The case → patient-account link. Its unique and partial indexes go with
-- the column; the register's "not yet enrolled" index is rebuilt on
-- enrolled_at, which is now the only enrollment marker.
-- ---------------------------------------------------------------------------
drop index if exists public.cases_enrollable_idx;
alter table public.cases drop column if exists patient_profile_id;

create index if not exists cases_enrollable_idx
  on public.cases (facility_id, barangay_psgc)
  where enrolled_at is null;

comment on column public.cases.contact_phone is
  'Patient contact number, verified at enrollment. Staff-only.';
comment on column public.cases.family_name is
  'Patient surname. PII — staff-only, never on public pages or exports.';

-- ---------------------------------------------------------------------------
-- Adherence and SMS. sms_outbox references adherence_schedules, so it goes
-- first.
-- ---------------------------------------------------------------------------
drop table if exists public.sms_outbox;
drop table if exists public.adherence_logs;
drop table if exists public.adherence_schedules;
drop type if exists public.adherence_status;
