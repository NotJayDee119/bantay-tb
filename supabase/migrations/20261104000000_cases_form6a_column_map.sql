-- Label public.cases against Form 6a, the DS-TB Register
-- (docs/DS-TB_Register_Form6a.xlsx).
--
-- 20261020000000_tb_register_fields already gave every box (1)-(23) a column,
-- so nothing is added or renamed here and no row is touched. What the table
-- lacked was the map back to the paper: which box a column is, whether it is
-- the TOP or BOTTOM half of a split box (each patient takes two rows on the
-- form), and which register code each stored value stands for. Comments only.

comment on table public.cases is
  'One case per row. TB rows follow Form 6a DS-TB Register boxes (1)-(23); see column comments for the box each column holds.';

comment on column public.cases.tb_case_number is
  'Form 6a (1) TB Case Number, e.g. 2026-XI-0001. Unique per facility_id.';
comment on column public.cases.screening_date is
  'Form 6a (2) Date of Screening.';
comment on column public.cases.notification_date is
  'Form 6a (3) Date of Notification.';
comment on column public.cases.treatment_start_date is
  'Form 6a (4) Date Start of Treatment.';

comment on column public.cases.family_name is
  'Form 6a (5) Patient''s Full Name, TOP row: SURNAME.';
comment on column public.cases.given_name is
  'Form 6a (5) Patient''s Full Name, BOTTOM row: Given Name.';
comment on column public.cases.name_extension is
  'Form 6a (5) Patient''s Full Name, BOTTOM row: Name Ext. (Jr., III).';
comment on column public.cases.middle_name is
  'Form 6a (5) Patient''s Full Name, BOTTOM row: Middle Name.';
comment on column public.cases.date_of_birth is
  'Form 6a (6) Date of Birth.';
comment on column public.cases.age is
  'Form 6a (7) Age, TOP row. Completed years at (2), or at (3) when (2) is blank.';
comment on column public.cases.sex is
  'Form 6a (8) Sex, BOTTOM row. M = male, F = female.';

comment on column public.cases.address is
  'Form 6a (9) Permanent Address, TOP row: House No. and Street. The barangay part is barangay_psgc; city/province/region are implied (Davao City).';
comment on column public.cases.barangay_psgc is
  'Form 6a (9) Permanent Address, TOP row: Barangay (residence, PSGC code).';
comment on column public.cases.contact_phone is
  'Form 6a (9) Permanent Address, BOTTOM row: Contact No.';

comment on column public.cases.patient_source is
  'Form 6a (10) Source of Patient, TOP row: public_facility | private_facility | community | other.';
comment on column public.cases.screening_mode is
  'Form 6a (11) Mode of Screening, BOTTOM row: P = pcf, A = acf, I = icf, E = ecf.';

comment on column public.cases.tb_site is
  'Form 6a (12) Anatomical Site: P = pulmonary, EP = extra_pulmonary.';
comment on column public.cases.ep_site is
  'Form 6a (12) Anatomical Site, the "specify" part when EP.';
comment on column public.cases.registration_group is
  'Form 6a (13) Registration Group: new | relapse | taf | talf | ptou | other.';
comment on column public.cases.diagnosis_status is
  'Form 6a (14) Bacteriological Status: BC = bacteriologically_confirmed, CD = clinically_diagnosed. presumptive = not yet diagnosed (no Form 6a row).';
comment on column public.cases.treatment_regimen is
  'Form 6a (15) Treatment Regimen at Start: 1 | 2.';

comment on column public.cases.contacts is
  'Form 6a (16) Number of Contacts. {"adults": TOP row, "children": BOTTOM row (0-14)}, each {"identified","tested","diagnosed","started"} as counts.';

comment on column public.cases.hiv_status is
  'Form 6a (17) HIV Status, TOP row: positive (Reactive) | negative (Non-reactive) | unknown.';
comment on column public.cases.hiv_test_date is
  'Form 6a (17) HIV Status, BOTTOM row: Test Date.';
comment on column public.cases.dm_status is
  'Form 6a (18) DM Status, TOP row: positive | negative | unknown.';
comment on column public.cases.dm_screening_date is
  'Form 6a (18) DM Status, BOTTOM row: Screening Date.';

comment on column public.cases.treatment_location is
  'Form 6a (19) Location of Tx, TOP row: FB = facility_based, CBHB = community_based.';
comment on column public.cases.dat_type is
  'Form 6a (19) Location of Tx, TOP row: the DAT "specify" part.';
comment on column public.cases.supporter_type is
  'Form 6a (20) Type of Tx Supporter, BOTTOM row: HCW = health_worker, V = community_volunteer, F = family, O = other.';

comment on column public.cases.lab_results is
  'Form 6a (21) Xpert MTB/RIF and Smear Microscopy. Keys: xpert (X), smear (S), m2, m3, m5, m6, m7 (>7), other (Other Labs); each {"result": TOP row, "date": BOTTOM row, date collected}.';

comment on column public.cases.treatment_outcome is
  'Form 6a (22) Treatment Outcome, TOP row.';
comment on column public.cases.outcome_date is
  'Form 6a (22) Treatment Outcome, BOTTOM row: Date.';
comment on column public.cases.outcome_reason is
  'Form 6a (22) Treatment Outcome, BOTTOM row: Reason.';
comment on column public.cases.notes is
  'Form 6a (23) Remarks: PhilHealth Number, study participated, other notes.';
