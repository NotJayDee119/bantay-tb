-- Correct what `cases.facility_id` means: registration, not treatment.
--
-- 20261005000000_case_treatment_facility introduced the column as "the DOTS
-- facility where the patient receives treatment", and the UI followed —
-- facility markers read "N patients treated here". That framed a surveillance
-- system as a service one.
--
-- The GIS map is sentinel surveillance. Its unit is the *case*, and the
-- facility is where that case was registered/notified in the TB register —
-- a reporting fact. A patient from Calinan who registers at Mintal DOTS is
-- one case, whose residence is Calinan and whose registering facility is
-- Mintal. Whether, where, or how they are subsequently treated is a
-- different question this column does not answer.
--
-- The distinction matters for reading the map: a facility's count is
-- notifications it made, while transmission risk sits at the residences those
-- notifications point back to. Calling the count "patients treated" invited
-- exactly the misreading the residence/facility split existed to prevent.
--
-- Data and policies are unchanged — this migration only restates meaning.
-- `facility_id` is kept as the column name: it is accurate and neutral, and
-- renaming it would churn every reader for no gain.

comment on column public.cases.facility_id is
  'DOTS facility this case is registered/notified at (TB register), NOT necessarily where treatment is delivered. Often outside the patient''s own barangay — someone living in Calinan may register at Mintal. Null for legacy rows and for presumptive cases, which have not entered the register.';

comment on column public.cases.barangay_psgc is
  'Barangay of the patient''s residence — the surveillance axis. Hotspot detection, contact tracing and true incidence key on this, never on the registering facility''s location.';

comment on function public.facility_in_user_barangay(uuid) is
  'True when the given DOTS facility is in the calling staff member''s assigned barangay. Used by the cases RLS policies so staff can see the cases their own facility registered, whose patients often live elsewhere.';
