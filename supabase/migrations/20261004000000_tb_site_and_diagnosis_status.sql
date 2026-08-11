-- Split the overloaded `tb_classification` into the axes it was conflating.
--
-- The single enum forced encoders to choose one of three unrelated facts:
-- where the disease sits (pulmonary / extra-pulmonary), how firmly it was
-- diagnosed (presumptive / clinical / bacteriological), and whether it is
-- drug-resistant. Recording one erased the other two, so a drug-resistant
-- case could not also be recorded as extra-pulmonary.
--
-- `tb_classification` is kept and stays populated — Analytics, the chatbot,
-- hotspot summaries, the GIS map and bulk import all read it — but it is now
-- derived from, and kept in sync with, the two new columns.

create type public.tb_site as enum ('pulmonary', 'extra_pulmonary');

create type public.diagnosis_status as enum (
  'presumptive',              -- symptomatic, found by screening, not yet diagnosed
  'clinically_diagnosed',     -- diagnosed on clinical/radiological grounds
  'bacteriologically_confirmed' -- smear, culture or Xpert positive
);

alter table public.cases
  add column tb_site public.tb_site,
  add column diagnosis_status public.diagnosis_status;

comment on column public.cases.tb_site is
  'Anatomical site of TB disease. Null for non-TB cases or when not recorded.';
comment on column public.cases.diagnosis_status is
  'How firmly the case is diagnosed. ''presumptive'' is the active case finding yield — symptomatic but not yet a confirmed patient.';
comment on column public.cases.tb_classification is
  'Legacy single-axis classification, kept in sync with tb_site/diagnosis_status by cases_sync_tb_fields. Prefer the dedicated columns for new work.';

-- ── Backfill ────────────────────────────────────────────────────────────
-- Only what the old value actually asserted. A row recorded as 'pulmonary'
-- says nothing about whether it was bacteriologically confirmed, so it lands
-- on 'clinically_diagnosed' rather than claiming a lab result it never had.
-- Drug susceptibility, on the other hand, requires a positive culture or
-- Xpert, so those rows are safely bacteriologically confirmed.
update public.cases
set
  tb_site = case tb_classification
    when 'pulmonary' then 'pulmonary'::public.tb_site
    when 'extra_pulmonary' then 'extra_pulmonary'::public.tb_site
    else null
  end,
  diagnosis_status = case tb_classification
    when 'presumptive' then 'presumptive'::public.diagnosis_status
    when 'drug_sensitive' then 'bacteriologically_confirmed'::public.diagnosis_status
    when 'drug_resistant' then 'bacteriologically_confirmed'::public.diagnosis_status
    when 'pulmonary' then 'clinically_diagnosed'::public.diagnosis_status
    when 'extra_pulmonary' then 'clinically_diagnosed'::public.diagnosis_status
    else null
  end
where disease = 'tb';

-- ── Keep the three in sync ──────────────────────────────────────────────
-- Writers disagree about which columns they know: the encode form supplies
-- the detailed pair, bulk import and the seed script supply only the legacy
-- enum. Fill in whichever side was left blank so every reader sees a
-- consistent row, no matter which path wrote it.
create or replace function public.sync_tb_fields()
returns trigger
language plpgsql
as $$
begin
  -- The TB columns don't apply to pneumonia, COVID-19 or asthma. Leave
  -- whatever the writer sent untouched rather than destroying it.
  if new.disease is distinct from 'tb' then
    return new;
  end if;

  -- Legacy-only writer: unpack the single enum into the detailed columns.
  if new.tb_site is null
     and new.tb_classification in ('pulmonary', 'extra_pulmonary') then
    new.tb_site := new.tb_classification::text::public.tb_site;
  end if;

  if new.diagnosis_status is null then
    new.diagnosis_status := case new.tb_classification
      when 'presumptive' then 'presumptive'::public.diagnosis_status
      when 'drug_sensitive' then 'bacteriologically_confirmed'::public.diagnosis_status
      when 'drug_resistant' then 'bacteriologically_confirmed'::public.diagnosis_status
      when 'pulmonary' then 'clinically_diagnosed'::public.diagnosis_status
      when 'extra_pulmonary' then 'clinically_diagnosed'::public.diagnosis_status
      else null
    end;
  end if;

  -- Detailed writer: derive the legacy enum so existing readers keep working.
  -- Presumptive wins over site, because that is the distinction every
  -- downstream screen currently keys on.
  if new.tb_classification is null then
    new.tb_classification := case
      when new.diagnosis_status = 'presumptive' then 'presumptive'::public.tb_classification
      when new.tb_site = 'extra_pulmonary' then 'extra_pulmonary'::public.tb_classification
      when new.tb_site = 'pulmonary' then 'pulmonary'::public.tb_classification
      else null
    end;
  end if;

  return new;
end;
$$;

create trigger cases_sync_tb_fields
  before insert or update on public.cases
  for each row execute function public.sync_tb_fields();

-- The case register splits on diagnosis_status on every page load.
create index if not exists cases_diagnosis_status_idx
  on public.cases (diagnosis_status);
create index if not exists cases_tb_site_idx
  on public.cases (tb_site);
