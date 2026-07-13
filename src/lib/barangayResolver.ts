import barangaysList from "../data/barangays.json";

type BarangayEntry = (typeof barangaysList)[number];

// ── Normalization ──────────────────────────────────────────────────
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.'',]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\b(barangay|brgy|bgy|proper|pob)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Alias map ──────────────────────────────────────────────────────
// Key = normalized alias, Value = canonical name from barangays.json.
const ALIASES: Record<string, string> = {
  // Parenthetical barangays — short forms
  lasang: "Alejandra Navarro (Lasang)",
  "alejandra navarro": "Alejandra Navarro (Lasang)",
  baguio: "Baguio (Pob.)",
  buhangin: "Buhangin (Pob.)",
  bunawan: "Bunawan (Pob.)",
  calinan: "Calinan (Pob.)",
  fatima: "Fatima (Benowang)",
  benowang: "Fatima (Benowang)",
  paquibato: "Paquibato (Pob.)",
  "san isidro": "San Isidro (Licanan)",
  licanan: "San Isidro (Licanan)",
  suawan: "Suawan (Tuli)",
  tuli: "Suawan (Tuli)",
  talomo: "Talomo (Pob.)",
  toril: "Toril (Pob.)",
  tugbok: "Tugbok (Pob.)",
  centro: "Centro (San Juan)",
  "san juan": "Centro (San Juan)",

  // Punctuation / diacritics variants
  maa: "Ma-a",
  "ma a": "Ma-a",
  "sto nino": "Santo Niño",
  "santo nino": "Santo Niño",

  // Titled / abbreviated names
  "r castillo": "Rafael Castillo",
  "rafael castillo": "Rafael Castillo",
  angliongto: "Alfonso Angliongto Sr.",
  "alfonso angliongto": "Alfonso Angliongto Sr.",
  "paciano bangoy": "Gov. Paciano Bangoy",
  bangoy: "Gov. Paciano Bangoy",
  "vicente duterte": "Gov. Vicente Duterte",
  duterte: "Gov. Vicente Duterte",
  "tomas monteverde": "Kap. Tomas Monteverde, Sr.",
  monteverde: "Kap. Tomas Monteverde, Sr.",
  "leon garcia": "Leon Garcia, Sr.",
  "vicente hizon": "Vicente Hizon Sr.",
  hizon: "Vicente Hizon Sr.",
  "wilfredo aquino": "Wilfredo Aquino",

  // Ambiguous short forms — mapped to most common/populated variant
  matina: "Matina Crossing",
  catalunan: "Catalunan Grande",
  biao: "Biao Guianga",

  // Poblacion numbered shorthand (people type "16-b" or "16b")
  poblacion: "Barangay 16-B (Pob.)",
  "1a": "Barangay 1-A (Pob.)",
  "2a": "Barangay 2-A (Pob.)",
  "3a": "Barangay 3-A (Pob.)",
  "4a": "Barangay 4-A (Pob.)",
  "5a": "Barangay 5-A (Pob.)",
  "6a": "Barangay 6-A (Pob.)",
  "7a": "Barangay 7-A (Pob.)",
  "8a": "Barangay 8-A (Pob.)",
  "9a": "Barangay 9-A (Pob.)",
  "10a": "Barangay 10-A (Pob.)",
  "11b": "Barangay 11-B (Pob.)",
  "12b": "Barangay 12-B (Pob.)",
  "13b": "Barangay 13-B (Pob.)",
  "14b": "Barangay 14-B (Pob.)",
  "15b": "Barangay 15-B (Pob.)",
  "16b": "Barangay 16-B (Pob.)",
  "17b": "Barangay 17-B (Pob.)",
  "18b": "Barangay 18-B (Pob.)",
  "19b": "Barangay 19-B (Pob.)",
  "20b": "Barangay 20-B (Pob.)",
  "21c": "Barangay 21-C (Pob.)",
  "22c": "Barangay 22-C (Pob.)",
  "23c": "Barangay 23-C (Pob.)",
  "24c": "Barangay 24-C (Pob.)",
  "25c": "Barangay 25-C (Pob.)",
  "26c": "Barangay 26-C (Pob.)",
  "27c": "Barangay 27-C (Pob.)",
  "28c": "Barangay 28-C (Pob.)",
  "29c": "Barangay 29-C (Pob.)",
  "30c": "Barangay 30-C (Pob.)",
  "31d": "Barangay 31-D (Pob.)",
  "32d": "Barangay 32-D (Pob.)",
  "33d": "Barangay 33-D (Pob.)",
  "34d": "Barangay 34-D (Pob.)",
  "35d": "Barangay 35-D (Pob.)",
  "36d": "Barangay 36-D (Pob.)",
  "37d": "Barangay 37-D (Pob.)",
  "38d": "Barangay 38-D (Pob.)",
  "39d": "Barangay 39-D (Pob.)",
  "40d": "Barangay 40-D (Pob.)",
};

// ── Pre-computed indexes ───────────────────────────────────────────
const BY_NORMALIZED = new Map<string, BarangayEntry>();
for (const b of barangaysList) BY_NORMALIZED.set(normalize(b.name), b);

const BY_ALIAS = new Map<string, BarangayEntry>();
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const entry = barangaysList.find((b) => b.name === canonical);
  if (entry) BY_ALIAS.set(alias, entry);
}

// ── Levenshtein distance ───────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ── Public API ─────────────────────────────────────────────────────
export interface ResolveResult {
  entry: BarangayEntry;
  level: 1 | 2 | 3 | 4;
  matchedName: string;
}

const FUZZY_THRESHOLD = 0.7;

export function resolveBarangay(raw: string): ResolveResult | null {
  if (!raw) return null;
  const norm = normalize(raw);
  if (!norm) return null;

  // Level 1: Direct match
  const direct = BY_NORMALIZED.get(norm);
  if (direct) return { entry: direct, level: 1, matchedName: direct.name };

  // Level 2: Alias match
  const alias = BY_ALIAS.get(norm);
  if (alias) return { entry: alias, level: 2, matchedName: alias.name };

  // Level 3: Proper suffix fallback
  if (!norm.endsWith("proper")) {
    const withProper = BY_NORMALIZED.get(norm + " proper");
    if (withProper)
      return { entry: withProper, level: 3, matchedName: withProper.name };
  }

  // Level 4: Fuzzy match (Levenshtein + substring containment)
  let bestEntry: BarangayEntry | null = null;
  let bestScore = 0;

  for (const b of barangaysList) {
    const bNorm = normalize(b.name);
    let score: number;
    if (bNorm.includes(norm) || norm.includes(bNorm)) {
      score = Math.max(similarity(norm, bNorm), 0.75);
    } else {
      score = similarity(norm, bNorm);
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = b;
    }
  }

  if (bestEntry && bestScore >= FUZZY_THRESHOLD) {
    return { entry: bestEntry, level: 4, matchedName: bestEntry.name };
  }

  return null;
}
