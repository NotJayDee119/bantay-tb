import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, ShieldAlert } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Textarea,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { geocodeInDavao, type GeocodeHit } from "../../lib/geocode";
import {
  barangayLockFor,
  checkCaseFiling,
  explainCaseError,
  type BarangayLock,
} from "../../lib/caseFiling";
import { useAuth } from "../../hooks/useAuth";
import type {
  DiagnosisStatus,
  TBClassification,
  TBSite,
} from "../../lib/database.types";
import barangays from "../../data/barangays.json";

async function triggerHotspotDetection() {
  try {
    await supabase.functions.invoke("detect-hotspots", {
      body: { trigger: "case_insert" },
    });
  } catch {
    // Non-fatal — hotspots will still be visible via manual re-run.
  }
}

const DISEASES = [
  { value: "tb", label: "Tuberculosis" },
  { value: "pneumonia", label: "Pneumonia" },
  { value: "covid19", label: "COVID-19" },
  { value: "asthma", label: "Asthma" },
];

// The form follows the NTP TB Register column for column — (1) to (23) — so a
// nurse copying a row off the paper book finds each box where they expect it.
// The legends below are the register's own.

// (12) Anatomical site.
const TB_SITE = [
  { value: "", label: "— not specified —" },
  { value: "pulmonary", label: "P — Pulmonary" },
  { value: "extra_pulmonary", label: "EP — Extra-pulmonary" },
];

// (14) Bacteriological status. The register only knows BC and CD; presumptive
// stays because this form also records screening yield, before diagnosis.
const DIAGNOSIS_STATUS = [
  {
    value: "presumptive",
    label: "Presumptive (not yet diagnosed)",
    hint: "Has TB symptoms; found by screening. Not yet a confirmed patient.",
  },
  {
    value: "bacteriologically_confirmed",
    label: "BC — Bacteriologically confirmed",
    hint: "Smear, culture or Xpert positive.",
  },
  {
    value: "clinically_diagnosed",
    label: "CD — Clinically diagnosed",
    hint: "Diagnosed on clinical or radiological grounds, without a positive lab result.",
  },
];

const DRUG_SUSCEPTIBILITY = [
  { value: "", label: "— not tested —" },
  { value: "drug_sensitive", label: "Drug-sensitive" },
  { value: "drug_resistant", label: "Drug-resistant (MDR)" },
];

// (10) Source of patient.
const PATIENT_SOURCE = [
  { value: "", label: "— select —" },
  { value: "public_facility", label: "Public health facility" },
  { value: "private_facility", label: "Private health facility" },
  { value: "community", label: "Community" },
  { value: "other", label: "Other" },
];

// (11) Mode of screening. Also decides `source`, which the register views use
// to tell door-to-door screening apart from walk-ins.
const SCREENING_MODE = [
  { value: "pcf", label: "PCF — Passive case finding" },
  { value: "acf", label: "ACF — Active case finding" },
  { value: "icf", label: "ICF — Intensified case finding" },
  { value: "ecf", label: "ECF — Enhanced case finding" },
];

const SOURCE_FOR_MODE: Record<string, string> = {
  pcf: "passive_case_finding",
  acf: "active_case_finding",
  icf: "intensified_case_finding",
  ecf: "enhanced_case_finding",
};

// (13) Registration group.
const REGISTRATION_GROUP = [
  { value: "", label: "— select —" },
  { value: "new", label: "New" },
  { value: "relapse", label: "Relapse" },
  { value: "taf", label: "TAF — Treatment after failure" },
  { value: "talf", label: "TALF — Treatment after lost to follow-up" },
  { value: "ptou", label: "PTOU — Previous treatment outcome unknown" },
  { value: "other", label: "Other" },
];

// (15) Treatment regimen at start.
const REGIMEN = [
  { value: "", label: "— not started —" },
  { value: "1", label: "Regimen 1 — 2HRZE / 4HR" },
  { value: "2", label: "Regimen 2 — 2HRZE / 10HR" },
];

// (17) HIV and (18) DM status.
const COMORBID_STATUS = [
  { value: "", label: "— not done —" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "unknown", label: "Unknown" },
];

// (19) Location of treatment.
const TX_LOCATION = [
  { value: "", label: "— select —" },
  { value: "facility_based", label: "FB — Facility-based" },
  { value: "community_based", label: "CB — Community-based" },
];

// (20) Type of treatment supporter.
const SUPPORTER = [
  { value: "", label: "— select —" },
  { value: "health_worker", label: "Health care worker" },
  { value: "community_volunteer", label: "Community volunteer / BHW" },
  { value: "family", label: "Family member" },
  { value: "other", label: "Other" },
];

// (16) Number of contacts — adults on top, children 0–14 below.
const CONTACT_STEPS = [
  { key: "identified", label: "Identified" },
  { key: "tested", label: "Tested" },
  { key: "diagnosed", label: "Diagnosed" },
  { key: "started", label: "Started on Tx" },
] as const;
const CONTACT_GROUPS = [
  { key: "adults", label: "Adults" },
  { key: "children", label: "Children 0–14" },
] as const;
type ContactGroup = (typeof CONTACT_GROUPS)[number]["key"];
type ContactStep = (typeof CONTACT_STEPS)[number]["key"];

// (21) Xpert MTB/RIF (X) and TB smear microscopy (S), then follow-up smears by
// treatment month.
const LAB_COLUMNS = [
  { key: "xpert", label: "X", title: "Xpert MTB/RIF", placeholder: "T / RR / N" },
  { key: "smear", label: "S", title: "Baseline smear", placeholder: "0 / 1+" },
  { key: "m2", label: "2", title: "Month 2 smear", placeholder: "0 / 1+" },
  { key: "m3", label: "3", title: "Month 3 smear", placeholder: "0 / 1+" },
  { key: "m5", label: "5", title: "Month 5 smear", placeholder: "0 / 1+" },
  { key: "m6", label: "6", title: "Month 6 smear", placeholder: "0 / 1+" },
  { key: "m7", label: "≥7", title: "Month 7+ smear", placeholder: "0 / 1+" },
  { key: "other", label: "Other labs", title: "Other labs", placeholder: "CXR, culture…" },
] as const;
type LabKey = (typeof LAB_COLUMNS)[number]["key"];

const OUTCOMES = [
  { value: "ongoing", label: "Ongoing treatment" },
  { value: "cured", label: "Cured" },
  { value: "completed", label: "Treatment completed" },
  { value: "failed", label: "Treatment failed" },
  { value: "died", label: "Died" },
  { value: "lost_to_followup", label: "Lost to follow-up" },
  { value: "not_evaluated", label: "Not evaluated" },
];

interface FacilityOption {
  id: string;
  name: string;
  barangay_psgc: number | null;
}

/**
 * What a blocked encoder is told. Each one names the thing that is wrong and
 * the person who can fix it — an encoder cannot assign their own facility (the
 * "profiles self update" policy freezes it), so "ask a system administrator"
 * is the genuine next step rather than a brush-off.
 *
 * `{area}` is substituted with the account's assigned barangay.
 */
const FILING_BLOCKED: Record<
  string,
  { title: string; body: string; toast: string }
> = {
  no_facility: {
    title: "No DOTS facility assigned to your account",
    body:
      "You can record patients who live in {area}. To record someone from another barangay, your account needs to be linked to the DOTS facility you work at — that link is what says the patient registered with you.",
    toast:
      "Your account has no DOTS facility, so you can only record patients living in {area}.",
  },
  outside_area: {
    title: "This patient lives outside your barangay",
    body:
      "Your account covers {area}. A case can only be recorded for the barangay you cover — the patient's own barangay staff will record them.",
    toast: "You can only record patients living in {area}.",
  },
  unassigned: {
    title: "No area assigned to your account",
    body:
      "Your account has no barangay and no DOTS facility, so it cannot record cases yet. Ask a system administrator to assign one before you start encoding.",
    toast: "Your account has no assigned area yet, so cases cannot be saved.",
  },
};

function fillArea(text: string, area: string | null): string {
  return text.replace(/\{area\}/g, area ?? "your assigned barangay");
}

/**
 * What a locked barangay field says, in the same voice as the locked facility
 * field beneath it: name what is fixed, then say what that buys or costs.
 *
 * The two locks are not the same fact. A barangay dashboard is residence-only
 * by design and nothing will change that; a health centre is residence-only
 * only until its clinic is linked, so its hint has to name the way out.
 */
const BARANGAY_FIXED_HINT: Record<BarangayLock, string> = {
  area_role:
    "Your assigned barangay. You record the people who live in {area} — residents of other barangays are recorded by their own staff.",
  awaiting_facility:
    "Your assigned barangay. Until a system administrator links your DOTS facility to your account, you can only record patients who live in {area} — not walk-ins from elsewhere.",
};

/** Completed years between a YYYY-MM-DD birth date and today. */
function ageFrom(dob: string): string {
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--;
  return age >= 0 && age <= 120 ? String(age) : "";
}

const emptyContacts = (): Record<ContactGroup, Record<ContactStep, string>> => ({
  adults: { identified: "", tested: "", diagnosed: "", started: "" },
  children: { identified: "", tested: "", diagnosed: "", started: "" },
});

const emptyLabs = (): Record<LabKey, { result: string; date: string }> =>
  Object.fromEntries(
    LAB_COLUMNS.map((c) => [c.key, { result: "", date: "" }])
  ) as Record<LabKey, { result: string; date: string }>;

/** The register's column number, printed the way the paper book prints it. */
function Col({ n }: { n: number }) {
  return (
    <span className="mr-1 font-mono text-[11px] font-semibold text-brand-700">
      ({n})
    </span>
  );
}

/** One block of the register — a run of adjacent columns on the paper form. */
function Section({
  title,
  columns,
  children,
}: {
  title: string;
  columns: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="sm:col-span-2 rounded-xl border border-slate-200">
      <legend className="ml-3 px-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <span className="ml-2 font-mono text-[10px] text-slate-400">
          {columns}
        </span>
      </legend>
      <div className="grid gap-4 p-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </fieldset>
  );
}

export function CaseFormPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  // Geocoded household position for the street address. Cleared whenever the
  // address or barangay changes so a stale pin can't outlive its address.
  const [located, setLocated] = useState<GeocodeHit | null>(null);
  const [locating, setLocating] = useState(false);
  // A health centre account files against its own clinic and nothing else —
  // that is what lets it register a walk-in living in another barangay (the
  // "cases staff insert" policy keys on exactly this).
  const isHealthWorker = profile?.role === "health_worker";
  const ownFacility = profile?.facility_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tb_case_number: "",
    screening_date: today,
    notification_date: "",
    treatment_start_date: "",
    family_name: "",
    given_name: "",
    name_extension: "",
    middle_name: "",
    date_of_birth: "",
    contact_phone: "",
    barangay_psgc: profile?.barangay_psgc ? String(profile.barangay_psgc) : "",
    address: "",
    facility_id: isHealthWorker ? ownFacility : "",
    disease: "tb",
    patient_source: "",
    // A walk-in at the clinic is passive case finding; anyone else encoding
    // is usually logging a screening sweep.
    screening_mode: isHealthWorker ? "pcf" : "acf",
    tb_site: "",
    ep_site: "",
    registration_group: "",
    diagnosis_status: "presumptive",
    treatment_regimen: "",
    drug_susceptibility: "",
    hiv_status: "",
    hiv_test_date: "",
    dm_status: "",
    dm_screening_date: "",
    treatment_location: "",
    dat_type: "",
    supporter_type: "",
    age: "",
    sex: "male",
    treatment_outcome: "not_evaluated",
    outcome_date: "",
    outcome_reason: "",
    notes: "",
  });
  const [contacts, setContacts] = useState(emptyContacts);
  const [labs, setLabs] = useState(emptyLabs);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("dots_centers")
      .select("id, name, barangay_psgc")
      .order("name")
      .then(({ data }) => {
        if (!cancelled && data) setFacilities(data as FacilityOption[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A presumptive case hasn't been diagnosed yet, so it can have neither a
  // drug-susceptibility result (that needs a positive culture or Xpert), a
  // treatment outcome, nor a registering DOTS facility (it hasn't entered the
  // TB register). Lock all three rather than letting the form record a
  // contradiction — and the treatment columns (4), (15), (19), (20) with them.
  const isPresumptive = form.diagnosis_status === "presumptive";
  const isTb = form.disease === "tb";
  const lockClinicalDetail = isTb && isPresumptive;
  // A health centre has exactly one answer here — its own clinic — and picking
  // another would be rejected by RLS anyway, so the field is shown as settled
  // rather than offered as a choice.
  const facilityFixed = isHealthWorker && !!ownFacility;

  // The facility the insert will carry. Computed once here rather than inline
  // at submit, so the pre-flight check below and the row that actually goes to
  // Postgres can never disagree about what is being filed.
  const stampedFacility =
    isTb && form.facility_id
      ? form.facility_id
      : isHealthWorker
        ? ownFacility || null
        : null;

  // Whether RLS will accept this case, worked out before anything is typed
  // rather than after the whole form is filled in. See lib/caseFiling.ts.
  const filing = useMemo(
    () =>
      checkCaseFiling(
        profile ?? null,
        form.barangay_psgc ? Number(form.barangay_psgc) : null,
        stampedFacility
      ),
    [profile, form.barangay_psgc, stampedFacility]
  );
  const ownBarangayName = profile?.barangay_psgc
    ? (barangays.find((b) => b.psgc === profile.barangay_psgc)?.name ?? null)
    : null;
  // The block is only the barangay field's fault once a barangay is actually
  // chosen. An unassigned account is broken before any selection is made, and
  // pointing at the dropdown there would blame the wrong thing.
  const barangayRejected = !filing.allowed && Boolean(form.barangay_psgc);

  // Show the barangay as settled rather than offering it as a choice, exactly
  // as the facility field already does for a health centre. Offering all 182
  // to an account RLS will only accept one of is what produced the Ma-a
  // failure. See barangayLockFor() for which accounts are in that position.
  const barangayLock = barangayLockFor(profile ?? null);
  const barangayFixed = barangayLock !== null;

  // The state initialiser above runs before `profile` has loaded, so a locked
  // field would otherwise render its area while submitting an empty psgc.
  useEffect(() => {
    if (!barangayFixed || !profile?.barangay_psgc) return;
    const pinned = String(profile.barangay_psgc);
    setForm((f) =>
      f.barangay_psgc === pinned ? f : { ...f, barangay_psgc: pinned }
    );
  }, [barangayFixed, profile?.barangay_psgc]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setDiagnosisStatus(value: string) {
    setForm((f) => ({
      ...f,
      diagnosis_status: value,
      ...(value === "presumptive"
        ? {
            drug_susceptibility: "",
            treatment_outcome: "not_evaluated",
            treatment_start_date: "",
            treatment_regimen: "",
            treatment_location: "",
            dat_type: "",
            supporter_type: "",
            outcome_date: "",
            outcome_reason: "",
            // A health centre keeps its own facility even on a presumptive
            // row. It is the clinic that screened this person, and without it
            // the record is invisible to them whenever the patient lives in
            // another barangay — which is most walk-ins.
            ...(isHealthWorker ? {} : { facility_id: "" }),
          }
        : f.treatment_outcome === "not_evaluated"
          ? { treatment_outcome: "ongoing" }
          : {}),
    }));
  }

  function geocodeQuery(bgyName: string) {
    return `${form.address.trim()}, ${bgyName}, Davao City, Philippines`;
  }

  async function locateAddress() {
    const bgy = barangays.find((b) => b.psgc === Number(form.barangay_psgc));
    if (!form.address.trim() || !bgy) {
      toast.error("Enter a street address and select the barangay first.");
      return;
    }
    setLocating(true);
    const hit = await geocodeInDavao(geocodeQuery(bgy.name));
    setLocating(false);
    setLocated(hit);
    if (!hit) {
      toast.error(
        "Couldn't find that address on the map — the case will use the barangay-level position."
      );
    }
  }

  /** (16) as stored: blank cells dropped, null when nothing was counted. */
  function contactsPayload() {
    const out: Record<string, Record<string, number>> = {};
    for (const g of CONTACT_GROUPS) {
      for (const s of CONTACT_STEPS) {
        const v = contacts[g.key][s.key];
        if (v === "") continue;
        (out[g.key] ??= {})[s.key] = Number(v);
      }
    }
    return Object.keys(out).length ? out : null;
  }

  /** (21) as stored: only the columns that have a result or a date. */
  function labsPayload() {
    const out: Record<string, { result: string | null; date: string | null }> =
      {};
    for (const c of LAB_COLUMNS) {
      const { result, date } = labs[c.key];
      if (!result.trim() && !date) continue;
      out[c.key] = { result: result.trim() || null, date: date || null };
    }
    return Object.keys(out).length ? out : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.barangay_psgc) {
      toast.error("Please select a barangay.");
      return;
    }
    // Stop here rather than letting Postgres refuse the row. The RLS message
    // is unreadable, and by this point the encoder has already done the work.
    if (!filing.allowed) {
      toast.error(
        fillArea(
          FILING_BLOCKED[filing.blocker ?? "unassigned"].toast,
          ownBarangayName
        )
      );
      return;
    }
    setSubmitting(true);
    const bgy = barangays.find((b) => b.psgc === Number(form.barangay_psgc));
    if (!bgy) {
      toast.error("Barangay not found.");
      setSubmitting(false);
      return;
    }
    // Resolve the household position: an already-verified pin wins; otherwise
    // try one silent geocode so encoders who skip "Find on map" still get a
    // street-level point when the address resolves.
    let residence = located;
    if (!residence && form.address.trim()) {
      residence = await geocodeInDavao(geocodeQuery(bgy.name));
    }
    const angle = Math.random() * 2 * Math.PI;
    const r = 0.0008 + Math.random() * 0.002;
    const tbOnly = <T,>(v: T) => (isTb ? v : null);
    const txOnly = <T,>(v: T) => (isTb && !isPresumptive ? v : null);
    // Surveillance counts by `reported_at`. Notification is when the case
    // entered the register; a presumptive hasn't, so it dates from screening.
    const reportedOn = form.notification_date || form.screening_date || today;
    const { error } = await supabase.from("cases").insert({
      tb_case_number: tbOnly(form.tb_case_number.trim() || null),
      screening_date: form.screening_date || null,
      notification_date: form.notification_date || null,
      treatment_start_date: txOnly(form.treatment_start_date || null),
      given_name: form.given_name.trim() || null,
      family_name: form.family_name.trim() || null,
      middle_name: form.middle_name.trim() || null,
      name_extension: form.name_extension.trim() || null,
      date_of_birth: form.date_of_birth || null,
      contact_phone: form.contact_phone.trim() || null,
      barangay_psgc: bgy.psgc,
      address: form.address.trim() || null,
      residence_lat: residence?.lat ?? null,
      residence_lon: residence?.lon ?? null,
      // A health centre always stamps its own clinic, whatever the disease or
      // diagnosis stage — it is the record's owner, and the insert policy
      // requires it for any patient living outside its barangay.
      facility_id: stampedFacility,
      disease: form.disease as "tb" | "pneumonia" | "covid19" | "asthma",
      patient_source: tbOnly(form.patient_source || null),
      screening_mode: tbOnly(form.screening_mode || null),
      tb_site: isTb && form.tb_site ? (form.tb_site as TBSite) : null,
      ep_site:
        isTb && form.tb_site === "extra_pulmonary"
          ? form.ep_site.trim() || null
          : null,
      registration_group: tbOnly(form.registration_group || null),
      diagnosis_status: isTb
        ? (form.diagnosis_status as DiagnosisStatus)
        : null,
      treatment_regimen: txOnly(form.treatment_regimen || null),
      // Only set when susceptibility testing actually happened. Left null,
      // the cases_sync_tb_fields trigger derives the legacy column from the
      // site and diagnosis status instead.
      tb_classification:
        isTb && form.drug_susceptibility
          ? (form.drug_susceptibility as TBClassification)
          : null,
      contacts: tbOnly(contactsPayload()),
      hiv_status: tbOnly(form.hiv_status || null),
      hiv_test_date: tbOnly(form.hiv_status ? form.hiv_test_date || null : null),
      dm_status: tbOnly(form.dm_status || null),
      dm_screening_date: tbOnly(
        form.dm_status ? form.dm_screening_date || null : null
      ),
      treatment_location: txOnly(form.treatment_location || null),
      dat_type: txOnly(form.dat_type.trim() || null),
      supporter_type: txOnly(form.supporter_type || null),
      lab_results: tbOnly(labsPayload()),
      age: form.age ? Number(form.age) : null,
      sex: form.sex as "male" | "female" | "other",
      treatment_outcome:
        form.treatment_outcome as
          | "ongoing"
          | "cured"
          | "completed"
          | "failed"
          | "died"
          | "lost_to_followup"
          | "not_evaluated",
      // An outcome date only means something once treatment has closed.
      outcome_date:
        form.treatment_outcome !== "ongoing" &&
        form.treatment_outcome !== "not_evaluated"
          ? form.outcome_date || null
          : null,
      outcome_reason:
        form.treatment_outcome !== "ongoing" &&
        form.treatment_outcome !== "not_evaluated"
          ? form.outcome_reason.trim() || null
          : null,
      notes: form.notes || null,
      reported_at: new Date(reportedOn).toISOString(),
      jitter_lat: bgy.lat + Math.sin(angle) * r,
      jitter_lon: bgy.lon + Math.cos(angle) * r,
      reported_by: profile?.id ?? null,
      // (11) decides this. Active case finding means someone went looking — a
      // BHW sweep or a mobile screening. A walk-in is passive case finding, and
      // filing them as ACF inflates the screening yield the programme reports.
      source:
        (isTb && SOURCE_FOR_MODE[form.screening_mode]) ||
        (isHealthWorker ? "passive_case_finding" : "active_case_finding"),
    });
    setSubmitting(false);
    if (error) {
      // Never surface the raw Postgres string — "new row violates row-level
      // security policy for table cases" is not an instruction anyone can act
      // on. The console keeps the original for whoever is debugging.
      console.error("Case insert failed", error);
      toast.error(
        error.code === "23505"
          ? "That TB case number is already used in this facility's register."
          : explainCaseError(error)
      );
      return;
    }
    toast.success("Case recorded. Hotspot detection is running.");
    // Fire-and-forget — do not await so navigation is instant.
    void triggerHotspotDetection();
    navigate("/app/cases");
  }

  const outcomeClosed =
    form.treatment_outcome !== "ongoing" &&
    form.treatment_outcome !== "not_evaluated";

  return (
    <>
      <PageHeader
        title="Encode New Case"
        subtitle="Follows the NTP TB Register — columns (1) to (23), in the order they appear in the book."
      />
      {/* Say it before the form, not after it. The RLS refusal used to arrive
          only on submit, by which point the encoder had typed a name, an
          address and geocoded a pin — all of it thrown away on a message that
          named a Postgres policy. */}
      {!filing.allowed && (
        <Card className="mb-4 flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
          <ShieldAlert
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          />
          <div role="alert">
            <p className="text-sm font-semibold text-amber-900">
              {FILING_BLOCKED[filing.blocker ?? "unassigned"].title}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {fillArea(
                FILING_BLOCKED[filing.blocker ?? "unassigned"].body,
                ownBarangayName
              )}
            </p>
          </div>
        </Card>
      )}
      <Card className="p-4 sm:p-6">
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
          {/* Not a register column — the book is TB-only, this app isn't.
              Picking another disease hides the TB-specific columns. */}
          <div className="space-y-1.5">
            <Label htmlFor="disease">Disease</Label>
            <Select
              id="disease"
              value={form.disease}
              onChange={(e) => set("disease", e.target.value)}
            >
              {DISEASES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          {isTb && (
            <div className="space-y-1.5">
              <Label htmlFor="facility">Registered at (DOTS facility)</Label>
              <Select
                id="facility"
                value={form.facility_id}
                disabled={facilityFixed || lockClinicalDetail}
                onChange={(e) => set("facility_id", e.target.value)}
                aria-describedby="facility_hint"
              >
                <option value="">— not recorded —</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
              <p id="facility_hint" className="text-xs text-slate-500">
                {facilityFixed
                  ? "Your own DOTS centre. Every case you record is filed against it — that's what lets you register a patient who lives in another barangay."
                  : lockClinicalDetail
                    ? "A presumptive case hasn't been registered at a DOTS facility yet, so there is nothing to record here."
                    : "The DOTS facility this case is registered/notified at — often not the patient's own barangay."}
              </p>
            </div>
          )}

          {/* ── (1)–(4) ─────────────────────────────────────────────── */}
          <Section title="Register entry" columns="(1)–(4)">
            {isTb && (
              <div className="space-y-1.5">
                <Label htmlFor="tb_case_number">
                  <Col n={1} />
                  TB case number
                </Label>
                <Input
                  id="tb_case_number"
                  value={form.tb_case_number}
                  onChange={(e) => set("tb_case_number", e.target.value)}
                  placeholder="2026-001"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="screening_date">
                <Col n={2} />
                Date of screening
              </Label>
              <Input
                id="screening_date"
                type="date"
                max={today}
                value={form.screening_date}
                onChange={(e) => set("screening_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notification_date">
                <Col n={3} />
                Date of notification
              </Label>
              <Input
                id="notification_date"
                type="date"
                max={today}
                value={form.notification_date}
                onChange={(e) => set("notification_date", e.target.value)}
              />
            </div>
            {isTb && (
              <div className="space-y-1.5">
                <Label htmlFor="treatment_start_date">
                  <Col n={4} />
                  Date start of treatment
                </Label>
                <Input
                  id="treatment_start_date"
                  type="date"
                  disabled={lockClinicalDetail}
                  value={form.treatment_start_date}
                  onChange={(e) => set("treatment_start_date", e.target.value)}
                />
              </div>
            )}
          </Section>

          {/* ── (5)–(9) ─────────────────────────────────────────────── */}
          <Section title="Patient" columns="(5)–(9)">
            {/* Identity first — it's what the nurse matches the person against
                at the counter, and enrollment can't proceed without it. Order
                is the register's: surname, given name, extension, middle. */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <div className="text-sm font-medium text-slate-700">
                <Col n={5} />
                Patient&apos;s full name
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  aria-label="Surname"
                  value={form.family_name}
                  onChange={(e) => set("family_name", e.target.value)}
                  placeholder="Surname — Dela Cruz"
                  autoComplete="off"
                />
                <Input
                  aria-label="Given name"
                  value={form.given_name}
                  onChange={(e) => set("given_name", e.target.value)}
                  placeholder="Given name — Maria"
                  autoComplete="off"
                />
                <Input
                  aria-label="Name extension"
                  value={form.name_extension}
                  onChange={(e) => set("name_extension", e.target.value)}
                  placeholder="Ext. — Jr., III"
                  autoComplete="off"
                />
                <Input
                  aria-label="Middle name"
                  value={form.middle_name}
                  onChange={(e) => set("middle_name", e.target.value)}
                  placeholder="Middle name — Santos"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">
                <Col n={6} />
                Date of birth
              </Label>
              <Input
                id="date_of_birth"
                type="date"
                max={today}
                value={form.date_of_birth}
                onChange={(e) => {
                  const dob = e.target.value;
                  setForm((f) => ({
                    ...f,
                    date_of_birth: dob,
                    age: dob ? ageFrom(dob) || f.age : f.age,
                  }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age">
                <Col n={7} />
                Age
              </Label>
              <Input
                id="age"
                type="number"
                min={0}
                max={120}
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                aria-describedby="age_hint"
              />
              <p id="age_hint" className="text-xs text-slate-500">
                Filled from the date of birth when one is given.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sex">
                <Col n={8} />
                Sex
              </Label>
              <Select
                id="sex"
                value={form.sex}
                onChange={(e) => set("sex", e.target.value)}
              >
                <option value="male">M — Male</option>
                <option value="female">F — Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">
                <Col n={9} />
                Contact number
              </Label>
              <Input
                id="contact_phone"
                type="tel"
                value={form.contact_phone}
                onChange={(e) => set("contact_phone", e.target.value)}
                placeholder="0917 000 0000"
                aria-describedby="contact_hint"
              />
              <p id="contact_hint" className="text-xs text-slate-500">
                Where refill reminders go. Staff-only.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <div className="text-sm font-medium text-slate-700">
                <Col n={9} />
                Permanent address
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      id="address"
                      aria-label="House no. and street"
                      className="flex-1"
                      value={form.address}
                      placeholder="House no., street, purok — 123 Mabini St., Purok 5"
                      onChange={(e) => {
                        set("address", e.target.value);
                        setLocated(null);
                      }}
                      aria-describedby="address_hint"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={locating || !form.address.trim()}
                      onClick={locateAddress}
                    >
                      {locating ? "Locating…" : "Find on map"}
                    </Button>
                  </div>
                  <p id="address_hint" className="text-xs text-slate-500">
                    {located
                      ? `Pinned: ${located.label}`
                      : "Optional but recommended — the GIS map traces the case to the household for contact tracing. Never shown publicly."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {barangayFixed ? (
                    // Same treatment as the locked filter on the Cases page, so
                    // "this is fixed for your account" reads the same wherever
                    // it appears.
                    <div
                      aria-label="Barangay of residence"
                      aria-describedby="barangay_hint"
                      className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700"
                    >
                      <Lock
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      />
                      <span className="truncate font-medium">
                        {ownBarangayName ?? "No area assigned"}
                      </span>
                    </div>
                  ) : (
                    <Select
                      id="barangay"
                      aria-label="Barangay of residence"
                      required
                      value={form.barangay_psgc}
                      onChange={(e) => {
                        set("barangay_psgc", e.target.value);
                        setLocated(null);
                      }}
                      aria-invalid={barangayRejected || undefined}
                      className={
                        barangayRejected
                          ? "border-amber-400 focus-visible:ring-amber-500/60"
                          : undefined
                      }
                      aria-describedby="barangay_hint"
                    >
                      <option value="">— select barangay —</option>
                      {barangays.map((b) => (
                        <option key={b.psgc} value={b.psgc}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  {/* The field that caused the rejection should be the field
                      that reports it — the banner at the top explains the
                      account, this marks the choice that cannot be saved. */}
                  <p
                    id="barangay_hint"
                    className={
                      barangayRejected
                        ? "text-xs font-medium text-amber-800"
                        : "text-xs text-slate-500"
                    }
                  >
                    {barangayRejected
                      ? fillArea(
                          "This case cannot be saved for the barangay you picked. " +
                            FILING_BLOCKED[filing.blocker ?? "unassigned"].body,
                          ownBarangayName
                        )
                      : barangayLock
                        ? fillArea(
                            BARANGAY_FIXED_HINT[barangayLock],
                            ownBarangayName
                          )
                        : "Barangay · Davao City · Davao del Sur · Region XI. Surveillance and hotspot detection key on where the patient lives, not the facility."}
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {isTb && (
            <>
              {/* ── (10)–(15) ───────────────────────────────────────── */}
              <Section title="Case classification" columns="(10)–(15)">
                <div className="space-y-1.5">
                  <Label htmlFor="patient_source">
                    <Col n={10} />
                    Source of patient
                  </Label>
                  <Select
                    id="patient_source"
                    value={form.patient_source}
                    onChange={(e) => set("patient_source", e.target.value)}
                  >
                    {PATIENT_SOURCE.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="screening_mode">
                    <Col n={11} />
                    Mode of screening
                  </Label>
                  <Select
                    id="screening_mode"
                    value={form.screening_mode}
                    onChange={(e) => set("screening_mode", e.target.value)}
                  >
                    {SCREENING_MODE.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tb_site">
                    <Col n={12} />
                    Anatomical site
                  </Label>
                  <Select
                    id="tb_site"
                    value={form.tb_site}
                    onChange={(e) => set("tb_site", e.target.value)}
                  >
                    {TB_SITE.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  {form.tb_site === "extra_pulmonary" && (
                    <Input
                      aria-label="Extra-pulmonary site, specify"
                      value={form.ep_site}
                      onChange={(e) => set("ep_site", e.target.value)}
                      placeholder="Specify — e.g., lymph node, pleura"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="registration_group">
                    <Col n={13} />
                    Registration group
                  </Label>
                  <Select
                    id="registration_group"
                    value={form.registration_group}
                    onChange={(e) => set("registration_group", e.target.value)}
                  >
                    {REGISTRATION_GROUP.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="diagnosis_status">
                    <Col n={14} />
                    Bacteriological status
                  </Label>
                  <Select
                    id="diagnosis_status"
                    value={form.diagnosis_status}
                    onChange={(e) => setDiagnosisStatus(e.target.value)}
                    aria-describedby="diagnosis_status_hint"
                  >
                    {DIAGNOSIS_STATUS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                  <p
                    id="diagnosis_status_hint"
                    className="text-xs text-slate-500"
                  >
                    {
                      DIAGNOSIS_STATUS.find(
                        (d) => d.value === form.diagnosis_status
                      )?.hint
                    }
                    {lockClinicalDetail &&
                      " Treatment columns stay locked until the case is BC or CD."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="treatment_regimen">
                    <Col n={15} />
                    Regimen at start
                  </Label>
                  <Select
                    id="treatment_regimen"
                    value={form.treatment_regimen}
                    disabled={lockClinicalDetail}
                    onChange={(e) => set("treatment_regimen", e.target.value)}
                  >
                    {REGIMEN.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drug_susceptibility">Drug susceptibility</Label>
                  <Select
                    id="drug_susceptibility"
                    value={form.drug_susceptibility}
                    disabled={lockClinicalDetail}
                    onChange={(e) => set("drug_susceptibility", e.target.value)}
                  >
                    {DRUG_SUSCEPTIBILITY.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </Section>

              {/* ── (16)–(20) ───────────────────────────────────────── */}
              <Section title="Contacts, comorbidities & treatment" columns="(16)–(20)">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <div className="text-sm font-medium text-slate-700">
                    <Col n={16} />
                    Number of contacts
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                          <th scope="col" className="px-3 py-2 text-left font-semibold">
                            <span className="sr-only">Group</span>
                          </th>
                          {CONTACT_STEPS.map((s) => (
                            <th
                              key={s.key}
                              scope="col"
                              className="px-2 py-2 text-left font-semibold"
                            >
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {CONTACT_GROUPS.map((g) => (
                          <tr key={g.key}>
                            <th
                              scope="row"
                              className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-slate-600"
                            >
                              {g.label}
                            </th>
                            {CONTACT_STEPS.map((s) => (
                              <td key={s.key} className="px-2 py-1.5">
                                <Input
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  aria-label={`${g.label} — ${s.label}`}
                                  className="h-9 min-w-[4.5rem]"
                                  value={contacts[g.key][s.key]}
                                  onChange={(e) =>
                                    setContacts((c) => ({
                                      ...c,
                                      [g.key]: {
                                        ...c[g.key],
                                        [s.key]: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="text-sm font-medium text-slate-700">
                    <Col n={17} />
                    HIV status &amp; test date
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      aria-label="HIV status"
                      value={form.hiv_status}
                      onChange={(e) => set("hiv_status", e.target.value)}
                    >
                      {COMORBID_STATUS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      aria-label="HIV test date"
                      max={today}
                      disabled={!form.hiv_status}
                      value={form.hiv_test_date}
                      onChange={(e) => set("hiv_test_date", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="text-sm font-medium text-slate-700">
                    <Col n={18} />
                    DM status &amp; screening date
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      aria-label="Diabetes status"
                      value={form.dm_status}
                      onChange={(e) => set("dm_status", e.target.value)}
                    >
                      {COMORBID_STATUS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      aria-label="Diabetes screening date"
                      max={today}
                      disabled={!form.dm_status}
                      value={form.dm_screening_date}
                      onChange={(e) => set("dm_screening_date", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="text-sm font-medium text-slate-700">
                    <Col n={19} />
                    Location of treatment
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      aria-label="Location of treatment"
                      value={form.treatment_location}
                      disabled={lockClinicalDetail}
                      onChange={(e) => set("treatment_location", e.target.value)}
                    >
                      {TX_LOCATION.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label="Digital adherence technology, specify"
                      placeholder="DAT — specify"
                      disabled={lockClinicalDetail}
                      value={form.dat_type}
                      onChange={(e) => set("dat_type", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="supporter_type">
                    <Col n={20} />
                    Type of treatment supporter
                  </Label>
                  <Select
                    id="supporter_type"
                    value={form.supporter_type}
                    disabled={lockClinicalDetail}
                    onChange={(e) => set("supporter_type", e.target.value)}
                  >
                    {SUPPORTER.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </Section>

              {/* ── (21) ────────────────────────────────────────────── */}
              <fieldset className="sm:col-span-2 rounded-xl border border-slate-200">
                <legend className="ml-3 px-1.5">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Xpert MTB/RIF (X) &amp; TB smear microscopy (S)
                  </span>
                  <span className="ml-2 font-mono text-[10px] text-slate-400">
                    (21)
                  </span>
                </legend>
                <div className="p-4 pt-2">
                  <p className="mb-2 text-xs text-slate-500">
                    Result and date collected. Columns 2–≥7 are follow-up smears
                    by treatment month — fill them later as results come in.
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                          <th scope="col" className="px-3 py-2 text-left font-semibold">
                            <span className="sr-only">Field</span>
                          </th>
                          {LAB_COLUMNS.map((c) => (
                            <th
                              key={c.key}
                              scope="col"
                              title={c.title}
                              className="px-1.5 py-2 text-left font-semibold"
                            >
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(["result", "date"] as const).map((field) => (
                          <tr key={field}>
                            <th
                              scope="row"
                              className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-slate-600"
                            >
                              {field === "result" ? "Result" : "Date collected"}
                            </th>
                            {LAB_COLUMNS.map((c) => (
                              <td key={c.key} className="px-1.5 py-1.5">
                                <Input
                                  type={field === "date" ? "date" : "text"}
                                  max={field === "date" ? today : undefined}
                                  aria-label={`${c.title} — ${field === "result" ? "result" : "date collected"}`}
                                  placeholder={
                                    field === "result" ? c.placeholder : undefined
                                  }
                                  className={
                                    field === "date"
                                      ? "h-9 min-w-[8.5rem] px-2 text-xs"
                                      : "h-9 min-w-[6rem] px-2"
                                  }
                                  value={labs[c.key][field]}
                                  onChange={(e) =>
                                    setLabs((l) => ({
                                      ...l,
                                      [c.key]: {
                                        ...l[c.key],
                                        [field]: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </fieldset>
            </>
          )}

          {/* ── (22)–(23) ───────────────────────────────────────────── */}
          <Section title="Outcome & remarks" columns="(22)–(23)">
            <div className="space-y-1.5">
              <Label htmlFor="outcome">
                <Col n={22} />
                Treatment outcome
              </Label>
              <Select
                id="outcome"
                value={form.treatment_outcome}
                disabled={lockClinicalDetail}
                onChange={(e) => set("treatment_outcome", e.target.value)}
                aria-describedby={lockClinicalDetail ? "outcome_hint" : undefined}
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {lockClinicalDetail && (
                <p id="outcome_hint" className="text-xs text-slate-500">
                  A presumptive case hasn&apos;t started treatment, so there is
                  no outcome to record yet.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outcome_date">Outcome date</Label>
              <Input
                id="outcome_date"
                type="date"
                max={today}
                disabled={!outcomeClosed}
                value={form.outcome_date}
                onChange={(e) => set("outcome_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="outcome_reason">Reason</Label>
              <Input
                id="outcome_reason"
                disabled={!outcomeClosed}
                value={form.outcome_reason}
                onChange={(e) => set("outcome_reason", e.target.value)}
                placeholder="e.g., cause of death, reason for loss to follow-up"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="notes">
                <Col n={23} />
                Remarks
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Patient number, study participant, notes, etc. — do not repeat names or addresses here."
              />
            </div>
          </Section>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            {/* Disabled rather than left live to fail: the encoder has no way
                to satisfy the policy from this form, so offering the action is
                a promise the page cannot keep. `title` carries the reason for
                anyone who tries to click it anyway. */}
            <Button
              type="submit"
              disabled={submitting || !filing.allowed}
              title={
                filing.allowed
                  ? undefined
                  : fillArea(
                      FILING_BLOCKED[filing.blocker ?? "unassigned"].toast,
                      ownBarangayName
                    )
              }
            >
              {submitting ? "Saving…" : "Save case"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
