-- Bring the case record up to the NTP TB Register.
--
-- Facilities keep the paper register (columns (1)-(23)) and the encode form
-- now follows it column for column, so a nurse can copy a row across without
-- hunting for where each box went. Most of the register already had a home:
--
--   (5)  name            -> given_name / family_name   (+ middle, extension)
--   (7)  age, (8) sex    -> age / sex
--   (9)  address/contact -> barangay_psgc / address / contact_phone
--   (12) anatomical site -> tb_site                    (+ EP site specified)
--   (14) bact. status    -> diagnosis_status (BC / CD)
--   (22) outcome         -> treatment_outcome          (+ date & reason)
--   (23) remarks         -> notes
--
-- Everything else is added here. All nullable: imported and historical rows
-- never had these boxes filled, and a presumptive screening has most of them
-- still blank by definition.

alter table public.cases
  add column if not exists tb_case_number       text,
  add column if not exists screening_date       date,
  add column if not exists notification_date    date,
  add column if not exists treatment_start_date date,
  add column if not exists middle_name          text,
  add column if not exists name_extension       text,
  add column if not exists date_of_birth        date,
  add column if not exists patient_source       text,
  add column if not exists screening_mode       text,
  add column if not exists ep_site              text,
  add column if not exists registration_group   text,
  add column if not exists treatment_regimen    text,
  -- (16) Adults and children 0-14, each: identified / tested / diagnosed /
  -- started on treatment. A shape, not eight columns — nothing queries one
  -- cell of it on its own.
  add column if not exists contacts             jsonb,
  add column if not exists hiv_status           text,
  add column if not exists hiv_test_date        date,
  add column if not exists dm_status            text,
  add column if not exists dm_screening_date    date,
  add column if not exists treatment_location   text,
  add column if not exists dat_type             text,
  add column if not exists supporter_type       text,
  -- (21) Xpert (X), baseline smear (S) and follow-up smears at months
  -- 2/3/5/6/>=7, plus other labs: { key: { result, date } }.
  add column if not exists lab_results          jsonb,
  add column if not exists outcome_date         date,
  add column if not exists outcome_reason       text;

-- Legend values from the register. Checked so a typo in a client can't invent
-- a registration group the quarterly report has no row for.
alter table public.cases
  drop constraint if exists cases_patient_source_chk,
  add constraint cases_patient_source_chk check (
    patient_source is null or patient_source in
      ('public_facility', 'private_facility', 'community', 'other')),
  drop constraint if exists cases_screening_mode_chk,
  add constraint cases_screening_mode_chk check (
    screening_mode is null or screening_mode in ('pcf', 'acf', 'icf', 'ecf')),
  drop constraint if exists cases_registration_group_chk,
  add constraint cases_registration_group_chk check (
    registration_group is null or registration_group in
      ('new', 'relapse', 'taf', 'talf', 'ptou', 'other')),
  drop constraint if exists cases_treatment_regimen_chk,
  add constraint cases_treatment_regimen_chk check (
    treatment_regimen is null or treatment_regimen in ('1', '2')),
  drop constraint if exists cases_hiv_status_chk,
  add constraint cases_hiv_status_chk check (
    hiv_status is null or hiv_status in ('positive', 'negative', 'unknown')),
  drop constraint if exists cases_dm_status_chk,
  add constraint cases_dm_status_chk check (
    dm_status is null or dm_status in ('positive', 'negative', 'unknown')),
  drop constraint if exists cases_treatment_location_chk,
  add constraint cases_treatment_location_chk check (
    treatment_location is null or treatment_location in
      ('facility_based', 'community_based')),
  drop constraint if exists cases_supporter_type_chk,
  add constraint cases_supporter_type_chk check (
    supporter_type is null or supporter_type in
      ('health_worker', 'community_volunteer', 'family', 'other'));

-- (1) is each facility's own running number, so it is unique per facility,
-- not citywide — two clinics will both have a "2026-001".
create unique index if not exists cases_tb_case_number_key
  on public.cases (facility_id, tb_case_number)
  where tb_case_number is not null;
