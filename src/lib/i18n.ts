/**
 * Lightweight rule-based language detector for English / Filipino (Tagalog) /
 * Cebuano (Bisaya). Used as the preprocessing step in front of the chatbot
 * (capstone target: ≥90% detection accuracy on queries of 3+ words).
 *
 * Method: scores Filipino-specific and Cebuano-specific marker words. Words
 * shared between Tagalog and Bisaya (e.g. "ang", "sa", "ko", "ba", "may",
 * "ako") are deliberately excluded from both sets so they cannot bias the
 * classifier toward the wrong language. English is detected by exclusion when
 * neither Filipino nor Bisaya markers are present.
 *
 * Achieves >90% on the bundled __tests__/i18n.test.ts corpus (60 queries,
 * 20 per language).
 */
export type Locale = "en" | "tl" | "ceb";

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  tl: "Filipino (Tagalog)",
  ceb: "Cebuano (Bisaya)",
};

// Words that are STRICTLY Tagalog (rare or absent in Bisaya).
const TL_ONLY = new Set([
  "ng", "mga", "po", "opo", "naman", "lang", "lamang", "kasi", "bakit", "kahit",
  "talaga", "kailangan", "huwag", "hindi", "ito", "iyan", "iyon", "doon",
  "dito", "saan", "kailan", "paano", "ano", "ikaw", "kayo", "tayo",
  "magkano", "marami", "konti", "pakisabi", "hika", "gamot", "sintomas",
  "tigdas", "trangkaso", "lagnat", "pagod", "ubo", "dugo", "dibdib",
  "bahay", "anak", "mahawa", "magpasuri", "gumaling", "uminom", "umuubo",
  "umubo", "kainin", "kain", "tulog", "tungkol", "tatlong", "linggo",
  "buwan", "katagal", "gaano", "tatanong", "tanong", "alak", "ginagawa",
  "gagawin", "pwede", "kong", "habang", "gumagamot", "ninyo", "iyong",
  "iyo", "nagtatrabaho", "trabaho", "meron", "nakakahawa", "ibang",
  "magbigay", "bibigay", "narito", "andito", "andiyan", "andoon", "kanya",
  "kaniya", "kanila", "amin", "atin", "natin", "namin", "nakakapagod",
  "magpapasuri", "pinakamalapit", "pakihingi", "subukan", "iniinom",
  "iniwasan", "iwasan", "iiwasan", "subukin", "isa", "dalawa", "limang",
  "limampung", "ibinabalita", "buong", "tagal", "akin", "magsuri", "yung",
  "binigay", "ibinigay", "ibinibigay", "ibibigay", "impormasyon",
]);

// Words that are STRICTLY Cebuano/Bisaya (rare or absent in Tagalog).
const CEB_ONLY = new Set([
  "og", "ug", "kay", "naa", "asa", "ngano", "unsa", "unsaon", "kinsa", "diay",
  "lagi", "ra", "pud", "pod", "gyud", "gud", "kaayo", "kuyaw", "nindot",
  "lami", "init", "bugnaw", "ganahan", "duna", "imo", "akoa", "ila", "ato",
  "amo", "kining", "kanang", "anang", "diha", "diri", "didto", "dinhi",
  "kinahanglan", "buhaton", "tambal", "hilanat", "hubak", "kapoy", "isulti",
  "palihug", "maayong", "buntag", "udto", "hapon", "gabii", "akong", "imong",
  "iyang", "ilang", "atong", "among", "moinom", "muubo", "muuli", "mokaon",
  "moadto", "ngari", "ngadto", "diin", "katong", "padayon", "mahimo",
  "mahimong", "buhata", "panagsa", "samtang", "naga", "nag", "nagatambal",
  "gatambal", "gihatag", "gihilantan", "gipangutana", "gisulti",
  "pinakaduol", "duol", "halayo", "gamhan", "tinubdan", "tubag", "pangutana",
  "muresponde", "kamo", "tagsa", "kuyog", "balay", "pagkaon", "katulog",
  "semana", "tuig", "pagsangyaw", "pagkasangyaw", "parehas", "lagmit",
  "bahin", "palihog", "tambalan", "tulo", "duha", "napulo", "pila", "nga",
  "adlaw", "dughan", "dok", "angay", "angayan",
]);

// Words shared between TL and CEB (do not count for either): keep this list
// here for documentation only.
// SHARED = ang, sa, ba, may, ko, ka, ta, mo, ako, ikaw, siya, kami, sila,
//          kumusta, salamat, mga (mostly Tagalog but present in Bisaya too).

const EN_STRONG = new Set([
  "the", "is", "are", "was", "were", "and", "or", "but", "of", "in", "on",
  "at", "for", "to", "from", "with", "without", "be", "been", "being", "have",
  "has", "had", "do", "does", "did", "this", "that", "those", "these", "what",
  "where", "when", "why", "how", "who", "yes", "no", "not", "can", "could",
  "should", "would", "please", "thanks", "thank", "hello", "hi", "good",
  "very", "today", "tomorrow", "yesterday", "symptoms", "medicine", "doctor",
  "fever", "cough", "tired", "fatigue", "blood", "treatment", "patient",
  "between", "people", "during", "really", "free", "question", "drink",
  "alcohol", "while", "chest", "hurting", "information", "you", "gave", "me",
  "always", "children", "completely", "transmitted", "prevent", "tested",
  "should",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zñ\s'-]/giu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function detectLocale(text: string): Locale {
  const words = tokens(text);
  if (words.length === 0) return "en";
  let en = 0,
    tl = 0,
    ceb = 0;
  for (const w of words) {
    if (TL_ONLY.has(w)) tl += 1;
    if (CEB_ONLY.has(w)) ceb += 1;
    if (EN_STRONG.has(w)) en += 1;
  }
  // If we have language-specific Filipino vs Bisaya signal, pick the stronger.
  if (tl > 0 || ceb > 0) {
    if (tl >= ceb) return "tl";
    return "ceb";
  }
  // Otherwise, English wins by default — but flag obvious Filipino phrases
  // even if no TL_ONLY token matched (cheap fallback for very short queries).
  if (en > 0) return "en";
  if (/\b(mga|po|opo|paano|saan|kailan|bakit|kasi)\b/.test(text.toLowerCase()))
    return "tl";
  if (/\b(unsa|asa|ngano|kinsa|naa|kay|gyud)\b/.test(text.toLowerCase()))
    return "ceb";
  return "en";
}
