-- enroll_patient — the one action behind the Enroll button.
--
-- The nurse has verified the details already on the case and supplied the
-- three things enrollment introduces (regimen, weight, start date). This marks
-- the case enrolled and mints the claim slip in a single transaction: either
-- the patient is enrolled with a usable code, or nothing happened at all.
--
-- Schedule and dose-log generation join this function when the regimen work
-- lands. That is the reason enrollment is an RPC rather than a sequence of
-- calls from the browser — a half-generated course is not a state worth
-- being able to reach.

-- ---------------------------------------------------------------------------
-- case_enrollable — one rule for who may be enrolled, so the button, the
-- policy and the transaction cannot disagree about it.
--
-- Presumptive cases are excluded on purpose. A presumptive is the case-finding
-- yield: symptomatic, not yet diagnosed, and quite possibly not a TB patient
-- at all. Generating a six-month course for them would inflate every adherence
-- figure the system reports.
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
  elsif c.patient_profile_id is not null then
    return query select false, 'already_enrolled'::text;
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

grant execute on function public.case_enrollable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- enroll_patient
-- ---------------------------------------------------------------------------
create or replace function public.enroll_patient(p_case_id uuid)
returns table (ok boolean, reason text, claim_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eligible record;
  claim public.patient_claims;
begin
  if uid is null then
    return query select false, 'not_authenticated'::text, null::text, null::timestamptz;
    return;
  end if;

  if not public.can_manage_case(p_case_id) then
    return query select false, 'out_of_scope'::text, null::text, null::timestamptz;
    return;
  end if;

  select * into eligible from public.case_enrollable(p_case_id);
  if not eligible.ok then
    return query select false, eligible.reason, null::text, null::timestamptz;
    return;
  end if;

  update public.cases
  set enrolled_by = uid,
      enrolled_at = now()
  where id = p_case_id;

  -- Raises on scope or double-enrollment, which rolls the UPDATE above back
  -- with it. The two cannot end up out of step.
  claim := public.create_patient_claim(p_case_id);

  return query select true, 'ok'::text, claim.code, claim.expires_at;
end;
$$;

grant execute on function public.enroll_patient(uuid) to authenticated;

comment on function public.enroll_patient(uuid) is
  'Marks a verified case as enrolled in treatment and mints its single-use claim slip, atomically. The only sanctioned way a patient account comes into existence.';
