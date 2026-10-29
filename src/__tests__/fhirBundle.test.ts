import { describe, expect, it } from "vitest";
import {
  buildCaseBundle,
  createdLocations,
  summariseFhirResponse,
} from "../../supabase/functions/_shared/fhir.ts";
import type {
  BundleEntry,
  CaseRecord,
  FhirResource,
} from "../../supabase/functions/_shared/fhir.ts";

// Deterministic ids and clock, so a bundle can be asserted field by field.
function fixedIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}
const NOW = () => new Date("2026-10-11T08:30:00.000Z");

const BARANGAY = {
  psgc: 112402031,
  name: "Buhangin",
  centroid_lat: 7.1,
  centroid_lon: 125.62,
};

const FACILITY = {
  id: "f1f1f1f1-0000-4000-8000-000000000001",
  name: "Buhangin DOTS Center",
  address: "Km 5 Buhangin Road",
  lat: 7.105,
  lon: 125.625,
  phone: "+63821234567",
  hours: "Mon-Fri 8:00-17:00",
};

function makeCase(over: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "cccccccc-0000-4000-8000-000000000001",
    patient_code: "TB-2026-0042",
    given_name: "Maria",
    family_name: "Dela Cruz",
    contact_phone: "+639171234567",
    address: "12 Purok 3, Buhangin",
    residence_lat: 7.1031,
    residence_lon: 125.6218,
    barangay_psgc: BARANGAY.psgc,
    facility_id: FACILITY.id,
    disease: "tb",
    tb_classification: "drug_sensitive",
    tb_site: "pulmonary",
    diagnosis_status: "bacteriologically_confirmed",
    age: 34,
    age_group: "25-34",
    sex: "female",
    treatment_outcome: "ongoing",
    reported_at: "2026-09-01T02:15:00.000Z",
    diagnosis_date: "2026-08-28",
    notes: "Household contact of a confirmed case.",
    source: "active_case_finding",
    created_at: "2026-09-01T02:20:00.000Z",
    ...over,
  };
}

function build(over: Partial<CaseRecord> = {}, opts: Record<string, unknown> = {}) {
  return buildCaseBundle({
    caseRow: makeCase(over),
    barangay: BARANGAY,
    facility: FACILITY,
    newId: fixedIds(),
    now: NOW,
    ...opts,
  });
}

function pick(entries: BundleEntry[], type: string): FhirResource[] {
  return entries
    .map((e) => e.resource)
    .filter((r) => r.resourceType === type);
}

function one(entries: BundleEntry[], type: string): Record<string, unknown> {
  const found = pick(entries, type);
  expect(found, `expected exactly one ${type}`).toHaveLength(1);
  return found[0] as unknown as Record<string, unknown>;
}

describe("buildCaseBundle — bundle shape", () => {
  it("is a FHIR R4 transaction bundle with one POST request per entry", () => {
    const { bundle } = build();
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("transaction");
    expect(bundle.identifier.value).toBe(makeCase().id);
    expect(bundle.entry.length).toBeGreaterThan(0);
    for (const entry of bundle.entry) {
      expect(entry.request.method).toBe("POST");
      expect(entry.request.url).toBe(entry.resource.resourceType);
      expect(entry.fullUrl.startsWith("urn:uuid:")).toBe(true);
    }
  });

  it("carries the facility, the patient, the encounter and the diagnosis", () => {
    const { bundle, summary } = build();
    expect(summary.resourceTypes).toEqual([
      "Organization",
      "Location",
      "Patient",
      "Encounter",
      "Condition",
      "Observation", // diagnosis status
      "Observation", // treatment outcome
    ]);
    expect(summary.resourceCount).toBe(bundle.entry.length);
    expect(summary.caseLabel).toBe("TB-2026-0042");
  });

  it("names the DOTS facility as the performer of every observation", () => {
    const { bundle } = build();
    const org = bundle.entry.find((e) => e.resource.resourceType === "Organization");
    const observations = pick(bundle.entry, "Observation") as unknown as Record<
      string,
      unknown
    >[];
    expect(observations).toHaveLength(2);
    for (const obs of observations) {
      expect(obs.performer).toEqual([{ reference: org?.fullUrl }]);
    }
  });

  it("omits the performer rather than inventing one when there is no facility", () => {
    const { bundle } = buildCaseBundle({
      caseRow: makeCase({ facility_id: null }),
      barangay: BARANGAY,
      facility: null,
      newId: fixedIds(),
      now: NOW,
    });
    for (const obs of pick(bundle.entry, "Observation") as unknown as Record<
      string,
      unknown
    >[]) {
      expect(obs.performer).toBeUndefined();
    }
  });

  it("resolves every internal reference to an entry in the same bundle", () => {
    const { bundle } = build();
    const fullUrls = new Set(bundle.entry.map((e) => e.fullUrl));
    const refs: string[] = [];
    JSON.stringify(bundle, (key, value) => {
      if (key === "reference" && typeof value === "string") refs.push(value);
      return value;
    });
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(fullUrls.has(ref), `dangling reference ${ref}`).toBe(true);
    }
  });

  it("conditionally creates the Patient on its TB code, so re-sending does not duplicate", () => {
    const { bundle } = build();
    const patientEntry = bundle.entry.find(
      (e) => e.resource.resourceType === "Patient"
    );
    expect(patientEntry?.request.ifNoneExist).toContain("TB-2026-0042");
  });

  it("falls back to a short case id when the record has no TB code", () => {
    const { summary } = build({ patient_code: null });
    expect(summary.caseLabel).toBe("case-cccccccc");
  });
});

describe("buildCaseBundle — minimum necessary (RA 10173)", () => {
  it("omits name, phone and street from a pseudonymous bundle", () => {
    const { bundle } = build();
    const patient = one(bundle.entry, "Patient");
    expect(patient.name).toBeUndefined();
    expect(patient.telecom).toBeUndefined();
    const address = (patient.address as Record<string, unknown>[])[0];
    expect(address.line).toBeUndefined();
    // The barangay stays: it is the surveillance axis, and it is not an
    // identifier on its own.
    expect(address.district).toBe("Buhangin");
  });

  it("sends the barangay centroid, not the household, when pseudonymous", () => {
    const { bundle } = build();
    const patient = one(bundle.entry, "Patient");
    const address = (patient.address as Record<string, unknown>[])[0];
    const geo = (address.extension as Record<string, unknown>[])[0];
    const parts = geo.extension as { url: string; valueDecimal: number }[];
    expect(parts.find((p) => p.url === "latitude")?.valueDecimal).toBe(
      BARANGAY.centroid_lat
    );
    expect(parts.find((p) => p.url === "longitude")?.valueDecimal).toBe(
      BARANGAY.centroid_lon
    );
  });

  it("labels a pseudonymous bundle PSEUDED and restricted", () => {
    const { bundle } = build();
    const codes = (bundle.meta.security ?? []).map((c) => c.code);
    expect(codes).toContain("PSEUDED");
    expect(codes).toContain("R");
  });

  it("withholds clinical free text from a pseudonymous bundle, and says so", () => {
    const { bundle } = build();
    const condition = one(bundle.entry, "Condition");
    const note = (condition.note as { text: string }[])[0];
    expect(note.text).not.toContain("Household contact");
    expect(note.text).toContain("withheld");
  });

  it("includes name, phone, street and household coordinates when identified", () => {
    const { bundle } = build({}, { disclosure: "identified" });
    const patient = one(bundle.entry, "Patient");
    const name = (patient.name as Record<string, unknown>[])[0];
    expect(name.family).toBe("Dela Cruz");
    expect(name.given).toEqual(["Maria"]);
    expect((patient.telecom as { value: string }[])[0].value).toBe(
      "+639171234567"
    );
    const address = (patient.address as Record<string, unknown>[])[0];
    expect(address.line).toEqual(["12 Purok 3, Buhangin"]);
    const geo = (address.extension as Record<string, unknown>[])[0];
    const parts = geo.extension as { url: string; valueDecimal: number }[];
    expect(parts.find((p) => p.url === "latitude")?.valueDecimal).toBe(7.1031);

    const codes = (bundle.meta.security ?? []).map((c) => c.code);
    expect(codes).not.toContain("PSEUDED");
    expect(codes).toContain("R");

    const condition = one(bundle.entry, "Condition");
    expect((condition.note as { text: string }[])[0].text).toContain(
      "Household contact"
    );
  });

  it("only tags HTEST when asked to", () => {
    expect(build({}, { testData: true }).bundle.meta.tag?.[0].code).toBe("HTEST");
    expect(build({}, { testData: false }).bundle.meta.tag).toBeUndefined();
  });
});

describe("buildCaseBundle — terminology", () => {
  const icd = (c: Partial<CaseRecord>) => {
    const condition = one(build(c).bundle.entry, "Condition");
    const code = condition.code as { coding: { system: string; code: string }[] };
    return code.coding.find((x) => x.system === "http://hl7.org/fhir/sid/icd-10")
      ?.code;
  };
  const verification = (c: Partial<CaseRecord>) => {
    const condition = one(build(c).bundle.entry, "Condition");
    const vs = condition.verificationStatus as { coding: { code: string }[] };
    return vs.coding[0].code;
  };

  it("maps a bacteriologically confirmed pulmonary case to A15.0", () => {
    expect(
      icd({ tb_site: "pulmonary", diagnosis_status: "bacteriologically_confirmed" })
    ).toBe("A15.0");
  });

  it("maps a clinically diagnosed pulmonary case to A16.9, not A15.0", () => {
    expect(
      icd({ tb_site: "pulmonary", diagnosis_status: "clinically_diagnosed" })
    ).toBe("A16.9");
  });

  it("maps extrapulmonary TB to A18 whichever way it was diagnosed", () => {
    expect(
      icd({
        tb_site: "extra_pulmonary",
        diagnosis_status: "bacteriologically_confirmed",
      })
    ).toBe("A18");
    expect(
      icd({ tb_site: "extra_pulmonary", diagnosis_status: "clinically_diagnosed" })
    ).toBe("A18");
  });

  it("codes a presumptive case as suspected TB, never as a TB diagnosis", () => {
    // ACF yield is symptomatic, not confirmed: coding it A15/A16 would claim a
    // diagnosis nobody made.
    expect(icd({ diagnosis_status: "presumptive" })).toBe("Z03.0");
    expect(verification({ diagnosis_status: "presumptive" })).toBe("unconfirmed");
  });

  it("marks a clinically diagnosed case provisional and a confirmed one confirmed", () => {
    expect(verification({ diagnosis_status: "clinically_diagnosed" })).toBe(
      "provisional"
    );
    expect(verification({ diagnosis_status: "bacteriologically_confirmed" })).toBe(
      "confirmed"
    );
  });

  it("falls back to the legacy single-axis enum on rows that predate the split", () => {
    expect(
      icd({
        tb_site: null,
        diagnosis_status: null,
        tb_classification: "drug_resistant",
      })
    ).toBe("A15.0");
    expect(
      icd({
        tb_site: null,
        diagnosis_status: null,
        tb_classification: "presumptive",
      })
    ).toBe("Z03.0");
  });

  it("adds a SNOMED tuberculosis code alongside ICD-10", () => {
    const condition = one(build().bundle.entry, "Condition");
    const code = condition.code as { coding: { system: string; code: string }[] };
    expect(
      code.coding.find((x) => x.system === "http://snomed.info/sct")?.code
    ).toBe("56717001");
  });

  it("codes the non-TB diseases the surveillance schema also accepts", () => {
    expect(icd({ disease: "covid19" })).toBe("U07.1");
    expect(icd({ disease: "pneumonia" })).toBe("J18.9");
    expect(icd({ disease: "asthma" })).toBe("J45.9");
  });

  it("derives birthDate as a year only, because only an age was recorded", () => {
    const patient = one(build().bundle.entry, "Patient");
    // Diagnosed 2026-08-28 at age 34.
    expect(patient.birthDate).toBe("1992");
  });

  it("omits birthDate when no age was recorded", () => {
    const patient = one(build({ age: null }).bundle.entry, "Patient");
    expect(patient.birthDate).toBeUndefined();
  });

  it("flags a deceased patient and resolves the condition once treatment ends", () => {
    const died = build({ treatment_outcome: "died" }).bundle.entry;
    expect(one(died, "Patient").deceasedBoolean).toBe(true);

    const cured = build({ treatment_outcome: "cured" }).bundle.entry;
    const cs = one(cured, "Condition").clinicalStatus as {
      coding: { code: string }[];
    };
    expect(cs.coding[0].code).toBe("resolved");
  });

  it("keeps the encounter in-progress only while treatment is ongoing", () => {
    expect(one(build().bundle.entry, "Encounter").status).toBe("in-progress");
    expect(
      one(build({ treatment_outcome: "completed" }).bundle.entry, "Encounter")
        .status
    ).toBe("finished");
  });
});

describe("buildCaseBundle — missing links", () => {
  it("still produces a valid bundle for a case with no facility", () => {
    const { bundle, summary } = buildCaseBundle({
      caseRow: makeCase({ facility_id: null }),
      barangay: BARANGAY,
      facility: null,
      newId: fixedIds(),
      now: NOW,
    });
    expect(summary.resourceTypes).not.toContain("Organization");
    expect(summary.resourceTypes).toContain("Patient");
    const encounter = one(bundle.entry, "Encounter");
    expect(encounter.serviceProvider).toBeUndefined();
    expect(encounter.location).toBeUndefined();
  });

  it("still produces a valid bundle for a case with no resolvable barangay", () => {
    const { bundle } = buildCaseBundle({
      caseRow: makeCase(),
      barangay: null,
      facility: FACILITY,
      newId: fixedIds(),
      now: NOW,
    });
    expect(one(bundle.entry, "Patient").address).toBeUndefined();
  });
});

describe("summariseFhirResponse", () => {
  it("condenses a transaction-response to statuses and assigned locations", () => {
    const body = JSON.stringify({
      resourceType: "Bundle",
      type: "transaction-response",
      entry: [
        { response: { status: "201 Created", location: "Patient/12345/_history/1" } },
        { response: { status: "201 Created", location: "Condition/12346/_history/1" } },
      ],
    });
    const summary = summariseFhirResponse(200, body);
    expect(summary).toContain("transaction-response");
    expect(summary).toContain("Patient/12345/_history/1");
    expect(summary).toContain("201 Created");
  });

  it("condenses an OperationOutcome to its diagnostics", () => {
    const body = JSON.stringify({
      resourceType: "OperationOutcome",
      issue: [
        { severity: "error", code: "processing", diagnostics: "Unknown resource type" },
      ],
    });
    const summary = summariseFhirResponse(400, body);
    expect(summary).toContain("HTTP 400");
    expect(summary).toContain("Unknown resource type");
  });

  it("never echoes an unrecognised body back into the audit trail", () => {
    const summary = summariseFhirResponse(500, "Maria Dela Cruz, 12 Purok 3");
    expect(summary).not.toContain("Maria");
    expect(summary).toContain("non-JSON");
  });

  it("extracts the ids the receiver assigned", () => {
    const body = JSON.stringify({
      resourceType: "Bundle",
      type: "transaction-response",
      entry: [{ response: { status: "201", location: "Patient/777" } }, { response: {} }],
    });
    expect(createdLocations(body)).toEqual(["Patient/777"]);
    expect(createdLocations("not json")).toEqual([]);
  });
});
