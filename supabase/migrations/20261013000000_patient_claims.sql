-- Patient account claims.
--
-- A patient never registers. When a nurse enrolls them in treatment the system
-- mints a single-use claim code, printed on a slip torn off the treatment card.
-- The patient enters it once, chooses a password, and the account binds to the
-- case the nurse already verified — so residence and facility come from the
-- clinical record rather than from a form the patient filled in.
--
-- Mirrors the invite_codes flow deliberately: same code alphabet, same
-- single-UPDATE burn, same validate-then-redeem split.

-- ---------------------------------------------------------------------------
-- can_manage_case — one definition of "this case is in my scope", shared by
-- the claim and enrollment functions.
--
-- Restates the predicate from the "cases staff read" policy rather than
-- relying on it: these callers are SECURITY DEFINER and therefore bypass RLS,
-- so the check has to be explicit. Keep the two in step.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = p_case_id
      and (
        public.is_citywide_staff()
        or (
          public.current_role() = 'barangay_admin'::public.app_role
          and c.barangay_psgc is not null
          and c.barangay_psgc = public.current_user_barangay()
        )
        or (
          public.current_role() = 'health_worker'::public.app_role
          and (
            (c.barangay_psgc is not null
             and c.barangay_psgc = public.current_user_barangay())
            or (c.facility_id is not null
             and c.facility_id = public.current_user_facility())
          )
        )
      )
  );
$$;

grant execute on function public.can_manage_case(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- patient_claims
-- ---------------------------------------------------------------------------
create table if not exists public.patient_claims (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  code text not null unique,
  -- Longer than an invite code's 24h: the slip travels home with the patient
  -- and may wait until someone can help them with a phone.
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists patient_claims_case_id_idx
  on public.patient_claims (case_id);

-- At most one live code per case. Reissuing revokes the previous one by
-- deleting it, so a lost slip cannot be used later.
create unique index if not exists patient_claims_one_open_per_case
  on public.patient_claims (case_id)
  where used_at is null;

alter table public.patient_claims enable row level security;

-- Staff read the codes for cases they may manage. Nobody writes directly —
-- every mutation goes through the definer functions below.
drop policy if exists "patient_claims staff read" on public.patient_claims;
create policy "patient_claims staff read"
  on public.patient_claims for select
  using (public.can_manage_case(case_id));

-- ---------------------------------------------------------------------------
-- create_patient_claim — mint (or reissue) a slip for a case.
-- ---------------------------------------------------------------------------
create or replace function public.create_patient_claim(p_case_id uuid)
returns public.patient_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  result public.patient_claims;
begin
  if not public.can_manage_case(p_case_id) then
    raise exception 'This case is not in your assigned area or facility.'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.cases
    where id = p_case_id and patient_profile_id is not null
  ) then
    raise exception 'This patient has already claimed an account.'
      using errcode = '23505';
  end if;

  -- Reissue supersedes: an unclaimed slip for this case stops working the
  -- moment a new one is printed.
  delete from public.patient_claims
  where case_id = p_case_id and used_at is null;

  -- Same unambiguous alphabet as invite codes (no 0/O/1/I/L) — these get read
  -- off paper, often by someone helping the patient.
  loop
    new_code := (
      select string_agg(
        substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
               1 + floor(random() * 31)::int, 1),
        ''
      )
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public.patient_claims where code = new_code);
  end loop;

  insert into public.patient_claims (case_id, code, created_by)
  values (p_case_id, new_code, auth.uid())
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- validate_patient_claim — the "Is this you?" pre-check, before an account
-- exists. Anonymous, so it returns the bare minimum: enough for the patient to
-- recognise themselves, not enough to be worth guessing codes for. No TB code,
-- no diagnosis, no address, no full surname.
-- ---------------------------------------------------------------------------
create or replace function public.validate_patient_claim(p_code text)
returns table (valid boolean, reason text, display_name text, facility_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.patient_claims;
  case_row public.cases;
begin
  select * into rec from public.patient_claims where code = upper(btrim(p_code));

  if not found then
    return query select false, 'not_found'::text, null::text, null::text;
    return;
  elsif rec.used_at is not null then
    return query select false, 'used'::text, null::text, null::text;
    return;
  elsif rec.expires_at <= now() then
    return query select false, 'expired'::text, null::text, null::text;
    return;
  end if;

  select * into case_row from public.cases where id = rec.case_id;

  return query
  select
    true,
    'ok'::text,
    -- "Maria D." — enough for the patient to recognise themselves, not enough
    -- to identify them to someone who found the slip.
    nullif(
      btrim(
        coalesce(case_row.given_name, '') || ' ' ||
        case
          when coalesce(case_row.family_name, '') = '' then ''
          else upper(substr(case_row.family_name, 1, 1)) || '.'
        end
      ),
      ''
    ),
    (select d.name from public.dots_centers d where d.id = case_row.facility_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_patient_claim — bind the freshly-created account to its case.
--
-- This is where the ruling actually lives: barangay and facility are copied
-- from the case a nurse verified, by a server function. The patient never
-- supplies either one.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_patient_claim(p_code text)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.patient_claims;
  case_row public.cases;
  current_role_value public.app_role;
begin
  if uid is null then
    return query select false, 'not_authenticated'::text;
    return;
  end if;

  select role into current_role_value from public.profiles where id = uid;
  if current_role_value is distinct from 'patient'::public.app_role then
    return query select false, 'not_a_patient_account'::text;
    return;
  end if;

  if exists (select 1 from public.cases where patient_profile_id = uid) then
    return query select false, 'already_linked'::text;
    return;
  end if;

  -- The UPDATE's own guard is the single-use guarantee. If anything below it
  -- fails, the whole function rolls back and the code is not spent.
  update public.patient_claims
  set used_at = now(), used_by = uid
  where code = upper(btrim(p_code))
    and used_at is null
    and expires_at > now()
  returning * into rec;

  if not found then
    return query select false, 'code_unavailable'::text;
    return;
  end if;

  select * into case_row from public.cases where id = rec.case_id;

  update public.cases
  set patient_profile_id = uid
  where id = rec.case_id;

  -- Everything identifying comes off the verified case, including the name:
  -- the claim screen never asks the patient who they are.
  update public.profiles
  set barangay_psgc = case_row.barangay_psgc,
      facility_id = case_row.facility_id,
      full_name = nullif(
        btrim(
          coalesce(case_row.given_name, '') || ' ' ||
          coalesce(case_row.family_name, '')
        ),
        ''
      ),
      -- Keep whatever the account already has if the case has no number.
      phone = coalesce(nullif(btrim(coalesce(case_row.contact_phone, '')), ''), phone)
  where id = uid;

  return query select true, 'ok'::text;
end;
$$;

grant execute on function public.create_patient_claim(uuid) to authenticated;
grant execute on function public.validate_patient_claim(text) to anon, authenticated;
grant execute on function public.redeem_patient_claim(text) to authenticated;

comment on table public.patient_claims is
  'Single-use codes that let an enrolled patient claim the account generated for their case. Patients never self-register.';
