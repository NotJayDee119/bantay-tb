/**
 * Writes docs/fhir-sample-payload.json — the exported sample payload
 * deliverable — using the exact same serializer the Edge Function runs
 * (supabase/functions/_shared/fhir.ts). No hand-written JSON: if the sample
 * and the live pipeline ever disagree, that is a bug in one of them.
 *
 *   npm run fhir:sample
 *
 * The input below mirrors a real BANTAY-TB row (a Buhangin case enrolled at
 * the Buhangin DOTS Center) with the names and the contact number replaced,
 * so the committed artefact carries no real patient's data. The bundle is
 * produced at the default `pseudonymous` disclosure scope, which is what the
 * app actually transmits unless the TB coordinator explicitly asks for an
 * identified disclosure — so what you see here is what leaves the building.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildCaseBundle } from "../supabase/functions/_shared/fhir.ts";

const built = buildCaseBundle({
  caseRow: {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    patient_code: "TB-DVO-2026-00418",
    given_name: "Juana",
    family_name: "Santos",
    contact_phone: "+639170000000",
    address: "Blk 7 Lot 12, Purok Mahogany",
    residence_lat: 7.1096,
    residence_lon: 125.6241,
    barangay_psgc: 112402031,
    facility_id: "b4d1c0de-0000-4000-8000-0000000000a1",
    disease: "tb",
    tb_classification: "drug_sensitive",
    tb_site: "pulmonary",
    diagnosis_status: "bacteriologically_confirmed",
    age: 41,
    age_group: "35-44",
    sex: "female",
    treatment_outcome: "ongoing",
    reported_at: "2026-08-14T01:40:00.000Z",
    diagnosis_date: "2026-08-12",
    notes: "Xpert MTB/RIF positive, rifampicin susceptible. Two household contacts screened.",
    source: "active_case_finding",
    created_at: "2026-08-14T01:52:11.000Z",
  },
  barangay: {
    psgc: 112402031,
    name: "Buhangin",
    centroid_lat: 7.1039,
    centroid_lon: 125.6194,
  },
  facility: {
    id: "b4d1c0de-0000-4000-8000-0000000000a1",
    name: "Buhangin Health Center (DOTS)",
    address: "Buhangin Road, Barangay Buhangin, Davao City",
    lat: 7.1052,
    lon: 125.6218,
    phone: "+63822345678",
    hours: "Mon-Fri 08:00-17:00",
  },
  schedules: [
    {
      id: "a1a1a1a1-0000-4000-8000-000000000001",
      medication: "HRZE fixed-dose combination (intensive phase)",
      dose: "4 tablets",
      times_per_day: 1,
      start_date: "2026-08-15",
      end_date: "2026-10-14",
    },
  ],
  adherence: { total: 58, taken: 54, missed: 4 },
  disclosure: "pseudonymous",
  // The sample was produced against the HAPI public R4 test server, so it
  // carries the HTEST tag exactly as transmitted.
  testData: true,
});

const out = resolve(import.meta.dirname ?? ".", "../docs/fhir-sample-payload.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(built.bundle, null, 2) + "\n", "utf8");

console.log(`Wrote ${out}`);
console.log(
  `  ${built.summary.resourceCount} resources: ${built.summary.resourceTypes.join(", ")}`
);
console.log(`  disclosure scope: ${built.summary.disclosure}`);
console.log(`  bundle id: ${built.summary.bundleId}`);
