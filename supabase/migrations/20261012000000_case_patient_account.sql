-- Link a case to the patient account generated from it.
--
-- Until now `cases` and `profiles` were two disconnected worlds: a case held
-- the TB code, residence and facility, while adherence_schedules.patient_id
-- pointed at a profile with no way back to the clinical record. That gap is
-- why adding a schedule meant re-selecting a patient from a global dropdown
-- and retyping everything the case already knew.
--
-- The link is deliberately nullable. Most cases never get an account —
-- presumptives especially, since they may turn out not to have TB at all.

-- ---------------------------------------------------------------------------
-- Patient name.
--
-- `cases` was pseudonymous: TB code, age, sex, barangay, and since
-- 20261006000000 a street address — but no name. Enrollment cannot work that
-- way. "The nurse verifies and assigns" means recognising the person standing
-- in front of her in the facility's list, and a TB code does not do that.
--
-- The table already holds household-level PII (address, residence_lat/lon)
-- and is already staff-only under RLS, so a name does not change what class of
-- data this is — it closes a gap that made the register unusable at the
-- counter. Split into given/family so the claim screen can show "Maria D."
-- without disclosing a full surname to whoever is holding the slip.
-- ---------------------------------------------------------------------------
alter table public.cases
  add column if not exists given_name text,
  add column if not exists family_name text,
  -- Contact number lives on the case, not only on the account: the nurse has
  -- to verify it at enrollment, before any profile exists, and refill
  -- reminders need it whether or not the patient ever claims a login.
  add column if not exists contact_phone text,
  add column if not exists patient_profile_id uuid
    references public.profiles (id) on delete set null,
  add column if not exists enrolled_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists enrolled_at timestamptz;

comment on column public.cases.given_name is
  'Patient first name. PII — staff-only, never on public pages or exports.';
comment on column public.cases.family_name is
  'Patient surname. PII — staff-only. Shown initial-only on the claim screen.';
comment on column public.cases.contact_phone is
  'Number reminders go to. Verified at enrollment and copied onto the account when the patient claims it.';

-- Enrollment needs a name to verify against; historical and imported rows
-- legitimately have none, so this is enforced at enrollment rather than here.
create index if not exists cases_family_name_idx
  on public.cases (lower(family_name))
  where family_name is not null;

comment on column public.cases.patient_profile_id is
  'The account claimed for this case, once enrolled. Null for every case without a login — which is most of them.';
comment on column public.cases.enrolled_by is
  'Health worker who verified and assigned treatment.';

-- One account belongs to exactly one case.
create unique index if not exists cases_patient_profile_id_key
  on public.cases (patient_profile_id)
  where patient_profile_id is not null;

-- A person cannot be on treatment twice at once. Enrollment is what sets
-- enrolled_at, so this keys on the account rather than on name matching.
create unique index if not exists cases_one_active_enrollment
  on public.cases (patient_profile_id)
  where patient_profile_id is not null
    and treatment_outcome = 'ongoing'::public.treatment_outcome;

create index if not exists cases_enrollable_idx
  on public.cases (facility_id, barangay_psgc)
  where patient_profile_id is null;

-- ---------------------------------------------------------------------------
-- profiles.email must be nullable.
--
-- A walk-in DOTS patient frequently has no email address — that is the normal
-- case here, not an edge case. Supabase creates a phone-only auth user with a
-- null email, and handle_new_user() copies that straight across, so a NOT NULL
-- column would reject the account outright. Phone becomes the practical
-- identifier; email is kept for staff and for patients who happen to have one.
-- ---------------------------------------------------------------------------
alter table public.profiles alter column email drop not null;

comment on column public.profiles.email is
  'Null for phone-only accounts. Staff always have one; patients often do not.';

-- ---------------------------------------------------------------------------
-- Patients read their own case. They already reach adherence rows through
-- patient_id; without this they cannot see the treatment those rows belong to.
-- Staff access is unchanged — the existing scope policies still apply.
-- ---------------------------------------------------------------------------
drop policy if exists "cases own patient read" on public.cases;
create policy "cases own patient read"
  on public.cases for select
  using (patient_profile_id = auth.uid());
