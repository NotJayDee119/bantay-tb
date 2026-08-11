import { useEffect, useMemo, useState } from "react";
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

// Three independent facts about a TB case. The old single "TB Classification"
// select mixed them together, so recording the site erased the diagnosis
// status and vice versa.
const TB_SITE = [
  { value: "", label: "— not specified —" },
  { value: "pulmonary", label: "Pulmonary" },
  { value: "extra_pulmonary", label: "Extra-pulmonary" },
];

const DIAGNOSIS_STATUS = [
  {
    value: "presumptive",
    label: "Presumptive",
    hint: "Has TB symptoms; found by screening. Not yet a confirmed patient.",
  },
  {
    value: "clinically_diagnosed",
    label: "Clinically diagnosed",
    hint: "Diagnosed on clinical or radiological grounds, without a positive lab result.",
  },
  {
    value: "bacteriologically_confirmed",
    label: "Bacteriologically confirmed",
    hint: "Smear, culture or Xpert positive.",
  },
];

const DRUG_SUSCEPTIBILITY = [
  { value: "", label: "— not tested —" },
  { value: "drug_sensitive", label: "Drug-sensitive" },
  { value: "drug_resistant", label: "Drug-resistant (MDR)" },
];

const OUTCOMES = [
  { value: "ongoing", label: "Ongoing treatment" },
  { value: "cured", label: "Cured" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
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
  const [form, setForm] = useState({
    given_name: "",
    family_name: "",
    contact_phone: "",
    barangay_psgc: profile?.barangay_psgc ? String(profile.barangay_psgc) : "",
    address: "",
    facility_id: isHealthWorker ? ownFacility : "",
    disease: "tb",
    tb_site: "",
    diagnosis_status: "presumptive",
    drug_susceptibility: "",
    age: "",
    sex: "male",
    treatment_outcome: "not_evaluated",
    notes: "",
    reported_at: new Date().toISOString().slice(0, 10),
  });

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
  // contradiction.
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

  function setDiagnosisStatus(value: string) {
    setForm((f) => ({
      ...f,
      diagnosis_status: value,
      ...(value === "presumptive"
        ? {
            drug_susceptibility: "",
            treatment_outcome: "not_evaluated",
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
    const { error } = await supabase.from("cases").insert({
      given_name: form.given_name.trim() || null,
      family_name: form.family_name.trim() || null,
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
      tb_site: isTb && form.tb_site ? (form.tb_site as TBSite) : null,
      diagnosis_status: isTb
        ? (form.diagnosis_status as DiagnosisStatus)
        : null,
      // Only set when susceptibility testing actually happened. Left null,
      // the cases_sync_tb_fields trigger derives the legacy column from the
      // site and diagnosis status instead.
      tb_classification:
        isTb && form.drug_susceptibility
          ? (form.drug_susceptibility as TBClassification)
          : null,
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
      notes: form.notes || null,
      reported_at: new Date(form.reported_at).toISOString(),
      jitter_lat: bgy.lat + Math.sin(angle) * r,
      jitter_lon: bgy.lon + Math.cos(angle) * r,
      reported_by: profile?.id ?? null,
      // Active case finding means someone went looking — a BHW sweep or a
      // mobile screening. A patient who walks into the clinic is passive case
      // finding, and filing them as ACF inflates the screening yield the
      // programme reports.
      source: isHealthWorker ? "passive_case_finding" : "active_case_finding",
    });
    setSubmitting(false);
    if (error) {
      // Never surface the raw Postgres string — "new row violates row-level
      // security policy for table cases" is not an instruction anyone can act
      // on. The console keeps the original for whoever is debugging.
      console.error("Case insert failed", error);
      toast.error(explainCaseError(error));
      return;
    }
    toast.success("Case recorded. Hotspot detection is running.");
    // Fire-and-forget — do not await so navigation is instant.
    void triggerHotspotDetection();
    navigate("/app/cases");
  }

  return (
    <>
      <PageHeader
        title="Encode New Case"
        subtitle="Active Case Finding — barangay-level case registration."
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
      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          {/* Identity first — it's what the nurse matches the person against
              at the counter, and enrollment can't proceed without it. */}
          <div className="space-y-1.5">
            <Label htmlFor="given_name">Given name</Label>
            <Input
              id="given_name"
              value={form.given_name}
              onChange={(e) => setForm({ ...form, given_name: e.target.value })}
              placeholder="Maria"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="family_name">Family name</Label>
            <Input
              id="family_name"
              value={form.family_name}
              onChange={(e) => setForm({ ...form, family_name: e.target.value })}
              placeholder="Dela Cruz"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="contact_phone">
              Contact number{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Input
              id="contact_phone"
              type="tel"
              value={form.contact_phone}
              onChange={(e) =>
                setForm({ ...form, contact_phone: e.target.value })
              }
              placeholder="0917 000 0000"
              aria-describedby="contact_hint"
            />
            <p id="contact_hint" className="text-xs text-slate-500">
              Where refill reminders go. Staff-only, like the rest of this
              record &mdash; never shown publicly.
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label
              id={barangayFixed ? "barangay_label" : undefined}
              htmlFor={barangayFixed ? undefined : "barangay"}
            >
              Barangay of residence
            </Label>
            {barangayFixed ? (
              // Same treatment as the locked filter on the Cases page, so
              // "this is fixed for your account" reads the same wherever it
              // appears.
              <div
                aria-labelledby="barangay_label"
                aria-describedby="barangay_hint"
                className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700"
              >
                <Lock aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate font-medium">
                  {ownBarangayName ?? "No area assigned"}
                </span>
              </div>
            ) : (
              <Select
                id="barangay"
                required
                value={form.barangay_psgc}
                onChange={(e) => {
                  setForm({ ...form, barangay_psgc: e.target.value });
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
            {/* The field that caused the rejection should be the field that
                reports it — the banner at the top explains the account, this
                marks the specific choice that cannot be saved. */}
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
                  ? fillArea(BARANGAY_FIXED_HINT[barangayLock], ownBarangayName)
                  : "Where the patient lives — surveillance, hotspot detection and contact tracing all key on this, not on the facility that registered the case."}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">House no. &amp; street</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                className="flex-1"
                value={form.address}
                placeholder="e.g., 123 Mabini St., Purok 5"
                onChange={(e) => {
                  setForm({ ...form, address: e.target.value });
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
                : "Optional but recommended — the GIS map traces the case to the household for contact tracing. Staff-only; never shown publicly."}
            </p>
          </div>
          {isTb && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="facility">Registered at (DOTS facility)</Label>
              <Select
                id="facility"
                value={form.facility_id}
                disabled={facilityFixed || lockClinicalDetail}
                onChange={(e) =>
                  setForm({ ...form, facility_id: e.target.value })
                }
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
                    : "The DOTS facility this case is registered/notified at. Often not the patient's own barangay — someone from Calinan may register at Mintal. The GIS map uses both to trace where cases actually come from."}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="disease">Disease</Label>
            <Select
              id="disease"
              value={form.disease}
              onChange={(e) => setForm({ ...form, disease: e.target.value })}
            >
              {DISEASES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reported_at">Reported on</Label>
            <Input
              id="reported_at"
              type="date"
              value={form.reported_at}
              onChange={(e) =>
                setForm({ ...form, reported_at: e.target.value })
              }
            />
          </div>
          {isTb && (
            <>
              <div className="space-y-1.5 sm:col-span-2">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  TB classification
                </div>
                <p className="text-xs text-slate-500">
                  Site, diagnosis status and drug susceptibility are recorded
                  separately — a case can be any combination of the three.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tb_site">Site of disease</Label>
                <Select
                  id="tb_site"
                  value={form.tb_site}
                  onChange={(e) =>
                    setForm({ ...form, tb_site: e.target.value })
                  }
                >
                  {TB_SITE.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="diagnosis_status">Diagnosis status</Label>
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
                <p id="diagnosis_status_hint" className="text-xs text-slate-500">
                  {
                    DIAGNOSIS_STATUS.find(
                      (d) => d.value === form.diagnosis_status
                    )?.hint
                  }
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="drug_susceptibility">Drug susceptibility</Label>
                <Select
                  id="drug_susceptibility"
                  value={form.drug_susceptibility}
                  disabled={lockClinicalDetail}
                  onChange={(e) =>
                    setForm({ ...form, drug_susceptibility: e.target.value })
                  }
                  aria-describedby={
                    lockClinicalDetail ? "drug_susceptibility_hint" : undefined
                  }
                >
                  {DRUG_SUSCEPTIBILITY.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
                {lockClinicalDetail && (
                  <p
                    id="drug_susceptibility_hint"
                    className="text-xs text-slate-500"
                  >
                    Susceptibility testing needs a positive culture or Xpert, so
                    it doesn&apos;t apply to a presumptive case.
                  </p>
                )}
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={0}
              max={120}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sex">Sex</Label>
            <Select
              id="sex"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="outcome">Treatment outcome</Label>
            <Select
              id="outcome"
              value={form.treatment_outcome}
              disabled={lockClinicalDetail}
              onChange={(e) =>
                setForm({ ...form, treatment_outcome: e.target.value })
              }
              aria-describedby={
                lockClinicalDetail ? "outcome_hint" : undefined
              }
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {lockClinicalDetail && (
              <p id="outcome_hint" className="text-xs text-slate-500">
                A presumptive case hasn&apos;t started treatment, so there is no
                outcome to record yet.
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes (no PII)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Clinical context only — do not enter patient names or addresses."
            />
          </div>
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
