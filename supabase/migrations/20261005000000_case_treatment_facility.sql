-- Separate "where the patient lives" from "where the patient is treated".
--
-- A case has always carried a single barangay, and encoders filled it with
-- whichever barangay was convenient — usually the facility's. For sentinel
-- surveillance that is the wrong axis: a patient from Sasa treated in Agdao
-- colors Agdao on the map, while the exposure risk (household, neighbours)
-- sits in Sasa. Splitting the two also surfaces access gaps — many patients
-- bypassing their own barangay's facility signals a service problem there.
--
-- `barangay_psgc` now explicitly means the patient's residence; the new
-- `facility_id` links the case to the DOTS facility providing treatment.

alter table public.cases
  add column facility_id uuid references public.dots_centers(id)
    on delete set null;

comment on column public.cases.barangay_psgc is
  'Barangay of the patient''s residence — where transmission risk sits and contact tracing happens. Not the facility''s barangay.';
comment on column public.cases.facility_id is
  'DOTS facility where the patient receives treatment. Null for legacy rows and presumptive cases not yet enrolled in treatment.';

-- The GIS map groups cases per facility to draw treatment flows.
create index if not exists cases_facility_id_idx
  on public.cases (facility_id);
