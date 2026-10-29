import barangaysList from "../data/barangays.json";

export interface MentionedBarangay {
  psgc: number;
  name: string;
}

// Hyphens and accents vanish so "Ma-a" is "maa" and "Santo Niño" is "santo
// nino"; every other mark becomes a space. Both the question and the names go
// through this, so "cases in maa?" and "Ma-a" meet in the middle.
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/-/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(brgy|bgy)\b/g, "barangay")
    .replace(/\s+/g, " ")
    .trim();
}

// Name parts shared by many barangays. "barangay" alone sits in 40 names
// ("Barangay 19-B (Pob.)"), so matching on it reported three arbitrary
// downtown barangays whenever someone typed "barangay Maa".
const GENERIC_PARTS = new Set(["barangay", "crossing", "proper", "pob"]);

interface Entry extends MentionedBarangay {
  /** Whole-name forms: the name without its parenthetical, the alias inside
   *  it ("Lasang", "Tuli"), and the bare code of a numbered barangay ("19b"). */
  full: string[];
  /** Distinctive single words, for "matina" → Matina Crossing / Aplaya / Pangi. */
  parts: string[];
}

const ENTRIES: Entry[] = (barangaysList as MentionedBarangay[]).map((b) => {
  const paren = b.name.match(/\(([^)]*)\)/)?.[1] ?? "";
  const base = normalize(b.name.replace(/\([^)]*\)/g, " "));
  const full = [base];
  if (paren && !/^pob\.?$/i.test(paren.trim())) full.push(normalize(paren));
  const code = base.match(/^barangay (\d+[a-d])$/)?.[1];
  if (code) full.push(code);
  const parts = base
    .split(" ")
    .filter((p) => p.length >= 4 && !GENERIC_PARTS.has(p));
  return { psgc: b.psgc, name: b.name, full, parts };
});

const containsPhrase = (haystack: string, phrase: string) =>
  phrase.length > 0 && ` ${haystack} `.includes(` ${phrase} `);

/**
 * Barangays named in a free-text question, whole names first. A distinctive
 * word ("matina", "catalunan") only counts when no barangay is named in full,
 * so "Matina Crossing" does not also drag in Matina Aplaya and Matina Pangi.
 */
export function findMentionedBarangays(
  text: string,
  limit = 3
): MentionedBarangay[] {
  const q = normalize(text);
  const pick = (e: Entry) => ({ psgc: e.psgc, name: e.name });

  const whole = ENTRIES.filter((e) => e.full.some((f) => containsPhrase(q, f)));
  if (whole.length > 0) return whole.slice(0, limit).map(pick);

  return ENTRIES.filter((e) => e.parts.some((p) => containsPhrase(q, p)))
    .slice(0, limit)
    .map(pick);
}
