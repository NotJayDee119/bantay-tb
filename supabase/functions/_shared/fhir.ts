// BANTAY-TB -> HL7 FHIR R4 serializer.
//
// Turns one row of `public.cases`, plus the barangay, DOTS facility and DOTS
// adherence rows that hang off it, into a FHIR R4 **transaction Bundle**: the
// interaction the specification defines for pushing a set of related
// resources to a server in one atomic request.
//
// Why a transaction and not a document bundle: the receiver answers a
// transaction with a `transaction-response` listing the id it assigned to each
// resource. That response is the evidence the payload was not merely accepted
// as an opaque blob but parsed, validated and stored as discrete resources --
// which is the whole claim interoperability makes.
//
// Deliberately free of Deno and browser APIs except `crypto.randomUUID`, which
// both runtimes have, and which is injectable so tests can pin it. That keeps
// this module unit-testable from the Vitest suite that runs in CI.
//
// ── Design notes ─────────────────────────────────────────────────────────────
//
// Terminology. Every clinical concept is bound to a published code system --
// ICD-10 for the TB diagnosis, SNOMED CT for the disorder and body site, HL7
// v3 / FHIR code systems for the administrative values. Where BANTAY-TB holds
// a concept the published systems do not model the way the NTP does (our
// three-way diagnosis axis, the DOH treatment-outcome list, the DOTS
// adherence rate), the resource carries an explicit local CodeSystem URI under
// our own namespace rather than a mis-mapped standard code. Inventing a
// SNOMED code would make the payload look more standardised and be less
// interoperable.
//
// Minimum necessary (RA 10173 s.11). The default disclosure scope is
// `pseudonymous`: the Patient resource carries the TB case code as its
// business identifier, no name, no telephone number, no street address, and
// the barangay *centroid* rather than the geocoded household. An `identified`
// bundle is a separate, explicitly requested act, tagged as such in the
// payload's own security labels and recorded as such in the audit log.

// ── Input shapes (a subset of the BANTAY-TB tables) ──────────────────────────

export type Disclosure = "pseudonymous" | "identified";

export interface CaseRecord {
  id: string;
  patient_code: string | null;
  given_name: string | null;
  family_name: string | null;
  contact_phone: string | null;
  address: string | null;
  residence_lat: number | null;
  residence_lon: number | null;
  barangay_psgc: number;
  facility_id: string | null;
  disease: string;
  tb_classification: string | null;
  tb_site: string | null;
  diagnosis_status: string | null;
  age: number | null;
  age_group: string | null;
  sex: string;
  treatment_outcome: string;
  reported_at: string;
  diagnosis_date: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
}

export interface BarangayRecord {
  psgc: number;
  name: string;
  centroid_lat: number;
  centroid_lon: number;
}

export interface FacilityRecord {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  hours: string | null;
}

export interface ScheduleRecord {
  id: string;
  medication: string;
  dose: string | null;
  times_per_day: number;
  start_date: string;
  end_date: string;
}

export interface AdherenceSummary {
  total: number;
  taken: number;
  missed: number;
}

export interface BuildOptions {
  caseRow: CaseRecord;
  barangay: BarangayRecord | null;
  facility: FacilityRecord | null;
  schedules?: ScheduleRecord[];
  adherence?: AdherenceSummary | null;
  /** Default `pseudonymous`. See "Minimum necessary" above. */
  disclosure?: Disclosure;
  /** Tags the bundle HTEST, so a public test server never holds untagged PHI. */
  testData?: boolean;
  /** Injectable for deterministic tests. */
  newId?: () => string;
  /** Injectable for deterministic tests. */
  now?: () => Date;
}

// ── Namespaces ───────────────────────────────────────────────────────────────

const BASE = "https://bantay-tb.davao.gov.ph/fhir";

const SYS = {
  tbCaseCode: `${BASE}/identifier/tb-case-code`,
  caseId: `${BASE}/identifier/case-id`,
  facility: `${BASE}/identifier/dots-facility`,
  bundle: `${BASE}/identifier/case-bundle`,
  psgc: "https://psa.gov.ph/classification/psgc",
  diagnosisStatus: `${BASE}/CodeSystem/tb-diagnosis-status`,
  treatmentOutcome: `${BASE}/CodeSystem/tb-treatment-outcome`,
  observation: `${BASE}/CodeSystem/bantay-tb-observation`,
  caseSource: `${BASE}/CodeSystem/case-source`,
  icd10: "http://hl7.org/fhir/sid/icd-10",
  snomed: "http://snomed.info/sct",
  loinc: "http://loinc.org",
  ucum: "http://unitsofmeasure.org",
  conditionCategory: "http://terminology.hl7.org/CodeSystem/condition-category",
  conditionClinical: "http://terminology.hl7.org/CodeSystem/condition-clinical",
  conditionVerStatus: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
  observationCategory: "http://terminology.hl7.org/CodeSystem/observation-category",
  actCode: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  actReason: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
  roleCode: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
  confidentiality: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
  observationValue: "http://terminology.hl7.org/CodeSystem/v3-ObservationValue",
  organizationType: "http://terminology.hl7.org/CodeSystem/organization-type",
  diagnosisRole: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
  geolocation: "http://hl7.org/fhir/StructureDefinition/geolocation",
};

// ── Minimal FHIR types ───────────────────────────────────────────────────────
// Hand-written rather than pulled from a package: the Edge Function is
// deployed as a single inlined file with no remote imports, and these are the
// only elements this pipeline actually emits.

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface FhirResource {
  resourceType: string;
  [key: string]: unknown;
}

export interface BundleEntry {
  fullUrl: string;
  resource: FhirResource;
  request: {
    method: "POST" | "PUT";
    url: string;
    ifNoneExist?: string;
  };
}

export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  meta: {
    lastUpdated: string;
    profile?: string[];
    security?: Coding[];
    tag?: Coding[];
  };
  identifier: { system: string; value: string };
  type: "transaction";
  timestamp: string;
  entry: BundleEntry[];
}

export interface BuildResult {
  bundle: FhirBundle;
  /** What went in, for the audit row -- never the payload itself. */
  summary: {
    bundleId: string;
    disclosure: Disclosure;
    resourceCount: number;
    resourceTypes: string[];
    caseLabel: string;
  };
}

// ── Terminology mapping ──────────────────────────────────────────────────────

/**
 * ICD-10 (WHO) plus SNOMED CT for the case's condition.
 *
 * The NTP records three facts BANTAY-TB keeps on separate columns -- anatomical
 * site, how firmly the case is diagnosed, and drug susceptibility -- while
 * ICD-10 folds site and bacteriological confirmation into one code. A15.x is
 * respiratory TB *confirmed* bacteriologically or histologically; A16.x is
 * respiratory TB *not* so confirmed; A18 covers other organs; Z03.0 is
 * "observation for suspected tuberculosis", which is the honest code for a
 * presumptive case -- somebody symptomatic who has not yet been diagnosed and
 * may well not have TB at all.
 */
function tbConditionCoding(
  site: string | null,
  status: string | null
): { coding: Coding[]; text: string } {
  const pulmonary = site !== "extra_pulmonary";
  const snomed: Coding = {
    system: SYS.snomed,
    code: "56717001",
    display: "Tuberculosis (disorder)",
  };

  if (status === "presumptive") {
    return {
      coding: [
        {
          system: SYS.icd10,
          code: "Z03.0",
          display: "Observation for suspected tuberculosis",
        },
      ],
      text: "Presumptive TB -- symptomatic, found by case finding, not yet diagnosed",
    };
  }

  if (status === "bacteriologically_confirmed") {
    return pulmonary
      ? {
          coding: [
            {
              system: SYS.icd10,
              code: "A15.0",
              display:
                "Tuberculosis of lung, confirmed by sputum microscopy with or without culture",
            },
            snomed,
          ],
          text: "Pulmonary TB, bacteriologically confirmed",
        }
      : {
          coding: [
            {
              system: SYS.icd10,
              code: "A18",
              display: "Tuberculosis of other organs",
            },
            snomed,
          ],
          text: "Extrapulmonary TB, bacteriologically confirmed",
        };
  }

  // clinically_diagnosed, or an older row where only the legacy enum was set.
  return pulmonary
    ? {
        coding: [
          {
            system: SYS.icd10,
            code: "A16.9",
            display:
              "Respiratory tuberculosis unspecified, without mention of bacteriological or histological confirmation",
          },
          snomed,
        ],
        text: "Pulmonary TB, clinically diagnosed",
      }
    : {
        coding: [
          { system: SYS.icd10, code: "A18", display: "Tuberculosis of other organs" },
          snomed,
        ],
        text: "Extrapulmonary TB, clinically diagnosed",
      };
}

/** The three non-TB diseases the surveillance schema also accepts. */
const NON_TB_CODING: Record<string, { coding: Coding[]; text: string }> = {
  pneumonia: {
    coding: [
      { system: SYS.icd10, code: "J18.9", display: "Pneumonia, unspecified organism" },
      { system: SYS.snomed, code: "233604007", display: "Pneumonia (disorder)" },
    ],
    text: "Pneumonia",
  },
  covid19: {
    coding: [
      { system: SYS.icd10, code: "U07.1", display: "COVID-19, virus identified" },
      { system: SYS.snomed, code: "840539006", display: "Disease caused by SARS-CoV-2" },
    ],
    text: "COVID-19",
  },
  asthma: {
    coding: [
      { system: SYS.icd10, code: "J45.9", display: "Asthma, unspecified" },
      { system: SYS.snomed, code: "195967001", display: "Asthma (disorder)" },
    ],
    text: "Asthma",
  },
};

function conditionCoding(c: CaseRecord): { coding: Coding[]; text: string } {
  if (c.disease !== "tb") {
    return (
      NON_TB_CODING[c.disease] ?? {
        coding: [],
        text: c.disease,
      }
    );
  }
  // tb_site / diagnosis_status are the real axes; the legacy single-axis
  // enum is the fallback for rows written before they existed.
  const site =
    c.tb_site ??
    (c.tb_classification === "extra_pulmonary" ? "extra_pulmonary" : null);
  const status =
    c.diagnosis_status ??
    (c.tb_classification === "presumptive"
      ? "presumptive"
      : c.tb_classification === "drug_sensitive" ||
        c.tb_classification === "drug_resistant"
      ? "bacteriologically_confirmed"
      : null);
  return tbConditionCoding(site, status);
}

/** FHIR condition-ver-status: how firmly the diagnosis is asserted. */
function verificationStatus(c: CaseRecord): CodeableConcept {
  const status = c.diagnosis_status ?? c.tb_classification;
  const code =
    status === "bacteriologically_confirmed" || status === "drug_sensitive" ||
    status === "drug_resistant"
      ? "confirmed"
      : status === "presumptive"
      ? "unconfirmed"
      : "provisional";
  return {
    coding: [{ system: SYS.conditionVerStatus, code, display: code }],
  };
}

/** FHIR condition-clinical, read off the treatment outcome. */
function clinicalStatus(outcome: string): CodeableConcept {
  const code =
    outcome === "cured" || outcome === "completed"
      ? "resolved"
      : outcome === "failed"
      ? "relapse"
      : "active";
  return { coding: [{ system: SYS.conditionClinical, code, display: code }] };
}

const DIAGNOSIS_STATUS_DISPLAY: Record<string, string> = {
  presumptive: "Presumptive TB (symptomatic, not yet diagnosed)",
  clinically_diagnosed: "Clinically diagnosed TB",
  bacteriologically_confirmed: "Bacteriologically confirmed TB",
};

const OUTCOME_DISPLAY: Record<string, string> = {
  ongoing: "On treatment",
  cured: "Cured",
  completed: "Treatment completed",
  failed: "Treatment failed",
  died: "Died",
  lost_to_followup: "Lost to follow-up",
  not_evaluated: "Not evaluated",
};

const SEX_TO_GENDER: Record<string, string> = {
  male: "male",
  female: "female",
  other: "other",
  unknown: "unknown",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strips undefined so the serialised JSON carries no empty elements. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const bag = obj as Record<string, unknown>;
  for (const key of Object.keys(bag)) {
    const v = bag[key];
    if (v === undefined || v === null) {
      delete bag[key];
    } else if (Array.isArray(v) && v.length === 0) {
      delete bag[key];
    }
  }
  return obj;
}

function isoDate(value: string | null): string | undefined {
  if (!value) return undefined;
  // `cases.diagnosis_date` is a DATE; FHIR wants YYYY-MM-DD.
  return value.length >= 10 ? value.slice(0, 10) : undefined;
}

/**
 * FHIR has no age element on Patient, and birthDate is the standard way to
 * convey it. BANTAY-TB only ever recorded an age in years, so the most precise
 * honest answer is the year of birth -- which FHIR's `date` type accepts as a
 * bare YYYY. Asserting a full birthDate we do not know would be fabrication,
 * and would disclose more than we hold.
 */
function birthYear(c: CaseRecord): string | undefined {
  if (c.age === null || c.age === undefined || c.age < 0 || c.age > 130) {
    return undefined;
  }
  const ref = new Date(c.diagnosis_date ?? c.reported_at);
  if (Number.isNaN(ref.getTime())) return undefined;
  return String(ref.getUTCFullYear() - c.age);
}

// ── The builder ──────────────────────────────────────────────────────────────

export function buildCaseBundle(options: BuildOptions): BuildResult {
  const {
    caseRow: c,
    barangay,
    facility,
    schedules = [],
    adherence = null,
    disclosure = "pseudonymous",
    testData = false,
    newId = () => crypto.randomUUID(),
    now = () => new Date(),
  } = options;

  const identified = disclosure === "identified";
  const timestamp = now().toISOString();
  const caseLabel = c.patient_code ?? `case-${c.id.slice(0, 8)}`;

  const patientRef = `urn:uuid:${newId()}`;
  const encounterRef = `urn:uuid:${newId()}`;
  const conditionRef = `urn:uuid:${newId()}`;
  const orgRef = facility ? `urn:uuid:${newId()}` : null;
  const locationRef = facility ? `urn:uuid:${newId()}` : null;

  // Every observation BANTAY-TB asserts was recorded by the DOTS facility
  // treating the patient, not by the app. Naming the performer is what lets a
  // receiver weigh the value -- and is why these resources validate clean
  // against the FHIR best-practice checks rather than merely parsing.
  const performer = orgRef ? [{ reference: orgRef }] : undefined;

  const entries: BundleEntry[] = [];

  // ── Organization + Location: the DOTS facility ────────────────────────────
  // The facility is not PHI, and sending it is what lets the receiver route a
  // referral back to a real place rather than to a barangay name.
  if (facility && orgRef && locationRef) {
    entries.push({
      fullUrl: orgRef,
      resource: compact({
        resourceType: "Organization",
        identifier: [{ system: SYS.facility, value: facility.id }],
        active: true,
        type: [
          {
            coding: [
              {
                system: SYS.organizationType,
                code: "prov",
                display: "Healthcare Provider",
              },
            ],
          },
        ],
        name: facility.name,
        telecom: facility.phone
          ? [{ system: "phone", value: facility.phone, use: "work" }]
          : undefined,
        address: [
          compact({
            use: "work",
            type: "physical",
            text: facility.address ?? undefined,
            city: "Davao City",
            state: "Region XI (Davao Region)",
            country: "PH",
          }),
        ],
      }),
      request: {
        method: "POST",
        url: "Organization",
        // Conditional create: re-running the demo must not litter the
        // receiver with duplicate facilities.
        ifNoneExist: `identifier=${SYS.facility}|${facility.id}`,
      },
    });

    entries.push({
      fullUrl: locationRef,
      resource: compact({
        resourceType: "Location",
        identifier: [{ system: SYS.facility, value: `${facility.id}-location` }],
        status: "active",
        name: facility.name,
        description: facility.hours
          ? `Service hours: ${facility.hours}`
          : undefined,
        mode: "instance",
        type: [
          {
            coding: [
              {
                system: SYS.roleCode,
                code: "OF",
                display: "Outpatient facility",
              },
            ],
          },
        ],
        // The GIS half of BANTAY-TB travels with the clinical half: the
        // receiver gets the real coordinates of the treatment site.
        position: { latitude: facility.lat, longitude: facility.lon },
        managingOrganization: { reference: orgRef, display: facility.name },
      }),
      request: {
        method: "POST",
        url: "Location",
        ifNoneExist: `identifier=${SYS.facility}|${facility.id}-location`,
      },
    });
  }

  // ── Patient ───────────────────────────────────────────────────────────────
  const addressLine =
    identified && c.address ? [c.address] : undefined;
  const geoLat = identified
    ? c.residence_lat ?? barangay?.centroid_lat
    : barangay?.centroid_lat;
  const geoLon = identified
    ? c.residence_lon ?? barangay?.centroid_lon
    : barangay?.centroid_lon;

  entries.push({
    fullUrl: patientRef,
    resource: compact({
      resourceType: "Patient",
      meta: {
        security: [
          {
            system: SYS.confidentiality,
            code: "R",
            display: "restricted",
          },
          ...(identified
            ? []
            : [
                {
                  system: SYS.observationValue,
                  code: "PSEUDED",
                  display: "pseudonymized",
                },
              ]),
        ],
      },
      // The TB case code is the business identifier the NTP register already
      // uses, so the receiver can match this patient on its next visit
      // without us ever sending a name.
      identifier: [
        compact({
          use: "official",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                code: "MR",
                display: "Medical record number",
              },
            ],
            text: "BANTAY-TB case code",
          },
          system: SYS.tbCaseCode,
          value: caseLabel,
        }),
        { system: SYS.caseId, value: c.id },
      ],
      active: true,
      name:
        identified && (c.family_name || c.given_name)
          ? [
              compact({
                use: "official",
                family: c.family_name ?? undefined,
                given: c.given_name ? [c.given_name] : undefined,
              }),
            ]
          : undefined,
      telecom:
        identified && c.contact_phone
          ? [{ system: "phone", value: c.contact_phone, use: "mobile" }]
          : undefined,
      gender: SEX_TO_GENDER[c.sex] ?? "unknown",
      birthDate: birthYear(c),
      deceasedBoolean: c.treatment_outcome === "died" ? true : undefined,
      address: barangay
        ? [
            compact({
              use: "home",
              type: identified ? "physical" : "both",
              line: addressLine,
              // `district` is the barangay: the axis BANTAY-TB's surveillance
              // is built on, and the level at which contact tracing happens.
              district: barangay.name,
              city: "Davao City",
              state: "Region XI (Davao Region)",
              country: "PH",
              extension:
                geoLat !== undefined && geoLon !== undefined
                  ? [
                      {
                        url: SYS.geolocation,
                        extension: [
                          { url: "latitude", valueDecimal: geoLat },
                          { url: "longitude", valueDecimal: geoLon },
                        ],
                      },
                    ]
                  : undefined,
            }),
          ]
        : undefined,
      managingOrganization: orgRef ? { reference: orgRef } : undefined,
    }),
    request: {
      method: "POST",
      url: "Patient",
      ifNoneExist: `identifier=${SYS.tbCaseCode}|${caseLabel}`,
    },
  });

  // ── Encounter: the notification / registration contact ────────────────────
  entries.push({
    fullUrl: encounterRef,
    resource: compact({
      resourceType: "Encounter",
      status: c.treatment_outcome === "ongoing" ? "in-progress" : "finished",
      class: { system: SYS.actCode, code: "AMB", display: "ambulatory" },
      // Text only, deliberately: no published code system has a concept for
      // "the contact at which a TB case entered the NTP register", and a
      // plausible-looking SNOMED code we had not verified would be worse than
      // honest free text.
      type: [{ text: "TB case registration / notification contact" }],
      subject: { reference: patientRef },
      period: { start: c.reported_at },
      // How this case reached the register -- active case finding in the
      // barangay, a facility walk-in, or a bulk upload of an existing paper
      // register. The receiver needs this to judge the record's provenance.
      reasonCode: c.source
        ? [{ coding: [{ system: SYS.caseSource, code: c.source }], text: c.source }]
        : undefined,
      diagnosis: [
        {
          condition: { reference: conditionRef },
          use: {
            coding: [
              {
                system: SYS.diagnosisRole,
                code: "AD",
                display: "Admission diagnosis",
              },
            ],
          },
          rank: 1,
        },
      ],
      location: locationRef ? [{ location: { reference: locationRef } }] : undefined,
      serviceProvider: orgRef ? { reference: orgRef } : undefined,
    }),
    request: { method: "POST", url: "Encounter" },
  });

  // ── Condition: the diagnosis itself ───────────────────────────────────────
  const dx = conditionCoding(c);
  entries.push({
    fullUrl: conditionRef,
    resource: compact({
      resourceType: "Condition",
      clinicalStatus: clinicalStatus(c.treatment_outcome),
      verificationStatus: verificationStatus(c),
      category: [
        {
          coding: [
            {
              system: SYS.conditionCategory,
              code: "encounter-diagnosis",
              display: "Encounter Diagnosis",
            },
          ],
        },
      ],
      code: { coding: dx.coding, text: dx.text },
      bodySite:
        c.disease === "tb" && (c.tb_site ?? "pulmonary") === "pulmonary"
          ? [
              {
                coding: [
                  { system: SYS.snomed, code: "39607008", display: "Lung structure" },
                ],
              },
            ]
          : undefined,
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      onsetDateTime: isoDate(c.diagnosis_date) ?? c.reported_at,
      recordedDate: c.created_at,
      // Clinical free text is not sent: it is the field most likely to hold
      // an incidental third-party identifier, and the receiver has no coded
      // use for it. The note says so rather than silently dropping it.
      note:
        c.notes && identified
          ? [{ text: c.notes }]
          : c.notes
          ? [
              {
                text:
                  "Clinical notes withheld from this pseudonymous disclosure (RA 10173 minimum necessary).",
              },
            ]
          : undefined,
    }),
    request: { method: "POST", url: "Condition" },
  });

  // ── Observation: BANTAY-TB's diagnosis axis ───────────────────────────────
  // The NTP's three-way axis has no faithful SNOMED/LOINC equivalent, so it
  // travels as a coded Observation against our own published CodeSystem URI.
  if (c.disease === "tb" && (c.diagnosis_status || c.tb_classification)) {
    const status = c.diagnosis_status ?? c.tb_classification ?? "unknown";
    entries.push({
      fullUrl: `urn:uuid:${newId()}`,
      resource: compact({
        resourceType: "Observation",
        status: "final",
        category: [
          {
            coding: [
              {
                system: SYS.observationCategory,
                code: "laboratory",
                display: "Laboratory",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: SYS.observation,
              code: "tb-diagnosis-status",
              display: "TB diagnostic classification (NTP)",
            },
          ],
          text: "How firmly this TB case is diagnosed",
        },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        performer,
        effectiveDateTime: isoDate(c.diagnosis_date) ?? c.reported_at,
        valueCodeableConcept: {
          coding: [
            {
              system: SYS.diagnosisStatus,
              code: status,
              display: DIAGNOSIS_STATUS_DISPLAY[status] ?? status,
            },
          ],
        },
      }),
      request: { method: "POST", url: "Observation" },
    });
  }

  // ── Observation: treatment outcome ────────────────────────────────────────
  entries.push({
    fullUrl: `urn:uuid:${newId()}`,
    resource: compact({
      resourceType: "Observation",
      status: c.treatment_outcome === "ongoing" ? "preliminary" : "final",
      category: [
        {
          coding: [
            {
              system: SYS.observationCategory,
              code: "therapy",
              display: "Therapy",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: SYS.observation,
            code: "tb-treatment-outcome",
            display: "TB treatment outcome (NTP)",
          },
        ],
        text: "WHO/NTP treatment outcome category",
      },
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      performer,
      effectiveDateTime: timestamp,
      valueCodeableConcept: {
        coding: [
          {
            system: SYS.treatmentOutcome,
            code: c.treatment_outcome,
            display: OUTCOME_DISPLAY[c.treatment_outcome] ?? c.treatment_outcome,
          },
        ],
      },
    }),
    request: { method: "POST", url: "Observation" },
  });

  // ── MedicationStatement: the DOTS regimen ─────────────────────────────────
  // The regimen and its adherence record are what BANTAY-TB holds that a
  // hospital EMR does not -- the part of this payload the receiving system
  // cannot get anywhere else.
  const today = now().toISOString().slice(0, 10);
  for (const s of schedules) {
    entries.push({
      fullUrl: `urn:uuid:${newId()}`,
      resource: compact({
        resourceType: "MedicationStatement",
        status: s.end_date < today ? "completed" : "active",
        category: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/medication-statement-category",
              code: "community",
              display: "Community",
            },
          ],
        },
        medicationCodeableConcept: { text: s.medication },
        subject: { reference: patientRef },
        effectivePeriod: { start: s.start_date, end: s.end_date },
        dateAsserted: timestamp,
        dosage: [
          compact({
            text: s.dose || undefined,
            timing: {
              repeat: {
                frequency: s.times_per_day,
                period: 1,
                periodUnit: "d",
              },
            },
            route: {
              coding: [
                { system: SYS.snomed, code: "26643006", display: "Oral route" },
              ],
            },
          }),
        ],
      }),
      request: { method: "POST", url: "MedicationStatement" },
    });
  }

  // ── Observation: DOTS adherence rate ──────────────────────────────────────
  if (adherence && adherence.total > 0) {
    const pct = Math.round((adherence.taken / adherence.total) * 1000) / 10;
    entries.push({
      fullUrl: `urn:uuid:${newId()}`,
      resource: compact({
        resourceType: "Observation",
        status: "preliminary",
        category: [
          {
            coding: [
              {
                system: SYS.observationCategory,
                code: "therapy",
                display: "Therapy",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: SYS.observation,
              code: "dots-adherence-rate",
              display: "DOTS medication adherence rate",
            },
          ],
          text: "Proportion of scheduled doses recorded as taken",
        },
        subject: { reference: patientRef },
        performer,
        effectiveDateTime: timestamp,
        valueQuantity: {
          value: pct,
          unit: "%",
          system: SYS.ucum,
          code: "%",
        },
        component: [
          {
            code: {
              coding: [
                {
                  system: SYS.observation,
                  code: "doses-taken",
                  display: "Doses recorded as taken",
                },
              ],
            },
            valueInteger: adherence.taken,
          },
          {
            code: {
              coding: [
                {
                  system: SYS.observation,
                  code: "doses-missed",
                  display: "Doses recorded as missed",
                },
              ],
            },
            valueInteger: adherence.missed,
          },
          {
            code: {
              coding: [
                {
                  system: SYS.observation,
                  code: "doses-scheduled",
                  display: "Doses scheduled",
                },
              ],
            },
            valueInteger: adherence.total,
          },
        ],
      }),
      request: { method: "POST", url: "Observation" },
    });
  }

  const bundleId = newId();
  const bundle: FhirBundle = {
    resourceType: "Bundle",
    id: bundleId,
    meta: compact({
      lastUpdated: timestamp,
      security: [
        { system: SYS.confidentiality, code: "R", display: "restricted" },
        ...(identified
          ? []
          : [
              {
                system: SYS.observationValue,
                code: "PSEUDED",
                display: "pseudonymized",
              },
            ]),
      ],
      // Without this tag a public reference server would be holding
      // unmarked Philippine health data.
      tag: testData
        ? [{ system: SYS.actReason, code: "HTEST", display: "test health data" }]
        : undefined,
    }) as FhirBundle["meta"],
    identifier: { system: SYS.bundle, value: c.id },
    type: "transaction",
    timestamp,
    entry: entries,
  };

  return {
    bundle,
    summary: {
      bundleId,
      disclosure,
      resourceCount: entries.length,
      resourceTypes: entries.map((e) => e.resource.resourceType),
      caseLabel,
    },
  };
}

/** SHA-256 of the exact bytes transmitted, as lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Condenses a FHIR response into something safe to keep forever: the
 * transaction-response's per-entry statuses and assigned locations, or an
 * OperationOutcome's diagnostics. Never the raw body -- a verbose endpoint
 * would otherwise echo the PHI we just sent straight back into our audit log.
 */
export function summariseFhirResponse(status: number, body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return `HTTP ${status}; non-JSON response (${body.length} bytes)`;
  }

  const obj = parsed as Record<string, unknown>;

  if (obj?.resourceType === "Bundle" && Array.isArray(obj.entry)) {
    const parts = (obj.entry as Record<string, unknown>[]).map((e, i) => {
      const res = e?.response as Record<string, unknown> | undefined;
      const loc = typeof res?.location === "string" ? res.location : "?";
      const st = typeof res?.status === "string" ? res.status : "?";
      return `${i + 1}:${st} ${loc}`;
    });
    return `HTTP ${status}; ${obj.type ?? "bundle"}; ${parts.join(" | ")}`.slice(
      0,
      2000
    );
  }

  if (obj?.resourceType === "OperationOutcome" && Array.isArray(obj.issue)) {
    const parts = (obj.issue as Record<string, unknown>[]).map(
      (i) =>
        `${i?.severity ?? "?"}/${i?.code ?? "?"}: ${
          typeof i?.diagnostics === "string" ? i.diagnostics : ""
        }`
    );
    return `HTTP ${status}; OperationOutcome; ${parts.join(" | ")}`.slice(0, 2000);
  }

  return `HTTP ${status}; ${String(obj?.resourceType ?? "unrecognised payload")}`;
}

/** The resource ids the receiver assigned, for display in the UI. */
export function createdLocations(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed?.resourceType !== "Bundle" || !Array.isArray(parsed.entry)) {
      return [];
    }
    return (parsed.entry as Record<string, unknown>[])
      .map((e) => {
        const res = e?.response as Record<string, unknown> | undefined;
        return typeof res?.location === "string" ? res.location : null;
      })
      .filter((l): l is string => Boolean(l));
  } catch {
    return [];
  }
}
