import * as XLSX from "xlsx";
import type { Database } from "./database.types";
import { resolveBarangay } from "./barangayResolver";

type CaseInsert = Database["public"]["Tables"]["cases"]["Insert"];

/** Field synonyms encountered in CHO TB monthly reports. */
const FIELD_MAP: Record<string, keyof MappedRow> = {
  // barangay
  barangay: "barangay",
  brgy: "barangay",
  bgy: "barangay",
  baranggay: "barangay",
  // age
  age: "age",
  edad: "age",
  // sex
  sex: "sex",
  gender: "sex",
  kasarian: "sex",
  // classification
  "tb classification": "tb_classification",
  classification: "tb_classification",
  type: "tb_classification",
  diagnosis: "tb_classification",
  // site of disease
  site: "tb_site",
  "tb site": "tb_site",
  "site of disease": "tb_site",
  "anatomical site": "tb_site",
  // diagnosis status
  "diagnosis status": "diagnosis_status",
  "diagnostic status": "diagnosis_status",
  "bacteriological status": "diagnosis_status",
  "case type": "diagnosis_status",
  "registration group": "diagnosis_status",
  // outcome
  "treatment outcome": "treatment_outcome",
  outcome: "treatment_outcome",
  status: "treatment_outcome",
  // disease
  disease: "disease",
  // patient code
  "patient_code": "patient_code",
  "patient code": "patient_code",
  "patient id": "patient_code",
  code: "patient_code",
  // diagnosis date
  "diagnosis_date": "diagnosis_date",
  "diagnosis date": "diagnosis_date",
  "date_of_diagnosis": "diagnosis_date",
  "date of diagnosis": "diagnosis_date",
  date: "diagnosis_date",
  // PII to strip
  name: "_pii",
  "patient name": "_pii",
  "full name": "_pii",
  "first name": "_pii",
  "last name": "_pii",
  surname: "_pii",
  address: "_pii",
  street: "_pii",
  "house number": "_pii",
  "house no": "_pii",
  "house no.": "_pii",
  contact: "_pii",
  "contact number": "_pii",
  "phone number": "_pii",
  phone: "_pii",
  mobile: "_pii",
  email: "_pii",
};

interface MappedRow {
  barangay?: string;
  age?: number | string;
  sex?: string;
  tb_classification?: string;
  tb_site?: string;
  diagnosis_status?: string;
  treatment_outcome?: string;
  disease?: string;
  patient_code?: string;
  diagnosis_date?: unknown;
  _pii?: string;
}

export interface ImportPreview {
  rawRowCount: number;
  mappedColumns: { source: string; target: keyof MappedRow | "_unknown" }[];
  preview: PreviewRow[];
  inserts: CaseInsert[];
  unknownBarangays: string[];
  piiColumnsRemoved: string[];
}

export interface PreviewRow {
  barangay: string;
  barangay_psgc: number | null;
  disease: string;
  age: number | null;
  sex: string;
  tb_classification: string | null;
  treatment_outcome: string;
  rowIndex: number;
}

const SEX_NORMALIZE: Record<string, "male" | "female" | "other" | "unknown"> = {
  m: "male",
  male: "male",
  lalaki: "male",
  laki: "male",
  f: "female",
  female: "female",
  babae: "female",
  o: "other",
  other: "other",
};

const CLASS_NORMALIZE: Record<string, string> = {
  "drug-sensitive": "drug_sensitive",
  "drug sensitive": "drug_sensitive",
  ds: "drug_sensitive",
  "drug-resistant": "drug_resistant",
  "drug resistant": "drug_resistant",
  mdr: "drug_resistant",
  "mdr-tb": "drug_resistant",
  pulmonary: "pulmonary",
  "pulmonary tb": "pulmonary",
  ptb: "pulmonary",
  "extra-pulmonary": "extra_pulmonary",
  "extra pulmonary": "extra_pulmonary",
  eptb: "extra_pulmonary",
  presumptive: "presumptive",
  suspected: "presumptive",
};

const SITE_NORMALIZE: Record<string, string> = {
  pulmonary: "pulmonary",
  "pulmonary tb": "pulmonary",
  ptb: "pulmonary",
  p: "pulmonary",
  "extra-pulmonary": "extra_pulmonary",
  "extra pulmonary": "extra_pulmonary",
  extrapulmonary: "extra_pulmonary",
  eptb: "extra_pulmonary",
  ep: "extra_pulmonary",
};

const DX_STATUS_NORMALIZE: Record<string, string> = {
  presumptive: "presumptive",
  suspected: "presumptive",
  "presumptive tb": "presumptive",
  clinical: "clinically_diagnosed",
  "clinically diagnosed": "clinically_diagnosed",
  "clinically-diagnosed": "clinically_diagnosed",
  cd: "clinically_diagnosed",
  bacteriological: "bacteriologically_confirmed",
  "bacteriologically confirmed": "bacteriologically_confirmed",
  "bacteriologically-confirmed": "bacteriologically_confirmed",
  confirmed: "bacteriologically_confirmed",
  bc: "bacteriologically_confirmed",
  "smear positive": "bacteriologically_confirmed",
  "xpert positive": "bacteriologically_confirmed",
};

const OUTCOME_NORMALIZE: Record<string, string> = {
  cured: "cured",
  completed: "completed",
  ongoing: "ongoing",
  "on treatment": "ongoing",
  failed: "failed",
  failure: "failed",
  died: "died",
  death: "died",
  "lost to follow-up": "lost_to_followup",
  "lost to follow up": "lost_to_followup",
  ltfu: "lost_to_followup",
  "not evaluated": "not_evaluated",
};

const DISEASE_NORMALIZE: Record<string, string> = {
  tb: "tb",
  tuberculosis: "tb",
  ptb: "tb",
  "drug-resistant tb": "tb",
  pneumonia: "pneumonia",
  covid: "covid19",
  "covid-19": "covid19",
  "covid 19": "covid19",
  asthma: "asthma",
};

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ").replace(/[._-]+/g, " ");
}

function normalizeDateValue(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const y = String(parsed.y).padStart(4, "0");
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return null;
  }
  const str = String(raw).trim();
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalise<T extends Record<string, string>>(
  table: T,
  raw: unknown
): string | undefined {
  if (raw == null) return undefined;
  const k = String(raw).trim().toLowerCase();
  if (!k) return undefined;
  return table[k];
}

/**
 * Parse an Excel/CSV file into BANTAY-TB case inserts.
 *
 * All Personally Identifiable Information (PII) — patient names, house
 * numbers, street addresses, phone numbers, etc. — is detected by header
 * name and dropped from each row before any data is returned. The mapped
 * inserts are safe to send to Supabase.
 */
export async function parseImportFile(file: File): Promise<ImportPreview> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rows.length === 0) {
    return {
      rawRowCount: 0,
      mappedColumns: [],
      preview: [],
      inserts: [],
      unknownBarangays: [],
      piiColumnsRemoved: [],
    };
  }

  const headers = Object.keys(rows[0]);
  const mappedColumns: ImportPreview["mappedColumns"] = headers.map((h) => {
    const key = normaliseHeader(h);
    const target = (FIELD_MAP[key] ??
      (key.includes("brgy") || key.includes("baranggay")
        ? "barangay"
        : "_unknown")) as keyof MappedRow | "_unknown";
    return { source: h, target };
  });

  const piiColumnsRemoved = mappedColumns
    .filter((c) => c.target === "_pii")
    .map((c) => c.source);

  const inserts: CaseInsert[] = [];
  const preview: PreviewRow[] = [];
  const unknownBarangays = new Set<string>();

  rows.forEach((row, idx) => {
    const mapped: MappedRow = {};
    for (const c of mappedColumns) {
      if (c.target === "_unknown" || c.target === "_pii") continue;
      const v = row[c.source];
      if (v === "" || v == null) continue;
      mapped[c.target] = v as string;
    }

    const bgyRaw = String(mapped.barangay ?? "").trim();
    const resolved = resolveBarangay(bgyRaw);
    const bgy = resolved?.entry ?? null;
    if (!bgy && bgyRaw) unknownBarangays.add(bgyRaw);

    const ageRaw = mapped.age;
    const age =
      typeof ageRaw === "number"
        ? ageRaw
        : ageRaw && !Number.isNaN(Number(ageRaw))
          ? Number(ageRaw)
          : null;

    const sexNorm =
      (SEX_NORMALIZE[String(mapped.sex ?? "").trim().toLowerCase()] ??
        "unknown") as "male" | "female" | "other" | "unknown";

    const classNorm =
      normalise(CLASS_NORMALIZE, mapped.tb_classification) ?? null;
    // Left null when the sheet has no such column — the cases_sync_tb_fields
    // trigger then derives both from tb_classification, so older CHO report
    // formats keep importing unchanged.
    const siteNorm = normalise(SITE_NORMALIZE, mapped.tb_site) ?? null;
    const dxStatusNorm =
      normalise(DX_STATUS_NORMALIZE, mapped.diagnosis_status) ?? null;
    const outcomeNorm =
      normalise(OUTCOME_NORMALIZE, mapped.treatment_outcome) ?? "ongoing";
    const diseaseNorm =
      (normalise(DISEASE_NORMALIZE, mapped.disease) as
        | "tb"
        | "pneumonia"
        | "covid19"
        | "asthma"
        | undefined) ?? "tb";

    preview.push({
      rowIndex: idx + 2,
      barangay: bgy?.name ?? bgyRaw ?? "—",
      barangay_psgc: bgy?.psgc ?? null,
      disease: diseaseNorm,
      age,
      sex: sexNorm,
      tb_classification: classNorm,
      treatment_outcome: outcomeNorm,
    });

    if (!bgy) return;

    const patientCode = mapped.patient_code
      ? String(mapped.patient_code).trim()
      : `AUTO-${Date.now()}-${idx}`;
    const diagnosisDate = normalizeDateValue(mapped.diagnosis_date);

    // Deterministic ~75 m radial jitter from the centroid so case markers
    // don't all stack on a single point but stay inside the barangay.
    const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
    const r = 0.0006 + ((idx % 7) * 0.0002);
    inserts.push({
      barangay_psgc: bgy.psgc,
      disease: diseaseNorm,
      tb_classification: (classNorm as CaseInsert["tb_classification"]) ?? null,
      tb_site: (siteNorm as CaseInsert["tb_site"]) ?? null,
      diagnosis_status:
        (dxStatusNorm as CaseInsert["diagnosis_status"]) ?? null,
      age: age ?? null,
      sex: sexNorm,
      treatment_outcome: outcomeNorm as CaseInsert["treatment_outcome"],
      jitter_lat: bgy.lat + Math.sin(angle) * r,
      jitter_lon: bgy.lon + Math.cos(angle) * r,
      reported_at: diagnosisDate ?? new Date().toISOString(),
      patient_code: patientCode,
      diagnosis_date: diagnosisDate,
      source: "bulk_import",
    });
  });

  return {
    rawRowCount: rows.length,
    mappedColumns,
    preview: preview.slice(0, 5),
    inserts,
    unknownBarangays: [...unknownBarangays].sort(),
    piiColumnsRemoved,
  };
}
