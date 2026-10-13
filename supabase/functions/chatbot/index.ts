// BANTAY-TB multilingual chatbot Edge Function (self-contained, no shared imports).
//
// Behaviour:
//   • Accepts {session_id, message, language?, user_id?, role?, context?}.
//   • role: "patient" -> support-only prompt; no case statistics.
//     All other roles (health_worker, barangay_admin, tb_coordinator,
//     system_admin) -> clinical staff prompt; context is injected when present.
//   • context: optional pre-fetched live DB data injected into the system
//     prompt. For staff roles this is case stats/hotspots; for patients it is
//     their OWN treatment record (the client builds it via RLS-scoped
//     queries, so a patient can never receive another patient's data).
//   • role: "public" (or absent) -> answerPublic(): the knowledge base
//     (BANTAY-TB platform + eight respiratory diseases, ingested by
//     scripts/ingest-kb.ts) is used before any AI request — small talk,
//     the answer cache, and direct article lookups cost nothing. Only the
//     rest goes to RAG (embeddings + completion, answering only from the
//     retrieved passages), and those answers are cached. A question with no
//     passage above KB_MIN_SIMILARITY gets a fixed out-of-scope reply.
//   • Detects the language if not supplied.
//   • If OPENAI_API_KEY is set, forwards the message to OpenAI Chat Completions.
//   • Otherwise returns a deterministic, locale-aware fallback.
//
// All assistant replies are persisted to the chatbot_messages table.

declare const Deno: any;

// ─── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ─── DB helpers ──────────────────────────────────────────────────────────────

interface DbConfig { url: string; key: string; }

function dbFromEnv(): DbConfig | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return { url, key };
}

async function dbInsert(
  cfg: DbConfig,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([row]),
  });
  if (!res.ok) {
    throw new Error(`db insert ${table}: ${res.status} ${await res.text()}`);
  }
}

// ─── i18n / locale detection ─────────────────────────────────────────────────

type Locale = "en" | "tl" | "ceb";

// Mirrors src/lib/i18n.ts — this function deploys with `--no-remote` and
// cannot import from src/, so the two copies must be changed together.
//
// Only STRICTLY Tagalog words belong here. Words shared with Cebuano
// (mga, sintomas, impormasyon, anak, alak, mahawa) were removed: a Bisaya
// sentence carrying one decisive marker lost to two shared ones, and the
// tie-break below favours Tagalog. That cost 3 of 20 Cebuano test queries.
const TL_ONLY = new Set([
  "ng","po","opo","naman","lang","lamang","kasi","bakit","kahit",
  "talaga","kailangan","huwag","hindi","ito","iyan","iyon","doon","dito",
  "saan","kailan","paano","ano","ikaw","kayo","tayo","magkano","marami",
  "konti","pakisabi","hika","gamot","tigdas","trangkaso","lagnat",
  "pagod","ubo","dugo","dibdib","bahay","magpasuri","gumaling",
  "uminom","umuubo","umubo","kainin","kain","tulog","tungkol","tatlong",
  "linggo","buwan","katagal","gaano","tatanong","tanong","ginagawa",
  "gagawin","pwede","kong","habang","gumagamot","ninyo","iyong","iyo",
  "nagtatrabaho","trabaho","meron","nakakahawa","ibang",
]);

const CEB_ONLY = new Set([
  "og","ug","kay","naa","asa","ngano","unsa","unsaon","kinsa","diay","lagi",
  "ra","pud","pod","gyud","gud","kaayo","kuyaw","nindot","lami","init",
  "bugnaw","ganahan","duna","imo","akoa","ila","ato","amo","kining","kanang",
  "anang","diha","diri","didto","dinhi","kinahanglan","buhaton","tambal",
  "hilanat","hubak","kapoy","isulti","palihug","maayong","buntag","udto",
  "hapon","gabii","akong","imong","iyang","ilang","atong","among","moinom",
  "muubo","mokaon","moadto","katong","padayon","mahimo","mahimong","buhata",
  "samtang","naga","gihatag","gihilantan","gipangutana","gisulti",
  "pinakaduol","duol","pangutana","kamo","balay","pagkaon","katulog","tuig",
  "parehas","bahin","palihog","tambalan","tulo","duha","napulo","pila","nga",
  "adlaw","dughan","dok","angay",
]);

const EN_STRONG = new Set([
  "the","is","are","was","were","and","or","but","of","in","on","at","for",
  "to","from","with","be","have","has","had","do","does","did","this","that",
  "what","where","when","why","how","who","yes","no","not","can","could",
  "should","would","please","thanks","thank","hello","good","today","tomorrow",
  "symptoms","medicine","doctor","fever","cough","tired","blood","treatment",
  "patient","during","really","free","question","drink","alcohol","while",
  "chest","information","you","always","children","transmitted","prevent",
  "tested",
]);

function detectLocale(text: string): Locale {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s'-]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "en";
  let en = 0, tl = 0, ceb = 0;
  for (const w of words) {
    if (TL_ONLY.has(w)) tl++;
    if (CEB_ONLY.has(w)) ceb++;
    if (EN_STRONG.has(w)) en++;
  }
  if (tl > 0 || ceb > 0) return tl >= ceb ? "tl" : "ceb";
  if (en > 0) return "en";
  const lower = text.toLowerCase();
  if (/\b(mga|po|opo|paano|saan|kailan|bakit|kasi)\b/.test(lower)) return "tl";
  if (/\b(unsa|asa|ngano|kinsa|naa|kay|gyud)\b/.test(lower)) return "ceb";
  return "en";
}

// ─── System prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<Locale, string> = {
  en: "You are BANTAY-TB, a clinical health assistant for tuberculosis and respiratory diseases in Davao City. Reply concisely (under 120 words) in clear, plain English. Always recommend visiting the nearest DOTS center for diagnosis. Never give specific drug doses for individual patients.",
  tl: "Ikaw si BANTAY-TB, isang clinical health assistant para sa tuberkulosis at sakit sa baga sa Davao City. Sumagot nang maikli (mas kaunti sa 120 salita) sa simpleng Filipino/Tagalog. Laging irekomenda ang pagpunta sa pinakamalapit na DOTS Center para sa pagsusuri. Huwag magbigay ng partikular na dosage ng gamot.",
  ceb: "Ikaw si BANTAY-TB, usa ka clinical health assistant alang sa tuberkulosis ug sakit sa baga sa Davao City. Tubaga sa mubo (ubos sa 120 ka pulong) sa yano nga Cebuano. Kanunay nga isugyot ang pag-adto sa pinaka-suod nga DOTS Center alang sa eksamen. Ayaw paghatag og piho nga dosage sa tambal.",
};

// Patient support prompts: no surveillance data, focus on care and adherence
const PATIENT_PROMPTS: Record<Locale, string> = {
  en: "You are BANTAY-TB, a supportive health assistant for TB patients and their families in Davao City. Provide general health education, symptom guidance, treatment adherence encouragement, and emotional support. Reply concisely (under 120 words) in plain English. Always recommend consulting the nearest DOTS center for medical concerns. Do NOT provide case statistics, epidemiological data, or surveillance figures.",
  tl: "Ikaw si BANTAY-TB, isang health support assistant para sa mga pasyenteng may TB at kanilang pamilya sa Davao City. Magbigay ng pangkalahatang edukasyon sa kalusugan, gabay sa sintomas, at emosyonal na suporta. Sumagot nang maikli (wala pang 120 salita) sa Filipino. Irekomenda ang DOTS Center para sa medikal na alalahanin. HUWAG magbigay ng estadistika ng kaso o surveillance data.",
  ceb: "Ikaw si BANTAY-TB, usa ka health support assistant para sa mga pasyente sa TB ug ilang pamilya sa Davao City. Maghatag og kinatibuk-ang edukasyon sa kahimsog, giya sa sintomas, ug emosyonal nga suporta. Tubaga sa mubo (ubos sa 120 ka pulong) sa Cebuano. Irekomenda ang DOTS Center para sa medikal nga mga kabalaka. AYAW paghatag og estadistika sa kaso o surveillance data.",
};

// Platform knowledge for public visitors — lets the homepage chatbot
// explain how BANTAY-TB works, in any of the three languages.
const SYSTEM_INFO = `

ABOUT THE BANTAY-TB PLATFORM (use this when visitors ask how the system, website, or app works):
- BANTAY-TB is Davao City's tuberculosis surveillance and care platform.
- Public visitors can: use the DOTS Center Locator (a map with directions to free TB treatment centers), read Health Education articles about TB symptoms/treatment/prevention, and chat with this assistant in English, Filipino, or Cebuano.
- Patients with accounts get: medication schedules, dose reminders (including SMS), dose tracking, health education, and a personal health assistant that can report their own treatment progress.
- Health workers, barangay admins, and TB coordinators sign in to: encode and track TB cases, view the GIS surveillance map and heatmaps, identify hotspots (areas with a high concentration of TB cases), receive alerts when a new high-severity hotspot is found, and view outreach analytics.
- To get an account: patients do not sign up themselves — the nurse who enrolls them gives a claim code, entered under "I have a claim code". Staff use the staff registration page with an invite code.
- TB screening and DOTS treatment are free at DOTS centers in Davao City.

SCOPE: only discuss the BANTAY-TB platform and these diseases: tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, paragonimiasis. Politely decline anything else.`;

// ─── Public RAG ──────────────────────────────────────────────────────────────

interface KbHit {
  content: string;
  topic: string;
  title: string;
  similarity: number;
}

const LANGUAGE_NAME: Record<Locale, string> = {
  en: "English",
  tl: "Filipino (Tagalog)",
  ceb: "Cebuano (Bisaya)",
};

const OUT_OF_SCOPE: Record<Locale, string> = {
  en: "Sorry, I can only help with questions about BANTAY-TB and these diseases: tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis (lung fluke). For other health concerns, please visit your nearest health center.",
  tl: "Paumanhin, ang maaari ko lamang sagutin ay tungkol sa BANTAY-TB at sa mga sakit na ito: Tuberkulosis, Pulmonya, COVID-19, Trangkaso, Bronchitis, COPD (Malalang Sakit sa Baga), Hika, at Paragonimiasis (Uod sa Baga). Para sa ibang alalahanin sa kalusugan, bumisita sa pinakamalapit na health center.",
  ceb: "Pasayloa, ang matubag ra nako mao ang bahin sa BANTAY-TB ug niining mga sakita: Tuberkulosis, Pulmonya, COVID-19, Trangkaso, Bronchitis, COPD (Dugay nga Sakit sa Baga), Hubak, ug Paragonimiasis (Ulod sa Baga). Para sa ubang kabalaka sa panglawas, adto sa pinaka-duol nga health center.",
};

// Greetings, thanks and goodbyes carry no topic, so retrieval scores them as
// off-topic and they used to get the refusal. They are answered here instead,
// before retrieval, without calling the model.
type SmallTalk = "greet" | "thanks" | "bye";

const SMALL_TALK_REPLIES: Record<SmallTalk, Record<Locale, string>> = {
  greet: {
    en: "Good day. How may I assist you? You may ask about the symptoms, treatment, or prevention of tuberculosis and other respiratory diseases, or about how to use BANTAY-TB.",
    tl: "Magandang araw po. Paano ko po kayo matutulungan? Maaari po kayong magtanong tungkol sa sintomas, paggamot, o pag-iwas sa tuberkulosis at iba pang sakit sa baga, o kung paano gamitin ang BANTAY-TB.",
    ceb: "Maayong adlaw. Unsaon nako pagtabang kaninyo? Mahimo kamong mangutana bahin sa sintomas, tambal, o paglikay sa tuberkulosis ug uban pang sakit sa baga, o unsaon paggamit sa BANTAY-TB.",
  },
  thanks: {
    en: "You're welcome! If you have more questions about TB or other respiratory diseases, just ask. Stay healthy!",
    tl: "Walang anuman! Kung may iba ka pang tanong tungkol sa TB o iba pang sakit sa baga, magtanong lang. Ingat palagi!",
    ceb: "Walay sapayan! Kung naa pa kay pangutana bahin sa TB o uban pang sakit sa baga, pangutana lang. Amping kanunay!",
  },
  bye: {
    en: "Take care! Remember, TB screening and treatment are free at DOTS centers in Davao City.",
    tl: "Ingat! Tandaan, libre ang TB screening at paggamot sa mga DOTS center sa Davao City.",
    ceb: "Amping! Hinumdumi, libre ang TB screening ug pagtambal sa mga DOTS center sa Davao City.",
  },
};

const SMALL_TALK_PATTERNS: [SmallTalk, RegExp][] = [
  ["greet", /^(hi+|hello+|hey+|helo|good (morning|afternoon|evening|day)|kumusta|kamusta|musta|magandang (umaga|tanghali|hapon|gabi)|maayong (buntag|udto|hapon|gabii))$/],
  ["thanks", /^(thanks?|thank you( (so|very) much)?|ty|salamat|daghang salamat|maraming salamat)$/],
  ["bye", /^(bye+|goodbye|good ?bye|see you|paalam|babay|ba-bye)$/],
];

/** The kind of small talk a message is, if the whole message is just that.
 *  Courtesy words ("po", "kaayo", the assistant's name) are ignored. */
function smallTalk(message: string): SmallTalk | null {
  const core = message
    .toLowerCase()
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\b(po|kaayo|kayo|ka|bantay-?tb|bot|there|again|din|pud)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [kind, re] of SMALL_TALK_PATTERNS) if (re.test(core)) return kind;
  return null;
}

/** Greeting words that settle the language when the detector cannot. */
function smallTalkLocale(message: string, fallback: Locale): Locale {
  const m = message.toLowerCase();
  if (/\b(magandang|maraming|paalam|walang|po)\b/.test(m)) return "tl";
  if (/\b(maayong|daghang|kaayo|babay)\b/.test(m)) return "ceb";
  if (/\b(hi|hello|hey|good|thanks?|thank|bye|goodbye)\b/.test(m)) return "en";
  return fallback;
}

// Passages can match an off-topic question that merely mentions Davao or the
// Philippines. The model flags those with this token so the visitor gets the
// same fixed refusal as a no-match question — no ad-lib wording, no sources.
const OUT_OF_SCOPE_TOKEN = "OUT_OF_SCOPE";

// ─── Answers without AI requests ─────────────────────────────────────────────
//
// The free AI quota is small, so the public chatbot spends it last:
//   1. small talk            → canned reply
//   2. asked before          → chatbot_answer_cache
//   3. one clear disease + topic, or a system question
//                            → that knowledge-base article, verbatim
//   4. anything else         → embeddings + completion, then cached
//   5. AI unavailable        → closest article for the disease named, if any

async function dbGet<T>(cfg: DbConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) throw new Error(`db get ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const DISEASES: [string, RegExp][] = [
  ["tuberculosis", /\b(tb|tuberculosis|tuberkulosis|tisis)\b/],
  ["pneumonia", /\b(pneumonia|pulmonya|pulmonia)\b/],
  ["covid19", /\b(covid(-?19)?|coronavirus)\b/],
  ["influenza", /\b(flu|influenza|trangkaso)\b/],
  ["bronchitis", /\b(bronchitis|brongkitis)\b/],
  ["copd", /\b(copd|emphysema)\b/],
  ["asthma", /\b(asthma|hika|hubak)\b/],
  ["paragonimiasis", /\b(paragonimiasis|paragonimus|lung fluke|u?l?od sa baga)\b/],
];

const CATEGORIES: [string, RegExp][] = [
  ["symptoms", /\b(symptoms?|signs?|sintomas|palatandaan|timailhan)\b/],
  ["treatment", /\b(treat|treated|treatment|cure|cured|curable|medicines?|medication|gamot|gamutin|gamutan|ginagamot|paggamot|tambal|tambalan|pagtambal)\b/],
  ["prevention", /\b(prevent|prevented|prevention|avoid|iwas|iwasan|maiwasan|maiiwasan|makaiwas|pag-?iwas|likay|likayan|malikayan|paglikay|pag-?likay)\b/],
  ["lifestyle", /\b(food|foods|diet|eat|nutrition|exercise|sleep|lifestyle|pagkain|kain|pagkaon|kaon|ehersisyo|tulog|katulog)\b/],
];

// Checked before diseases: "Libre ba ang gamot sa TB?" is a cost question.
const SYSTEM_INTENTS: [string, RegExp][] = [
  ["free-care", /\b(free|libre|cost|costs|bayad|magkano|where can i (get )?(tested|test|checked)|saan (ako )?(pwede |puwede )?magpa-?suri|asa (ko )?(makapa-?susi|magpa-?susi))\b/],
  ["staff", /\b(health workers?|staff|coordinators?|bhw|barangay admin)\b/],
  ["patient-accounts", /\b(account|claim code|sign ?up|register|mag-?sign ?up|log ?in)\b/],
  ["public-features", /\b(website|site|features?|dots locator|locator|learn page)\b/],
];

const OVERVIEW_ASK = /^(what is|what's|whats|what are|ano ang|ano ba ang|unsa ang|unsa ba ang|tell me about|about|explain|define)\b/;
// Questions that need reasoning across facts are left to the model.
const NEEDS_REASONING = /\b(difference|different|vs|versus|compare|kaibahan|pagkakaiba|kalainan|why|bakit|ngano|if i|kung ako)\b/;

function normalise(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Answer { reply: string; sources: string[]; }

/** Pick the one knowledge-base document a question is plainly about.
 *  `loose` (used only when the AI is unavailable) accepts a bare disease
 *  mention and falls back to its overview. */
function pickDocument(message: string, loose: boolean): { topic: string; category: string } | null {
  const q = normalise(message);
  if (!loose && (q.split(" ").length > 12 || NEEDS_REASONING.test(q))) return null;

  for (const [category, re] of SYSTEM_INTENTS) {
    if (re.test(q)) return { topic: "system", category };
  }

  // "BANTAY-TB" contains "tb" — take the brand out before looking for TB.
  const brand = /\bbantay[\s-]?tb\b/g;
  const mentionsBrand = brand.test(q);
  const qd = q.replace(brand, " ");
  const diseases = DISEASES.filter(([, re]) => re.test(qd)).map(([t]) => t);
  if (diseases.length === 0) {
    return mentionsBrand ? { topic: "system", category: "about" } : null;
  }
  if (diseases.length > 1 && !loose) return null;

  const categories = CATEGORIES.filter(([, re]) => re.test(qd)).map(([c]) => c);
  if (categories.length === 1) return { topic: diseases[0], category: categories[0] };
  if (categories.length > 1 && !loose) return null;
  // No category: only a plain "what is X?" (or the bare name) is an overview.
  if (loose || OVERVIEW_ASK.test(q) || q.split(" ").length <= 3) {
    return { topic: diseases[0], category: "overview" };
  }
  return null;
}

/** Answer straight from the knowledge base — zero AI requests. */
async function directAnswer(
  cfg: DbConfig,
  message: string,
  language: Locale,
  loose = false
): Promise<Answer | null> {
  const pick = pickDocument(message, loose);
  if (!pick) return null;
  try {
    const rows = await dbGet<{ title: string; kb_chunks: { content: string }[] }[]>(
      cfg,
      `kb_documents?select=title,kb_chunks(content)` +
        `&topic=eq.${pick.topic}&language=eq.${language}&category=eq.${pick.category}&limit=1`
    );
    const doc = rows[0];
    const content = doc?.kb_chunks?.[0]?.content;
    if (!doc || !content) return null;
    // Chunk text is "<label line>\n<summary>\n<body>"; the label line is for
    // embeddings, not for people.
    const reply = content.split("\n").slice(1).filter(Boolean).join("\n\n");
    return { reply, sources: [doc.title] };
  } catch (err) {
    console.error("direct answer lookup failed:", err);
    return null;
  }
}

async function cacheGet(cfg: DbConfig, key: string, language: Locale): Promise<Answer | null> {
  try {
    const rows = await dbGet<Answer[]>(
      cfg,
      `chatbot_answer_cache?select=reply,sources` +
        `&question_key=eq.${encodeURIComponent(key)}&language=eq.${language}&limit=1`
    );
    return rows[0] ?? null;
  } catch (err) {
    console.error("cache read failed:", err);
    return null;
  }
}

async function cachePut(cfg: DbConfig, key: string, language: Locale, a: Answer): Promise<void> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/chatbot_answer_cache`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ question_key: key, language, reply: a.reply, sources: a.sources }]),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("cache write failed:", err);
  }
}

interface PublicAnswer extends Answer {
  language: Locale;
  /** Where the reply came from — handy when checking AI spend. */
  via: "small-talk" | "cache" | "knowledge-base" | "ai" | "knowledge-base-fallback" | "fallback";
}

async function answerPublic(message: string, detected: Locale): Promise<PublicAnswer> {
  let language = detected;

  const talk = smallTalk(message);
  if (talk) {
    language = smallTalkLocale(message, language);
    return { reply: SMALL_TALK_REPLIES[talk][language], sources: [], language, via: "small-talk" };
  }

  const cfg = dbFromEnv();
  const key = normalise(message);
  if (cfg) {
    const cached = await cacheGet(cfg, key, language);
    if (cached) return { ...cached, language, via: "cache" };
    const direct = await directAnswer(cfg, message, language);
    if (direct) return { ...direct, language, via: "knowledge-base" };
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { reply: FALLBACKS[language], sources: [], language, via: "fallback" };

  try {
    const hits = await retrieve(message);
    let answer: Answer;
    if (hits !== null && hits.length === 0) {
      answer = { reply: OUT_OF_SCOPE[language], sources: [] };
    } else {
      const system = hits
        ? publicRagPrompt(language, hits)
        : SYSTEM_PROMPTS[language] + SYSTEM_INFO;
      const reply = (await complete(apiKey, system, message)) ?? FALLBACKS[language];
      answer = reply.includes(OUT_OF_SCOPE_TOKEN)
        ? { reply: OUT_OF_SCOPE[language], sources: [] }
        : { reply, sources: hits ? [...new Set(hits.map((h) => h.title))] : [] };
    }
    // Only answers grounded in the knowledge base are worth repeating.
    if (cfg && hits !== null) await cachePut(cfg, key, language, answer);
    return { ...answer, language, via: "ai" };
  } catch (err) {
    // Quota used up or provider down: an article beats "offline".
    if (cfg) {
      const loose = await directAnswer(cfg, message, language, true);
      if (loose) return { ...loose, language, via: "knowledge-base-fallback" };
    }
    throw err;
  }
}

/** Embed the question and fetch the closest knowledge-base passages.
 *  Returns null when retrieval itself is unavailable (so the caller can fall
 *  back), and [] when it worked but nothing was relevant enough. */
async function retrieve(question: string): Promise<KbHit[] | null> {
  const cfg = dbFromEnv();
  const apiKey =
    Deno.env.get("EMBEDDING_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!cfg || !apiKey) return null;
  // Embeddings may live on a different provider than chat completions
  // (e.g. chat via an OpenAI-compatible host that has no /v1/embeddings).
  // Must be the same model scripts/ingest-kb.ts used.
  const base = (
    Deno.env.get("EMBEDDING_BASE_URL") ??
    Deno.env.get("OPENAI_BASE_URL") ??
    "https://api.openai.com"
  )
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
  const model = Deno.env.get("EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const minSim = Number(Deno.env.get("KB_MIN_SIMILARITY") ?? "0.3");

  try {
    const embRes = await fetch(`${base}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: question }),
    });
    if (!embRes.ok) {
      throw new Error(`embeddings ${embRes.status}: ${await embRes.text()}`);
    }
    const embedding = (await embRes.json())?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) throw new Error("no embedding returned");

    const rpcRes = await fetch(`${cfg.url}/rest/v1/rpc/match_kb_chunks`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: JSON.stringify(embedding),
        k: 5,
        min_sim: minSim,
      }),
    });
    if (!rpcRes.ok) {
      throw new Error(`match_kb_chunks ${rpcRes.status}: ${await rpcRes.text()}`);
    }
    const hits = (await rpcRes.json()) as KbHit[];
    if (hits.length > 0) return hits;

    // No match is only "out of scope" if there was something to match —
    // an un-ingested knowledge base must not turn every question away.
    const anyRes = await fetch(`${cfg.url}/rest/v1/kb_chunks?select=id&limit=1`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!anyRes.ok) throw new Error(`kb_chunks ${anyRes.status}`);
    if (((await anyRes.json()) as unknown[]).length === 0) {
      throw new Error("knowledge base is empty — run npm run kb:ingest");
    }
    return [];
  } catch (err) {
    console.error("kb retrieval failed, using built-in prompt:", err);
    return null;
  }
}

function publicRagPrompt(language: Locale, hits: KbHit[]): string {
  const sources = hits
    .map((h, i) => `[${i + 1}] ${h.title} (${h.topic})\n${h.content}`)
    .join("\n\n");
  return `You are BANTAY-TB, the public assistant on Davao City's tuberculosis surveillance website. You may ONLY talk about the BANTAY-TB platform and these eight diseases: tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis.

Rules:
- Answer ONLY from the SOURCES below. If they do not contain the answer, say you do not have that information and suggest asking at the nearest DOTS center. Never add outside facts or invent details.
- If the question is about anything else, reply with exactly ${OUT_OF_SCOPE_TOKEN} and nothing more.
- Never diagnose, and never give drug doses for an individual. When someone describes symptoms, recommend the nearest DOTS center (screening and treatment are free).
- Reply in ${LANGUAGE_NAME[language]}, concisely (under 120 words), in plain words. Sources may be written in another language; translate as needed.

SOURCES:
${sources}`;
}

const FALLBACKS: Record<Locale, string> = {
  en: "I can answer questions about TB, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis -- symptoms, treatment, prevention, and DOTS center information. For diagnosis, please visit the nearest DOTS center. (No AI key configured.)",
  tl: "Maaari akong sumagot tungkol sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hika, at paragonimiasis -- sintomas, paggamot, pag-iwas, at DOTS Center. Para sa diagnosis, bumisita sa pinakamalapit na DOTS Center.",
  ceb: "Makahatag ko og impormasyon mahitungod sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hubak, ug paragonimiasis -- sintomas, tambal, pag-likay, ug DOTS Center. Para sa diagnosis, adto sa pinaka-suod nga DOTS Center.",
};

// ─── Request body type ───────────────────────────────────────────────────────

interface Body {
  session_id: string;
  message: string;
  language?: Locale;
  user_id?: string | null;
  role?: string | null;
  context?: string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as Body;
    if (!body?.message || !body?.session_id) {
      return json({ error: "session_id and message are required" }, 400);
    }

    let language: Locale = body.language ?? detectLocale(body.message);
    const isPatient = body.role === "patient";
    const isPublicRole = !body.role || body.role === "public";

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    let reply: string;
    let sources: string[] = [];
    let via: PublicAnswer["via"] | undefined;
    if (isPublicRole) {
      // Public visitors: knowledge base first, AI only when needed.
      const a = await answerPublic(body.message, language);
      ({ reply, sources, language, via } = a);
    } else if (apiKey) {
      let systemContent = isPatient
        ? PATIENT_PROMPTS[language]
        : SYSTEM_PROMPTS[language];

      if (isPatient && body.context) {
        // The client only ever sends a patient their OWN adherence record
        // (RLS-scoped queries) — never case statistics.
        systemContent +=
          "\n\nTHE PATIENT'S OWN TREATMENT RECORD (this belongs to the patient you are talking to — share it with them clearly and kindly):\n" +
          body.context +
          "\nUse these figures when the patient asks about their own treatment, doses, or progress. Encourage adherence; if doses were missed, advise gently and suggest telling their health worker. Never invent figures that are not listed above.";
      } else if (!isPatient && body.context) {
        systemContent +=
          "\n\nLIVE DATABASE CONTEXT (use this to answer statistics questions):\n" +
          body.context +
          "\nWhen answering questions about case counts or statistics, use only the figures above and state that they come from the live BANTAY-TB database. If a figure the user asks for is not listed, say it is not available rather than guessing.";
      }

      reply =
        (await complete(apiKey, systemContent, body.message)) ??
        FALLBACKS[language];
    } else {
      reply = FALLBACKS[language];
    }

    // Persist assistant message (best effort)
    const cfg = dbFromEnv();
    if (cfg) {
      try {
        await dbInsert(cfg, "chatbot_messages", {
          session_id: body.session_id,
          user_id: body.user_id ?? null,
          role: "assistant",
          content: reply,
          language,
        });
      } catch (err) {
        console.error("chatbot persist failed:", err);
      }
    }

    return json({ reply, language, sources, via });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

async function complete(
  apiKey: string,
  systemContent: string,
  message: string
): Promise<string | undefined> {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const rawBase =
    (Deno.env.get("OPENAI_BASE_URL") ?? "").replace(/\/+$/, "") ||
    "https://api.openai.com";
  const baseUrl = rawBase.replace(/\/v1$/, "");
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content?.trim();
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
