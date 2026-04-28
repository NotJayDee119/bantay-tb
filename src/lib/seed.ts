import barangays from "../data/barangays.json";

/** Davao City barangays known from the capstone doc to carry the heaviest TB
 * burden (used to bias synthetic data so hotspot detection lights up where
 * the doc says it should). */
const HIGH_BURDEN = new Set([
  "Talomo",
  "Buhangin",
  "Bunawan",
  "Agdao",
  "Toril",
  "Matina Crossing",
  "Mintal",
  "Catalunan Grande",
]);

export interface SeedCase {
  barangay_psgc: number;
  disease: "tb" | "pneumonia" | "covid19" | "asthma";
  tb_classification: string | null;
  age: number;
  sex: "male" | "female";
  treatment_outcome:
    | "ongoing"
    | "cured"
    | "completed"
    | "failed"
    | "died"
    | "lost_to_followup"
    | "not_evaluated";
  reported_at: string;
  jitter_lat: number;
  jitter_lon: number;
  source: string;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Generate synthetic, deterministic case data biased toward Davao City's
 * documented high-burden barangays. */
export function generateSyntheticCases(seed = 42): SeedCase[] {
  const rng = seededRng(seed);
  const out: SeedCase[] = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const classes = [
    "drug_sensitive",
    "drug_sensitive",
    "drug_sensitive",
    "drug_resistant",
    "pulmonary",
    "extra_pulmonary",
  ];
  const outcomes = [
    "ongoing",
    "ongoing",
    "ongoing",
    "cured",
    "completed",
    "lost_to_followup",
    "failed",
  ] as const;

  for (const b of barangays) {
    const high = [...HIGH_BURDEN].some((h) => b.name.includes(h));
    const base = high ? 18 : 4;
    const count = base + Math.floor(rng() * (high ? 14 : 6));
    for (let i = 0; i < count; i++) {
      const angle = rng() * 2 * Math.PI;
      const radius = 0.0007 + rng() * 0.0025;
      const reportedDaysAgo = Math.floor(rng() * 365);
      out.push({
        barangay_psgc: b.psgc,
        disease: "tb",
        tb_classification: pick(classes, rng),
        age: 18 + Math.floor(rng() * 50),
        sex: rng() < 0.55 ? "male" : "female",
        treatment_outcome: pick(outcomes, rng),
        reported_at: new Date(now - reportedDaysAgo * oneDay).toISOString(),
        jitter_lat: b.lat + Math.sin(angle) * radius,
        jitter_lon: b.lon + Math.cos(angle) * radius,
        source: "seed",
      });
    }
  }
  return out;
}
