// Mirror of src/lib/i18n.ts so Edge Functions can detect locale without
// bundling the frontend.
export type Locale = "en" | "tl" | "ceb";

const TL_ONLY = new Set([
  "ng", "mga", "po", "opo", "naman", "lang", "lamang", "kasi", "bakit", "kahit",
  "talaga", "kailangan", "huwag", "hindi", "ito", "iyan", "iyon", "doon",
  "dito", "saan", "kailan", "paano", "ano", "ikaw", "kayo", "tayo",
  "magkano", "marami", "konti", "pakisabi", "hika", "gamot", "sintomas",
  "tigdas", "trangkaso", "lagnat", "pagod", "ubo", "dugo", "dibdib", "bahay",
  "anak", "mahawa", "magpasuri", "gumaling", "uminom", "umuubo", "umubo",
  "kainin", "kain", "tulog", "tungkol", "tatlong", "linggo", "buwan",
  "katagal", "gaano", "tatanong", "tanong", "alak", "ginagawa", "gagawin",
  "pwede", "kong", "habang", "gumagamot", "ninyo", "iyong", "iyo",
  "nagtatrabaho", "trabaho", "meron", "nakakahawa", "ibang", "impormasyon",
]);

const CEB_ONLY = new Set([
  "og", "ug", "kay", "naa", "asa", "ngano", "unsa", "unsaon", "kinsa", "diay",
  "lagi", "ra", "pud", "pod", "gyud", "gud", "kaayo", "kuyaw", "nindot",
  "lami", "init", "bugnaw", "ganahan", "duna", "imo", "akoa", "ila", "ato",
  "amo", "kining", "kanang", "anang", "diha", "diri", "didto", "dinhi",
  "kinahanglan", "buhaton", "tambal", "hilanat", "hubak", "kapoy", "isulti",
  "palihug", "maayong", "buntag", "udto", "hapon", "gabii", "akong", "imong",
  "iyang", "ilang", "atong", "among", "moinom", "muubo", "mokaon", "moadto",
  "katong", "padayon", "mahimo", "mahimong", "buhata", "samtang", "naga",
  "gihatag", "gihilantan", "gipangutana", "gisulti", "pinakaduol", "duol",
  "pangutana", "kamo", "balay", "pagkaon", "katulog", "tuig", "parehas",
  "bahin", "palihog", "tambalan", "tulo", "duha", "napulo", "pila", "nga",
  "adlaw", "dughan", "dok", "angay",
]);

const EN_STRONG = new Set([
  "the", "is", "are", "was", "were", "and", "or", "but", "of", "in", "on",
  "at", "for", "to", "from", "with", "be", "have", "has", "had", "do", "does",
  "did", "this", "that", "what", "where", "when", "why", "how", "who", "yes",
  "no", "not", "can", "could", "should", "would", "please", "thanks", "thank",
  "hello", "good", "today", "tomorrow", "symptoms", "medicine", "doctor",
  "fever", "cough", "tired", "blood", "treatment", "patient", "during",
  "really", "free", "question", "drink", "alcohol", "while", "chest",
  "information", "you", "always", "children", "transmitted", "prevent",
  "tested",
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
  if (tl > 0 || ceb > 0) {
    if (tl >= ceb) return "tl";
    return "ceb";
  }
  if (en > 0) return "en";
  if (/\b(mga|po|opo|paano|saan|kailan|bakit|kasi)\b/.test(text.toLowerCase()))
    return "tl";
  if (/\b(unsa|asa|ngano|kinsa|naa|kay|gyud)\b/.test(text.toLowerCase()))
    return "ceb";
  return "en";
}
